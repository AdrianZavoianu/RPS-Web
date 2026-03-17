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
from .import_contracts import PushoverResultsImportStats
from .import_context import ImportContext
from .runner_pipeline import SheetImportStep, run_sheet_import_step
from .shared_importers import build_common_sheet_importers
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


def _build_pushover_sheet_importers(
    import_context: ImportContext,
) -> dict[str, Callable[[tuple, set[str]], None]]:
    """Build parser-method keyed importer callbacks for pushover results."""
    return build_common_sheet_importers(import_context)


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
