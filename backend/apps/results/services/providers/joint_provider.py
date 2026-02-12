"""Provider functions for joint/foundation result data."""

from typing import Any, Dict, Optional

from apps.results.models import JointResultsCache

from ..datasets import ResultDataset
from .common import build_summary_columns, sort_load_case_columns


def _normalize_joint_display_value(base_type: str, value: Optional[float]) -> Optional[float]:
    """Normalize joint values for display semantics."""
    if value is None:
        return None
    if base_type in {"SoilPressures", "VerticalDisplacements"}:
        # Desktop/web parity request: display soil pressures and vertical displacements as absolute values.
        return abs(value)
    return value


def _resolve_joint_cache_type(service, result_set_id: int, result_type: str) -> Optional[str]:
    candidates = [result_type]
    if "_" not in result_type:
        candidates.extend([f"{result_type}_Min", f"{result_type}_Max"])

    for candidate in candidates:
        if JointResultsCache.objects.filter(
            project=service.project,
            result_set_id=result_set_id,
            result_type=candidate,
        ).exists():
            return candidate
    return None


def get_joint_results(
    service,
    result_set_id: int,
    result_type: str,
    is_pushover: bool = False,
) -> Optional[ResultDataset]:
    """Get joint/foundation results from cache."""
    resolved_result_type = _resolve_joint_cache_type(service, result_set_id, result_type)
    if not resolved_result_type:
        return None

    cache_entries = JointResultsCache.objects.filter(
        project=service.project,
        result_set_id=result_set_id,
        result_type=resolved_result_type,
    ).order_by("unique_name")

    rows = []
    load_case_set = set()
    base_type = resolved_result_type.replace("_Min", "").replace("_Max", "")

    for entry in cache_entries:
        row = {
            "Shell Object": entry.shell_object,
            "Unique Name": entry.unique_name,
        }
        for lc_name, value in entry.results_matrix.items():
            scaled_value = service._apply_multiplier(value, base_type)
            row[lc_name] = _normalize_joint_display_value(base_type, scaled_value)
            load_case_set.add(lc_name)

        if base_type not in {"SoilPressures", "VerticalDisplacements"}:
            if entry.avg_value is not None:
                row["Avg"] = service._apply_multiplier(entry.avg_value, base_type)
            if entry.max_value is not None:
                row["Max"] = service._apply_multiplier(entry.max_value, base_type)
            if entry.min_value is not None:
                row["Min"] = service._apply_multiplier(entry.min_value, base_type)

        rows.append(row)

    if not rows:
        return None

    load_case_columns = sort_load_case_columns(list(load_case_set))
    summary_columns = build_summary_columns(rows, load_case_columns, is_pushover)

    return ResultDataset(
        meta=service._build_meta(
            result_type=base_type,
            direction=None,
            result_set_id=result_set_id,
        ),
        rows=rows,
        load_case_columns=load_case_columns,
        summary_columns=summary_columns,
        story_column="Shell Object",
    )
