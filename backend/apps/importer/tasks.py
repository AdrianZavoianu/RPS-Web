"""Celery tasks for import processing."""

import logging
from pathlib import Path
from typing import Dict, List, Optional, Set

from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db import transaction
from django.utils import timezone

from apps.projects.models import Project, Story, Element
from apps.results.models import (
    ResultSet,
    ResultCategory,
    WallShear,
    QuadRotation,
    ColumnShear,
    ColumnAxial,
    ColumnRotation,
    BeamRotation,
    SoilPressure,
    VerticalDisplacement,
    PushoverCase,
    PushoverCurvePoint,
)
from apps.importer.models import ImportJob
from apps.importer.parsers.excel_parser import ExcelParser, TimeHistoryParseResult
from apps.importer.services.import_preparation import (
    ImportPreparationService,
    determine_allowed_load_cases,
)
from apps.importer.services.global_aggregation import build_story_index
from apps.importer.services.global_result_importers import (
    get_or_create_load_case as _get_or_create_load_case,
    get_or_create_story as _get_or_create_story,
    import_story_accelerations as _import_story_accelerations,
    import_story_displacements as _import_story_displacements,
    import_story_drifts as _import_story_drifts,
    import_story_forces as _import_story_forces,
)
from apps.importer.services.cache_builder import CacheBuilderService

logger = logging.getLogger(__name__)


def _to_float(value) -> Optional[float]:
    """Convert incoming sheet values to float, returning None for invalid/NaN."""
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed != parsed:  # NaN check
        return None
    return parsed


def send_progress(job_id: int, phase: str, message: str, current: int, total: int):
    """Send progress update via WebSocket."""
    channel_layer = get_channel_layer()
    group_name = f"import_{job_id}"
    percent = int((current / total) * 100) if total > 0 else 0

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "import_progress",
            "phase": phase,
            "message": message,
            "current": current,
            "total": total,
            "percent": percent,
        },
    )


def send_complete(job_id: int, status: str, message: str, result_set_id: Optional[int] = None):
    """Send completion notification via WebSocket."""
    channel_layer = get_channel_layer()
    group_name = f"import_{job_id}"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "import_complete",
            "status": status,
            "message": message,
            "result_set_id": result_set_id,
        },
    )


def send_error(job_id: int, message: str, details: str = ""):
    """Send error notification via WebSocket."""
    channel_layer = get_channel_layer()
    group_name = f"import_{job_id}"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "import_error",
            "message": message,
            "details": details,
        },
    )


@shared_task(bind=True, max_retries=0)
def prescan_files_task(self, job_id: int) -> Dict:
    """Prescan uploaded files to discover load cases and conflicts.

    Returns:
        Dict with prescan results for UI display
    """
    job = ImportJob.objects.get(id=job_id)
    job.status = "scanning"
    job.current_phase = "Scanning files"
    job.celery_task_id = self.request.id
    job.started_at = timezone.now()
    job.save()

    try:
        files = [Path(f) for f in job.files]
        service = ImportPreparationService()

        # Throttle DB saves - only save on file boundaries, not every progress message
        last_saved_current = [0]

        def progress_callback(msg, current, total):
            # Always send WebSocket progress
            send_progress(job_id, "scanning", msg, current, total)
            # Only save to DB when current file changes (not on every message)
            if current != last_saved_current[0]:
                last_saved_current[0] = current
                job.progress_current = current
                job.progress_total = total
                job.save(update_fields=["progress_current", "progress_total"])

        result = service.prescan_files(files, progress_callback=progress_callback)

        # Store prescan result in job config
        job.job_config["prescan"] = {
            "file_load_cases": result.file_load_cases,
            "foundation_joints": result.foundation_joints,
            "files_scanned": result.files_scanned,
            "errors": result.errors,
        }
        job.status = "pending"  # Ready for user to select load cases
        job.current_phase = "Awaiting selection"
        job.save()

        return {
            "file_load_cases": result.file_load_cases,
            "foundation_joints": result.foundation_joints,
            "files_scanned": result.files_scanned,
            "errors": result.errors,
        }

    except Exception as e:
        logger.exception(f"Prescan failed for job {job_id}")
        job.status = "failed"
        job.error_message = str(e)
        job.save()
        send_error(job_id, "Prescan failed", str(e))
        raise


