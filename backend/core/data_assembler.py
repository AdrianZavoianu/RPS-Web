"""Shared row/header assembly helpers for reporting and export services."""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


def assemble_table_rows(
    *,
    rows: Sequence[Dict[str, Any]],
    fixed_columns: Sequence[str],
    load_case_columns: Sequence[str],
    summary_columns: Sequence[str] = (),
    required_columns: Sequence[str] = (),
) -> Tuple[List[str], List[List[Any]]]:
    """Build table headers and row matrix from row dictionaries."""
    headers = [
        *list(fixed_columns),
        *list(load_case_columns),
        *list(summary_columns),
    ]

    table_rows: List[List[Any]] = []
    for row in rows:
        for col in required_columns:
            if col not in row:
                raise KeyError(f"Missing '{col}' in table row")
        table_rows.append([row.get(col) for col in headers])

    return headers, table_rows


def dataset_to_table_rows(
    *,
    dataset: Any,
    include_summary: bool,
    fixed_columns: Optional[Sequence[str]] = None,
    required_columns: Sequence[str] = (),
) -> Tuple[List[str], List[List[Any]]]:
    """Build table headers and rows from a canonical ResultDataset-like object."""
    if fixed_columns is None:
        fixed_columns = [dataset.story_column]

    summary_columns = list(dataset.summary_columns) if include_summary else []
    return assemble_table_rows(
        rows=dataset.rows,
        fixed_columns=fixed_columns,
        load_case_columns=list(dataset.load_case_columns),
        summary_columns=summary_columns,
        required_columns=required_columns,
    )


def dataset_to_table_projection(
    *,
    dataset: Any,
    include_summary: bool,
    fixed_columns: Optional[Sequence[str]] = None,
    required_columns: Sequence[str] = (),
) -> Dict[str, Any]:
    """Build a canonical table projection payload from a result dataset."""
    resolved_fixed_columns = (
        list(fixed_columns) if fixed_columns is not None else [dataset.story_column]
    )
    summary_columns = list(dataset.summary_columns) if include_summary else []
    headers, rows = dataset_to_table_rows(
        dataset=dataset,
        include_summary=include_summary,
        fixed_columns=resolved_fixed_columns,
        required_columns=required_columns,
    )
    return {
        "headers": headers,
        "rows": rows,
        "fixed_columns": resolved_fixed_columns,
        "load_case_columns": list(dataset.load_case_columns),
        "summary_columns": summary_columns,
    }


def dataset_to_response(
    *,
    dataset: Any,
    include_summary: bool,
    fixed_columns: Optional[Sequence[str]] = None,
    required_columns: Sequence[str] = (),
) -> Dict[str, Any]:
    """Build API payload with canonical dataset dict + table projection."""
    payload = dataset.to_dict()
    payload["table"] = dataset_to_table_projection(
        dataset=dataset,
        include_summary=include_summary,
        fixed_columns=fixed_columns,
        required_columns=required_columns,
    )
    return payload


def add_summary_metrics(
    *,
    rows: Iterable[Dict[str, Any]],
    load_case_columns: Sequence[str],
    include_avg: bool,
) -> None:
    """Mutate rows by populating Avg/Max/Min from numeric load-case values."""
    for row in rows:
        numeric = [
            float(row[lc])
            for lc in load_case_columns
            if isinstance(row.get(lc), (int, float))
        ]
        if not numeric:
            continue
        if include_avg:
            row["Avg"] = sum(numeric) / len(numeric)
        row["Max"] = max(numeric)
        row["Min"] = min(numeric)


def select_top_rows_by_abs_avg(
    *,
    rows: Sequence[Dict[str, Any]],
    load_case_columns: Sequence[str],
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """Select top rows by absolute-average magnitude across load-case columns."""
    scored = []
    for row in rows:
        numeric = [
            abs(float(row[lc]))
            for lc in load_case_columns
            if isinstance(row.get(lc), (int, float))
        ]
        abs_avg = sum(numeric) / len(numeric) if numeric else 0.0
        scored.append((abs_avg, row))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [dict(row) for _, row in scored[:limit]]


def build_abs_scatter_data(
    *,
    rows: Sequence[Dict[str, Any]],
    load_case_columns: Sequence[str],
) -> List[Dict[str, Any]]:
    """Build scatter points using absolute values indexed by load-case order."""
    plot_data: List[Dict[str, Any]] = []
    for lc_idx, lc_name in enumerate(load_case_columns):
        for row in rows:
            value = row.get(lc_name)
            if isinstance(value, (int, float)):
                plot_data.append(
                    {"load_case_idx": lc_idx, "value": abs(float(value))}
                )
    return plot_data
