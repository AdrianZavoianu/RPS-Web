"""Tests for exporter views — auth, CRUD, download."""

from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Project, Story
from apps.results.models import GlobalResultsCache, ResultSet
from apps.exporter.models import ExportJob

User = get_user_model()


class _ExportViewTestMixin:
    @classmethod
    def setUpTestData(cls):
        cls.password = "ExpViewPass!123"
        cls.user = User.objects.create_user(
            username="exp-view-user",
            email="exp-view@example.com",
            password=cls.password,
        )
        cls.other_user = User.objects.create_user(
            username="exp-view-other",
            email="exp-view-other@example.com",
            password=cls.password,
        )
        cls.catalog = CatalogProject.objects.create(
            name="Export View Project",
            slug="export-view-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.other_catalog = CatalogProject.objects.create(
            name="Other Export Project",
            slug="other-export-project",
            owner=cls.other_user,
            analysis_type="NLTHA",
        )
        cls.project = Project.objects.create(catalog_project=cls.catalog)
        cls.other_project = Project.objects.create(catalog_project=cls.other_catalog)

        cls.story = Story.objects.create(project=cls.project, name="L1", sort_order=1)
        cls.result_set = ResultSet.objects.create(
            project=cls.project, name="RS-EXPV", analysis_type="NLTHA"
        )

        GlobalResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            result_type="Drifts_X",
            story=cls.story,
            results_matrix={"TH01": 0.003},
            avg_value=0.003,
            load_case_count=1,
            story_sort_order=1,
        )

    def _authenticate(self, user=None):
        user = user or self.user
        response = self.client.post(
            "/api/auth/login/",
            {"username": user.username, "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")


# ------------------------------------------------------------------
# ExportJobListView
# ------------------------------------------------------------------


class ExportJobListViewTests(_ExportViewTestMixin, APITestCase):
    url = "/api/projects/export-view-project/exports/"

    def test_auth_required(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_project_scoped_list(self):
        ExportJob.objects.create(
            project=self.project, user=self.user, export_format="excel",
            export_config={"result_set_id": self.result_set.id},
        )
        self._authenticate()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) >= 1)

    @patch("apps.exporter.views.process_export_job.delay")
    def test_creates_job_and_dispatches(self, mock_delay):
        mock_delay.return_value = MagicMock(id="celery-123")
        self._authenticate()
        response = self.client.post(
            self.url,
            {
                "result_set_id": self.result_set.id,
                "result_types": ["Drifts"],
                "directions": ["X"],
                "format": "excel",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mock_delay.assert_called_once()

    @patch("apps.exporter.views.process_export_job.delay")
    def test_returns_201(self, mock_delay):
        mock_delay.return_value = MagicMock(id="celery-456")
        self._authenticate()
        response = self.client.post(
            self.url,
            {
                "result_set_id": self.result_set.id,
                "result_types": ["Drifts"],
                "format": "excel",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("id", response.data)

    def test_rejects_invalid_format(self):
        self._authenticate()
        response = self.client.post(
            self.url,
            {
                "result_set_id": self.result_set.id,
                "result_types": ["Drifts"],
                "format": "invalid_format",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ------------------------------------------------------------------
# ExportJobDetailView
# ------------------------------------------------------------------


class ExportJobDetailViewTests(_ExportViewTestMixin, APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.job = ExportJob.objects.create(
            project=cls.project, user=cls.user, export_format="excel",
            export_config={"result_set_id": cls.result_set.id},
            status="pending",
        )

    def _url(self, job_id=None):
        jid = job_id or self.job.id
        return f"/api/projects/export-view-project/exports/{jid}/"

    def test_status_response(self):
        self._authenticate()
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "pending")

    def test_cancel_pending(self):
        self._authenticate()
        response = self.client.delete(self._url())
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "failed")

    def test_cancel_processing(self):
        processing_job = ExportJob.objects.create(
            project=self.project, user=self.user, export_format="csv",
            export_config={"result_set_id": self.result_set.id},
            status="processing",
        )
        self._authenticate()
        response = self.client.delete(self._url(processing_job.id))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        processing_job.refresh_from_db()
        self.assertEqual(processing_job.status, "failed")

    def test_404_wrong_project(self):
        other_rs = ResultSet.objects.create(
            project=self.other_project, name="RS-OTHER-EXP", analysis_type="NLTHA"
        )
        other_job = ExportJob.objects.create(
            project=self.other_project, user=self.other_user, export_format="excel",
            export_config={"result_set_id": other_rs.id},
        )
        self._authenticate()
        response = self.client.get(self._url(other_job.id))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ------------------------------------------------------------------
# ExportDownloadView
# ------------------------------------------------------------------


class ExportDownloadViewTests(_ExportViewTestMixin, APITestCase):
    def _url(self, job_id):
        return f"/api/projects/export-view-project/exports/{job_id}/download/"

    def test_file_for_completed(self):
        job = ExportJob.objects.create(
            project=self.project, user=self.user, export_format="csv",
            export_config={}, status="completed",
            file_name="test.csv",
        )
        job.output_file.save("test.csv", ContentFile(b"a,b,c\n1,2,3"))
        self._authenticate()
        response = self.client.get(self._url(job.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_404_incomplete(self):
        job = ExportJob.objects.create(
            project=self.project, user=self.user, export_format="csv",
            export_config={}, status="pending",
        )
        self._authenticate()
        response = self.client.get(self._url(job.id))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_404_wrong_project(self):
        other_job = ExportJob.objects.create(
            project=self.other_project, user=self.other_user, export_format="csv",
            export_config={}, status="completed",
            file_name="other.csv",
        )
        other_job.output_file.save("other.csv", ContentFile(b"x"))
        self._authenticate()
        response = self.client.get(self._url(other_job.id))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
