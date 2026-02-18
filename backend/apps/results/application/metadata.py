"""Application-layer metadata contract for result types."""

from __future__ import annotations

from copy import deepcopy
from functools import lru_cache
from typing import Any, Dict

from config.result_types import RESULT_TYPE_BASE_MAP, RESULT_TYPE_CONFIG

_GLOBAL_TYPES = {
    "Drifts",
    "Accelerations",
    "Forces",
    "Displacements",
}
_ELEMENT_TYPES = {
    "WallShears",
    "QuadRotations",
    "ColumnShears",
    "ColumnAxials",
    "ColumnRotations",
    "BeamRotations",
}
_JOINT_TYPES = {
    "SoilPressures",
    "VerticalDisplacements",
}


@lru_cache(maxsize=1)
def _build_result_type_metadata_contract() -> Dict[str, Any]:
    """Build a canonical metadata contract derived from backend config."""
    return {
        "version": 1,
        "result_type_config": deepcopy(RESULT_TYPE_CONFIG),
        "result_type_base_map": deepcopy(RESULT_TYPE_BASE_MAP),
        "categories": {
            "global": sorted(_GLOBAL_TYPES),
            "element": sorted(_ELEMENT_TYPES),
            "joint": sorted(_JOINT_TYPES),
        },
    }


def get_result_type_metadata_contract() -> Dict[str, Any]:
    """Return canonical, immutable-by-caller metadata for frontend/backend consumers."""
    return deepcopy(_build_result_type_metadata_contract())
