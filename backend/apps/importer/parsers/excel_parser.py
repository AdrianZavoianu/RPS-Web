"""Excel file parser facade for ETABS/SAP2000 results."""

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from .sheets import (
    AccelerationSheetParser,
    DisplacementSheetParser,
    DriftSheetParser,
    ElementSheetParser,
    ForceSheetParser,
    JointSheetParser,
    PushoverSheetParser,
    TimeSeriesSheetParser,
    WorkbookSheetParser,
)

logger = logging.getLogger(__name__)


@dataclass
class TimeSeriesData:
    """Container for a single time series (one story, one direction)."""

    story: str
    direction: str
    time_steps: List[float]
    values: List[float]
    story_sort_order: int = 0


@dataclass
class TimeHistoryParseResult:
    """Container for all parsed time history data from a file."""

    load_case_name: str
    drifts_x: List[TimeSeriesData] = field(default_factory=list)
    drifts_y: List[TimeSeriesData] = field(default_factory=list)
    forces_x: List[TimeSeriesData] = field(default_factory=list)
    forces_y: List[TimeSeriesData] = field(default_factory=list)
    displacements_x: List[TimeSeriesData] = field(default_factory=list)
    displacements_y: List[TimeSeriesData] = field(default_factory=list)
    accelerations_x: List[TimeSeriesData] = field(default_factory=list)
    accelerations_y: List[TimeSeriesData] = field(default_factory=list)
    stories: List[str] = field(default_factory=list)


