"""Views for reporting app - PDF report generation."""

import logging

from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.mixins import ProjectLookupMixin
from core.logging import build_correlation_context
from apps.results.models import ResultSet
from apps.results.services.availability_service import get_available_report_sections

from .services import PDFReportService

REPORT_GLOBAL_TYPES = ("Drifts", "Accelerations", "Forces", "Displacements")
logger = logging.getLogger(__name__)


class ProjectReportsMixin(ProjectLookupMixin):
    """Mixin to get project from slug in URL."""

    def get_project(self):
        slug = self.kwargs.get("project_slug")
        return self.get_project_for_slug(
            slug,
            create_if_missing=False,
            user=self.request.user,
        )


class GenerateReportView(ProjectReportsMixin, APIView):
    """
    Generate a PDF report for the project.

    POST /api/projects/{project_slug}/reports/generate/
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, project_slug):
        project = self.get_project()

        result_set_id = request.data.get("result_set_id")
        sections = request.data.get("sections", [])
        project_name = request.data.get("project_name")

        if not result_set_id:
            return Response(
                {"detail": "result_set_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        if not sections:
            return Response(
                {"detail": "At least one section is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Validate result set belongs to project
        try:
            result_set = ResultSet.objects.get(id=result_set_id, project=project)
        except ResultSet.DoesNotExist:
            return Response({"detail": "Result set not found"}, status=status.HTTP_404_NOT_FOUND)

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
                ),
            )
            return Response(
                {"detail": "Failed to generate report"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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

        result_set_id = request.data.get("result_set_id")
        sections = request.data.get("sections", [])
        project_name = request.data.get("project_name")

        if not result_set_id:
            return Response(
                {"detail": "result_set_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not sections:
            return Response(
                {"detail": "At least one section is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result_set = ResultSet.objects.get(id=result_set_id, project=project)
        except ResultSet.DoesNotExist:
            return Response(
                {"detail": "Result set not found"},
                status=status.HTTP_404_NOT_FOUND,
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
                ),
            )
            return Response(
                {"detail": "Failed to build section data"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "project_name": project_name
                or project.catalog_project.name,
                "result_set_name": result_set.name,
                "sections": section_data,
            }
        )


class ReportPreviewView(ProjectReportsMixin, APIView):
    """
    Preview available report sections for a result set.

    GET /api/projects/{project_slug}/reports/preview/?result_set_id=1
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        project = self.get_project()
        result_set_id = request.query_params.get("result_set_id")

        if not result_set_id:
            return Response(
                {"detail": "result_set_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Validate result set belongs to project
        try:
            result_set = ResultSet.objects.get(id=result_set_id, project=project)
        except ResultSet.DoesNotExist:
            return Response({"detail": "Result set not found"}, status=status.HTTP_404_NOT_FOUND)

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
