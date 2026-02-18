"""Time-series sheet parser."""

from __future__ import annotations

import logging
from typing import Any, List, Optional, Tuple

from .time_series_utils import (
    extract_time_series_by_direction,
    extract_time_series_direct,
    parse_diaphragm_accelerations_df,
    parse_joint_displacements_df,
    parse_story_drifts_df,
    parse_story_forces_df,
    resolve_step_number_col,
)
from ..base import BaseSheetParser

logger = logging.getLogger(__name__)


class TimeSeriesSheetParser(BaseSheetParser):
    """Parse step-by-step time history results."""

    def parse_time_history(self) -> Optional[Any]:
        load_case_name = self.detect_time_history_load_case()
        if not load_case_name:
            return None

        result = self.parser._new_time_history_result(load_case_name)

        if self.validate_sheet_exists("Story Drifts"):
            result.drifts_x, result.drifts_y, result.stories = self.parse_story_drifts_timeseries()

        if self.validate_sheet_exists("Story Forces"):
            forces_x, forces_y, _ = self.parse_story_forces_timeseries()
            result.forces_x = forces_x
            result.forces_y = forces_y

        if self.validate_sheet_exists("Joint Displacements"):
            displ_x, displ_y, _ = self.parse_joint_displacements_timeseries()
            result.displacements_x = displ_x
            result.displacements_y = displ_y

        if self.validate_sheet_exists("Diaphragm Accelerations"):
            accel_x, accel_y, _ = self.parse_diaphragm_accelerations_timeseries()
            result.accelerations_x = accel_x
            result.accelerations_y = accel_y

        has_data = (
            result.drifts_x
            or result.drifts_y
            or result.forces_x
            or result.forces_y
            or result.displacements_x
            or result.displacements_y
            or result.accelerations_x
            or result.accelerations_y
        )
        return result if has_data else None

    def detect_time_history_load_case(self) -> Optional[str]:
        sheet = "Story Drifts"
        if not self.validate_sheet_exists(sheet):
            return None

        try:
            df = self.get_excel_file().parse(
                sheet_name=sheet,
                skiprows=[0, 2],
                nrows=100,
            )
            if "Step Type" not in df.columns:
                return None

            step_by_step = df[df["Step Type"] == "Step By Step"]
            if step_by_step.empty:
                return None

            if "Output Case" in step_by_step.columns:
                return str(step_by_step["Output Case"].dropna().iloc[0])
            return None
        except Exception as exc:
            logger.warning("Error detecting time history load case: %s", exc)
            return None

    def parse_story_drifts_timeseries(self) -> Tuple[List[Any], List[Any], List[str]]:
        try:
            df = self.get_excel_file().parse(
                sheet_name="Story Drifts",
                skiprows=[0, 2],
            )
            return parse_story_drifts_df(df, self.parser._new_time_series_data)
        except Exception as exc:
            logger.warning("Error parsing story drifts time series: %s", exc)
            return [], [], []

    def parse_story_forces_timeseries(self) -> Tuple[List[Any], List[Any], List[str]]:
        try:
            df = self.get_excel_file().parse(
                sheet_name="Story Forces",
                skiprows=[0, 2],
            )
            return parse_story_forces_df(df, self.parser._new_time_series_data)
        except Exception as exc:
            logger.warning("Error parsing story forces time series: %s", exc)
            return [], [], []

    def parse_joint_displacements_timeseries(self) -> Tuple[List[Any], List[Any], List[str]]:
        try:
            df = self.get_excel_file().parse(
                sheet_name="Joint Displacements",
                skiprows=[0, 2],
            )
            return parse_joint_displacements_df(df, self.parser._new_time_series_data)
        except Exception as exc:
            logger.warning("Error parsing joint displacements time series: %s", exc)
            return [], [], []

    def parse_diaphragm_accelerations_timeseries(self) -> Tuple[List[Any], List[Any], List[str]]:
        try:
            df = self.get_excel_file().parse(
                sheet_name="Diaphragm Accelerations",
                skiprows=[0, 2],
            )
            return parse_diaphragm_accelerations_df(df, self.parser._new_time_series_data)
        except Exception as exc:
            logger.warning("Error parsing diaphragm accelerations time series: %s", exc)
            return [], [], []

    def extract_time_series_by_direction(
        self,
        df,
        direction: str,
        value_col: str,
        step_num_col: str,
        story_order: List[str],
    ) -> List[Any]:
        return extract_time_series_by_direction(
            df,
            direction,
            value_col,
            step_num_col,
            story_order,
            self.parser._new_time_series_data,
        )

    def extract_time_series_direct(
        self,
        df,
        value_col: str,
        direction: str,
        step_num_col: str,
        story_order: List[str],
    ) -> List[Any]:
        return extract_time_series_direct(
            df,
            value_col,
            direction,
            step_num_col,
            story_order,
            self.parser._new_time_series_data,
        )

    def has_time_series_data(self) -> bool:
        return self.detect_time_history_load_case() is not None

    @staticmethod
    def _resolve_step_number_col(df) -> Optional[str]:
        return resolve_step_number_col(df)
