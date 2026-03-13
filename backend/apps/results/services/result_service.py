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
from .fallback_policy import FALLBACK_CACHE_ONLY
from .providers import (
    beam_provider,
    column_provider,
    comparison_provider,
    element_provider,
    global_provider,
    joint_provider,
    maxmin_provider,
    quad_provider,
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

    def _build_meta(
        self,
        result_type: str,
        direction: Optional[str],
        result_set_id: int,
        *,
        display_name: Optional[str] = None,
        unit: Optional[str] = None,
    ) -> ResultDatasetMeta:
        config = RESULT_TYPE_CONFIG.get(result_type, {})
        # Fall back to base type config for prefixed types like MaxMin_Drifts
        if not config and "_" in result_type:
            base_type = result_type.split("_", 1)[1]
            config = RESULT_TYPE_CONFIG.get(base_type, {})
        resolved_unit = unit if unit is not None else config.get("unit", "")
        decimals = config.get("decimals")
        if not isinstance(decimals, int):
            decimals = None
        return ResultDatasetMeta(
            result_type=result_type,
            direction=direction,
            result_set_id=result_set_id,
            display_name=display_name or self._get_display_name(result_type, direction),
            unit=resolved_unit,
            decimals=decimals,
        )

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

    def get_element_type_results(
        self,
        result_set_id: int,
        cache_type: str,
        base_result_type: str,
        *,
        is_pushover: bool = False,
    ) -> Optional[ResultDataset]:
        """Get all element rows for one concrete cache-type variant."""
        return element_provider.get_element_type_results(
            service=self,
            result_set_id=result_set_id,
            cache_type=cache_type,
            base_result_type=base_result_type,
            is_pushover=is_pushover,
        )

    def get_joint_results(
        self,
        result_set_id: int,
        result_type: str,
        is_pushover: bool = False,
        fallback_policy: str = FALLBACK_CACHE_ONLY,
    ) -> Optional[ResultDataset]:
        """Get joint/foundation results with explicit fallback policy."""
        return joint_provider.get_joint_results(
            service=self,
            result_set_id=result_set_id,
            result_type=result_type,
            is_pushover=is_pushover,
            fallback_policy=fallback_policy,
        )

    def get_maxmin_dataset(
        self,
        result_set_id: int,
        base_result_type: str = "Drifts",
        element_id: Optional[int] = None,
    ) -> Optional[MaxMinDataset]:
        """Get max/min envelope data for a result type."""
        return maxmin_provider.get_maxmin_dataset(
            service=self,
            result_set_id=result_set_id,
            base_result_type=base_result_type,
            element_id=element_id,
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

    def get_beam_rotations_plot_data(
        self,
        result_set_id: int,
    ) -> Optional[Dict[str, Any]]:
        """Get all-beam R3 plastic rotations scatter/histogram data."""
        return beam_provider.get_beam_rotations_plot_data(
            service=self,
            result_set_id=result_set_id,
        )

    def get_beam_rotations_table_data(
        self,
        result_set_id: int,
        *,
        fallback_policy: str = FALLBACK_CACHE_ONLY,
    ) -> Optional[Dict[str, Any]]:
        """Get beam R3 plastic rotations table data."""
        return beam_provider.get_beam_rotations_table_data(
            service=self,
            result_set_id=result_set_id,
            fallback_policy=fallback_policy,
        )

    def get_column_rotations_plot_data(
        self,
        result_set_id: int,
    ) -> Optional[Dict[str, Any]]:
        """Get all-column rotations scatter/histogram data (R2 and R3)."""
        return column_provider.get_column_rotations_plot_data(
            service=self,
            result_set_id=result_set_id,
        )

    def get_column_rotations_table_data(
        self,
        result_set_id: int,
        *,
        fallback_policy: str = FALLBACK_CACHE_ONLY,
    ) -> Optional[Dict[str, Any]]:
        """Get all-column rotations table data."""
        return column_provider.get_column_rotations_table_data(
            service=self,
            result_set_id=result_set_id,
            fallback_policy=fallback_policy,
        )

    def get_quad_rotations_plot_data(
        self,
        result_set_id: int,
    ) -> Optional[Dict[str, Any]]:
        """Get all-quad rotations scatter/histogram data."""
        return quad_provider.get_quad_rotations_plot_data(
            service=self,
            result_set_id=result_set_id,
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
