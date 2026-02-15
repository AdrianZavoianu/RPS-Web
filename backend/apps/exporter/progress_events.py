"""WebSocket progress event helpers for export jobs."""

from typing import Optional

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def send_progress(job_id: int, message: str, current: int, total: int):
    """Send export progress update via WebSocket."""
    channel_layer = get_channel_layer()
    group_name = f"export_{job_id}"
    percent = int((current / total) * 100) if total > 0 else 0

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "export_progress",
            "message": message,
            "current": current,
            "total": total,
            "percent": percent,
        },
    )


def send_complete(job_id: int, status: str, message: str):
    """Send export completion notification via WebSocket."""
    channel_layer = get_channel_layer()
    group_name = f"export_{job_id}"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "export_complete",
            "status": status,
            "message": message,
        },
    )


def send_error(job_id: int, message: str, details: Optional[str] = None):
    """Send export error notification via WebSocket."""
    channel_layer = get_channel_layer()
    group_name = f"export_{job_id}"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "export_error",
            "message": message,
            "details": details or "",
        },
    )
