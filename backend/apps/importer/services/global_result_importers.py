"""Global result import writers for story-level datasets."""

from typing import Any, Dict, List, Set

from apps.results.models import (
    StoryAcceleration,
    StoryDisplacement,
    StoryDrift,
    StoryForce,
)

from .bulk_writes import bulk_create_strict
from .global_aggregation import aggregate_by_step_type, parse_numeric, resolve_bounds
from .import_context import ImportContext


def import_story_drifts(
    context: ImportContext,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    allowed_load_cases: Set[str],
):
    """Import story drift data with Max/Min computation."""
    del load_cases  # kept in signature for call-site parity

    if df.empty or not allowed_load_cases:
        return

    if "Output Case" not in df.columns:
        return

    filtered = df[df["Output Case"].isin(allowed_load_cases)].copy()
    if filtered.empty:
        return

    if "Direction" not in filtered.columns:
        filtered["Direction"] = "X"
    if "Story" not in filtered.columns:
        filtered["Story"] = None

    if "Drift" in filtered.columns:
        filtered["_drift_value"] = filtered["Drift"].map(parse_numeric)
    else:
        filtered["_drift_value"] = 0.0

    filtered = filtered[filtered["_drift_value"].notna()]
    if filtered.empty:
        return

    grouped = (
        filtered.groupby(["Story", "Direction", "Output Case"], sort=False, dropna=False)[
            "_drift_value"
        ]
        .agg(["max", "min"])
        .reset_index()
    )

    objects_to_create = []
    for story_name, direction, case_name, max_val, min_val in grouped.itertuples(index=False):
        abs_max = max(abs(max_val), abs(min_val))

        sort_order = story_index.get(story_name, 0)
        story = context.get_or_create_story(story_name, sort_order)
        load_case = context.get_or_create_load_case(case_name)

        objects_to_create.append(
            StoryDrift(
                story=story,
                load_case=load_case,
                result_category=context.result_category,
                direction=direction,
                story_sort_order=sort_order,
                drift=abs_max,
                max_drift=max_val,
                min_drift=min_val,
            )
        )

    if objects_to_create:
        bulk_create_strict(
            StoryDrift,
            objects_to_create,
            context="story drifts import",
            key_builder=lambda row: (
                row.story_id,
                row.load_case_id,
                row.result_category_id,
                row.direction,
            ),
        )


def import_story_accelerations(
    context: ImportContext,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    allowed_load_cases: Set[str],
):
    """Import story acceleration data using Step Type Max/Min rows."""
    del load_cases  # kept in signature for call-site parity

    if df.empty:
        return

    def acceleration_items(row: Any, case_name: str):
        story_name = row.get("Story")
        for direction, max_col, min_col in [
            ("UX", "Max UX", "Min UX"),
            ("UY", "Max UY", "Min UY"),
        ]:
            yield (
                (story_name, case_name, direction),
                parse_numeric(row.get(max_col)),
                parse_numeric(row.get(min_col)),
            )

    accel_data = aggregate_by_step_type(df, allowed_load_cases, acceleration_items)

    objects_to_create = []
    for (story_name, case_name, direction), bounds in accel_data.items():
        resolved_bounds = resolve_bounds(bounds)
        if resolved_bounds is None:
            continue
        resolved_max, resolved_min = resolved_bounds

        sort_order = story_index.get(story_name, 0)
        story = context.get_or_create_story(story_name, sort_order)
        load_case = context.get_or_create_load_case(case_name)

        objects_to_create.append(
            StoryAcceleration(
                story=story,
                load_case=load_case,
                result_category=context.result_category,
                direction=direction,
                story_sort_order=sort_order,
                acceleration=max(abs(resolved_max), abs(resolved_min)),
                max_acceleration=resolved_max,
                min_acceleration=resolved_min,
            )
        )

    if objects_to_create:
        bulk_create_strict(
            StoryAcceleration,
            objects_to_create,
            context="story accelerations import",
            key_builder=lambda row: (
                row.story_id,
                row.load_case_id,
                row.result_category_id,
                row.direction,
            ),
        )


def import_story_forces(
    context: ImportContext,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    allowed_load_cases: Set[str],
):
    """Import story force data with Max/Min from Step Type rows."""
    del load_cases  # kept in signature for call-site parity

    if df.empty:
        return

    def force_items(row: Any, case_name: str):
        story_name = row.get("Story")
        location = row.get("Location", "Top")
        for direction in ["VX", "VY"]:
            value = parse_numeric(row.get(direction))
            yield (story_name, case_name, location, direction), value, value

    force_data = aggregate_by_step_type(df, allowed_load_cases, force_items)

    objects_to_create = []
    for (story_name, case_name, location, direction), vals in force_data.items():
        resolved_bounds = resolve_bounds(vals)
        if resolved_bounds is None:
            continue
        resolved_max, resolved_min = resolved_bounds

        abs_envelope = max(abs(resolved_max), abs(resolved_min))
        sort_order = story_index.get(story_name, 0)
        story = context.get_or_create_story(story_name, sort_order)
        load_case = context.get_or_create_load_case(case_name)

        objects_to_create.append(
            StoryForce(
                story=story,
                load_case=load_case,
                result_category=context.result_category,
                direction=direction,
                location=location,
                story_sort_order=sort_order,
                force=abs_envelope,
                max_force=resolved_max,
                min_force=resolved_min,
            )
        )

    if objects_to_create:
        bulk_create_strict(
            StoryForce,
            objects_to_create,
            context="story forces import",
            key_builder=lambda row: (
                row.story_id,
                row.load_case_id,
                row.result_category_id,
                row.direction,
                row.location,
            ),
        )


def import_story_displacements(
    context: ImportContext,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    allowed_load_cases: Set[str],
):
    """Import story displacement data with Max/Min from Step Type rows."""
    del load_cases  # kept in signature for call-site parity

    if df.empty:
        return

    def displacement_items(row: Any, case_name: str):
        story_name = row.get("Story")
        for direction, col_name in [("UX", "Ux"), ("UY", "Uy")]:
            value = parse_numeric(row.get(col_name))
            yield (story_name, case_name, direction), value, value

    displ_data = aggregate_by_step_type(df, allowed_load_cases, displacement_items)

    objects_to_create = []
    for (story_name, case_name, direction), vals in displ_data.items():
        resolved_bounds = resolve_bounds(vals)
        if resolved_bounds is None:
            continue
        resolved_max, resolved_min = resolved_bounds

        abs_envelope = max(abs(resolved_max), abs(resolved_min))
        sort_order = story_index.get(story_name, 0)
        story = context.get_or_create_story(story_name, sort_order)
        load_case = context.get_or_create_load_case(case_name)

        objects_to_create.append(
            StoryDisplacement(
                story=story,
                load_case=load_case,
                result_category=context.result_category,
                direction=direction,
                story_sort_order=sort_order,
                displacement=abs_envelope,
                max_displacement=resolved_max,
                min_displacement=resolved_min,
            )
        )

    if objects_to_create:
        bulk_create_strict(
            StoryDisplacement,
            objects_to_create,
            context="story displacements import",
            key_builder=lambda row: (
                row.story_id,
                row.load_case_id,
                row.result_category_id,
                row.direction,
            ),
        )
