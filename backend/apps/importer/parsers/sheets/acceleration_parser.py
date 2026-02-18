"""Diaphragm acceleration sheet parser."""

from __future__ import annotations

from typing import List, Tuple

import pandas as pd

from ..base import BaseSheetParser


class AccelerationSheetParser(BaseSheetParser):
    """Parse story acceleration results."""

    def get_story_accelerations(self) -> Tuple[pd.DataFrame, List[str], List[str]]:
        sheet = "Diaphragm Accelerations"
        columns = [0, 2, 4, 5, 6, 11, 12]
        df = self.read_sheet(sheet, columns)

        unique_vals = self.get_unique_values(df, ["Output Case", "Story"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        return df, load_cases, stories
