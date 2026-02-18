"""Foundation/joint sheet parser."""

from __future__ import annotations

from typing import List, Tuple

import pandas as pd

from ..base import BaseSheetParser


class JointSheetParser(BaseSheetParser):
    """Parse soil pressure joint/foundation results."""

    def get_soil_pressures(self) -> Tuple[pd.DataFrame, List[str], List[str]]:
        sheet = "Soil Pressures"
        columns = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        df = self.read_sheet(sheet, columns)

        df.columns = [
            "Story",
            "Shell Object",
            "Unique Name",
            "Shell Element",
            "Joint",
            "Output Case",
            "Case Type",
            "Step Type",
            "Soil Pressure",
            "Global X",
            "Global Y",
            "Global Z",
        ]

        df["Soil Pressure"] = pd.to_numeric(df["Soil Pressure"], errors="coerce")
        step_type_series = df["Step Type"].astype(str).str.strip().str.casefold()
        min_only = df[step_type_series == "min"].copy()
        if not min_only.empty:
            df = min_only

        grp = df.groupby(["Shell Object", "Unique Name", "Output Case"], as_index=False)[
            "Soil Pressure"
        ].min()

        load_cases = grp["Output Case"].unique().tolist()
        unique_elements = grp["Unique Name"].unique().tolist()
        return grp, load_cases, unique_elements
