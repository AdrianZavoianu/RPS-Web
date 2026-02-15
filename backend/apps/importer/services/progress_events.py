"""WebSocket progress event helpers for import jobs."""

from typing import Optional

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def send_progress(job_id: int, phase: str, message: str, current: int, total: int):
    """Send progress update via WebSocket."""
    channel_layer = get_channel_layer()
    group_name = f"import_{job_id}"
    percent = int((current / total) * 100) if total > 0 else 0

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "import_progress",
            "phase": phase,
            "message": message,
            "current": current,
            "total": total,
            "percent": percent,
        },
    )


def send_complete(job_id: int, status: str, message: str, result_set_id: Optional[int] = None):
    """Send completion notification via WebSocket."""
    channel_layer = get_channel_layer()
    group_name = f"import_{job_id}"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "import_complete",
            "status": status,
            "message": message,
            "result_set_id": result_set_id,
        },
    )


def send_error(job_id: int, message: str, details: str = ""):
    """Send error notification via WebSocket."""
    channel_layer = get_channel_layer()
    group_name = f"import_{job_id}"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "import_error",
            "message": message,
            "details": details,
        },
    )
