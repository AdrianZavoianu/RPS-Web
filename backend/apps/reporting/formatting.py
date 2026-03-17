"""Table formatting helpers for PDF report sections."""

from typing import Any, Dict, List, Optional

from core.data_assembler import dataset_to_table_projection


def format_global_table(dataset: Any, include_summary: bool) -> Dict[str, Any]:
    """Format a global result dataset into a report table."""
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


def format_report_table(
    report: Dict[str, Any],
    default_fixed_columns: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Format element or joint report data into a report table.

    Used for both element sections (BeamRotations, ColumnRotations)
    and joint sections (SoilPressures, VerticalDisplacements).
    """
    top_10 = report["top_10"]
    load_cases = report["load_cases"][:8]
    summary_cols = report.get("summary_columns", [])
    fixed_cols = report.get("fixed_columns", default_fixed_columns or [])

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
