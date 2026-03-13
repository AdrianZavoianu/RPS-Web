"""Shared logging helpers for consistent correlation context fields."""

from __future__ import annotations

from typing import Optional


def build_correlation_context(
    *,
    project_id: int,
    project_slug: str,
    job_type: str,
    job_id: int | str | None,
    result_set_id: int | str | None = None,
    task_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> str:
    """Return stable key=value context tokens for cross-job log correlation."""
    normalized_job_type = str(job_type).strip()
    if not normalized_job_type:
        raise ValueError("job_type is required for correlation logging")

    context_tokens = [
        f"project_id={project_id}",
        f"project_slug={project_slug}",
        f"job_type={normalized_job_type}",
        f"job_id={job_id if job_id is not None else 'n/a'}",
        f"result_set_id={result_set_id if result_set_id is not None else 'n/a'}",
    ]
    if task_id:
        context_tokens.append(f"task_id={task_id}")
    if correlation_id:
        context_tokens.append(f"correlation_id={correlation_id}")
    return " ".join(context_tokens)
