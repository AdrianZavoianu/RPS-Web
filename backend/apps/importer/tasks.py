"""Celery tasks for import processing."""

import logging
from pathlib import Path
from typing import Any, Callable

from celery import shared_task
from django.utils import timezone

from apps.importer.models import ImportJob
from apps.importer.services.import_preparation import (
    ImportPreparationService,
)
from apps.importer.services.cache_builder import CacheBuilderService
from apps.importer.services.nltha_import_runner import run_nltha_import
from apps.importer.services.progress_events import (
    send_complete,
    send_error,
    send_progress,
)
from apps.importer.services.pushover_import_runner import run_pushover_import
from apps.importer.services.pushover_results_import_runner import run_pushover_results_import
from apps.importer.services.import_contracts import (
    ImportCompletionPayload,
    ImportRunnerStats,
    NlthaImportStats,
    PushoverCurveImportStats,
    PushoverResultsImportStats,
)
from apps.importer.services.job_config_contracts import (
    ImportRunConfig,
    build_prescan_snapshot,
    ensure_job_config_object,
    parse_import_run_config,
    parse_nltha_import_run_config,
    serialize_prescan_snapshot,
)
from core.logging import build_correlation_context

logger = logging.getLogger(__name__)


def _import_log_context(
    job: ImportJob,
    *,
    job_id: int | None = None,
    result_set_id: int | None = None,
    task_id: str | None = None,
) -> str:
    """Build a consistent log context for import lifecycle events."""
    resolved_job_id = job_id if job_id is not None else job.id
    resolved_result_set_id = result_set_id if result_set_id is not None else job.result_set_id
    return build_correlation_context(
        project_id=job.project_id,
        project_slug=job.project.slug,
        job_type="import",
        job_id=resolved_job_id,
        result_set_id=resolved_result_set_id,
        task_id=task_id,
    )


def _normalized_import_errors(stats: ImportRunnerStats | dict[str, Any]) -> list[str]:
    """Validate and normalize per-file import errors from stats."""
    raw_errors = stats.get("errors", [])
    if not isinstance(raw_errors, list):
        raise ValueError("Import stats field 'errors' must be a list")

    normalized: list[str] = []
    for entry in raw_errors:
        if not isinstance(entry, str):
            raise ValueError("Import stats field 'errors' must contain string values")
        cleaned = entry.strip()
        if cleaned:
            normalized.append(cleaned)
    return normalized


def _finalize_import_job(
    *,
    job: ImportJob,
    stats: ImportRunnerStats,
    success_message: str,
    warning_prefix: str,
) -> ImportCompletionPayload:
    """Persist completed job state and return websocket completion payload."""
    import_errors = _normalized_import_errors(stats)
    warning_count = len(import_errors)
    first_error = import_errors[0] if warning_count else ""
    files_processed = stats.get("files_processed")
    processed_count = files_processed if isinstance(files_processed, int) else None

    stats["errors"] = import_errors
    stats["has_warnings"] = warning_count > 0
    stats["warning_count"] = warning_count

    # If no file completed successfully and we have import errors, mark whole job as failed.
    if warning_count > 0 and processed_count == 0:
        failure_message = (
            f"{warning_prefix} failed: no files were imported successfully. "
            f"First error: {first_error}"
        )
        job.status = "failed"
        job.current_phase = "Failed"
        job.error_message = failure_message
        job.import_summary = stats
        job.completed_at = timezone.now()
        job.save()
        return {
            "status": "failed",
            "message": failure_message,
        }

    job.status = "completed"
    job.current_phase = "Completed with warnings" if warning_count else "Completed"
    job.error_message = ""
    job.import_summary = stats
    job.completed_at = timezone.now()
    job.save()

    if warning_count:
        return {
            "status": "warning",
            "message": (
                f"{warning_prefix} completed with {warning_count} file error(s). "
                f"First error: {first_error}"
            ),
        }

    return {
        "status": "success",
        "message": success_message,
    }


def _handle_task_failure(
    *,
    job: ImportJob,
    job_id: int,
    public_message: str,
    exc: Exception,
    set_completed_at: bool = True,
) -> None:
    details = str(exc)
    logger.exception("%s (%s)", public_message, _import_log_context(job, job_id=job_id))
    job.status = "failed"
    job.error_message = details
    update_fields = ["status", "error_message"]
    if set_completed_at:
        job.completed_at = timezone.now()
        update_fields.append("completed_at")
    job.save(update_fields=update_fields)
    send_error(job_id, public_message, details)


def _finalize_and_send_completion(
    *,
    job: ImportJob,
    job_id: int,
    stats: ImportRunnerStats,
    success_message: str,
    warning_prefix: str,
) -> ImportCompletionPayload:
    """Finalize job status and emit websocket completion event."""
    completion = _finalize_import_job(
        job=job,
        stats=stats,
        success_message=success_message,
        warning_prefix=warning_prefix,
    )
    send_complete(
        job_id,
        completion["status"],
        completion["message"],
        stats.get("result_set_id"),
    )
    logger.info(
        "Import task completed (%s, completion_status=%s, warning_count=%s)",
        _import_log_context(
            job,
            job_id=job_id,
            result_set_id=stats.get("result_set_id"),
        ),
        completion["status"],
        stats.get("warning_count", 0),
    )
    return completion


