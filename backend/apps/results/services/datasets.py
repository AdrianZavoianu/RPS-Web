"""Shared dataset dataclasses and helpers for results services."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from config.result_types import RESULT_TYPE_CONFIG


@dataclass
class ResultDatasetMeta:
    """Metadata for a result dataset."""

    result_type: str
    direction: Optional[str]
    result_set_id: int
    display_name: str


@dataclass
class ResultDataset:
    """Container for result data with metadata."""

    meta: ResultDatasetMeta
    rows: List[Dict[str, Any]]
    load_case_columns: List[str]
    summary_columns: List[str] = field(default_factory=list)
    story_column: str = "Story"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to serializable dict."""
        return {
            "meta": {
                "result_type": self.meta.result_type,
                "direction": self.meta.direction,
                "result_set_id": self.meta.result_set_id,
                "display_name": self.meta.display_name,
            },
            "rows": self.rows,
            "load_case_columns": self.load_case_columns,
            "summary_columns": self.summary_columns,
            "story_column": self.story_column,
        }


@dataclass
class MaxMinDataset:
    """Container for max/min envelope data."""

    meta: ResultDatasetMeta
    rows: List[Dict[str, Any]]
    directions: Tuple[str, ...]
    source_type: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to serializable dict."""
        return {
            "meta": {
                "result_type": self.meta.result_type,
                "direction": self.meta.direction,
                "result_set_id": self.meta.result_set_id,
                "display_name": self.meta.display_name,
            },
            "rows": self.rows,
            "directions": self.directions,
            "source_type": self.source_type,
        }


@dataclass
class ComparisonSeries:
    """Single series in a comparison dataset."""

    result_set_id: int
    result_set_name: str
    values: Dict[str, float]
    has_data: bool
    warning: Optional[str] = None


@dataclass
class ComparisonDataset:
    """Container for comparison data across result sets."""

    result_type: str
    direction: Optional[str]
    metric: str
    series: List[ComparisonSeries]
    rows: List[Dict[str, Any]]
    ratio_column: Optional[str] = None
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to serializable dict."""
        return {
            "result_type": self.result_type,
            "direction": self.direction,
            "metric": self.metric,
            "series": [
                {
                    "result_set_id": s.result_set_id,
                    "result_set_name": s.result_set_name,
                    "has_data": s.has_data,
                    "warning": s.warning,
                }
                for s in self.series
            ],
            "rows": self.rows,
            "ratio_column": self.ratio_column,
            "warnings": self.warnings,
        }


def get_internal_direction(result_type: str, direction: str) -> str:
    """Map user-friendly direction (X/Y) to internal cache direction code."""

    config = RESULT_TYPE_CONFIG.get(result_type, {})
    internal_map = config.get("internal_directions", {})
    return internal_map.get(direction, direction)
