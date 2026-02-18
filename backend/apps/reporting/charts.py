"""SVG chart generation helpers for PDF reports."""

from __future__ import annotations

from typing import Any, Dict, List

from config.result_types import get_plot_color

PLOT_AREA_FILL = "#eef2f6"


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

    width = 500
    height = 300
    margin = {"top": 20, "right": 20, "bottom": 40, "left": 60}
    plot_width = width - margin["left"] - margin["right"]
    plot_height = height - margin["top"] - margin["bottom"]

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

    svg_parts = [
        f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">',
        f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
        f'<rect x="{margin["left"]}" y="{margin["top"]}" '
        f'width="{plot_width}" height="{plot_height}" fill="{PLOT_AREA_FILL}" stroke="#d1d5db"/>',
    ]

    for i in range(n_stories):
        y = margin["top"] + plot_height - (i + 0.5) / n_stories * plot_height
        svg_parts.append(
            f'<line x1="{margin["left"]}" y1="{y}" '
            f'x2="{margin["left"] + plot_width}" y2="{y}" '
            f'stroke="#e5e7eb" stroke-dasharray="2,2"/>'
        )

    for col_idx, col in enumerate(load_case_columns[:12]):
        color = get_plot_color(col_idx)
        points = []
        for i, row in enumerate(rows):
            val = row.get(col)
            if val is None or not isinstance(val, (int, float)):
                continue
            x = margin["left"] + (float(val) - min_val) / (max_val - min_val) * plot_width
            y = margin["top"] + plot_height - (i + 0.5) / n_stories * plot_height
            points.append(f"{x},{y}")

        if points:
            svg_parts.append(
                f'<polyline points="{" ".join(points)}" '
                f'fill="none" stroke="{color}" stroke-width="1.5"/>'
            )

    if not is_pushover:
        avg_points = []
        for i, row in enumerate(rows):
            avg_val = row.get("Avg")
            if avg_val is not None and isinstance(avg_val, (int, float)):
                x = margin["left"] + (float(avg_val) - min_val) / (max_val - min_val) * plot_width
                y = margin["top"] + plot_height - (i + 0.5) / n_stories * plot_height
                avg_points.append(f"{x},{y}")

        if avg_points:
            svg_parts.append(
                f'<polyline points="{" ".join(avg_points)}" '
                f'fill="none" stroke="#c2410c" stroke-width="2" stroke-dasharray="4,2"/>'
            )

    for i, story in enumerate(stories):
        y = margin["top"] + plot_height - (i + 0.5) / n_stories * plot_height + 4
        svg_parts.append(
            f'<text x="{margin["left"] - 5}" y="{y}" '
            f'fill="#374151" font-size="10" text-anchor="end">{story}</text>'
        )

    n_ticks = 5
    for i in range(n_ticks + 1):
        val = min_val + (max_val - min_val) * i / n_ticks
        x = margin["left"] + i / n_ticks * plot_width
        svg_parts.append(
            f'<text x="{x}" y="{height - margin["bottom"] + 15}" '
            f'fill="#374151" font-size="10" text-anchor="middle">{val:.2f}</text>'
        )

    svg_parts.append(
        f'<text x="{margin["left"] + plot_width / 2}" y="{height - 5}" '
        f'fill="#1f2937" font-size="11" text-anchor="middle">'
        f"{result_type} ({unit})</text>"
    )

    svg_parts.append(
        f'<text x="15" y="{margin["top"] + plot_height / 2}" '
        f'fill="#1f2937" font-size="11" text-anchor="middle" '
        f'transform="rotate(-90, 15, {margin["top"] + plot_height / 2})">Story</text>'
    )

    svg_parts.append("</svg>")
    return "\n".join(svg_parts)


