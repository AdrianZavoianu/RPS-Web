"""Tests for declarative importer sheet-step definitions."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from unittest import TestCase


MODULE_PATH = Path(__file__).resolve().parents[1] / "services" / "sheet_step_definitions.py"
SPEC = spec_from_file_location("sheet_step_definitions_under_test", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Failed to load sheet_step_definitions module spec for tests")
SHEET_STEP_DEFINITIONS = module_from_spec(SPEC)
SPEC.loader.exec_module(SHEET_STEP_DEFINITIONS)


class SheetStepDefinitionsTests(TestCase):
    def test_nltha_step_order_is_stable(self):
        sheet_names = [
            definition.sheet_name
            for definition in SHEET_STEP_DEFINITIONS.NLTHA_SHEET_STEP_DEFINITIONS
        ]
        self.assertListEqual(
            sheet_names,
            [
                "Story Drifts",
                "Diaphragm Accelerations",
                "Story Forces",
                "Joint Displacements",
                "Pier Forces",
                "Quad Strain Gauge - Rotation",
                "Element Forces - Columns",
                "Fiber Hinge States",
                "Hinge States",
                "Soil Pressures",
            ],
        )

    def test_pushover_step_order_is_stable(self):
        sheet_names = [
            definition.sheet_name
            for definition in SHEET_STEP_DEFINITIONS.PUSHOVER_RESULTS_SHEET_STEP_DEFINITIONS
        ]
        self.assertListEqual(
            sheet_names,
            [
                "Story Drifts",
                "Story Forces",
                "Joint Displacements",
                "Diaphragm Accelerations",
                "Pier Forces",
                "Quad Strain Gauge - Rotation",
                "Element Forces - Columns",
                "Fiber Hinge States",
                "Hinge States",
                "Soil Pressures",
            ],
        )

    def test_vertical_displacement_steps_write_to_virtual_sheet_name(self):
        nltha_vertical = SHEET_STEP_DEFINITIONS.NLTHA_VERTICAL_DISPLACEMENTS_STEP_DEFINITION
        pushover_vertical = (
            SHEET_STEP_DEFINITIONS.PUSHOVER_VERTICAL_DISPLACEMENTS_STEP_DEFINITION
        )

        self.assertEqual(nltha_vertical.sheet_name, "Joint Displacements")
        self.assertEqual(nltha_vertical.parser_method_name, "get_vertical_displacements")
        self.assertEqual(nltha_vertical.imported_sheet_name, "Vertical Displacements")
        self.assertTrue(nltha_vertical.skip_if_dataframe_empty)

        self.assertEqual(pushover_vertical.sheet_name, "Joint Displacements")
        self.assertEqual(pushover_vertical.parser_method_name, "get_vertical_displacements")
        self.assertEqual(pushover_vertical.imported_sheet_name, "Vertical Displacements")
        self.assertTrue(pushover_vertical.skip_if_dataframe_empty)

    def test_parser_method_names_are_unique_per_runner_definition(self):
        nltha_methods = [
            definition.parser_method_name
            for definition in SHEET_STEP_DEFINITIONS.NLTHA_SHEET_STEP_DEFINITIONS
        ]
        pushover_methods = [
            definition.parser_method_name
            for definition in SHEET_STEP_DEFINITIONS.PUSHOVER_RESULTS_SHEET_STEP_DEFINITIONS
        ]

        self.assertEqual(len(nltha_methods), len(set(nltha_methods)))
        self.assertEqual(len(pushover_methods), len(set(pushover_methods)))
