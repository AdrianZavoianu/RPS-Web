"""Detailed NLTHA importers for element and joint result sheets."""

from typing import Dict, List, Optional, Set

from apps.projects.models import Element, Project, Story
from apps.results.models import (
    BeamRotation,
    ColumnAxial,
    ColumnRotation,
    ColumnShear,
    QuadRotation,
    ResultCategory,
    ResultSet,
    SoilPressure,
    VerticalDisplacement,
    WallShear,
)

from .bulk_writes import bulk_create_strict
from .global_result_importers import (
    get_or_create_load_case as _get_or_create_load_case,
    get_or_create_story as _get_or_create_story,
)


def _to_float(value) -> Optional[float]:
    """Convert incoming sheet values to float, returning None for invalid/NaN."""
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed != parsed:  # NaN check
        return None
    return parsed


def _get_or_create_element(
    project: Project,
    element_type: str,
    name: str,
    unique_name: str,
    story: Optional[Story],
    elements_map: Dict,
) -> Element:
    """Get or create an Element, using cache."""
    cache_key = (element_type, unique_name)
    if cache_key in elements_map:
        return elements_map[cache_key]

    element, _created = Element.objects.get_or_create(
        project=project,
        element_type=element_type,
        unique_name=unique_name,
        defaults={
            "name": name,
            "story": story,
        },
    )
    elements_map[cache_key] = element
    return element