@shared_task(bind=True, max_retries=0)
def process_import_task(self, job_id: int) -> Dict:
    """Process the import job after user has selected load cases.

    Expects job.job_config to contain:
        - selected_load_cases: List of load case names to import
        - conflict_resolution: Dict of {sheet: {load_case: chosen_file}}
        - result_set_name: Name for the new result set
        - prescan: The prescan results

    Returns:
        Dict with import statistics
    """
    job = ImportJob.objects.get(id=job_id)
    job.status = "processing"
    job.current_phase = "Processing files"
    job.celery_task_id = self.request.id
    job.started_at = timezone.now()
    job.save()

    try:
        config = job.job_config
        files = [Path(f) for f in job.files]
        selected_load_cases = set(config.get("selected_load_cases", []))
        conflict_resolution = config.get("conflict_resolution", {})
        result_set_name = config.get("result_set_name", "Imported Results")
        result_set_id = config.get("result_set_id")
        prescan = config.get("prescan", {})
        file_load_cases = prescan.get("file_load_cases", {})
        foundation_joints = prescan.get("foundation_joints", [])

        # If no load cases selected, import all
        if not selected_load_cases:
            for sheets in file_load_cases.values():
                for load_cases in sheets.values():
                    selected_load_cases.update(load_cases)

        # Throttle DB saves - only save on file boundaries, not every progress message
        last_saved_current = [0]

        def progress_callback(msg, current, total):
            send_progress(job_id, "importing", msg, current, total)
            if current != last_saved_current[0]:
                last_saved_current[0] = current
                job.progress_current = current
                job.progress_total = total
                job.save(update_fields=["progress_current", "progress_total"])

        # Run the import
        stats = _run_import(
            job=job,
            files=files,
            file_load_cases=file_load_cases,
            selected_load_cases=selected_load_cases,
            conflict_resolution=conflict_resolution,
            result_set_name=result_set_name,
            result_set_id=result_set_id,
            foundation_joints=foundation_joints,
            progress_callback=progress_callback,
        )

        # Build cache tables
        job.status = "building_cache"
        job.current_phase = "Building cache"
        job.save()

        result_set = job.result_set
        if result_set:

            def cache_progress(msg, current, total):
                send_progress(job_id, "caching", msg, current, total)

            cache_builder = CacheBuilderService(
                project=job.project,
                result_set=result_set,
                progress_callback=cache_progress,
                compute_aggregates=False,  # Disabled for import speed; aggregates computed on-demand
            )
            cache_stats = cache_builder.build_all_caches()

            # Build time-series cache if we have time-history data
            time_history_results = stats.pop("time_history_results", [])
            stories_map = stats.pop("stories_map", {})

            if time_history_results:
                cache_progress("Building time-series cache...", 1, 2)
                ts_rows = cache_builder.build_time_series_cache(time_history_results, stories_map)
                cache_stats["time_series_cache_rows"] = ts_rows
                cache_progress("Time-series cache complete", 2, 2)

            stats.update(cache_stats)

        # Update job with results
        job.status = "completed"
        job.current_phase = "Completed"
        job.import_summary = stats
        job.completed_at = timezone.now()
        job.save()

        send_complete(
            job_id,
            "success",
            f"Import completed: {stats.get('files_processed', 0)} files, {stats.get('load_cases_imported', 0)} load cases",
            stats.get("result_set_id"),
        )

        return stats

    except Exception as e:
        logger.exception(f"Import failed for job {job_id}")
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = timezone.now()
        job.save()
        send_error(job_id, "Import failed", str(e))
        raise


