"""Provider functions for max/min envelope datasets."""

from typing import Dict, Optional

from config.result_types import RESULT_TYPE_CONFIG

from apps.results.models import (
    AbsoluteMaxMinDrift,
    ResultCategory,
    ResultSet,
    StoryAcceleration,
    StoryDisplacement,
    StoryDrift,
    StoryForce,
)

from ..datasets import MaxMinDataset, ResultDatasetMeta


RAW_MODEL_MAP = {
    "Drifts": (StoryDrift, "drift", "max_drift", "min_drift"),
    "Accelerations": (StoryAcceleration, "acceleration", "max_acceleration", "min_acceleration"),
    "Forces": (StoryForce, "force", "max_force", "min_force"),
    "Displacements": (StoryDisplacement, "displacement", "max_displacement", "min_displacement"),
}


def get_maxmin_dataset(
    service,
    result_set_id: int,
    base_result_type: str = "Drifts",
) -> Optional[MaxMinDataset]:
    """Get max/min envelope data for a result type."""
    if base_result_type == "Drifts":
        result = _get_drift_maxmin(service, result_set_id)
        if result is None:
            result = _get_generic_maxmin(service, result_set_id, base_result_type)
        return result
    return _get_generic_maxmin(service, result_set_id, base_result_type)


def _get_drift_maxmin(service, result_set_id: int) -> Optional[MaxMinDataset]:
    """Get max/min drifts from precomputed table."""
    entries = (
        AbsoluteMaxMinDrift.objects.filter(
            project=service.project,
            result_set_id=result_set_id,
        )
        .select_related("story", "load_case")
        .order_by("-story__sort_order")
    )

    if not entries.exists():
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
        meta=ResultDatasetMeta(
            result_type="MaxMin_Drifts",
            direction=None,
            result_set_id=result_set_id,
            display_name="Max/Min Drifts (%)",
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

    model_info = RAW_MODEL_MAP.get(base_result_type)
    if not model_info:
        return None

    model_class, primary_field, max_field, min_field = model_info

    try:
        result_set = ResultSet.objects.get(id=result_set_id)
    except ResultSet.DoesNotExist:
        return None

    categories = ResultCategory.objects.filter(result_set=result_set)
    if not categories.exists():
        return None

    story_data: Dict[str, Dict[str, float]] = {}
    story_order: Dict[str, int] = {}

    for ui_dir in directions:
        internal_dir = internal_directions.get(ui_dir, ui_dir)

        entries = (
            model_class.objects.filter(
                story__project=service.project,
                result_category__in=categories,
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
        meta=ResultDatasetMeta(
            result_type=f"MaxMin_{base_result_type}",
            direction=None,
            result_set_id=result_set_id,
            display_name=f'Max/Min {base_result_type} ({config.get("unit", "")})',
        ),
        rows=rows,
        directions=tuple(directions),
        source_type=base_result_type,
    )
