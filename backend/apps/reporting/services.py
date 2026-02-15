"""
PDF report generation service using WeasyPrint.
Renders HTML templates to PDF with proper styling.
"""

import base64
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from django.template.loader import render_to_string
from weasyprint import HTML, CSS

from apps.results.services import ResultDataService
from apps.results.models import ResultSet

from .report_data import ReportDataService

logger = logging.getLogger(__name__)

# Print-optimized palette (desktop parity)
PLOT_COLORS = [
    "#dc2626",  # red
    "#2563eb",  # blue
    "#16a34a",  # green
    "#ea580c",  # orange
    "#9333ea",  # purple
    "#0891b2",  # cyan
    "#ca8a04",  # yellow
    "#db2777",  # pink
    "#4f46e5",  # indigo
    "#059669",  # emerald
    "#d97706",  # amber
    "#7c3aed",  # violet
]

LOGO_PATH = Path(__file__).parent / "static" / "reporting" / "RPS_Logo.png"


def _load_logo_b64() -> str:
    """Load logo as base64 data URI."""
    if LOGO_PATH.exists():
        data = LOGO_PATH.read_bytes()
        b64 = base64.b64encode(data).decode("ascii")
        return f"data:image/png;base64,{b64}"
    return ""


class PDFReportService:
    """Service for generating PDF reports from result data."""

    PAGE_WIDTH_MM = 210
    PAGE_HEIGHT_MM = 297
    MARGIN_MM = 15

    def __init__(self, project):
        self.project = project
        self.result_service = ResultDataService(project)
        self.report_data_service = ReportDataService(project, self.result_service)
        self._logo_uri = _load_logo_b64()

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
            "Starting PDF report generation (project_id=%s, result_set_id=%s, section_count=%s)",
            self.project.id,
            result_set_id,
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
                "Error fetching report section data (project_id=%s, result_set_id=%s, result_type=%s, direction=%s)",
                self.project.id,
                result_set.id,
                result_type,
                direction,
            )
            raise

        if not dataset:
            return None

        dataset_dict = dataset.to_dict()
        if not dataset_dict.get("rows"):
            return None

        table_data = None
        if include_table:
            table_data = self._format_global_table(dataset_dict)

        chart_svg = None
        if include_chart:
            chart_svg = self._generate_profile_svg(dataset_dict, result_type, direction, is_pushover)

        unit = dataset_dict.get("meta", {}).get("unit", "")

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

        if not report or not report.get("top_10"):
            return None

        table_data = None
        if include_table:
            table_data = self._format_element_table(report)

        chart_svg = None
        if include_chart:
            chart_svg = self._generate_scatter_svg(report, result_type)

        return {
            "title": result_type.replace("Rotations", " Rotations"),
            "result_type": result_type,
            "direction": None,
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

        if result_type == "SoilPressures":
            report = self.report_data_service.get_soil_pressure_report(
                result_set.id, is_pushover
            )
        else:
            return None

        if not report or not report.get("top_10"):
            return None

        table_data = None
        if include_table:
            table_data = self._format_joint_table(report)

        chart_svg = None
        if include_chart:
            chart_svg = self._generate_joint_scatter_svg(report, result_type)

        return {
            "title": "Soil Pressures",
            "result_type": result_type,
            "direction": None,
            "category": "Joint",
            "unit": report.get("unit", "kPa"),
            "table": table_data,
            "chart_svg": chart_svg,
        }

    # ------------------------------------------------------------------
    # Table formatting
    # ------------------------------------------------------------------

    def _format_global_table(self, dataset: Dict[str, Any]) -> Dict[str, Any]:
        rows = dataset.get("rows", [])
        load_case_columns = dataset.get("load_case_columns", [])
        summary_columns = dataset.get("summary_columns", [])
        story_column = dataset.get("story_column", "Story")

        display_columns = load_case_columns[:8] + summary_columns[:3]

        formatted_rows = []
        for row in rows[:20]:
            formatted_row = {
                "label_columns": [row.get(story_column, "")],
                "values": [],
            }
            for col in display_columns:
                value = row.get(col)
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

    # ------------------------------------------------------------------
    # SVG Chart: Building Profile (light theme)
    # ------------------------------------------------------------------

    def _generate_profile_svg(
        self,
        dataset: Dict[str, Any],
        result_type: str,
        direction: str,
        is_pushover: bool,
    ) -> str:
        rows = dataset.get("rows", [])
        load_case_columns = dataset.get("load_case_columns", [])
        story_column = dataset.get("story_column", "Story")
        unit = dataset.get("meta", {}).get("unit", "")

        if not rows or not load_case_columns:
            return ""

        width = 500
        height = 300
        margin = {"top": 20, "right": 20, "bottom": 40, "left": 60}
        plot_width = width - margin["left"] - margin["right"]
        plot_height = height - margin["top"] - margin["bottom"]

        stories = [row.get(story_column, "") for row in rows]
        n_stories = len(stories)

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

        svg_parts = [
            f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">',
            f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
            f'<rect x="{margin["left"]}" y="{margin["top"]}" '
            f'width="{plot_width}" height="{plot_height}" fill="#f8f9fa" stroke="#d1d5db"/>',
        ]

        # Grid lines
        for i in range(n_stories):
            y = margin["top"] + plot_height - (i + 0.5) / n_stories * plot_height
            svg_parts.append(
                f'<line x1="{margin["left"]}" y1="{y}" '
                f'x2="{margin["left"] + plot_width}" y2="{y}" '
                f'stroke="#e5e7eb" stroke-dasharray="2,2"/>'
            )

        # Load case lines
        for col_idx, col in enumerate(load_case_columns[:12]):
            color = PLOT_COLORS[col_idx % len(PLOT_COLORS)]
            points = []
            for i, row in enumerate(rows):
                val = row.get(col)
                if val is None or not isinstance(val, (int, float)):
                    continue
                x = margin["left"] + (float(val) - min_val) / (max_val - min_val) * plot_width
                y = margin["top"] + plot_height - (i + 0.5) / n_stories * plot_height
                points.append(f"{x},{y}")

            if points:
                svg_parts.append(
                    f'<polyline points="{" ".join(points)}" '
                    f'fill="none" stroke="{color}" stroke-width="1.5"/>'
                )

        # Average line (skip for pushover)
        if not is_pushover:
            avg_points = []
            for i, row in enumerate(rows):
                avg_val = row.get("Avg")
                if avg_val is not None and isinstance(avg_val, (int, float)):
                    x = margin["left"] + (float(avg_val) - min_val) / (max_val - min_val) * plot_width
                    y = margin["top"] + plot_height - (i + 0.5) / n_stories * plot_height
                    avg_points.append(f"{x},{y}")

            if avg_points:
                svg_parts.append(
                    f'<polyline points="{" ".join(avg_points)}" '
                    f'fill="none" stroke="#c2410c" stroke-width="2" stroke-dasharray="4,2"/>'
                )

        # Y-axis labels
        for i, story in enumerate(stories):
            y = margin["top"] + plot_height - (i + 0.5) / n_stories * plot_height + 4
            svg_parts.append(
                f'<text x="{margin["left"] - 5}" y="{y}" '
                f'fill="#374151" font-size="10" text-anchor="end">{story}</text>'
            )

        # X-axis ticks
        n_ticks = 5
        for i in range(n_ticks + 1):
            val = min_val + (max_val - min_val) * i / n_ticks
            x = margin["left"] + i / n_ticks * plot_width
            svg_parts.append(
                f'<text x="{x}" y="{height - margin["bottom"] + 15}" '
                f'fill="#374151" font-size="10" text-anchor="middle">{val:.2f}</text>'
            )

        # Axis label
        svg_parts.append(
            f'<text x="{margin["left"] + plot_width / 2}" y="{height - 5}" '
            f'fill="#1f2937" font-size="11" text-anchor="middle">'
            f"{result_type} ({unit})</text>"
        )

        # Y-axis label
        svg_parts.append(
            f'<text x="15" y="{margin["top"] + plot_height / 2}" '
            f'fill="#1f2937" font-size="11" text-anchor="middle" '
            f'transform="rotate(-90, 15, {margin["top"] + plot_height / 2})">Story</text>'
        )

        svg_parts.append("</svg>")
        return "\n".join(svg_parts)

    # ------------------------------------------------------------------
    # SVG Chart: Scatter plot for element rotations
    # ------------------------------------------------------------------

    def _generate_scatter_svg(self, report: Dict[str, Any], result_type: str) -> str:
        max_points = report.get("plot_data_max", [])
        min_points = report.get("plot_data_min", [])
        stories = report.get("stories", [])
        unit = report.get("unit", "%")

        all_points = max_points + min_points
        if not all_points or not stories:
            return ""

        width = 500
        height = 300
        margin = {"top": 20, "right": 20, "bottom": 40, "left": 80}
        plot_width = width - margin["left"] - margin["right"]
        plot_height = height - margin["top"] - margin["bottom"]

        all_values = [p["rotation"] for p in all_points]
        min_val = min(all_values)
        max_val = max(all_values)
        val_range = max_val - min_val
        if val_range == 0:
            val_range = 1
            min_val -= 0.5
            max_val += 0.5

        # Pad range by 5%
        padding = val_range * 0.05
        min_val -= padding
        max_val += padding
        val_range = max_val - min_val

        n_stories = len(stories)
        story_index = {name: idx for idx, name in enumerate(stories)}

        svg_parts = [
            f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">',
            f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
            f'<rect x="{margin["left"]}" y="{margin["top"]}" '
            f'width="{plot_width}" height="{plot_height}" fill="#f8f9fa" stroke="#d1d5db"/>',
        ]

        # Grid lines for stories
        for i in range(n_stories):
            y = margin["top"] + plot_height - (i + 0.5) / n_stories * plot_height
            svg_parts.append(
                f'<line x1="{margin["left"]}" y1="{y}" '
                f'x2="{margin["left"] + plot_width}" y2="{y}" '
                f'stroke="#e5e7eb" stroke-dasharray="2,2"/>'
            )

        # Dashed zero line for rotations
        if min_val < 0 < max_val:
            zero_x = margin["left"] + (0 - min_val) / val_range * plot_width
            svg_parts.append(
                f'<line x1="{zero_x}" y1="{margin["top"]}" '
                f'x2="{zero_x}" y2="{margin["top"] + plot_height}" '
                f'stroke="#9ca3af" stroke-dasharray="4,2" stroke-width="1"/>'
            )

        # Scatter points
        import random
        jitter_seed = 42

        for pt_list, color in [(max_points, "#2563eb"), (min_points, "#dc2626")]:
            random.seed(jitter_seed)
            for p in pt_list:
                si = story_index.get(p.get("story"), p.get("story_index", 0))
                base_y = margin["top"] + plot_height - (si + 0.5) / n_stories * plot_height
                jitter = (random.random() - 0.5) * (plot_height / n_stories * 0.6)
                y = base_y + jitter
                x = margin["left"] + (p["rotation"] - min_val) / val_range * plot_width
                svg_parts.append(
                    f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2" fill="{color}" opacity="0.6"/>'
                )

        # Y-axis labels
        for i, story in enumerate(stories):
            y = margin["top"] + plot_height - (i + 0.5) / n_stories * plot_height + 4
            display = story[:12] if len(story) > 12 else story
            svg_parts.append(
                f'<text x="{margin["left"] - 5}" y="{y}" '
                f'fill="#374151" font-size="9" text-anchor="end">{display}</text>'
            )

        # X-axis ticks
        n_ticks = 5
        for i in range(n_ticks + 1):
            val = min_val + val_range * i / n_ticks
            x = margin["left"] + i / n_ticks * plot_width
            svg_parts.append(
                f'<text x="{x}" y="{height - margin["bottom"] + 15}" '
                f'fill="#374151" font-size="10" text-anchor="middle">{val:.3f}</text>'
            )

        label = result_type.replace("Rotations", " Rotation")
        svg_parts.append(
            f'<text x="{margin["left"] + plot_width / 2}" y="{height - 5}" '
            f'fill="#1f2937" font-size="11" text-anchor="middle">{label} ({unit})</text>'
        )

        svg_parts.append(
            f'<text x="12" y="{margin["top"] + plot_height / 2}" '
            f'fill="#1f2937" font-size="11" text-anchor="middle" '
            f'transform="rotate(-90, 12, {margin["top"] + plot_height / 2})">Story</text>'
        )

        svg_parts.append("</svg>")
        return "\n".join(svg_parts)

    # ------------------------------------------------------------------
    # SVG Chart: Scatter for joint/soil pressures
    # ------------------------------------------------------------------

    def _generate_joint_scatter_svg(self, report: Dict[str, Any], result_type: str) -> str:
        plot_data = report.get("plot_data", [])
        unit = report.get("unit", "kPa")

        if not plot_data:
            return ""

        width = 500
        height = 300
        margin = {"top": 20, "right": 20, "bottom": 40, "left": 100}
        plot_width = width - margin["left"] - margin["right"]
        plot_height = height - margin["top"] - margin["bottom"]

        # Unique joints for y-axis
        joint_names = list(dict.fromkeys(p["name"] for p in plot_data))
        n_joints = len(joint_names)
        if n_joints == 0:
            return ""

        joint_index = {name: idx for idx, name in enumerate(joint_names)}

        all_values = [p["value"] for p in plot_data]
        min_val = min(all_values)
        max_val = max(all_values)
        if min_val == max_val:
            min_val -= 1
            max_val += 1
        padding = (max_val - min_val) * 0.05
        min_val -= padding
        max_val += padding
        val_range = max_val - min_val

        svg_parts = [
            f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">',
            f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
            f'<rect x="{margin["left"]}" y="{margin["top"]}" '
            f'width="{plot_width}" height="{plot_height}" fill="#f8f9fa" stroke="#d1d5db"/>',
        ]

        # Grid
        for i in range(n_joints):
            y = margin["top"] + plot_height - (i + 0.5) / n_joints * plot_height
            svg_parts.append(
                f'<line x1="{margin["left"]}" y1="{y}" '
                f'x2="{margin["left"] + plot_width}" y2="{y}" '
                f'stroke="#e5e7eb" stroke-dasharray="2,2"/>'
            )

        # Points
        import random
        random.seed(42)
        for p in plot_data:
            ji = joint_index[p["name"]]
            base_y = margin["top"] + plot_height - (ji + 0.5) / n_joints * plot_height
            jitter = (random.random() - 0.5) * (plot_height / max(n_joints, 1) * 0.6)
            y = base_y + jitter
            x = margin["left"] + (p["value"] - min_val) / val_range * plot_width
            svg_parts.append(
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.5" fill="#2563eb" opacity="0.6"/>'
            )

        # Y labels
        for i, name in enumerate(joint_names):
            y = margin["top"] + plot_height - (i + 0.5) / n_joints * plot_height + 4
            display = name[:14] if len(name) > 14 else name
            svg_parts.append(
                f'<text x="{margin["left"] - 5}" y="{y}" '
                f'fill="#374151" font-size="8" text-anchor="end">{display}</text>'
            )

        # X-axis
        n_ticks = 5
        for i in range(n_ticks + 1):
            val = min_val + val_range * i / n_ticks
            x = margin["left"] + i / n_ticks * plot_width
            svg_parts.append(
                f'<text x="{x}" y="{height - margin["bottom"] + 15}" '
                f'fill="#374151" font-size="10" text-anchor="middle">{val:.1f}</text>'
            )

        svg_parts.append(
            f'<text x="{margin["left"] + plot_width / 2}" y="{height - 5}" '
            f'fill="#1f2937" font-size="11" text-anchor="middle">Soil Pressure ({unit})</text>'
        )

        svg_parts.append(
            f'<text x="12" y="{margin["top"] + plot_height / 2}" '
            f'fill="#1f2937" font-size="11" text-anchor="middle" '
            f'transform="rotate(-90, 12, {margin["top"] + plot_height / 2})">Joint</text>'
        )

        svg_parts.append("</svg>")
        return "\n".join(svg_parts)

    # ------------------------------------------------------------------
    # CSS
    # ------------------------------------------------------------------

    def _get_css(self) -> str:
        return """
        @page {
            size: A4;
            margin: 15mm;
            @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 9pt;
                color: #9ca3af;
            }
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
            page-break-after: always;
            margin-bottom: 24px;
        }

        .section:last-child {
            page-break-after: auto;
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

        .data-table th.label-header {
            text-align: left;
            background-color: #e5e7eb;
        }

        .data-table td {
            text-align: center;
            padding: 3px 6px;
            border: 1px solid #e5e7eb;
        }

        .data-table td.label-cell {
            text-align: left;
            font-weight: 500;
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

        .top10-label {
            font-size: 9pt;
            color: #6b7280;
            margin-bottom: 4px;
            font-style: italic;
        }
        """


def generate_pdf_report(
    project,
    result_set_id: int,
    sections: List[Dict[str, Any]],
    project_name: str = None,
) -> bytes:
    service = PDFReportService(project)
    return service.generate_report(result_set_id, sections, project_name)
