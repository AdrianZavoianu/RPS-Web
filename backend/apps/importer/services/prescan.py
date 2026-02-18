"""Prescan-flow helpers for importer endpoints."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from apps.importer.models import ImportJob

from .job_dispatch import (
    build_prescan_payload,
    build_task_started_payload,
    dispatch_job_task,
)
from .job_config_contracts import extract_prescan_snapshot


@dataclass
class ImportPrescanError(Exception):
    detail: str
    status_code: int = 400


def start_prescan_job(
    *,
    job: ImportJob,
    task: Any,
    task_started_message: str,
) -> dict[str, Any]:
    """Validate and dispatch prescan task for one import job."""
    if job.status != "pending":
        raise ImportPrescanError(f"Cannot prescan job in status: {job.status}")
    task_id = dispatch_job_task(job, task)
    return build_task_started_payload(
        detail=task_started_message,
        task_id=task_id,
        job_id=job.id,
    )


def get_prescan_payload_for_job(job: ImportJob) -> dict[str, Any]:
    """Return API-ready prescan payload for one job or raise on missing data."""
    try:
        prescan_snapshot = extract_prescan_snapshot(job.job_config)
    except ValueError as exc:
        raise ImportPrescanError(str(exc), status_code=500) from exc
    if prescan_snapshot is None:
        raise ImportPrescanError(
            "Prescan not yet complete",
            status_code=404,
        )
    return build_prescan_payload(job, prescan_snapshot)
