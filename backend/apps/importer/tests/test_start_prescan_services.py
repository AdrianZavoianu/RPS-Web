"""Service-entry tests for importer start/prescan flows."""

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
    "apps.projects",
    "apps.results",
]:
    _ensure_package(package_name)


class _FakeSerializer:
    def __init__(self, data):
        self._data = dict(data or {})
        self.validated_data = {}

    def is_valid(self, raise_exception=False):  # noqa: ARG002
        self.validated_data = dict(self._data)
        return True


serializers_module = types.ModuleType("apps.importer.serializers")
serializers_module.ImportStartSerializer = _FakeSerializer
serializers_module.PushoverImportStartSerializer = _FakeSerializer
_set_module("apps.importer.serializers", serializers_module)


class _FakeResultSetQuery:
    def __init__(self, result):
        self._result = result

    def first(self):
        return self._result


class _FakeResultSetManager:
    def __init__(self):
        self.result = None
        self.calls = []

    def filter(self, **kwargs):
        self.calls.append(kwargs)
        return _FakeResultSetQuery(self.result)


FAKE_RESULT_SET_MANAGER = _FakeResultSetManager()


class _FakeResultSet:
    objects = FAKE_RESULT_SET_MANAGER

    def __init__(self, *, result_set_id: int, analysis_type: str):
        self.id = result_set_id
        self.analysis_type = analysis_type


results_models_module = types.ModuleType("apps.results.models")
results_models_module.ResultSet = _FakeResultSet
_set_module("apps.results.models", results_models_module)


projects_models_module = types.ModuleType("apps.projects.models")
projects_models_module.Project = object
_set_module("apps.projects.models", projects_models_module)


importer_models_module = types.ModuleType("apps.importer.models")
importer_models_module.ImportJob = object
_set_module("apps.importer.models", importer_models_module)


DISPATCH_STATE = {
    "dispatch_calls": [],
    "prescan_payload_calls": [],
}


def _dispatch_job_task(job, task):
    DISPATCH_STATE["dispatch_calls"].append((job, task))
    return "task-queued"


def _build_task_started_payload(*, detail, task_id, job_id):
    return {
        "detail": detail,
        "task_id": task_id,
        "job_id": job_id,
    }


def _build_conflict_resolution_map(conflict_resolutions):
    conflict_map = {}
    for resolution in conflict_resolutions:
        sheet = resolution["sheet"]
        load_case = resolution["load_case"]
        chosen_file = resolution["chosen_file"]
        conflict_map.setdefault(sheet, {})[load_case] = chosen_file
    return conflict_map


def _build_prescan_payload(job, prescan_snapshot):
    DISPATCH_STATE["prescan_payload_calls"].append((job, prescan_snapshot))
    return {
        "job_id": job.id,
        "files_scanned": prescan_snapshot.files_scanned,
        "errors": prescan_snapshot.errors,
    }


job_dispatch_module = types.ModuleType("apps.importer.services.job_dispatch")
job_dispatch_module.dispatch_job_task = _dispatch_job_task
job_dispatch_module.build_task_started_payload = _build_task_started_payload
job_dispatch_module.build_conflict_resolution_map = _build_conflict_resolution_map
job_dispatch_module.build_prescan_payload = _build_prescan_payload
_set_module("apps.importer.services.job_dispatch", job_dispatch_module)


JOB_CONFIG_CONTRACTS = _load_module(
    "apps.importer.services.job_config_contracts",
    ROOT / "services" / "job_config_contracts.py",
)
START_MODULE = _load_module(
    "apps.importer.services.start_under_test",
    ROOT / "services" / "start.py",
)
PRESCAN_MODULE = _load_module(
    "apps.importer.services.prescan_under_test",
    ROOT / "services" / "prescan.py",
)
_restore_modules()


class _FakeJob:
    def __init__(self, *, job_id: int, status: str, job_config):
        self.id = job_id
        self.status = status
        self.job_config = job_config
        self.saved_update_fields = []

    def save(self, update_fields=None):
        self.saved_update_fields.append(update_fields)


