"""Element-level cache builder."""

from collections import defaultdict
from typing import Dict, Optional

from django.db import transaction

from apps.projects.models import Project, Story
from apps.results.models import (
    BeamRotation,
    ColumnAxial,
    ColumnRotation,
    ColumnShear,
    ElementResultsCache,
    QuadRotation,
    ResultSet,
    WallShear,
)

from .common import compute_aggregates


class ElementCacheBuilder:
    """Builds ``ElementResultsCache`` rows for a result set."""

    def __init__(
        self,
        *,
        project: Project,
        result_set: ResultSet,
        compute_aggregates_enabled: bool,
    ):
        self.project = project
        self.result_set = result_set
        self.compute_aggregates_enabled = compute_aggregates_enabled

    def build(self) -> int:
        """Build element cache rows and return row count."""
        total_rows = 0

        ElementResultsCache.objects.filter(
            project=self.project,
            result_set=self.result_set,
        ).delete()

        element_configs = [
            ("WallShears_V2", WallShear, "force", {"direction": "V2"}, None),
            ("WallShears_V3", WallShear, "force", {"direction": "V3"}, None),
            ("QuadRotations", QuadRotation, "max_rotation", {}, "rotation"),
            ("ColumnShears_V2", ColumnShear, "force", {"direction": "V2"}, None),
            ("ColumnShears_V3", ColumnShear, "force", {"direction": "V3"}, None),
            ("ColumnAxials_Min", ColumnAxial, "min_axial", {}, None),
            ("ColumnAxials_Max", ColumnAxial, "max_axial", {}, None),
            ("ColumnRotations_R2", ColumnRotation, "max_rotation", {"direction": "R2"}, "rotation"),
            ("ColumnRotations_R3", ColumnRotation, "max_rotation", {"direction": "R3"}, "rotation"),
            ("BeamRotations", BeamRotation, "max_r3_plastic", {}, "r3_plastic"),
        ]

        for result_type, model, value_field, filters, fallback_field in element_configs:
            total_rows += self._build_for_type(
                result_type=result_type,
                model=model,
                value_field=value_field,
                extra_filters=filters,
                fallback_field=fallback_field,
            )

        return total_rows

    def _build_for_type(
        self,
        *,
        result_type: str,
        model,
        value_field: str,
        extra_filters: Dict,
        fallback_field: Optional[str],
    ) -> int:
        queryset = model.objects.filter(
            result_category__result_set=self.result_set,
            **extra_filters,
        ).select_related("element", "story", "load_case")

        element_story_data: Dict[tuple, Dict[str, float]] = defaultdict(dict)
        element_story_order: Dict[tuple, int] = {}
        element_objects: Dict[int, object] = {}
        story_objects: Dict[int, Story] = {}

        for result in queryset:
            key = (result.element_id, result.story_id)
            load_case_name = result.load_case.name
            value = getattr(result, value_field)
            if value is None and fallback_field:
                value = getattr(result, fallback_field)
            if value is None:
                continue

            element_story_data[key][load_case_name] = value
            element_story_order[key] = result.story_sort_order or result.story.sort_order or 0
            element_objects[result.element_id] = result.element
            story_objects[result.story_id] = result.story

        if not element_story_data:
            return 0

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
            if self.compute_aggregates_enabled:
                avg_val, max_val, min_val, count = compute_aggregates(results_matrix)
                row.avg_value = avg_val
                row.max_value = max_val
                row.min_value = min_val
                row.load_case_count = count
            cache_rows.append(row)

        with transaction.atomic():
            ElementResultsCache.objects.bulk_create(cache_rows)

        return len(cache_rows)
