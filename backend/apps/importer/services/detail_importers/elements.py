"""Detailed importers for element-focused source sheets."""

from typing import Any, Dict, List, Set

from apps.results.models import (
    BeamRotation,
    ColumnAxial,
    ColumnRotation,
    ColumnShear,
    QuadRotation,
    WallShear,
)

from ..bulk_writes import bulk_create_strict
from ..import_context import ImportContext
from ..utils import to_float


def _column_values(
    df: Any,
    primary: str,
    *,
    fallback: str | None = None,
    default: Any = None,
) -> Any:
    """Return zero-copy column values when present, else a per-row default list."""
    if primary in df.columns:
        return df[primary].to_numpy(copy=False)
    if fallback is not None and fallback in df.columns:
        return df[fallback].to_numpy(copy=False)
    return [default] * len(df)


def import_wall_shears(
    context: ImportContext,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    piers: List[str],
    allowed_load_cases: Set[str],
):
    """Import wall/pier shear force data from Pier Forces sheet."""
    del load_cases, piers  # kept in signature for call-site parity

    if df.empty:
        return

    shear_stats: Dict[tuple, Dict[str, float]] = {}

    output_cases = _column_values(df, "Output Case", fallback="OutputCase")
    locations = _column_values(df, "Location", default="Bottom")
    stories = _column_values(df, "Story")
    piers_col = _column_values(df, "Pier")
    v2_values = _column_values(df, "V2")
    v3_values = _column_values(df, "V3")

    for case_name, location_raw, story_name, pier_name, v2_raw, v3_raw in zip(
        output_cases,
        locations,
        stories,
        piers_col,
        v2_values,
        v3_values,
    ):
        if case_name not in allowed_load_cases:
            continue

        location = str(location_raw or "").strip().lower()
        if location != "bottom":
            continue
        if not story_name or not pier_name:
            continue

        for direction, raw_value in (("V2", v2_raw), ("V3", v3_raw)):
            value = to_float(raw_value)
            if value is None:
                continue

            key = (story_name, pier_name, case_name, direction)
            current = shear_stats.get(key)
            if current is None:
                shear_stats[key] = {
                    "max": value,
                    "min": value,
                    "abs_max": abs(value),
                }
                continue

            current["max"] = max(current["max"], value)
            current["min"] = min(current["min"], value)
            current["abs_max"] = max(current["abs_max"], abs(value))

    objects_to_create = []
    for (story_name, pier_name, case_name, direction), stats in shear_stats.items():
        sort_order = story_index.get(story_name, 0)
        story = context.get_or_create_story(story_name, sort_order)
        load_case = context.get_or_create_load_case(case_name)
        element = context.get_or_create_element(
            element_type="Wall",
            name=pier_name,
            unique_name=pier_name,
            story=story,
        )

        objects_to_create.append(
            WallShear(
                element=element,
                story=story,
                load_case=load_case,
                result_category=context.result_category,
                direction=direction,
                location="Bottom",
                story_sort_order=sort_order,
                force=stats["abs_max"],
                max_force=stats["max"],
                min_force=stats["min"],
            )
        )

    if objects_to_create:
        bulk_create_strict(
            WallShear,
            objects_to_create,
            context="wall shears import",
            key_builder=lambda row: (
                row.element_id,
                row.story_id,
                row.load_case_id,
                row.result_category_id,
                row.direction,
                row.location,
            ),
        )