class StartServiceTests(TestCase):
    def setUp(self):
        DISPATCH_STATE["dispatch_calls"].clear()
        DISPATCH_STATE["prescan_payload_calls"].clear()
        FAKE_RESULT_SET_MANAGER.calls.clear()
        FAKE_RESULT_SET_MANAGER.result = None

    def test_start_nltha_import_job_requires_prescan(self):
        job = _FakeJob(job_id=1, status="pending", job_config={})

        with self.assertRaises(START_MODULE.ImportStartError) as raised:
            START_MODULE.start_nltha_import_job(
                job=job,
                project=object(),
                request_data={},
                task=object(),
                task_started_message="Import started",
            )

        self.assertEqual(str(raised.exception.detail), "Must complete prescan before starting import")

    def test_start_nltha_import_job_happy_path(self):
        FAKE_RESULT_SET_MANAGER.result = _FakeResultSet(result_set_id=7, analysis_type="NLTHA")
        job = _FakeJob(
            job_id=2,
            status="pending",
            job_config={
                "prescan": {
                    "file_load_cases": {"a.xlsx": {"Story Drifts": ["TH1"]}},
                    "foundation_joints": ["J1"],
                    "files_scanned": 1,
                    "errors": [],
                }
            },
        )

        payload = START_MODULE.start_nltha_import_job(
            job=job,
            project=object(),
            request_data={
                "selected_load_cases": [" TH1 "],
                "conflict_resolutions": [
                    {
                        "sheet": "Story Drifts",
                        "load_case": "TH1",
                        "chosen_file": " a.xlsx ",
                    }
                ],
                "result_set_name": "  Import A  ",
                "result_set_id": 7,
            },
            task=object(),
            task_started_message="Import started",
        )

        self.assertDictEqual(
            payload,
            {
                "detail": "Import started",
                "task_id": "task-queued",
                "job_id": 2,
            },
        )
        self.assertListEqual(job.saved_update_fields, [["job_config"]])
        self.assertListEqual(job.job_config["selected_load_cases"], ["TH1"])
        self.assertDictEqual(
            job.job_config["conflict_resolution"],
            {"Story Drifts": {"TH1": "a.xlsx"}},
        )
        self.assertEqual(job.job_config["result_set_name"], "Import A")
        self.assertEqual(job.job_config["result_set_id"], 7)

    def test_start_pushover_import_job_rejects_wrong_result_set_type(self):
        FAKE_RESULT_SET_MANAGER.result = _FakeResultSet(result_set_id=8, analysis_type="NLTHA")
        job = _FakeJob(job_id=3, status="pending", job_config={})

        with self.assertRaises(START_MODULE.ImportStartError) as raised:
            START_MODULE.start_pushover_import_job(
                job=job,
                project=object(),
                request_data={"result_set_id": 8},
                task=object(),
                task_started_message="Pushover import started",
            )

        self.assertIn("analysis_type='Pushover'", str(raised.exception.detail))

    def test_start_pushover_import_job_happy_path_without_result_set_id(self):
        job = _FakeJob(job_id=4, status="pending", job_config={})

        payload = START_MODULE.start_pushover_import_job(
            job=job,
            project=object(),
            request_data={},
            task=object(),
            task_started_message="Pushover import started",
        )

        self.assertDictEqual(
            payload,
            {
                "detail": "Pushover import started",
                "task_id": "task-queued",
                "job_id": 4,
            },
        )
        self.assertEqual(job.job_config["result_set_name"], "Pushover Results")
        self.assertNotIn("result_set_id", job.job_config)


class PrescanServiceTests(TestCase):
    def setUp(self):
        DISPATCH_STATE["dispatch_calls"].clear()
        DISPATCH_STATE["prescan_payload_calls"].clear()

    def test_start_prescan_job_rejects_non_pending_status(self):
        job = _FakeJob(job_id=5, status="processing", job_config={})
        with self.assertRaises(PRESCAN_MODULE.ImportPrescanError) as raised:
            PRESCAN_MODULE.start_prescan_job(
                job=job,
                task=object(),
                task_started_message="Prescan started",
            )
        self.assertIn("Cannot prescan job", str(raised.exception.detail))

    def test_get_prescan_payload_for_job_returns_404_when_missing(self):
        job = _FakeJob(job_id=6, status="pending", job_config={})
        with self.assertRaises(PRESCAN_MODULE.ImportPrescanError) as raised:
            PRESCAN_MODULE.get_prescan_payload_for_job(job)
        self.assertEqual(raised.exception.status_code, 404)

    def test_get_prescan_payload_for_job_returns_500_on_invalid_config_shape(self):
        job = _FakeJob(job_id=7, status="pending", job_config=[])
        with self.assertRaises(PRESCAN_MODULE.ImportPrescanError) as raised:
            PRESCAN_MODULE.get_prescan_payload_for_job(job)
        self.assertEqual(raised.exception.status_code, 500)

    def test_get_prescan_payload_for_job_happy_path(self):
        snapshot = JOB_CONFIG_CONTRACTS.build_prescan_snapshot(
            file_load_cases={"a.xlsx": {"Story Drifts": ["TH1"]}},
            foundation_joints=["J1"],
            files_scanned=3,
            errors=["a.xlsx: warning"],
        )
        job = _FakeJob(
            job_id=8,
            status="pending",
            job_config={
                "prescan": JOB_CONFIG_CONTRACTS.serialize_prescan_snapshot(snapshot),
            },
        )

        payload = PRESCAN_MODULE.get_prescan_payload_for_job(job)
        self.assertDictEqual(
            payload,
            {
                "job_id": 8,
                "files_scanned": 3,
                "errors": ["a.xlsx: warning"],
            },
        )
        self.assertEqual(len(DISPATCH_STATE["prescan_payload_calls"]), 1)