def import_wall_shears(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    piers: List[str],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
    elements_map: Dict,
):
    """Import wall/pier shear force data from Pier Forces sheet."""
    del result_set, load_cases, piers  # kept in signature for call-site parity

    if df.empty:
        return

    # Desktop parity: use Bottom location only and aggregate per story/pier/load case.
    shear_stats: Dict[tuple, Dict[str, float]] = {}

    for _, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        location = str(row.get("Location", "")).strip().lower()
        if location != "bottom":
            continue

        story_name = row.get("Story")
        pier_name = row.get("Pier")
        if not story_name or not pier_name:
            continue

        for direction in ("V2", "V3"):
            value = _to_float(row.get(direction))
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
        story = _get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = _get_or_create_load_case(project, case_name, load_cases_map)
        element = _get_or_create_element(project, "Wall", pier_name, pier_name, story, elements_map)

        objects_to_create.append(
            WallShear(
                element=element,
                story=story,
                load_case=load_case,
                result_category=result_category,
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
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    piers: List[str],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
    elements_map: Dict,
):
    """Import quad strain gauge rotation data."""
    del result_set, load_cases, piers  # kept in signature for call-site parity

    if df.empty:
        return

    objects_to_create = []

    for _, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        story_name = row.get("Story")
        quad_name = row.get("Name", "")
        property_name = row.get("PropertyName", "")
        direction = row.get("Direction", "Pier")
        step_type_raw = row.get("Step Type", row.get("StepType", ""))
        normalized_step_type = str(step_type_raw).strip().lower()
        if normalized_step_type in {"nan", "none"}:
            normalized_step_type = ""
        if normalized_step_type not in {"max", "min"}:
            # Preserve backward compatibility for legacy rows with blank step type.
            if normalized_step_type != "":
                continue

        if not story_name or not property_name:
            continue

        sort_order = story_index.get(story_name, 0)
        story = _get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = _get_or_create_load_case(project, case_name, load_cases_map)
        element = _get_or_create_element(
            project, "Quad", property_name, property_name, story, elements_map
        )

        max_rotation = _to_float(row.get("MaxRotation"))
        min_rotation = _to_float(row.get("MinRotation"))
        rotation = _to_float(row.get("Rotation"))
        if rotation is None:
            if normalized_step_type == "max":
                rotation = max_rotation
            elif normalized_step_type == "min":
                rotation = min_rotation
            else:
                rotation = max_rotation if max_rotation is not None else min_rotation
        if rotation is None:
            continue

        objects_to_create.append(
            QuadRotation(
                element=element,
                story=story,
                load_case=load_case,
                result_category=result_category,
                quad_name=str(quad_name),
                direction=str(direction or "Pier"),
                story_sort_order=sort_order,
                rotation=rotation,
                max_rotation=max_rotation,
                min_rotation=min_rotation,
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
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    columns: List[str],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
    elements_map: Dict,
):
    """Import column shear and axial force data from Element Forces - Columns sheet."""
    del result_set, load_cases, columns  # kept in signature for call-site parity

    if df.empty:
        return

    # Desktop parity: aggregate per story/column/case and keep max/min envelopes.
    shear_stats: Dict[tuple, Dict[str, float]] = {}
    axial_stats: Dict[tuple, Dict[str, float]] = {}

    for _, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        story_name = row.get("Story")
        column_name = row.get("Column", "")
        unique_name = row.get("Unique Name", column_name)
        location_value = row.get("Location", None)
        raw_location = str(location_value).strip() if location_value is not None else ""
        location = raw_location if raw_location in {"Top", "Bottom"} else ""
        if not story_name or not column_name:
            continue

        for direction in ("V2", "V3"):
            value = _to_float(row.get(direction))
            if value is None:
                continue

            shear_key = (story_name, column_name, unique_name, case_name, direction)
            current_shear = shear_stats.get(shear_key)
            if current_shear is None:
                shear_stats[shear_key] = {
                    "max": value,
                    "min": value,
                    "abs_max": abs(value),
                    "location": location,
                }
            else:
                current_shear["max"] = max(current_shear["max"], value)
                current_shear["min"] = min(current_shear["min"], value)
                current_shear["abs_max"] = max(current_shear["abs_max"], abs(value))

        axial_value = _to_float(row.get("P"))
        if axial_value is None:
            continue

        axial_key = (story_name, column_name, unique_name, case_name)
        current_axial = axial_stats.get(axial_key)
        if current_axial is None:
            axial_stats[axial_key] = {
                "min": axial_value,
                "max": axial_value,
                "location": location,
            }
        else:
            current_axial["min"] = min(current_axial["min"], axial_value)
            current_axial["max"] = max(current_axial["max"], axial_value)

    shear_objects = []
    for (story_name, column_name, _unique_name, case_name, direction), stats in shear_stats.items():
        sort_order = story_index.get(story_name, 0)
        story = _get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = _get_or_create_load_case(project, case_name, load_cases_map)
        element = _get_or_create_element(
            project, "Column", column_name, column_name, story, elements_map
        )

        shear_objects.append(
            ColumnShear(
                element=element,
                story=story,
                load_case=load_case,
                result_category=result_category,
                direction=direction,
                location=str(stats.get("location", "")),
                story_sort_order=sort_order,
                force=stats["abs_max"],
                max_force=stats["max"],
                min_force=stats["min"],
            )
        )

    axial_objects = []
    for (story_name, column_name, _unique_name, case_name), stats in axial_stats.items():
        sort_order = story_index.get(story_name, 0)
        story = _get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = _get_or_create_load_case(project, case_name, load_cases_map)
        element = _get_or_create_element(
            project, "Column", column_name, column_name, story, elements_map
        )

        axial_objects.append(
            ColumnAxial(
                element=element,
                story=story,
                load_case=load_case,
                result_category=result_category,
                location=str(stats.get("location", "")),
                story_sort_order=sort_order,
                min_axial=stats["min"],
                max_axial=stats["max"],
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
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    columns: List[str],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
    elements_map: Dict,
):
    """Import column fiber hinge rotation data."""
    del result_set, load_cases, columns  # kept in signature for call-site parity

    if df.empty:
        return

    # Desktop parity: aggregate Max/Min/absolute per story/column/case/direction.
    rotation_stats: Dict[tuple, Dict[str, float]] = {}

    for _, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        story_name = row.get("Story")
        column_name = row.get("Frame/Wall", "")
        unique_name = row.get("Unique Name", column_name)
        if not story_name or not column_name:
            continue

        for direction in ("R2", "R3"):
            value = _to_float(row.get(direction))
            if value is None:
                continue

            key = (story_name, column_name, unique_name, case_name, direction)
            current = rotation_stats.get(key)
            if current is None:
                rotation_stats[key] = {
                    "max": value,
                    "min": value,
                    "abs_max": abs(value),
                }
            else:
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
        story = _get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = _get_or_create_load_case(project, case_name, load_cases_map)
        element = _get_or_create_element(
            project, "Column", column_name, column_name, story, elements_map
        )

        objects_to_create.append(
            ColumnRotation(
                element=element,
                story=story,
                load_case=load_case,
                result_category=result_category,
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
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    beams: List[str],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
    elements_map: Dict,
):
    """Import beam hinge rotation data."""
    del result_set, load_cases, beams  # kept in signature for call-site parity

    if df.empty:
        return

    objects_to_create = []

    for _, row in df.iterrows():
        case_name = row.get("Output Case", row.get("OutputCase"))
        if case_name not in allowed_load_cases:
            continue

        story_name = row.get("Story")
        beam_name = row.get("Frame/Wall", row.get("FrameWall", ""))
        unique_name = row.get("Unique Name", row.get("UniqueName", beam_name))
        step_type_raw = row.get("Step Type", row.get("StepType", ""))
        step_type_normalized = str(step_type_raw).strip().lower()
        if step_type_normalized in {"nan", "none"}:
            step_type_normalized = ""
        hinge = row.get("Hinge", "")
        generated_hinge = row.get("Generated Hinge", row.get("GeneratedHinge", ""))
        rel_dist = row.get("Rel Dist", row.get("RelDist", None))

        if step_type_normalized in {"max", "min"}:
            step_type = step_type_normalized.title()
        elif step_type_normalized == "":
            step_type = ""
        else:
            # Preserve non-standard step labels instead of dropping source rows.
            step_type = str(step_type_raw).strip()

        sort_order = story_index.get(story_name, 0)
        story = _get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = _get_or_create_load_case(project, case_name, load_cases_map)
        element = _get_or_create_element(
            project, "Beam", beam_name, unique_name, story, elements_map
        )

        # Import R3 Plastic rotation
        r3_plastic_raw = row.get("R3 Plastic", row.get("R3Plastic", None))
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
                result_category=result_category,
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


def import_soil_pressures(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    allowed_load_cases: Set[str],
    load_cases_map: Dict,
):
    """Import soil pressure data."""
    del load_cases  # kept in signature for call-site parity

    if df.empty:
        return

    objects_to_create = []

    for _, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        shell_object = row.get("Shell Object", "")
        unique_name = row.get("Unique Name", "")
        min_pressure = row.get("Soil Pressure", 0)

        load_case = _get_or_create_load_case(project, case_name, load_cases_map)

        objects_to_create.append(
            SoilPressure(
                project=project,
                result_set=result_set,
                result_category=result_category,
                load_case=load_case,
                shell_object=str(shell_object),
                unique_name=str(unique_name),
                min_pressure=min_pressure,
            )
        )

    if objects_to_create:
        bulk_create_strict(
            SoilPressure,
            objects_to_create,
            context="soil pressures import",
            key_builder=lambda row: (
                row.project_id,
                row.result_set_id,
                row.unique_name,
                row.load_case_id,
            ),
        )


def import_vertical_displacements(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    allowed_load_cases: Set[str],
    load_cases_map: Dict,
):
    """Import vertical displacement data for foundation joints."""
    del load_cases  # kept in signature for call-site parity

    if df.empty:
        return

    objects_to_create = []

    for _, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        story = row.get("Story", "")
        label = row.get("Label", "")
        unique_name = row.get("Unique Name", "")
        min_uz = row.get("Min Uz", 0)

        load_case = _get_or_create_load_case(project, case_name, load_cases_map)

        objects_to_create.append(
            VerticalDisplacement(
                project=project,
                result_set=result_set,
                result_category=result_category,
                load_case=load_case,
                story=str(story),
                label=str(label),
                unique_name=str(unique_name),
                min_displacement=min_uz,
            )
        )

    if objects_to_create:
        bulk_create_strict(
            VerticalDisplacement,
            objects_to_create,
            context="vertical displacements import",
            key_builder=lambda row: (
                row.project_id,
                row.result_set_id,
                row.unique_name,
                row.load_case_id,
            ),
        )
