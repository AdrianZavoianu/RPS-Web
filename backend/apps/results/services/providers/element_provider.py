"""Provider functions for element-level result data."""

from typing import Any, Dict, List, Optional

from apps.results.models import ElementResultsCache

from ..datasets import (
    ResultDataset,
    ResultDatasetMeta,
    get_internal_direction,
)


def _build_summary_columns(
    rows: List[Dict[str, Any]],
    load_case_columns: List[str],
    is_pushover: bool,
) -> List[str]:
    """Populate fallback summary columns when aggregates are not precomputed."""
    if is_pushover or not load_case_columns:
        return []

    for row in rows:
        if "Avg" in row:
            continue
        values = [row.get(lc, 0) for lc in load_case_columns if lc in row]
        if not values:
            continue
        row["Avg"] = sum(values) / len(values)
        row["Max"] = max(values)
        row["Min"] = min(values)

    return ["Avg", "Max", "Min"]


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
    cache_type = f"{result_type}_{internal_direction}" if internal_direction else result_type

    cache_entries = (
        ElementResultsCache.objects.filter(
            project=service.project,
            result_set_id=result_set_id,
            result_type=cache_type,
            element_id=element_id,
        )
        .select_related("story", "element")
        .order_by("-story_sort_order")
    )

    if not cache_entries.exists():
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

    load_case_columns = sorted(load_case_set)
    summary_columns = _build_summary_columns(rows, load_case_columns, is_pushover)

    return ResultDataset(
        meta=ResultDatasetMeta(
            result_type=result_type,
            direction=direction,
            result_set_id=result_set_id,
            display_name=service._get_display_name(result_type, direction),
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
    cache_entries = (
        ElementResultsCache.objects.filter(
            project=service.project,
            result_set_id=result_set_id,
            result_type__startswith=result_type,
        )
        .select_related("element")
        .values("element__id", "element__name", "element__element_type")
        .distinct()
    )

    return [
        {
            "id": e["element__id"],
            "name": e["element__name"],
            "element_type": e["element__element_type"],
        }
        for e in cache_entries
    ]
