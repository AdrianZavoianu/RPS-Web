"""Execution runner for pushover global results import.

Writes directly to GlobalResultsCache (skipping normalized models)
since the web app's result service reads from cache tables.
"""

import logging
from pathlib import Path
from typing import Callable, Dict, List, Optional

import pandas as pd
from django.db import transaction

from apps.importer.models import ImportJob
from apps.importer.parsers.excel_parser import ExcelParser
from apps.projects.models import Project, Story
from apps.results.models import GlobalResultsCache, ResultSet

logger = logging.getLogger(__name__)

# Maps (result_type_key, direction) -> cache result_type string
CACHE_TYPE_MAP = {
    ("drifts", "X"): "Drifts_X",
    ("drifts", "Y"): "Drifts_Y",
    ("forces", "X"): "Forces_VX",
    ("forces", "Y"): "Forces_VY",
    ("displacements", "X"): "Displacements_UX",
    ("displacements", "Y"): "Displacements_UY",
}


def run_pushover_results_import(
    *,
    job: ImportJob,
    files: List[Path],
    result_set_name: str,
    result_set_id: Optional[int],
    progress_callback: Callable[[str, int, int], None],
) -> Dict:
    """Import pushover global results and write directly to cache."""
    project = job.project
    stats: Dict = {
        "files_processed": 0,
        "files_total": len(files),
        "cache_rows_written": 0,
        "directions_imported": [],
        "result_set_id": None,
        "errors": [],
    }

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

    # Collect all global results across files, accumulating per direction
    # Structure: { cache_type: { story_name: { lc_name: value, ... }, ... } }
    accumulated_data: Dict[str, Dict[str, Dict[str, float]]] = {}
    story_order_map: Dict[str, int] = {}  # story_name -> sort_order

    for idx, file_path in enumerate(files):
        progress_callback(f"Processing {file_path.name}...", idx + 1, len(files))

        try:
            with ExcelParser(str(file_path)) as parser:
                directions = parser.get_pushover_directions()
                if not directions:
                    continue

                for direction in directions:
                    if direction == "XY":
                        continue  # Skip XY for now, handle X and Y separately

                    results = parser.get_pushover_global_results(direction)

                    for result_key, df in results.items():
                        if df is None or df.empty:
                            continue

                        cache_type_key = (result_key, direction)
                        cache_type = CACHE_TYPE_MAP.get(cache_type_key)
                        if cache_type is None:
                            continue

                        if cache_type not in accumulated_data:
                            accumulated_data[cache_type] = {}

                        story_col = df.columns[0]  # "Story"
                        load_case_cols = [c for c in df.columns[1:] if not pd.isna(c)]

                        for row_idx, row in df.iterrows():
                            story_name = str(row[story_col])
                            if story_name not in story_order_map:
                                story_order_map[story_name] = len(story_order_map)

                            if story_name not in accumulated_data[cache_type]:
                                accumulated_data[cache_type][story_name] = {}

                            for lc_name in load_case_cols:
                                value = row[lc_name]
                                if pd.isna(value):
                                    continue
                                accumulated_data[cache_type][story_name][str(lc_name)] = float(value)

                    if direction not in stats["directions_imported"]:
                        stats["directions_imported"].append(direction)

            stats["files_processed"] += 1

        except Exception as exc:
            stats["errors"].append(f"{file_path.name}: {str(exc)}")
            logger.exception("Error processing pushover file %s", file_path.name)

    if not accumulated_data:
        return stats

    # Ensure stories exist and build cache
    progress_callback("Building cache...", len(files), len(files))

    with transaction.atomic():
        # Ensure all stories exist
        story_objects: Dict[str, Story] = {}
        for story_name, sort_order in story_order_map.items():
            story, _ = Story.objects.get_or_create(
                project=project,
                name=story_name,
                defaults={"sort_order": sort_order},
            )
            story_objects[story_name] = story

        # Delete existing cache for this result set (for the types we're writing)
        for cache_type in accumulated_data:
            GlobalResultsCache.objects.filter(
                project=project,
                result_set=result_set,
                result_type=cache_type,
            ).delete()

        # Write cache rows
        cache_rows = []
        for cache_type, stories_data in accumulated_data.items():
            for story_name, results_matrix in stories_data.items():
                story = story_objects.get(story_name)
                if story is None:
                    continue

                cache_rows.append(
                    GlobalResultsCache(
                        project=project,
                        result_set=result_set,
                        result_type=cache_type,
                        story=story,
                        results_matrix=results_matrix,
                        story_sort_order=story_order_map.get(story_name, 0),
                    )
                )

        if cache_rows:
            GlobalResultsCache.objects.bulk_create(cache_rows)
            stats["cache_rows_written"] = len(cache_rows)

    return stats
