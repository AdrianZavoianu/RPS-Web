"""
Result type configurations.
Ported from RPS_desktop/src/config/result_config.py
"""
from functools import lru_cache
from importlib import import_module
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple, Type


@dataclass
class ResultTypeConfig:
    """Configuration for a result type.

    Each entry represents one variant (e.g. Drifts_X).  Base-type metadata
    (directions, decimals exposed to the API) is derived automatically by
    grouping variants that share a base-type prefix.

    ``display_direction`` — user-facing direction label for this variant
        (e.g. "X" when ``direction_suffix`` is "_UX").
    ``base_decimals`` — decimal places for the *base* type API response;
        set on the first variant of each group.  Defaults to
        ``decimal_places - 1`` when omitted.
    ``directions`` / ``internal_directions`` — explicit override for types
        whose API directions are not derivable from variants (e.g.
        ColumnAxials exposes Min/Max but has a single variant with no suffix).
    """

    name: str
    display_name: str
    unit: str
    direction_suffix: str = ""  # _X, _Y, _V2, _V3, etc.
    multiplier: float = 1.0  # For display (e.g., 100 for %)
    decimal_places: int = 2
    color_scheme: str = "blue_orange"  # blue_orange or orange_blue
    display_direction: str = ""
    base_decimals: Optional[int] = None
    directions: Optional[List[str]] = None
    internal_directions: Optional[Dict[str, str]] = None


# Global result types
GLOBAL_RESULT_CONFIGS = {
    "Drifts_X": ResultTypeConfig(
        name="Drifts_X",
        display_name="Story Drifts X",
        unit="%",
        direction_suffix="_X",
        multiplier=100.0,
        decimal_places=3,
        color_scheme="blue_orange",
        display_direction="X",
        base_decimals=2,
    ),
    "Drifts_Y": ResultTypeConfig(
        name="Drifts_Y",
        display_name="Story Drifts Y",
        unit="%",
        direction_suffix="_Y",
        multiplier=100.0,
        decimal_places=3,
        color_scheme="blue_orange",
        display_direction="Y",
    ),
    "Accelerations_UX": ResultTypeConfig(
        name="Accelerations_UX",
        display_name="Accelerations UX",
        unit="g",
        direction_suffix="_UX",
        multiplier=1 / 9810,
        decimal_places=3,
        color_scheme="blue_orange",
        display_direction="X",
        base_decimals=2,
    ),
    "Accelerations_UY": ResultTypeConfig(
        name="Accelerations_UY",
        display_name="Accelerations UY",
        unit="g",
        direction_suffix="_UY",
        multiplier=1 / 9810,
        decimal_places=3,
        color_scheme="blue_orange",
        display_direction="Y",
    ),
    "Forces_VX": ResultTypeConfig(
        name="Forces_VX",
        display_name="Story Forces VX",
        unit="kN",
        direction_suffix="_VX",
        multiplier=1.0,
        decimal_places=1,
        color_scheme="blue_orange",
        display_direction="X",
        base_decimals=0,
    ),
    "Forces_VY": ResultTypeConfig(
        name="Forces_VY",
        display_name="Story Forces VY",
        unit="kN",
        direction_suffix="_VY",
        multiplier=1.0,
        decimal_places=1,
        color_scheme="blue_orange",
        display_direction="Y",
    ),
    "Displacements_UX": ResultTypeConfig(
        name="Displacements_UX",
        display_name="Displacements UX",
        unit="mm",
        direction_suffix="_UX",
        multiplier=1.0,
        decimal_places=2,
        color_scheme="blue_orange",
        display_direction="X",
        base_decimals=0,
    ),
    "Displacements_UY": ResultTypeConfig(
        name="Displacements_UY",
        display_name="Displacements UY",
        unit="mm",
        direction_suffix="_UY",
        multiplier=1.0,
        decimal_places=2,
        color_scheme="blue_orange",
        display_direction="Y",
    ),
}

