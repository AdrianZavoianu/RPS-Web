import unittest

try:
    import pandas as pd
except ModuleNotFoundError:  # pragma: no cover - env-dependent
    pd = None  # type: ignore[assignment]

if pd is not None:
    from apps.importer.parsers.sheets.pushover_utils import (
        extract_pushover_displacements,
        extract_pushover_forces,
        filter_pushover_cases,
    )
else:  # pragma: no cover - env-dependent
    extract_pushover_displacements = None
    extract_pushover_forces = None
    filter_pushover_cases = None


@unittest.skipUnless(pd is not None, "pandas is not installed in this environment")
class PushoverUtilsTests(unittest.TestCase):
    def test_filter_pushover_cases_filters_by_direction(self):
        df = pd.DataFrame(
            {
                "Output Case": ["Push_X+", "Push_Y+", "Push_XY+", "EQX", None],
                "Value": [1, 2, 3, 4, 5],
            }
        )

        x_cases = filter_pushover_cases(df, "X")
        y_cases = filter_pushover_cases(df, "Y")
        xy_cases = filter_pushover_cases(df, "XY")

        self.assertListEqual(x_cases["Output Case"].tolist(), ["Push_X+", "Push_XY+"])
        self.assertListEqual(y_cases["Output Case"].tolist(), ["Push_Y+", "Push_XY+"])
        self.assertListEqual(xy_cases["Output Case"].tolist(), ["Push_XY+"])

    def test_extract_pushover_displacements_uses_abs_max_per_story_case(self):
        df = pd.DataFrame(
            {
                "Story": ["Roof", "Roof", "Base", "Base", "Roof"],
                "Output Case": ["Push_X+", "Push_X+", "Push_X+", "Push_X+", "Push_Y+"],
                "Step Type": ["Max", "Min", "Max", "Min", "Max"],
                "Ux": [1.0, -3.0, 2.0, -1.0, 9.0],
                "Uy": [0.0, 0.0, 0.0, 0.0, 9.0],
            }
        )

        result = extract_pushover_displacements(df, "X")

        self.assertIsNotNone(result)
        self.assertListEqual(result["Story"].tolist(), ["Roof", "Base"])
        self.assertListEqual(result["Push_X+"].tolist(), [3.0, 2.0])

    def test_extract_pushover_forces_xy_ignores_top_location_rows(self):
        df = pd.DataFrame(
            {
                "Story": ["Roof", "Roof", "Roof", "Base", "Roof"],
                "Output Case": ["Push_XY+", "Push_XY+", "Push_XY+", "Push_XY+", "Push_X+"],
                "Step Type": ["Max", "Max", "Min", "Max", "Max"],
                "Location": ["Bottom", "Top", "Bottom", "Bottom", "Bottom"],
                "VX": [3.0, 100.0, 6.0, 0.0, 9.0],
                "VY": [4.0, 100.0, 8.0, 5.0, 0.0],
            }
        )

        result = extract_pushover_forces(df, "XY")

        self.assertIsNotNone(result)
        self.assertListEqual(result["Story"].tolist(), ["Roof", "Base"])
        self.assertListEqual(result["Push_XY+"].tolist(), [10.0, 5.0])


if __name__ == "__main__":
    unittest.main()
