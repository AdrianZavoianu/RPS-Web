"""Shared helpers for beam and column rotation providers."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from ..result_service import ResultDataService

from .common import build_histogram_bins


def resolve_story_sort_order(record_or_entry) -> int:
    """Get the effective sort order from a record or cache entry."""
    story_sort = getattr(record_or_entry, "story_sort_order", None)
    if story_sort is not None:
        return int(story_sort)
    story = getattr(record_or_entry, "story", None)
    if story and hasattr(story, "sort_order") and story.sort_order is not None:
        return int(story.sort_order)
    return 0


def compute_summary_stats(row: dict, load_case_columns: list[str]) -> None:
    """Add Avg/Max/Min summary stats to a row dict in-place."""
    numeric_values = [
        float(row[lc])
        for lc in load_case_columns
        if isinstance(row.get(lc), (int, float))
    ]
    if numeric_values:
        row["Avg"] = sum(numeric_values) / len(numeric_values)
        row["Max"] = max(numeric_values)
        row["Min"] = min(numeric_values)


def build_cache_row_values(
    entry,
    service: ResultDataService,
    result_type_key: str,
) -> tuple[dict[str, float], set[str]]:
    """Extract load case values from a cache entry's results_matrix.

    Returns (values_dict, load_case_names_set).
    """
    values: dict[str, float] = {}
    load_case_set: set[str] = set()
    for load_case_name, raw_value in (entry.results_matrix or {}).items():
        try:
            numeric_value = float(raw_value)
        except (TypeError, ValueError):
            continue
        values[load_case_name] = service._apply_multiplier(numeric_value, result_type_key)
        load_case_set.add(load_case_name)
    return values, load_case_set


def apply_cache_summary(
    row: dict, entry, service: ResultDataService, result_type_key: str
) -> None:
    """Apply pre-computed summary values from cache entry."""
    if entry.avg_value is not None:
        row["Avg"] = service._apply_multiplier(entry.avg_value, result_type_key)
    if entry.max_value is not None:
        row["Max"] = service._apply_multiplier(entry.max_value, result_type_key)
    if entry.min_value is not None:
        row["Min"] = service._apply_multiplier(entry.min_value, result_type_key)


def serialize_rotation_table_payload(
    *,
    service: ResultDataService,
    result_set_id: int,
    rows: list[dict[str, Any]],
    load_case_columns: list[str],
    fixed_columns: list[str],
    summary_columns: list[str],
    result_type_key: str,
    table_result_type: str,
) -> Dict[str, Any]:
    """Build the standard table payload dict for rotation tables."""
    has_summary = (
        any(summary_columns[0] in row for row in rows) if summary_columns else False
    )
    effective_summary = summary_columns if has_summary else []
    return {
        "meta": {
            "result_type": table_result_type,
            "result_set_id": result_set_id,
            "unit": service._build_meta(result_type_key, None, result_set_id).unit,
        },
        "columns": fixed_columns + load_case_columns + effective_summary,
        "rows": rows,
        "fixed_columns": fixed_columns,
        "load_case_columns": load_case_columns,
        "summary_columns": effective_summary,
    }


def build_rotation_plot_payload(
    *,
    service: ResultDataService,
    result_set_id: int,
    story_orders: Dict[str, int],
    max_points: List[Dict[str, Any]],
    min_points: List[Dict[str, Any]],
    result_type_key: str,
    meta_result_type: str,
    x_label: str,
    directions: Optional[set] = None,
) -> Optional[Dict[str, Any]]:
    """Build the standard plot payload dict for rotation scatter/histogram plots."""
    if not max_points and not min_points:
        return None

    story_names_excel_order = sorted(
        story_orders.keys(), key=lambda s: (story_orders[s], s)
    )
    stories = list(reversed(story_names_excel_order))
    story_index = {name: idx for idx, name in enumerate(stories)}

    for point in max_points:
        point["story_index"] = story_index.get(point["story"], 0)
    for point in min_points:
        point["story_index"] = story_index.get(point["story"], 0)

    histogram_values = [p["rotation"] for p in max_points] + [
        p["rotation"] for p in min_points
    ]

    payload: Dict[str, Any] = {
        "meta": {
            "result_type": meta_result_type,
            "result_set_id": result_set_id,
            "unit": service._build_meta(result_type_key, None, result_set_id).unit,
            "x_label": x_label,
        },
        "stories": stories,
        "max_points": max_points,
        "min_points": min_points,
        "histogram_bins": build_histogram_bins(histogram_values),
    }
    if directions is not None:
        payload["directions"] = sorted(directions)
    return payload
