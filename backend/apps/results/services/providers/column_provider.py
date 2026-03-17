"""Provider functions for all-column rotation plot datasets."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple

if TYPE_CHECKING:
    from ..result_service import ResultDataService

from django.db.models import Q

from apps.results.data import ElementResultsCacheRepository
from apps.results.models import ColumnRotation

from ..fallback_policy import (
    FALLBACK_CACHE_ONLY,
    resolve_fallback,
)
from .common import sort_load_case_columns
from .rotation_base import (
    apply_cache_summary,
    build_cache_row_values,
    build_rotation_plot_payload,
    compute_summary_stats,
    resolve_story_sort_order,
    serialize_rotation_table_payload,
)

TABLE_FIXED_COLUMNS = ["Column", "Story", "Dir"]
TABLE_SUMMARY_COLUMNS = ["Avg", "Max", "Min"]


def _get_column_records(service: ResultDataService, result_set_id: int):
    return (
        ColumnRotation.objects.filter(story__project=service.project)
        .filter(
            Q(result_category__result_set_id=result_set_id)
            | Q(result_category__result_set__isnull=True)
        )
        .select_related("story", "load_case", "element")
        .order_by("story_sort_order", "element__name", "load_case__name", "id")
    )


def _resolve_rotation_candidates(record: ColumnRotation) -> List[Tuple[str, float]]:
    """Resolve max/min candidates with desktop-compatible fallback behavior."""
    candidates: List[Tuple[str, float]] = []

    if record.max_rotation is not None:
        candidates.append(("max", record.max_rotation))
    if record.min_rotation is not None:
        min_value = record.min_rotation
        # Some imports persist min magnitude as positive; enforce min-branch sign.
        if min_value > 0:
            min_value = -min_value
        candidates.append(("min", min_value))

    # Legacy/single-case imports may only contain one rotation value.
    if not candidates and record.rotation is not None:
        if record.rotation < 0:
            candidates.append(("min", record.rotation))
        elif record.rotation > 0:
            candidates.append(("max", record.rotation))
        else:
            candidates.append(("max", record.rotation))
            candidates.append(("min", record.rotation))

    return candidates


def _build_from_cache(service: ResultDataService, result_set_id: int) -> Optional[Dict[str, Any]]:
    cache_entries = ElementResultsCacheRepository.list_entries_for_types(
        service.project,
        result_set_id=result_set_id,
        result_types=["ColumnRotations_R2", "ColumnRotations_R3"],
    )
    if not cache_entries:
        return None

    story_orders: Dict[str, int] = {}
    directions = set()
    max_points: List[Dict[str, Any]] = []
    min_points: List[Dict[str, Any]] = []

    for entry in cache_entries:
        story_name = entry.story.name
        story_order = resolve_story_sort_order(entry)
        if story_name not in story_orders or story_order < story_orders[story_name]:
            story_orders[story_name] = story_order

        direction = "R2" if entry.result_type.endswith("_R2") else "R3"
        directions.add(direction)

        for load_case_name, raw_value in (entry.results_matrix or {}).items():
            try:
                numeric_value = float(raw_value)
            except (TypeError, ValueError):
                continue
            display_rotation = service._apply_multiplier(numeric_value, "ColumnRotations")
            point = {
                "element": entry.element.name,
                "story": story_name,
                "load_case": load_case_name,
                "direction": direction,
                "rotation": display_rotation,
            }
            if display_rotation < 0:
                min_points.append(point)
            else:
                max_points.append(point)

    return build_rotation_plot_payload(
        service=service,
        result_set_id=result_set_id,
        story_orders=story_orders,
        max_points=max_points,
        min_points=min_points,
        result_type_key="ColumnRotations",
        meta_result_type="AllColumnRotations",
        x_label="Column Rotation (%)",
        directions=directions,
    )


def _build_plot_from_raw(service: ResultDataService, result_set_id: int) -> Optional[Dict[str, Any]]:
    records = list(_get_column_records(service, result_set_id))
    if not records:
        return None

    story_orders: Dict[str, int] = {}
    directions = set()
    max_points: List[Dict[str, Any]] = []
    min_points: List[Dict[str, Any]] = []

    for record in records:
        story_name = record.story.name
        story_order = resolve_story_sort_order(record)
        if story_name not in story_orders or story_order < story_orders[story_name]:
            story_orders[story_name] = story_order

        direction = (record.direction or "").strip() or "R2"
        directions.add(direction)

        for step_type, raw_value in _resolve_rotation_candidates(record):
            display_rotation = service._apply_multiplier(raw_value, "ColumnRotations")

            point = {
                "element": record.element.name,
                "story": story_name,
                "load_case": record.load_case.name,
                "direction": direction,
                "rotation": display_rotation,
            }
            if step_type == "min":
                min_points.append(point)
            else:
                max_points.append(point)

    return build_rotation_plot_payload(
        service=service,
        result_set_id=result_set_id,
        story_orders=story_orders,
        max_points=max_points,
        min_points=min_points,
        result_type_key="ColumnRotations",
        meta_result_type="AllColumnRotations",
        x_label="Column Rotation (%)",
        directions=directions,
    )


def _build_table_from_cache(service: ResultDataService, result_set_id: int) -> Optional[Dict[str, Any]]:
    cache_entries = ElementResultsCacheRepository.list_entries_for_types(
        service.project,
        result_set_id=result_set_id,
        result_types=["ColumnRotations_R2", "ColumnRotations_R3"],
    )
    if not cache_entries:
        return None

    rows: list[tuple[int, dict[str, Any]]] = []
    load_case_set = set()

    for entry in cache_entries:
        direction = "R2" if entry.result_type.endswith("_R2") else "R3"
        row = {
            "Column": entry.element.name,
            "Story": entry.story.name,
            "Dir": direction,
        }

        values, lc_names = build_cache_row_values(entry, service, "ColumnRotations")
        row.update(values)
        load_case_set.update(lc_names)

        apply_cache_summary(row, entry, service, "ColumnRotations")

        rows.append((resolve_story_sort_order(entry), row))

    load_case_columns = sort_load_case_columns(list(load_case_set))
    rows.sort(key=lambda item: (item[0], item[1]["Column"], item[1]["Dir"]))
    ordered_rows = [row for _, row in rows]

    return serialize_rotation_table_payload(
        service=service,
        result_set_id=result_set_id,
        rows=ordered_rows,
        load_case_columns=load_case_columns,
        fixed_columns=TABLE_FIXED_COLUMNS,
        summary_columns=TABLE_SUMMARY_COLUMNS,
        result_type_key="ColumnRotations",
        table_result_type="ColumnRotationsTable",
    )


def _build_table_from_raw(service: ResultDataService, result_set_id: int) -> Optional[Dict[str, Any]]:
    records = list(_get_column_records(service, result_set_id))
    if not records:
        return None

    rows_map: Dict[tuple[str, str, str], dict[str, Any]] = {}
    row_sort_order: Dict[tuple[str, str, str], int] = {}
    load_case_set = set()

    for record in records:
        direction = (record.direction or "").strip() or "R3"
        story_name = record.story.name
        key = (story_name, record.element.name, direction)
        row = rows_map.setdefault(
            key,
            {
                "Column": record.element.name,
                "Story": story_name,
                "Dir": direction,
            },
        )

        incoming_sort = resolve_story_sort_order(record)
        if key not in row_sort_order:
            row_sort_order[key] = incoming_sort
        else:
            row_sort_order[key] = min(row_sort_order[key], incoming_sort)

        resolved_value = None
        if record.max_rotation is not None and record.min_rotation is not None:
            max_value = float(record.max_rotation)
            min_value = float(record.min_rotation)
            resolved_value = max_value if abs(max_value) >= abs(min_value) else min_value
        elif record.max_rotation is not None:
            resolved_value = float(record.max_rotation)
        elif record.min_rotation is not None:
            resolved_value = float(record.min_rotation)
        elif record.rotation is not None:
            resolved_value = float(record.rotation)

        if resolved_value is None:
            continue

        load_case_name = record.load_case.name
        row[load_case_name] = service._apply_multiplier(resolved_value, "ColumnRotations")
        load_case_set.add(load_case_name)

    load_case_columns = sort_load_case_columns(list(load_case_set))
    rows: list[tuple[int, dict[str, Any]]] = []
    for key, row in rows_map.items():
        compute_summary_stats(row, load_case_columns)
        rows.append((row_sort_order.get(key, 0), row))

    rows.sort(key=lambda item: (item[0], item[1]["Column"], item[1]["Dir"]))
    ordered_rows = [row for _, row in rows]

    return serialize_rotation_table_payload(
        service=service,
        result_set_id=result_set_id,
        rows=ordered_rows,
        load_case_columns=load_case_columns,
        fixed_columns=TABLE_FIXED_COLUMNS,
        summary_columns=TABLE_SUMMARY_COLUMNS,
        result_type_key="ColumnRotations",
        table_result_type="ColumnRotationsTable",
    )


def get_column_rotations_plot_data(service: ResultDataService, result_set_id: int) -> Optional[Dict[str, Any]]:
    plot_data = _build_plot_from_raw(service, result_set_id)
    if plot_data is not None:
        return plot_data

    # Fallback for datasets where raw rows are unavailable but element cache exists.
    return _build_from_cache(service, result_set_id)


def get_column_rotations_table_data(
    service: ResultDataService,
    result_set_id: int,
    *,
    fallback_policy: str = FALLBACK_CACHE_ONLY,
) -> Optional[Dict[str, Any]]:
    selected = resolve_fallback(
        fallback_policy=fallback_policy,
        cache_loader=lambda: _build_table_from_cache(service, result_set_id),
        raw_loader=lambda: _build_table_from_raw(service, result_set_id),
        has_data=lambda payload: bool(payload and payload.get("rows")),
    )
    return selected.data
