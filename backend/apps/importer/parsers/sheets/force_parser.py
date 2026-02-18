"""Story force sheet parser."""

from __future__ import annotations

from typing import List, Tuple

import pandas as pd

from ..base import BaseSheetParser


class ForceSheetParser(BaseSheetParser):
    """Parse story force results."""

    def get_story_forces(self) -> Tuple[pd.DataFrame, List[str], List[str]]:
        sheet = "Story Forces"
        columns = [0, 1, 3, 4, 6, 7]
        df = self.read_sheet(sheet, columns)

        unique_vals = self.get_unique_values(df, ["Output Case", "Story"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        return df, load_cases, stories