def _run_import(
    job: ImportJob,
    files: List[Path],
    file_load_cases: Dict[str, Dict[str, List[str]]],
    selected_load_cases: Set[str],
    conflict_resolution: Dict,
    result_set_name: str,
    result_set_id: Optional[int],
    foundation_joints: List[str],
    progress_callback,
) -> Dict:
    """Run the actual import process."""
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
        allowed, skipped = determine_allowed_load_cases(
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
                    df, load_cases, unique_elements = parser.get_soil_pressures()
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
                    df, load_cases, unique_joints = parser.get_vertical_displacements(
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

        except Exception as e:
            stats["errors"].append(f"{file_name}: {str(e)}")
            logger.exception(f"Error processing file {file_name}")

    # Count imported items
    stats["load_cases_imported"] = len(load_cases_map)
    stats["stories_imported"] = len(stories_map)
    stats["elements_imported"] = len(elements_map)
    stats["time_history_results"] = time_history_results
    stats["stories_map"] = stories_map

    return stats


def _get_or_create_element(
    project: Project,
    element_type: str,
    name: str,
    unique_name: str,
    story: Optional[Story],
    elements_map: Dict,
) -> Element:
    """Get or create an Element, using cache."""
    cache_key = (element_type, unique_name)
    if cache_key in elements_map:
        return elements_map[cache_key]

    element, created = Element.objects.get_or_create(
        project=project,
        element_type=element_type,
        unique_name=unique_name,
        defaults={
            "name": name,
            "story": story,
        },
    )
    elements_map[cache_key] = element
    return element


def _import_wall_shears(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    piers: List[str],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
    elements_map: Dict,
):
    """Import wall/pier shear force data from Pier Forces sheet."""
    if df.empty:
        return

    # Desktop parity: use Bottom location only and aggregate per story/pier/load case.
    shear_stats: Dict[tuple, Dict[str, float]] = {}

    for _, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        location = str(row.get("Location", "")).strip().lower()
        if location != "bottom":
            continue

        story_name = row.get("Story")
        pier_name = row.get("Pier")
        if not story_name or not pier_name:
            continue

        for direction in ("V2", "V3"):
            value = _to_float(row.get(direction))
            if value is None:
                continue

            key = (story_name, pier_name, case_name, direction)
            current = shear_stats.get(key)
            if current is None:
                shear_stats[key] = {
                    "max": value,
                    "min": value,
                    "abs_max": abs(value),
                }
                continue

            current["max"] = max(current["max"], value)
            current["min"] = min(current["min"], value)
            current["abs_max"] = max(current["abs_max"], abs(value))

    objects_to_create = []
    for (story_name, pier_name, case_name, direction), stats in shear_stats.items():
        sort_order = story_index.get(story_name, 0)
        story = _get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = _get_or_create_load_case(project, case_name, load_cases_map)
        element = _get_or_create_element(project, "Wall", pier_name, pier_name, story, elements_map)

        objects_to_create.append(
            WallShear(
                element=element,
                story=story,
                load_case=load_case,
                result_category=result_category,
                direction=direction,
                location="Bottom",
                story_sort_order=sort_order,
                force=stats["abs_max"],
                max_force=stats["max"],
                min_force=stats["min"],
            )
        )

    if objects_to_create:
        WallShear.objects.bulk_create(objects_to_create, ignore_conflicts=True)


def _import_quad_rotations(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    piers: List[str],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
    elements_map: Dict,
):
    """Import quad strain gauge rotation data."""
    if df.empty:
        return

    objects_to_create = []

    for _, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        story_name = row.get("Story")
        quad_name = row.get("Name", "")
        property_name = row.get("PropertyName", "")
        direction = row.get("Direction", "Pier")
        step_type_raw = row.get("Step Type", row.get("StepType", ""))
        normalized_step_type = str(step_type_raw).strip().lower()
        if normalized_step_type in {"nan", "none"}:
            normalized_step_type = ""
        if normalized_step_type not in {"max", "min"}:
            # Preserve backward compatibility for legacy rows with blank step type.
            if normalized_step_type != "":
                continue

        if not story_name or not property_name:
            continue

        sort_order = story_index.get(story_name, 0)
        story = _get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = _get_or_create_load_case(project, case_name, load_cases_map)
        element = _get_or_create_element(
            project, "Quad", property_name, property_name, story, elements_map
        )

        max_rotation = _to_float(row.get("MaxRotation"))
        min_rotation = _to_float(row.get("MinRotation"))
        rotation = _to_float(row.get("Rotation"))
        if rotation is None:
            if normalized_step_type == "max":
                rotation = max_rotation
            elif normalized_step_type == "min":
                rotation = min_rotation
            else:
                rotation = max_rotation if max_rotation is not None else min_rotation
        if rotation is None:
            continue

        objects_to_create.append(
            QuadRotation(
                element=element,
                story=story,
                load_case=load_case,
                result_category=result_category,
                quad_name=str(quad_name),
                direction=str(direction or "Pier"),
                story_sort_order=sort_order,
                rotation=rotation,
                max_rotation=max_rotation,
                min_rotation=min_rotation,
            )
        )

    if objects_to_create:
        QuadRotation.objects.bulk_create(objects_to_create, ignore_conflicts=True)


def _import_column_forces(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    columns: List[str],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
    elements_map: Dict,
):
    """Import column shear and axial force data from Element Forces - Columns sheet."""
    if df.empty:
        return

    # Desktop parity: aggregate per story/column/case and keep max/min envelopes.
    shear_stats: Dict[tuple, Dict[str, float]] = {}
    axial_stats: Dict[tuple, Dict[str, float]] = {}

    for _, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        story_name = row.get("Story")
        column_name = row.get("Column", "")
        unique_name = row.get("Unique Name", column_name)
        location_value = row.get("Location", None)
        raw_location = str(location_value).strip() if location_value is not None else ""
        location = raw_location if raw_location in {"Top", "Bottom"} else ""
        if not story_name or not column_name:
            continue

        for direction in ("V2", "V3"):
            value = _to_float(row.get(direction))
            if value is None:
                continue

            shear_key = (story_name, column_name, unique_name, case_name, direction)
            current_shear = shear_stats.get(shear_key)
            if current_shear is None:
                shear_stats[shear_key] = {
                    "max": value,
                    "min": value,
                    "abs_max": abs(value),
                    "location": location,
                }
            else:
                current_shear["max"] = max(current_shear["max"], value)
                current_shear["min"] = min(current_shear["min"], value)
                current_shear["abs_max"] = max(current_shear["abs_max"], abs(value))

        axial_value = _to_float(row.get("P"))
        if axial_value is None:
            continue

        axial_key = (story_name, column_name, unique_name, case_name)
        current_axial = axial_stats.get(axial_key)
        if current_axial is None:
            axial_stats[axial_key] = {
                "min": axial_value,
                "max": axial_value,
                "location": location,
            }
        else:
            current_axial["min"] = min(current_axial["min"], axial_value)
            current_axial["max"] = max(current_axial["max"], axial_value)

    shear_objects = []
    for (story_name, column_name, _unique_name, case_name, direction), stats in shear_stats.items():
        sort_order = story_index.get(story_name, 0)
        story = _get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = _get_or_create_load_case(project, case_name, load_cases_map)
        element = _get_or_create_element(
            project, "Column", column_name, column_name, story, elements_map
        )

        shear_objects.append(
            ColumnShear(
                element=element,
                story=story,
                load_case=load_case,
                result_category=result_category,
                direction=direction,
                location=str(stats.get("location", "")),
                story_sort_order=sort_order,
                force=stats["abs_max"],
                max_force=stats["max"],
                min_force=stats["min"],
            )
        )

    axial_objects = []
    for (story_name, column_name, _unique_name, case_name), stats in axial_stats.items():
        sort_order = story_index.get(story_name, 0)
        story = _get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = _get_or_create_load_case(project, case_name, load_cases_map)
        element = _get_or_create_element(
            project, "Column", column_name, column_name, story, elements_map
        )

        axial_objects.append(
            ColumnAxial(
                element=element,
                story=story,
                load_case=load_case,
                result_category=result_category,
                location=str(stats.get("location", "")),
                story_sort_order=sort_order,
                min_axial=stats["min"],
                max_axial=stats["max"],
            )
        )

    if shear_objects:
        ColumnShear.objects.bulk_create(shear_objects, ignore_conflicts=True)
    if axial_objects:
        ColumnAxial.objects.bulk_create(axial_objects, ignore_conflicts=True)


def _import_column_rotations(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    columns: List[str],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
    elements_map: Dict,
):
    """Import column fiber hinge rotation data."""
    if df.empty:
        return

    # Desktop parity: aggregate Max/Min/absolute per story/column/case/direction.
    rotation_stats: Dict[tuple, Dict[str, float]] = {}

    for _, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        story_name = row.get("Story")
        column_name = row.get("Frame/Wall", "")
        unique_name = row.get("Unique Name", column_name)
        if not story_name or not column_name:
            continue

        for direction in ("R2", "R3"):
            value = _to_float(row.get(direction))
            if value is None:
                continue

            key = (story_name, column_name, unique_name, case_name, direction)
            current = rotation_stats.get(key)
            if current is None:
                rotation_stats[key] = {
                    "max": value,
                    "min": value,
                    "abs_max": abs(value),
                }
            else:
                current["max"] = max(current["max"], value)
                current["min"] = min(current["min"], value)
                current["abs_max"] = max(current["abs_max"], abs(value))

    objects_to_create = []
    for (story_name, column_name, _unique_name, case_name, direction), stats in rotation_stats.items():
        sort_order = story_index.get(story_name, 0)
        story = _get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = _get_or_create_load_case(project, case_name, load_cases_map)
        element = _get_or_create_element(
            project, "Column", column_name, column_name, story, elements_map
        )

        objects_to_create.append(
            ColumnRotation(
                element=element,
                story=story,
                load_case=load_case,
                result_category=result_category,
                direction=direction,
                story_sort_order=sort_order,
                rotation=stats["abs_max"],
                max_rotation=stats["max"],
                min_rotation=stats["min"],
            )
        )

    if objects_to_create:
        ColumnRotation.objects.bulk_create(objects_to_create, ignore_conflicts=True)


def _import_beam_rotations(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    story_index: Dict[str, int],
    beams: List[str],
    allowed_load_cases: Set[str],
    stories_map: Dict,
    load_cases_map: Dict,
    elements_map: Dict,
):
    """Import beam hinge rotation data."""
    if df.empty:
        return

    objects_to_create = []

    for idx, row in df.iterrows():
        case_name = row.get("Output Case", row.get("OutputCase"))
        if case_name not in allowed_load_cases:
            continue

        story_name = row.get("Story")
        beam_name = row.get("Frame/Wall", row.get("FrameWall", ""))
        unique_name = row.get("Unique Name", row.get("UniqueName", beam_name))
        step_type_raw = row.get("Step Type", row.get("StepType", ""))
        step_type_normalized = str(step_type_raw).strip().lower()
        if step_type_normalized in {"nan", "none"}:
            step_type_normalized = ""
        hinge = row.get("Hinge", "")
        generated_hinge = row.get("Generated Hinge", row.get("GeneratedHinge", ""))
        rel_dist = row.get("Rel Dist", row.get("RelDist", None))

        if step_type_normalized in {"max", "min"}:
            step_type = step_type_normalized.title()
        elif step_type_normalized == "":
            step_type = ""
        else:
            # Preserve non-standard step labels instead of dropping source rows.
            step_type = str(step_type_raw).strip()

        sort_order = story_index.get(story_name, 0)
        story = _get_or_create_story(project, story_name, sort_order, stories_map)
        load_case = _get_or_create_load_case(project, case_name, load_cases_map)
        element = _get_or_create_element(
            project, "Beam", beam_name, unique_name, story, elements_map
        )

        # Import R3 Plastic rotation
        r3_plastic_raw = row.get("R3 Plastic", row.get("R3Plastic", None))
        if r3_plastic_raw is None:
            continue
        try:
            r3_plastic = float(r3_plastic_raw)
        except (TypeError, ValueError):
            continue
        objects_to_create.append(
            BeamRotation(
                element=element,
                story=story,
                load_case=load_case,
                result_category=result_category,
                step_type=step_type,
                hinge=str(hinge) if hinge else "",
                generated_hinge=str(generated_hinge) if generated_hinge else "",
                rel_dist=rel_dist,
                story_sort_order=sort_order,
                r3_plastic=r3_plastic,
            )
        )

    if objects_to_create:
        BeamRotation.objects.bulk_create(objects_to_create, ignore_conflicts=True)


def _import_soil_pressures(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    allowed_load_cases: Set[str],
    load_cases_map: Dict,
):
    """Import soil pressure data."""
    if df.empty:
        return

    objects_to_create = []

    for idx, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        shell_object = row.get("Shell Object", "")
        unique_name = row.get("Unique Name", "")
        min_pressure = row.get("Soil Pressure", 0)

        load_case = _get_or_create_load_case(project, case_name, load_cases_map)

        objects_to_create.append(
            SoilPressure(
                project=project,
                result_set=result_set,
                result_category=result_category,
                load_case=load_case,
                shell_object=str(shell_object),
                unique_name=str(unique_name),
                min_pressure=min_pressure,
            )
        )

    if objects_to_create:
        SoilPressure.objects.bulk_create(objects_to_create, ignore_conflicts=True)


def _import_vertical_displacements(
    project: Project,
    result_set: ResultSet,
    result_category: ResultCategory,
    df,
    load_cases: List[str],
    allowed_load_cases: Set[str],
    load_cases_map: Dict,
):
    """Import vertical displacement data for foundation joints."""
    if df.empty:
        return

    objects_to_create = []

    for idx, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        story = row.get("Story", "")
        label = row.get("Label", "")
        unique_name = row.get("Unique Name", "")
        min_uz = row.get("Min Uz", 0)

        load_case = _get_or_create_load_case(project, case_name, load_cases_map)

        objects_to_create.append(
            VerticalDisplacement(
                project=project,
                result_set=result_set,
                result_category=result_category,
                load_case=load_case,
                story=str(story),
                label=str(label),
                unique_name=str(unique_name),
                min_displacement=min_uz,
            )
        )

    if objects_to_create:
        VerticalDisplacement.objects.bulk_create(objects_to_create, ignore_conflicts=True)


# --- Pushover Import ---


@shared_task(bind=True, max_retries=0)
def import_pushover_curves_task(self, job_id: int) -> Dict:
    """Import pushover curve data from uploaded files.

    Creates PushoverCase and PushoverCurvePoint records.

    Returns:
        Dict with import statistics
    """
    job = ImportJob.objects.get(id=job_id)
    job.status = "processing"
    job.current_phase = "Importing pushover curves"
    job.celery_task_id = self.request.id
    job.started_at = timezone.now()
    job.save()

    try:
        config = job.job_config
        files = [Path(f) for f in job.files]
        result_set_name = config.get("result_set_name", "Pushover Results")
        result_set_id = config.get("result_set_id")

        project = job.project
        stats = {
            "files_processed": 0,
            "files_total": len(files),
            "pushover_cases_imported": 0,
            "curve_points_imported": 0,
            "result_set_id": None,
            "errors": [],
        }

        # Throttle DB saves - only save on file boundaries, not every progress message
        last_saved_current = [0]

        def progress_callback(msg, current, total):
            send_progress(job_id, "importing", msg, current, total)
            if current != last_saved_current[0]:
                last_saved_current[0] = current
                job.progress_current = current
                job.progress_total = total
                job.save(update_fields=["progress_current", "progress_total"])

        # Create or get result set
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
            stats["result_set_id"] = result_set.id
            job.result_set = result_set
            job.save(update_fields=["result_set"])

        for idx, file_path in enumerate(files):
            progress_callback(f"Processing {file_path.name}...", idx + 1, len(files))

            try:
                with ExcelParser(str(file_path)) as parser:
                    # Check if file has pushover data
                    pushover_cases = parser.get_pushover_cases()
                    if not pushover_cases:
                        continue

                    # Get curve data
                    curve_df, cases = parser.get_pushover_curve_data()
                    if curve_df.empty:
                        continue

                    # Import curves
                    for case_name in cases:
                        direction = ExcelParser.detect_pushover_direction(case_name)

                        # Create or get pushover case
                        pushover_case, created = PushoverCase.objects.get_or_create(
                            project=project,
                            result_set=result_set,
                            name=case_name,
                            defaults={"direction": direction},
                        )

                        if created:
                            stats["pushover_cases_imported"] += 1

                        # Get curve points for this case
                        case_df = curve_df[curve_df["Case"] == case_name]

                        # Delete existing points if re-importing
                        PushoverCurvePoint.objects.filter(pushover_case=pushover_case).delete()

                        # Create curve points
                        points_to_create = []
                        for _, row in case_df.iterrows():
                            points_to_create.append(
                                PushoverCurvePoint(
                                    pushover_case=pushover_case,
                                    step_number=int(row["Step"]),
                                    displacement=float(row["Displacement"]),
                                    base_shear=float(row["BaseShear"]),
                                )
                            )

                        if points_to_create:
                            PushoverCurvePoint.objects.bulk_create(points_to_create)
                            stats["curve_points_imported"] += len(points_to_create)

                stats["files_processed"] += 1

            except Exception as e:
                stats["errors"].append(f"{file_path.name}: {str(e)}")
                logger.exception(f"Error processing pushover file {file_path.name}")

        # Update job with results
        job.status = "completed"
        job.current_phase = "Completed"
        job.import_summary = stats
        job.completed_at = timezone.now()
        job.save()

        send_complete(
            job_id,
            "success",
            f"Pushover import completed: {stats['pushover_cases_imported']} cases, "
            f"{stats['curve_points_imported']} points",
            stats.get("result_set_id"),
        )

        return stats

    except Exception as e:
        logger.exception(f"Pushover import failed for job {job_id}")
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = timezone.now()
        job.save()
        send_error(job_id, "Pushover import failed", str(e))
        raise
