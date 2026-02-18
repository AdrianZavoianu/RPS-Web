"""WebSocket progress event helpers for import jobs."""

from typing import Optional

from core.jobs import build_job_group_name, calculate_percent, send_job_group_event


def send_progress(job_id: int, phase: str, message: str, current: int, total: int):
    """Send progress update via WebSocket."""
    send_job_group_event(
        group_name=build_job_group_name("import", job_id),
        event_type="import_progress",
        payload={
            "phase": phase,
            "message": message,
            "current": current,
            "total": total,
            "percent": calculate_percent(current, total),
        },
    )


def send_complete(job_id: int, status: str, message: str, result_set_id: Optional[int] = None):
    """Send completion notification via WebSocket."""
    send_job_group_event(
        group_name=build_job_group_name("import", job_id),
        event_type="import_complete",
        payload={
            "status": status,
            "message": message,
            "result_set_id": result_set_id,
        },
    )


def send_error(job_id: int, message: str, details: str = ""):
    """Send error notification via WebSocket."""
    send_job_group_event(
        group_name=build_job_group_name("import", job_id),
        event_type="import_error",
        payload={
            "message": message,
            "details": details,
        },
    )
