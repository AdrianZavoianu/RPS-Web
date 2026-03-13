"""API smoke tests for critical Phase 0 backend flows."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import CatalogProject
from apps.exporter.models import ExportJob
from apps.importer.models import ImportJob
from apps.projects.models import Project, Story
from apps.results.models import GlobalResultsCache, ResultSet


class Phase0ApiSmokeTests(APITestCase):
    """Smoke-check core auth/results/import/export API paths."""

    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()
        cls.password = "Phase0SmokePass!123"
        cls.user = user_model.objects.create_user(
            username="phase0-smoke",
            email="phase0-smoke@example.com",
            password=cls.password,
        )

        cls.catalog_project = CatalogProject.objects.create(
            name="Phase 0 Smoke Project",
            slug="phase0-smoke-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.project = Project.objects.create(catalog_project=cls.catalog_project)
        cls.story = Story.objects.create(
            project=cls.project,
            name="L1",
            sort_order=1,
        )
        cls.result_set_a = ResultSet.objects.create(
            project=cls.project,
            name="RS-A",
            analysis_type="NLTHA",
        )
        cls.result_set_b = ResultSet.objects.create(
            project=cls.project,
            name="RS-B",
            analysis_type="NLTHA",
        )

        GlobalResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set_a,
            result_type="Drifts_X",
            story=cls.story,
            results_matrix={"TH01": 0.012},
            avg_value=0.012,
            max_value=0.012,
            min_value=0.012,
            load_case_count=1,
            story_sort_order=1,
        )
        GlobalResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set_b,
            result_type="Drifts_X",
            story=cls.story,
            results_matrix={"TH01": 0.018},
            avg_value=0.018,
            max_value=0.018,
            min_value=0.018,
            load_case_count=1,
            story_sort_order=1,
        )

        cls.import_job = ImportJob.objects.create(
            project=cls.project,
            user=cls.user,
            status="pending",
            files=["/tmp/phase0-smoke.xlsx"],
            job_config={
                "prescan": {
                    "file_load_cases": {
                        "phase0-smoke.xlsx": {
                            "Story Drifts": ["TH01"],
                        }
                    },
                    "foundation_joints": [],
                    "files_scanned": 1,
                    "errors": [],
                }
            },
        )

    def _authenticate(self) -> None:
        login_response = self.client.post(
            "/api/auth/login/",
            {"username": self.user.username, "password": self.password},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        access_token = login_response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

    def test_login_smoke(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": self.user.username, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["username"], self.user.username)

    def test_results_read_smoke(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.catalog_project.slug}/results/global/"
                f"?result_set_id={self.result_set_a.id}&result_type=Drifts&direction=X"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["meta"]["result_set_id"], self.result_set_a.id)
        self.assertEqual(response.data["meta"]["result_type"], "Drifts")
        self.assertTrue(response.data["rows"])

    def test_comparison_read_smoke(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.catalog_project.slug}/results/comparison/"
                f"?result_set_ids={self.result_set_a.id},{self.result_set_b.id}"
                "&result_type=Drifts&direction=X&metric=Avg"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["series"]), 2)
        self.assertTrue(response.data["rows"])

    def test_import_start_smoke(self):
        self._authenticate()

        with patch(
            "apps.importer.views.process_import_task.delay",
            return_value=SimpleNamespace(id="phase0-import-task"),
        ):
            response = self.client.post(
                f"/api/projects/{self.catalog_project.slug}/imports/{self.import_job.id}/start/",
                {
                    "selected_load_cases": ["TH01"],
                    "conflict_resolutions": [],
                    "result_set_name": "Phase 0 Import",
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["job_id"], self.import_job.id)
        self.assertEqual(response.data["task_id"], "phase0-import-task")

        self.import_job.refresh_from_db()
        self.assertEqual(self.import_job.celery_task_id, "phase0-import-task")
        self.assertEqual(self.import_job.job_config["selected_load_cases"], ["TH01"])

    def test_export_start_smoke(self):
        self._authenticate()

        with patch(
            "apps.exporter.views.process_export_job.delay",
            return_value=SimpleNamespace(id="phase0-export-task"),
        ):
            response = self.client.post(
                f"/api/projects/{self.catalog_project.slug}/exports/",
                {
                    "result_set_id": self.result_set_a.id,
                    "format": "excel",
                    "result_types": ["Drifts"],
                    "directions": ["X"],
                    "include_summary": True,
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "pending")

        export_job = ExportJob.objects.get(id=response.data["id"])
        self.assertEqual(export_job.celery_task_id, "phase0-export-task")
        self.assertEqual(export_job.project_id, self.project.id)

    def test_import_start_error_envelope(self):
        self._authenticate()
        self.import_job.status = "completed"
        self.import_job.save(update_fields=["status"])

        response = self.client.post(
            f"/api/projects/{self.catalog_project.slug}/imports/{self.import_job.id}/start/",
            {
                "selected_load_cases": ["TH01"],
                "conflict_resolutions": [],
                "result_set_name": "Phase 0 Import",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("X-Correlation-ID", response)
        self.assertIn("error", response.data)
        self.assertEqual(response.data["error"]["code"], "import_start_error")
        self.assertEqual(response.data["error"]["status"], status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot start job in status", response.data["error"]["message"])
