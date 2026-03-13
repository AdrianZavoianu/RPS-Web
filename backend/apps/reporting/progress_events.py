"""WebSocket progress event helpers for report jobs."""

from typing import Optional

from core.jobs import build_job_group_name, calculate_percent, send_job_group_event


def send_progress(job_id: int, message: str, current: int, total: int) -> None:
    """Send report progress update via WebSocket."""
    send_job_group_event(
        group_name=build_job_group_name("report", job_id),
        event_type="report_progress",
        payload={
            "message": message,
            "current": current,
            "total": total,
            "percent": calculate_percent(current, total),
        },
    )


def send_complete(job_id: int, status: str, message: str) -> None:
    """Send report completion event via WebSocket."""
    send_job_group_event(
        group_name=build_job_group_name("report", job_id),
        event_type="report_complete",
        payload={
            "status": status,
            "message": message,
        },
    )


def send_error(job_id: int, message: str, details: Optional[str] = None) -> None:
    """Send report failure event via WebSocket."""
    send_job_group_event(
        group_name=build_job_group_name("report", job_id),
        event_type="report_error",
        payload={
            "message": message,
            "details": details or "",
        },
    )
