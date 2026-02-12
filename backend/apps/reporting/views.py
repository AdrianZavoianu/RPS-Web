"""Views for reporting app - PDF report generation."""

from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.mixins import ProjectLookupMixin
from apps.results.models import ResultSet

from .services import PDFReportService


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
    {
        "result_set_id": 1,
        "sections": [
            {"result_type": "Drifts", "direction": "X", "include_table": true, "include_chart": true},
            {"result_type": "Drifts", "direction": "Y", "include_table": true, "include_chart": true},
            ...
        ],
        "project_name": "Optional Project Name Override"
    }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, project_slug):
        project = self.get_project()

        result_set_id = request.data.get("result_set_id")
        sections = request.data.get("sections", [])
        project_name = request.data.get("project_name")

        if not result_set_id:
            return Response(
                {"error": "result_set_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        if not sections:
            return Response(
                {"error": "At least one section is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Validate result set belongs to project
        try:
            result_set = ResultSet.objects.get(id=result_set_id, project=project)
        except ResultSet.DoesNotExist:
            return Response({"error": "Result set not found"}, status=status.HTTP_404_NOT_FOUND)

        # Generate PDF
        try:
            service = PDFReportService(project)
            pdf_bytes = service.generate_report(
                result_set_id=result_set_id,
                sections=sections,
                project_name=project_name,
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to generate report: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Return PDF as downloadable file
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        filename = f"{project_name or project.catalog_project.name}_{result_set.name}_report.pdf"
        filename = filename.replace(" ", "_")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


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
                {"error": "result_set_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Validate result set belongs to project
        try:
            result_set = ResultSet.objects.get(id=result_set_id, project=project)
        except ResultSet.DoesNotExist:
            return Response({"error": "Result set not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get available result types from categories
        available_sections = []

        # Global result types
        global_types = [
            ("Drifts", ["X", "Y"]),
            ("Accelerations", ["X", "Y"]),
            ("Forces", ["VX", "VY"]),
            ("Displacements", ["UX", "UY"]),
        ]

        for result_type, directions in global_types:
            for direction in directions:
                available_sections.append(
                    {
                        "result_type": result_type,
                        "direction": direction,
                        "category": "Global",
                        "label": f"{result_type} {direction}",
                    }
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