def import_quad_rotations(
    context: ImportContext,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    piers: List[str],
    allowed_load_cases: Set[str],
):
    """Import quad strain gauge rotation data."""
    del load_cases, piers  # kept in signature for call-site parity

    if df.empty or not allowed_load_cases:
        return

    # Merge Max/Min step-type rows into one record per unique key.
    merged: Dict[tuple, dict] = {}

    output_cases = _column_values(df, "Output Case")
    stories = _column_values(df, "Story")
    quad_names = _column_values(df, "Name", default="")
    property_names = _column_values(df, "PropertyName", default="")
    directions = _column_values(df, "Direction", default="Pier")
    step_types = _column_values(df, "Step Type", fallback="StepType", default="")
    max_rotations = _column_values(df, "MaxRotation")
    min_rotations = _column_values(df, "MinRotation")
    rotations = _column_values(df, "Rotation")

    for (
        case_name,
        story_name,
        quad_name,
        property_name,
        direction,
        step_type_raw,
        max_rotation_raw,
        min_rotation_raw,
        rotation_raw,
    ) in zip(
        output_cases,
        stories,
        quad_names,
        property_names,
        directions,
        step_types,
        max_rotations,
        min_rotations,
        rotations,
    ):
        if case_name not in allowed_load_cases:
            continue

        normalized_step_type = str(step_type_raw).strip().lower()
        if normalized_step_type in {"nan", "none"}:
            normalized_step_type = ""
        if normalized_step_type not in {"max", "min"}:
            if normalized_step_type != "":
                continue

        if not story_name or not property_name:
            continue

        sort_order = story_index.get(story_name, 0)
        story = context.get_or_create_story(story_name, sort_order)
        load_case = context.get_or_create_load_case(case_name)
        element = context.get_or_create_element(
            element_type="Quad",
            name=property_name,
            unique_name=property_name,
            story=story,
        )

        max_rotation = to_float(max_rotation_raw)
        min_rotation = to_float(min_rotation_raw)
        rotation = to_float(rotation_raw)

        direction_str = str(direction or "Pier")
        key = (element.id, story.id, load_case.id, context.result_category.id,
               str(quad_name), direction_str)

        if key not in merged:
            merged[key] = {
                "element": element,
                "story": story,
                "load_case": load_case,
                "quad_name": str(quad_name),
                "direction": direction_str,
                "sort_order": sort_order,
                "max_rotation": None,
                "min_rotation": None,
                "rotation": None,
            }

        entry = merged[key]
        if max_rotation is not None:
            entry["max_rotation"] = max_rotation
        if min_rotation is not None:
            entry["min_rotation"] = min_rotation

        if normalized_step_type == "max" and rotation is not None:
            entry["max_rotation"] = entry["max_rotation"] or rotation
            if entry["rotation"] is None:
                entry["rotation"] = rotation
        elif normalized_step_type == "min" and rotation is not None:
            entry["min_rotation"] = entry["min_rotation"] or rotation
            if entry["rotation"] is None:
                entry["rotation"] = rotation
        elif rotation is not None:
            entry["rotation"] = rotation

    objects_to_create = []
    for entry in merged.values():
        rotation = entry["rotation"]
        if rotation is None:
            rotation = entry["max_rotation"] if entry["max_rotation"] is not None else entry["min_rotation"]
        if rotation is None:
            continue

        objects_to_create.append(
            QuadRotation(
                element=entry["element"],
                story=entry["story"],
                load_case=entry["load_case"],
                result_category=context.result_category,
                quad_name=entry["quad_name"],
                direction=entry["direction"],
                story_sort_order=entry["sort_order"],
                rotation=rotation,
                max_rotation=entry["max_rotation"],
                min_rotation=entry["min_rotation"],
            )
        )

    if objects_to_create:
        bulk_create_strict(
            QuadRotation,
            objects_to_create,
            context="quad rotations import",
            key_builder=lambda row: (
                row.element_id,
                row.story_id,
                row.load_case_id,
                row.result_category_id,
                row.quad_name,
                row.direction,
            ),
        )


