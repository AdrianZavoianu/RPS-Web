"""Celery tasks for import processing."""

import logging
from pathlib import Path
from typing import Dict

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

logger = logging.getLogger(__name__)


def _normalized_import_errors(stats: Dict) -> list[str]:
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
    stats: Dict,
    success_message: str,
    warning_prefix: str,
) -> tuple[str, str]:
    """Persist completed job state and return websocket completion payload."""
    import_errors = _normalized_import_errors(stats)
    warning_count = len(import_errors)
    first_error = import_errors[0] if warning_count else ""

    stats["errors"] = import_errors
    stats["has_warnings"] = warning_count > 0
    stats["warning_count"] = warning_count

    job.status = "completed"
    job.current_phase = "Completed with warnings" if warning_count else "Completed"
    job.import_summary = stats
    job.completed_at = timezone.now()
    job.save()

    if warning_count:
        return (
            "warning",
            f"{warning_prefix} completed with {warning_count} file error(s). "
            f"First error: {first_error}",
        )

    return ("success", success_message)


@shared_task(bind=True, max_retries=0)
def prescan_files_task(self, job_id: int) -> Dict:
    """Prescan uploaded files to discover load cases and conflicts.

    Returns:
        Dict with prescan results for UI display
    """
    job = ImportJob.objects.get(id=job_id)
    job.status = "scanning"
    job.current_phase = "Scanning files"
    job.celery_task_id = self.request.id
    job.started_at = timezone.now()
    job.save()

    try:
        files = [Path(f) for f in job.files]
        service = ImportPreparationService()

        # Throttle DB saves - only save on file boundaries, not every progress message
        last_saved_current = [0]

        def progress_callback(msg, current, total):
            # Always send WebSocket progress
            send_progress(job_id, "scanning", msg, current, total)
            # Only save to DB when current file changes (not on every message)
            if current != last_saved_current[0]:
                last_saved_current[0] = current
                job.progress_current = current
                job.progress_total = total
                job.save(update_fields=["progress_current", "progress_total"])

        result = service.prescan_files(files, progress_callback=progress_callback)

        # Store prescan result in job config
        job.job_config["prescan"] = {
            "file_load_cases": result.file_load_cases,
            "foundation_joints": result.foundation_joints,
            "files_scanned": result.files_scanned,
            "errors": result.errors,
        }
        job.status = "pending"  # Ready for user to select load cases
        job.current_phase = "Awaiting selection"
        job.save()

        return {
            "file_load_cases": result.file_load_cases,
            "foundation_joints": result.foundation_joints,
            "files_scanned": result.files_scanned,
            "errors": result.errors,
        }

    except Exception as e:
        logger.exception(f"Prescan failed for job {job_id}")
        job.status = "failed"
        job.error_message = str(e)
        job.save()
        send_error(job_id, "Prescan failed", str(e))
        raise


@shared_task(bind=True, max_retries=0)
def process_import_task(self, job_id: int) -> Dict:
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
    job.status = "processing"
    job.current_phase = "Processing files"
    job.celery_task_id = self.request.id
    job.started_at = timezone.now()
    job.save()

    try:
        config = job.job_config
        files = [Path(f) for f in job.files]
        selected_load_cases = set(config.get("selected_load_cases", []))
        conflict_resolution = config.get("conflict_resolution", {})
        result_set_name = config.get("result_set_name", "Imported Results")
        result_set_id = config.get("result_set_id")
        prescan = config.get("prescan", {})
        file_load_cases = prescan.get("file_load_cases", {})
        foundation_joints = prescan.get("foundation_joints", [])

        # If no load cases selected, import all
        if not selected_load_cases:
            for sheets in file_load_cases.values():
                for load_cases in sheets.values():
                    selected_load_cases.update(load_cases)

        # Throttle DB saves - only save on file boundaries, not every progress message
        last_saved_current = [0]

        def progress_callback(msg, current, total):
            send_progress(job_id, "importing", msg, current, total)
            if current != last_saved_current[0]:
                last_saved_current[0] = current
                job.progress_current = current
                job.progress_total = total
                job.save(update_fields=["progress_current", "progress_total"])

        # Run the import
        stats = run_nltha_import(
            job=job,
            files=files,
            file_load_cases=file_load_cases,
            selected_load_cases=selected_load_cases,
            conflict_resolution=conflict_resolution,
            result_set_name=result_set_name,
            result_set_id=result_set_id,
            foundation_joints=foundation_joints,
            progress_callback=progress_callback,
        )

        # Build cache tables
        job.status = "building_cache"
        job.current_phase = "Building cache"
        job.save()

        result_set = job.result_set
        if result_set:

            def cache_progress(msg, current, total):
                send_progress(job_id, "caching", msg, current, total)

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

        completion_status, completion_message = _finalize_import_job(
            job=job,
            stats=stats,
            success_message=(
                f"Import completed: {stats.get('files_processed', 0)} files, "
                f"{stats.get('load_cases_imported', 0)} load cases"
            ),
            warning_prefix="Import",
        )

        send_complete(
            job_id,
            completion_status,
            completion_message,
            stats.get("result_set_id"),
        )

        return stats

    except Exception as e:
        logger.exception(f"Import failed for job {job_id}")
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = timezone.now()
        job.save()
        send_error(job_id, "Import failed", str(e))
        raise


