"""SVG chart generation helpers for PDF reports."""

from __future__ import annotations

from typing import Any, Dict, List

from config.result_types import get_plot_color

from .chart_primitives import PLOT_AREA_FILL, SvgCanvas  # noqa: F401


def generate_profile_svg(
    dataset: Dict[str, Any],
    result_type: str,
    direction: str,
    is_pushover: bool,
) -> str:
    rows = dataset.get("rows", [])
    load_case_columns = dataset.get("load_case_columns", [])
    story_column = dataset.get("story_column", "Story")
    unit = dataset.get("meta", {}).get("unit", "")

    if not rows or not load_case_columns:
        return ""

    stories = [row.get(story_column, "") for row in rows]
    n_stories = len(stories)

    all_values = []
    for row in rows:
        for col in load_case_columns[:12]:
            val = row.get(col)
            if val is not None and isinstance(val, (int, float)):
                all_values.append(float(val))

    if not all_values:
        return ""

    min_val = min(all_values)
    max_val = max(all_values)
    if min_val == max_val:
        min_val -= 1
        max_val += 1

    c = SvgCanvas()
    c.draw_horizontal_grid(n_stories)

    for col_idx, col in enumerate(load_case_columns[:12]):
        color = get_plot_color(col_idx)
        points = []
        for i, row in enumerate(rows):
            val = row.get(col)
            if val is None or not isinstance(val, (int, float)):
                continue
            x = c.value_x(float(val), min_val, max_val)
            y = c.story_y(i, n_stories)
            points.append(f"{x},{y}")

        if points:
            c.add(
                f'<polyline points="{" ".join(points)}" '
                f'fill="none" stroke="{color}" stroke-width="1.5"/>'
            )

    if not is_pushover:
        avg_points = []
        for i, row in enumerate(rows):
            avg_val = row.get("Avg")
            if avg_val is not None and isinstance(avg_val, (int, float)):
                x = c.value_x(float(avg_val), min_val, max_val)
                y = c.story_y(i, n_stories)
                avg_points.append(f"{x},{y}")

        if avg_points:
            c.add(
                f'<polyline points="{" ".join(avg_points)}" '
                f'fill="none" stroke="#c2410c" stroke-width="2" stroke-dasharray="4,2"/>'
            )

    c.draw_story_labels(stories)
    c.draw_x_ticks(min_val, max_val)
    c.draw_x_axis_label(f"{result_type} ({unit})")
    c.draw_y_axis_label("Story")

    return c.render()


def generate_scatter_svg(report: Dict[str, Any], result_type: str) -> str:
    max_points = report.get("plot_data_max", [])
    min_points = report.get("plot_data_min", [])
    stories = report.get("stories", [])
    unit = report.get("unit", "%")

    all_points = max_points + min_points
    if not all_points or not stories:
        return ""

    n_stories = len(stories)
    story_index = {name: idx for idx, name in enumerate(stories)}

    all_values = [p["rotation"] for p in all_points]
    min_val = min(all_values)
    max_val = max(all_values)
    val_range = max_val - min_val
    if val_range == 0:
        val_range = 1
        min_val -= 0.5
        max_val += 0.5

    padding = val_range * 0.05
    min_val -= padding
    max_val += padding
    val_range = max_val - min_val

    c = SvgCanvas(margin={"top": 20, "right": 20, "bottom": 40, "left": 80})
    c.draw_horizontal_grid(n_stories)
    c.draw_zero_line(min_val, max_val)

    import random

    jitter_seed = 42
    for pt_list, color in [(max_points, "#2563eb"), (min_points, "#dc2626")]:
        random.seed(jitter_seed)
        for p in pt_list:
            si = story_index.get(p.get("story"), p.get("story_index", 0))
            base_y = c.story_y(si, n_stories)
            jitter = (random.random() - 0.5) * (c.plot_height / n_stories * 0.6)
            y = base_y + jitter
            x = c.value_x(p["rotation"], min_val, max_val)
            c.add(
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2" fill="{color}" opacity="0.6"/>'
            )

    c.draw_story_labels(stories, font_size=9, max_chars=12)
    c.draw_x_ticks(min_val, max_val, fmt=".3f")

    label = result_type.replace("Rotations", " Rotation")
    c.draw_x_axis_label(f"{label} ({unit})")
    c.draw_y_axis_label("Story", x_offset=12)

    return c.render()


