"""Execution runner for pushover curve imports."""

import logging
from pathlib import Path
from typing import Callable, List, Optional

from django.db import transaction

from apps.importer.models import ImportJob
from apps.importer.parsers.excel_parser import ExcelParser
from apps.results.models import PushoverCase, PushoverCurvePoint, ResultSet

from .import_contracts import PushoverCurveImportStats
from .utils import append_import_error_with_log

logger = logging.getLogger(__name__)


def run_pushover_import(
    *,
    job: ImportJob,
    files: List[Path],
    result_set_name: str,
    result_set_id: Optional[int],
    progress_callback: Callable[[str, int, int], None],
) -> PushoverCurveImportStats:
    """Import pushover curve data from uploaded files."""
    project = job.project
    stats: PushoverCurveImportStats = {
        "files_processed": 0,
        "files_total": len(files),
        "pushover_cases_imported": 0,
        "curve_points_imported": 0,
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
                    for step_number, displacement, base_shear in case_df[
                        ["Step", "Displacement", "BaseShear"]
                    ].itertuples(index=False, name=None):
                        points_to_create.append(
                            PushoverCurvePoint(
                                pushover_case=pushover_case,
                                step_number=int(step_number),
                                displacement=float(displacement),
                                base_shear=float(base_shear),
                            )
                        )

                    if points_to_create:
                        PushoverCurvePoint.objects.bulk_create(points_to_create)
                        stats["curve_points_imported"] += len(points_to_create)

            stats["files_processed"] += 1

        except Exception as exc:
            append_import_error_with_log(
                stats=stats,
                source=file_path.name,
                exc=exc,
                logger=logger,
                log_template="Error processing pushover file %s",
            )

    return stats
