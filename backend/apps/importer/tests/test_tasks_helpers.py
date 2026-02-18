"""Unit tests for importer task helper behavior."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys
import types
from unittest import TestCase


ROOT = Path(__file__).resolve().parents[1]
_MISSING = object()
_ORIGINAL_MODULES = {}


def _set_module(module_name: str, module) -> None:
    if module_name not in _ORIGINAL_MODULES:
        _ORIGINAL_MODULES[module_name] = sys.modules.get(module_name, _MISSING)
    sys.modules[module_name] = module


def _restore_modules() -> None:
    for module_name, original in reversed(list(_ORIGINAL_MODULES.items())):
        if original is _MISSING:
            sys.modules.pop(module_name, None)
        else:
            sys.modules[module_name] = original
    _ORIGINAL_MODULES.clear()


def _ensure_package(module_name: str) -> None:
    if module_name in sys.modules:
        return
    package = types.ModuleType(module_name)
    package.__path__ = []
    _set_module(module_name, package)


def _load_module(module_name: str, path: Path):
    spec = spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load module spec: {module_name}")
    module = module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


for package_name in [
    "apps",
    "apps.importer",
    "apps.importer.services",
]:
    _ensure_package(package_name)


celery_module = types.ModuleType("celery")


def _shared_task(*_args, **_kwargs):
    def _decorator(func):
        return func

    return _decorator


celery_module.shared_task = _shared_task
_set_module("celery", celery_module)


django_module = types.ModuleType("django")
django_utils_module = types.ModuleType("django.utils")
django_timezone_module = types.ModuleType("django.utils.timezone")
django_timezone_module.now = lambda: "now-ts"
_set_module("django", django_module)
_set_module("django.utils", django_utils_module)
_set_module("django.utils.timezone", django_timezone_module)


importer_models_module = types.ModuleType("apps.importer.models")
importer_models_module.ImportJob = object
_set_module("apps.importer.models", importer_models_module)


import_preparation_module = types.ModuleType("apps.importer.services.import_preparation")
import_preparation_module.ImportPreparationService = object
_set_module("apps.importer.services.import_preparation", import_preparation_module)


cache_builder_module = types.ModuleType("apps.importer.services.cache_builder")
cache_builder_module.CacheBuilderService = object
_set_module("apps.importer.services.cache_builder", cache_builder_module)


nltha_runner_module = types.ModuleType("apps.importer.services.nltha_import_runner")
nltha_runner_module.run_nltha_import = lambda **_kwargs: {}
_set_module("apps.importer.services.nltha_import_runner", nltha_runner_module)


pushover_runner_module = types.ModuleType("apps.importer.services.pushover_import_runner")
pushover_runner_module.run_pushover_import = lambda **_kwargs: {}
_set_module("apps.importer.services.pushover_import_runner", pushover_runner_module)


pushover_results_runner_module = types.ModuleType(
    "apps.importer.services.pushover_results_import_runner"
)
pushover_results_runner_module.run_pushover_results_import = lambda **_kwargs: {}
_set_module("apps.importer.services.pushover_results_import_runner", pushover_results_runner_module)


EVENTS = {
    "send_complete": [],
    "send_error": [],
    "send_progress": [],
}


def _send_complete(job_id, status, message, result_set_id):
    EVENTS["send_complete"].append((job_id, status, message, result_set_id))


def _send_error(job_id, message, details):
    EVENTS["send_error"].append((job_id, message, details))


def _send_progress(job_id, channel, message, current, total):
    EVENTS["send_progress"].append((job_id, channel, message, current, total))


progress_events_module = types.ModuleType("apps.importer.services.progress_events")
progress_events_module.send_complete = _send_complete
progress_events_module.send_error = _send_error
progress_events_module.send_progress = _send_progress
_set_module("apps.importer.services.progress_events", progress_events_module)


import_contracts_module = types.ModuleType("apps.importer.services.import_contracts")
import_contracts_module.ImportCompletionPayload = dict
import_contracts_module.ImportRunnerStats = dict
import_contracts_module.NlthaImportStats = dict
import_contracts_module.PushoverCurveImportStats = dict
import_contracts_module.PushoverResultsImportStats = dict
_set_module("apps.importer.services.import_contracts", import_contracts_module)


job_config_contracts_module = types.ModuleType("apps.importer.services.job_config_contracts")


class _ImportRunConfig:
    def __init__(self, *, result_set_name, result_set_id):
        self.result_set_name = result_set_name
        self.result_set_id = result_set_id


def _parse_import_run_config(_job_config, *, default_result_set_name):
    return _ImportRunConfig(
        result_set_name=default_result_set_name,
        result_set_id=None,
    )


def _parse_nltha_import_run_config(_job_config, *, default_result_set_name):
    return types.SimpleNamespace(
        result_set_name=default_result_set_name,
        result_set_id=None,
        selected_load_cases=set(),
        conflict_resolution={},
        file_load_cases={},
        foundation_joints=[],
    )


job_config_contracts_module.ImportRunConfig = _ImportRunConfig
job_config_contracts_module.build_prescan_snapshot = lambda **kwargs: types.SimpleNamespace(**kwargs)
job_config_contracts_module.ensure_job_config_object = lambda value: value
job_config_contracts_module.parse_import_run_config = _parse_import_run_config
job_config_contracts_module.parse_nltha_import_run_config = _parse_nltha_import_run_config
job_config_contracts_module.serialize_prescan_snapshot = lambda snapshot: snapshot.__dict__
_set_module("apps.importer.services.job_config_contracts", job_config_contracts_module)


TASKS_MODULE = _load_module(
    "apps.importer.tasks_under_test",
    ROOT / "tasks.py",
)
_restore_modules()


class _FakeProject:
    def __init__(self, slug: str):
        self.slug = slug


class _FakeResultSet:
    def __init__(self, result_set_id: int):
        self.id = result_set_id


class _FakeJob:
    def __init__(
        self,
        *,
        job_id: int = 101,
        project_id: int = 11,
        project_slug: str = "sample-project",
        result_set=None,
    ):
        self.id = job_id
        self.project_id = project_id
        self.project = _FakeProject(project_slug)
        self.result_set = result_set
        self.result_set_id = result_set.id if result_set is not None else None
        self.status = "pending"
        self.current_phase = ""
        self.error_message = ""
        self.import_summary = {}
        self.completed_at = None
        self.progress_current = 0
        self.progress_total = 0
        self.saved_calls = []

    def save(self, update_fields=None):
        self.saved_calls.append(update_fields)


class _FakeCacheBuilder:
    instances = []

    def __init__(self, *, project, result_set, progress_callback, compute_aggregates):
        self.project = project
        self.result_set = result_set
        self.progress_callback = progress_callback
        self.compute_aggregates = compute_aggregates
        self.time_series_args = None
        _FakeCacheBuilder.instances.append(self)

    def build_all_caches(self):
        return {
            "global_cache_rows": 10,
            "element_cache_rows": 20,
            "joint_cache_rows": 30,
        }

    def build_time_series_cache(self, time_history_results, stories_map):
        self.time_series_args = (time_history_results, stories_map)
        return 7


class TasksHelperTests(TestCase):
    def setUp(self):
        EVENTS["send_complete"].clear()
        EVENTS["send_error"].clear()
        EVENTS["send_progress"].clear()
        _FakeCacheBuilder.instances.clear()
        TASKS_MODULE.CacheBuilderService = _FakeCacheBuilder
        TASKS_MODULE.logger.exception = lambda *_args, **_kwargs: None

    def test_normalized_import_errors_trims_and_filters(self):
        normalized = TASKS_MODULE._normalized_import_errors(
            {
                "errors": [
                    " file-a.xlsx: bad row ",
                    "",
                    "   ",
                    "file-b.xlsx: parse failed",
                ]
            }
        )
        self.assertListEqual(
            normalized,
            ["file-a.xlsx: bad row", "file-b.xlsx: parse failed"],
        )

    def test_normalized_import_errors_rejects_non_list(self):
        with self.assertRaisesRegex(ValueError, "must be a list"):
            TASKS_MODULE._normalized_import_errors({"errors": "nope"})

    def test_finalize_import_job_success(self):
        job = _FakeJob()
        stats = {
            "files_processed": 2,
            "errors": [],
            "result_set_id": 15,
        }

        payload = TASKS_MODULE._finalize_import_job(
            job=job,
            stats=stats,
            success_message="Done",
            warning_prefix="Import",
        )

        self.assertDictEqual(payload, {"status": "success", "message": "Done"})
        self.assertEqual(job.status, "completed")
        self.assertEqual(job.current_phase, "Completed")
        self.assertEqual(job.error_message, "")
        self.assertEqual(job.completed_at, "now-ts")
        self.assertFalse(stats["has_warnings"])
        self.assertEqual(stats["warning_count"], 0)

    def test_finalize_import_job_warning_when_partial_errors(self):
        job = _FakeJob()
        stats = {
            "files_processed": 1,
            "errors": [" file-a.xlsx: failure "],
            "result_set_id": 15,
        }

        payload = TASKS_MODULE._finalize_import_job(
            job=job,
            stats=stats,
            success_message="Done",
            warning_prefix="Import",
        )

        self.assertEqual(payload["status"], "warning")
        self.assertIn("completed with 1 file error", payload["message"])
        self.assertEqual(job.status, "completed")
        self.assertEqual(job.current_phase, "Completed with warnings")
        self.assertListEqual(stats["errors"], ["file-a.xlsx: failure"])

    def test_finalize_import_job_failed_when_zero_files_processed(self):
        job = _FakeJob()
        stats = {
            "files_processed": 0,
            "errors": ["file-a.xlsx: failure"],
            "result_set_id": 15,
        }

        payload = TASKS_MODULE._finalize_import_job(
            job=job,
            stats=stats,
            success_message="Done",
            warning_prefix="Import",
        )

        self.assertEqual(payload["status"], "failed")
        self.assertIn("no files were imported successfully", payload["message"])
        self.assertEqual(job.status, "failed")
        self.assertEqual(job.current_phase, "Failed")

    def test_finalize_and_send_completion_emits_event(self):
        job = _FakeJob()
        stats = {
            "files_processed": 2,
            "errors": [],
            "result_set_id": 55,
        }

        payload = TASKS_MODULE._finalize_and_send_completion(
            job=job,
            job_id=job.id,
            stats=stats,
            success_message="Done",
            warning_prefix="Import",
        )

        self.assertEqual(payload["status"], "success")
        self.assertListEqual(
            EVENTS["send_complete"],
            [(job.id, "success", "Done", 55)],
        )

    def test_build_throttled_progress_callback_saves_only_on_index_change(self):
        job = _FakeJob()
        callback = TASKS_MODULE._build_throttled_progress_callback(
            job=job,
            job_id=job.id,
            channel="importing",
        )

        callback("step-1", 1, 10)
        callback("step-1-repeat", 1, 10)
        callback("step-2", 2, 10)

        self.assertEqual(len(EVENTS["send_progress"]), 3)
        save_updates = [entry for entry in job.saved_calls if entry == ["progress_current", "progress_total"]]
        self.assertEqual(len(save_updates), 2)
        self.assertEqual(job.progress_current, 2)
        self.assertEqual(job.progress_total, 10)

    def test_handle_task_failure_sets_job_and_sends_error(self):
        job = _FakeJob()
        TASKS_MODULE._handle_task_failure(
            job=job,
            job_id=job.id,
            public_message="Import failed",
            exc=ValueError("bad file"),
        )

        self.assertEqual(job.status, "failed")
        self.assertEqual(job.error_message, "bad file")
        self.assertEqual(job.completed_at, "now-ts")
        self.assertListEqual(
            EVENTS["send_error"],
            [(job.id, "Import failed", "bad file")],
        )

    def test_build_import_caches_skips_when_result_set_missing(self):
        job = _FakeJob(result_set=None)
        stats = {
            "files_processed": 1,
            "errors": [],
            "result_set_id": None,
        }

        TASKS_MODULE._build_import_caches(
            job=job,
            job_id=job.id,
            stats=stats,
        )

        self.assertEqual(job.status, "building_cache")
        self.assertEqual(job.current_phase, "Building cache")
        self.assertEqual(len(_FakeCacheBuilder.instances), 0)

    def test_build_import_caches_merges_cache_stats_and_time_series(self):
        result_set = _FakeResultSet(result_set_id=77)
        job = _FakeJob(result_set=result_set)
        stats = {
            "files_processed": 1,
            "errors": [],
            "result_set_id": 77,
            "time_history_results": ["th-1"],
            "stories_map": {"S1": object()},
        }

        TASKS_MODULE._build_import_caches(
            job=job,
            job_id=job.id,
            stats=stats,
        )

        self.assertEqual(len(_FakeCacheBuilder.instances), 1)
        cache_builder = _FakeCacheBuilder.instances[0]
        self.assertEqual(cache_builder.result_set.id, 77)
        self.assertEqual(cache_builder.time_series_args[0], ["th-1"])
        self.assertEqual(stats["global_cache_rows"], 10)
        self.assertEqual(stats["element_cache_rows"], 20)
        self.assertEqual(stats["joint_cache_rows"], 30)
        self.assertEqual(stats["time_series_cache_rows"], 7)
        self.assertNotIn("time_history_results", stats)
        self.assertNotIn("stories_map", stats)