def _initialize_job_execution(
    *,
    job: ImportJob,
    task_id: str | None,
    status: str,
    phase: str,
) -> None:
    """Set common task-start fields before processing."""
    job.status = status
    job.current_phase = phase
    job.celery_task_id = task_id
    job.started_at = timezone.now()
    job.save()
    logger.info(
        "Import task started (%s, task_id=%s, status=%s, phase=%s)",
        _import_log_context(job, task_id=task_id),
        task_id,
        status,
        phase,
    )


def _build_throttled_progress_callback(
    *,
    job: ImportJob,
    job_id: int,
    channel: str,
) -> Callable[[str, int, int], None]:
    """Send websocket progress and persist DB progress only on file-index changes."""
    progress_state = {"last_current": None}

    def progress_callback(message: str, current: int, total: int) -> None:
        send_progress(job_id, channel, message, current, total)
        if current == progress_state["last_current"]:
            return
        progress_state["last_current"] = current
        job.progress_current = current
        job.progress_total = total
        job.save(update_fields=["progress_current", "progress_total"])

    return progress_callback


def _extract_job_files(job: ImportJob) -> list[Path]:
    """Convert stored file paths from job payload into Path instances."""
    return [Path(file_path) for file_path in job.files]


def _build_import_caches(
    *,
    job: ImportJob,
    job_id: int,
    stats: NlthaImportStats,
) -> None:
    """Build cache tables for imported NLTHA results and merge cache stats."""
    job.status = "building_cache"
    job.current_phase = "Building cache"
    job.save()

    result_set = job.result_set
    if not result_set:
        logger.info(
            "Skipping cache build because result set is not assigned (%s)",
            _import_log_context(job, job_id=job_id),
        )
        return

    logger.info(
        "Starting cache build (%s)",
        _import_log_context(job, job_id=job_id, result_set_id=result_set.id),
    )

    def cache_progress(message: str, current: int, total: int) -> None:
        send_progress(job_id, "caching", message, current, total)

    cache_builder = CacheBuilderService(
        project=job.project,
        result_set=result_set,
        progress_callback=cache_progress,
        compute_aggregates=False,  # Disabled for import speed; aggregates computed on-demand
    )
    cache_stats = cache_builder.build_all_caches()

    # Build time-series cache if we have time-history data
    time_history_results = stats.pop("time_history_results", [])
    stories_map = stats.pop("stories_map", {})

    if time_history_results:
        cache_progress("Building time-series cache...", 1, 2)
        ts_rows = cache_builder.build_time_series_cache(time_history_results, stories_map)
        cache_stats["time_series_cache_rows"] = ts_rows
        cache_progress("Time-series cache complete", 2, 2)

    stats.update(cache_stats)
    logger.info(
        "Cache build completed (%s, global_rows=%s, element_rows=%s, joint_rows=%s, time_series_rows=%s)",
        _import_log_context(job, job_id=job_id, result_set_id=result_set.id),
        cache_stats.get("global_cache_rows", 0),
        cache_stats.get("element_cache_rows", 0),
        cache_stats.get("joint_cache_rows", 0),
        cache_stats.get("time_series_cache_rows", 0),
    )


@shared_task(bind=True, max_retries=0)
def prescan_files_task(self, job_id: int) -> dict[str, Any]:
    """Prescan uploaded files to discover load cases and conflicts.

    Returns:
        Dict with prescan results for UI display
    """
    job = ImportJob.objects.get(id=job_id)
    _initialize_job_execution(
        job=job,
        task_id=self.request.id,
        status="scanning",
        phase="Scanning files",
    )

    try:
        files = _extract_job_files(job)
        service = ImportPreparationService()
        progress_callback = _build_throttled_progress_callback(
            job=job,
            job_id=job_id,
            channel="scanning",
        )

        result = service.prescan_files(files, progress_callback=progress_callback)

        config = ensure_job_config_object(job.job_config)
        prescan_snapshot = build_prescan_snapshot(
            file_load_cases=result.file_load_cases,
            foundation_joints=result.foundation_joints,
            files_scanned=result.files_scanned,
            errors=result.errors,
        )
        config["prescan"] = serialize_prescan_snapshot(prescan_snapshot)
        job.job_config = config
        job.status = "pending"  # Ready for user to select load cases
        job.current_phase = "Awaiting selection"
        job.save()

        return {
            "file_load_cases": prescan_snapshot.file_load_cases,
            "foundation_joints": prescan_snapshot.foundation_joints,
            "files_scanned": prescan_snapshot.files_scanned,
            "errors": prescan_snapshot.errors,
        }

    except Exception as exc:
        _handle_task_failure(
            job=job,
            job_id=job_id,
            public_message="Prescan failed",
            exc=exc,
            set_completed_at=False,
        )
        raise


