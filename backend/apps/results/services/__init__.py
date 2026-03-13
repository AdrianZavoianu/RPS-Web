"""Result services package."""

from .result_service import (
    ResultDataService,
    ResultDataset,
    ResultDatasetMeta,
    MaxMinDataset,
    ComparisonDataset,
    ComparisonSeries,
    RESULT_TYPE_CONFIG,
)
from .fallback_policy import (
    FALLBACK_CACHE_ONLY,
    FALLBACK_CACHE_THEN_RAW,
)

__all__ = [
    "ResultDataService",
    "ResultDataset",
    "ResultDatasetMeta",
    "MaxMinDataset",
    "ComparisonDataset",
    "ComparisonSeries",
    "RESULT_TYPE_CONFIG",
    "FALLBACK_CACHE_ONLY",
    "FALLBACK_CACHE_THEN_RAW",
]
