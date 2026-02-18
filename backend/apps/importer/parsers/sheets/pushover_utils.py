"""Utility functions for pushover parsing."""

from __future__ import annotations

import math
from typing import Callable, List, Optional, Tuple

import pandas as pd


def filter_pushover_cases(df: pd.DataFrame, direction: str) -> pd.DataFrame:
    """Filter rows to pushover output cases matching the requested direction."""
    output_case_upper = df["Output Case"].astype(str).str.upper()
    pushover_mask = output_case_upper.str.contains("PUSH", na=False)

    if direction == "XY":
        direction_mask = output_case_upper.str.contains("X", na=False) & output_case_upper.str.contains(
            "Y", na=False
        )
    else:
        direction_mask = output_case_upper.str.contains(direction.upper(), na=False)

    return df[pushover_mask & direction_mask].copy()


def build_pushover_curve_data(
    displ_df: pd.DataFrame,
    force_df: pd.DataFrame,
    base_story: Optional[str],
    direction_detector: Callable[[str], str],
) -> Tuple[pd.DataFrame, List[str]]:
    """Build pushover displacement vs base shear curve rows."""
    if "Step Number" not in displ_df.columns or "Step Number" not in force_df.columns:
        return pd.DataFrame(), []

    pushover_cases = [c for c in displ_df["Output Case"].dropna().unique() if "push" in str(c).lower()]
    if not pushover_cases:
        return pd.DataFrame(), []

    if base_story is None:
        stories = force_df["Story"].dropna().unique().tolist()
        if not stories:
            return pd.DataFrame(), []
        base_story = stories[0]

    results = []
    for case_name in pushover_cases:
        direction = direction_detector(case_name)
        if direction == "Unknown":
            continue

        case_displ = displ_df[displ_df["Output Case"] == case_name].copy()
        case_force = force_df[
            (force_df["Output Case"] == case_name)
            & (force_df["Story"] == base_story)
            & (force_df["Location"] == "Bottom")
        ].copy()
        if case_displ.empty or case_force.empty:
            continue

        disp_steps = pd.to_numeric(case_displ["Step Number"], errors="coerce").tolist()
        shear_steps = pd.to_numeric(case_force["Step Number"], errors="coerce").tolist()

        if direction == "XY":
            ux_vals = (
                pd.to_numeric(case_displ["Ux"], errors="coerce").tolist()
                if "Ux" in case_displ.columns
                else [0.0] * len(case_displ)
            )
            uy_vals = (
                pd.to_numeric(case_displ["Uy"], errors="coerce").tolist()
                if "Uy" in case_displ.columns
                else [0.0] * len(case_displ)
            )
            displacements = [
                math.sqrt((ux_val**2) + (uy_val**2))
                for ux_val, uy_val in zip(ux_vals, uy_vals)
            ]
        elif direction == "X":
            displacements = (
                pd.to_numeric(case_displ["Ux"], errors="coerce").tolist()
                if "Ux" in case_displ.columns
                else [0.0] * len(case_displ)
            )
        else:
            displacements = (
                pd.to_numeric(case_displ["Uy"], errors="coerce").tolist()
                if "Uy" in case_displ.columns
                else [0.0] * len(case_displ)
            )

        if direction == "XY":
            vx_vals = (
                pd.to_numeric(case_force["VX"], errors="coerce").abs().tolist()
                if "VX" in case_force.columns
                else [0.0] * len(case_force)
            )
            vy_vals = (
                pd.to_numeric(case_force["VY"], errors="coerce").abs().tolist()
                if "VY" in case_force.columns
                else [0.0] * len(case_force)
            )
            shears = [math.sqrt((vx_val**2) + (vy_val**2)) for vx_val, vy_val in zip(vx_vals, vy_vals)]
        elif direction == "X":
            shears = (
                pd.to_numeric(case_force["VX"], errors="coerce").abs().tolist()
                if "VX" in case_force.columns
                else [0.0] * len(case_force)
            )
        else:
            shears = (
                pd.to_numeric(case_force["VY"], errors="coerce").abs().tolist()
                if "VY" in case_force.columns
                else [0.0] * len(case_force)
            )

        point_count = min(len(disp_steps), len(displacements), len(shear_steps), len(shears))
        for idx in range(point_count):
            disp_step = disp_steps[idx]
            shear_step = shear_steps[idx]
            displacement = displacements[idx]
            base_shear = shears[idx]

            if (
                pd.isna(disp_step)
                or pd.isna(shear_step)
                or pd.isna(displacement)
                or pd.isna(base_shear)
            ):
                continue

            disp_step_int = int(disp_step)
            shear_step_int = int(shear_step)
            if disp_step_int != shear_step_int:
                continue

            results.append(
                {
                    "Case": case_name,
                    "Step": disp_step_int,
                    "Displacement": float(displacement),
                    "BaseShear": float(base_shear),
                    "Direction": direction,
                }
            )

    if not results:
        return pd.DataFrame(), []

    result_df = pd.DataFrame(results).sort_values(["Case", "Step"]).reset_index(drop=True)
    for case_name in result_df["Case"].unique():
        case_mask = result_df["Case"] == case_name
        case_rows = result_df.loc[case_mask]
        if case_rows.empty:
            continue

        step_zero_rows = case_rows[case_rows["Step"] == 0]
        reference_displacement = (
            step_zero_rows["Displacement"].iloc[0]
            if not step_zero_rows.empty
            else case_rows["Displacement"].iloc[0]
        )
        result_df.loc[case_mask, "Displacement"] = (
            result_df.loc[case_mask, "Displacement"] - reference_displacement
        )

    return result_df, pushover_cases


