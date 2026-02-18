"""Element-focused sheet parser."""

from __future__ import annotations

from typing import List, Tuple

import pandas as pd

from ..base import BaseSheetParser


class ElementSheetParser(BaseSheetParser):
    """Parse pier/column/wall/hinge element result sheets."""

    def get_pier_forces(self) -> Tuple[pd.DataFrame, List[str], List[str], List[str]]:
        sheet = "Pier Forces"
        columns = [0, 1, 2, 4, 5, 7, 8]
        df = self.read_sheet(sheet, columns)

        unique_vals = self.get_unique_values(df, ["Output Case", "Story", "Pier"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        piers = unique_vals["Pier"]
        return df, load_cases, stories, piers

    def get_column_forces(self) -> Tuple[pd.DataFrame, List[str], List[str], List[str]]:
        sheet = "Element Forces - Columns"
        columns = [0, 1, 2, 3, 6, 7, 8, 9]

        if self.parser._column_forces_df is None:
            self.parser._column_forces_df = self.read_sheet(sheet, columns)
        df = self.parser._column_forces_df.copy()

        unique_vals = self.get_unique_values(df, ["Output Case", "Story", "Column"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        columns_list = unique_vals["Column"]
        return df, load_cases, stories, columns_list

    def get_quad_rotations(self) -> Tuple[pd.DataFrame, List[str], List[str], List[str]]:
        sheet = "Quad Strain Gauge - Rotation"
        columns = [0, 1, 2, 3, 5, 6, 7, 8, 9]
        df = self.read_sheet(sheet, columns)

        unique_vals = self.get_unique_values(df, ["Output Case", "Story", "PropertyName"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        piers = unique_vals["PropertyName"]
        return df, load_cases, stories, piers

    def get_fiber_hinge_states(self) -> Tuple[pd.DataFrame, List[str], List[str], List[str]]:
        sheet = "Fiber Hinge States"
        columns = [0, 1, 2, 3, 5, 20, 21]
        df = self.read_sheet(sheet, columns)

        if "Frame/Wall" in df.columns:
            df = df[df["Frame/Wall"].astype(str).str.startswith("C", na=False)].copy()

        unique_vals = self.get_unique_values(df, ["Output Case", "Story", "Frame/Wall"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        columns_list = unique_vals["Frame/Wall"]
        return df, load_cases, stories, columns_list

    def get_hinge_states(self) -> Tuple[pd.DataFrame, List[str], List[str], List[str]]:
        sheet = "Hinge States"
        columns = [0, 1, 2, 3, 5, 6, 7, 8, 21]
        df = self.read_sheet(sheet, columns)

        if "Frame/Wall" in df.columns:
            df = df[df["Frame/Wall"].astype(str).str.startswith("B", na=False)].copy()

        unique_vals = self.get_unique_values(df, ["Output Case", "Story", "Frame/Wall"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        beams_list = unique_vals["Frame/Wall"]
        return df, load_cases, stories, beams_list
