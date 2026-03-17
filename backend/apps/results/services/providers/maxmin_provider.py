"""Provider functions for max/min envelope datasets."""

from __future__ import annotations

from typing import TYPE_CHECKING, Dict, Optional

if TYPE_CHECKING:
    from ..result_service import ResultDataService

from config.result_types import RESULT_TYPE_CONFIG, get_maxmin_raw_source

from apps.results.data import (
    AbsoluteMaxMinDriftRepository,
    ResultCategoryRepository,
)
from apps.results.models import ColumnAxial, ColumnRotation, ColumnShear, WallShear

from ..datasets import MaxMinDataset

# Element types that support per-element maxmin from raw models
ELEMENT_MAXMIN_CONFIG = {
    "ColumnShears": {
        "directions": ["V2", "V3"],
        "unit": "kN",
        "multiplier": 1.0,
        "model": ColumnShear,
        "primary_field": "force",
        "max_field": "max_force",
        "min_field": "min_force",
        "direction_field": "direction",
    },
    "ColumnAxials": {
        "directions": ["P"],
        "unit": "kN",
        "multiplier": 1.0,
        "model": ColumnAxial,
        "primary_field": "min_axial",
        "max_field": "max_axial",
        "min_field": "min_axial",
        "direction_field": None,
    },
    "ColumnRotations": {
        "directions": ["R2", "R3"],
        "unit": "%",
        "multiplier": 100.0,
        "model": ColumnRotation,
        "primary_field": "max_rotation",
        "max_field": "max_rotation",
        "min_field": "min_rotation",
        "direction_field": "direction",
    },
    "WallShears": {
        "directions": ["V2", "V3"],
        "unit": "kN",
        "multiplier": 1.0,
        "model": WallShear,
        "primary_field": "force",
        "max_field": "max_force",
        "min_field": "min_force",
        "direction_field": "direction",
    },
}


def get_maxmin_dataset(
    service: ResultDataService,
    result_set_id: int,
    base_result_type: str = "Drifts",
    element_id: Optional[int] = None,
) -> Optional[MaxMinDataset]:
    """Get max/min envelope data for a result type."""
    if element_id and base_result_type in ELEMENT_MAXMIN_CONFIG:
        return _get_element_maxmin(service, result_set_id, base_result_type, element_id)
    if base_result_type == "Drifts":
        result = _get_drift_maxmin(service, result_set_id)
        if result is None:
            result = _get_generic_maxmin(service, result_set_id, base_result_type)
        return result
    return _get_generic_maxmin(service, result_set_id, base_result_type)


def _get_drift_maxmin(service: ResultDataService, result_set_id: int) -> Optional[MaxMinDataset]:
    """Get max/min drifts from precomputed table."""
    entries = AbsoluteMaxMinDriftRepository.list_entries(
        service.project,
        result_set_id=result_set_id,
    )
    if not entries:
        return None

    story_data: Dict[str, Dict[str, float]] = {}
    story_order: Dict[str, int] = {}

    for entry in entries:
        story_name = entry.story.name
        lc_name = entry.load_case.name
        direction = entry.direction

        if story_name not in story_data:
            story_data[story_name] = {}
            story_order[story_name] = entry.story.sort_order or 0

        col_prefix = f"{lc_name}_{direction}"
        story_data[story_name][f"Max_{col_prefix}"] = entry.absolute_max_drift * 100
        story_data[story_name][f"OrigMax_{col_prefix}"] = entry.original_max * 100
        story_data[story_name][f"OrigMin_{col_prefix}"] = entry.original_min * 100

    rows = []
    for story_name in sorted(story_data.keys(), key=lambda s: -story_order.get(s, 0)):
        row = {"Story": story_name, **story_data[story_name]}
        rows.append(row)

    return MaxMinDataset(
        meta=service._build_meta(
            result_type="MaxMin_Drifts",
            direction=None,
            result_set_id=result_set_id,
            display_name="Max/Min Drifts (%)",
            unit="%",
        ),
        rows=rows,
        directions=("X", "Y"),
        source_type="Drifts",
    )


