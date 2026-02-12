"""Provider functions for beam rotation plot/table datasets."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from django.db.models import Q

from apps.results.models import BeamRotation

from .common import sort_load_case_columns

PLOT_BINS = 50
FIXED_COLUMNS = [
    "Story",
    "Step Type",
    "Frame/Wall",
    "Unique Name",
    "Hinge",
    "Generated Hinge",
    "Rel Dist",
]
SUMMARY_COLUMNS = ["Avg", "Max", "Min"]


def _get_beam_records(service, result_set_id: int):
    return (
        BeamRotation.objects.filter(story__project=service.project)
        .filter(
            Q(result_category__result_set_id=result_set_id)
            | Q(result_category__result_set__isnull=True)
        )
        .select_related("story", "load_case", "element")
        .order_by("story_sort_order", "element__name", "load_case__name", "id")
    )


def _resolve_rotation_candidates(record: BeamRotation) -> List[Tuple[str, float]]:
    """Resolve max/min rotation candidates with desktop-compatible fallback behavior.

    When step_type is explicitly set in the source data, trust it directly
    (matching desktop behaviour) instead of reclassifying by sign.
    """
    step_type = (record.step_type or "").strip().lower()

    # Explicit step_type from source – trust it as-is.
    if step_type in {"max", "min"} and record.r3_plastic is not None:
        return [(step_type, record.r3_plastic)]

    candidates: List[Tuple[str, float]] = []

    if record.max_r3_plastic is not None:
        candidates.append(("max", record.max_r3_plastic))
    if record.min_r3_plastic is not None:
        candidates.append(("min", record.min_r3_plastic))

    # Legacy imports may only contain a single value without step type.
    # Infer branch by sign so Min stays negative and Max positive when possible.
    if not candidates and record.r3_plastic is not None:
        if record.r3_plastic < 0:
            candidates.append(("min", record.r3_plastic))
        elif record.r3_plastic > 0:
            candidates.append(("max", record.r3_plastic))
        else:
            candidates.append(("max", record.r3_plastic))
            candidates.append(("min", record.r3_plastic))

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


def _normalize_step_type(step_type: Optional[str]) -> str:
    raw = (step_type or "").strip()
    normalized = raw.lower()
    if normalized in {"nan", "none"}:
        return ""
    if normalized in {"max", "min"}:
        return normalized.title()
    return raw


def get_beam_rotations_plot_data(service, result_set_id: int) -> Optional[Dict[str, Any]]:
    records = list(_get_beam_records(service, result_set_id))
    if not records:
        return None

    story_orders: Dict[str, int] = {}
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

        for step_type, raw_value in _resolve_rotation_candidates(record):
            display_rotation = service._apply_multiplier(raw_value, "BeamRotations")

            point = {
                "element": record.element.name,
                "story": story_name,
                "load_case": record.load_case.name,
                "rotation": display_rotation,
            }
            if step_type == "min":
                min_points.append(point)
            else:
                max_points.append(point)

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
            "result_type": "AllBeamRotations",
            "result_set_id": result_set_id,
            "unit": service._build_meta("BeamRotations", None, result_set_id).unit,
            "x_label": "R3 Plastic Rotation (%)",
        },
        "stories": stories,
        "max_points": max_points,
        "min_points": min_points,
        "histogram_bins": _build_histogram_bins(histogram_values),
    }


def get_beam_rotations_table_data(service, result_set_id: int) -> Optional[Dict[str, Any]]:
    records = list(_get_beam_records(service, result_set_id))
    if not records:
        return None

    rows_map: Dict[Tuple[str, str, str, str, str, str, float], Dict[str, Any]] = {}
    row_sort_order: Dict[Tuple[str, str, str, str, str, str, float], int] = {}
    load_cases = set()

    for record in records:
        story_name = record.story.name
        raw_rotation = record.r3_plastic
        step_type = _normalize_step_type(record.step_type)
        # Only infer step_type from sign when the source didn't provide one.
        if raw_rotation is not None and step_type == "":
            if raw_rotation < 0:
                step_type = "Min"
            elif raw_rotation > 0:
                step_type = "Max"
        frame_name = record.element.name
        unique_name = record.element.unique_name or frame_name
        hinge = record.hinge or ""
        generated_hinge = record.generated_hinge or ""
        rel_dist = float(record.rel_dist or 0.0)

        key = (
            story_name,
            step_type,
            frame_name,
            unique_name,
            hinge,
            generated_hinge,
            rel_dist,
        )
        row = rows_map.setdefault(
            key,
            {
                "Story": story_name,
                "Step Type": step_type,
                "Frame/Wall": frame_name,
                "Unique Name": unique_name,
                "Hinge": hinge,
                "Generated Hinge": generated_hinge,
                "Rel Dist": rel_dist,
            },
        )

        incoming_sort = (
            record.story_sort_order
            if record.story_sort_order is not None
            else (record.story.sort_order if record.story.sort_order is not None else 0)
        )
        if key not in row_sort_order:
            row_sort_order[key] = int(incoming_sort)
        else:
            row_sort_order[key] = min(row_sort_order[key], int(incoming_sort))

        load_case_name = record.load_case.name
        load_cases.add(load_case_name)

        if raw_rotation is None:
            continue

        display_rotation = service._apply_multiplier(raw_rotation, "BeamRotations")

        row[load_case_name] = display_rotation

    load_case_columns = sort_load_case_columns(list(load_cases))
    rows = []

    for key, row in rows_map.items():
        numeric_values = [
            float(row[load_case]) for load_case in load_case_columns if isinstance(row.get(load_case), (int, float))
        ]
        if numeric_values:
            row["Avg"] = sum(numeric_values) / len(numeric_values)
            row["Max"] = max(numeric_values)
            row["Min"] = min(numeric_values)
        rows.append((row_sort_order.get(key, 0), row))

    step_order = {"Max": 0, "Min": 1, "": 2}
    rows.sort(
        key=lambda item: (
            item[0],
            item[1]["Frame/Wall"],
            item[1]["Generated Hinge"],
            item[1]["Rel Dist"],
            step_order.get(str(item[1].get("Step Type", "")), 3),
        )
    )
    ordered_rows = [row for _, row in rows]
    summary_columns = SUMMARY_COLUMNS if any("Avg" in row for row in ordered_rows) else []

    return {
        "meta": {
            "result_type": "BeamRotationsTable",
            "result_set_id": result_set_id,
            "unit": service._build_meta("BeamRotations", None, result_set_id).unit,
        },
        "columns": FIXED_COLUMNS + load_case_columns + summary_columns,
        "rows": ordered_rows,
        "fixed_columns": FIXED_COLUMNS,
        "load_case_columns": load_case_columns,
        "summary_columns": summary_columns,
    }
