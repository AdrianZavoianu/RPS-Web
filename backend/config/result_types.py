"""
Result type configurations.
Ported from RPS_desktop/src/config/result_config.py
"""
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class ResultTypeConfig:
    """Configuration for a result type."""
    name: str
    display_name: str
    unit: str
    direction_suffix: str = ''  # _X, _Y, _V2, _V3, etc.
    multiplier: float = 1.0     # For display (e.g., 100 for %)
    decimal_places: int = 2
    color_scheme: str = 'blue_orange'  # blue_orange or orange_blue
    directions: Optional[List[str]] = None
    internal_directions: Optional[Dict[str, str]] = None


# Global result types
GLOBAL_RESULT_CONFIGS = {
    'Drifts_X': ResultTypeConfig(
        name='Drifts_X',
        display_name='Story Drifts X',
        unit='%',
        direction_suffix='_X',
        multiplier=100.0,
        decimal_places=3,
        color_scheme='blue_orange',
    ),
    'Drifts_Y': ResultTypeConfig(
        name='Drifts_Y',
        display_name='Story Drifts Y',
        unit='%',
        direction_suffix='_Y',
        multiplier=100.0,
        decimal_places=3,
        color_scheme='blue_orange',
    ),
    'Accelerations_UX': ResultTypeConfig(
        name='Accelerations_UX',
        display_name='Accelerations UX',
        unit='g',
        direction_suffix='_UX',
        multiplier=1 / 9810,
        decimal_places=3,
        color_scheme='blue_orange',
    ),
    'Accelerations_UY': ResultTypeConfig(
        name='Accelerations_UY',
        display_name='Accelerations UY',
        unit='g',
        direction_suffix='_UY',
        multiplier=1 / 9810,
        decimal_places=3,
        color_scheme='blue_orange',
    ),
    'Forces_VX': ResultTypeConfig(
        name='Forces_VX',
        display_name='Story Forces VX',
        unit='kN',
        direction_suffix='_VX',
        multiplier=1.0,
        decimal_places=1,
        color_scheme='blue_orange',
    ),
    'Forces_VY': ResultTypeConfig(
        name='Forces_VY',
        display_name='Story Forces VY',
        unit='kN',
        direction_suffix='_VY',
        multiplier=1.0,
        decimal_places=1,
        color_scheme='blue_orange',
    ),
    'Displacements_UX': ResultTypeConfig(
        name='Displacements_UX',
        display_name='Displacements UX',
        unit='mm',
        direction_suffix='_UX',
        multiplier=1.0,
        decimal_places=2,
        color_scheme='blue_orange',
    ),
    'Displacements_UY': ResultTypeConfig(
        name='Displacements_UY',
        display_name='Displacements UY',
        unit='mm',
        direction_suffix='_UY',
        multiplier=1.0,
        decimal_places=2,
        color_scheme='blue_orange',
    ),
}

# Element result types
ELEMENT_RESULT_CONFIGS = {
    'WallShears_V2': ResultTypeConfig(
        name='WallShears_V2',
        display_name='Wall Shears V2',
        unit='kN',
        direction_suffix='_V2',
        multiplier=1.0,
        decimal_places=1,
        color_scheme='blue_orange',
    ),
    'WallShears_V3': ResultTypeConfig(
        name='WallShears_V3',
        display_name='Wall Shears V3',
        unit='kN',
        direction_suffix='_V3',
        multiplier=1.0,
        decimal_places=1,
        color_scheme='blue_orange',
    ),
    'QuadRotations': ResultTypeConfig(
        name='QuadRotations',
        display_name='Quad Rotations',
        unit='%',
        direction_suffix='',
        multiplier=100.0,
        decimal_places=3,
        color_scheme='blue_orange',
    ),
    'ColumnShears_V2': ResultTypeConfig(
        name='ColumnShears_V2',
        display_name='Column Shears V2',
        unit='kN',
        direction_suffix='_V2',
        multiplier=1.0,
        decimal_places=1,
        color_scheme='blue_orange',
    ),
    'ColumnShears_V3': ResultTypeConfig(
        name='ColumnShears_V3',
        display_name='Column Shears V3',
        unit='kN',
        direction_suffix='_V3',
        multiplier=1.0,
        decimal_places=1,
        color_scheme='blue_orange',
    ),
    'ColumnAxials': ResultTypeConfig(
        name='ColumnAxials',
        display_name='Column Axial Forces',
        unit='kN',
        direction_suffix='',
        multiplier=1.0,
        decimal_places=1,
        color_scheme='blue_orange',
    ),
    'ColumnRotations_R2': ResultTypeConfig(
        name='ColumnRotations_R2',
        display_name='Column Rotations R2',
        unit='%',
        direction_suffix='_R2',
        multiplier=100.0,
        decimal_places=3,
        color_scheme='blue_orange',
    ),
    'ColumnRotations_R3': ResultTypeConfig(
        name='ColumnRotations_R3',
        display_name='Column Rotations R3',
        unit='%',
        direction_suffix='_R3',
        multiplier=100.0,
        decimal_places=3,
        color_scheme='blue_orange',
    ),
    'BeamRotations': ResultTypeConfig(
        name='BeamRotations',
        display_name='Beam Rotations R3',
        unit='%',
        direction_suffix='',
        multiplier=100.0,
        decimal_places=3,
        color_scheme='blue_orange',
    ),
}