def import_column_forces(
    context: ImportContext,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    columns: List[str],
    allowed_load_cases: Set[str],
):
    """Import column shear and axial force data from Element Forces - Columns sheet."""
    del load_cases, columns  # kept in signature for call-site parity

    if df.empty:
        return

    shear_stats: Dict[tuple, Dict[str, float | str]] = {}
    axial_stats: Dict[tuple, Dict[str, float | str]] = {}

    output_cases = _column_values(df, "Output Case", fallback="OutputCase")
    stories = _column_values(df, "Story")
    columns_col = _column_values(df, "Column")
    unique_names = _column_values(df, "Unique Name", fallback="UniqueName", default="")
    locations = _column_values(df, "Location", default="")
    v2_values = _column_values(df, "V2")
    v3_values = _column_values(df, "V3")
    axial_values = _column_values(df, "P")

    for (
        case_name,
        story_name,
        column_name,
        unique_name,
        location_value,
        v2_raw,
        v3_raw,
        axial_raw,
    ) in zip(
        output_cases,
        stories,
        columns_col,
        unique_names,
        locations,
        v2_values,
        v3_values,
        axial_values,
    ):
        if case_name not in allowed_load_cases:
            continue
        if not story_name or not column_name:
            continue

        raw_location = str(location_value).strip() if location_value is not None else ""
        location = raw_location if raw_location in {"Top", "Bottom"} else ""
        normalized_unique_name = unique_name if unique_name else column_name

        for direction, shear_raw in (("V2", v2_raw), ("V3", v3_raw)):
            value = to_float(shear_raw)
            if value is None:
                continue

            shear_key = (
                story_name,
                column_name,
                normalized_unique_name,
                case_name,
                direction,
            )
            current_shear = shear_stats.get(shear_key)
            if current_shear is None:
                shear_stats[shear_key] = {
                    "max": value,
                    "min": value,
                    "abs_max": abs(value),
                    "location": location,
                }
                continue

            current_shear["max"] = max(float(current_shear["max"]), value)
            current_shear["min"] = min(float(current_shear["min"]), value)
            current_shear["abs_max"] = max(float(current_shear["abs_max"]), abs(value))

        axial_value = to_float(axial_raw)
        if axial_value is None:
            continue

        axial_key = (story_name, column_name, normalized_unique_name, case_name)
        current_axial = axial_stats.get(axial_key)
        if current_axial is None:
            axial_stats[axial_key] = {
                "min": axial_value,
                "max": axial_value,
                "location": location,
            }
            continue

        current_axial["min"] = min(float(current_axial["min"]), axial_value)
        current_axial["max"] = max(float(current_axial["max"]), axial_value)

    shear_objects = []
    for (story_name, column_name, _unique_name, case_name, direction), stats in shear_stats.items():
        sort_order = story_index.get(story_name, 0)
        story = context.get_or_create_story(story_name, sort_order)
        load_case = context.get_or_create_load_case(case_name)
        element = context.get_or_create_element(
            element_type="Column",
            name=column_name,
            unique_name=column_name,
            story=story,
        )

        shear_objects.append(
            ColumnShear(
                element=element,
                story=story,
                load_case=load_case,
                result_category=context.result_category,
                direction=direction,
                location=str(stats.get("location", "")),
                story_sort_order=sort_order,
                force=float(stats["abs_max"]),
                max_force=float(stats["max"]),
                min_force=float(stats["min"]),
            )
        )

    axial_objects = []
    for (story_name, column_name, _unique_name, case_name), stats in axial_stats.items():
        sort_order = story_index.get(story_name, 0)
        story = context.get_or_create_story(story_name, sort_order)
        load_case = context.get_or_create_load_case(case_name)
        element = context.get_or_create_element(
            element_type="Column",
            name=column_name,
            unique_name=column_name,
            story=story,
        )

        axial_objects.append(
            ColumnAxial(
                element=element,
                story=story,
                load_case=load_case,
                result_category=context.result_category,
                location=str(stats.get("location", "")),
                story_sort_order=sort_order,
                min_axial=float(stats["min"]),
                max_axial=float(stats["max"]),
            )
        )

    if shear_objects:
        bulk_create_strict(
            ColumnShear,
            shear_objects,
            context="column shears import",
            key_builder=lambda row: (
                row.element_id,
                row.story_id,
                row.load_case_id,
                row.result_category_id,
                row.direction,
                row.location,
            ),
        )
    if axial_objects:
        bulk_create_strict(
            ColumnAxial,
            axial_objects,
            context="column axials import",
            key_builder=lambda row: (
                row.element_id,
                row.story_id,
                row.load_case_id,
                row.result_category_id,
                row.location,
            ),
        )


