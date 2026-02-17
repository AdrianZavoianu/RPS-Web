"""Views for reporting app - PDF report generation."""

from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.mixins import ProjectLookupMixin
from apps.results.models import ResultSet, ElementResultsCache, JointResultsCache
from apps.results.services import ResultDataService, RESULT_TYPE_CONFIG

from .services import PDFReportService

REPORT_GLOBAL_TYPES = ("Drifts", "Accelerations", "Forces", "Displacements")


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
                {"error": "result_set_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not sections:
            return Response(
                {"error": "At least one section is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result_set = ResultSet.objects.get(id=result_set_id, project=project)
        except ResultSet.DoesNotExist:
            return Response(
                {"error": "Result set not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            service = PDFReportService(project)
            section_data = service.get_sections_data(
                result_set_id=result_set_id,
                sections=sections,
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to build section data: {str(e)}"},
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
                {"error": "result_set_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Validate result set belongs to project
        try:
            result_set = ResultSet.objects.get(id=result_set_id, project=project)
        except ResultSet.DoesNotExist:
            return Response({"error": "Result set not found"}, status=status.HTTP_404_NOT_FOUND)

        available_sections = []
        result_service = ResultDataService(project)
        is_pushover = result_set.analysis_type == "Pushover"

        # --- Global Results ---
        for result_type in REPORT_GLOBAL_TYPES:
            directions = RESULT_TYPE_CONFIG.get(result_type, {}).get("directions") or []
            for direction in directions:
                dataset = result_service.get_global_results(
                    result_set_id=result_set.id,
                    result_type=result_type,
                    direction=direction,
                    is_pushover=is_pushover,
                )
                if not dataset or not dataset.rows:
                    continue
                available_sections.append(
                    {
                        "result_type": result_type,
                        "direction": direction,
                        "category": "Global",
                        "label": f"{result_type} {direction}",
                    }
                )

        # --- Element Results ---
        # Check for BeamRotations
        has_beam = ElementResultsCache.objects.filter(
            project=project,
            result_set_id=result_set.id,
            result_type="BeamRotations",
        ).exists()
        if not has_beam:
            # Beam rotations may not use cache — check raw table via provider
            from apps.results.models import BeamRotation
            from django.db.models import Q

            has_beam = BeamRotation.objects.filter(
                story__project=project,
            ).filter(
                Q(result_category__result_set_id=result_set.id)
                | Q(result_category__result_set__isnull=True)
            ).exists()

        if has_beam:
            available_sections.append(
                {
                    "result_type": "BeamRotations",
                    "direction": "",
                    "category": "Element",
                    "label": "Beam Rotations",
                }
            )

        # Check for ColumnRotations
        has_column = ElementResultsCache.objects.filter(
            project=project,
            result_set_id=result_set.id,
            result_type__startswith="ColumnRotations_",
        ).exists()
        if not has_column:
            from apps.results.models import ColumnRotation
            from django.db.models import Q

            has_column = ColumnRotation.objects.filter(
                story__project=project,
            ).filter(
                Q(result_category__result_set_id=result_set.id)
                | Q(result_category__result_set__isnull=True)
            ).exists()

        if has_column:
            available_sections.append(
                {
                    "result_type": "ColumnRotations",
                    "direction": "",
                    "category": "Element",
                    "label": "Column Rotations",
                }
            )

        # --- Joint Results ---
        has_soil = JointResultsCache.objects.filter(
            project=project,
            result_set_id=result_set.id,
            result_type__startswith="SoilPressures",
        ).exists()
        if not has_soil:
            from apps.results.models import SoilPressure

            has_soil = SoilPressure.objects.filter(
                project=project,
                result_set_id=result_set.id,
            ).exists()

        if has_soil:
            available_sections.append(
                {
                    "result_type": "SoilPressures",
                    "direction": "",
                    "category": "Joint",
                    "label": "Soil Pressures",
                }
            )

        has_vertical = JointResultsCache.objects.filter(
            project=project,
            result_set_id=result_set.id,
            result_type__startswith="VerticalDisplacements",
        ).exists()
        if not has_vertical:
            from apps.results.models import VerticalDisplacement

            has_vertical = VerticalDisplacement.objects.filter(
                project=project,
                result_set_id=result_set.id,
            ).exists()

        if has_vertical:
            available_sections.append(
                {
                    "result_type": "VerticalDisplacements",
                    "direction": "",
                    "category": "Joint",
                    "label": "Vertical Displacements",
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