# Joint/Foundation result types
JOINT_RESULT_CONFIGS = {
    'SoilPressures_Min': ResultTypeConfig(
        name='SoilPressures_Min',
        display_name='Soil Pressures (Min)',
        unit='kN/m²',
        direction_suffix='_Min',
        multiplier=1.0,
        decimal_places=1,
        color_scheme='orange_blue',  # Inverted: low (orange) is critical
    ),
    'VerticalDisplacements_Min': ResultTypeConfig(
        name='VerticalDisplacements_Min',
        display_name='Vertical Displacements (Min)',
        unit='mm',
        direction_suffix='_Min',
        multiplier=1.0,
        decimal_places=2,
        color_scheme='orange_blue',
    ),
}

# Combined configs
RESULT_CONFIGS = {
    **GLOBAL_RESULT_CONFIGS,
    **ELEMENT_RESULT_CONFIGS,
    **JOINT_RESULT_CONFIGS,
}

# Mapping for API-facing/base result types used by ResultDataService.
RESULT_TYPE_BASE_MAP = {
    'Drifts': {
        'variants': ('Drifts_X', 'Drifts_Y'),
        'directions': ['X', 'Y'],
        'internal_directions': {'X': 'X', 'Y': 'Y'},
        'decimals': 2,
    },
    'Accelerations': {
        'variants': ('Accelerations_UX', 'Accelerations_UY'),
        'directions': ['X', 'Y'],
        'internal_directions': {'X': 'UX', 'Y': 'UY'},
        'decimals': 2,
    },
    'Forces': {
        'variants': ('Forces_VX', 'Forces_VY'),
        'directions': ['X', 'Y'],
        'internal_directions': {'X': 'VX', 'Y': 'VY'},
        'decimals': 0,
    },
    'Displacements': {
        'variants': ('Displacements_UX', 'Displacements_UY'),
        'directions': ['X', 'Y'],
        'internal_directions': {'X': 'UX', 'Y': 'UY'},
        'decimals': 0,
    },
    'WallShears': {
        'variants': ('WallShears_V2', 'WallShears_V3'),
        'directions': ['X', 'Y'],
        'internal_directions': {'X': 'V2', 'Y': 'V3'},
        'decimals': 0,
    },
    'QuadRotations': {
        'variants': ('QuadRotations',),
        'directions': None,
        'internal_directions': {},
        'decimals': 2,
    },
    'ColumnShears': {
        'variants': ('ColumnShears_V2', 'ColumnShears_V3'),
        'directions': ['X', 'Y'],
        'internal_directions': {'X': 'V2', 'Y': 'V3'},
        'decimals': 0,
    },
    'ColumnAxials': {
        'variants': ('ColumnAxials',),
        'directions': None,
        'internal_directions': {},
        'decimals': 0,
    },
    'ColumnRotations': {
        'variants': ('ColumnRotations_R2', 'ColumnRotations_R3'),
        'directions': ['X', 'Y'],
        'internal_directions': {'X': 'R2', 'Y': 'R3'},
        'decimals': 2,
    },
    'BeamRotations': {
        'variants': ('BeamRotations',),
        'directions': None,
        'internal_directions': {},
        'decimals': 2,
    },
    'SoilPressures': {
        'variants': ('SoilPressures_Min',),
        'directions': None,
        'internal_directions': {},
        'decimals': 2,
    },
    'VerticalDisplacements': {
        'variants': ('VerticalDisplacements_Min',),
        'directions': None,
        'internal_directions': {},
        'decimals': 0,
    },
}


def _build_result_type_config() -> Dict[str, Dict]:
    """Build API-facing result type config from canonical result configs."""
    config: Dict[str, Dict] = {}
    for base_type, mapping in RESULT_TYPE_BASE_MAP.items():
        variant_name = mapping['variants'][0]
        variant_config = RESULT_CONFIGS[variant_name]
        config[base_type] = {
            'unit': variant_config.unit,
            'multiplier': variant_config.multiplier,
            'directions': mapping['directions'],
            'internal_directions': mapping['internal_directions'],
            'decimals': mapping['decimals'],
        }
    return config


# Canonical API/service result type configuration.
RESULT_TYPE_CONFIG = _build_result_type_config()


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
    return config.unit if config else ''
