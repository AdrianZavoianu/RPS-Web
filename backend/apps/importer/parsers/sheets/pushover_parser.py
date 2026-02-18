"""Pushover-related sheet parser."""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

import pandas as pd

from .pushover_utils import (
    build_pushover_curve_data,
    extract_pushover_displacements,
    extract_pushover_drifts,
    extract_pushover_forces,
    filter_pushover_cases,
)
from ..base import BaseSheetParser

logger = logging.getLogger(__name__)


class PushoverSheetParser(BaseSheetParser):
    """Parse pushover case metadata, curves, and global result pivots."""

    @staticmethod
    def detect_pushover_direction(case_name: str) -> str:
        case_upper = str(case_name).upper()
        has_x = "X" in case_upper
        has_y = "Y" in case_upper
        if has_x and has_y:
            return "XY"
        if has_x:
            return "X"
        if has_y:
            return "Y"
        return "Unknown"

    def get_pushover_cases(self) -> List[str]:
        sheet = "Story Forces"
        if not self.validate_sheet_exists(sheet):
            return []

        try:
            header_df = self.get_excel_file().parse(
                sheet_name=sheet,
                skiprows=[0, 2],
                nrows=5,
            )
            if "Step Number" not in header_df.columns:
                return []

            df = self.get_excel_file().parse(
                sheet_name=sheet,
                skiprows=[0, 2],
                usecols=["Output Case"],
            )
            cases = df["Output Case"].dropna().unique().tolist()
            return [c for c in cases if "push" in str(c).lower()]
        except Exception as exc:
            logger.warning("Error getting pushover cases: %s", exc)
            return []

    def get_pushover_curve_data(
        self, base_story: Optional[str] = None
    ) -> Tuple[pd.DataFrame, List[str]]:
        displ_sheet = "Joint Displacements"
        force_sheet = "Story Forces"
        if not self.validate_sheet_exists(displ_sheet) or not self.validate_sheet_exists(force_sheet):
            return pd.DataFrame(), []

        try:
            displ_df = self.get_excel_file().parse(sheet_name=displ_sheet, skiprows=[0, 2])
            force_df = self.get_excel_file().parse(sheet_name=force_sheet, skiprows=[0, 2])
            return build_pushover_curve_data(
                displ_df=displ_df,
                force_df=force_df,
                base_story=base_story,
                direction_detector=self.detect_pushover_direction,
            )
        except Exception as exc:
            logger.exception("Error parsing pushover curve data: %s", exc)
            return pd.DataFrame(), []

    def get_pushover_directions(self) -> List[str]:
        sheet = "Story Drifts"
        if not self.validate_sheet_exists(sheet):
            return []

        try:
            df = self.get_excel_file().parse(
                sheet_name=sheet,
                skiprows=[0, 2],
                usecols=["Output Case"],
            )
            output_cases = df["Output Case"].dropna().unique()
            pushover_cases = [c for c in output_cases if "push" in str(c).lower()]
            if not pushover_cases:
                return []

            directions = []
            if any("X" in str(c).upper() and "Y" in str(c).upper() for c in pushover_cases):
                directions.append("XY")
            if any("X" in str(c).upper() for c in pushover_cases):
                directions.append("X")
            if any("Y" in str(c).upper() for c in pushover_cases):
                directions.append("Y")
            return directions
        except Exception as exc:
            logger.warning("Error detecting pushover directions: %s", exc)
            return []

    def get_pushover_global_results(self, direction: str) -> Dict[str, Optional[pd.DataFrame]]:
        results: Dict[str, Optional[pd.DataFrame]] = {
            "drifts": None,
            "displacements": None,
            "forces": None,
        }

        try:
            results["drifts"] = self.extract_pushover_drifts(direction)
        except Exception as exc:
            logger.warning("Failed to extract pushover drifts for %s: %s", direction, exc)

        try:
            results["displacements"] = self.extract_pushover_displacements(direction)
        except Exception as exc:
            logger.warning("Failed to extract pushover displacements for %s: %s", direction, exc)

        try:
            results["forces"] = self.extract_pushover_forces(direction)
        except Exception as exc:
            logger.warning("Failed to extract pushover forces for %s: %s", direction, exc)

        return results

    def filter_pushover_cases(self, df: pd.DataFrame, direction: str) -> pd.DataFrame:
        return filter_pushover_cases(df, direction)

    def extract_pushover_drifts(self, direction: str) -> Optional[pd.DataFrame]:
        sheet = "Story Drifts"
        if not self.validate_sheet_exists(sheet):
            return None

        df = self.get_excel_file().parse(sheet_name=sheet, skiprows=[0, 2])
        return extract_pushover_drifts(df, direction)

    def extract_pushover_displacements(self, direction: str) -> Optional[pd.DataFrame]:
        sheet = "Joint Displacements"
        if not self.validate_sheet_exists(sheet):
            return None

        df = self.get_excel_file().parse(sheet_name=sheet, skiprows=[0, 2])
        return extract_pushover_displacements(df, direction)

    def extract_pushover_forces(self, direction: str) -> Optional[pd.DataFrame]:
        sheet = "Story Forces"
        if not self.validate_sheet_exists(sheet):
            return None

        df = self.get_excel_file().parse(sheet_name=sheet, skiprows=[0, 2])
        return extract_pushover_forces(df, direction)
