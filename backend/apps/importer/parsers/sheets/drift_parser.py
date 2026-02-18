"""Story drift sheet parser."""

from __future__ import annotations

from typing import List, Tuple

import pandas as pd

from ..base import BaseSheetParser


class DriftSheetParser(BaseSheetParser):
    """Parse story drift results."""

    def get_story_drifts(self) -> Tuple[pd.DataFrame, List[str], List[str]]:
        sheet = "Story Drifts"
        columns = [0, 1, 2, 3, 4, 5]
        df = self.read_sheet(sheet, columns)

        unique_vals = self.get_unique_values(df, ["Output Case", "Story"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        return df, load_cases, stories
