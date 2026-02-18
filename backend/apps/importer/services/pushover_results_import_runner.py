"""Execution runner for pushover results import.

Imports pushover global/element/joint source sheets into normalized models
for the target pushover result set, then rebuilds cache tables.
"""

import logging
from pathlib import Path
from typing import Callable, Dict, List, Optional, Set

from django.db import transaction

from apps.importer.models import ImportJob
from apps.importer.parsers.excel_parser import ExcelParser
from apps.projects.models import Project
from apps.results.models import (
    AbsoluteMaxMinDrift,
    BeamRotation,
    ColumnAxial,
    ColumnRotation,
    ColumnShear,
    ElementResultsCache,
    GlobalResultsCache,
    JointResultsCache,
    QuadRotation,
    ResultCategory,
    ResultSet,
    SoilPressure,
    StoryAcceleration,
    StoryDisplacement,
    StoryDrift,
    StoryForce,
    TimeSeriesGlobalCache,
    VerticalDisplacement,
    WallShear,
)

from .cache_builder import CacheBuilderService
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
from .import_contracts import PushoverResultsImportStats
from .import_context import ImportContext
from .runner_pipeline import SheetImportStep, run_sheet_import_step
from .sheet_step_definitions import (
    PUSHOVER_RESULTS_SHEET_STEP_DEFINITIONS,
    PUSHOVER_VERTICAL_DISPLACEMENTS_STEP_DEFINITION,
)
from .utils import append_import_error_with_log

logger = logging.getLogger(__name__)


def _is_pushover_case(case_name: object) -> bool:
    return "push" in str(case_name).casefold()


def _pushover_only_load_cases(
    load_cases: List[str],
    already_imported: Set[str],
) -> Set[str]:
    return {
        case_name
        for case_name in load_cases
        if _is_pushover_case(case_name) and case_name not in already_imported
    }


def _import_column_sheets(
    parsed: tuple,
    allowed_cases: set[str],
    *,
    import_context: ImportContext,
) -> None:
    """Import column forces and rotations from one parsed sheet payload."""
    story_index = build_story_index(parsed[2])
    _import_column_forces(
        import_context,
        parsed[0],
        parsed[1],
        story_index,
        parsed[3],
        allowed_cases,
    )
    _import_column_rotations(
        import_context,
        parsed[0],
        parsed[1],
        story_index,
        parsed[3],
        allowed_cases,
    )


