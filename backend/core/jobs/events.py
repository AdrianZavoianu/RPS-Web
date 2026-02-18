"""Shared websocket event helpers for import/export/reporting jobs."""

from __future__ import annotations

from typing import Any, Dict

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def build_job_group_name(job_type: str, job_id: int) -> str:
    """Build a deterministic websocket group name for a job."""
    return f"{job_type}_{job_id}"


def calculate_percent(current: int, total: int) -> int:
    """Calculate progress percentage defensively."""
    if total <= 0:
        return 0
    return int((current / total) * 100)


def send_job_group_event(*, group_name: str, event_type: str, payload: Dict[str, Any]) -> None:
    """Send a websocket event to a channels group."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": event_type,
            **payload,
        },
    )