class ExcelParser:
    """Parser facade that delegates sheet-specific work to focused parser modules."""

    _DELEGATED_METHODS: Dict[str, Tuple[str, str]] = {
        # Workbook/caching helpers
        "read_sheet": ("_workbook_parser", "read_sheet"),
        "get_available_sheets": ("_workbook_parser", "get_available_sheets"),
        "validate_sheet_exists": ("_workbook_parser", "validate_sheet_exists"),
        "_load_joint_displacements_full": ("_workbook_parser", "load_joint_displacements_full"),
        "_get_sheet_headers": ("_workbook_parser", "get_sheet_headers"),
        "_get_load_cases_only_openpyxl": ("_workbook_parser", "get_load_cases_only_openpyxl"),
        "get_load_cases_only": ("_workbook_parser", "get_load_cases_only"),
        # Global/element/joint sheet parsing
        "get_story_drifts": ("_drift_parser", "get_story_drifts"),
        "get_story_accelerations": ("_acceleration_parser", "get_story_accelerations"),
        "get_story_forces": ("_force_parser", "get_story_forces"),
        "get_pier_forces": ("_element_parser", "get_pier_forces"),
        "get_joint_displacements": ("_displacement_parser", "get_joint_displacements"),
        "get_column_forces": ("_element_parser", "get_column_forces"),
        "get_quad_rotations": ("_element_parser", "get_quad_rotations"),
        "get_fiber_hinge_states": ("_element_parser", "get_fiber_hinge_states"),
        "get_hinge_states": ("_element_parser", "get_hinge_states"),
        "get_soil_pressures": ("_joint_parser", "get_soil_pressures"),
        "get_foundation_joints": ("_displacement_parser", "get_foundation_joints"),
        "get_vertical_displacements": ("_displacement_parser", "get_vertical_displacements"),
        # Pushover
        "get_pushover_cases": ("_pushover_parser", "get_pushover_cases"),
        "get_pushover_curve_data": ("_pushover_parser", "get_pushover_curve_data"),
        "get_pushover_directions": ("_pushover_parser", "get_pushover_directions"),
        "get_pushover_global_results": ("_pushover_parser", "get_pushover_global_results"),
        "_filter_pushover_cases": ("_pushover_parser", "filter_pushover_cases"),
        "_extract_pushover_drifts": ("_pushover_parser", "extract_pushover_drifts"),
        "_extract_pushover_displacements": (
            "_pushover_parser",
            "extract_pushover_displacements",
        ),
        "_extract_pushover_forces": ("_pushover_parser", "extract_pushover_forces"),
        # Time-series
        "parse_time_history": ("_time_series_parser", "parse_time_history"),
        "_detect_time_history_load_case": ("_time_series_parser", "detect_time_history_load_case"),
        "_parse_story_drifts_timeseries": ("_time_series_parser", "parse_story_drifts_timeseries"),
        "_parse_story_forces_timeseries": ("_time_series_parser", "parse_story_forces_timeseries"),
        "_parse_joint_displacements_timeseries": (
            "_time_series_parser",
            "parse_joint_displacements_timeseries",
        ),
        "_parse_diaphragm_accelerations_timeseries": (
            "_time_series_parser",
            "parse_diaphragm_accelerations_timeseries",
        ),
        "_extract_time_series_by_direction": (
            "_time_series_parser",
            "extract_time_series_by_direction",
        ),
        "_extract_time_series_direct": ("_time_series_parser", "extract_time_series_direct"),
        "has_time_series_data": ("_time_series_parser", "has_time_series_data"),
    }

    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        if not self.file_path.exists():
            raise FileNotFoundError(f"Excel file not found: {file_path}")

        # Workbook and cache state shared across delegated parsers
        self._excel_file: Optional[pd.ExcelFile] = None
        self._joint_displacements_df: Optional[pd.DataFrame] = None
        self._available_sheets: Optional[List[str]] = None
        self._column_forces_df: Optional[pd.DataFrame] = None
        self._sheet_headers_cache: Dict[str, List[Any]] = {}
        self._load_cases_cache: Dict[str, List[str]] = {}

        # Delegated parser components
        self._workbook_parser = WorkbookSheetParser(self)
        self._drift_parser = DriftSheetParser(self)
        self._acceleration_parser = AccelerationSheetParser(self)
        self._force_parser = ForceSheetParser(self)
        self._displacement_parser = DisplacementSheetParser(self)
        self._element_parser = ElementSheetParser(self)
        self._joint_parser = JointSheetParser(self)
        self._pushover_parser = PushoverSheetParser(self)
        self._time_series_parser = TimeSeriesSheetParser(self)

    def _get_excel_file(self) -> pd.ExcelFile:
        if self._excel_file is None:
            self._excel_file = pd.ExcelFile(self.file_path)
        return self._excel_file

    def close(self) -> None:
        excel_file = getattr(self, "_excel_file", None)
        if excel_file is not None:
            try:
                excel_file.close()
            except (AttributeError, OSError, ValueError) as exc:
                logger.warning("Failed to close Excel file '%s': %s", self.file_path, exc)
            self._excel_file = None

    def __del__(self) -> None:
        self.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False

    def __getattr__(self, name: str) -> Any:
        delegate = self._DELEGATED_METHODS.get(name)
        if delegate is None:
            raise AttributeError(f"{self.__class__.__name__} object has no attribute '{name}'")

        parser_attr, method_name = delegate
        component = object.__getattribute__(self, parser_attr)
        return getattr(component, method_name)

    @staticmethod
    def detect_pushover_direction(case_name: str) -> str:
        """Backward-compatible class-level API used by legacy import runners."""
        return PushoverSheetParser.detect_pushover_direction(case_name)

    def get_unique_values(self, df: pd.DataFrame, column_names: List[str]) -> Dict[str, List[Any]]:
        """Get unique values for specified columns."""
        result = {}
        for col_name in column_names:
            if col_name in df.columns:
                result[col_name] = df[col_name].unique().tolist()
            else:
                raise ValueError(f"Column '{col_name}' not found in DataFrame")
        return result

    @staticmethod
    def _new_time_history_result(load_case_name: str) -> TimeHistoryParseResult:
        return TimeHistoryParseResult(load_case_name=load_case_name)

    @staticmethod
    def _new_time_series_data(
        story: str,
        direction: str,
        time_steps: List[float],
        values: List[float],
        story_sort_order: int,
    ) -> TimeSeriesData:
        return TimeSeriesData(
            story=story,
            direction=direction,
            time_steps=time_steps,
            values=values,
            story_sort_order=story_sort_order,
        )