def generate_joint_scatter_svg(report: Dict[str, Any], result_type: str) -> str:
    plot_data_raw = report.get("plot_data", [])
    load_cases = report.get("load_cases", [])
    unit = report.get("unit", "kPa")
    if result_type == "VerticalDisplacements":
        value_axis_label = "Vertical Displacement"
    elif result_type == "SoilPressures":
        value_axis_label = "Soil Pressure"
    else:
        value_axis_label = result_type

    if not plot_data_raw or not load_cases:
        return ""

    plot_data: List[tuple[int, float]] = []
    for point in plot_data_raw:
        lc_idx = None
        value = None

        if isinstance(point, dict):
            lc_idx = point.get("load_case_idx")
            value = point.get("value")
        elif isinstance(point, (list, tuple)) and len(point) >= 2:
            lc_idx = point[0]
            value = point[1]

        if not isinstance(value, (int, float)):
            continue

        try:
            lc_idx_int = int(lc_idx)
        except (TypeError, ValueError):
            continue

        if lc_idx_int < 0 or lc_idx_int >= len(load_cases):
            continue

        plot_data.append((lc_idx_int, abs(float(value))))

    if not plot_data:
        return ""

    c = SvgCanvas(margin={"top": 20, "right": 20, "bottom": 56, "left": 56})

    num_load_cases = len(load_cases)
    slot_width = c.plot_width / num_load_cases

    all_values = [value for _, value in plot_data]
    y_min = 0.0
    y_max = max(all_values) * 1.1
    if y_max <= y_min:
        y_max = y_min + 1.0
    y_range = y_max - y_min

    def to_px_x(lc_idx: int) -> float:
        return c.margin["left"] + (lc_idx + 0.5) * slot_width

    def to_px_y(value: float) -> float:
        return c.margin["top"] + c.plot_height - (value - y_min) / y_range * c.plot_height

    def nice_ticks(data_min: float, data_max: float, num_ticks: int = 5) -> List[float]:
        import math

        data_range = data_max - data_min
        if data_range <= 0:
            return [data_min]

        rough_step = data_range / num_ticks
        magnitude = 10 ** math.floor(math.log10(rough_step))
        residual = rough_step / magnitude
        if residual > 5:
            nice_step = 10 * magnitude
        elif residual > 2:
            nice_step = 5 * magnitude
        elif residual > 1:
            nice_step = 2 * magnitude
        else:
            nice_step = magnitude

        start = math.ceil(data_min / nice_step) * nice_step
        ticks = []
        tick = start
        while tick <= data_max + 1e-9:
            ticks.append(tick)
            tick += nice_step

        return ticks

    y_ticks = nice_ticks(y_min, y_max, 5)

    # Grid lines at tick positions and slot boundaries
    c.draw_horizontal_grid_at([to_px_y(tick) for tick in y_ticks])
    c.draw_vertical_grid_at(
        [c.margin["left"] + i * slot_width for i in range(num_load_cases + 1)]
    )

    # Scatter points
    import random

    rng = random.Random(46)
    for lc_idx, value in plot_data:
        jitter = (rng.random() - 0.5) * slot_width * 0.7
        x = to_px_x(lc_idx) + jitter
        y = to_px_y(value)
        c.add(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.5" fill="#2563eb" opacity="0.6"/>'
        )

    # Y-axis tick labels
    for tick in y_ticks:
        y = to_px_y(tick) + 3
        label = f"{tick:.1f}" if abs(tick) < 10 else f"{tick:.0f}"
        c.add(
            f'<text x="{c.margin["left"] - 5}" y="{y}" '
            f'fill="#374151" font-size="8" text-anchor="end">{label}</text>'
        )

    # X-axis load case labels
    for i, load_case in enumerate(load_cases):
        x = to_px_x(i)
        label = str(load_case)[:5]
        c.add(
            f'<text x="{x}" y="{c.height - c.margin["bottom"] + 13}" '
            f'fill="#374151" font-size="8" text-anchor="middle">{label}</text>'
        )

    c.draw_x_axis_label("Load Case")
    c.draw_y_axis_label(f"{value_axis_label} ({unit})", x_offset=14)

    return c.render()
