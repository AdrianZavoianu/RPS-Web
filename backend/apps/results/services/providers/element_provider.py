"""Provider functions for element-level result data."""

from typing import Any, Dict, List, Optional

from apps.results.data import ElementResultsCacheRepository

from ..datasets import (
    ResultDataset,
    get_internal_direction,
)
from .common import build_summary_columns, sort_load_case_columns


def get_element_results(
    service,
    result_set_id: int,
    element_id: int,
    result_type: str,
    direction: Optional[str] = None,
    is_pushover: bool = False,
) -> Optional[ResultDataset]:
    """Get element-level results from cache."""
    internal_direction = get_internal_direction(result_type, direction) if direction else None
    cache_types: List[str] = []

    if internal_direction:
        cache_types.append(f"{result_type}_{internal_direction}")
    else:
        cache_types.append(result_type)

        # Desktop parity: these types are stored with suffix-specific cache keys.
        if result_type == "ColumnAxials":
            cache_types.extend(["ColumnAxials_Min", "ColumnAxials_Max"])
        elif result_type == "ColumnRotations":
            cache_types.extend(["ColumnRotations_R3", "ColumnRotations_R2"])
        elif result_type == "BeamRotations":
            cache_types.append("BeamRotations_R3Plastic")

    cache_entries = None
    resolved_direction = direction
    for cache_type in cache_types:
        candidate_entries = ElementResultsCacheRepository.list_entries(
            service.project,
            result_set_id=result_set_id,
            result_type=cache_type,
            element_id=element_id,
        )
        if candidate_entries:
            cache_entries = candidate_entries
            if not direction and "_" in cache_type:
                resolved_direction = cache_type.split("_", 1)[1]
            break

    if cache_entries is None:
        return None

    rows = []
    load_case_set = set()

    for entry in cache_entries:
        row = {
            "Story": entry.story.name,
            "Element": entry.element.name,
            "story_sort_order": entry.story_sort_order,
        }
        for lc_name, value in entry.results_matrix.items():
            row[lc_name] = service._apply_multiplier(value, result_type)
            load_case_set.add(lc_name)

        if entry.avg_value is not None:
            row["Avg"] = service._apply_multiplier(entry.avg_value, result_type)
        if entry.max_value is not None:
            row["Max"] = service._apply_multiplier(entry.max_value, result_type)
        if entry.min_value is not None:
            row["Min"] = service._apply_multiplier(entry.min_value, result_type)

        rows.append(row)

    if not rows:
        return None

    load_case_columns = sort_load_case_columns(list(load_case_set))
    summary_columns = build_summary_columns(rows, load_case_columns, is_pushover)

    return ResultDataset(
        meta=service._build_meta(
            result_type=result_type,
            direction=resolved_direction,
            result_set_id=result_set_id,
        ),
        rows=rows,
        load_case_columns=load_case_columns,
        summary_columns=summary_columns,
        story_column="Story",
    )


def get_all_elements_for_type(
    service,
    result_set_id: int,
    result_type: str,
) -> List[Dict[str, Any]]:
    """Get list of elements that have results for a given type."""
    cache_entries = ElementResultsCacheRepository.list_distinct_elements_for_type(
        service.project,
        result_set_id=result_set_id,
        result_type_prefix=result_type,
    )

    return [
        {
            "id": e["element__id"],
            "name": e["element__name"],
            "element_type": e["element__element_type"],
        }
        for e in cache_entries
    ]