# --- Pushover Import ---


@shared_task(bind=True, max_retries=0)
def import_pushover_curves_task(self, job_id: int) -> Dict:
    """Import pushover curve data from uploaded files.

    Creates PushoverCase and PushoverCurvePoint records.

    Returns:
        Dict with import statistics
    """
    job = ImportJob.objects.get(id=job_id)
    job.status = "processing"
    job.current_phase = "Importing pushover curves"
    job.celery_task_id = self.request.id
    job.started_at = timezone.now()
    job.save()

    try:
        config = job.job_config
        files = [Path(f) for f in job.files]
        result_set_name = config.get("result_set_name", "Pushover Results")
        result_set_id = config.get("result_set_id")

        # Throttle DB saves - only save on file boundaries, not every progress message
        last_saved_current = [0]

        def progress_callback(msg, current, total):
            send_progress(job_id, "importing", msg, current, total)
            if current != last_saved_current[0]:
                last_saved_current[0] = current
                job.progress_current = current
                job.progress_total = total
                job.save(update_fields=["progress_current", "progress_total"])

        stats = run_pushover_import(
            job=job,
            files=files,
            result_set_name=result_set_name,
            result_set_id=result_set_id,
            progress_callback=progress_callback,
        )

        completion_status, completion_message = _finalize_import_job(
            job=job,
            stats=stats,
            success_message=(
                f"Pushover import completed: {stats['pushover_cases_imported']} cases, "
                f"{stats['curve_points_imported']} points"
            ),
            warning_prefix="Pushover import",
        )

        send_complete(
            job_id,
            completion_status,
            completion_message,
            stats.get("result_set_id"),
        )

        return stats

    except Exception as e:
        logger.exception(f"Pushover import failed for job {job_id}")
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = timezone.now()
        job.save()
        send_error(job_id, "Pushover import failed", str(e))
        raise


@shared_task(bind=True, max_retries=0)
def import_pushover_results_task(self, job_id: int) -> Dict:
    """Import pushover global results (drifts, forces, displacements) into cache.

    Returns:
        Dict with import statistics
    """
    job = ImportJob.objects.get(id=job_id)
    job.status = "processing"
    job.current_phase = "Importing pushover results"
    job.celery_task_id = self.request.id
    job.started_at = timezone.now()
    job.save()

    try:
        config = job.job_config
        files = [Path(f) for f in job.files]
        result_set_name = config.get("result_set_name", "Pushover Results")
        result_set_id = config.get("result_set_id")

        last_saved_current = [0]

        def progress_callback(msg, current, total):
            send_progress(job_id, "importing", msg, current, total)
            if current != last_saved_current[0]:
                last_saved_current[0] = current
                job.progress_current = current
                job.progress_total = total
                job.save(update_fields=["progress_current", "progress_total"])

        stats = run_pushover_results_import(
            job=job,
            files=files,
            result_set_name=result_set_name,
            result_set_id=result_set_id,
            progress_callback=progress_callback,
        )

        completion_status, completion_message = _finalize_import_job(
            job=job,
            stats=stats,
            success_message=(
                f"Pushover results import completed: {stats['cache_rows_written']} cache rows, "
                f"{len(stats['directions_imported'])} direction(s)"
            ),
            warning_prefix="Pushover results import",
        )

        send_complete(
            job_id,
            completion_status,
            completion_message,
            stats.get("result_set_id"),
        )

        return stats

    except Exception as e:
        logger.exception(f"Pushover results import failed for job {job_id}")
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = timezone.now()
        job.save()
        send_error(job_id, "Pushover results import failed", str(e))
        raise
