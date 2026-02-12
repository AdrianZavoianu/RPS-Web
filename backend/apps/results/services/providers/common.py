"""Shared provider helpers."""

import re
from typing import Any, Dict, List


def build_summary_columns(
    rows: List[Dict[str, Any]],
    load_case_columns: List[str],
    is_pushover: bool,
) -> List[str]:
    """Populate fallback summary columns when aggregates are unavailable."""
    if is_pushover or not load_case_columns:
        return []

    has_summary = False
    for row in rows:
        values = []
        for load_case in load_case_columns:
            value = row.get(load_case)
            if isinstance(value, (int, float)):
                values.append(float(value))

        if not values:
            continue

        has_summary = True
        if "Avg" not in row:
            row["Avg"] = sum(values) / len(values)
        if "Max" not in row:
            row["Max"] = max(values)
        if "Min" not in row:
            row["Min"] = min(values)

    return ["Avg", "Max", "Min"] if has_summary else []


_NUMERIC_SPLIT = re.compile(r"(\d+)")


def sort_load_case_columns(load_case_columns: List[str]) -> List[str]:
    """Sort load case labels using natural ordering (TH2 before TH10)."""

    def natural_key(value: str):
        parts = _NUMERIC_SPLIT.split(value)
        return [int(part) if part.isdigit() else part.lower() for part in parts]

    return sorted(load_case_columns, key=natural_key)
