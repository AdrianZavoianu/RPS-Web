"""Unit tests for global aggregation helper semantics."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from unittest import TestCase


MODULE_PATH = Path(__file__).resolve().parents[1] / "services" / "global_aggregation.py"
SPEC = spec_from_file_location("global_aggregation_under_test", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Failed to load global_aggregation module spec for tests")
MODULE = module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class _FakeDataFrame:
    def __init__(self, columns, rows):
        self.columns = list(columns)
        self._rows = list(rows)
        self.empty = len(self._rows) == 0

    def itertuples(self, index=False, name=None):
        del index, name
        for row in self._rows:
            yield tuple(row)


class GlobalAggregationTests(TestCase):
    def test_aggregate_by_step_type_respects_step_semantics(self):
        df = _FakeDataFrame(
            columns=["Output Case", "Step Type", "Story", "Max UX", "Min UX"],
            rows=[
                ("LC1", "Max", "S1", 3.0, None),
                ("LC1", "Min", "S1", None, -4.0),
                ("LC1", "", "S1", 2.0, -1.0),
                ("LC2", "Max", "S1", 999.0, None),
            ],
        )

        def builder(row, case_name):
            yield (
                (row.get("Story"), case_name, "UX"),
                MODULE.parse_numeric(row.get("Max UX")),
                MODULE.parse_numeric(row.get("Min UX")),
            )

        aggregated = MODULE.aggregate_by_step_type(
            df,
            allowed_load_cases={"LC1"},
            key_value_builder=builder,
        )

        self.assertDictEqual(
            aggregated[("S1", "LC1", "UX")],
            {"max": 3.0, "min": -4.0},
        )
        self.assertNotIn(("S1", "LC2", "UX"), aggregated)

    def test_aggregate_by_step_type_without_step_type_column_uses_legacy_bounds(self):
        df = _FakeDataFrame(
            columns=["Output Case", "Story", "Value"],
            rows=[
                ("LC1", "S1", 5.0),
                ("LC1", "S1", -2.0),
                ("LC2", "S1", 100.0),
            ],
        )

        def builder(row, case_name):
            value = MODULE.parse_numeric(row.get("Value"))
            yield ((row.get("Story"), case_name, "V"), value, value)

        aggregated = MODULE.aggregate_by_step_type(
            df,
            allowed_load_cases={"LC1"},
            key_value_builder=builder,
        )

        self.assertDictEqual(
            aggregated[("S1", "LC1", "V")],
            {"max": 5.0, "min": -2.0},
        )

    def test_aggregate_by_step_type_returns_empty_when_output_case_missing(self):
        df = _FakeDataFrame(
            columns=["Story", "Value"],
            rows=[("S1", 1.0)],
        )

        aggregated = MODULE.aggregate_by_step_type(
            df,
            allowed_load_cases={"LC1"},
            key_value_builder=lambda _row, _case_name: [],
        )

        self.assertDictEqual(aggregated, {})
