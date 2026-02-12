"""Global result import writers for story-level datasets."""

from typing import Any, Dict, List, Set

from apps.projects.models import LoadCase, Project, Story
from apps.results.models import (
    ResultCategory,
    ResultSet,
    StoryAcceleration,
    StoryDisplacement,
    StoryDrift,
    StoryForce,
)

from .global_aggregation import aggregate_by_step_type, parse_numeric, resolve_bounds


def get_or_create_story(
    project: Project, story_name: str, sort_order: int, stories_map: Dict
) -> Story:
    """Get or create a Story, using cache."""
    if story_name in stories_map:
        return stories_map[story_name]

    story, _ = Story.objects.get_or_create(
        project=project,
        name=story_name,
        defaults={"sort_order": sort_order},
    )
    stories_map[story_name] = story
    return story


def get_or_create_load_case(project: Project, case_name: str, load_cases_map: Dict) -> LoadCase:
    """Get or create a LoadCase, using cache."""
    if case_name in load_cases_map:
        return load_cases_map[case_name]

    load_case, _ = LoadCase.objects.get_or_create(
        project=project,
        name=case_name,
        defaults={"case_type": "Time History"},
    )
    load_cases_map[case_name] = load_case
    return load_case


def import_story_drifts(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
):
    """Import story drift data with Max/Min computation."""
    if df.empty:
        return

    drift_data: Dict[tuple, List[float]] = {}
    story_meta: Dict[tuple, tuple] = {}

    for _, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        story_name = row.get("Story")
        direction = row.get("Direction", "X")
        drift_value = row.get("Drift", 0)

        if drift_value is None:
            continue
        try:
            drift_float = float(drift_value)
            if drift_float != drift_float:  # NaN
                continue
        except (ValueError, TypeError):
            continue

        key = (story_name, direction, case_name)
        if key not in drift_data:
            drift_data[key] = []
            story_meta[key] = (story_name, direction, case_name)
        drift_data[key].append(float(drift_value))

    objects_to_create = []
    for key, values in drift_data.items():
        story_name, direction, case_name = story_meta[key]
        if not values:
            continue

        max_val = max(values)
        min_val = min(values)
        abs_max = max(abs(v) for v in values)

        sort_order = story_index.get(story_name, 0)
        story = get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = get_or_create_load_case(project, case_name, load_cases_map)

        objects_to_create.append(
            StoryDrift(
                story=story,
                load_case=load_case,
                result_category=result_category,
                direction=direction,
                story_sort_order=sort_order,
                drift=abs_max,
                max_drift=max_val,
                min_drift=min_val,
            )
        )

    if objects_to_create:
        StoryDrift.objects.bulk_create(objects_to_create, ignore_conflicts=True)


def import_story_accelerations(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
):
    """Import story acceleration data using Step Type Max/Min rows."""
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
        story = get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = get_or_create_load_case(project, case_name, load_cases_map)

        objects_to_create.append(
            StoryAcceleration(
                story=story,
                load_case=load_case,
                result_category=result_category,
                direction=direction,
                story_sort_order=sort_order,
                acceleration=max(abs(resolved_max), abs(resolved_min)),
                max_acceleration=resolved_max,
                min_acceleration=resolved_min,
            )
        )

    if objects_to_create:
        StoryAcceleration.objects.bulk_create(objects_to_create, ignore_conflicts=True)


def import_story_forces(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
):
    """Import story force data with Max/Min from Step Type rows."""
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
        story = get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = get_or_create_load_case(project, case_name, load_cases_map)

        objects_to_create.append(
            StoryForce(
                story=story,
                load_case=load_case,
                result_category=result_category,
                direction=direction,
                location=location,
                story_sort_order=sort_order,
                force=abs_envelope,
                max_force=resolved_max,
                min_force=resolved_min,
            )
        )

    if objects_to_create:
        StoryForce.objects.bulk_create(objects_to_create, ignore_conflicts=True)


def import_story_displacements(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
):
    """Import story displacement data with Max/Min from Step Type rows."""
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
        story = get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = get_or_create_load_case(project, case_name, load_cases_map)

        objects_to_create.append(
            StoryDisplacement(
                story=story,
                load_case=load_case,
                result_category=result_category,
                direction=direction,
                story_sort_order=sort_order,
                displacement=abs_envelope,
                max_displacement=resolved_max,
                min_displacement=resolved_min,
            )
        )

    if objects_to_create:
        StoryDisplacement.objects.bulk_create(objects_to_create, ignore_conflicts=True)
