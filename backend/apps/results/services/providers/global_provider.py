"""Provider functions for global/story-level result data."""

from typing import Any, Dict, Optional

from config.result_types import RESULT_TYPE_CONFIG

from apps.results.data import GlobalResultsCacheRepository

from ..datasets import (
    ResultDataset,
    get_internal_direction,
)
from .common import build_summary_columns, sort_load_case_columns


def _detect_pushover_case_direction(load_case_name: str) -> str:
    """Detect pushover case direction from load case name."""
    case_upper = str(load_case_name).upper()
    has_x = "X" in case_upper
    has_y = "Y" in case_upper
    if has_x and has_y:
        return "XY"
    if has_x:
        return "X"
    if has_y:
        return "Y"
    return "UNKNOWN"


def _filter_pushover_matrix_by_direction(
    matrix: Dict[str, Any], selected_direction: str
) -> Dict[str, Any]:
    """Keep only load-case columns matching selected pushover direction."""
    selected = str(selected_direction).upper()
    if selected not in {"X", "Y"}:
        return matrix

    filtered: Dict[str, Any] = {}
    for load_case_name, value in matrix.items():
        direction = _detect_pushover_case_direction(load_case_name)
        if direction == selected or direction == "XY":
            filtered[load_case_name] = value
    return filtered if filtered else matrix


def get_global_results(
    service,
    result_set_id: int,
    result_type: str,
    direction: str,
    is_pushover: bool = False,
) -> Optional[ResultDataset]:
    """Get global/story-level results from cache."""
    internal_direction = get_internal_direction(result_type, direction)
    cache_type = f"{result_type}_{internal_direction}"

    cache_entries = GlobalResultsCacheRepository.list_entries(
        service.project,
        result_set_id=result_set_id,
        result_type=cache_type,
    )
    if not cache_entries:
        return None

    rows = []
    load_case_set = set()

    for entry in cache_entries:
        row = {"Story": entry.story.name, "story_sort_order": entry.story_sort_order}

        matrix = entry.results_matrix or {}
        if is_pushover:
            matrix = _filter_pushover_matrix_by_direction(matrix, direction)

        for lc_name, value in matrix.items():
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
            direction=direction,
            result_set_id=result_set_id,
        ),
        rows=rows,
        load_case_columns=load_case_columns,
        summary_columns=summary_columns,
    )


def get_chart_data(
    service,
    result_set_id: int,
    result_type: str,
    direction: str,
    column: str = "Avg",
) -> Optional[Dict[str, Any]]:
    """Get data formatted for building profile charts."""
    internal_direction = get_internal_direction(result_type, direction)
    cache_type = f"{result_type}_{internal_direction}"
    config = RESULT_TYPE_CONFIG.get(result_type, {})
    multiplier = config.get("multiplier", 1)

    aggregate_column_map = {"Avg": "avg_value", "Max": "max_value", "Min": "min_value"}
    if column in aggregate_column_map:
        db_column = aggregate_column_map[column]
        cache_entries = GlobalResultsCacheRepository.list_aggregate_rows(
            service.project,
            result_set_id=result_set_id,
            result_type=cache_type,
            aggregate_column=db_column,
        )

        if not cache_entries:
            return None

        stories = []
        values = []
        for entry in cache_entries:
            stories.append(entry["story__name"])
            values.append(entry[db_column] * multiplier)

        return {
            "stories": stories,
            "values": values,
            "result_type": result_type,
            "direction": direction,
            "column": column,
            "unit": config.get("unit", ""),
            "decimals": config.get("decimals"),
        }

    dataset = service.get_global_results(
        result_set_id=result_set_id,
        result_type=result_type,
        direction=direction,
    )
    if not dataset:
        return None

    stories = []
    values = []
    for row in dataset.rows:
        story = row.get("Story")
        value = row.get(column)
        if story is not None and value is not None:
            stories.append(story)
            values.append(value)

    return {
        "stories": stories,
        "values": values,
        "result_type": result_type,
        "direction": direction,
        "column": column,
        "unit": config.get("unit", ""),
        "decimals": config.get("decimals"),
    }
