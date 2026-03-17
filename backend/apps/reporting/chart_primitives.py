"""Shared SVG primitives for PDF report charts."""

from __future__ import annotations

PLOT_AREA_FILL = "#eef2f6"


class SvgCanvas:
    """Lightweight SVG builder handling margins, viewbox, and common elements."""

    def __init__(self, width: int = 500, height: int = 300, margin: dict | None = None):
        self.width = width
        self.height = height
        m = margin or {"top": 20, "right": 20, "bottom": 40, "left": 60}
        self.margin = m
        self.plot_width = width - m["left"] - m["right"]
        self.plot_height = height - m["top"] - m["bottom"]
        self.parts: list[str] = []

        # SVG open + background + plot area
        self.parts.append(
            f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">'
        )
        self.parts.append(f'<rect width="{width}" height="{height}" fill="#ffffff"/>')
        self.parts.append(
            f'<rect x="{m["left"]}" y="{m["top"]}" '
            f'width="{self.plot_width}" height="{self.plot_height}" '
            f'fill="{PLOT_AREA_FILL}" stroke="#d1d5db"/>'
        )

    def add(self, svg_fragment: str):
        self.parts.append(svg_fragment)

    def story_y(self, story_index: int, n_stories: int) -> float:
        """Y pixel for a story index (0-based from bottom)."""
        return (
            self.margin["top"]
            + self.plot_height
            - (story_index + 0.5) / n_stories * self.plot_height
        )

    def value_x(self, value: float, min_val: float, max_val: float) -> float:
        """X pixel for a data value within [min_val, max_val]."""
        return (
            self.margin["left"]
            + (value - min_val) / (max_val - min_val) * self.plot_width
        )

    def draw_horizontal_grid(self, n_stories: int):
        """Draw dashed horizontal grid lines for each story."""
        for i in range(n_stories):
            y = self.story_y(i, n_stories)
            self.parts.append(
                f'<line x1="{self.margin["left"]}" y1="{y}" '
                f'x2="{self.margin["left"] + self.plot_width}" y2="{y}" '
                f'stroke="#e5e7eb" stroke-dasharray="2,2"/>'
            )

    def draw_horizontal_grid_at(self, y_values: list[float]):
        """Draw dashed horizontal grid lines at specific Y pixel positions."""
        for y in y_values:
            self.parts.append(
                f'<line x1="{self.margin["left"]}" y1="{y}" '
                f'x2="{self.margin["left"] + self.plot_width}" y2="{y}" '
                f'stroke="#e5e7eb" stroke-dasharray="2,2"/>'
            )

    def draw_vertical_grid_at(self, x_values: list[float]):
        """Draw dashed vertical grid lines at specific X pixel positions."""
        for x in x_values:
            self.parts.append(
                f'<line x1="{x}" y1="{self.margin["top"]}" '
                f'x2="{x}" y2="{self.margin["top"] + self.plot_height}" '
                f'stroke="#e5e7eb" stroke-dasharray="2,2"/>'
            )

    def draw_story_labels(
        self, stories: list[str], font_size: int = 10, max_chars: int | None = None
    ):
        """Draw story labels along the Y axis."""
        n = len(stories)
        for i, story in enumerate(stories):
            y = self.story_y(i, n) + 4  # text baseline offset
            display = story[:max_chars] if max_chars and len(story) > max_chars else story
            self.parts.append(
                f'<text x="{self.margin["left"] - 5}" y="{y}" '
                f'fill="#374151" font-size="{font_size}" text-anchor="end">{display}</text>'
            )

    def draw_x_ticks(
        self, min_val: float, max_val: float, n_ticks: int = 5, fmt: str = ".2f"
    ):
        """Draw tick labels along the X axis."""
        for i in range(n_ticks + 1):
            val = min_val + (max_val - min_val) * i / n_ticks
            x = self.margin["left"] + i / n_ticks * self.plot_width
            self.parts.append(
                f'<text x="{x}" y="{self.height - self.margin["bottom"] + 15}" '
                f'fill="#374151" font-size="10" text-anchor="middle">{val:{fmt}}</text>'
            )

    def draw_x_axis_label(self, label: str):
        """Draw centered label below the X axis."""
        x = self.margin["left"] + self.plot_width / 2
        self.parts.append(
            f'<text x="{x}" y="{self.height - 5}" '
            f'fill="#1f2937" font-size="11" text-anchor="middle">{label}</text>'
        )

    def draw_y_axis_label(self, label: str, x_offset: int = 15):
        """Draw rotated label along the Y axis."""
        y = self.margin["top"] + self.plot_height / 2
        self.parts.append(
            f'<text x="{x_offset}" y="{y}" '
            f'fill="#1f2937" font-size="11" text-anchor="middle" '
            f'transform="rotate(-90, {x_offset}, {y})">{label}</text>'
        )

    def draw_zero_line(
        self, min_val: float, max_val: float, *, stroke: str = "#9ca3af", dash: str = "4,2"
    ):
        """Draw a vertical dashed zero line if 0 is within the value range."""
        if min_val < 0 < max_val:
            x = self.value_x(0, min_val, max_val)
            self.parts.append(
                f'<line x1="{x}" y1="{self.margin["top"]}" '
                f'x2="{x}" y2="{self.margin["top"] + self.plot_height}" '
                f'stroke="{stroke}" stroke-dasharray="{dash}" stroke-width="1"/>'
            )

    def render(self) -> str:
        self.parts.append("</svg>")
        return "\n".join(self.parts)
