"""Provider functions for global/story-level result data."""

from typing import Any, Dict, Optional

from config.result_types import RESULT_TYPE_CONFIG

from apps.results.models import GlobalResultsCache

from ..datasets import (
    ResultDataset,
    get_internal_direction,
)
from .common import build_summary_columns, sort_load_case_columns


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

    cache_entries = (
        GlobalResultsCache.objects.filter(
            project=service.project,
            result_set_id=result_set_id,
            result_type=cache_type,
        )
        .select_related("story")
        .order_by("-story_sort_order")
    )

    if not cache_entries.exists():
        return None

    rows = []
    load_case_set = set()

    for entry in cache_entries:
        row = {"Story": entry.story.name, "story_sort_order": entry.story_sort_order}
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
        cache_entries = (
            GlobalResultsCache.objects.filter(
                project=service.project,
                result_set_id=result_set_id,
                result_type=cache_type,
            )
            .exclude(**{f"{db_column}__isnull": True})
            .select_related("story")
            .order_by("-story_sort_order")
            .values("story__name", db_column)
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
    }
