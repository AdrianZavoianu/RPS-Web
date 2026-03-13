"""Typed contracts for reporting job config payloads."""

from __future__ import annotations

from typing import Any, TypedDict


class ReportSectionConfig(TypedDict):
    """One validated report section configuration."""

    result_type: str
    direction: str
    category: str
    include_table: bool
    include_chart: bool


class ReportJobConfig(TypedDict):
    """Validated report job config stored on ExportJob.export_config."""

    result_set_id: int
    sections: list[ReportSectionConfig]
    project_name: str | None
    progress_current: int
    progress_total: int


def parse_report_job_config(raw_config: Any) -> ReportJobConfig:
    """Validate and normalize reporting job config loaded from persistence."""
    if not isinstance(raw_config, dict):
        raise ValueError("Report job config must be an object")

    required_keys = (
        "result_set_id",
        "sections",
        "progress_current",
        "progress_total",
    )
    missing = [key for key in required_keys if key not in raw_config]
    if missing:
        missing_display = ", ".join(missing)
        raise ValueError(f"Report job config is missing required fields: {missing_display}")

    result_set_id = raw_config["result_set_id"]
    if not isinstance(result_set_id, int) or result_set_id <= 0:
        raise ValueError("Report job config field 'result_set_id' must be a positive integer")

    sections = raw_config["sections"]
    if not isinstance(sections, list):
        raise ValueError("Report job config field 'sections' must be a list")

    validated_sections: list[ReportSectionConfig] = []
    for section in sections:
        if not isinstance(section, dict):
            raise ValueError("Report job config field 'sections' must contain objects")

        required_section_keys = (
            "result_type",
            "direction",
            "category",
            "include_table",
            "include_chart",
        )
        missing_section_keys = [key for key in required_section_keys if key not in section]
        if missing_section_keys:
            missing_display = ", ".join(missing_section_keys)
            raise ValueError(
                f"Report section config is missing required fields: {missing_display}"
            )

        result_type = section["result_type"]
        direction = section["direction"]
        category = section["category"]
        include_table = section["include_table"]
        include_chart = section["include_chart"]

        if not isinstance(result_type, str) or not result_type.strip():
            raise ValueError("Report section field 'result_type' must be a non-empty string")
        if not isinstance(direction, str):
            raise ValueError("Report section field 'direction' must be a string")
        if not isinstance(category, str) or not category.strip():
            raise ValueError("Report section field 'category' must be a non-empty string")
        if not isinstance(include_table, bool):
            raise ValueError("Report section field 'include_table' must be boolean")
        if not isinstance(include_chart, bool):
            raise ValueError("Report section field 'include_chart' must be boolean")

        validated_sections.append(
            {
                "result_type": result_type.strip(),
                "direction": direction.strip(),
                "category": category.strip(),
                "include_table": include_table,
                "include_chart": include_chart,
            }
        )

    progress_current = raw_config["progress_current"]
    progress_total = raw_config["progress_total"]
    if not isinstance(progress_current, int) or progress_current < 0:
        raise ValueError("Report job config field 'progress_current' must be a non-negative integer")
    if not isinstance(progress_total, int) or progress_total <= 0:
        raise ValueError("Report job config field 'progress_total' must be a positive integer")
    if progress_current > progress_total:
        raise ValueError("Report job config field 'progress_current' cannot exceed 'progress_total'")

    project_name = raw_config.get("project_name")
    if project_name is not None and not isinstance(project_name, str):
        raise ValueError("Report job config field 'project_name' must be string or null")
    normalized_project_name = project_name.strip() if isinstance(project_name, str) else None

    return {
        "result_set_id": result_set_id,
        "sections": validated_sections,
        "project_name": normalized_project_name,
        "progress_current": progress_current,
        "progress_total": progress_total,
    }
