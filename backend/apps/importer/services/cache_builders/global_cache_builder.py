"""Global/story-level cache builder."""

from collections import defaultdict
from typing import Dict

from django.db import transaction

from apps.projects.models import Project, Story
from apps.results.models import (
    GlobalResultsCache,
    ResultSet,
    StoryAcceleration,
    StoryDisplacement,
    StoryDrift,
    StoryForce,
)

from .common import compute_aggregates


class GlobalCacheBuilder:
    """Builds ``GlobalResultsCache`` rows for a result set."""

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
        """Build global cache rows and return row count."""
        total_rows = 0

        GlobalResultsCache.objects.filter(
            project=self.project,
            result_set=self.result_set,
        ).delete()

        result_configs = [
            ("Drifts_X", StoryDrift, "drift", {"direction": "X"}),
            ("Drifts_Y", StoryDrift, "drift", {"direction": "Y"}),
            ("Accelerations_UX", StoryAcceleration, "acceleration", {"direction": "UX"}),
            ("Accelerations_UY", StoryAcceleration, "acceleration", {"direction": "UY"}),
            ("Forces_VX", StoryForce, "force", {"direction": "VX"}),
            ("Forces_VY", StoryForce, "force", {"direction": "VY"}),
            ("Displacements_UX", StoryDisplacement, "displacement", {"direction": "UX"}),
            ("Displacements_UY", StoryDisplacement, "displacement", {"direction": "UY"}),
        ]

        for result_type, model, value_field, filters in result_configs:
            total_rows += self._build_for_type(
                result_type=result_type,
                model=model,
                value_field=value_field,
                extra_filters=filters,
            )

        return total_rows

    def _build_for_type(
        self,
        *,
        result_type: str,
        model,
        value_field: str,
        extra_filters: Dict,
    ) -> int:
        queryset = model.objects.filter(
            result_category__result_set=self.result_set,
            **extra_filters,
        ).select_related("story", "load_case")

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
            if self.compute_aggregates_enabled:
                avg_val, max_val, min_val, count = compute_aggregates(results_matrix)
                row.avg_value = avg_val
                row.max_value = max_val
                row.min_value = min_val
                row.load_case_count = count
            cache_rows.append(row)

        with transaction.atomic():
            GlobalResultsCache.objects.bulk_create(cache_rows)

        return len(cache_rows)
