"""Start-flow helpers for importer endpoints."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from apps.importer.models import ImportJob
from apps.importer.serializers import ImportStartSerializer, PushoverImportStartSerializer
from apps.projects.models import Project
from apps.results.models import ResultSet

from .job_dispatch import (
    build_conflict_resolution_map,
    build_task_started_payload,
    dispatch_job_task,
)
from .job_config_contracts import (
    apply_nltha_selection,
    apply_result_set_target,
    ensure_job_config_object,
    extract_prescan_snapshot,
)


@dataclass
class ImportStartError(Exception):
    detail: str
    status_code: int = 400


def _require_pending_status(job: ImportJob) -> None:
    """Ensure import start is only allowed while job is pending."""
    if job.status != "pending":
        raise ImportStartError(f"Cannot start job in status: {job.status}")


def _dispatch_started_task(
    *,
    job: ImportJob,
    task: Any,
    task_started_message: str,
) -> dict[str, Any]:
    """Persist config changes and enqueue the import task."""
    job.save(update_fields=["job_config"])
    task_id = dispatch_job_task(job, task)
    return build_task_started_payload(
        detail=task_started_message,
        task_id=task_id,
        job_id=job.id,
    )


def _get_mutable_job_config(job: ImportJob) -> dict[str, Any]:
    """Return mutable validated job config or raise API error."""
    try:
        return ensure_job_config_object(job.job_config)
    except ValueError as exc:
        raise ImportStartError(str(exc), status_code=500) from exc


def _configure_result_set_target(
    *,
    job: ImportJob,
    config: dict[str, Any],
    project: Project,
    result_set_name: str,
    result_set_id: Optional[int],
    expected_analysis_type: Optional[str],
    invalid_message: str,
) -> None:
    """Apply result-set naming and ownership/type validation to job config."""
    normalized_result_set_id = set_selected_result_set(
        job=job,
        project=project,
        result_set_id=result_set_id,
        expected_analysis_type=expected_analysis_type,
        invalid_message=invalid_message,
    )
    try:
        apply_result_set_target(
            config,
            result_set_name=result_set_name,
            result_set_id=normalized_result_set_id,
        )
    except ValueError as exc:
        raise ImportStartError(str(exc), status_code=400) from exc


def set_selected_result_set(
    *,
    job: ImportJob,
    project: Project,
    result_set_id: Optional[int],
    expected_analysis_type: Optional[str],
    invalid_message: str,
) -> Optional[int]:
    """Set job-config result_set_id after ownership/type validation."""
    if result_set_id is None:
        return None

    result_set = ResultSet.objects.filter(project=project, id=result_set_id).first()
    if result_set is None:
        raise ImportStartError(invalid_message)
    if expected_analysis_type and result_set.analysis_type != expected_analysis_type:
        raise ImportStartError(invalid_message)

    return result_set.id


def start_pushover_import_job(
    *,
    job: ImportJob,
    project: Project,
    request_data: Any,
    task: Any,
    task_started_message: str,
) -> dict[str, Any]:
    """Validate and dispatch pushover import start flow for one job."""
    _require_pending_status(job)

    serializer = PushoverImportStartSerializer(data=request_data)
    serializer.is_valid(raise_exception=True)
    config = _get_mutable_job_config(job)

    _configure_result_set_target(
        job=job,
        config=config,
        project=project,
        result_set_name=serializer.validated_data.get("result_set_name", "Pushover Results"),
        result_set_id=serializer.validated_data.get("result_set_id"),
        expected_analysis_type="Pushover",
        invalid_message=(
            "result_set_id must belong to this project "
            "and have analysis_type='Pushover'"
        ),
    )
    return _dispatch_started_task(
        job=job,
        task=task,
        task_started_message=task_started_message,
    )


def start_nltha_import_job(
    *,
    job: ImportJob,
    project: Project,
    request_data: Any,
    task: Any,
    task_started_message: str,
) -> dict[str, Any]:
    """Validate and dispatch NLTHA import start flow for one job."""
    _require_pending_status(job)

    config = _get_mutable_job_config(job)
    try:
        prescan = extract_prescan_snapshot(config)
    except ValueError as exc:
        raise ImportStartError(str(exc), status_code=500) from exc
    if prescan is None:
        raise ImportStartError("Must complete prescan before starting import")

    serializer = ImportStartSerializer(data=request_data)
    serializer.is_valid(raise_exception=True)

    conflict_resolution = build_conflict_resolution_map(
        serializer.validated_data.get("conflict_resolutions", []),
    )
    try:
        apply_nltha_selection(
            config,
            selected_load_cases=serializer.validated_data.get("selected_load_cases", []),
            conflict_resolution=conflict_resolution,
        )
    except ValueError as exc:
        raise ImportStartError(str(exc), status_code=400) from exc

    selected_result_set_id = serializer.validated_data.get("result_set_id")
    _configure_result_set_target(
        job=job,
        config=config,
        project=project,
        result_set_name=serializer.validated_data.get("result_set_name", "Imported Results"),
        result_set_id=selected_result_set_id,
        expected_analysis_type=None,
        invalid_message=f"Invalid result_set_id for project: {selected_result_set_id}",
    )
    return _dispatch_started_task(
        job=job,
        task=task,
        task_started_message=task_started_message,
    )
