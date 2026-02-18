"""Task dispatch and payload-building helpers for importer views."""

from typing import Any

from apps.importer.models import ImportJob
from apps.importer.services.import_preparation import detect_conflicts
from apps.importer.services.job_config_contracts import PrescanSnapshot


def dispatch_job_task(job: ImportJob, task: Any) -> str:
    """Queue a celery task for an import job and persist celery task id."""
    queued_task = task.delay(job.id)
    job.celery_task_id = queued_task.id
    job.save(update_fields=["celery_task_id"])
    return queued_task.id


def build_task_started_payload(
    *,
    detail: str,
    task_id: str,
    job_id: int,
) -> dict[str, Any]:
    """Build a consistent API payload for newly started async import jobs."""
    return {
        "detail": detail,
        "task_id": task_id,
        "job_id": job_id,
    }


def build_conflict_resolution_map(
    conflict_resolutions: list[dict[str, str | None]],
) -> dict[str, dict[str, str | None]]:
    """Convert conflict resolution list payload into nested map format."""
    conflict_map: dict[str, dict[str, str | None]] = {}
    for resolution in conflict_resolutions:
        sheet = resolution["sheet"]
        load_case = resolution["load_case"]
        chosen_file = resolution["chosen_file"]
        if sheet not in conflict_map:
            conflict_map[sheet] = {}
        conflict_map[sheet][load_case] = chosen_file
    return conflict_map


def build_prescan_payload(job: ImportJob, prescan_data: PrescanSnapshot) -> dict[str, Any]:
    """Build prescan API payload including aggregate load-cases and conflicts."""
    file_load_cases = prescan_data.file_load_cases

    all_load_cases: dict[str, dict[str, set[str]]] = {}
    for file_name, sheets in file_load_cases.items():
        for sheet_name, cases in sheets.items():
            for case in cases:
                if case not in all_load_cases:
                    all_load_cases[case] = {"files": set(), "sheets": set()}
                all_load_cases[case]["files"].add(file_name)
                all_load_cases[case]["sheets"].add(sheet_name)

    load_case_list = [
        {
            "name": name,
            "files": sorted(info["files"]),
            "sheets": sorted(info["sheets"]),
        }
        for name, info in sorted(all_load_cases.items())
    ]

    conflicts = detect_conflicts(file_load_cases, set(all_load_cases.keys()))
    for item in load_case_list:
        item["has_conflict"] = item["name"] in conflicts

    conflict_list = [
        {
            "load_case": load_case,
            "sheet": sheet,
            "files": files,
        }
        for load_case, sheet_files in conflicts.items()
        for sheet, files in sheet_files.items()
    ]

    return {
        "job_id": job.id,
        "status": job.status,
        "files_scanned": prescan_data.files_scanned,
        "load_cases": load_case_list,
        "conflicts": conflict_list,
        "foundation_joints": prescan_data.foundation_joints,
        "errors": prescan_data.errors,
    }
