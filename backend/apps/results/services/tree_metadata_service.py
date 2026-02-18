"""Batched metadata payloads for results-tree expansion."""

from __future__ import annotations

from typing import Any

from apps.results.data import TimeSeriesGlobalCacheRepository
from apps.results.models import ElementResultsCache, JointResultsCache, PushoverCase, ResultSet

from .providers.common import sort_load_case_columns

ELEMENT_BASE_TYPES = (
    "WallShears",
    "QuadRotations",
    "ColumnShears",
    "ColumnAxials",
    "ColumnRotations",
    "BeamRotations",
)
JOINT_BASE_TYPES = ("SoilPressures", "VerticalDisplacements")


def _resolve_element_base_type(cache_result_type: str) -> str | None:
    for base_type in ELEMENT_BASE_TYPES:
        if cache_result_type.startswith(base_type):
            return base_type
    return None


def _get_elements_by_type(project: Any, result_set_id: int) -> dict[str, list[dict[str, Any]]]:
    elements_by_type: dict[str, list[dict[str, Any]]] = {
        base_type: [] for base_type in ELEMENT_BASE_TYPES
    }
    element_ids_by_type: dict[str, set[int]] = {base_type: set() for base_type in ELEMENT_BASE_TYPES}

    element_rows = ElementResultsCache.objects.filter(
        project=project,
        result_set_id=result_set_id,
    ).values(
        "result_type",
        "element__id",
        "element__name",
        "element__element_type",
    ).distinct()

    for row in element_rows:
        cache_result_type = row["result_type"]
        base_type = _resolve_element_base_type(cache_result_type)
        if base_type is None:
            continue

        element_id = row["element__id"]
        if element_id in element_ids_by_type[base_type]:
            continue

        element_ids_by_type[base_type].add(element_id)
        elements_by_type[base_type].append(
            {
                "id": element_id,
                "name": row["element__name"],
                "element_type": row["element__element_type"],
            }
        )

    for element_list in elements_by_type.values():
        element_list.sort(key=lambda element: (str(element["name"]).lower(), element["id"]))

    return elements_by_type


def _get_joint_availability(project: Any, result_set_id: int) -> dict[str, bool]:
    cache_types = set(
        JointResultsCache.objects.filter(
            project=project,
            result_set_id=result_set_id,
        ).values_list("result_type", flat=True)
    )
    return {
        base_type: any(cache_type.startswith(base_type) for cache_type in cache_types)
        for base_type in JOINT_BASE_TYPES
    }


def get_result_tree_metadata_payload(*, project: Any, result_set_id: int) -> dict[str, Any]:
    """Build batched tree metadata for one result-set expansion."""
    result_set = ResultSet.objects.filter(
        project=project,
        id=result_set_id,
    ).only("id", "analysis_type").first()
    if result_set is None:
        raise ValueError("Result set must belong to the current project.")

    time_series_load_cases = sort_load_case_columns(
        TimeSeriesGlobalCacheRepository.list_load_case_names(
            project,
            result_set_id=result_set_id,
        )
    )
    pushover_cases = list(
        PushoverCase.objects.filter(
            project=project,
            result_set_id=result_set_id,
        )
        .order_by("id")
        .values("id", "name", "direction", "result_set_id")
    )

    return {
        "result_set_id": result_set_id,
        "analysis_type": result_set.analysis_type,
        "time_series_load_cases": time_series_load_cases,
        "pushover_cases": pushover_cases,
        "elements_by_type": _get_elements_by_type(project, result_set_id),
        "joint_availability": _get_joint_availability(project, result_set_id),
    }
