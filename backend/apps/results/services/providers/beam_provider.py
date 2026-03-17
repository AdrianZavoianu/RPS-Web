"""Provider functions for beam rotation plot/table datasets."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple

if TYPE_CHECKING:
    from ..result_service import ResultDataService

from django.db.models import Q

from apps.results.data import ElementResultsCacheRepository
from apps.results.models import BeamRotation

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


def _get_beam_records(service: ResultDataService, result_set_id: int):
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


def _normalize_step_type(step_type: Optional[str]) -> str:
    raw = (step_type or "").strip()
    normalized = raw.lower()
    if normalized in {"nan", "none"}:
        return ""
    if normalized in {"max", "min"}:
        return normalized.title()
    return raw


def _build_beam_rotations_table_data_from_cache(service: ResultDataService, result_set_id: int) -> Optional[Dict[str, Any]]:
    cache_entries = ElementResultsCacheRepository.list_entries_for_types(
        service.project,
        result_set_id=result_set_id,
        result_types=["BeamRotations_R3Plastic"],
    )
    if not cache_entries:
        return None

    rows: list[tuple[int, dict[str, Any]]] = []
    load_case_set = set()

    for entry in cache_entries:
        row = {
            "Story": entry.story.name,
            "Step Type": "",
            "Frame/Wall": entry.element.name,
            "Unique Name": entry.element.unique_name or entry.element.name,
            "Hinge": "",
            "Generated Hinge": "",
            "Rel Dist": 0.0,
        }

        values, lc_names = build_cache_row_values(entry, service, "BeamRotations")
        row.update(values)
        load_case_set.update(lc_names)

        apply_cache_summary(row, entry, service, "BeamRotations")

        rows.append((resolve_story_sort_order(entry), row))

    load_case_columns = sort_load_case_columns(list(load_case_set))
    rows.sort(
        key=lambda item: (
            item[0],
            item[1]["Frame/Wall"],
            item[1]["Generated Hinge"],
            item[1]["Rel Dist"],
        )
    )
    ordered_rows = [row for _, row in rows]

    return serialize_rotation_table_payload(
        service=service,
        result_set_id=result_set_id,
        rows=ordered_rows,
        load_case_columns=load_case_columns,
        fixed_columns=FIXED_COLUMNS,
        summary_columns=SUMMARY_COLUMNS,
        result_type_key="BeamRotations",
        table_result_type="BeamRotationsTable",
    )


def _build_beam_rotations_table_data_from_raw(service: ResultDataService, result_set_id: int) -> Optional[Dict[str, Any]]:
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

        incoming_sort = resolve_story_sort_order(record)
        if key not in row_sort_order:
            row_sort_order[key] = incoming_sort
        else:
            row_sort_order[key] = min(row_sort_order[key], incoming_sort)

        load_case_name = record.load_case.name
        load_cases.add(load_case_name)

        if raw_rotation is None:
            continue

        display_rotation = service._apply_multiplier(raw_rotation, "BeamRotations")
        row[load_case_name] = display_rotation

    load_case_columns = sort_load_case_columns(list(load_cases))
    rows = []

    for key, row in rows_map.items():
        compute_summary_stats(row, load_case_columns)
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

    return serialize_rotation_table_payload(
        service=service,
        result_set_id=result_set_id,
        rows=ordered_rows,
        load_case_columns=load_case_columns,
        fixed_columns=FIXED_COLUMNS,
        summary_columns=SUMMARY_COLUMNS,
        result_type_key="BeamRotations",
        table_result_type="BeamRotationsTable",
    )


def get_beam_rotations_plot_data(service: ResultDataService, result_set_id: int) -> Optional[Dict[str, Any]]:
    records = list(_get_beam_records(service, result_set_id))
    if not records:
        return None

    story_orders: Dict[str, int] = {}
    max_points: List[Dict[str, Any]] = []
    min_points: List[Dict[str, Any]] = []

    for record in records:
        story_name = record.story.name
        story_order = resolve_story_sort_order(record)
        if story_name not in story_orders or story_order < story_orders[story_name]:
            story_orders[story_name] = story_order

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

    return build_rotation_plot_payload(
        service=service,
        result_set_id=result_set_id,
        story_orders=story_orders,
        max_points=max_points,
        min_points=min_points,
        result_type_key="BeamRotations",
        meta_result_type="AllBeamRotations",
        x_label="R3 Plastic Rotation (%)",
    )


def get_beam_rotations_table_data(
    service: ResultDataService,
    result_set_id: int,
    *,
    fallback_policy: str = FALLBACK_CACHE_ONLY,
) -> Optional[Dict[str, Any]]:
    selected = resolve_fallback(
        fallback_policy=fallback_policy,
        cache_loader=lambda: _build_beam_rotations_table_data_from_cache(service, result_set_id),
        raw_loader=lambda: _build_beam_rotations_table_data_from_raw(service, result_set_id),
        has_data=lambda payload: bool(payload and payload.get("rows")),
    )
    return selected.data
