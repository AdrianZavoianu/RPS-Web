"""Shared sheet-importer builders used by both NLTHA and pushover runners."""

from typing import Callable

from .detail_importers.elements import (
    import_beam_rotations,
    import_column_forces,
    import_column_rotations,
    import_quad_rotations,
    import_wall_shears,
)
from .detail_importers.joints import (
    import_soil_pressures,
    import_vertical_displacements,
)
from .global_aggregation import build_story_index
from .global_result_importers import (
    import_story_accelerations,
    import_story_displacements,
    import_story_drifts,
    import_story_forces,
)
from .import_context import ImportContext

SheetImporterMap = dict[str, Callable[[tuple, set[str]], None]]


def build_common_sheet_importers(
    import_context: ImportContext,
    *,
    story_index_fn: Callable[[list], dict[str, int]] = build_story_index,
) -> SheetImporterMap:
    """Build the importer map entries shared by both NLTHA and pushover runners.

    Callers can override or extend the returned dict for runner-specific needs.
    """
    return {
        "get_story_drifts": lambda parsed, allowed_cases: import_story_drifts(
            import_context,
            parsed[0],
            parsed[1],
            story_index_fn(parsed[2]),
            allowed_cases,
        ),
        "get_story_accelerations": lambda parsed, allowed_cases: import_story_accelerations(
            import_context,
            parsed[0],
            parsed[1],
            story_index_fn(parsed[2]),
            allowed_cases,
        ),
        "get_story_forces": lambda parsed, allowed_cases: import_story_forces(
            import_context,
            parsed[0],
            parsed[1],
            story_index_fn(parsed[2]),
            allowed_cases,
        ),
        "get_joint_displacements": lambda parsed, allowed_cases: import_story_displacements(
            import_context,
            parsed[0],
            parsed[1],
            story_index_fn(parsed[2]),
            allowed_cases,
        ),
        "get_pier_forces": lambda parsed, allowed_cases: import_wall_shears(
            import_context,
            parsed[0],
            parsed[1],
            story_index_fn(parsed[2]),
            parsed[3],
            allowed_cases,
        ),
        "get_quad_rotations": lambda parsed, allowed_cases: import_quad_rotations(
            import_context,
            parsed[0],
            parsed[1],
            story_index_fn(parsed[2]),
            parsed[3],
            allowed_cases,
        ),
        "get_column_forces": lambda parsed, allowed_cases: import_column_forces(
            import_context,
            parsed[0],
            parsed[1],
            story_index_fn(parsed[2]),
            parsed[3],
            allowed_cases,
        ),
        "get_fiber_hinge_states": lambda parsed, allowed_cases: import_column_rotations(
            import_context,
            parsed[0],
            parsed[1],
            story_index_fn(parsed[2]),
            parsed[3],
            allowed_cases,
        ),
        "get_hinge_states": lambda parsed, allowed_cases: import_beam_rotations(
            import_context,
            parsed[0],
            parsed[1],
            story_index_fn(parsed[2]),
            parsed[3],
            allowed_cases,
        ),
        "get_soil_pressures": lambda parsed, allowed_cases: import_soil_pressures(
            import_context,
            parsed[0],
            parsed[1],
            allowed_cases,
        ),
        "get_vertical_displacements": lambda parsed, allowed_cases: import_vertical_displacements(
            import_context,
            parsed[0],
            parsed[1],
            allowed_cases,
        ),
    }
