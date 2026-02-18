"""Unit tests for importer task-dispatch helper functions."""

from __future__ import annotations

from django.test import SimpleTestCase

from apps.importer.services.job_config_contracts import build_prescan_snapshot
from apps.importer.services.job_dispatch import (
    build_conflict_resolution_map,
    build_prescan_payload,
    build_task_started_payload,
    dispatch_job_task,
)


class _FakeQueuedTask:
    def __init__(self, task_id: str):
        self.id = task_id


class _FakeTask:
    def __init__(self, task_id: str):
        self._task_id = task_id
        self.calls: list[int] = []

    def delay(self, job_id: int) -> _FakeQueuedTask:
        self.calls.append(job_id)
        return _FakeQueuedTask(self._task_id)


class _FakeJob:
    def __init__(self, *, job_id: int, status: str):
        self.id = job_id
        self.status = status
        self.celery_task_id = ""
        self.saved_update_fields: list[list[str] | None] = []

    def save(self, update_fields=None):
        self.saved_update_fields.append(update_fields)


class JobDispatchTests(SimpleTestCase):
    def test_dispatch_job_task_sets_celery_task_id_and_saves(self):
        job = _FakeJob(job_id=42, status="pending")
        task = _FakeTask(task_id="task-abc")

        task_id = dispatch_job_task(job, task)

        self.assertEqual(task_id, "task-abc")
        self.assertEqual(task.calls, [42])
        self.assertEqual(job.celery_task_id, "task-abc")
        self.assertEqual(job.saved_update_fields, [["celery_task_id"]])

    def test_build_task_started_payload_is_stable(self):
        payload = build_task_started_payload(
            detail="Import started",
            task_id="task-123",
            job_id=7,
        )

        self.assertDictEqual(
            payload,
            {
                "detail": "Import started",
                "task_id": "task-123",
                "job_id": 7,
            },
        )

    def test_build_conflict_resolution_map_groups_by_sheet(self):
        conflict_map = build_conflict_resolution_map(
            [
                {
                    "sheet": "Story Drifts",
                    "load_case": "TH01",
                    "chosen_file": "a.xlsx",
                },
                {
                    "sheet": "Story Forces",
                    "load_case": "TH02",
                    "chosen_file": "b.xlsx",
                },
                {
                    "sheet": "Story Drifts",
                    "load_case": "TH03",
                    "chosen_file": None,
                },
            ]
        )

        self.assertDictEqual(
            conflict_map,
            {
                "Story Drifts": {"TH01": "a.xlsx", "TH03": None},
                "Story Forces": {"TH02": "b.xlsx"},
            },
        )

    def test_build_prescan_payload_aggregates_load_cases_and_marks_conflicts(self):
        snapshot = build_prescan_snapshot(
            file_load_cases={
                "a.xlsx": {
                    "Story Drifts": ["TH01", "TH02"],
                    "Story Forces": ["TH01"],
                },
                "b.xlsx": {
                    "Story Drifts": ["TH02"],
                    "Story Forces": ["TH03"],
                },
            },
            foundation_joints=["J1"],
            files_scanned=2,
            errors=["a.xlsx: warning"],
        )
        job = _FakeJob(job_id=11, status="pending")

        payload = build_prescan_payload(job, snapshot)

        self.assertEqual(payload["job_id"], 11)
        self.assertEqual(payload["status"], "pending")
        self.assertEqual(payload["files_scanned"], 2)
        self.assertEqual(payload["foundation_joints"], ["J1"])
        self.assertEqual(payload["errors"], ["a.xlsx: warning"])

        load_cases_by_name = {item["name"]: item for item in payload["load_cases"]}
        self.assertEqual(load_cases_by_name["TH01"]["files"], ["a.xlsx"])
        self.assertEqual(
            load_cases_by_name["TH01"]["sheets"],
            ["Story Drifts", "Story Forces"],
        )
        self.assertFalse(load_cases_by_name["TH01"]["has_conflict"])

        self.assertEqual(load_cases_by_name["TH02"]["files"], ["a.xlsx", "b.xlsx"])
        self.assertEqual(load_cases_by_name["TH02"]["sheets"], ["Story Drifts"])
        self.assertTrue(load_cases_by_name["TH02"]["has_conflict"])

        self.assertEqual(load_cases_by_name["TH03"]["files"], ["b.xlsx"])
        self.assertFalse(load_cases_by_name["TH03"]["has_conflict"])

        self.assertEqual(len(payload["conflicts"]), 1)
        self.assertDictEqual(
            payload["conflicts"][0],
            {
                "load_case": "TH02",
                "sheet": "Story Drifts",
                "files": ["a.xlsx", "b.xlsx"],
            },
        )
