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
from .detail_result_importers import (
    import_beam_rotations as _import_beam_rotations,
    import_column_forces as _import_column_forces,
    import_column_rotations as _import_column_rotations,
    import_quad_rotations as _import_quad_rotations,
    import_soil_pressures as _import_soil_pressures,
    import_vertical_displacements as _import_vertical_displacements,
    import_wall_shears as _import_wall_shears,
)
from .global_aggregation import build_story_index
from .global_result_importers import (
    import_story_accelerations as _import_story_accelerations,
    import_story_displacements as _import_story_displacements,
    import_story_drifts as _import_story_drifts,
    import_story_forces as _import_story_forces,
)

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
) -> Dict:
    """Import pushover results from source sheets and rebuild caches."""
    project = job.project
    stats: Dict = {
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

        stats["result_set_id"] = result_set.id
        job.result_set = result_set
        job.save(update_fields=["result_set"])

    # Clear target-set data to support re-import safely.
    _clear_existing_result_set_data(project, result_set)

    stories_map = {}
    load_cases_map = {}
    elements_map = {}
    imported_by_sheet: Dict[str, Set[str]] = {}
    directions_imported: Set[str] = set()

    for idx, file_path in enumerate(files):
        progress_callback(f"Processing {file_path.name}...", idx + 1, len(files))

        try:
            with ExcelParser(str(file_path)) as parser:
                directions_imported.update(
                    {direction for direction in parser.get_pushover_directions() if direction != "XY"}
                )

                if parser.validate_sheet_exists("Story Drifts"):
                    df, load_cases, stories = parser.get_story_drifts()
                    already = imported_by_sheet.setdefault("Story Drifts", set())
                    allowed = _pushover_only_load_cases(load_cases, already)
                    if allowed:
                        _import_story_drifts(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            build_story_index(stories),
                            allowed,
                            stories_map,
                            load_cases_map,
                        )
                        already.update(allowed)

                if parser.validate_sheet_exists("Story Forces"):
                    df, load_cases, stories = parser.get_story_forces()
                    already = imported_by_sheet.setdefault("Story Forces", set())
                    allowed = _pushover_only_load_cases(load_cases, already)
                    if allowed:
                        _import_story_forces(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            build_story_index(stories),
                            allowed,
                            stories_map,
                            load_cases_map,
                        )
                        already.update(allowed)

                if parser.validate_sheet_exists("Joint Displacements"):
                    df, load_cases, stories = parser.get_joint_displacements()
                    already = imported_by_sheet.setdefault("Joint Displacements", set())
                    allowed = _pushover_only_load_cases(load_cases, already)
                    if allowed and not df.empty:
                        _import_story_displacements(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            build_story_index(stories),
                            allowed,
                            stories_map,
                            load_cases_map,
                        )
                        already.update(allowed)

                if parser.validate_sheet_exists("Diaphragm Accelerations"):
                    df, load_cases, stories = parser.get_story_accelerations()
                    already = imported_by_sheet.setdefault("Diaphragm Accelerations", set())
                    allowed = _pushover_only_load_cases(load_cases, already)
                    if allowed and not df.empty:
                        _import_story_accelerations(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            build_story_index(stories),
                            allowed,
                            stories_map,
                            load_cases_map,
                        )
                        already.update(allowed)

                if parser.validate_sheet_exists("Pier Forces"):
                    df, load_cases, stories, piers = parser.get_pier_forces()
                    already = imported_by_sheet.setdefault("Pier Forces", set())
                    allowed = _pushover_only_load_cases(load_cases, already)
                    if allowed and not df.empty:
                        _import_wall_shears(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            build_story_index(stories),
                            piers,
                            allowed,
                            stories_map,
                            load_cases_map,
                            elements_map,
                        )
                        already.update(allowed)

                if parser.validate_sheet_exists("Quad Strain Gauge - Rotation"):
                    df, load_cases, stories, piers = parser.get_quad_rotations()
                    already = imported_by_sheet.setdefault("Quad Strain Gauge - Rotation", set())
                    allowed = _pushover_only_load_cases(load_cases, already)
                    if allowed and not df.empty:
                        _import_quad_rotations(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            build_story_index(stories),
                            piers,
                            allowed,
                            stories_map,
                            load_cases_map,
                            elements_map,
                        )
                        already.update(allowed)

                if parser.validate_sheet_exists("Element Forces - Columns"):
                    df, load_cases, stories, columns = parser.get_column_forces()
                    already = imported_by_sheet.setdefault("Element Forces - Columns", set())
                    allowed = _pushover_only_load_cases(load_cases, already)
                    if allowed and not df.empty:
                        story_index = build_story_index(stories)
                        _import_column_forces(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            story_index,
                            columns,
                            allowed,
                            stories_map,
                            load_cases_map,
                            elements_map,
                        )
                        _import_column_rotations(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            story_index,
                            columns,
                            allowed,
                            stories_map,
                            load_cases_map,
                            elements_map,
                        )
                        already.update(allowed)

                if parser.validate_sheet_exists("Fiber Hinge States"):
                    df, load_cases, stories, columns = parser.get_fiber_hinge_states()
                    already = imported_by_sheet.setdefault("Fiber Hinge States", set())
                    allowed = _pushover_only_load_cases(load_cases, already)
                    if allowed and not df.empty:
                        _import_column_rotations(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            build_story_index(stories),
                            columns,
                            allowed,
                            stories_map,
                            load_cases_map,
                            elements_map,
                        )
                        already.update(allowed)

                if parser.validate_sheet_exists("Hinge States"):
                    df, load_cases, stories, beams = parser.get_hinge_states()
                    already = imported_by_sheet.setdefault("Hinge States", set())
                    allowed = _pushover_only_load_cases(load_cases, already)
                    if allowed and not df.empty:
                        _import_beam_rotations(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            build_story_index(stories),
                            beams,
                            allowed,
                            stories_map,
                            load_cases_map,
                            elements_map,
                        )
                        already.update(allowed)

                if parser.validate_sheet_exists("Soil Pressures"):
                    df, load_cases, _ = parser.get_soil_pressures()
                    already = imported_by_sheet.setdefault("Soil Pressures", set())
                    allowed = _pushover_only_load_cases(load_cases, already)
                    if allowed and not df.empty:
                        _import_soil_pressures(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            allowed,
                            load_cases_map,
                        )
                        already.update(allowed)

                foundation_joints = parser.get_foundation_joints()
                if foundation_joints and parser.validate_sheet_exists("Joint Displacements"):
                    df, load_cases, _ = parser.get_vertical_displacements(foundation_joints)
                    already = imported_by_sheet.setdefault("Vertical Displacements", set())
                    allowed = _pushover_only_load_cases(load_cases, already)
                    if allowed and not df.empty:
                        _import_vertical_displacements(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            allowed,
                            load_cases_map,
                        )
                        already.update(allowed)

            stats["files_processed"] += 1

        except Exception as exc:
            stats["errors"].append(f"{file_path.name}: {str(exc)}")
            logger.exception("Error processing pushover file %s", file_path.name)

    progress_callback("Building cache...", len(files), len(files))
    cache_builder = CacheBuilderService(
        project=project,
        result_set=result_set,
        progress_callback=lambda _m, _c, _t: None,
        compute_aggregates=False,
    )
    cache_stats = cache_builder.build_all_caches()

    stats["directions_imported"] = sorted(directions_imported)
    stats["load_cases_imported"] = len(load_cases_map)
    stats["stories_imported"] = len(stories_map)
    stats["elements_imported"] = len(elements_map)
    stats["cache_rows_written"] = (
        cache_stats.get("global_cache_rows", 0)
        + cache_stats.get("element_cache_rows", 0)
        + cache_stats.get("joint_cache_rows", 0)
    )
    stats.update(cache_stats)

    return stats
