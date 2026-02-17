"""
PDF report generation service using WeasyPrint.
Renders HTML templates to PDF with proper styling.
"""

import base64
import io
import inspect
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import pydyf
from django.template.loader import render_to_string
from weasyprint import HTML, CSS
from PIL import Image

from apps.results.services import ResultDataService
from apps.results.models import ResultSet

from .report_data import ReportDataService

logger = logging.getLogger(__name__)


def _patch_pydyf_pdf_init_for_weasyprint_60() -> None:
    """Patch pydyf>=0.11 constructor shape for WeasyPrint 60.x compatibility.

    WeasyPrint 60.x instantiates pydyf.PDF with positional args, while newer
    pydyf constructors accept only `self`. This shim is a no-op when running
    against compatible versions.
    """
    init_signature = inspect.signature(pydyf.PDF.__init__)
    if len(init_signature.parameters) != 1:
        return

    original_init = pydyf.PDF.__init__

    def _compat_init(self, version=b"1.7", identifier=False):
        original_init(self)
        if isinstance(version, str):
            version = version.encode()
        self.version = version
        self.identifier = identifier

    def _compat_transform(self, a=1, b=0, c=0, d=1, e=0, f=0):
        self.set_matrix(a, b, c, d, e, f)

    def _compat_text_matrix(self, a=1, b=0, c=0, d=1, e=0, f=0):
        self.set_text_matrix(a, b, c, d, e, f)

    pydyf.PDF.__init__ = _compat_init
    if not hasattr(pydyf.Stream, "transform"):
        pydyf.Stream.transform = _compat_transform
    if not hasattr(pydyf.Stream, "text_matrix"):
        pydyf.Stream.text_matrix = _compat_text_matrix


_patch_pydyf_pdf_init_for_weasyprint_60()

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
PLOT_AREA_FILL = "#eef2f6"

LOGO_PATH = Path(__file__).parent / "static" / "reporting" / "RPS_Logo.png"


