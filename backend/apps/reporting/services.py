"""
PDF report generation service using WeasyPrint.
Renders HTML templates to PDF with proper styling.
"""

import base64
import io
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from django.template.loader import render_to_string
from weasyprint import HTML, CSS

from apps.results.services import ResultDataService
from apps.results.models import ResultSet

logger = logging.getLogger(__name__)


class PDFReportService:
    """Service for generating PDF reports from result data."""

    # A4 page dimensions
    PAGE_WIDTH_MM = 210
    PAGE_HEIGHT_MM = 297
    MARGIN_MM = 15

    def __init__(self, project):
        self.project = project
        self.result_service = ResultDataService(project)

    def generate_report(
        self,
        result_set_id: int,
        sections: List[Dict[str, Any]],
        project_name: str = None,
    ) -> bytes:
        """
        Generate a PDF report for the specified sections.

        Args:
            result_set_id: ID of the result set to include
            sections: List of section configurations, each containing:
                - result_type: 'Drifts', 'Accelerations', etc.
                - direction: 'X', 'Y', etc.
                - include_table: bool
                - include_chart: bool
            project_name: Optional project name for header

        Returns:
            PDF content as bytes
        """
        started_at = time.perf_counter()
        logger.info(
            "Starting PDF report generation (project_id=%s, result_set_id=%s, section_count=%s)",
            self.project.id,
            result_set_id,
            len(sections),
        )

        result_set = ResultSet.objects.get(id=result_set_id)
        project_name = project_name or self.project.catalog_project.name

        # Build section data
        section_data = []
        for section_config in sections:
            section = self._build_section(result_set, section_config)
            if section:
                section_data.append(section)

        # Render HTML template
        html_content = render_to_string(
            'reporting/report.html',
            {
                'project_name': project_name,
                'result_set_name': result_set.name,
                'sections': section_data,
            }
        )

        # Generate PDF
        html = HTML(string=html_content, base_url=str(Path(__file__).parent))
        css = CSS(string=self._get_css())

        pdf_bytes = html.write_pdf(stylesheets=[css])

        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.info(
            "Completed PDF report generation (project_id=%s, result_set_id=%s, rendered_sections=%s, bytes=%s, elapsed_ms=%.2f)",
            self.project.id,
            result_set_id,
            len(section_data),
            len(pdf_bytes),
            elapsed_ms,
        )

        return pdf_bytes

    def _build_section(
        self, result_set: ResultSet, config: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Build section data for a report section."""
        result_type = config.get('result_type')
        direction = config.get('direction', 'X')
        include_table = config.get('include_table', True)
        include_chart = config.get('include_chart', True)

        # Get result data
        try:
            dataset = self.result_service.get_global_results(
                result_set_id=result_set.id,
                result_type=result_type,
                direction=direction,
            )
        except Exception:
            logger.exception(
                "Unexpected error fetching report section data "
                "(project_id=%s, result_set_id=%s, result_type=%s, direction=%s)",
                self.project.id,
                result_set.id,
                result_type,
                direction,
            )
            raise

        if not dataset:
            return None

        dataset_dict = dataset.to_dict()
        if not dataset_dict.get('rows'):
            return None

        # Build table data
        table_data = None
        if include_table:
            table_data = self._format_table_data(dataset_dict)

        # Build chart data (SVG)
        chart_svg = None
        if include_chart:
            chart_svg = self._generate_chart_svg(dataset_dict, result_type, direction)

        # Get unit from config
        unit = dataset_dict.get('meta', {}).get('unit', '')

        return {
            'title': f"{result_type} {direction}",
            'result_type': result_type,
            'direction': direction,
            'unit': unit,
            'table': table_data,
            'chart_svg': chart_svg,
        }

    def _format_table_data(self, dataset: Dict[str, Any]) -> Dict[str, Any]:
        """Format dataset for table display in template."""
        rows = dataset.get('rows', [])
        load_case_columns = dataset.get('load_case_columns', [])
        summary_columns = dataset.get('summary_columns', [])
        story_column = dataset.get('story_column', 'Story')

        # Limit columns for display
        display_columns = load_case_columns[:8] + summary_columns[:3]

        # Format rows
        formatted_rows = []
        for row in rows[:20]:  # Limit to 20 rows
            formatted_row = {
                'story': row.get(story_column, ''),
                'values': []
            }
            for col in display_columns:
                value = row.get(col)
                if value is not None and isinstance(value, (int, float)):
                    formatted_row['values'].append(f"{value:.3f}")
                else:
                    formatted_row['values'].append(str(value) if value else '-')
            formatted_rows.append(formatted_row)

        return {
            'columns': display_columns,
            'rows': formatted_rows,
        }

    def _generate_chart_svg(
        self, dataset: Dict[str, Any], result_type: str, direction: str
    ) -> str:
        """Generate an SVG chart for the building profile."""
        rows = dataset.get('rows', [])
        load_case_columns = dataset.get('load_case_columns', [])
        story_column = dataset.get('story_column', 'Story')
        unit = dataset.get('meta', {}).get('unit', '')

        if not rows or not load_case_columns:
            return ""

        # Chart dimensions
        width = 500
        height = 300
        margin = {'top': 20, 'right': 20, 'bottom': 40, 'left': 60}
        plot_width = width - margin['left'] - margin['right']
        plot_height = height - margin['top'] - margin['bottom']

        # Get data
        stories = [row.get(story_column, '') for row in rows]
        n_stories = len(stories)

        # Calculate value range
        all_values = []
        for row in rows:
            for col in load_case_columns[:12]:
                val = row.get(col)
                if val is not None and isinstance(val, (int, float)):
                    all_values.append(float(val))

        if not all_values:
            return ""

        min_val = min(all_values)
        max_val = max(all_values)
        if min_val == max_val:
            min_val -= 1
            max_val += 1

        # SVG generation
        svg_parts = [
            f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">',
            # Background
            f'<rect width="{width}" height="{height}" fill="#1a1f26"/>',
            # Plot area
            f'<rect x="{margin["left"]}" y="{margin["top"]}" '
            f'width="{plot_width}" height="{plot_height}" fill="#0d1117" stroke="#30363d"/>',
        ]

        # Grid lines
        for i in range(n_stories):
            y = margin['top'] + plot_height - (i + 0.5) / n_stories * plot_height
            svg_parts.append(
                f'<line x1="{margin["left"]}" y1="{y}" '
                f'x2="{margin["left"] + plot_width}" y2="{y}" '
                f'stroke="#30363d" stroke-dasharray="2,2"/>'
            )

        # Colors for load cases
        colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
                  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
                  '#14b8a6', '#a855f7']

        # Draw lines for each load case
        for col_idx, col in enumerate(load_case_columns[:12]):
            color = colors[col_idx % len(colors)]
            points = []
            for i, row in enumerate(rows):
                val = row.get(col)
                if val is None or not isinstance(val, (int, float)):
                    continue
                x = margin['left'] + (float(val) - min_val) / (max_val - min_val) * plot_width
                y = margin['top'] + plot_height - (i + 0.5) / n_stories * plot_height
                points.append(f"{x},{y}")

            if points:
                svg_parts.append(
                    f'<polyline points="{" ".join(points)}" '
                    f'fill="none" stroke="{color}" stroke-width="1.5"/>'
                )

        # Average line
        avg_points = []
        for i, row in enumerate(rows):
            avg_val = row.get('Avg')
            if avg_val is not None and isinstance(avg_val, (int, float)):
                x = margin['left'] + (float(avg_val) - min_val) / (max_val - min_val) * plot_width
                y = margin['top'] + plot_height - (i + 0.5) / n_stories * plot_height
                avg_points.append(f"{x},{y}")

        if avg_points:
            svg_parts.append(
                f'<polyline points="{" ".join(avg_points)}" '
                f'fill="none" stroke="#facc15" stroke-width="2" stroke-dasharray="4,2"/>'
            )

        # Y-axis labels (stories)
        for i, story in enumerate(stories):
            y = margin['top'] + plot_height - (i + 0.5) / n_stories * plot_height + 4
            svg_parts.append(
                f'<text x="{margin["left"] - 5}" y="{y}" '
                f'fill="#9ca3af" font-size="10" text-anchor="end">{story}</text>'
            )

        # X-axis ticks
        n_ticks = 5
        for i in range(n_ticks + 1):
            val = min_val + (max_val - min_val) * i / n_ticks
            x = margin['left'] + i / n_ticks * plot_width
            svg_parts.append(
                f'<text x="{x}" y="{height - margin["bottom"] + 15}" '
                f'fill="#9ca3af" font-size="10" text-anchor="middle">{val:.2f}</text>'
            )

        # Axis labels
        svg_parts.append(
            f'<text x="{margin["left"] + plot_width / 2}" y="{height - 5}" '
            f'fill="#e5e7eb" font-size="11" text-anchor="middle">'
            f'{result_type} ({unit})</text>'
        )

        # Y-axis label
        svg_parts.append(
            f'<text x="15" y="{margin["top"] + plot_height / 2}" '
            f'fill="#e5e7eb" font-size="11" text-anchor="middle" '
            f'transform="rotate(-90, 15, {margin["top"] + plot_height / 2})">Story</text>'
        )

        svg_parts.append('</svg>')
        return '\n'.join(svg_parts)

    def _get_css(self) -> str:
        """Get CSS for PDF styling."""
        return """
        @page {
            size: A4;
            margin: 15mm;
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 10pt;
            color: #1f2937;
            line-height: 1.4;
            margin: 0;
            padding: 0;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
            border-bottom: 1px solid #d1d5db;
            margin-bottom: 16px;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .logo {
            width: 40px;
            height: auto;
        }

        .project-name {
            font-size: 14pt;
            font-weight: 600;
            color: #1f5c6a;
        }

        .result-set-name {
            font-size: 10pt;
            color: #6b7280;
        }

        .section {
            page-break-inside: avoid;
            margin-bottom: 24px;
        }

        .section-title {
            font-size: 12pt;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 12px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e5e7eb;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
            margin-bottom: 16px;
        }

        .data-table th {
            background-color: #f3f4f6;
            font-weight: 600;
            text-align: center;
            padding: 4px 6px;
            border: 1px solid #d1d5db;
        }

        .data-table td {
            text-align: center;
            padding: 3px 6px;
            border: 1px solid #e5e7eb;
        }

        .data-table tr:nth-child(even) td {
            background-color: #f9fafb;
        }

        .chart-container {
            width: 100%;
            text-align: center;
            margin-top: 12px;
        }

        .chart-container svg {
            max-width: 100%;
            height: auto;
        }

        .footer {
            position: fixed;
            bottom: 10mm;
            right: 15mm;
            font-size: 9pt;
            color: #9ca3af;
        }

        @page {
            @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
            }
        }
        """


def generate_pdf_report(
    project,
    result_set_id: int,
    sections: List[Dict[str, Any]],
    project_name: str = None,
) -> bytes:
    """
    Convenience function to generate a PDF report.

    Args:
        project: Project instance
        result_set_id: ID of the result set
        sections: List of section configurations
        project_name: Optional project name

    Returns:
        PDF content as bytes
    """
    service = PDFReportService(project)
    return service.generate_report(result_set_id, sections, project_name)
