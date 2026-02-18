"""Declarative sheet-step definitions used by importer runners."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SheetStepDefinition:
    """Static metadata that defines how one source sheet is processed."""

    sheet_name: str
    parser_method_name: str
    skip_if_dataframe_empty: bool = False
    imported_sheet_name: str | None = None


NLTHA_SHEET_STEP_DEFINITIONS: tuple[SheetStepDefinition, ...] = (
    SheetStepDefinition("Story Drifts", "get_story_drifts"),
    SheetStepDefinition("Diaphragm Accelerations", "get_story_accelerations"),
    SheetStepDefinition("Story Forces", "get_story_forces"),
    SheetStepDefinition("Joint Displacements", "get_joint_displacements", skip_if_dataframe_empty=True),
    SheetStepDefinition("Pier Forces", "get_pier_forces", skip_if_dataframe_empty=True),
    SheetStepDefinition(
        "Quad Strain Gauge - Rotation",
        "get_quad_rotations",
        skip_if_dataframe_empty=True,
    ),
    SheetStepDefinition(
        "Element Forces - Columns",
        "get_column_forces",
        skip_if_dataframe_empty=True,
    ),
    SheetStepDefinition(
        "Fiber Hinge States",
        "get_fiber_hinge_states",
        skip_if_dataframe_empty=True,
    ),
    SheetStepDefinition("Hinge States", "get_hinge_states", skip_if_dataframe_empty=True),
    SheetStepDefinition("Soil Pressures", "get_soil_pressures", skip_if_dataframe_empty=True),
)


NLTHA_VERTICAL_DISPLACEMENTS_STEP_DEFINITION = SheetStepDefinition(
    "Joint Displacements",
    "get_vertical_displacements",
    skip_if_dataframe_empty=True,
    imported_sheet_name="Vertical Displacements",
)


PUSHOVER_RESULTS_SHEET_STEP_DEFINITIONS: tuple[SheetStepDefinition, ...] = (
    SheetStepDefinition("Story Drifts", "get_story_drifts"),
    SheetStepDefinition("Story Forces", "get_story_forces"),
    SheetStepDefinition("Joint Displacements", "get_joint_displacements", skip_if_dataframe_empty=True),
    SheetStepDefinition(
        "Diaphragm Accelerations",
        "get_story_accelerations",
        skip_if_dataframe_empty=True,
    ),
    SheetStepDefinition("Pier Forces", "get_pier_forces", skip_if_dataframe_empty=True),
    SheetStepDefinition(
        "Quad Strain Gauge - Rotation",
        "get_quad_rotations",
        skip_if_dataframe_empty=True,
    ),
    SheetStepDefinition(
        "Element Forces - Columns",
        "get_column_forces",
        skip_if_dataframe_empty=True,
    ),
    SheetStepDefinition(
        "Fiber Hinge States",
        "get_fiber_hinge_states",
        skip_if_dataframe_empty=True,
    ),
    SheetStepDefinition("Hinge States", "get_hinge_states", skip_if_dataframe_empty=True),
    SheetStepDefinition("Soil Pressures", "get_soil_pressures", skip_if_dataframe_empty=True),
)


PUSHOVER_VERTICAL_DISPLACEMENTS_STEP_DEFINITION = SheetStepDefinition(
    "Joint Displacements",
    "get_vertical_displacements",
    skip_if_dataframe_empty=True,
    imported_sheet_name="Vertical Displacements",
)
