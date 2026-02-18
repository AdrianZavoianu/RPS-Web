"""Detailed importers for joint/foundation source sheets."""

from typing import List, Set

from apps.results.models import SoilPressure, VerticalDisplacement

from ..bulk_writes import bulk_create_strict
from ..import_context import ImportContext


def import_soil_pressures(
    context: ImportContext,
    df,
    load_cases: List[str],
    allowed_load_cases: Set[str],
):
    """Import soil pressure data."""
    del load_cases  # kept in signature for call-site parity

    if df.empty:
        return

    objects_to_create = []
    for case_name, shell_object, unique_name, min_pressure in df[
        ["Output Case", "Shell Object", "Unique Name", "Soil Pressure"]
    ].itertuples(index=False, name=None):
        if case_name not in allowed_load_cases:
            continue

        load_case = context.get_or_create_load_case(case_name)
        objects_to_create.append(
            SoilPressure(
                project=context.project,
                result_set=context.result_set,
                result_category=context.result_category,
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
    context: ImportContext,
    df,
    load_cases: List[str],
    allowed_load_cases: Set[str],
):
    """Import vertical displacement data for foundation joints."""
    del load_cases  # kept in signature for call-site parity

    if df.empty:
        return

    objects_to_create = []
    for case_name, story, label, unique_name, min_uz in df[
        ["Output Case", "Story", "Label", "Unique Name", "Min Uz"]
    ].itertuples(index=False, name=None):
        if case_name not in allowed_load_cases:
            continue

        load_case = context.get_or_create_load_case(case_name)
        objects_to_create.append(
            VerticalDisplacement(
                project=context.project,
                result_set=context.result_set,
                result_category=context.result_category,
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
