"""Section builder functions for PDF report generation."""

import logging
from typing import Any, Dict, Optional

from apps.results.services import ResultDataService

from .charts import generate_joint_scatter_svg, generate_profile_svg, generate_scatter_svg
from .formatting import format_global_table, format_report_table
from .report_data import ReportDataService

logger = logging.getLogger(__name__)


def build_global_section(
    result_service: ResultDataService,
    report_log_context: str,
    result_set,
    config: Dict[str, Any],
    is_pushover: bool,
) -> Optional[Dict[str, Any]]:
    result_type = config.get("result_type")
    direction = config.get("direction", "X")
    include_table = config.get("include_table", True)
    include_chart = config.get("include_chart", True)

    try:
        dataset = result_service.get_global_results(
            result_set_id=result_set.id,
            result_type=result_type,
            direction=direction,
            is_pushover=is_pushover,
        )
    except Exception:
        logger.exception(
            "Error fetching report section data (%s, result_type=%s, direction=%s)",
            report_log_context,
            result_type,
            direction,
        )
        raise

    if not dataset or not dataset.rows:
        return None

    dataset_dict = dataset.to_dict()

    table_data = None
    if include_table:
        table_data = format_global_table(dataset, include_summary=not is_pushover)

    chart_svg = None
    if include_chart:
        chart_svg = generate_profile_svg(dataset_dict, result_type, direction, is_pushover)

    return {
        "title": f"{result_type} {direction}",
        "result_type": result_type,
        "direction": direction,
        "category": "Global",
        "unit": dataset.meta.unit,
        "table": table_data,
        "chart_svg": chart_svg,
    }


def build_element_section(
    report_data_service: ReportDataService,
    report_log_context: str,
    result_set,
    config: Dict[str, Any],
    is_pushover: bool,
) -> Optional[Dict[str, Any]]:
    result_type = config.get("result_type")
    include_table = config.get("include_table", True)
    include_chart = config.get("include_chart", True)

    try:
        if result_type == "BeamRotations":
            report = report_data_service.get_beam_rotation_report(
                result_set.id, is_pushover
            )
        elif result_type == "ColumnRotations":
            report = report_data_service.get_column_rotation_report(
                result_set.id, is_pushover
            )
        else:
            return None
    except Exception:
        logger.exception(
            "Error building element section (%s, result_type=%s)",
            report_log_context,
            result_type,
        )
        return None

    if not report or not report.get("top_10"):
        logger.warning(
            "Empty element section data (%s, result_type=%s)",
            report_log_context,
            result_type,
        )
        return None

    table_data = None
    if include_table:
        table_data = format_report_table(report)

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


def build_joint_section(
    report_data_service: ReportDataService,
    report_log_context: str,
    result_set,
    config: Dict[str, Any],
    is_pushover: bool,
) -> Optional[Dict[str, Any]]:
    result_type = config.get("result_type")
    include_table = config.get("include_table", True)
    include_chart = config.get("include_chart", True)

    try:
        if result_type == "SoilPressures":
            report = report_data_service.get_soil_pressure_report(
                result_set.id, is_pushover
            )
            title = "Soil Pressures"
        elif result_type == "VerticalDisplacements":
            report = report_data_service.get_vertical_displacement_report(
                result_set.id, is_pushover
            )
            title = "Vertical Displacements"
        else:
            return None
    except Exception:
        logger.exception(
            "Error building joint section (%s, result_type=%s)",
            report_log_context,
            result_type,
        )
        return None

    if not report or not report.get("top_10"):
        logger.warning(
            "Empty joint section data (%s, result_type=%s)",
            report_log_context,
            result_type,
        )
        return None

    table_data = None
    if include_table:
        table_data = format_report_table(
            report, default_fixed_columns=["Shell Object", "Unique Name"]
        )

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
