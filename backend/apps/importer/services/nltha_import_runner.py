"""Execution runner for NLTHA imports."""

import logging
from pathlib import Path
from typing import Callable, Dict, List, Optional, Set

from django.db import transaction

from apps.importer.models import ImportJob
from apps.importer.parsers.excel_parser import ExcelParser, TimeHistoryParseResult
from apps.results.models import ResultCategory, ResultSet

from .detail_importers.elements import (
    import_beam_rotations as _import_beam_rotations,
    import_column_forces as _import_column_forces,
    import_column_rotations as _import_column_rotations,
    import_quad_rotations as _import_quad_rotations,
    import_wall_shears as _import_wall_shears,
)
from .detail_importers.joints import (
    import_soil_pressures as _import_soil_pressures,
    import_vertical_displacements as _import_vertical_displacements,
)
from .global_aggregation import build_story_index
from .global_result_importers import (
    import_story_accelerations as _import_story_accelerations,
    import_story_displacements as _import_story_displacements,
    import_story_drifts as _import_story_drifts,
    import_story_forces as _import_story_forces,
)
from .import_contracts import NlthaImportStats
from .import_context import ImportContext
from .import_preparation import determine_allowed_load_cases
from .runner_pipeline import SheetImportStep, run_sheet_import_step
from .sheet_step_definitions import (
    NLTHA_SHEET_STEP_DEFINITIONS,
    NLTHA_VERTICAL_DISPLACEMENTS_STEP_DEFINITION,
)
from .utils import append_import_error_with_log

logger = logging.getLogger(__name__)


def _project_story_index(
    import_context: ImportContext,
    sheet_stories: list,
) -> Dict[str, int]:
    """Build story index from the project's existing Story sort_order.

    Falls back to the sheet's own order for stories not yet in the DB.
    """
    from apps.projects.models import Story

    db_index = {
        s.name: s.sort_order
        for s in Story.objects.filter(project=import_context.project)
    }
    # For any story in the sheet that isn't in the DB yet, use sheet order
    fallback = build_story_index(sheet_stories)
    for name in fallback:
        if name not in db_index:
            db_index[name] = fallback[name]
    return db_index


def _build_nltha_sheet_importers(
    import_context: ImportContext,
) -> dict[str, Callable[[tuple, set[str]], None]]:
    """Build parser-method keyed importer callbacks for NLTHA sheets."""
    return {
        "get_story_drifts": lambda parsed, allowed_cases: _import_story_drifts(
            import_context,
            parsed[0],
            parsed[1],
            build_story_index(parsed[2]),
            allowed_cases,
        ),
        "get_story_accelerations": lambda parsed, allowed_cases: _import_story_accelerations(
            import_context,
            parsed[0],
            parsed[1],
            build_story_index(parsed[2]),
            allowed_cases,
        ),
        "get_story_forces": lambda parsed, allowed_cases: _import_story_forces(
            import_context,
            parsed[0],
            parsed[1],
            build_story_index(parsed[2]),
            allowed_cases,
        ),
        "get_joint_displacements": lambda parsed, allowed_cases: _import_story_displacements(
            import_context,
            parsed[0],
            parsed[1],
            build_story_index(parsed[2]),
            allowed_cases,
        ),
        "get_pier_forces": lambda parsed, allowed_cases: _import_wall_shears(
            import_context,
            parsed[0],
            parsed[1],
            build_story_index(parsed[2]),
            parsed[3],
            allowed_cases,
        ),
        "get_quad_rotations": lambda parsed, allowed_cases: _import_quad_rotations(
            import_context,
            parsed[0],
            parsed[1],
            _project_story_index(import_context, parsed[2]),
            parsed[3],
            allowed_cases,
        ),
        "get_column_forces": lambda parsed, allowed_cases: _import_column_forces(
            import_context,
            parsed[0],
            parsed[1],
            build_story_index(parsed[2]),
            parsed[3],
            allowed_cases,
        ),
        "get_fiber_hinge_states": lambda parsed, allowed_cases: _import_column_rotations(
            import_context,
            parsed[0],
            parsed[1],
            build_story_index(parsed[2]),
            parsed[3],
            allowed_cases,
        ),
        "get_hinge_states": lambda parsed, allowed_cases: _import_beam_rotations(
            import_context,
            parsed[0],
            parsed[1],
            build_story_index(parsed[2]),
            parsed[3],
            allowed_cases,
        ),
        "get_soil_pressures": lambda parsed, allowed_cases: _import_soil_pressures(
            import_context,
            parsed[0],
            parsed[1],
            allowed_cases,
        ),
        "get_vertical_displacements": lambda parsed, allowed_cases: _import_vertical_displacements(
            import_context,
            parsed[0],
            parsed[1],
            allowed_cases,
        ),
    }


def _build_selected_case_resolver(
    allowed_for_file: set[str],
) -> Callable[[list[str], set[str]], set[str]]:
    """Resolve allowed cases for one file from the prescan-selected set."""

    def _resolve(load_cases: list[str], _already_imported: set[str]) -> set[str]:
        return set(load_cases) & allowed_for_file

    return _resolve


