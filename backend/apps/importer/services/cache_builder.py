"""Cache builder service for post-import cache population.

Transforms normalized result data into wide-format cache tables
optimized for tabular display and chart rendering.
"""

import logging
from collections import defaultdict
from typing import Dict, List, Optional, Callable, Tuple

from django.db import transaction
from django.utils import timezone

from apps.projects.models import Project, Story
from apps.results.models import (
    ResultSet,
    StoryDrift,
    StoryAcceleration,
    StoryForce,
    StoryDisplacement,
    WallShear,
    QuadRotation,
    ColumnShear,
    ColumnAxial,
    ColumnRotation,
    BeamRotation,
    SoilPressure,
    VerticalDisplacement,
    GlobalResultsCache,
    ElementResultsCache,
    JointResultsCache,
    TimeSeriesGlobalCache,
)
from apps.importer.parsers.excel_parser import TimeHistoryParseResult, TimeSeriesData

logger = logging.getLogger(__name__)


def _compute_aggregates(results_matrix: Dict[str, float]) -> Tuple[Optional[float], Optional[float], Optional[float], int]:
    """Compute aggregate statistics from a results matrix in a single pass.

    Args:
        results_matrix: Dict of load_case_name -> value

    Returns:
        Tuple of (avg_value, max_value, min_value, load_case_count)
    """
    if not results_matrix:
        return None, None, None, 0

    total = 0.0
    max_val = float('-inf')
    min_val = float('inf')
    count = 0

    for v in results_matrix.values():
        total += v
        if v > max_val:
            max_val = v
        if v < min_val:
            min_val = v
        count += 1

    return total / count, max_val, min_val, count


