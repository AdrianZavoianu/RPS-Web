"""Provider functions for all-quad rotation plot datasets."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from django.db.models import Q

from apps.projects.models import Story
from apps.results.models import QuadRotation

PLOT_BINS = 50


def _get_project_story_order(project) -> Dict[str, int]:
    """Build story name → sort_order map from the project's Story table."""
    return {
        s.name: (s.sort_order if s.sort_order is not None else 0)
        for s in Story.objects.filter(project=project)
    }


def _get_quad_records(service, result_set_id: int):
    return (
        QuadRotation.objects.filter(story__project=service.project)
        .filter(
            Q(result_category__result_set_id=result_set_id)
            | Q(result_category__result_set__isnull=True)
        )
        .select_related("story", "load_case", "element")
        .order_by("story__sort_order", "element__name", "load_case__name", "id")
    )


def _resolve_rotation_candidates(record: QuadRotation) -> List[Tuple[str, float]]:
    """Resolve max/min candidates. Max is always positive, min always negative."""
    candidates: List[Tuple[str, float]] = []

    if record.max_rotation is not None:
        candidates.append(("max", abs(record.max_rotation)))
    if record.min_rotation is not None:
        candidates.append(("min", -abs(record.min_rotation)))

    if not candidates and record.rotation is not None:
        candidates.append(("max", abs(record.rotation)))
        candidates.append(("min", -abs(record.rotation)))

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


def get_quad_rotations_plot_data(
    service,
    result_set_id: int,
) -> Optional[Dict[str, Any]]:
    """Get all-quad rotations scatter/histogram data."""
    records = list(_get_quad_records(service, result_set_id))
    if not records:
        return None

    # Use project-level story ordering (same as columns) instead of
    # potentially inconsistent quad sheet ordering.
    story_orders = _get_project_story_order(service.project)

    directions = set()
    stories_with_data: set[str] = set()
    max_points: List[Dict[str, Any]] = []
    min_points: List[Dict[str, Any]] = []

    for record in records:
        story_name = record.story.name
        stories_with_data.add(story_name)

        direction = (record.direction or "").strip() or "Pier"
        directions.add(direction)

        for step_type, raw_value in _resolve_rotation_candidates(record):
            display_rotation = service._apply_multiplier(raw_value, "QuadRotations")

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

    if not max_points and not min_points:
        return None

    # Only include stories that have quad data (excludes Base).
    story_names_excel_order = sorted(
        (s for s in story_orders if s in stories_with_data),
        key=lambda s: (story_orders[s], s),
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

    return {
        "meta": {
            "result_type": "AllQuadRotations",
            "result_set_id": result_set_id,
            "unit": service._build_meta("QuadRotations", None, result_set_id).unit,
            "x_label": "Quad Rotation (%)",
        },
        "stories": stories,
        "directions": sorted(directions),
        "max_points": max_points,
        "min_points": min_points,
        "histogram_bins": _build_histogram_bins(histogram_values),
    }