def _get_generic_maxmin(
    service: ResultDataService,
    result_set_id: int,
    base_result_type: str,
) -> Optional[MaxMinDataset]:
    """Get max/min envelopes for non-drift result types from raw models."""
    config = RESULT_TYPE_CONFIG.get(base_result_type, {})
    directions = config.get("directions", [])
    internal_directions = config.get("internal_directions", {})
    multiplier = config.get("multiplier", 1)

    if not directions:
        return None

    model_info = get_maxmin_raw_source(base_result_type)
    if not model_info:
        return None

    model_class, primary_field, max_field, min_field = model_info

    category_ids = ResultCategoryRepository.get_ids_for_project_result_set(
        service.project,
        result_set_id=result_set_id,
    )
    if not category_ids:
        return None

    story_data: Dict[str, Dict[str, float]] = {}
    story_order: Dict[str, int] = {}

    for ui_dir in directions:
        internal_dir = internal_directions.get(ui_dir, ui_dir)

        entries = (
            model_class.objects.filter(
                story__project=service.project,
                result_category_id__in=category_ids,
                direction=internal_dir,
            )
            .select_related("story", "load_case")
            .order_by("-story__sort_order")
        )

        for entry in entries:
            story_name = entry.story.name
            lc_name = entry.load_case.name

            if story_name not in story_data:
                story_data[story_name] = {}
                story_order[story_name] = entry.story.sort_order or 0

            primary_val = getattr(entry, primary_field) * multiplier
            max_val = getattr(entry, max_field)
            min_val = getattr(entry, min_field)
            if max_val is not None and max_val != max_val:
                max_val = None
            if min_val is not None and min_val != min_val:
                min_val = None

            orig_max = (max_val * multiplier) if max_val is not None else abs(primary_val)
            orig_min = (min_val * multiplier) if min_val is not None else -abs(primary_val)

            col_prefix = f"{lc_name}_{ui_dir}"
            key_max = f"OrigMax_{col_prefix}"
            key_min = f"OrigMin_{col_prefix}"

            if key_max in story_data[story_name]:
                story_data[story_name][key_max] = max(story_data[story_name][key_max], orig_max)
                story_data[story_name][key_min] = min(story_data[story_name][key_min], orig_min)
            else:
                story_data[story_name][key_max] = orig_max
                story_data[story_name][key_min] = orig_min

            story_data[story_name][f"Max_{col_prefix}"] = max(
                abs(story_data[story_name][key_max]),
                abs(story_data[story_name][key_min]),
            )

    if not story_data:
        return None

    rows = []
    for story_name in sorted(story_data.keys(), key=lambda s: -story_order.get(s, 0)):
        row = {"Story": story_name, **story_data[story_name]}
        rows.append(row)

    return MaxMinDataset(
        meta=service._build_meta(
            result_type=f"MaxMin_{base_result_type}",
            direction=None,
            result_set_id=result_set_id,
            display_name=f'Max/Min {base_result_type} ({config.get("unit", "")})',
            unit=config.get("unit", ""),
        ),
        rows=rows,
        directions=tuple(directions),
        source_type=base_result_type,
    )


def _get_element_maxmin(
    service: ResultDataService,
    result_set_id: int,
    base_result_type: str,
    element_id: int,
) -> Optional[MaxMinDataset]:
    """Build max/min envelope for a specific element from raw result models.

    Queries the underlying model directly so that separate max/min fields
    are available, producing both Max and Min envelope branches.
    """
    config = ELEMENT_MAXMIN_CONFIG[base_result_type]
    directions = config["directions"]
    unit = config["unit"]
    multiplier = config["multiplier"]
    model_class = config["model"]
    direction_field = config.get("direction_field")
    primary_f = config["primary_field"]
    max_f = config["max_field"]
    min_f = config["min_field"]

    category_ids = ResultCategoryRepository.get_ids_for_project_result_set(
        service.project,
        result_set_id=result_set_id,
    )
    if not category_ids:
        return None

    story_data: Dict[str, Dict[str, float]] = {}
    story_order: Dict[str, int] = {}

    for ui_dir in directions:
        filters = {
            "element_id": element_id,
            "result_category_id__in": category_ids,
        }
        if direction_field:
            filters[direction_field] = ui_dir

        entries = (
            model_class.objects.filter(**filters)
            .select_related("story", "load_case")
            .order_by("-story__sort_order")
        )

        for entry in entries:
            story_name = entry.story.name
            lc_name = entry.load_case.name

            if story_name not in story_data:
                story_data[story_name] = {}
                story_order[story_name] = entry.story.sort_order or 0

            primary_val = getattr(entry, primary_f) * multiplier
            max_val = getattr(entry, max_f, None)
            min_val = getattr(entry, min_f, None)
            if max_val is not None and max_val != max_val:
                max_val = None
            if min_val is not None and min_val != min_val:
                min_val = None

            orig_max = (max_val * multiplier) if max_val is not None else abs(primary_val)
            orig_min = (min_val * multiplier) if min_val is not None else -abs(primary_val)

            col_prefix = f"{lc_name}_{ui_dir}"
            key_max = f"OrigMax_{col_prefix}"
            key_min = f"OrigMin_{col_prefix}"

            if key_max in story_data[story_name]:
                story_data[story_name][key_max] = max(story_data[story_name][key_max], orig_max)
                story_data[story_name][key_min] = min(story_data[story_name][key_min], orig_min)
            else:
                story_data[story_name][key_max] = orig_max
                story_data[story_name][key_min] = orig_min

            story_data[story_name][f"Max_{col_prefix}"] = max(
                abs(story_data[story_name][key_max]),
                abs(story_data[story_name][key_min]),
            )

    if not story_data:
        return None

    rows = []
    for story_name in sorted(story_data.keys(), key=lambda s: -story_order.get(s, 0)):
        row = {"Story": story_name, **story_data[story_name]}
        rows.append(row)

    return MaxMinDataset(
        meta=service._build_meta(
            result_type=f"MaxMin_{base_result_type}",
            direction=None,
            result_set_id=result_set_id,
            display_name=f"Max/Min {base_result_type} ({unit})",
            unit=unit,
        ),
        rows=rows,
        directions=tuple(directions),
        source_type=base_result_type,
    )
