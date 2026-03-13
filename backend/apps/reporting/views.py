"""Views for reporting app - PDF report generation."""

import logging

from celery.result import AsyncResult
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.serializers import Serializer
from rest_framework.views import APIView

from apps.exporter.models import ExportJob
from apps.results.models import ResultSet
from apps.results.services.availability_service import get_available_report_sections
from core.errors import api_error_response, get_request_correlation_id
from core.logging import build_correlation_context
from core.mixins import ProjectLookupMixin

from .progress_events import send_error as send_report_error
from .serializers import (
    ReportJobRequestSerializer,
    ReportJobSerializer,
    ReportPreviewQuerySerializer,
    ReportRequestSerializer,
)
from .services import PDFReportService
from .tasks import process_report_job

REPORT_GLOBAL_TYPES = ("Drifts", "Accelerations", "Forces", "Displacements")
REPORT_JOB_TOTAL_STEPS = 3
logger = logging.getLogger(__name__)


class ProjectReportsMixin(ProjectLookupMixin):
    """Mixin to get project from slug in URL and run serializer validation."""

    def get_project(self):
        project_slug = self.kwargs.get("project_slug")
        return self.get_project_for_slug(
            project_slug,
            create_if_missing=False,
            user=self.request.user,
        )

    def validate_payload(self, serializer_class: type[Serializer], data, *, project):
        serializer = serializer_class(
            data=data,
            context={
                "project": project,
                "request": self.request,
                "view": self,
            },
        )
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    @staticmethod
    def get_report_job(*, project, job_id: int) -> ExportJob:
        return get_object_or_404(
            ExportJob,
            id=job_id,
            project=project,
            export_format="pdf",
        )


class GenerateReportView(ProjectReportsMixin, APIView):
    """
    Generate a PDF report for the project.

    POST /api/projects/{project_slug}/reports/generate/
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, project_slug):
        project = self.get_project()
        params = self.validate_payload(ReportRequestSerializer, request.data, project=project)

        result_set_id = params["result_set_id"]
        sections = params["sections"]
        project_name = params.get("project_name")

        # Keep an explicit scoped lookup for response payload metadata and race-safe validation.
        try:
            result_set = ResultSet.objects.get(id=result_set_id, project=project)
        except ResultSet.DoesNotExist:
            return api_error_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                code="not_found",
                message="Result set not found",
            )

        # Generate PDF
        try:
            service = PDFReportService(project)
            pdf_bytes = service.generate_report(
                result_set_id=result_set_id,
                sections=sections,
                project_name=project_name,
            )
        except Exception:
            logger.exception(
                "Report generation failed (%s)",
                build_correlation_context(
                    project_id=project.id,
                    project_slug=project.slug,
                    job_type="report",
                    job_id="view-generate",
                    result_set_id=result_set_id,
                    correlation_id=get_request_correlation_id(request),
                ),
            )
            return api_error_response(
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code="report_generation_failed",
                message="Failed to generate report",
            )

        # Return PDF as downloadable file
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        filename = f"{project_name or project.catalog_project.name}_{result_set.name}_report.pdf"
        filename = filename.replace(" ", "_")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class ReportSectionDataView(ProjectReportsMixin, APIView):
    """
    Return structured section data for live preview rendering.

    POST /api/projects/{project_slug}/reports/sections/
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, project_slug):
        project = self.get_project()
        params = self.validate_payload(ReportRequestSerializer, request.data, project=project)

        result_set_id = params["result_set_id"]
        sections = params["sections"]
        project_name = params.get("project_name")

        try:
            result_set = ResultSet.objects.get(id=result_set_id, project=project)
        except ResultSet.DoesNotExist:
            return api_error_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                code="not_found",
                message="Result set not found",
            )

        try:
            service = PDFReportService(project)
            section_data = service.get_sections_data(
                result_set_id=result_set_id,
                sections=sections,
            )
        except Exception:
            logger.exception(
                "Section-data build failed (%s)",
                build_correlation_context(
                    project_id=project.id,
                    project_slug=project.slug,
                    job_type="report",
                    job_id="view-sections",
                    result_set_id=result_set_id,
                    correlation_id=get_request_correlation_id(request),
                ),
            )
            return api_error_response(
                request=request,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code="report_section_data_failed",
                message="Failed to build section data",
            )

        return Response(
            {
                "project_name": project_name or project.catalog_project.name,
                "result_set_name": result_set.name,
                "sections": section_data,
            }
        )


