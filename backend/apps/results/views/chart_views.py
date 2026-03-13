"""Chart and time-series data views."""

from config.result_types import RESULT_TYPE_CONFIG
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ..api import (
    ChartDataQuerySerializer,
    TimeSeriesAllTypesQuerySerializer,
    TimeSeriesDataQuerySerializer,
    TimeSeriesLoadCasesQuerySerializer,
)
from ..data import TimeSeriesGlobalCacheRepository
from ..services.providers.common import sort_load_case_columns
from .mixins import ProjectResultsMixin


def _build_envelopes_for_types(
    *,
    stories: list[str],
    types_data: dict[str, dict[str, list[float]]],
) -> dict[str, dict[str, list[float]]]:
    """Precompute per-story max/min envelopes for each result type."""
    envelopes: dict[str, dict[str, list[float]]] = {}
    for result_type, story_data in types_data.items():
        max_values: list[float] = []
        min_values: list[float] = []
        for story_name in stories:
            values = story_data.get(story_name) or []
            if values:
                max_values.append(max(values))
                min_values.append(min(values))
            else:
                max_values.append(0.0)
                min_values.append(0.0)

        envelopes[result_type] = {
            "max_values": max_values,
            "min_values": min_values,
        }

    return envelopes


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
        params = self.validate_query_params(ChartDataQuerySerializer)

        service = self.get_result_service()
        chart_data = service.get_chart_data(
            result_set_id=params["result_set_id"],
            result_type=params["result_type"],
            direction=params["direction"],
            column=params["column"],
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
        params = self.validate_query_params(TimeSeriesDataQuerySerializer)
        cache_entries = TimeSeriesGlobalCacheRepository.list_entries(
            self.get_project(),
            result_set_id=params["result_set_id"],
            load_case_name=params["load_case"],
            result_type=params["result_type"],
            direction=params["direction"],
        )
        if not cache_entries:
            return Response(
                {
                    "stories": [],
                    "time_steps": [],
                    "data": {},
                    "load_case": params["load_case"],
                    "result_type": params["result_type"],
                    "direction": params["direction"],
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
                "load_case": params["load_case"],
                "result_type": params["result_type"],
                "direction": params["direction"],
            }
        )


class TimeSeriesAllTypesView(ProjectResultsMixin, APIView):
    """
    Get time-series data for ALL 4 global result types in one response.
    Used by the animated 4-panel time-series view.

    Query params:
    - result_set_id: Required
    - load_case: Required
    - direction: Required. 'X' or 'Y'
    """

    permission_classes = [permissions.IsAuthenticated]

    GLOBAL_TYPES = ["Displacements", "Drifts", "Accelerations", "Forces"]
    GLOBAL_TYPE_UNITS = {
        "Displacements": RESULT_TYPE_CONFIG.get("Displacements", {}).get("unit", ""),
        "Drifts": RESULT_TYPE_CONFIG.get("Drifts", {}).get("unit", ""),
        "Accelerations": RESULT_TYPE_CONFIG.get("Accelerations", {}).get("unit", ""),
        "Forces": RESULT_TYPE_CONFIG.get("Forces", {}).get("unit", ""),
    }

    def get(self, request, project_slug):
        params = self.validate_query_params(TimeSeriesAllTypesQuerySerializer)
        cache_entries = TimeSeriesGlobalCacheRepository.list_entries(
            self.get_project(),
            result_set_id=params["result_set_id"],
            load_case_name=params["load_case"],
            direction=params["direction"],
            result_types=self.GLOBAL_TYPES,
        )
        if not cache_entries:
            return Response(
                {
                    "stories": [],
                    "time_steps": [],
                    "types": {},
                    "envelopes": {},
                    "units": self.GLOBAL_TYPE_UNITS,
                    "load_case": params["load_case"],
                    "direction": params["direction"],
                }
            )

        types_data: dict = {}
        stories = []
        stories_seen = set()
        time_steps = None

        for entry in cache_entries:
            story_name = entry.story.name
            rt = entry.result_type

            if story_name not in stories_seen:
                stories.append(story_name)
                stories_seen.add(story_name)

            if rt not in types_data:
                types_data[rt] = {}

            types_data[rt][story_name] = entry.values

            if time_steps is None and entry.time_steps:
                time_steps = entry.time_steps

        envelopes = _build_envelopes_for_types(stories=stories, types_data=types_data)
        return Response(
            {
                "stories": stories,
                "time_steps": time_steps or [],
                "types": types_data,
                "envelopes": envelopes,
                "units": self.GLOBAL_TYPE_UNITS,
                "load_case": params["load_case"],
                "direction": params["direction"],
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
        params = self.validate_query_params(TimeSeriesLoadCasesQuerySerializer)
        project = self.get_project()
        sorted_load_cases = sort_load_case_columns(
            TimeSeriesGlobalCacheRepository.list_load_case_names(
                project,
                result_set_id=params.get("result_set_id"),
            )
        )

        return Response({"load_cases": sorted_load_cases})
