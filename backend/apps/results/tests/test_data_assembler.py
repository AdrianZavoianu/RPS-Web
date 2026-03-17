"""Pure-function tests for results.services.data_assembler (no DB required)."""

from django.test import SimpleTestCase

from core.data_assembler import (
    add_summary_metrics,
    assemble_table_rows,
    build_abs_scatter_data,
    dataset_to_table_projection,
    select_top_rows_by_abs_avg,
)


class _FakeDataset:
    """Minimal stub matching the duck-typed dataset interface."""

    def __init__(self, rows, load_case_columns, summary_columns=None, story_column="Story"):
        self.rows = rows
        self.load_case_columns = load_case_columns
        self.summary_columns = summary_columns or []
        self.story_column = story_column


# ------------------------------------------------------------------
# assemble_table_rows
# ------------------------------------------------------------------


class AssembleTableRowsTests(SimpleTestCase):
    def test_header_order_fixed_then_lc_then_summary(self):
        headers, _ = assemble_table_rows(
            rows=[{"Story": "L1", "TH01": 1.0, "Avg": 1.0}],
            fixed_columns=["Story"],
            load_case_columns=["TH01"],
            summary_columns=["Avg"],
        )
        self.assertEqual(headers, ["Story", "TH01", "Avg"])

    def test_missing_required_column_raises(self):
        with self.assertRaises(KeyError):
            assemble_table_rows(
                rows=[{"TH01": 1.0}],
                fixed_columns=["Story"],
                load_case_columns=["TH01"],
                required_columns=["Story"],
            )

    def test_empty_rows_returns_empty_matrix(self):
        headers, rows = assemble_table_rows(
            rows=[],
            fixed_columns=["Story"],
            load_case_columns=["TH01"],
        )
        self.assertEqual(headers, ["Story", "TH01"])
        self.assertEqual(rows, [])

    def test_summary_columns_appended(self):
        headers, rows = assemble_table_rows(
            rows=[{"Story": "L1", "TH01": 1.0, "TH02": 2.0, "Avg": 1.5, "Max": 2.0}],
            fixed_columns=["Story"],
            load_case_columns=["TH01", "TH02"],
            summary_columns=["Avg", "Max"],
        )
        self.assertEqual(headers, ["Story", "TH01", "TH02", "Avg", "Max"])
        self.assertEqual(rows[0], ["L1", 1.0, 2.0, 1.5, 2.0])

    def test_missing_value_yields_none(self):
        headers, rows = assemble_table_rows(
            rows=[{"Story": "L1"}],
            fixed_columns=["Story"],
            load_case_columns=["TH01"],
        )
        self.assertIsNone(rows[0][1])


# ------------------------------------------------------------------
# add_summary_metrics
# ------------------------------------------------------------------


class AddSummaryMetricsTests(SimpleTestCase):
    def test_avg_max_min_populated(self):
        rows = [{"TH01": 2.0, "TH02": 4.0}]
        add_summary_metrics(rows=rows, load_case_columns=["TH01", "TH02"], include_avg=True)
        self.assertAlmostEqual(rows[0]["Avg"], 3.0)
        self.assertAlmostEqual(rows[0]["Max"], 4.0)
        self.assertAlmostEqual(rows[0]["Min"], 2.0)

    def test_skip_avg_flag(self):
        rows = [{"TH01": 5.0, "TH02": 10.0}]
        add_summary_metrics(rows=rows, load_case_columns=["TH01", "TH02"], include_avg=False)
        self.assertNotIn("Avg", rows[0])
        self.assertAlmostEqual(rows[0]["Max"], 10.0)
        self.assertAlmostEqual(rows[0]["Min"], 5.0)

    def test_no_numeric_values_skipped(self):
        rows = [{"TH01": None, "TH02": "n/a"}]
        add_summary_metrics(rows=rows, load_case_columns=["TH01", "TH02"], include_avg=True)
        self.assertNotIn("Avg", rows[0])
        self.assertNotIn("Max", rows[0])

    def test_mixed_none_values(self):
        rows = [{"TH01": 3.0, "TH02": None}]
        add_summary_metrics(rows=rows, load_case_columns=["TH01", "TH02"], include_avg=True)
        self.assertAlmostEqual(rows[0]["Avg"], 3.0)
        self.assertAlmostEqual(rows[0]["Max"], 3.0)
        self.assertAlmostEqual(rows[0]["Min"], 3.0)

    def test_integer_values_accepted(self):
        rows = [{"TH01": 5, "TH02": 10}]
        add_summary_metrics(rows=rows, load_case_columns=["TH01", "TH02"], include_avg=True)
        self.assertAlmostEqual(rows[0]["Avg"], 7.5)


# ------------------------------------------------------------------
# select_top_rows_by_abs_avg
# ------------------------------------------------------------------


