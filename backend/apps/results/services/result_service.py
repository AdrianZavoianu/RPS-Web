"""Result data service facade for retrieving and transforming result data."""

from typing import Any, Dict, List, Optional

from config.result_types import RESULT_TYPE_CONFIG

from apps.projects.models import Project, Story

from .datasets import (
    ComparisonDataset,
    ComparisonSeries,
    MaxMinDataset,
    ResultDataset,
    ResultDatasetMeta,
    get_internal_direction,
)
from .providers import (
    comparison_provider,
    element_provider,
    global_provider,
    joint_provider,
    maxmin_provider,
)


class ResultDataService:
    """Facade that delegates result retrieval to focused provider modules."""

    def __init__(self, project: Project):
        self.project = project
        self._story_cache: Optional[List[Story]] = None

    @property
    def stories(self) -> List[Story]:
        """Get project stories ordered by sort_order (top to bottom for display)."""
        if self._story_cache is None:
            self._story_cache = list(
                Story.objects.filter(project=self.project).order_by("-sort_order")
            )
        return self._story_cache

    def _get_display_name(self, result_type: str, direction: Optional[str]) -> str:
        """Generate display name with configured unit."""
        config = RESULT_TYPE_CONFIG.get(result_type, {})
        unit = config.get("unit", "")
        if direction:
            return f"{result_type} {direction} ({unit})"
        return f"{result_type} ({unit})"

    def _apply_multiplier(self, value: float, result_type: str) -> float:
        """Apply configured unit multiplier."""
        config = RESULT_TYPE_CONFIG.get(result_type, {})
        multiplier = config.get("multiplier", 1)
        return value * multiplier

    def get_global_results(
        self,
        result_set_id: int,
        result_type: str,
        direction: str,
        is_pushover: bool = False,
    ) -> Optional[ResultDataset]:
        """Get global/story-level results from cache."""
        return global_provider.get_global_results(
            service=self,
            result_set_id=result_set_id,
            result_type=result_type,
            direction=direction,
            is_pushover=is_pushover,
        )

    def get_element_results(
        self,
        result_set_id: int,
        element_id: int,
        result_type: str,
        direction: Optional[str] = None,
        is_pushover: bool = False,
    ) -> Optional[ResultDataset]:
        """Get element-level results from cache."""
        return element_provider.get_element_results(
            service=self,
            result_set_id=result_set_id,
            element_id=element_id,
            result_type=result_type,
            direction=direction,
            is_pushover=is_pushover,
        )

    def get_all_elements_for_type(
        self,
        result_set_id: int,
        result_type: str,
    ) -> List[Dict[str, Any]]:
        """Get list of elements that have results for a given type."""
        return element_provider.get_all_elements_for_type(
            service=self,
            result_set_id=result_set_id,
            result_type=result_type,
        )

    def get_joint_results(
        self,
        result_set_id: int,
        result_type: str,
        is_pushover: bool = False,
    ) -> Optional[ResultDataset]:
        """Get joint/foundation results from cache."""
        return joint_provider.get_joint_results(
            service=self,
            result_set_id=result_set_id,
            result_type=result_type,
            is_pushover=is_pushover,
        )

    def get_maxmin_dataset(
        self,
        result_set_id: int,
        base_result_type: str = "Drifts",
    ) -> Optional[MaxMinDataset]:
        """Get max/min envelope data for a result type."""
        return maxmin_provider.get_maxmin_dataset(
            service=self,
            result_set_id=result_set_id,
            base_result_type=base_result_type,
        )

    def get_comparison_dataset(
        self,
        result_type: str,
        direction: Optional[str],
        result_set_ids: List[int],
        metric: str = "Avg",
        element_id: Optional[int] = None,
    ) -> Optional[ComparisonDataset]:
        """Get comparison data across multiple result sets."""
        return comparison_provider.get_comparison_dataset(
            service=self,
            result_type=result_type,
            direction=direction,
            result_set_ids=result_set_ids,
            metric=metric,
            element_id=element_id,
        )

    def get_chart_data(
        self,
        result_set_id: int,
        result_type: str,
        direction: str,
        column: str = "Avg",
    ) -> Optional[Dict[str, Any]]:
        """Get data formatted for profile charts."""
        return global_provider.get_chart_data(
            service=self,
            result_set_id=result_set_id,
            result_type=result_type,
            direction=direction,
            column=column,
        )


__all__ = [
    "ResultDataService",
    "ResultDataset",
    "ResultDatasetMeta",
    "MaxMinDataset",
    "ComparisonDataset",
    "ComparisonSeries",
    "RESULT_TYPE_CONFIG",
    "get_internal_direction",
]