class CacheBuilderService:
    """Builds wide-format cache tables from normalized result data."""

    def __init__(
        self,
        project: Project,
        result_set: ResultSet,
        progress_callback: Optional[Callable[[str, int, int], None]] = None,
        compute_aggregates: bool = True,
    ):
        self.project = project
        self.result_set = result_set
        self.progress_callback = progress_callback or (lambda m, c, t: None)
        self.compute_aggregates = compute_aggregates

    def build_all_caches(self) -> Dict[str, int]:
        """Build all cache tables for the result set.

        Updates result_set.cache_status to track progress:
        - 'building' at start
        - 'ready' on success
        - 'stale' on failure

        Returns:
            Dict with counts of cached items by type
        """
        stats = {
            'global_cache_rows': 0,
            'element_cache_rows': 0,
            'joint_cache_rows': 0,
            'time_series_cache_rows': 0,
        }

        # Mark cache as building
        self.result_set.cache_status = 'building'
        self.result_set.save(update_fields=['cache_status'])

        try:
            self.progress_callback("Building global results cache...", 1, 4)
            stats['global_cache_rows'] = self._build_global_cache()

            self.progress_callback("Building element results cache...", 2, 4)
            stats['element_cache_rows'] = self._build_element_cache()

            self.progress_callback("Building joint results cache...", 3, 4)
            stats['joint_cache_rows'] = self._build_joint_cache()

            self.progress_callback("Cache building complete", 4, 4)

            # Mark cache as ready
            self.result_set.cache_status = 'ready'
            self.result_set.cache_built_at = timezone.now()
        except Exception:
            logger.exception(
                "Failed to build caches for project_id=%s result_set_id=%s",
                self.project.id,
                self.result_set.id,
            )
            # Mark cache as stale on failure
            self.result_set.cache_status = 'stale'
            raise
        finally:
            self.result_set.save(update_fields=['cache_status', 'cache_built_at'])

        return stats

    def build_time_series_cache(
        self,
        time_history_results: List[TimeHistoryParseResult],
        stories_map: Dict[str, Story],
    ) -> int:
        """Build TimeSeriesGlobalCache from parsed time-history data.

        Args:
            time_history_results: List of parsed time-history results from files
            stories_map: Map of story name -> Story model

        Returns:
            Number of cache rows created
        """
        total_rows = 0

        # Clear existing time-series cache for this result set
        TimeSeriesGlobalCache.objects.filter(
            project=self.project,
            result_set=self.result_set,
        ).delete()

        cache_rows = []

        for th_result in time_history_results:
            load_case_name = th_result.load_case_name

            # Process each result type
            # Drifts
            for series in th_result.drifts_x:
                row = self._create_time_series_row(
                    load_case_name, 'Drifts', series, stories_map
                )
                if row:
                    cache_rows.append(row)

            for series in th_result.drifts_y:
                row = self._create_time_series_row(
                    load_case_name, 'Drifts', series, stories_map
                )
                if row:
                    cache_rows.append(row)

            # Forces
            for series in th_result.forces_x:
                row = self._create_time_series_row(
                    load_case_name, 'Forces', series, stories_map
                )
                if row:
                    cache_rows.append(row)

            for series in th_result.forces_y:
                row = self._create_time_series_row(
                    load_case_name, 'Forces', series, stories_map
                )
                if row:
                    cache_rows.append(row)

            # Displacements
            for series in th_result.displacements_x:
                row = self._create_time_series_row(
                    load_case_name, 'Displacements', series, stories_map
                )
                if row:
                    cache_rows.append(row)

            for series in th_result.displacements_y:
                row = self._create_time_series_row(
                    load_case_name, 'Displacements', series, stories_map
                )
                if row:
                    cache_rows.append(row)

            # Accelerations
            for series in th_result.accelerations_x:
                row = self._create_time_series_row(
                    load_case_name, 'Accelerations', series, stories_map
                )
                if row:
                    cache_rows.append(row)

            for series in th_result.accelerations_y:
                row = self._create_time_series_row(
                    load_case_name, 'Accelerations', series, stories_map
                )
                if row:
                    cache_rows.append(row)

        if cache_rows:
            with transaction.atomic():
                TimeSeriesGlobalCache.objects.bulk_create(
                    cache_rows,
                    ignore_conflicts=True,
                )
            total_rows = len(cache_rows)

        return total_rows

    def _create_time_series_row(
        self,
        load_case_name: str,
        result_type: str,
        series: TimeSeriesData,
        stories_map: Dict[str, Story],
    ) -> Optional[TimeSeriesGlobalCache]:
        """Create a TimeSeriesGlobalCache row from TimeSeriesData."""
        story = stories_map.get(series.story)
        if not story:
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

    def _build_global_cache(self) -> int:
        """Build GlobalResultsCache from story-level results.

        Returns:
            Number of cache rows created
        """
        total_rows = 0

        # Clear existing cache for this result set
        GlobalResultsCache.objects.filter(
            project=self.project,
            result_set=self.result_set,
        ).delete()

        # Build cache for each result type and direction
        result_configs = [
            ('Drifts_X', StoryDrift, 'drift', {'direction': 'X'}),
            ('Drifts_Y', StoryDrift, 'drift', {'direction': 'Y'}),
            ('Accelerations_UX', StoryAcceleration, 'acceleration', {'direction': 'UX'}),
            ('Accelerations_UY', StoryAcceleration, 'acceleration', {'direction': 'UY'}),
            ('Forces_VX', StoryForce, 'force', {'direction': 'VX'}),
            ('Forces_VY', StoryForce, 'force', {'direction': 'VY'}),
            ('Displacements_UX', StoryDisplacement, 'displacement', {'direction': 'UX'}),
            ('Displacements_UY', StoryDisplacement, 'displacement', {'direction': 'UY'}),
        ]

        for result_type, model, value_field, filters in result_configs:
            rows = self._build_global_cache_for_type(
                result_type=result_type,
                model=model,
                value_field=value_field,
                extra_filters=filters,
            )
            total_rows += rows

        return total_rows

    def _build_global_cache_for_type(
        self,
        result_type: str,
        model,
        value_field: str,
        extra_filters: Dict,
    ) -> int:
        """Build cache for a specific global result type.

        Pivots data from (story, load_case) -> value format
        to story -> {load_case: value} wide format.
        """
        # Query results
        queryset = model.objects.filter(
            result_category__result_set=self.result_set,
            **extra_filters,
        ).select_related('story', 'load_case')

        # Pivot to wide format
        story_data: Dict[int, Dict[str, float]] = defaultdict(dict)
        story_order: Dict[int, int] = {}
        story_objects: Dict[int, Story] = {}

        for result in queryset:
            story_id = result.story_id
            load_case_name = result.load_case.name
            value = getattr(result, value_field)

            story_data[story_id][load_case_name] = value
            story_order[story_id] = result.story_sort_order or result.story.sort_order or 0
            story_objects[story_id] = result.story

        if not story_data:
            return 0

        # Create cache rows, optionally with pre-computed aggregates
        cache_rows = []
        for story_id, results_matrix in story_data.items():
            row = GlobalResultsCache(
                project=self.project,
                result_set=self.result_set,
                result_type=result_type,
                story=story_objects[story_id],
                results_matrix=results_matrix,
                story_sort_order=story_order.get(story_id, 0),
            )
            if self.compute_aggregates:
                avg_val, max_val, min_val, count = _compute_aggregates(results_matrix)
                row.avg_value = avg_val
                row.max_value = max_val
                row.min_value = min_val
                row.load_case_count = count
            cache_rows.append(row)

        with transaction.atomic():
            GlobalResultsCache.objects.bulk_create(cache_rows)

        return len(cache_rows)

    def _build_element_cache(self) -> int:
        """Build ElementResultsCache from element-level results.

        Returns:
            Number of cache rows created
        """
        total_rows = 0

        # Clear existing cache
        ElementResultsCache.objects.filter(
            project=self.project,
            result_set=self.result_set,
        ).delete()

        # Build cache for each element result type
        element_configs = [
            ('WallShears_V2', WallShear, 'force', {'direction': 'V2'}),
            ('WallShears_V3', WallShear, 'force', {'direction': 'V3'}),
            ('QuadRotations', QuadRotation, 'rotation', {}),
            ('ColumnShears_V2', ColumnShear, 'force', {'direction': 'V2'}),
            ('ColumnShears_V3', ColumnShear, 'force', {'direction': 'V3'}),
            ('ColumnAxials', ColumnAxial, 'min_axial', {}),
            ('ColumnRotations_R2', ColumnRotation, 'rotation', {'direction': 'R2'}),
            ('ColumnRotations_R3', ColumnRotation, 'rotation', {'direction': 'R3'}),
            ('BeamRotations', BeamRotation, 'r3_plastic', {}),
        ]

        for result_type, model, value_field, filters in element_configs:
            rows = self._build_element_cache_for_type(
                result_type=result_type,
                model=model,
                value_field=value_field,
                extra_filters=filters,
            )
            total_rows += rows

        return total_rows

    def _build_element_cache_for_type(
        self,
        result_type: str,
        model,
        value_field: str,
        extra_filters: Dict,
    ) -> int:
        """Build cache for a specific element result type.

        Pivots data from (element, story, load_case) -> value
        to (element, story) -> {load_case: value} wide format.
        """
        queryset = model.objects.filter(
            result_category__result_set=self.result_set,
            **extra_filters,
        ).select_related('element', 'story', 'load_case')

        # Pivot to wide format
        # Key: (element_id, story_id) -> {load_case: value}
        element_story_data: Dict[tuple, Dict[str, float]] = defaultdict(dict)
        element_story_order: Dict[tuple, int] = {}
        element_objects: Dict[int, object] = {}
        story_objects: Dict[int, Story] = {}

        for result in queryset:
            key = (result.element_id, result.story_id)
            load_case_name = result.load_case.name
            value = getattr(result, value_field)

            element_story_data[key][load_case_name] = value
            element_story_order[key] = result.story_sort_order or result.story.sort_order or 0
            element_objects[result.element_id] = result.element
            story_objects[result.story_id] = result.story

        if not element_story_data:
            return 0

        # Create cache rows, optionally with pre-computed aggregates
        cache_rows = []
        for (element_id, story_id), results_matrix in element_story_data.items():
            row = ElementResultsCache(
                project=self.project,
                result_set=self.result_set,
                result_type=result_type,
                element=element_objects[element_id],
                story=story_objects[story_id],
                results_matrix=results_matrix,
                story_sort_order=element_story_order.get((element_id, story_id), 0),
            )
            if self.compute_aggregates:
                avg_val, max_val, min_val, count = _compute_aggregates(results_matrix)
                row.avg_value = avg_val
                row.max_value = max_val
                row.min_value = min_val
                row.load_case_count = count
            cache_rows.append(row)

        with transaction.atomic():
            ElementResultsCache.objects.bulk_create(cache_rows)

        return len(cache_rows)

    def _build_joint_cache(self) -> int:
        """Build JointResultsCache from foundation/joint results.

        Returns:
            Number of cache rows created
        """
        total_rows = 0

        # Clear existing cache
        JointResultsCache.objects.filter(
            project=self.project,
            result_set=self.result_set,
        ).delete()

        # Build soil pressure cache
        total_rows += self._build_joint_cache_soil_pressures()

        # Build vertical displacement cache
        total_rows += self._build_joint_cache_vertical_displacements()

        return total_rows

    def _build_joint_cache_soil_pressures(self) -> int:
        """Build cache for soil pressure results."""
        queryset = SoilPressure.objects.filter(
            project=self.project,
            result_set=self.result_set,
        ).select_related('load_case')

        # Pivot to wide format
        # Key: unique_name -> {load_case: value}
        joint_data: Dict[str, Dict[str, float]] = defaultdict(dict)
        joint_shell: Dict[str, str] = {}

        for result in queryset:
            unique_name = result.unique_name
            load_case_name = result.load_case.name

            joint_data[unique_name][load_case_name] = result.min_pressure
            joint_shell[unique_name] = result.shell_object

        if not joint_data:
            return 0

        # Create cache rows, optionally with pre-computed aggregates
        cache_rows = []
        for unique_name, results_matrix in joint_data.items():
            row = JointResultsCache(
                project=self.project,
                result_set=self.result_set,
                result_type='SoilPressures_Min',
                shell_object=joint_shell.get(unique_name, ''),
                unique_name=unique_name,
                results_matrix=results_matrix,
            )
            if self.compute_aggregates:
                avg_val, max_val, min_val, count = _compute_aggregates(results_matrix)
                row.avg_value = avg_val
                row.max_value = max_val
                row.min_value = min_val
                row.load_case_count = count
            cache_rows.append(row)

        with transaction.atomic():
            JointResultsCache.objects.bulk_create(cache_rows)

        return len(cache_rows)

    def _build_joint_cache_vertical_displacements(self) -> int:
        """Build cache for vertical displacement results."""
        queryset = VerticalDisplacement.objects.filter(
            project=self.project,
            result_set=self.result_set,
        ).select_related('load_case')

        # Pivot to wide format
        joint_data: Dict[str, Dict[str, float]] = defaultdict(dict)
        joint_label: Dict[str, str] = {}

        for result in queryset:
            unique_name = result.unique_name
            load_case_name = result.load_case.name

            joint_data[unique_name][load_case_name] = result.min_displacement
            joint_label[unique_name] = result.label

        if not joint_data:
            return 0

        # Create cache rows, optionally with pre-computed aggregates
        cache_rows = []
        for unique_name, results_matrix in joint_data.items():
            row = JointResultsCache(
                project=self.project,
                result_set=self.result_set,
                result_type='VerticalDisplacements_Min',
                shell_object=joint_label.get(unique_name, ''),  # Using label as shell_object
                unique_name=unique_name,
                results_matrix=results_matrix,
            )
            if self.compute_aggregates:
                avg_val, max_val, min_val, count = _compute_aggregates(results_matrix)
                row.avg_value = avg_val
                row.max_value = max_val
                row.min_value = min_val
                row.load_case_count = count
            cache_rows.append(row)

        with transaction.atomic():
            JointResultsCache.objects.bulk_create(cache_rows)

        return len(cache_rows)
