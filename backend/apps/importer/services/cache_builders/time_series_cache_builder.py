"""Time-series cache builder."""

from typing import Dict, List, Optional

from django.db import transaction

from apps.importer.parsers.excel_parser import TimeHistoryParseResult, TimeSeriesData
from apps.projects.models import Project, Story
from apps.results.models import ResultSet, TimeSeriesGlobalCache

from ..bulk_writes import bulk_create_strict


class TimeSeriesCacheBuilder:
    """Builds ``TimeSeriesGlobalCache`` rows from parsed time-history data."""

    def __init__(self, *, project: Project, result_set: ResultSet):
        self.project = project
        self.result_set = result_set

    def build(
        self,
        *,
        time_history_results: List[TimeHistoryParseResult],
        stories_map: Dict[str, Story],
    ) -> int:
        """Build time-series cache rows and return row count."""
        TimeSeriesGlobalCache.objects.filter(
            project=self.project,
            result_set=self.result_set,
        ).delete()

        cache_rows = []

        for th_result in time_history_results:
            load_case_name = th_result.load_case_name

            self._add_rows(cache_rows, load_case_name, "Drifts", th_result.drifts_x, stories_map)
            self._add_rows(cache_rows, load_case_name, "Drifts", th_result.drifts_y, stories_map)
            self._add_rows(cache_rows, load_case_name, "Forces", th_result.forces_x, stories_map)
            self._add_rows(cache_rows, load_case_name, "Forces", th_result.forces_y, stories_map)
            self._add_rows(
                cache_rows,
                load_case_name,
                "Displacements",
                th_result.displacements_x,
                stories_map,
            )
            self._add_rows(
                cache_rows,
                load_case_name,
                "Displacements",
                th_result.displacements_y,
                stories_map,
            )
            self._add_rows(
                cache_rows,
                load_case_name,
                "Accelerations",
                th_result.accelerations_x,
                stories_map,
            )
            self._add_rows(
                cache_rows,
                load_case_name,
                "Accelerations",
                th_result.accelerations_y,
                stories_map,
            )

        if not cache_rows:
            return 0

        with transaction.atomic():
            bulk_create_strict(
                TimeSeriesGlobalCache,
                cache_rows,
                context="time-series cache build",
                key_builder=lambda row: (
                    row.load_case_name,
                    row.result_type,
                    row.direction,
                    row.story_id,
                ),
            )

        return len(cache_rows)

    def _add_rows(
        self,
        cache_rows: list[TimeSeriesGlobalCache],
        load_case_name: str,
        result_type: str,
        series_list: List[TimeSeriesData],
        stories_map: Dict[str, Story],
    ):
        for series in series_list:
            row = self._create_row(load_case_name, result_type, series, stories_map)
            if row is not None:
                cache_rows.append(row)

    def _create_row(
        self,
        load_case_name: str,
        result_type: str,
        series: TimeSeriesData,
        stories_map: Dict[str, Story],
    ) -> Optional[TimeSeriesGlobalCache]:
        story = stories_map.get(series.story)
        if story is None:
            return None
        if not series.time_steps or not series.values:
            return None

        return TimeSeriesGlobalCache(
            project=self.project,
            result_set=self.result_set,
            load_case_name=load_case_name,
            result_type=result_type,
            direction=series.direction,
            story=story,
            time_steps=series.time_steps,
            values=series.values,
            story_sort_order=series.story_sort_order,
        )