def _load_logo_b64() -> str:
    """Load logo as base64 data URI."""
    if LOGO_PATH.exists():
        data = LOGO_PATH.read_bytes()
        try:
            # The shipped logo is an alpha mask (white pixels). Tint it dark teal
            # so it remains visible on white PDF backgrounds.
            image = Image.open(io.BytesIO(data)).convert("RGBA")
            alpha = image.getchannel("A")
            colored = Image.new("RGBA", image.size, (31, 92, 106, 255))
            colored.putalpha(alpha)
            output = io.BytesIO()
            colored.save(output, format="PNG")
            data = output.getvalue()
        except Exception:
            logger.exception("Failed to colorize report logo; using original asset")

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
                "Error building element section (project_id=%s, result_set_id=%s, result_type=%s)",
                self.project.id,
                result_set.id,
                result_type,
            )
            return None

        if not report or not report.get("top_10"):
            logger.warning(
                "Empty element section data (project_id=%s, result_set_id=%s, result_type=%s)",
                self.project.id,
                result_set.id,
                result_type,
            )
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
                "Error building joint section (project_id=%s, result_set_id=%s, result_type=%s)",
                self.project.id,
                result_set.id,
                result_type,
            )
            return None

        if not report or not report.get("top_10"):
            logger.warning(
                "Empty joint section data (project_id=%s, result_set_id=%s, result_type=%s)",
                self.project.id,
                result_set.id,
                result_type,
            )
            return None

        table_data = None
        if include_table:
            table_data = self._format_joint_table(report)

        chart_svg = None
        if include_chart:
            chart_svg = self._generate_joint_scatter_svg(report, result_type)

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
            f'width="{plot_width}" height="{plot_height}" fill="{PLOT_AREA_FILL}" stroke="#d1d5db"/>',
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
            f'width="{plot_width}" height="{plot_height}" fill="{PLOT_AREA_FILL}" stroke="#d1d5db"/>',
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
        plot_data_raw = report.get("plot_data", [])
        load_cases = report.get("load_cases", [])
        unit = report.get("unit", "kPa")
        if result_type == "VerticalDisplacements":
            value_axis_label = "Vertical Displacement"
        elif result_type == "SoilPressures":
            value_axis_label = "Soil Pressure"
        else:
            value_axis_label = result_type

        if not plot_data_raw or not load_cases:
            return ""

        plot_data: List[tuple[int, float]] = []
        for point in plot_data_raw:
            lc_idx = None
            value = None

            if isinstance(point, dict):
                lc_idx = point.get("load_case_idx")
                value = point.get("value")
            elif isinstance(point, (list, tuple)) and len(point) >= 2:
                lc_idx = point[0]
                value = point[1]

            if not isinstance(value, (int, float)):
                continue

            try:
                lc_idx_int = int(lc_idx)
            except (TypeError, ValueError):
                continue

            if lc_idx_int < 0 or lc_idx_int >= len(load_cases):
                continue

            plot_data.append((lc_idx_int, abs(float(value))))

        if not plot_data:
            return ""

        width = 500
        height = 300
        margin = {"top": 20, "right": 20, "bottom": 56, "left": 56}
        plot_width = width - margin["left"] - margin["right"]
        plot_height = height - margin["top"] - margin["bottom"]

        num_load_cases = len(load_cases)
        slot_width = plot_width / num_load_cases

        all_values = [value for _, value in plot_data]
        y_min = 0.0
        y_max = max(all_values) * 1.1
        if y_max <= y_min:
            y_max = y_min + 1.0
        y_range = y_max - y_min

        def to_px_x(lc_idx: int) -> float:
            return margin["left"] + (lc_idx + 0.5) * slot_width

        def to_px_y(value: float) -> float:
            return margin["top"] + plot_height - (value - y_min) / y_range * plot_height

        def nice_ticks(data_min: float, data_max: float, num_ticks: int = 5) -> List[float]:
            import math

            data_range = data_max - data_min
            if data_range <= 0:
                return [data_min]

            rough_step = data_range / num_ticks
            magnitude = 10 ** math.floor(math.log10(rough_step))
            residual = rough_step / magnitude
            if residual > 5:
                nice_step = 10 * magnitude
            elif residual > 2:
                nice_step = 5 * magnitude
            elif residual > 1:
                nice_step = 2 * magnitude
            else:
                nice_step = magnitude

            start = math.ceil(data_min / nice_step) * nice_step
            ticks = []
            tick = start
            while tick <= data_max + 1e-9:
                ticks.append(tick)
                tick += nice_step

            return ticks

        y_ticks = nice_ticks(y_min, y_max, 5)

        svg_parts = [
            f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">',
            f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
            f'<rect x="{margin["left"]}" y="{margin["top"]}" '
            f'width="{plot_width}" height="{plot_height}" fill="{PLOT_AREA_FILL}" stroke="#d1d5db"/>',
        ]

        # Horizontal grid lines
        for tick in y_ticks:
            y = to_px_y(tick)
            svg_parts.append(
                f'<line x1="{margin["left"]}" y1="{y}" '
                f'x2="{margin["left"] + plot_width}" y2="{y}" '
                f'stroke="#e5e7eb" stroke-dasharray="2,2"/>'
            )

        # Vertical grid lines for load-case bins
        for i in range(num_load_cases + 1):
            x = margin["left"] + i * slot_width
            svg_parts.append(
                f'<line x1="{x}" y1="{margin["top"]}" '
                f'x2="{x}" y2="{margin["top"] + plot_height}" '
                f'stroke="#e5e7eb" stroke-dasharray="2,2"/>'
            )

        # Scatter points
        import random
        rng = random.Random(46)
        for lc_idx, value in plot_data:
            jitter = (rng.random() - 0.5) * slot_width * 0.7
            x = to_px_x(lc_idx) + jitter
            y = to_px_y(value)
            svg_parts.append(
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.5" fill="#2563eb" opacity="0.6"/>'
            )

        # Y-axis tick labels
        for tick in y_ticks:
            y = to_px_y(tick) + 3
            label = f"{tick:.1f}" if abs(tick) < 10 else f"{tick:.0f}"
            svg_parts.append(
                f'<text x="{margin["left"] - 5}" y="{y}" '
                f'fill="#374151" font-size="8" text-anchor="end">{label}</text>'
            )

        # X-axis labels (load case names)
        for i, load_case in enumerate(load_cases):
            x = to_px_x(i)
            label = str(load_case)[:5]
            svg_parts.append(
                f'<text x="{x}" y="{height - margin["bottom"] + 13}" '
                f'fill="#374151" font-size="8" text-anchor="middle">{label}</text>'
            )

        svg_parts.append(
            f'<text x="{margin["left"] + plot_width / 2}" y="{height - 5}" '
            f'fill="#1f2937" font-size="11" text-anchor="middle">Load Case</text>'
        )

        svg_parts.append(
            f'<text x="14" y="{margin["top"] + plot_height / 2}" '
            f'fill="#1f2937" font-size="11" text-anchor="middle" '
            f'transform="rotate(-90, 14, {margin["top"] + plot_height / 2})">{value_axis_label} ({unit})</text>'
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
            width: 92px;
            height: auto;
        }

        .logo-fallback {
            font-size: 14pt;
            font-weight: 700;
            color: #1f5c6a;
            letter-spacing: 0.2px;
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