def generate_scatter_svg(report: Dict[str, Any], result_type: str) -> str:
    max_points = report.get("plot_data_max", [])
    min_points = report.get("plot_data_min", [])
    stories = report.get("stories", [])
    unit = report.get("unit", "%")

    all_points = max_points + min_points
    if not all_points or not stories:
        return ""

    width = 500
    height = 300
    margin = {"top": 20, "right": 20, "bottom": 40, "left": 80}
    plot_width = width - margin["left"] - margin["right"]
    plot_height = height - margin["top"] - margin["bottom"]

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

    n_stories = len(stories)
    story_index = {name: idx for idx, name in enumerate(stories)}

    svg_parts = [
        f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">',
        f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
        f'<rect x="{margin["left"]}" y="{margin["top"]}" '
        f'width="{plot_width}" height="{plot_height}" fill="{PLOT_AREA_FILL}" stroke="#d1d5db"/>',
    ]

    for i in range(n_stories):
        y = margin["top"] + plot_height - (i + 0.5) / n_stories * plot_height
        svg_parts.append(
            f'<line x1="{margin["left"]}" y1="{y}" '
            f'x2="{margin["left"] + plot_width}" y2="{y}" '
            f'stroke="#e5e7eb" stroke-dasharray="2,2"/>'
        )

    if min_val < 0 < max_val:
        zero_x = margin["left"] + (0 - min_val) / val_range * plot_width
        svg_parts.append(
            f'<line x1="{zero_x}" y1="{margin["top"]}" '
            f'x2="{zero_x}" y2="{margin["top"] + plot_height}" '
            f'stroke="#9ca3af" stroke-dasharray="4,2" stroke-width="1"/>'
        )

    import random

    jitter_seed = 42
    for pt_list, color in [(max_points, "#2563eb"), (min_points, "#dc2626")]:
        random.seed(jitter_seed)
        for p in pt_list:
            si = story_index.get(p.get("story"), p.get("story_index", 0))
            base_y = margin["top"] + plot_height - (si + 0.5) / n_stories * plot_height
            jitter = (random.random() - 0.5) * (plot_height / n_stories * 0.6)
            y = base_y + jitter
            x = margin["left"] + (p["rotation"] - min_val) / val_range * plot_width
            svg_parts.append(
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2" fill="{color}" opacity="0.6"/>'
            )

    for i, story in enumerate(stories):
        y = margin["top"] + plot_height - (i + 0.5) / n_stories * plot_height + 4
        display = story[:12] if len(story) > 12 else story
        svg_parts.append(
            f'<text x="{margin["left"] - 5}" y="{y}" '
            f'fill="#374151" font-size="9" text-anchor="end">{display}</text>'
        )

    n_ticks = 5
    for i in range(n_ticks + 1):
        val = min_val + val_range * i / n_ticks
        x = margin["left"] + i / n_ticks * plot_width
        svg_parts.append(
            f'<text x="{x}" y="{height - margin["bottom"] + 15}" '
            f'fill="#374151" font-size="10" text-anchor="middle">{val:.3f}</text>'
        )

    label = result_type.replace("Rotations", " Rotation")
    svg_parts.append(
        f'<text x="{margin["left"] + plot_width / 2}" y="{height - 5}" '
        f'fill="#1f2937" font-size="11" text-anchor="middle">{label} ({unit})</text>'
    )

    svg_parts.append(
        f'<text x="12" y="{margin["top"] + plot_height / 2}" '
        f'fill="#1f2937" font-size="11" text-anchor="middle" '
        f'transform="rotate(-90, 12, {margin["top"] + plot_height / 2})">Story</text>'
    )

    svg_parts.append("</svg>")
    return "\n".join(svg_parts)


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

    width = 500
    height = 300
    margin = {"top": 20, "right": 20, "bottom": 56, "left": 56}
    plot_width = width - margin["left"] - margin["right"]
    plot_height = height - margin["top"] - margin["bottom"]

    num_load_cases = len(load_cases)
    slot_width = plot_width / num_load_cases

    all_values = [value for _, value in plot_data]
    y_min = 0.0
    y_max = max(all_values) * 1.1
    if y_max <= y_min:
        y_max = y_min + 1.0
    y_range = y_max - y_min

    def to_px_x(lc_idx: int) -> float:
        return margin["left"] + (lc_idx + 0.5) * slot_width

    def to_px_y(value: float) -> float:
        return margin["top"] + plot_height - (value - y_min) / y_range * plot_height

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

    svg_parts = [
        f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">',
        f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
        f'<rect x="{margin["left"]}" y="{margin["top"]}" '
        f'width="{plot_width}" height="{plot_height}" fill="{PLOT_AREA_FILL}" stroke="#d1d5db"/>',
    ]

    for tick in y_ticks:
        y = to_px_y(tick)
        svg_parts.append(
            f'<line x1="{margin["left"]}" y1="{y}" '
            f'x2="{margin["left"] + plot_width}" y2="{y}" '
            f'stroke="#e5e7eb" stroke-dasharray="2,2"/>'
        )

    for i in range(num_load_cases + 1):
        x = margin["left"] + i * slot_width
        svg_parts.append(
            f'<line x1="{x}" y1="{margin["top"]}" '
            f'x2="{x}" y2="{margin["top"] + plot_height}" '
            f'stroke="#e5e7eb" stroke-dasharray="2,2"/>'
        )

    import random

    rng = random.Random(46)
    for lc_idx, value in plot_data:
        jitter = (rng.random() - 0.5) * slot_width * 0.7
        x = to_px_x(lc_idx) + jitter
        y = to_px_y(value)
        svg_parts.append(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.5" fill="#2563eb" opacity="0.6"/>'
        )

    for tick in y_ticks:
        y = to_px_y(tick) + 3
        label = f"{tick:.1f}" if abs(tick) < 10 else f"{tick:.0f}"
        svg_parts.append(
            f'<text x="{margin["left"] - 5}" y="{y}" '
            f'fill="#374151" font-size="8" text-anchor="end">{label}</text>'
        )

    for i, load_case in enumerate(load_cases):
        x = to_px_x(i)
        label = str(load_case)[:5]
        svg_parts.append(
            f'<text x="{x}" y="{height - margin["bottom"] + 13}" '
            f'fill="#374151" font-size="8" text-anchor="middle">{label}</text>'
        )

    svg_parts.append(
        f'<text x="{margin["left"] + plot_width / 2}" y="{height - 5}" '
        f'fill="#1f2937" font-size="11" text-anchor="middle">Load Case</text>'
    )

    svg_parts.append(
        f'<text x="14" y="{margin["top"] + plot_height / 2}" '
        f'fill="#1f2937" font-size="11" text-anchor="middle" '
        f'transform="rotate(-90, 14, {margin["top"] + plot_height / 2})">{value_axis_label} ({unit})</text>'
    )

    svg_parts.append("</svg>")
    return "\n".join(svg_parts)
