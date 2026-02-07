"""Data transformers for different result types.

Ported from RPS_desktop/src/processing/result_transformers.py
"""

import logging
from abc import ABC, abstractmethod
from collections import Counter

import pandas as pd

from config.result_types import RESULT_CONFIGS, get_config

logger = logging.getLogger(__name__)


class ResultTransformer(ABC):
    """Base class for result-specific data transformations."""

    def __init__(self, result_type: str):
        self.result_type = result_type
        self.config = get_config(result_type)

    @abstractmethod
    def filter_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter relevant columns for this result type."""
        pass

    def clean_column_names(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean and standardize column names.

        Default implementation extracts load case name from columns like:
        "160Wil_DES_Global_TH01_X" -> "TH01"
        """
        if self.config is None:
            return df

        cleaned_columns = []
        direction_suffix = self.config.direction_suffix or ""

        for col in df.columns:
            # Remove direction suffix
            col_without_suffix = col.replace(direction_suffix, "") if direction_suffix else col
            # Get the last part after splitting by underscore (load case name)
            parts = col_without_suffix.split("_")
            load_case_name = parts[-1] if parts else col_without_suffix
            cleaned_columns.append(load_case_name)

        # Check for duplicates and log warning
        duplicates = [col for col, count in Counter(cleaned_columns).items() if count > 1]
        if duplicates:
            logger.warning(f"Duplicate column names after cleaning: {duplicates}")
            logger.warning(f"Original columns: {list(df.columns)}")
            logger.warning(f"Cleaned columns: {cleaned_columns}")

        df.columns = cleaned_columns
        return df

    def add_statistics(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Add computed statistics columns (Avg, Max, Min).

        Default implementation calculates across all numeric columns.
        """
        numeric_data = df.apply(pd.to_numeric, errors="coerce")
        df["Avg"] = numeric_data.mean(axis=1)
        df["Max"] = numeric_data.max(axis=1)
        df["Min"] = numeric_data.min(axis=1)
        return df

    def transform(self, df: pd.DataFrame, skip_summary: bool = False) -> pd.DataFrame:
        """
        Full transformation pipeline.

        1. Filter relevant columns
        2. Clean column names
        3. Add statistics (unless skip_summary=True for Pushover)

        Args:
            df: Input DataFrame
            skip_summary: If True, skip adding Avg/Max/Min columns (for Pushover results)
        """
        df = self.filter_columns(df)
        df = self.clean_column_names(df)
        if not skip_summary:
            df = self.add_statistics(df)
        return df


class GenericResultTransformer(ResultTransformer):
    """Generic transformer that works for any result type with direction suffix."""

    def __init__(self, result_type: str):
        super().__init__(result_type)

    def filter_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Keep only columns ending with configured direction suffix."""
        if self.config is None or not self.config.direction_suffix:
            return df.copy()
        filtered_columns = [col for col in df.columns if col.endswith(self.config.direction_suffix)]
        return df[filtered_columns].copy()


class QuadRotationTransformer(GenericResultTransformer):
    """Transformer for quad rotation results (already converted to percentage in cache)."""

    def __init__(self):
        super().__init__("QuadRotations")

    def filter_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Keep all columns (no direction filtering needed for rotations)."""
        return df.copy()


class MinAxialTransformer(GenericResultTransformer):
    """Transformer for minimum axial force results."""

    def __init__(self):
        super().__init__("ColumnAxials")

    def filter_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Keep all columns (no direction filtering needed for axial forces)."""
        return df.copy()


class BeamRotationTransformer(GenericResultTransformer):
    """Transformer for beam R3 plastic rotation results."""

    def __init__(self):
        super().__init__("BeamRotations")

    def filter_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Keep all columns (no direction filtering needed for beam rotations)."""
        return df.copy()


class SoilPressureTransformer(GenericResultTransformer):
    """Transformer for minimum soil pressure results."""

    def __init__(self):
        super().__init__("SoilPressures_Min")

    def filter_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Keep all columns (no direction filtering needed for soil pressures)."""
        return df.copy()


class VerticalDisplacementTransformer(GenericResultTransformer):
    """Transformer for minimum vertical displacement results."""

    def __init__(self):
        super().__init__("VerticalDisplacements_Min")

    def filter_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Keep all columns (no direction filtering needed for displacements)."""
        return df.copy()


def _build_transformer_registry() -> dict:
    """Build the transformer registry from RESULT_CONFIGS."""
    transformers = {
        result_type: GenericResultTransformer(result_type) for result_type in RESULT_CONFIGS
    }
    # Override with specialized transformers
    transformers.update(
        {
            "QuadRotations": QuadRotationTransformer(),
            "ColumnAxials": MinAxialTransformer(),
            "BeamRotations": BeamRotationTransformer(),
            "SoilPressures_Min": SoilPressureTransformer(),
            "VerticalDisplacements_Min": VerticalDisplacementTransformer(),
        }
    )
    return transformers


TRANSFORMERS = _build_transformer_registry()


def get_transformer(result_type: str) -> ResultTransformer:
    """Get transformer for a result type."""
    return TRANSFORMERS.get(
        result_type, TRANSFORMERS.get("Drifts_X", GenericResultTransformer("Drifts_X"))
    )
