"""Tests for import job-config contract parsing."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys
from unittest import TestCase


MODULE_PATH = Path(__file__).resolve().parents[1] / "services" / "job_config_contracts.py"
SPEC = spec_from_file_location("job_config_contracts_under_test", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Failed to load job_config_contracts module spec for tests")
JOB_CONFIG_CONTRACTS = module_from_spec(SPEC)
sys.modules[SPEC.name] = JOB_CONFIG_CONTRACTS
SPEC.loader.exec_module(JOB_CONFIG_CONTRACTS)


class JobConfigContractsTests(TestCase):
    def test_parse_import_run_config_returns_defaults_when_name_missing(self):
        parsed = JOB_CONFIG_CONTRACTS.parse_import_run_config(
            {},
            default_result_set_name="Imported Results",
        )
        self.assertEqual(parsed.result_set_name, "Imported Results")
        self.assertIsNone(parsed.result_set_id)

    def test_parse_import_run_config_rejects_invalid_result_set_id(self):
        with self.assertRaisesRegex(ValueError, "result_set_id"):
            JOB_CONFIG_CONTRACTS.parse_import_run_config(
                {"result_set_id": "abc"},
                default_result_set_name="Imported Results",
            )

    def test_parse_import_run_config_rejects_empty_result_set_name(self):
        with self.assertRaisesRegex(ValueError, "result_set_name"):
            JOB_CONFIG_CONTRACTS.parse_import_run_config(
                {"result_set_name": "   "},
                default_result_set_name="Imported Results",
            )

    def test_parse_nltha_import_run_config_parses_all_fields(self):
        parsed = JOB_CONFIG_CONTRACTS.parse_nltha_import_run_config(
            {
                "result_set_name": "Set A",
                "result_set_id": 11,
                "selected_load_cases": ["TH1", " TH2 "],
                "conflict_resolution": {
                    "Story Drifts": {"TH1": "file-a.xlsx", "TH2": None},
                },
                "prescan": {
                    "file_load_cases": {
                        "file-a.xlsx": {
                            "Story Drifts": ["TH1", "TH2"],
                            "Story Forces": ["TH1"],
                        },
                    },
                    "foundation_joints": ["J1", "J2"],
                },
            },
            default_result_set_name="Imported Results",
        )

        self.assertEqual(parsed.result_set_name, "Set A")
        self.assertEqual(parsed.result_set_id, 11)
        self.assertSetEqual(parsed.selected_load_cases, {"TH1", "TH2"})
        self.assertDictEqual(
            parsed.conflict_resolution,
            {"Story Drifts": {"TH1": "file-a.xlsx", "TH2": None}},
        )
        self.assertDictEqual(
            parsed.file_load_cases,
            {
                "file-a.xlsx": {
                    "Story Drifts": ["TH1", "TH2"],
                    "Story Forces": ["TH1"],
                },
            },
        )
        self.assertListEqual(parsed.foundation_joints, ["J1", "J2"])

    def test_parse_nltha_import_run_config_requires_prescan_object(self):
        with self.assertRaisesRegex(ValueError, "prescan"):
            JOB_CONFIG_CONTRACTS.parse_nltha_import_run_config(
                {
                    "selected_load_cases": ["TH1"],
                },
                default_result_set_name="Imported Results",
            )

    def test_parse_nltha_import_run_config_rejects_invalid_conflict_map(self):
        with self.assertRaisesRegex(ValueError, "conflict_resolution"):
            JOB_CONFIG_CONTRACTS.parse_nltha_import_run_config(
                {
                    "conflict_resolution": {"Story Drifts": {"TH1": 123}},
                    "prescan": {
                        "file_load_cases": {"file-a.xlsx": {"Story Drifts": ["TH1"]}},
                        "foundation_joints": [],
                    },
                },
                default_result_set_name="Imported Results",
            )

    def test_parse_nltha_import_run_config_rejects_invalid_file_load_cases(self):
        with self.assertRaisesRegex(ValueError, "file_load_cases"):
            JOB_CONFIG_CONTRACTS.parse_nltha_import_run_config(
                {
                    "prescan": {
                        "file_load_cases": {"file-a.xlsx": {"Story Drifts": "TH1"}},
                        "foundation_joints": [],
                    },
                },
                default_result_set_name="Imported Results",
            )

    def test_parse_nltha_import_run_config_rejects_empty_selected_case(self):
        with self.assertRaisesRegex(ValueError, "selected_load_cases"):
            JOB_CONFIG_CONTRACTS.parse_nltha_import_run_config(
                {
                    "selected_load_cases": ["TH1", " "],
                    "prescan": {
                        "file_load_cases": {"file-a.xlsx": {"Story Drifts": ["TH1"]}},
                        "foundation_joints": [],
                    },
                },
                default_result_set_name="Imported Results",
            )

    def test_extract_prescan_snapshot_returns_none_when_missing(self):
        snapshot = JOB_CONFIG_CONTRACTS.extract_prescan_snapshot({})
        self.assertIsNone(snapshot)

    def test_extract_prescan_snapshot_parses_valid_payload(self):
        snapshot = JOB_CONFIG_CONTRACTS.extract_prescan_snapshot(
            {
                "prescan": {
                    "file_load_cases": {
                        "file-a.xlsx": {"Story Drifts": ["TH1", "TH2"]},
                    },
                    "foundation_joints": ["J1"],
                    "files_scanned": 3,
                    "errors": ["file-b.xlsx: parse failed"],
                }
            }
        )
        self.assertIsNotNone(snapshot)
        assert snapshot is not None
        self.assertEqual(snapshot.files_scanned, 3)
        self.assertListEqual(snapshot.foundation_joints, ["J1"])
        self.assertListEqual(snapshot.errors, ["file-b.xlsx: parse failed"])
        self.assertDictEqual(
            snapshot.file_load_cases,
            {"file-a.xlsx": {"Story Drifts": ["TH1", "TH2"]}},
        )

    def test_extract_prescan_snapshot_rejects_negative_files_scanned(self):
        with self.assertRaisesRegex(ValueError, "files_scanned"):
            JOB_CONFIG_CONTRACTS.extract_prescan_snapshot(
                {
                    "prescan": {
                        "file_load_cases": {},
                        "foundation_joints": [],
                        "files_scanned": -1,
                        "errors": [],
                    }
                }
            )

    def test_apply_result_set_target_normalizes_and_clears_id(self):
        config = {}
        JOB_CONFIG_CONTRACTS.apply_result_set_target(
            config,
            result_set_name="  Imported Results  ",
            result_set_id=22,
        )
        self.assertEqual(config["result_set_name"], "Imported Results")
        self.assertEqual(config["result_set_id"], 22)

        JOB_CONFIG_CONTRACTS.apply_result_set_target(
            config,
            result_set_name="Imported Results",
            result_set_id=None,
        )
        self.assertNotIn("result_set_id", config)

    def test_apply_nltha_selection_normalizes_values(self):
        config = {}
        JOB_CONFIG_CONTRACTS.apply_nltha_selection(
            config,
            selected_load_cases=[" TH1 ", "TH2"],
            conflict_resolution={
                " Story Drifts ": {
                    " TH1 ": " file-a.xlsx ",
                    "TH2": None,
                }
            },
        )
        self.assertListEqual(config["selected_load_cases"], ["TH1", "TH2"])
        self.assertDictEqual(
            config["conflict_resolution"],
            {"Story Drifts": {"TH1": "file-a.xlsx", "TH2": None}},
        )
