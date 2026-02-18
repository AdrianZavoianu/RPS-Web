"""Joint displacement-related sheet parser."""

from __future__ import annotations

from typing import List, Optional, Tuple

import pandas as pd

from ..base import BaseSheetParser


class DisplacementSheetParser(BaseSheetParser):
    """Parse global and foundation displacement results."""

    def get_joint_displacements(self) -> Tuple[pd.DataFrame, List[str], List[str]]:
        sheet = "Joint Displacements"
        if not self.validate_sheet_exists(sheet):
            return pd.DataFrame(), [], []

        df_full = self.load_joint_displacements_full()
        df = df_full[["Story", "Output Case", "Step Type", "Ux", "Uy"]].dropna(
            subset=["Story", "Output Case"]
        )

        load_cases = df["Output Case"].unique().tolist()
        stories = df["Story"].unique().tolist()
        return df, load_cases, stories

    def get_foundation_joints(self) -> List[str]:
        sheet = "Fou"
        if not self.validate_sheet_exists(sheet):
            return []

        df = self.read_sheet(sheet, columns=[0])
        if "Unique Name" in df.columns:
            return df["Unique Name"].dropna().astype(str).unique().tolist()
        return df.iloc[:, 0].dropna().astype(str).unique().tolist()

    def get_vertical_displacements(
        self, foundation_joints: Optional[List[str]] = None
    ) -> Tuple[pd.DataFrame, List[str], List[str]]:
        if foundation_joints is None:
            foundation_joints = self.get_foundation_joints()
        if not foundation_joints:
            return pd.DataFrame(), [], []

        df = self.load_joint_displacements_full()
        df["Unique Name"] = df["Unique Name"].astype(str)
        df = df[df["Unique Name"].isin(foundation_joints)].copy()
        if df.empty:
            return pd.DataFrame(), [], []

        df["Uz"] = pd.to_numeric(df["Uz"], errors="coerce")
        step_type_series = df["Step Type"].astype(str).str.strip().str.casefold()
        min_only = df[step_type_series == "min"].copy()
        if not min_only.empty:
            df = min_only

        grp = df.groupby(["Unique Name", "Output Case"], as_index=False).agg(
            {
                "Uz": "min",
                "Story": "first",
                "Label": "first",
            }
        )
        grp = grp.rename(columns={"Uz": "Min Uz"})
        load_cases = grp["Output Case"].unique().tolist()
        unique_joints = grp["Unique Name"].unique().tolist()
        return grp, load_cases, unique_joints
