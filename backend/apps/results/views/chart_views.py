"""Chart and time-series data views."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import TimeSeriesGlobalCache
from .mixins import ProjectResultsMixin


class ChartDataView(ProjectResultsMixin, APIView):
    """
    Get data formatted for building profile charts.

    Query params:
    - result_set_id: Required
    - result_type: Required
    - direction: Required
    - column: Optional. 'Avg', 'Max', 'Min', or load case name (default: 'Avg')
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        params = self.validate_result_params(
            request,
            ("result_set_id", "result_type", "direction"),
        )
        if isinstance(params, Response):
            return params

        column = request.query_params.get("column", "Avg")

        service = self.get_result_service()
        chart_data = service.get_chart_data(
            result_set_id=int(params["result_set_id"]),
            result_type=params["result_type"],
            direction=params["direction"],
            column=column,
        )

        if not chart_data:
            return Response({"stories": [], "values": []})

        return Response(chart_data)


class TimeSeriesDataView(ProjectResultsMixin, APIView):
    """
    Get time-series data for animated visualization.

    Query params:
    - result_set_id: Required
    - load_case: Required. Load case name (e.g., 'TH02')
    - result_type: Required. 'Drifts', 'Displacements', etc.
    - direction: Required. 'X' or 'Y'
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        result_set_id = request.query_params.get("result_set_id")
        load_case = request.query_params.get("load_case")
        result_type = request.query_params.get("result_type")
        direction = request.query_params.get("direction")

        if not all([result_set_id, load_case, result_type, direction]):
            return Response(
                {"error": "result_set_id, load_case, result_type, and direction are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = self.get_project()

        cache_entries = (
            TimeSeriesGlobalCache.objects.filter(
                project=project,
                result_set_id=result_set_id,
                load_case_name=load_case,
                result_type=result_type,
                direction=direction,
            )
            .select_related("story")
            .order_by("-story_sort_order")
        )

        if not cache_entries.exists():
            return Response(
                {
                    "stories": [],
                    "time_steps": [],
                    "data": {},
                    "load_case": load_case,
                    "result_type": result_type,
                    "direction": direction,
                }
            )

        stories = []
        data = {}
        time_steps = None

        for entry in cache_entries:
            story_name = entry.story.name
            stories.append(story_name)
            data[story_name] = entry.values

            if time_steps is None and entry.time_steps:
                time_steps = entry.time_steps

        return Response(
            {
                "stories": stories,
                "time_steps": time_steps or [],
                "data": data,
                "load_case": load_case,
                "result_type": result_type,
                "direction": direction,
            }
        )


class TimeSeriesLoadCasesView(ProjectResultsMixin, APIView):
    """
    Get available load cases for time-series animation.

    Query params:
    - result_set_id: Optional
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        project = self.get_project()
        result_set_id = request.query_params.get("result_set_id")

        queryset = TimeSeriesGlobalCache.objects.filter(project=project)
        if result_set_id:
            queryset = queryset.filter(result_set_id=result_set_id)

        load_cases = queryset.values_list("load_case_name", flat=True).distinct()

        return Response({"load_cases": list(load_cases)})