# Element result types
ELEMENT_RESULT_CONFIGS = {
    "WallShears_V2": ResultTypeConfig(
        name="WallShears_V2",
        display_name="Wall Shears V2",
        unit="kN",
        direction_suffix="_V2",
        multiplier=1.0,
        decimal_places=1,
        color_scheme="blue_orange",
        display_direction="V2",
        base_decimals=0,
    ),
    "WallShears_V3": ResultTypeConfig(
        name="WallShears_V3",
        display_name="Wall Shears V3",
        unit="kN",
        direction_suffix="_V3",
        multiplier=1.0,
        decimal_places=1,
        color_scheme="blue_orange",
        display_direction="V3",
    ),
    "QuadRotations": ResultTypeConfig(
        name="QuadRotations",
        display_name="Quad Rotations",
        unit="%",
        multiplier=100.0,
        decimal_places=3,
        color_scheme="blue_orange",
        base_decimals=2,
    ),
    "ColumnShears_V2": ResultTypeConfig(
        name="ColumnShears_V2",
        display_name="Column Shears V2",
        unit="kN",
        direction_suffix="_V2",
        multiplier=1.0,
        decimal_places=1,
        color_scheme="blue_orange",
        display_direction="V2",
        base_decimals=0,
    ),
    "ColumnShears_V3": ResultTypeConfig(
        name="ColumnShears_V3",
        display_name="Column Shears V3",
        unit="kN",
        direction_suffix="_V3",
        multiplier=1.0,
        decimal_places=1,
        color_scheme="blue_orange",
        display_direction="V3",
    ),
    "ColumnAxials": ResultTypeConfig(
        name="ColumnAxials",
        display_name="Column Axial Forces",
        unit="kN",
        multiplier=1.0,
        decimal_places=1,
        color_scheme="blue_orange",
        base_decimals=0,
        directions=["Min", "Max"],
        internal_directions={"Min": "Min", "Max": "Max"},
    ),
    "ColumnRotations_R2": ResultTypeConfig(
        name="ColumnRotations_R2",
        display_name="Column Rotations R2",
        unit="%",
        direction_suffix="_R2",
        multiplier=100.0,
        decimal_places=3,
        color_scheme="blue_orange",
        display_direction="R2",
        base_decimals=2,
    ),
    "ColumnRotations_R3": ResultTypeConfig(
        name="ColumnRotations_R3",
        display_name="Column Rotations R3",
        unit="%",
        direction_suffix="_R3",
        multiplier=100.0,
        decimal_places=3,
        color_scheme="blue_orange",
        display_direction="R3",
    ),
    "BeamRotations": ResultTypeConfig(
        name="BeamRotations",
        display_name="Beam Rotations R3",
        unit="%",
        multiplier=100.0,
        decimal_places=3,
        color_scheme="blue_orange",
        base_decimals=2,
    ),
}

# Joint/Foundation result types
JOINT_RESULT_CONFIGS = {
    "SoilPressures_Min": ResultTypeConfig(
        name="SoilPressures_Min",
        display_name="Soil Pressures (Min)",
        unit="kN/m²",
        direction_suffix="_Min",
        multiplier=1.0,
        decimal_places=1,
        color_scheme="orange_blue",  # Inverted: low (orange) is critical
        base_decimals=0,
    ),
    "VerticalDisplacements_Min": ResultTypeConfig(
        name="VerticalDisplacements_Min",
        display_name="Vertical Displacements (Min)",
        unit="mm",
        direction_suffix="_Min",
        multiplier=1.0,
        decimal_places=2,
        color_scheme="orange_blue",
        base_decimals=0,
    ),
}

# Combined configs
RESULT_CONFIGS = {
    **GLOBAL_RESULT_CONFIGS,
    **ELEMENT_RESULT_CONFIGS,
    **JOINT_RESULT_CONFIGS,
}

def _derive_base_map(configs: Dict[str, ResultTypeConfig]) -> Dict[str, Dict]:
    """Derive API-facing base-type map from variant-level RESULT_CONFIGS.

    Groups variants by base-type prefix, then builds directions and decimals
    from the annotated ``display_direction`` / ``base_decimals`` fields.
    """
    from collections import OrderedDict

    groups: Dict[str, List[ResultTypeConfig]] = OrderedDict()
    for key, cfg in configs.items():
        base = key.rsplit("_", 1)[0] if cfg.direction_suffix else key
        groups.setdefault(base, []).append(cfg)

    result: Dict[str, Dict] = {}
    for base_type, variants in groups.items():
        first = variants[0]

        # Determine directions
        if first.directions is not None:
            # Explicit override (e.g. ColumnAxials Min/Max)
            directions = first.directions
            internal_dirs = first.internal_directions or {}
        elif len(variants) > 1:
            # Derive from display_direction of each variant
            directions = [v.display_direction for v in variants]
            internal_dirs = {
                v.display_direction: v.direction_suffix.lstrip("_")
                for v in variants
            }
        else:
            directions = None
            internal_dirs = {}

        # Decimals: use explicit base_decimals, fall back to decimal_places - 1
        decimals = first.base_decimals
        if decimals is None:
            decimals = max(0, first.decimal_places - 1)

        result[base_type] = {
            "variants": tuple(v.name for v in variants),
            "directions": directions,
            "internal_directions": internal_dirs,
            "decimals": decimals,
        }

    return result


# Mapping for API-facing/base result types — derived from RESULT_CONFIGS.
RESULT_TYPE_BASE_MAP = _derive_base_map(RESULT_CONFIGS)


def _build_result_type_config() -> Dict[str, Dict]:
    """Build API-facing result type config from canonical result configs."""
    config: Dict[str, Dict] = {}
    for base_type, mapping in RESULT_TYPE_BASE_MAP.items():
        variant_name = mapping["variants"][0]
        variant_config = RESULT_CONFIGS[variant_name]
        config[base_type] = {
            "unit": variant_config.unit,
            "multiplier": variant_config.multiplier,
            "directions": mapping["directions"],
            "internal_directions": mapping["internal_directions"],
            "decimals": mapping["decimals"],
        }
    return config