class ReportJobListView(ProjectReportsMixin, APIView):
    """List and create asynchronous report jobs."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        project = self.get_project()
        jobs = (
            ExportJob.objects.filter(project=project, export_format="pdf")
            .order_by("-created_at")[:20]
        )
        serializer = ReportJobSerializer(jobs, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request, project_slug):
        project = self.get_project()
        params = self.validate_payload(ReportJobRequestSerializer, request.data, project=project)

        job = ExportJob.objects.create(
            project=project,
            user=request.user,
            export_format="pdf",
            status="pending",
            export_config={
                "result_set_id": params["result_set_id"],
                "sections": params["sections"],
                "project_name": params.get("project_name"),
                "progress_current": 0,
                "progress_total": REPORT_JOB_TOTAL_STEPS,
            },
        )

        task = process_report_job.delay(job.id)
        job.celery_task_id = task.id
        job.save(update_fields=["celery_task_id"])

        serializer = ReportJobSerializer(job, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReportJobDetailView(ProjectReportsMixin, APIView):
    """Get report job status or cancel a queued/in-progress report job."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug, job_id: int):
        project = self.get_project()
        job = self.get_report_job(project=project, job_id=job_id)
        serializer = ReportJobSerializer(job, context={"request": request})
        return Response(serializer.data)

    def delete(self, request, project_slug, job_id: int):
        project = self.get_project()
        job = self.get_report_job(project=project, job_id=job_id)

        if job.status in {"pending", "processing"}:
            if job.celery_task_id:
                AsyncResult(job.celery_task_id).revoke(terminate=True)
            job.status = "failed"
            job.error_message = "Cancelled by user"
            job.save(update_fields=["status", "error_message"])
            send_report_error(job.id, "Report cancelled", "Cancelled by user")

        return Response(status=status.HTTP_204_NO_CONTENT)


class ReportDownloadView(ProjectReportsMixin, APIView):
    """Download completed asynchronous report output."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug, job_id: int):
        project = self.get_project()
        job = self.get_report_job(project=project, job_id=job_id)
        if job.status != "completed" or not job.output_file:
            raise Http404("Report file not available")

        return FileResponse(
            job.output_file.open("rb"),
            as_attachment=True,
            filename=job.file_name or f"report_{job.id}.pdf",
        )


class ReportPreviewView(ProjectReportsMixin, APIView):
    """
    Preview available report sections for a result set.

    GET /api/projects/{project_slug}/reports/preview/?result_set_id=1
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        project = self.get_project()
        params = self.validate_payload(
            ReportPreviewQuerySerializer,
            request.query_params,
            project=project,
        )
        result_set_id = params["result_set_id"]

        # Keep an explicit scoped lookup for response payload metadata and race-safe validation.
        try:
            result_set = ResultSet.objects.get(id=result_set_id, project=project)
        except ResultSet.DoesNotExist:
            return api_error_response(
                request=request,
                status_code=status.HTTP_404_NOT_FOUND,
                code="not_found",
                message="Result set not found",
            )

        available_sections = get_available_report_sections(
            project=project,
            result_set=result_set,
            global_types=REPORT_GLOBAL_TYPES,
        )

        return Response(
            {
                "result_set": {
                    "id": result_set.id,
                    "name": result_set.name,
                    "analysis_type": result_set.analysis_type,
                },
                "available_sections": available_sections,
            }
        )