def extract_pushover_drifts(df: pd.DataFrame, direction: str) -> Optional[pd.DataFrame]:
    """Extract max story drift per story/case for pushover."""
    df = df[["Story", "Output Case", "Step Type", "Direction", "Drift"]]
    df = filter_pushover_cases(df, direction)
    if df.empty:
        return None

    if direction == "XY":
        df_x = df[df["Direction"] == "X"].rename(columns={"Drift": "Drift_X"})
        df_y = df[df["Direction"] == "Y"].rename(columns={"Drift": "Drift_Y"})
        merged = pd.merge(
            df_x[["Story", "Output Case", "Step Type", "Drift_X"]],
            df_y[["Story", "Output Case", "Step Type", "Drift_Y"]],
            on=["Story", "Output Case", "Step Type"],
            how="inner",
        )
        merged["Drift"] = (merged["Drift_X"] ** 2 + merged["Drift_Y"] ** 2) ** 0.5
        df = merged[["Story", "Output Case", "Step Type", "Drift"]]
    else:
        df = df[df["Direction"] == direction]

    story_order = df["Story"].unique().tolist()
    pivoted = (
        df.groupby(["Story", "Output Case"], sort=False)["Drift"]
        .max()
        .unstack()
        .reset_index()
    )
    pivoted["Story"] = pd.Categorical(pivoted["Story"], categories=story_order, ordered=True)
    pivoted = pivoted.sort_values("Story").reset_index(drop=True)
    pivoted.columns.name = None
    return pivoted


def extract_pushover_displacements(df: pd.DataFrame, direction: str) -> Optional[pd.DataFrame]:
    """Extract max absolute displacement per story/case for pushover."""
    df = filter_pushover_cases(df, direction)
    if df.empty:
        return None

    if direction == "XY":
        df = df[["Story", "Output Case", "Step Type", "Ux", "Uy"]].copy()
        df["Disp"] = (df["Ux"] ** 2 + df["Uy"] ** 2) ** 0.5
        col = "Disp"
    else:
        col = "Ux" if direction == "X" else "Uy"
        df = df[["Story", "Output Case", "Step Type", col]].copy()

    story_order = df["Story"].unique().tolist()
    abs_col = "__abs_disp__"
    df[abs_col] = df[col].abs()
    pivoted = (
        df.groupby(["Story", "Output Case"], sort=False)[abs_col]
        .max()
        .unstack()
        .reset_index()
    )
    pivoted["Story"] = pd.Categorical(pivoted["Story"], categories=story_order, ordered=True)
    pivoted = pivoted.sort_values("Story").reset_index(drop=True)
    pivoted.columns.name = None
    return pivoted


def extract_pushover_forces(df: pd.DataFrame, direction: str) -> Optional[pd.DataFrame]:
    """Extract max absolute story shear per story/case for pushover."""
    df = df[~df["Location"].str.contains("Top", na=False)]
    df = filter_pushover_cases(df, direction)
    if df.empty:
        return None

    if direction == "XY":
        df = df[["Story", "Output Case", "Step Type", "Location", "VX", "VY"]].copy()
        df["Shear"] = (df["VX"] ** 2 + df["VY"] ** 2) ** 0.5
        col = "Shear"
    else:
        col = "VX" if direction == "X" else "VY"
        df = df[["Story", "Output Case", "Step Type", "Location", col]].copy()

    story_order = df["Story"].unique().tolist()
    abs_col = "__abs_shear__"
    df[abs_col] = df[col].abs()
    pivoted = (
        df.groupby(["Story", "Output Case"], sort=False)[abs_col]
        .max()
        .unstack()
        .reset_index()
    )
    pivoted["Story"] = pd.Categorical(pivoted["Story"], categories=story_order, ordered=True)
    pivoted = pivoted.sort_values("Story").reset_index(drop=True)
    pivoted.columns.name = None
    return pivoted
