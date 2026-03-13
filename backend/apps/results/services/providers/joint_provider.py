"""Provider functions for joint/foundation result data."""

from typing import Any, Dict, Optional

from apps.results.data import JointResultsCacheRepository
from apps.results.models import SoilPressure, VerticalDisplacement

from ..datasets import ResultDataset
from ..fallback_policy import (
    FALLBACK_CACHE_ONLY,
    resolve_fallback,
)
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

    available_types = JointResultsCacheRepository.list_available_result_types(
        service.project,
        result_set_id=result_set_id,
        candidates=candidates,
    )

    for candidate in candidates:
        if candidate in available_types:
            return candidate
    return None


def _base_type_from_result_type(result_type: str) -> str:
    if result_type.endswith("_Min") or result_type.endswith("_Max"):
        return result_type.rsplit("_", 1)[0]
    return result_type


def _build_joint_dataset(
    *,
    service,
    result_set_id: int,
    base_type: str,
    rows: list[dict[str, Any]],
    load_case_columns: list[str],
    is_pushover: bool,
) -> Optional[ResultDataset]:
    if not rows:
        return None

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


def _build_joint_dataset_from_cache(
    service,
    result_set_id: int,
    result_type: str,
    is_pushover: bool,
) -> Optional[ResultDataset]:
    resolved_result_type = _resolve_joint_cache_type(service, result_set_id, result_type)
    if not resolved_result_type:
        return None

    cache_entries = JointResultsCacheRepository.list_entries(
        service.project,
        result_set_id=result_set_id,
        result_type=resolved_result_type,
    )
    base_type = resolved_result_type.replace("_Min", "").replace("_Max", "")
    rows = []
    load_case_set = set()

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

    return _build_joint_dataset(
        service=service,
        result_set_id=result_set_id,
        base_type=base_type,
        rows=rows,
        load_case_columns=sort_load_case_columns(list(load_case_set)),
        is_pushover=is_pushover,
    )


def _build_joint_dataset_from_raw(
    service,
    result_set_id: int,
    result_type: str,
    is_pushover: bool,
) -> Optional[ResultDataset]:
    base_type = _base_type_from_result_type(result_type)
    if base_type == "SoilPressures":
        records = SoilPressure.objects.filter(
            project=service.project,
            result_set_id=result_set_id,
        ).select_related("load_case")
    elif base_type == "VerticalDisplacements":
        records = VerticalDisplacement.objects.filter(
            project=service.project,
            result_set_id=result_set_id,
        ).select_related("load_case")
    else:
        return None

    rows_map: dict[str, dict[str, Any]] = {}
    load_case_set = set()
    for record in records:
        unique_name = record.unique_name
        if base_type == "SoilPressures":
            shell_label = record.shell_object
            raw_value = record.min_pressure
        else:
            shell_label = record.label
            raw_value = record.min_displacement
        if raw_value is None:
            continue

        row = rows_map.setdefault(
            unique_name,
            {
                "Shell Object": shell_label,
                "Unique Name": unique_name,
            },
        )
        row[record.load_case.name] = _normalize_joint_display_value(
            base_type,
            service._apply_multiplier(raw_value, base_type),
        )
        load_case_set.add(record.load_case.name)

    return _build_joint_dataset(
        service=service,
        result_set_id=result_set_id,
        base_type=base_type,
        rows=list(rows_map.values()),
        load_case_columns=sort_load_case_columns(list(load_case_set)),
        is_pushover=is_pushover,
    )


def get_joint_results(
    service,
    result_set_id: int,
    result_type: str,
    is_pushover: bool = False,
    fallback_policy: str = FALLBACK_CACHE_ONLY,
) -> Optional[ResultDataset]:
    """Get joint/foundation results with explicit cache/raw fallback policy."""
    selected = resolve_fallback(
        fallback_policy=fallback_policy,
        cache_loader=lambda: _build_joint_dataset_from_cache(
            service=service,
            result_set_id=result_set_id,
            result_type=result_type,
            is_pushover=is_pushover,
        ),
        raw_loader=lambda: _build_joint_dataset_from_raw(
            service=service,
            result_set_id=result_set_id,
            result_type=result_type,
            is_pushover=is_pushover,
        ),
        has_data=lambda dataset: bool(dataset and dataset.rows),
    )
    return selected.data
