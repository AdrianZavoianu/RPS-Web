"""Aggregation helpers for global result imports."""

from typing import Any, Callable, Dict, Iterable, Optional, Set, Tuple


def parse_numeric(value) -> Optional[float]:
    """Parse numeric values from Excel rows, returning None for invalid/NaN."""
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed != parsed:  # NaN
        return None
    return parsed


def normalize_step_type(step_type) -> str:
    """Normalize step type strings for case-insensitive comparisons."""
    if step_type is None:
        return ""
    return str(step_type).strip().casefold()


def build_story_index(stories) -> Dict[str, int]:
    """Build O(1) story-name -> sort-order lookup for import hot loops."""
    return {name: idx for idx, name in enumerate(stories)}


def update_bounds_for_step_type(
    bounds: Dict[str, Optional[float]],
    max_candidate: Optional[float],
    min_candidate: Optional[float],
    step_type: str,
) -> None:
    """Update max/min bounds using Step Type semantics."""
    if step_type == "max":
        candidate = max_candidate if max_candidate is not None else min_candidate
        if candidate is not None:
            bounds["max"] = candidate if bounds["max"] is None else max(bounds["max"], candidate)
        return

    if step_type == "min":
        candidate = min_candidate if min_candidate is not None else max_candidate
        if candidate is not None:
            bounds["min"] = candidate if bounds["min"] is None else min(bounds["min"], candidate)
        return

    # Legacy/no-step-type rows: derive both bounds from observed values.
    for candidate in (max_candidate, min_candidate):
        if candidate is None:
            continue
        bounds["max"] = candidate if bounds["max"] is None else max(bounds["max"], candidate)
        bounds["min"] = candidate if bounds["min"] is None else min(bounds["min"], candidate)


def aggregate_by_step_type(
    df,
    allowed_load_cases: Set[str],
    key_value_builder: Callable[
        [Any, str], Iterable[Tuple[Tuple[Any, ...], Optional[float], Optional[float]]]
    ],
) -> Dict[Tuple[Any, ...], Dict[str, Optional[float]]]:
    """Aggregate row values into max/min bounds keyed by result identity."""
    aggregated: Dict[Tuple[Any, ...], Dict[str, Optional[float]]] = {}
    has_step_type = "Step Type" in df.columns

    for _, row in df.iterrows():
        case_name = row.get("Output Case")
        if case_name not in allowed_load_cases:
            continue

        step_type = normalize_step_type(row.get("Step Type", "")) if has_step_type else ""
        for key, max_candidate, min_candidate in key_value_builder(row, case_name):
            if max_candidate is None and min_candidate is None:
                continue
            bounds = aggregated.setdefault(key, {"max": None, "min": None})
            update_bounds_for_step_type(bounds, max_candidate, min_candidate, step_type)

    return aggregated


def resolve_bounds(bounds: Dict[str, Optional[float]]) -> Optional[Tuple[float, float]]:
    """Resolve aggregated bounds; mirror available side when one side is missing."""
    max_val = bounds.get("max")
    min_val = bounds.get("min")
    if max_val is None and min_val is None:
        return None

    resolved_max = max_val if max_val is not None else min_val
    resolved_min = min_val if min_val is not None else max_val
    if resolved_max is None or resolved_min is None:
        return None
    return resolved_max, resolved_min
