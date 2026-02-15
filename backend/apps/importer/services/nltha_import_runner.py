"""Execution runner for NLTHA imports."""

import logging
from pathlib import Path
from typing import Callable, Dict, List, Optional, Set

from django.db import transaction

from apps.importer.models import ImportJob
from apps.importer.parsers.excel_parser import ExcelParser, TimeHistoryParseResult
from apps.results.models import ResultCategory, ResultSet

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
from .import_preparation import determine_allowed_load_cases

logger = logging.getLogger(__name__)


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
) -> Dict:
    """Run the NLTHA import process and return import statistics."""
    project = job.project
    stats = {
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

    # Track which load cases have been imported per sheet
    imported_by_sheet: Dict[str, Set[str]] = {}
    stories_map = {}  # name -> Story
    load_cases_map = {}  # name -> LoadCase
    elements_map = {}  # (type, unique_name) -> Element
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
                # Import story drifts
                if parser.validate_sheet_exists("Story Drifts"):
                    df, load_cases, stories = parser.get_story_drifts()
                    story_index = build_story_index(stories)
                    _import_story_drifts(
                        project,
                        result_set,
                        result_category,
                        df,
                        load_cases,
                        story_index,
                        allowed,
                        stories_map,
                        load_cases_map,
                    )
                    imported_by_sheet.setdefault("Story Drifts", set()).update(
                        set(load_cases) & allowed
                    )

                # Import story accelerations
                if parser.validate_sheet_exists("Diaphragm Accelerations"):
                    df, load_cases, stories = parser.get_story_accelerations()
                    story_index = build_story_index(stories)
                    _import_story_accelerations(
                        project,
                        result_set,
                        result_category,
                        df,
                        load_cases,
                        story_index,
                        allowed,
                        stories_map,
                        load_cases_map,
                    )
                    imported_by_sheet.setdefault("Diaphragm Accelerations", set()).update(
                        set(load_cases) & allowed
                    )

                # Import story forces
                if parser.validate_sheet_exists("Story Forces"):
                    df, load_cases, stories = parser.get_story_forces()
                    story_index = build_story_index(stories)
                    _import_story_forces(
                        project,
                        result_set,
                        result_category,
                        df,
                        load_cases,
                        story_index,
                        allowed,
                        stories_map,
                        load_cases_map,
                    )
                    imported_by_sheet.setdefault("Story Forces", set()).update(
                        set(load_cases) & allowed
                    )

                # Import story displacements
                if parser.validate_sheet_exists("Joint Displacements"):
                    df, load_cases, stories = parser.get_joint_displacements()
                    story_index = build_story_index(stories)
                    if not df.empty:
                        _import_story_displacements(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            story_index,
                            allowed,
                            stories_map,
                            load_cases_map,
                        )
                        imported_by_sheet.setdefault("Joint Displacements", set()).update(
                            set(load_cases) & allowed
                        )

                # --- Element Results ---

                # Import pier/wall shears
                if parser.validate_sheet_exists("Pier Forces"):
                    df, load_cases, stories, piers = parser.get_pier_forces()
                    story_index = build_story_index(stories)
                    if not df.empty:
                        _import_wall_shears(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            story_index,
                            piers,
                            allowed,
                            stories_map,
                            load_cases_map,
                            elements_map,
                        )
                        imported_by_sheet.setdefault("Pier Forces", set()).update(
                            set(load_cases) & allowed
                        )

                # Import quad rotations
                if parser.validate_sheet_exists("Quad Strain Gauge - Rotation"):
                    df, load_cases, stories, piers = parser.get_quad_rotations()
                    story_index = build_story_index(stories)
                    if not df.empty:
                        _import_quad_rotations(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            story_index,
                            piers,
                            allowed,
                            stories_map,
                            load_cases_map,
                            elements_map,
                        )
                        imported_by_sheet.setdefault("Quad Strain Gauge - Rotation", set()).update(
                            set(load_cases) & allowed
                        )

                # Import column forces (shears and axials)
                if parser.validate_sheet_exists("Element Forces - Columns"):
                    df, load_cases, stories, columns = parser.get_column_forces()
                    story_index = build_story_index(stories)
                    if not df.empty:
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
                        imported_by_sheet.setdefault("Element Forces - Columns", set()).update(
                            set(load_cases) & allowed
                        )

                # Import column rotations (fiber hinge)
                if parser.validate_sheet_exists("Fiber Hinge States"):
                    df, load_cases, stories, columns = parser.get_fiber_hinge_states()
                    story_index = build_story_index(stories)
                    if not df.empty:
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
                        imported_by_sheet.setdefault("Fiber Hinge States", set()).update(
                            set(load_cases) & allowed
                        )

                # Import beam rotations (hinge states)
                if parser.validate_sheet_exists("Hinge States"):
                    df, load_cases, stories, beams = parser.get_hinge_states()
                    story_index = build_story_index(stories)
                    if not df.empty:
                        _import_beam_rotations(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            story_index,
                            beams,
                            allowed,
                            stories_map,
                            load_cases_map,
                            elements_map,
                        )
                        imported_by_sheet.setdefault("Hinge States", set()).update(
                            set(load_cases) & allowed
                        )

                # --- Joint Results ---

                # Import soil pressures
                if parser.validate_sheet_exists("Soil Pressures"):
                    df, load_cases, _unique_elements = parser.get_soil_pressures()
                    if not df.empty:
                        _import_soil_pressures(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            allowed,
                            load_cases_map,
                        )
                        imported_by_sheet.setdefault("Soil Pressures", set()).update(
                            set(load_cases) & allowed
                        )

                # Import vertical displacements (foundation joints)
                if foundation_joints and parser.validate_sheet_exists("Joint Displacements"):
                    df, load_cases, _unique_joints = parser.get_vertical_displacements(
                        foundation_joints
                    )
                    if not df.empty:
                        _import_vertical_displacements(
                            project,
                            result_set,
                            result_category,
                            df,
                            load_cases,
                            allowed,
                            load_cases_map,
                        )
                        imported_by_sheet.setdefault("Vertical Displacements", set()).update(
                            set(load_cases) & allowed
                        )

                # --- Time-Series Data ---
                # Parse time-history step-by-step data if present
                if parser.has_time_series_data():
                    th_result = parser.parse_time_history()
                    if th_result and th_result.load_case_name in allowed:
                        time_history_results.append(th_result)

            stats["files_processed"] += 1

        except Exception as exc:
            stats["errors"].append(f"{file_name}: {str(exc)}")
            logger.exception("Error processing file %s", file_name)

    # Count imported items
    stats["load_cases_imported"] = len(load_cases_map)
    stats["stories_imported"] = len(stories_map)
    stats["elements_imported"] = len(elements_map)
    stats["time_history_results"] = time_history_results
    stats["stories_map"] = stories_map

    return stats
