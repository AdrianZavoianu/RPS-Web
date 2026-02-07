"""
Celery tasks for export processing.
"""
import logging
from datetime import timedelta
from io import BytesIO

from celery import shared_task
from django.core.files.base import ContentFile
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment

from apps.results.models import ResultSet
from apps.results.services import ResultDataService
from .models import ExportJob

logger = logging.getLogger(__name__)


def _get_export_table_rows(
    service: ResultDataService,
    result_set: ResultSet,
    result_type: str,
    direction: str,
    include_summary: bool,
):
    """
    Build export-ready table headers and rows from canonical result datasets.
    Returns None when no data exists for the result type/direction.
    """
    dataset = service.get_global_results(
        result_set_id=result_set.id,
        result_type=result_type,
        direction=direction,
    )
    if dataset is None:
        return None

    story_column = dataset.story_column
    load_case_columns = list(dataset.load_case_columns)
    summary_columns = list(dataset.summary_columns) if include_summary else []

    headers = [story_column, *load_case_columns, *summary_columns]
    rows = []
    for row in dataset.rows:
        if story_column not in row:
            raise KeyError(f"Missing '{story_column}' in export row for {result_type}_{direction}")
        rows.append(
            [
                row[story_column],
                *[row.get(col) for col in load_case_columns],
                *[row.get(col) for col in summary_columns],
            ]
        )

    return headers, rows


@shared_task(bind=True)
def process_export_job(self, job_id: int):
    """Process export job and generate output file."""
    try:
        job = ExportJob.objects.get(id=job_id)
    except ExportJob.DoesNotExist:
        logger.error(f"Export job {job_id} not found")
        return

    try:
        job.status = "processing"
        config = dict(job.export_config or {})
        result_set_id = config.get("result_set_id")
        result_types = config.get("result_types", [])
        directions = config.get("directions", ["X", "Y"])
        include_summary = config.get("include_summary", True)
        total_units = max(len(result_types) * len(directions), 1)

        config["progress_current"] = 0
        config["progress_total"] = total_units
        job.export_config = config
        job.save(update_fields=["status", "export_config"])

        def update_progress(current: int, total: int) -> None:
            config["progress_current"] = current
            config["progress_total"] = total
            job.export_config = config
            job.save(update_fields=["export_config"])

        result_set = ResultSet.objects.get(id=result_set_id, project=job.project)

        if job.export_format == "excel":
            output = generate_excel_export(
                job.project,
                result_set,
                result_types,
                directions,
                include_summary,
                progress_callback=update_progress,
            )
            filename = f"{job.project.slug}_{result_set.name}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            job.output_file.save(filename, ContentFile(output.getvalue()))
            job.file_name = filename
            job.file_size = len(output.getvalue())

        elif job.export_format == "csv":
            output = generate_csv_export(
                job.project,
                result_set,
                result_types,
                directions,
                include_summary,
                progress_callback=update_progress,
            )
            filename = f"{job.project.slug}_{result_set.name}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
            job.output_file.save(filename, ContentFile(output.encode("utf-8")))
            job.file_name = filename
            job.file_size = len(output.encode("utf-8"))

        job.status = "completed"
        job.completed_at = timezone.now()
        job.expires_at = timezone.now() + timedelta(hours=24)  # Files expire after 24h
        config["progress_current"] = total_units
        config["progress_total"] = total_units
        job.export_config = config
        job.save()

        logger.info(f"Export job {job_id} completed successfully")

    except (ExportJob.DoesNotExist, ResultSet.DoesNotExist, IOError) as e:
        logger.exception(f"Export job {job_id} failed: {e}")
        job.status = "failed"
        job.error_message = str(e)
        job.save()
    except Exception:
        logger.exception(f"Unexpected export error for job {job_id}")
        job.status = "failed"
        job.error_message = "Unexpected export error"
        job.save()
        raise


def generate_excel_export(
    project,
    result_set,
    result_types,
    directions,
    include_summary,
    progress_callback=None,
):
    """Generate Excel export file."""
    wb = Workbook()
    total_steps = max(len(result_types) * len(directions), 1)
    current_step = 0
    result_service = ResultDataService(project=project)

    # Style definitions
    header_fill = PatternFill(start_color="1c2128", end_color="1c2128", fill_type="solid")
    header_font = Font(bold=True, color="d1d5db")
    border = Border(bottom=Side(style="thin", color="2c313a"))

    # Remove default sheet
    if "Sheet" in wb.sheetnames:
        del wb["Sheet"]

    # Query cache data for each result type and direction
    for result_type in result_types:
        for direction in directions:
            try:
                table_data = _get_export_table_rows(
                    service=result_service,
                    result_set=result_set,
                    result_type=result_type,
                    direction=direction,
                    include_summary=include_summary,
                )
                if table_data is None:
                    continue

                # Create sheet
                sheet_name = f"{result_type}_{direction}"[:31]  # Excel limit
                ws = wb.create_sheet(title=sheet_name)
                headers, rows = table_data

                # Write header
                for col, header in enumerate(headers, 1):
                    cell = ws.cell(row=1, column=col, value=header)
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.border = border
                    cell.alignment = Alignment(horizontal="center")

                # Write data rows
                for row_idx, row_values in enumerate(rows, 2):
                    for col_idx, value in enumerate(row_values, 1):
                        if value is not None:
                            ws.cell(row=row_idx, column=col_idx, value=value)

                # Auto-adjust column widths
                for col in ws.columns:
                    max_length = 0
                    column = col[0].column_letter
                    for cell in col:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except (TypeError, AttributeError):
                            continue
                    ws.column_dimensions[column].width = min(max_length + 2, 20)
            finally:
                current_step += 1
                if progress_callback:
                    progress_callback(current_step, total_steps)

    # If no sheets were created, add a placeholder
    if not wb.sheetnames:
        ws = wb.create_sheet(title="No Data")
        ws.cell(row=1, column=1, value="No data available for export")

    # Save to bytes
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def generate_csv_export(
    project,
    result_set,
    result_types,
    directions,
    include_summary,
    progress_callback=None,
):
    """Generate CSV export (combines all data into single file)."""
    import csv
    from io import StringIO

    output = StringIO()
    writer = csv.writer(output)
    total_steps = max(len(result_types) * len(directions), 1)
    current_step = 0
    result_service = ResultDataService(project=project)

    for result_type in result_types:
        for direction in directions:
            try:
                table_data = _get_export_table_rows(
                    service=result_service,
                    result_set=result_set,
                    result_type=result_type,
                    direction=direction,
                    include_summary=include_summary,
                )
                if table_data is None:
                    continue

                # Section header
                writer.writerow([])
                writer.writerow([f"--- {result_type} {direction} ---"])
                headers, rows = table_data

                # Write header
                writer.writerow(headers)

                # Write data rows
                for row in rows:
                    writer.writerow(["" if value is None else value for value in row])
            finally:
                current_step += 1
                if progress_callback:
                    progress_callback(current_step, total_steps)

    return output.getvalue()