def _run_nltha_sheet_steps(
    *,
    parser: ExcelParser,
    imported_by_sheet: dict[str, set[str]],
    import_context: ImportContext,
    allowed_for_file: set[str],
    foundation_joints: list[str],
) -> None:
    """Run all NLTHA sheet imports for one parser/file pair."""
    resolve_allowed_cases = _build_selected_case_resolver(allowed_for_file)
    importers = _build_nltha_sheet_importers(import_context)

    for definition in NLTHA_SHEET_STEP_DEFINITIONS:
        run_sheet_import_step(
            parser=parser,
            imported_by_sheet=imported_by_sheet,
            step=SheetImportStep(
                sheet_name=definition.sheet_name,
                parse_sheet=getattr(parser, definition.parser_method_name),
                import_sheet=importers[definition.parser_method_name],
                resolve_allowed_cases=resolve_allowed_cases,
                skip_if_dataframe_empty=definition.skip_if_dataframe_empty,
                imported_sheet_name=definition.imported_sheet_name,
            ),
        )

    if not foundation_joints:
        return

    vertical_definition = NLTHA_VERTICAL_DISPLACEMENTS_STEP_DEFINITION
    run_sheet_import_step(
        parser=parser,
        imported_by_sheet=imported_by_sheet,
        step=SheetImportStep(
            sheet_name=vertical_definition.sheet_name,
            parse_sheet=lambda: parser.get_vertical_displacements(foundation_joints),
            import_sheet=importers[vertical_definition.parser_method_name],
            resolve_allowed_cases=resolve_allowed_cases,
            skip_if_dataframe_empty=vertical_definition.skip_if_dataframe_empty,
            imported_sheet_name=vertical_definition.imported_sheet_name,
        ),
    )


def run_nltha_import(
    *,
    job: ImportJob,
    files: List[Path],
    file_load_cases: Dict[str, Dict[str, List[str]]],
    selected_load_cases: Set[str],
    conflict_resolution: Dict,
    result_set_name: str,
    result_set_id: Optional[int],
    foundation_joints: List[str],
    progress_callback: Callable[[str, int, int], None],
) -> NlthaImportStats:
    """Run the NLTHA import process and return import statistics."""
    project = job.project
    stats: NlthaImportStats = {
        "files_processed": 0,
        "files_total": len(files),
        "load_cases_imported": 0,
        "stories_imported": 0,
        "elements_imported": 0,
        "result_set_id": None,
        "errors": [],
    }

    # Reuse an explicitly selected result set when provided, otherwise create/get by name.
    with transaction.atomic():
        if result_set_id is not None:
            result_set = ResultSet.objects.filter(project=project, id=result_set_id).first()
            if result_set is None:
                raise ValueError(f"Result set {result_set_id} not found for project {project.slug}")
        else:
            result_set, _ = ResultSet.objects.get_or_create(
                project=project,
                name=result_set_name,
                defaults={"analysis_type": "NLTHA"},
            )
        stats["result_set_id"] = result_set.id
        job.result_set = result_set
        job.save(update_fields=["result_set"])

        # Create result category for envelopes/global
        result_category, _ = ResultCategory.objects.get_or_create(
            result_set=result_set,
            category_name="Envelopes",
            category_type="Global",
        )
        import_context = ImportContext(
            project=project,
            result_set=result_set,
            result_category=result_category,
        )

    # Track which load cases have been imported per sheet
    imported_by_sheet: Dict[str, Set[str]] = {}
    time_history_results: List[TimeHistoryParseResult] = []  # Collected time-series data

    for idx, file_path in enumerate(files):
        file_name = file_path.name
        if file_name not in file_load_cases:
            continue

        progress_callback(f"Processing {file_name}...", idx + 1, len(files))

        # Determine allowed load cases for this file
        allowed, _skipped = determine_allowed_load_cases(
            file_name=file_name,
            file_sheets=file_load_cases[file_name],
            selected_load_cases=selected_load_cases,
            resolution=conflict_resolution,
            already_imported=imported_by_sheet,
        )

        if not allowed:
            continue

        try:
            with ExcelParser(str(file_path)) as parser:
                _run_nltha_sheet_steps(
                    parser=parser,
                    imported_by_sheet=imported_by_sheet,
                    import_context=import_context,
                    allowed_for_file=allowed,
                    foundation_joints=foundation_joints,
                )

                # --- Time-Series Data ---
                # Parse time-history step-by-step data if present
                if parser.has_time_series_data():
                    th_result = parser.parse_time_history()
                    if th_result and th_result.load_case_name in allowed:
                        time_history_results.append(th_result)

            stats["files_processed"] += 1

        except Exception as exc:
            append_import_error_with_log(
                stats=stats,
                source=file_name,
                exc=exc,
                logger=logger,
                log_template="Error processing file %s",
            )

    # Count imported items
    stats["load_cases_imported"] = len(import_context.load_cases_map)
    stats["stories_imported"] = len(import_context.stories_map)
    stats["elements_imported"] = len(import_context.elements_map)
    stats["time_history_results"] = time_history_results
    stats["stories_map"] = import_context.stories_map

    return stats