class SelectTopRowsByAbsAvgTests(SimpleTestCase):
    def _make_rows(self, values):
        return [{"Story": f"L{i}", "TH01": v} for i, v in enumerate(values)]

    def test_default_limit_10(self):
        rows = self._make_rows(range(20))
        top = select_top_rows_by_abs_avg(rows=rows, load_case_columns=["TH01"])
        self.assertEqual(len(top), 10)

    def test_custom_limit(self):
        rows = self._make_rows([1, 2, 3, 4, 5])
        top = select_top_rows_by_abs_avg(rows=rows, load_case_columns=["TH01"], limit=3)
        self.assertEqual(len(top), 3)

    def test_fewer_rows_than_limit(self):
        rows = self._make_rows([1, 2])
        top = select_top_rows_by_abs_avg(rows=rows, load_case_columns=["TH01"], limit=10)
        self.assertEqual(len(top), 2)

    def test_descending_order(self):
        rows = self._make_rows([1, -5, 3])
        top = select_top_rows_by_abs_avg(rows=rows, load_case_columns=["TH01"])
        values = [r["TH01"] for r in top]
        self.assertEqual(values[0], -5)
        self.assertEqual(values[1], 3)
        self.assertEqual(values[2], 1)

    def test_returns_copies(self):
        rows = [{"Story": "L1", "TH01": 5.0}]
        top = select_top_rows_by_abs_avg(rows=rows, load_case_columns=["TH01"])
        top[0]["extra"] = True
        self.assertNotIn("extra", rows[0])


# ------------------------------------------------------------------
# dataset_to_table_projection
# ------------------------------------------------------------------


class DatasetToTableProjectionTests(SimpleTestCase):
    def test_correct_keys(self):
        ds = _FakeDataset(
            rows=[{"Story": "L1", "TH01": 1.0}],
            load_case_columns=["TH01"],
            summary_columns=["Avg"],
        )
        proj = dataset_to_table_projection(
            dataset=ds,
            include_summary=True,
            required_columns=["Story"],
        )
        self.assertIn("headers", proj)
        self.assertIn("rows", proj)
        self.assertIn("fixed_columns", proj)
        self.assertIn("load_case_columns", proj)
        self.assertIn("summary_columns", proj)

    def test_headers_match_row_length(self):
        ds = _FakeDataset(
            rows=[{"Story": "L1", "TH01": 1.0, "TH02": 2.0, "Avg": 1.5}],
            load_case_columns=["TH01", "TH02"],
            summary_columns=["Avg"],
        )
        proj = dataset_to_table_projection(
            dataset=ds,
            include_summary=True,
        )
        self.assertEqual(len(proj["headers"]), len(proj["rows"][0]))

    def test_summary_excluded_when_flag_false(self):
        ds = _FakeDataset(
            rows=[{"Story": "L1", "TH01": 1.0, "Avg": 1.0}],
            load_case_columns=["TH01"],
            summary_columns=["Avg"],
        )
        proj = dataset_to_table_projection(dataset=ds, include_summary=False)
        self.assertEqual(proj["summary_columns"], [])
        self.assertNotIn("Avg", proj["headers"])

    def test_custom_fixed_columns(self):
        ds = _FakeDataset(
            rows=[{"Element": "W1", "Story": "L1", "TH01": 1.0}],
            load_case_columns=["TH01"],
            story_column="Story",
        )
        proj = dataset_to_table_projection(
            dataset=ds,
            include_summary=False,
            fixed_columns=["Element", "Story"],
        )
        self.assertEqual(proj["fixed_columns"], ["Element", "Story"])
        self.assertEqual(proj["headers"][:2], ["Element", "Story"])


# ------------------------------------------------------------------
# build_abs_scatter_data
# ------------------------------------------------------------------


class BuildAbsScatterDataTests(SimpleTestCase):
    def test_abs_values(self):
        rows = [{"TH01": -5.0, "TH02": 3.0}]
        points = build_abs_scatter_data(rows=rows, load_case_columns=["TH01", "TH02"])
        values = {p["load_case_idx"]: p["value"] for p in points}
        self.assertAlmostEqual(values[0], 5.0)
        self.assertAlmostEqual(values[1], 3.0)

    def test_empty_rows(self):
        points = build_abs_scatter_data(rows=[], load_case_columns=["TH01"])
        self.assertEqual(points, [])

    def test_skips_none(self):
        rows = [{"TH01": None, "TH02": 2.0}]
        points = build_abs_scatter_data(rows=rows, load_case_columns=["TH01", "TH02"])
        self.assertEqual(len(points), 1)
        self.assertEqual(points[0]["load_case_idx"], 1)

    def test_multiple_rows(self):
        rows = [
            {"TH01": 1.0, "TH02": 2.0},
            {"TH01": 3.0, "TH02": 4.0},
        ]
        points = build_abs_scatter_data(rows=rows, load_case_columns=["TH01", "TH02"])
        self.assertEqual(len(points), 4)
