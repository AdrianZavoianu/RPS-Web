"""Shared availability discovery services for results and reporting views."""

from __future__ import annotations

from typing import Any, Dict, List, Sequence, Set, Tuple, Type

from django.db.models import CharField, Q, Value

from config.result_types import RESULT_TYPE_CONFIG, get_availability_map

from apps.results.services.metadata import get_result_type_metadata_contract
from apps.results.data import GlobalResultsCacheRepository
from apps.results.models import (
    BeamRotation,
    ColumnRotation,
    ElementResultsCache,
    GlobalResultsCache,
    JointResultsCache,
    PushoverCase,
    SoilPressure,
    VerticalDisplacement,
)

from .datasets import get_internal_direction


def _get_available_types_for_project(
    project: Any,
    availability_map: Dict[str, Tuple[Type[Any], str]],
) -> Set[str]:
    """Resolve available result types with one UNION query per category."""
    combined_query = None
    for result_type, (model_class, project_field) in availability_map.items():
        per_type_query = (
            model_class.objects.filter(**{project_field: project})
            .order_by()
            .annotate(_available_result_type=Value(result_type, output_field=CharField()))
            .values("_available_result_type")
            .distinct()
        )
        combined_query = (
            per_type_query
            if combined_query is None
            else combined_query.union(per_type_query)
        )

    if combined_query is None:
        return set()

    return {row["_available_result_type"] for row in combined_query}


def get_available_result_types_payload(project: Any) -> Dict[str, Any]:
    """Build available global/element/joint result type payload for a project."""
    metadata_contract = get_result_type_metadata_contract()
    result_type_config = metadata_contract["result_type_config"]

    global_availability_map = get_availability_map("global")
    element_availability_map = get_availability_map("element")
    joint_availability_map = get_availability_map("joint")

    available_global_types = _get_available_types_for_project(
        project, global_availability_map
    )
    available_element_types = _get_available_types_for_project(
        project, element_availability_map
    )
    available_joint_types = _get_available_types_for_project(
        project, joint_availability_map
    )

    global_results: List[Dict[str, Any]] = []
    element_results: List[Dict[str, Any]] = []
    joint_results: List[Dict[str, Any]] = []

    for type_name in global_availability_map:
        if type_name not in available_global_types:
            continue
        config = result_type_config[type_name]
        global_results.append(
            {
                "type": type_name,
                "directions": config["directions"],
                "unit": config["unit"],
            }
        )

    # Also detect global results written directly to cache.
    seen_global_types = {entry["type"] for entry in global_results}
    global_cache_types = GlobalResultsCacheRepository.list_result_types(project)
    for cache_type in global_cache_types:
        base_type = cache_type.rsplit("_", 1)[0]
        if base_type in seen_global_types or base_type not in result_type_config:
            continue
        config = result_type_config[base_type]
        global_results.append(
            {
                "type": base_type,
                "directions": config["directions"],
                "unit": config["unit"],
            }
        )
        seen_global_types.add(base_type)

    for type_name in element_availability_map:
        if type_name not in available_element_types:
            continue
        config = result_type_config[type_name]
        element_results.append(
            {
                "type": type_name,
                "directions": config["directions"],
                "unit": config["unit"],
            }
        )

    for type_name in joint_availability_map:
        if type_name not in available_joint_types:
            continue
        joint_results.append(
            {
                "type": type_name,
                "unit": result_type_config[type_name]["unit"],
            }
        )

    return {
        "global_results": global_results,
        "element_results": element_results,
        "joint_results": joint_results,
        "has_pushover": PushoverCase.objects.filter(project=project).exists(),
        "config": result_type_config,
        "metadata": metadata_contract,
    }


def get_available_report_sections(
    *,
    project: Any,
    result_set: Any,
    global_types: Sequence[str],
) -> List[Dict[str, str]]:
    """Resolve report-preview section availability with consolidated queries."""
    available_sections: List[Dict[str, str]] = []

    global_cache_types = set(
        GlobalResultsCache.objects.filter(
            project=project,
            result_set_id=result_set.id,
        ).values_list("result_type", flat=True)
    )

    for result_type in global_types:
        directions = RESULT_TYPE_CONFIG.get(result_type, {}).get("directions") or []
        for direction in directions:
            internal_direction = get_internal_direction(result_type, direction)
            cache_type = f"{result_type}_{internal_direction}"
            if cache_type not in global_cache_types:
                continue
            available_sections.append(
                {
                    "result_type": result_type,
                    "direction": direction,
                    "category": "Global",
                    "label": f"{result_type} {direction}",
                }
            )

    element_cache_types = set(
        ElementResultsCache.objects.filter(
            project=project,
            result_set_id=result_set.id,
        ).values_list("result_type", flat=True)
    )
    has_beam = any(cache_type.startswith("BeamRotations") for cache_type in element_cache_types)
    has_column = any(
        cache_type.startswith("ColumnRotations_")
        for cache_type in element_cache_types
    )

    if not has_beam:
        has_beam = BeamRotation.objects.filter(
            story__project=project,
        ).filter(
            Q(result_category__result_set_id=result_set.id)
            | Q(result_category__result_set__isnull=True)
        ).exists()
    if not has_column:
        has_column = ColumnRotation.objects.filter(
            story__project=project,
        ).filter(
            Q(result_category__result_set_id=result_set.id)
            | Q(result_category__result_set__isnull=True)
        ).exists()

    if has_beam:
        available_sections.append(
            {
                "result_type": "BeamRotations",
                "direction": "",
                "category": "Element",
                "label": "Beam Rotations",
            }
        )
    if has_column:
        available_sections.append(
            {
                "result_type": "ColumnRotations",
                "direction": "",
                "category": "Element",
                "label": "Column Rotations",
            }
        )

    joint_cache_types = set(
        JointResultsCache.objects.filter(
            project=project,
            result_set_id=result_set.id,
        ).values_list("result_type", flat=True)
    )
    has_soil = any(cache_type.startswith("SoilPressures") for cache_type in joint_cache_types)
    has_vertical = any(
        cache_type.startswith("VerticalDisplacements")
        for cache_type in joint_cache_types
    )

    if not has_soil:
        has_soil = SoilPressure.objects.filter(
            project=project,
            result_set_id=result_set.id,
        ).exists()
    if not has_vertical:
        has_vertical = VerticalDisplacement.objects.filter(
            project=project,
            result_set_id=result_set.id,
        ).exists()

    if has_soil:
        available_sections.append(
            {
                "result_type": "SoilPressures",
                "direction": "",
                "category": "Joint",
                "label": "Soil Pressures",
            }
        )
    if has_vertical:
        available_sections.append(
            {
                "result_type": "VerticalDisplacements",
                "direction": "",
                "category": "Joint",
                "label": "Vertical Displacements",
            }
        )

    return available_sections
