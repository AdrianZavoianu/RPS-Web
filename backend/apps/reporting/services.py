"""
PDF report generation service using WeasyPrint.
Renders HTML templates to PDF with proper styling.
"""

import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from django.template.loader import render_to_string

from apps.results.services import ResultDataService
from apps.results.services.data_assembler import dataset_to_table_projection
from apps.results.models import ResultSet
from core.logging import build_correlation_context

from .charts import generate_joint_scatter_svg, generate_profile_svg, generate_scatter_svg
from .logo import load_logo_b64
from .report_data import ReportDataService
from .renderers import render_pdf_document
from .styles import REPORT_CSS

logger = logging.getLogger(__name__)


class PDFReportService:
    """Service for generating PDF reports from result data."""

    PAGE_WIDTH_MM = 210
    PAGE_HEIGHT_MM = 297
    MARGIN_MM = 15

    def __init__(self, project):
        self.project = project
        self.report_job_id = uuid.uuid4().hex
        self.result_service = ResultDataService(project)
        self.report_data_service = ReportDataService(project, self.result_service)
        self._logo_uri = load_logo_b64()

    def _report_log_context(self, result_set_id: Optional[int] = None) -> str:
        """Build a consistent log context for report generation lifecycle events."""
        return build_correlation_context(
            project_id=self.project.id,
            project_slug=self.project.slug,
            job_type="report",
            job_id=self.report_job_id,
            result_set_id=result_set_id,
        )

    def get_sections_data(
        self,
        result_set_id: int,
        sections: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Return structured section data (title, table, chart_svg) without rendering PDF."""
        result_set = ResultSet.objects.get(id=result_set_id)
        is_pushover = result_set.analysis_type == "Pushover"
        return [
            s
            for cfg in sections
            if (s := self._build_section(result_set, cfg, is_pushover))
        ]

    def generate_report(
        self,
        result_set_id: int,
        sections: List[Dict[str, Any]],
        project_name: str = None,
    ) -> bytes:
        started_at = time.perf_counter()
        logger.info(
            "Starting PDF report generation (%s, section_count=%s)",
            self._report_log_context(result_set_id),
            len(sections),
        )

        result_set = ResultSet.objects.get(id=result_set_id)
        project_name = project_name or self.project.catalog_project.name
        is_pushover = result_set.analysis_type == "Pushover"

        section_data = []
        for section_config in sections:
            section = self._build_section(result_set, section_config, is_pushover)
            if section:
                section_data.append(section)

        html_content = render_to_string(
            "reporting/report.html",
            {
                "project_name": project_name,
                "result_set_name": result_set.name,
                "logo_uri": self._logo_uri,
                "sections": section_data,
            },
        )

        pdf_bytes = render_pdf_document(
            html_content=html_content,
            css_content=REPORT_CSS,
        )

        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.info(
            "Completed PDF report generation (%s, rendered_sections=%s, bytes=%s, elapsed_ms=%.2f)",
            self._report_log_context(result_set_id),
            len(section_data),
            len(pdf_bytes),
            elapsed_ms,
        )

        return pdf_bytes

    def _build_section(
        self, result_set: ResultSet, config: Dict[str, Any], is_pushover: bool
    ) -> Optional[Dict[str, Any]]:
        category = config.get("category", "Global")
        if category == "Element":
            return self._build_element_section(result_set, config, is_pushover)
        elif category == "Joint":
            return self._build_joint_section(result_set, config, is_pushover)
        else:
            return self._build_global_section(result_set, config, is_pushover)

    # ------------------------------------------------------------------
    # Global section (existing behaviour, now light-themed)
    # ------------------------------------------------------------------

    def _build_global_section(
        self, result_set: ResultSet, config: Dict[str, Any], is_pushover: bool
    ) -> Optional[Dict[str, Any]]:
        result_type = config.get("result_type")
        direction = config.get("direction", "X")
        include_table = config.get("include_table", True)
        include_chart = config.get("include_chart", True)

        try:
            dataset = self.result_service.get_global_results(
                result_set_id=result_set.id,
                result_type=result_type,
                direction=direction,
                is_pushover=is_pushover,
            )
        except Exception:
            logger.exception(
                "Error fetching report section data (%s, result_type=%s, direction=%s)",
                self._report_log_context(result_set.id),
                result_type,
                direction,
            )
            raise

        if not dataset:
            return None

        if not dataset.rows:
            return None

        dataset_dict = dataset.to_dict()

        table_data = None
        if include_table:
            table_data = self._format_global_table(dataset, include_summary=not is_pushover)

        chart_svg = None
        if include_chart:
            chart_svg = generate_profile_svg(
                dataset_dict, result_type, direction, is_pushover
            )

        unit = dataset.meta.unit

        return {
            "title": f"{result_type} {direction}",
            "result_type": result_type,
            "direction": direction,
            "category": "Global",
            "unit": unit,
            "table": table_data,
            "chart_svg": chart_svg,
        }

    # ------------------------------------------------------------------
    # Element sections (Beam/Column Rotations)
    # ------------------------------------------------------------------

    def _build_element_section(
        self, result_set: ResultSet, config: Dict[str, Any], is_pushover: bool
    ) -> Optional[Dict[str, Any]]:
        result_type = config.get("result_type")
        include_table = config.get("include_table", True)
        include_chart = config.get("include_chart", True)

        try:
            if result_type == "BeamRotations":
                report = self.report_data_service.get_beam_rotation_report(
                    result_set.id, is_pushover
                )
            elif result_type == "ColumnRotations":
                report = self.report_data_service.get_column_rotation_report(
                    result_set.id, is_pushover
                )
            else:
                return None
        except Exception:
            logger.exception(
                "Error building element section (%s, result_type=%s)",
                self._report_log_context(result_set.id),
                result_type,
            )
            return None

        if not report or not report.get("top_10"):
            logger.warning(
                "Empty element section data (%s, result_type=%s)",
                self._report_log_context(result_set.id),
                result_type,
            )
            return None

        table_data = None
        if include_table:
            table_data = self._format_element_table(report)

        chart_svg = None
        if include_chart:
            chart_svg = generate_scatter_svg(report, result_type)

        return {
            "title": result_type.replace("Rotations", " Rotations"),
            "result_type": result_type,
            "direction": "",
            "category": "Element",
            "unit": report.get("unit", "%"),
            "table": table_data,
            "chart_svg": chart_svg,
        }

    # ------------------------------------------------------------------
    # Joint sections (Soil Pressures)
    # ------------------------------------------------------------------

    def _build_joint_section(
        self, result_set: ResultSet, config: Dict[str, Any], is_pushover: bool
    ) -> Optional[Dict[str, Any]]:
        result_type = config.get("result_type")
        include_table = config.get("include_table", True)
        include_chart = config.get("include_chart", True)

        try:
            if result_type == "SoilPressures":
                report = self.report_data_service.get_soil_pressure_report(
                    result_set.id, is_pushover
                )
                title = "Soil Pressures"
            elif result_type == "VerticalDisplacements":
                report = self.report_data_service.get_vertical_displacement_report(
                    result_set.id, is_pushover
                )
                title = "Vertical Displacements"
            else:
                return None
        except Exception:
            logger.exception(
                "Error building joint section (%s, result_type=%s)",
                self._report_log_context(result_set.id),
                result_type,
            )
            return None

        if not report or not report.get("top_10"):
            logger.warning(
                "Empty joint section data (%s, result_type=%s)",
                self._report_log_context(result_set.id),
                result_type,
            )
            return None

        table_data = None
        if include_table:
            table_data = self._format_joint_table(report)

        chart_svg = None
        if include_chart:
            chart_svg = generate_joint_scatter_svg(report, result_type)

        return {
            "title": title,
            "result_type": result_type,
            "direction": "",
            "category": "Joint",
            "unit": report.get("unit", "kPa" if result_type == "SoilPressures" else "mm"),
            "table": table_data,
            "chart_svg": chart_svg,
        }

    # ------------------------------------------------------------------
    # Table formatting
    # ------------------------------------------------------------------

    def _format_global_table(self, dataset: Any, include_summary: bool) -> Dict[str, Any]:
        projection = dataset_to_table_projection(
            dataset=dataset,
            include_summary=include_summary,
            fixed_columns=[dataset.story_column],
            required_columns=[dataset.story_column],
        )

        rows = projection["rows"]
        headers = projection["headers"]
        load_case_columns = projection["load_case_columns"]
        summary_columns = projection["summary_columns"]

        display_columns = load_case_columns[:8] + summary_columns[:3]
        header_index = {header: idx for idx, header in enumerate(headers)}

        formatted_rows = []
        for row_values in rows[:20]:
            formatted_row = {
                "label_columns": [row_values[0] if row_values else ""],
                "values": [],
            }
            for col in display_columns:
                column_index = header_index.get(col)
                value = row_values[column_index] if column_index is not None else None
                if value is not None and isinstance(value, (int, float)):
                    formatted_row["values"].append(f"{value:.3f}")
                else:
                    formatted_row["values"].append(str(value) if value else "-")
            formatted_rows.append(formatted_row)

        return {
            "label_headers": ["Story"],
            "columns": display_columns,
            "rows": formatted_rows,
        }

    def _format_element_table(self, report: Dict[str, Any]) -> Dict[str, Any]:
        top_10 = report["top_10"]
        load_cases = report["load_cases"][:8]
        summary_cols = report.get("summary_columns", [])
        fixed_cols = report.get("fixed_columns", [])

        display_columns = load_cases + summary_cols

        formatted_rows = []
        for row in top_10:
            label_values = [str(row.get(fc, "")) for fc in fixed_cols]
            values = []
            for col in display_columns:
                value = row.get(col)
                if value is not None and isinstance(value, (int, float)):
                    values.append(f"{value:.3f}")
                else:
                    values.append(str(value) if value else "-")
            formatted_rows.append({
                "label_columns": label_values,
                "values": values,
            })

        return {
            "label_headers": fixed_cols,
            "columns": display_columns,
            "rows": formatted_rows,
        }

    def _format_joint_table(self, report: Dict[str, Any]) -> Dict[str, Any]:
        top_10 = report["top_10"]
        load_cases = report["load_cases"][:8]
        summary_cols = report.get("summary_columns", [])
        fixed_cols = report.get("fixed_columns", ["Shell Object", "Unique Name"])

        display_columns = load_cases + summary_cols

        formatted_rows = []
        for row in top_10:
            label_values = [str(row.get(fc, "")) for fc in fixed_cols]
            values = []
            for col in display_columns:
                value = row.get(col)
                if value is not None and isinstance(value, (int, float)):
                    values.append(f"{value:.3f}")
                else:
                    values.append(str(value) if value else "-")
            formatted_rows.append({
                "label_columns": label_values,
                "values": values,
            })

        return {
            "label_headers": fixed_cols,
            "columns": display_columns,
            "rows": formatted_rows,
        }

def generate_pdf_report(
    project,
    result_set_id: int,
    sections: List[Dict[str, Any]],
    project_name: str = None,
) -> bytes:
    service = PDFReportService(project)
    return service.generate_report(result_set_id, sections, project_name)
