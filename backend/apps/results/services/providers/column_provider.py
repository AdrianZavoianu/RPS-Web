"""Provider functions for all-column rotation plot datasets."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from django.db.models import Q

from apps.results.data import ElementResultsCacheRepository
from apps.results.models import ColumnRotation

PLOT_BINS = 50


def _get_column_records(service, result_set_id: int):
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


def _build_histogram_bins(values: List[float]) -> List[Dict[str, float]]:
    if not values:
        return []

    min_value = min(values)
    max_value = max(values)

    if max_value == min_value:
        return [
            {
                "start": min_value - 0.5,
                "end": max_value + 0.5,
                "center": min_value,
                "count": float(len(values)),
            }
        ]

    bin_width = (max_value - min_value) / PLOT_BINS
    counts = [0] * PLOT_BINS

    for value in values:
        index = int((value - min_value) / bin_width)
        if index >= PLOT_BINS:
            index = PLOT_BINS - 1
        counts[index] += 1

    bins: List[Dict[str, float]] = []
    for idx, count in enumerate(counts):
        start = min_value + idx * bin_width
        end = start + bin_width
        bins.append(
            {
                "start": start,
                "end": end,
                "center": (start + end) / 2,
                "count": float(count),
            }
        )

    return bins


def _build_payload(
    service,
    result_set_id: int,
    story_orders: Dict[str, int],
    directions,
    max_points: List[Dict[str, Any]],
    min_points: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    if not max_points and not min_points:
        return None

    story_names_excel_order = sorted(story_orders.keys(), key=lambda s: (story_orders[s], s))
    stories = list(reversed(story_names_excel_order))
    story_index = {name: idx for idx, name in enumerate(stories)}

    for point in max_points:
        point["story_index"] = story_index.get(point["story"], 0)
    for point in min_points:
        point["story_index"] = story_index.get(point["story"], 0)

    histogram_values = [p["rotation"] for p in max_points] + [p["rotation"] for p in min_points]

    return {
        "meta": {
            "result_type": "AllColumnRotations",
            "result_set_id": result_set_id,
            "unit": service._build_meta("ColumnRotations", None, result_set_id).unit,
            "x_label": "Column Rotation (%)",
        },
        "stories": stories,
        "directions": sorted(directions),
        "max_points": max_points,
        "min_points": min_points,
        "histogram_bins": _build_histogram_bins(histogram_values),
    }


def _build_from_cache(service, result_set_id: int) -> Optional[Dict[str, Any]]:
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
        story_order = (
            entry.story_sort_order
            if entry.story_sort_order is not None
            else (entry.story.sort_order if entry.story.sort_order is not None else 0)
        )
        if story_name not in story_orders or story_order < story_orders[story_name]:
            story_orders[story_name] = int(story_order)

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

    return _build_payload(
        service=service,
        result_set_id=result_set_id,
        story_orders=story_orders,
        directions=directions,
        max_points=max_points,
        min_points=min_points,
    )


def get_column_rotations_plot_data(service, result_set_id: int) -> Optional[Dict[str, Any]]:
    records = list(_get_column_records(service, result_set_id))
    if not records:
        # Fallback for datasets where raw rows are unavailable but element cache exists.
        return _build_from_cache(service, result_set_id)

    story_orders: Dict[str, int] = {}
    directions = set()
    max_points: List[Dict[str, Any]] = []
    min_points: List[Dict[str, Any]] = []

    for record in records:
        story_name = record.story.name
        story_order = (
            record.story_sort_order
            if record.story_sort_order is not None
            else (record.story.sort_order if record.story.sort_order is not None else 0)
        )
        if story_name not in story_orders or story_order < story_orders[story_name]:
            story_orders[story_name] = int(story_order)

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

    return _build_payload(
        service=service,
        result_set_id=result_set_id,
        story_orders=story_orders,
        directions=directions,
        max_points=max_points,
        min_points=min_points,
    )
