"""Celery tasks for asynchronous report generation."""

from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.core.files.base import ContentFile
from django.utils import timezone

from apps.exporter.models import ExportJob
from apps.results.models import ResultSet
from core.logging import build_correlation_context

from .job_contracts import parse_report_job_config
from .progress_events import (
    send_complete as send_report_complete,
    send_error as send_report_error,
    send_progress as send_report_progress,
)
from .services import PDFReportService

logger = logging.getLogger(__name__)


def _report_log_context(
    job: ExportJob,
    *,
    result_set_id: int | None = None,
    task_id: str | None = None,
) -> str:
    return build_correlation_context(
        project_id=job.project_id,
        project_slug=job.project.slug,
        job_type="report",
        job_id=job.id,
        result_set_id=result_set_id,
        task_id=task_id,
    )


def _persist_job_progress(
    *,
    job: ExportJob,
    config: dict[str, object],
    current: int,
    total: int,
) -> None:
    config["progress_current"] = current
    config["progress_total"] = total
    job.export_config = config
    job.save(update_fields=["export_config"])


def _mark_failed(job: ExportJob, *, public_message: str, details: str) -> None:
    job.status = "failed"
    job.error_message = details
    job.completed_at = timezone.now()
    job.save(update_fields=["status", "error_message", "completed_at"])
    send_report_error(job.id, public_message, details)


@shared_task(bind=True)
def process_report_job(self, job_id: int) -> None:
    """Generate a PDF report file for one queued report job."""
    try:
        job = ExportJob.objects.get(id=job_id, export_format="pdf")
    except ExportJob.DoesNotExist:
        logger.error("Report job %s not found", job_id)
        return

    try:
        config = parse_report_job_config(job.export_config)
    except ValueError as exc:
        logger.exception("Invalid report config (%s)", _report_log_context(job))
        _mark_failed(
            job,
            public_message="Report failed",
            details=str(exc),
        )
        return

    try:
        job.status = "processing"
        job.error_message = ""
        job.celery_task_id = self.request.id or job.celery_task_id
        job.save(update_fields=["status", "error_message", "celery_task_id"])
        total_steps = config["progress_total"]

        _persist_job_progress(
            job=job,
            config=dict(config),
            current=0,
            total=total_steps,
        )
        send_report_progress(job.id, "Preparing report...", 0, total_steps)

        result_set = ResultSet.objects.get(
            id=config["result_set_id"],
            project=job.project,
        )
        _persist_job_progress(
            job=job,
            config=dict(job.export_config),
            current=1,
            total=total_steps,
        )
        send_report_progress(job.id, "Collecting report data...", 1, total_steps)

        service = PDFReportService(job.project)
        pdf_bytes = service.generate_report(
            result_set_id=result_set.id,
            sections=config["sections"],
            project_name=config["project_name"] or None,
        )
        _persist_job_progress(
            job=job,
            config=dict(job.export_config),
            current=2,
            total=total_steps,
        )
        send_report_progress(job.id, "Finalizing PDF file...", 2, total_steps)

        filename = (
            f"{job.project.slug}_{result_set.name}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        )
        job.output_file.save(filename, ContentFile(pdf_bytes))
        job.file_name = filename
        job.file_size = len(pdf_bytes)
        job.status = "completed"
        job.completed_at = timezone.now()
        job.expires_at = timezone.now() + timedelta(hours=24)

        completion_config = dict(job.export_config or {})
        completion_config["progress_current"] = total_steps
        completion_config["progress_total"] = total_steps
        job.export_config = completion_config
        job.save()

        send_report_progress(job.id, "Report generation complete", total_steps, total_steps)
        send_report_complete(job.id, "success", "Report completed")
        logger.info(
            "Report task completed (%s, file_name=%s, file_size=%s)",
            _report_log_context(job, result_set_id=result_set.id),
            job.file_name,
            job.file_size,
        )
    except ResultSet.DoesNotExist:
        logger.exception("Report task failed with missing result set (%s)", _report_log_context(job))
        _mark_failed(
            job,
            public_message="Report failed",
            details="Result set not found for this project",
        )
    except Exception as exc:
        logger.exception("Unexpected report task failure (%s)", _report_log_context(job))
        _mark_failed(
            job,
            public_message="Report failed",
            details=str(exc),
        )
        raise
