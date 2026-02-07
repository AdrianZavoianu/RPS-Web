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

__all__ = [
    "ResultDataService",
    "ResultDataset",
    "ResultDatasetMeta",
    "MaxMinDataset",
    "ComparisonDataset",
    "ComparisonSeries",
    "RESULT_TYPE_CONFIG",
]
