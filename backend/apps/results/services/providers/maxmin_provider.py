"""Provider functions for max/min envelope datasets."""

from typing import Dict, Optional

from config.result_types import RESULT_TYPE_CONFIG, get_maxmin_raw_source

from apps.results.data import (
    AbsoluteMaxMinDriftRepository,
    ElementResultsCacheRepository,
    ResultCategoryRepository,
)

from ..datasets import MaxMinDataset

# Element types that support per-element maxmin from cache
ELEMENT_MAXMIN_CONFIG = {
    "ColumnShears": {
        "directions": ["V2", "V3"],
        "unit": "kN",
        "multiplier": 1.0,
    },
    "ColumnAxials": {
        "directions": ["Min", "Max"],
        "unit": "kN",
        "multiplier": 1.0,
    },
    "ColumnRotations": {
        "directions": ["R2", "R3"],
        "unit": "%",
        "multiplier": 100.0,
    },
    "WallShears": {
        "directions": ["V2", "V3"],
        "unit": "kN",
        "multiplier": 1.0,
    },
}


def get_maxmin_dataset(
    service,
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


def _get_drift_maxmin(service, result_set_id: int) -> Optional[MaxMinDataset]:
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
    service,
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
    service,
    result_set_id: int,
    base_result_type: str,
    element_id: int,
) -> Optional[MaxMinDataset]:
    """Build max/min envelope for a specific element from ElementResultsCache.

    Fetches all direction variants for the element, then for each story
    computes absolute max across all load cases per direction.
    """
    config = ELEMENT_MAXMIN_CONFIG[base_result_type]
    directions = config["directions"]
    unit = config["unit"]
    multiplier = config["multiplier"]

    story_data: Dict[str, Dict[str, float]] = {}
    story_order: Dict[str, int] = {}

    for ui_dir in directions:
        cache_type = f"{base_result_type}_{ui_dir}"
        entries = ElementResultsCacheRepository.list_entries(
            service.project,
            result_set_id=result_set_id,
            result_type=cache_type,
            element_id=element_id,
        )

        for entry in entries:
            story_name = entry.story.name
            if story_name not in story_data:
                story_data[story_name] = {}
                story_order[story_name] = entry.story_sort_order or 0

            for lc_name, value in entry.results_matrix.items():
                scaled = value * multiplier
                col_prefix = f"{lc_name}_{ui_dir}"
                key_max = f"OrigMax_{col_prefix}"
                key_min = f"OrigMin_{col_prefix}"

                orig_max = scaled if scaled >= 0 else 0
                orig_min = scaled if scaled < 0 else 0

                if key_max in story_data[story_name]:
                    story_data[story_name][key_max] = max(
                        story_data[story_name][key_max], orig_max
                    )
                    story_data[story_name][key_min] = min(
                        story_data[story_name][key_min], orig_min
                    )
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
