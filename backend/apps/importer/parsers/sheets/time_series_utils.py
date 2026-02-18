"""Utility functions for time-series parsing."""

from __future__ import annotations

from typing import Any, Callable, List, Optional, Tuple

import pandas as pd


def resolve_step_number_col(df: pd.DataFrame) -> Optional[str]:
    """Find step number-like column (e.g., Step Number)."""
    for col in df.columns:
        col_lower = str(col).lower()
        if "step" in col_lower and "type" not in col_lower:
            return col
    return None


def extract_time_series_by_direction(
    df: pd.DataFrame,
    direction: str,
    value_col: str,
    step_num_col: str,
    story_order: List[str],
    series_factory: Callable[..., Any],
) -> List[Any]:
    """Extract story time-series values filtered by direction column."""
    result = []
    df_dir = df[df["Direction"] == direction]

    for idx, story in enumerate(story_order):
        story_df = df_dir[df_dir["Story"] == story].sort_values(step_num_col)
        if story_df.empty:
            continue

        time_steps = story_df[step_num_col].tolist()
        values = story_df[value_col].tolist()
        try:
            time_steps = [float(t) for t in time_steps]
            values = [float(v) if pd.notna(v) else 0.0 for v in values]
        except (ValueError, TypeError):
            continue

        result.append(
            series_factory(
                story=str(story),
                direction=direction,
                time_steps=time_steps,
                values=values,
                story_sort_order=idx,
            )
        )

    return result


def extract_time_series_direct(
    df: pd.DataFrame,
    value_col: str,
    direction: str,
    step_num_col: str,
    story_order: List[str],
    series_factory: Callable[..., Any],
) -> List[Any]:
    """Extract story time-series values from a direct scalar column."""
    result = []
    if value_col not in df.columns:
        return result

    for idx, story in enumerate(story_order):
        story_df = df[df["Story"] == story].sort_values(step_num_col)
        if story_df.empty:
            continue

        time_steps = story_df[step_num_col].tolist()
        values = story_df[value_col].tolist()
        try:
            time_steps = [float(t) for t in time_steps]
            values = [float(v) if pd.notna(v) else 0.0 for v in values]
        except (ValueError, TypeError):
            continue

        result.append(
            series_factory(
                story=str(story),
                direction=direction,
                time_steps=time_steps,
                values=values,
                story_sort_order=idx,
            )
        )

    return result


def parse_story_drifts_df(
    df: pd.DataFrame,
    series_factory: Callable[..., Any],
) -> Tuple[List[Any], List[Any], List[str]]:
    """Parse story drifts from preloaded DataFrame."""
    required_cols = ["Story", "Output Case", "Step Type", "Direction", "Drift"]
    if not all(col in df.columns for col in required_cols):
        return [], [], []

    step_num_col = resolve_step_number_col(df)
    if step_num_col is None:
        return [], [], []

    df = df[df["Step Type"] == "Step By Step"].copy()
    if df.empty:
        return [], [], []

    story_order = df["Story"].dropna().unique().tolist()
    drifts_x = extract_time_series_by_direction(
        df, "X", "Drift", step_num_col, story_order, series_factory
    )
    drifts_y = extract_time_series_by_direction(
        df, "Y", "Drift", step_num_col, story_order, series_factory
    )
    return drifts_x, drifts_y, story_order


def parse_story_forces_df(
    df: pd.DataFrame,
    series_factory: Callable[..., Any],
) -> Tuple[List[Any], List[Any], List[str]]:
    """Parse story forces from preloaded DataFrame."""
    if "Step Type" not in df.columns:
        return [], [], []

    step_num_col = resolve_step_number_col(df)
    if step_num_col is None:
        return [], [], []

    df = df[df["Step Type"] == "Step By Step"].copy()
    if "Location" in df.columns:
        df = df[df["Location"] == "Bottom"]
    if df.empty:
        return [], [], []

    story_order = df["Story"].dropna().unique().tolist()
    forces_x = extract_time_series_direct(df, "VX", "X", step_num_col, story_order, series_factory)
    forces_y = extract_time_series_direct(df, "VY", "Y", step_num_col, story_order, series_factory)
    return forces_x, forces_y, story_order


def parse_joint_displacements_df(
    df: pd.DataFrame,
    series_factory: Callable[..., Any],
) -> Tuple[List[Any], List[Any], List[str]]:
    """Parse joint displacements from preloaded DataFrame."""
    if "Step Type" not in df.columns:
        return [], [], []

    step_num_col = resolve_step_number_col(df)
    if step_num_col is None:
        return [], [], []

    df = df[df["Step Type"] == "Step By Step"].copy()
    if "Label" in df.columns:
        df = df[df["Label"] == 1]
    if df.empty:
        return [], [], []

    story_order = df["Story"].dropna().unique().tolist()
    displ_x = extract_time_series_direct(df, "Ux", "X", step_num_col, story_order, series_factory)
    displ_y = extract_time_series_direct(df, "Uy", "Y", step_num_col, story_order, series_factory)
    return displ_x, displ_y, story_order


def parse_diaphragm_accelerations_df(
    df: pd.DataFrame,
    series_factory: Callable[..., Any],
) -> Tuple[List[Any], List[Any], List[str]]:
    """Parse diaphragm accelerations from preloaded DataFrame."""
    if "Step Type" not in df.columns:
        return [], [], []

    step_num_col = resolve_step_number_col(df)
    if step_num_col is None:
        return [], [], []

    df = df[df["Step Type"] == "Step By Step"].copy()
    if df.empty:
        return [], [], []

    story_order = df["Story"].dropna().unique().tolist()
    ux_col = None
    uy_col = None
    for col in df.columns:
        col_lower = str(col).lower()
        if "ux" in col_lower and ux_col is None:
            ux_col = col
        elif "uy" in col_lower and uy_col is None:
            uy_col = col

    accelerations_x = []
    accelerations_y = []
    if ux_col:
        accelerations_x = extract_time_series_direct(
            df, ux_col, "X", step_num_col, story_order, series_factory
        )
    if uy_col:
        accelerations_y = extract_time_series_direct(
            df, uy_col, "Y", step_num_col, story_order, series_factory
        )

    return accelerations_x, accelerations_y, story_order
