"""Shared helpers for cache builder modules."""

from typing import Dict, Optional, Tuple


def compute_aggregates(
    results_matrix: Dict[str, float],
) -> Tuple[Optional[float], Optional[float], Optional[float], int]:
    """Compute aggregate statistics from a results matrix in a single pass."""
    if not results_matrix:
        return None, None, None, 0

    total = 0.0
    max_val = float("-inf")
    min_val = float("inf")
    count = 0

    for value in results_matrix.values():
        total += value
        if value > max_val:
            max_val = value
        if value < min_val:
            min_val = value
        count += 1

    return total / count, max_val, min_val, count
