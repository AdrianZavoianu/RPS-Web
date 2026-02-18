"""Tests for shared importer runner pipeline primitives."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from unittest import TestCase

MODULE_PATH = Path(__file__).resolve().parents[1] / "services" / "runner_pipeline.py"
SPEC = spec_from_file_location("runner_pipeline_under_test", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Failed to load runner_pipeline module spec for tests")
RUNNER_PIPELINE = module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER_PIPELINE)

SheetImportStep = RUNNER_PIPELINE.SheetImportStep
run_sheet_import_step = RUNNER_PIPELINE.run_sheet_import_step


class _FakeParser:
    def __init__(self, available_sheets: set[str]):
        self._available_sheets = available_sheets

    def validate_sheet_exists(self, sheet_name: str) -> bool:
        return sheet_name in self._available_sheets


class _FakeDataFrame:
    def __init__(self, *, empty: bool):
        self.empty = empty


class RunnerPipelineTests(TestCase):
    def test_step_skips_when_sheet_missing(self):
        parser = _FakeParser(available_sheets=set())
        imported_by_sheet: dict[str, set[str]] = {}
        imported_calls: list[tuple] = []

        step = SheetImportStep(
            sheet_name="Story Drifts",
            parse_sheet=lambda: (_FakeDataFrame(empty=True), []),
            resolve_allowed_cases=lambda load_cases, _already: set(load_cases),
            import_sheet=lambda parsed, allowed: imported_calls.append((parsed, allowed)),
        )

        allowed = run_sheet_import_step(
            parser=parser,
            imported_by_sheet=imported_by_sheet,
            step=step,
        )

        self.assertSetEqual(allowed, set())
        self.assertDictEqual(imported_by_sheet, {})
        self.assertListEqual(imported_calls, [])

    def test_step_skips_when_no_allowed_cases(self):
        parser = _FakeParser(available_sheets={"Story Drifts"})
        imported_by_sheet: dict[str, set[str]] = {}
        imported_calls: list[tuple] = []

        step = SheetImportStep(
            sheet_name="Story Drifts",
            parse_sheet=lambda: (
                _FakeDataFrame(empty=False),
                ["TH1"],
                ["Story1"],
            ),
            resolve_allowed_cases=lambda _load_cases, _already: set(),
            import_sheet=lambda parsed, allowed: imported_calls.append((parsed, allowed)),
        )

        allowed = run_sheet_import_step(
            parser=parser,
            imported_by_sheet=imported_by_sheet,
            step=step,
        )

        self.assertSetEqual(allowed, set())
        self.assertDictEqual(imported_by_sheet, {"Story Drifts": set()})
        self.assertListEqual(imported_calls, [])

    def test_step_respects_skip_if_dataframe_empty(self):
        parser = _FakeParser(available_sheets={"Story Drifts"})
        imported_by_sheet: dict[str, set[str]] = {}
        imported_calls: list[tuple] = []

        step = SheetImportStep(
            sheet_name="Story Drifts",
            parse_sheet=lambda: (_FakeDataFrame(empty=True), ["TH1"], ["Story1"]),
            resolve_allowed_cases=lambda load_cases, _already: set(load_cases),
            skip_if_dataframe_empty=True,
            import_sheet=lambda parsed, allowed: imported_calls.append((parsed, allowed)),
        )

        allowed = run_sheet_import_step(
            parser=parser,
            imported_by_sheet=imported_by_sheet,
            step=step,
        )

        self.assertSetEqual(allowed, set())
        self.assertDictEqual(imported_by_sheet, {"Story Drifts": set()})
        self.assertListEqual(imported_calls, [])

    def test_step_imports_and_tracks_cases(self):
        parser = _FakeParser(available_sheets={"Story Drifts"})
        imported_by_sheet: dict[str, set[str]] = {"Story Drifts": {"TH0"}}
        imported_calls: list[set[str]] = []

        step = SheetImportStep(
            sheet_name="Story Drifts",
            parse_sheet=lambda: (
                _FakeDataFrame(empty=False),
                ["TH1", "TH2"],
                ["Story1"],
            ),
            resolve_allowed_cases=lambda load_cases, already: {
                case for case in load_cases if case not in already
            },
            import_sheet=lambda _parsed, allowed: imported_calls.append(set(allowed)),
        )

        allowed = run_sheet_import_step(
            parser=parser,
            imported_by_sheet=imported_by_sheet,
            step=step,
        )

        self.assertSetEqual(allowed, {"TH1", "TH2"})
        self.assertDictEqual(imported_by_sheet, {"Story Drifts": {"TH0", "TH1", "TH2"}})
        self.assertListEqual(imported_calls, [{"TH1", "TH2"}])
