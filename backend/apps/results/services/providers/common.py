"""Shared provider helpers."""

import re
from typing import Any, Dict, List

PLOT_BINS = 50


def build_histogram_bins(values: List[float]) -> List[Dict[str, float]]:
    """Build histogram bins from a list of numeric values."""
    if not values:
        return []

    min_value = min(values)
    max_value = max(values)

    if max_value == min_value:
        return [
            {
                "start": min_value - 0.5,
                "end": max_value + 0.5,
                "center": min_value,
                "count": float(len(values)),
            }
        ]

    bin_width = (max_value - min_value) / PLOT_BINS
    counts = [0] * PLOT_BINS

    for value in values:
        index = int((value - min_value) / bin_width)
        if index >= PLOT_BINS:
            index = PLOT_BINS - 1
        counts[index] += 1

    bins: List[Dict[str, float]] = []
    for idx, count in enumerate(counts):
        start = min_value + idx * bin_width
        end = start + bin_width
        bins.append(
            {
                "start": start,
                "end": end,
                "center": (start + end) / 2,
                "count": float(count),
            }
        )

    return bins


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
