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
from apps.results.models import ResultSet
from core.logging import build_correlation_context

from .logo import load_logo_b64
from .renderers import render_pdf_document
from .report_data import ReportDataService
from .section_builders import build_element_section, build_global_section, build_joint_section
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
        log_ctx = self._report_log_context(result_set.id)
        if category == "Element":
            return build_element_section(
                self.report_data_service, log_ctx, result_set, config, is_pushover
            )
        elif category == "Joint":
            return build_joint_section(
                self.report_data_service, log_ctx, result_set, config, is_pushover
            )
        else:
            return build_global_section(
                self.result_service, log_ctx, result_set, config, is_pushover
            )


def generate_pdf_report(
    project,
    result_set_id: int,
    sections: List[Dict[str, Any]],
    project_name: str = None,
) -> bytes:
    service = PDFReportService(project)
    return service.generate_report(result_set_id, sections, project_name)