# Canonical API/service result type configuration.
RESULT_TYPE_CONFIG = _build_result_type_config()


# Print-optimized palette used in backend report charts.
PLOT_COLORS = [
    "#dc2626",  # red
    "#2563eb",  # blue
    "#16a34a",  # green
    "#ea580c",  # orange
    "#9333ea",  # purple
    "#0891b2",  # cyan
    "#ca8a04",  # yellow
    "#db2777",  # pink
    "#4f46e5",  # indigo
    "#059669",  # emerald
    "#d97706",  # amber
    "#7c3aed",  # violet
]


_AVAILABILITY_MODEL_PATHS: Dict[str, Dict[str, Tuple[str, str]]] = {
    "global": {
        "Drifts": ("apps.results.models.StoryDrift", "story__project"),
        "Accelerations": ("apps.results.models.StoryAcceleration", "story__project"),
        "Forces": ("apps.results.models.StoryForce", "story__project"),
        "Displacements": ("apps.results.models.StoryDisplacement", "story__project"),
    },
    "element": {
        "WallShears": ("apps.results.models.WallShear", "element__project"),
        "QuadRotations": ("apps.results.models.QuadRotation", "element__project"),
        "ColumnShears": ("apps.results.models.ColumnShear", "element__project"),
        "ColumnAxials": ("apps.results.models.ColumnAxial", "element__project"),
        "ColumnRotations": ("apps.results.models.ColumnRotation", "element__project"),
        "BeamRotations": ("apps.results.models.BeamRotation", "element__project"),
    },
    "joint": {
        "SoilPressures": ("apps.results.models.SoilPressure", "project"),
        "VerticalDisplacements": ("apps.results.models.VerticalDisplacement", "project"),
    },
}

_MAXMIN_RAW_SOURCE_PATHS: Dict[str, Tuple[str, str, str, str]] = {
    "Drifts": ("apps.results.models.StoryDrift", "drift", "max_drift", "min_drift"),
    "Accelerations": (
        "apps.results.models.StoryAcceleration",
        "acceleration",
        "max_acceleration",
        "min_acceleration",
    ),
    "Forces": ("apps.results.models.StoryForce", "force", "max_force", "min_force"),
    "Displacements": (
        "apps.results.models.StoryDisplacement",
        "displacement",
        "max_displacement",
        "min_displacement",
    ),
}


AvailabilityMap = Dict[str, Tuple[Type[Any], str]]
MaxMinRawSourceMap = Dict[str, Tuple[Type[Any], str, str, str]]


def _resolve_dotted_path(path: str) -> Type[Any]:
    """Resolve dotted-path references to imported class objects."""
    module_path, class_name = path.rsplit(".", 1)
    return getattr(import_module(module_path), class_name)


@lru_cache(maxsize=1)
def _build_availability_maps() -> Dict[str, AvailabilityMap]:
    resolved_maps: Dict[str, AvailabilityMap] = {}
    for category, mappings in _AVAILABILITY_MODEL_PATHS.items():
        resolved_maps[category] = {
            result_type: (_resolve_dotted_path(model_path), project_field)
            for result_type, (model_path, project_field) in mappings.items()
        }
    return resolved_maps


@lru_cache(maxsize=1)
def _build_maxmin_raw_source_map() -> MaxMinRawSourceMap:
    resolved: MaxMinRawSourceMap = {}
    for result_type, (model_path, primary_field, max_field, min_field) in _MAXMIN_RAW_SOURCE_PATHS.items():
        resolved[result_type] = (
            _resolve_dotted_path(model_path),
            primary_field,
            max_field,
            min_field,
        )
    return resolved


def get_maxmin_raw_source(result_type: str) -> Optional[Tuple[Type[Any], str, str, str]]:
    """Get max/min source mapping: (model, primary_field, max_field, min_field)."""
    return _build_maxmin_raw_source_map().get(result_type)


def get_availability_map(category: str) -> AvailabilityMap:
    """Get availability map for a category: global, element, or joint."""
    maps = _build_availability_maps()
    if category not in maps:
        raise ValueError(f"Unknown availability category '{category}'")
    return maps[category]


def get_plot_color(index: int) -> str:
    """Get deterministic plot color by index."""
    if index < 0:
        raise ValueError("index must be non-negative")
    if not PLOT_COLORS:
        raise ValueError("PLOT_COLORS is empty")
    return PLOT_COLORS[index % len(PLOT_COLORS)]


def get_config(result_type: str) -> Optional[ResultTypeConfig]:
    """Get configuration for a result type."""
    return RESULT_CONFIGS.get(result_type)


def get_display_name(result_type: str) -> str:
    """Get display name for a result type."""
    config = get_config(result_type)
    return config.display_name if config else result_type


def get_unit(result_type: str) -> str:
    """Get unit for a result type."""
    config = get_config(result_type)
    return config.unit if config else ""