@shared_task(bind=True, max_retries=0)
def process_import_task(self, job_id: int) -> NlthaImportStats:
    """Process the import job after user has selected load cases.

    Expects job.job_config to contain:
        - selected_load_cases: List of load case names to import
        - conflict_resolution: Dict of {sheet: {load_case: chosen_file}}
        - result_set_name: Name for the new result set
        - prescan: The prescan results

    Returns:
        Dict with import statistics
    """
    job = ImportJob.objects.get(id=job_id)
    _initialize_job_execution(
        job=job,
        task_id=self.request.id,
        status="processing",
        phase="Processing files",
    )

    try:
        files = _extract_job_files(job)
        run_config = parse_nltha_import_run_config(
            job.job_config,
            default_result_set_name="Imported Results",
        )
        selected_load_cases = set(run_config.selected_load_cases)
        conflict_resolution = run_config.conflict_resolution
        file_load_cases = run_config.file_load_cases
        foundation_joints = run_config.foundation_joints

        # If no load cases selected, import all
        if not selected_load_cases:
            for sheets in file_load_cases.values():
                for load_cases in sheets.values():
                    selected_load_cases.update(load_cases)

        progress_callback = _build_throttled_progress_callback(
            job=job,
            job_id=job_id,
            channel="importing",
        )

        # Run the import
        stats = run_nltha_import(
            job=job,
            files=files,
            file_load_cases=file_load_cases,
            selected_load_cases=selected_load_cases,
            conflict_resolution=conflict_resolution,
            result_set_name=run_config.result_set_name,
            result_set_id=run_config.result_set_id,
            foundation_joints=foundation_joints,
            progress_callback=progress_callback,
        )

        _build_import_caches(
            job=job,
            job_id=job_id,
            stats=stats,
        )

        _finalize_and_send_completion(
            job=job,
            job_id=job_id,
            stats=stats,
            success_message=(
                f"Import completed: {stats.get('files_processed', 0)} files, "
                f"{stats.get('load_cases_imported', 0)} load cases"
            ),
            warning_prefix="Import",
        )

        return stats

    except Exception as exc:
        _handle_task_failure(
            job=job,
            job_id=job_id,
            public_message="Import failed",
            exc=exc,
        )
        raise


# --- Pushover Import ---


@shared_task(bind=True, max_retries=0)
def import_pushover_curves_task(self, job_id: int) -> PushoverCurveImportStats:
    """Import pushover curve data from uploaded files.

    Creates PushoverCase and PushoverCurvePoint records.

    Returns:
        Dict with import statistics
    """
    job = ImportJob.objects.get(id=job_id)
    _initialize_job_execution(
        job=job,
        task_id=self.request.id,
        status="processing",
        phase="Importing pushover curves",
    )

    try:
        files = _extract_job_files(job)
        run_config: ImportRunConfig = parse_import_run_config(
            job.job_config,
            default_result_set_name="Pushover Results",
        )

        progress_callback = _build_throttled_progress_callback(
            job=job,
            job_id=job_id,
            channel="importing",
        )

        stats = run_pushover_import(
            job=job,
            files=files,
            result_set_name=run_config.result_set_name,
            result_set_id=run_config.result_set_id,
            progress_callback=progress_callback,
        )

        _finalize_and_send_completion(
            job=job,
            job_id=job_id,
            stats=stats,
            success_message=(
                f"Pushover import completed: {stats['pushover_cases_imported']} cases, "
                f"{stats['curve_points_imported']} points"
            ),
            warning_prefix="Pushover import",
        )

        return stats

    except Exception as exc:
        _handle_task_failure(
            job=job,
            job_id=job_id,
            public_message="Pushover import failed",
            exc=exc,
        )
        raise


@shared_task(bind=True, max_retries=0)
def import_pushover_results_task(self, job_id: int) -> PushoverResultsImportStats:
    """Import pushover global results (drifts, forces, displacements) into cache.

    Returns:
        Dict with import statistics
    """
    job = ImportJob.objects.get(id=job_id)
    _initialize_job_execution(
        job=job,
        task_id=self.request.id,
        status="processing",
        phase="Importing pushover results",
    )

    try:
        files = _extract_job_files(job)
        run_config: ImportRunConfig = parse_import_run_config(
            job.job_config,
            default_result_set_name="Pushover Results",
        )

        progress_callback = _build_throttled_progress_callback(
            job=job,
            job_id=job_id,
            channel="importing",
        )

        stats = run_pushover_results_import(
            job=job,
            files=files,
            result_set_name=run_config.result_set_name,
            result_set_id=run_config.result_set_id,
            progress_callback=progress_callback,
        )

        _finalize_and_send_completion(
            job=job,
            job_id=job_id,
            stats=stats,
            success_message=(
                f"Pushover results import completed: {stats['cache_rows_written']} cache rows, "
                f"{len(stats['directions_imported'])} direction(s)"
            ),
            warning_prefix="Pushover results import",
        )

        return stats

    except Exception as exc:
        _handle_task_failure(
            job=job,
            job_id=job_id,
            public_message="Pushover results import failed",
            exc=exc,
        )
        raise