def import_column_rotations(
    context: ImportContext,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    columns: List[str],
    allowed_load_cases: Set[str],
):
    """Import column fiber hinge rotation data."""
    del load_cases, columns  # kept in signature for call-site parity

    if df.empty:
        return

    rotation_stats: Dict[tuple, Dict[str, float]] = {}
    for case_name, story_name, column_name, unique_name, r2_raw, r3_raw in df[
        ["Output Case", "Story", "Frame/Wall", "Unique Name", "R2", "R3"]
    ].itertuples(index=False, name=None):
        if case_name not in allowed_load_cases:
            continue
        if not story_name or not column_name:
            continue

        normalized_unique_name = unique_name if unique_name else column_name
        for direction, raw_value in (("R2", r2_raw), ("R3", r3_raw)):
            value = to_float(raw_value)
            if value is None:
                continue

            key = (story_name, column_name, normalized_unique_name, case_name, direction)
            current = rotation_stats.get(key)
            if current is None:
                rotation_stats[key] = {
                    "max": value,
                    "min": value,
                    "abs_max": abs(value),
                }
                continue

            current["max"] = max(current["max"], value)
            current["min"] = min(current["min"], value)
            current["abs_max"] = max(current["abs_max"], abs(value))

    objects_to_create = []
    for (
        story_name,
        column_name,
        _unique_name,
        case_name,
        direction,
    ), stats in rotation_stats.items():
        sort_order = story_index.get(story_name, 0)
        story = context.get_or_create_story(story_name, sort_order)
        load_case = context.get_or_create_load_case(case_name)
        element = context.get_or_create_element(
            element_type="Column",
            name=column_name,
            unique_name=column_name,
            story=story,
        )

        objects_to_create.append(
            ColumnRotation(
                element=element,
                story=story,
                load_case=load_case,
                result_category=context.result_category,
                direction=direction,
                story_sort_order=sort_order,
                rotation=stats["abs_max"],
                max_rotation=stats["max"],
                min_rotation=stats["min"],
            )
        )

    if objects_to_create:
        bulk_create_strict(
            ColumnRotation,
            objects_to_create,
            context="column rotations import",
            key_builder=lambda row: (
                row.element_id,
                row.story_id,
                row.load_case_id,
                row.result_category_id,
                row.direction,
            ),
        )


def import_beam_rotations(
    context: ImportContext,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    beams: List[str],
    allowed_load_cases: Set[str],
):
    """Import beam hinge rotation data."""
    del load_cases, beams  # kept in signature for call-site parity

    if df.empty or not allowed_load_cases:
        return

    objects_to_create = []

    output_cases = _column_values(df, "Output Case", fallback="OutputCase")
    stories = _column_values(df, "Story")
    beam_names = _column_values(df, "Frame/Wall", fallback="FrameWall", default="")
    unique_names = _column_values(df, "Unique Name", fallback="UniqueName")
    step_types = _column_values(df, "Step Type", fallback="StepType", default="")
    hinges = _column_values(df, "Hinge", default="")
    generated_hinges = _column_values(
        df,
        "Generated Hinge",
        fallback="GeneratedHinge",
        default="",
    )
    rel_distances = _column_values(df, "Rel Dist", fallback="RelDist")
    r3_plastics = _column_values(df, "R3 Plastic", fallback="R3Plastic")

    for (
        case_name,
        story_name,
        beam_name,
        unique_name_raw,
        step_type_raw,
        hinge,
        generated_hinge,
        rel_dist,
        r3_plastic_raw,
    ) in zip(
        output_cases,
        stories,
        beam_names,
        unique_names,
        step_types,
        hinges,
        generated_hinges,
        rel_distances,
        r3_plastics,
    ):
        if case_name not in allowed_load_cases:
            continue

        unique_name = unique_name_raw if unique_name_raw else beam_name
        step_type_normalized = str(step_type_raw).strip().lower()
        if step_type_normalized in {"nan", "none"}:
            step_type_normalized = ""

        if step_type_normalized in {"max", "min"}:
            step_type = step_type_normalized.title()
        elif step_type_normalized == "":
            step_type = ""
        else:
            # Preserve non-standard step labels instead of dropping source rows.
            step_type = str(step_type_raw).strip()

        sort_order = story_index.get(story_name, 0)
        story = context.get_or_create_story(story_name, sort_order)
        load_case = context.get_or_create_load_case(case_name)
        element = context.get_or_create_element(
            element_type="Beam",
            name=beam_name,
            unique_name=unique_name,
            story=story,
        )

        if r3_plastic_raw is None:
            continue
        try:
            r3_plastic = float(r3_plastic_raw)
        except (TypeError, ValueError):
            continue
        objects_to_create.append(
            BeamRotation(
                element=element,
                story=story,
                load_case=load_case,
                result_category=context.result_category,
                step_type=step_type,
                hinge=str(hinge) if hinge else "",
                generated_hinge=str(generated_hinge) if generated_hinge else "",
                rel_dist=rel_dist,
                story_sort_order=sort_order,
                r3_plastic=r3_plastic,
            )
        )

    if objects_to_create:
        bulk_create_strict(
            BeamRotation,
            objects_to_create,
            context="beam rotations import",
            key_builder=lambda row: (
                row.element_id,
                row.story_id,
                row.load_case_id,
                row.result_category_id,
                row.step_type,
                row.hinge,
                row.generated_hinge,
                row.rel_dist,
            ),
        )