def _build_pushover_sheet_importers(
    import_context: ImportContext,
) -> dict[str, Callable[[tuple, set[str]], None]]:
    """Build parser-method keyed importer callbacks for pushover results."""
    return {
        "get_story_drifts": lambda parsed, allowed_cases: _import_story_drifts(
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
        "get_story_accelerations": lambda parsed, allowed_cases: _import_story_accelerations(
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
            build_story_index(parsed[2]),
            parsed[3],
            allowed_cases,
        ),
        "get_column_forces": lambda parsed, allowed_cases: _import_column_sheets(
            parsed,
            allowed_cases,
            import_context=import_context,
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


def _run_pushover_results_sheet_steps(
    *,
    parser: ExcelParser,
    imported_by_sheet: dict[str, set[str]],
    import_context: ImportContext,
) -> None:
    """Run all pushover-results sheet imports for one parser/file pair."""
    importers = _build_pushover_sheet_importers(import_context)

    for definition in PUSHOVER_RESULTS_SHEET_STEP_DEFINITIONS:
        run_sheet_import_step(
            parser=parser,
            imported_by_sheet=imported_by_sheet,
            step=SheetImportStep(
                sheet_name=definition.sheet_name,
                parse_sheet=getattr(parser, definition.parser_method_name),
                import_sheet=importers[definition.parser_method_name],
                resolve_allowed_cases=_pushover_only_load_cases,
                skip_if_dataframe_empty=definition.skip_if_dataframe_empty,
                imported_sheet_name=definition.imported_sheet_name,
            ),
        )

    foundation_joints = parser.get_foundation_joints()
    if not foundation_joints:
        return

    vertical_definition = PUSHOVER_VERTICAL_DISPLACEMENTS_STEP_DEFINITION
    run_sheet_import_step(
        parser=parser,
        imported_by_sheet=imported_by_sheet,
        step=SheetImportStep(
            sheet_name=vertical_definition.sheet_name,
            parse_sheet=lambda: parser.get_vertical_displacements(foundation_joints),
            import_sheet=importers[vertical_definition.parser_method_name],
            resolve_allowed_cases=_pushover_only_load_cases,
            skip_if_dataframe_empty=vertical_definition.skip_if_dataframe_empty,
            imported_sheet_name=vertical_definition.imported_sheet_name,
        ),
    )


def _clear_existing_result_set_data(project: Project, result_set: ResultSet) -> None:
    """Delete existing normalized/cache rows for re-import into one result set."""
    result_categories = ResultCategory.objects.filter(result_set=result_set)

    StoryDrift.objects.filter(result_category__in=result_categories).delete()
    StoryAcceleration.objects.filter(result_category__in=result_categories).delete()
    StoryForce.objects.filter(result_category__in=result_categories).delete()
    StoryDisplacement.objects.filter(result_category__in=result_categories).delete()

    WallShear.objects.filter(result_category__in=result_categories).delete()
    QuadRotation.objects.filter(result_category__in=result_categories).delete()
    ColumnShear.objects.filter(result_category__in=result_categories).delete()
    ColumnAxial.objects.filter(result_category__in=result_categories).delete()
    ColumnRotation.objects.filter(result_category__in=result_categories).delete()
    BeamRotation.objects.filter(result_category__in=result_categories).delete()

    SoilPressure.objects.filter(project=project, result_set=result_set).delete()
    VerticalDisplacement.objects.filter(project=project, result_set=result_set).delete()

    GlobalResultsCache.objects.filter(project=project, result_set=result_set).delete()
    ElementResultsCache.objects.filter(project=project, result_set=result_set).delete()
    JointResultsCache.objects.filter(project=project, result_set=result_set).delete()
    AbsoluteMaxMinDrift.objects.filter(project=project, result_set=result_set).delete()
    TimeSeriesGlobalCache.objects.filter(project=project, result_set=result_set).delete()


def run_pushover_results_import(
    *,
    job: ImportJob,
    files: List[Path],
    result_set_name: str,
    result_set_id: Optional[int],
    progress_callback: Callable[[str, int, int], None],
) -> PushoverResultsImportStats:
    """Import pushover results from source sheets and rebuild caches."""
    project = job.project
    stats: PushoverResultsImportStats = {
        "files_processed": 0,
        "files_total": len(files),
        "load_cases_imported": 0,
        "stories_imported": 0,
        "elements_imported": 0,
        "cache_rows_written": 0,
        "directions_imported": [],
        "result_set_id": None,
        "errors": [],
    }

    with transaction.atomic():
        if result_set_id is not None:
            result_set = ResultSet.objects.filter(project=project, id=result_set_id).first()
            if result_set is None:
                raise ValueError(
                    f"Result set {result_set_id} not found for project {project.slug}"
                )
        else:
            result_set, _ = ResultSet.objects.get_or_create(
                project=project,
                name=result_set_name,
                defaults={"analysis_type": "Pushover"},
            )

        if result_set.analysis_type != "Pushover":
            raise ValueError(
                f"Result set {result_set.id} has analysis_type={result_set.analysis_type}; expected Pushover"
            )

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

        stats["result_set_id"] = result_set.id
        job.result_set = result_set
        job.save(update_fields=["result_set"])

    # Clear target-set data to support re-import safely.
    _clear_existing_result_set_data(project, result_set)

    imported_by_sheet: Dict[str, Set[str]] = {}
    directions_imported: Set[str] = set()

    for idx, file_path in enumerate(files):
        progress_callback(f"Processing {file_path.name}...", idx + 1, len(files))

        try:
            with ExcelParser(str(file_path)) as parser:
                directions_imported.update(
                    {direction for direction in parser.get_pushover_directions() if direction != "XY"}
                )

                _run_pushover_results_sheet_steps(
                    parser=parser,
                    imported_by_sheet=imported_by_sheet,
                    import_context=import_context,
                )

            stats["files_processed"] += 1

        except Exception as exc:
            append_import_error_with_log(
                stats=stats,
                source=file_path.name,
                exc=exc,
                logger=logger,
                log_template="Error processing pushover file %s",
            )

    progress_callback("Building cache...", len(files), len(files))
    cache_builder = CacheBuilderService(
        project=project,
        result_set=result_set,
        progress_callback=lambda _m, _c, _t: None,
        compute_aggregates=False,
    )
    cache_stats = cache_builder.build_all_caches()

    stats["directions_imported"] = sorted(directions_imported)
    stats["load_cases_imported"] = len(import_context.load_cases_map)
    stats["stories_imported"] = len(import_context.stories_map)
    stats["elements_imported"] = len(import_context.elements_map)
    stats["cache_rows_written"] = (
        cache_stats.get("global_cache_rows", 0)
        + cache_stats.get("element_cache_rows", 0)
        + cache_stats.get("joint_cache_rows", 0)
    )
    stats.update(cache_stats)

    return stats
