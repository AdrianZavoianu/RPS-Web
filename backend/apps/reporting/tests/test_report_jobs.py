"""Tests for asynchronous report-job API and Celery task flow."""

from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import CatalogProject
from apps.exporter.models import ExportJob
from apps.projects.models import Project
from apps.results.models import ResultSet
from apps.reporting.tasks import process_report_job

User = get_user_model()


class _ReportJobTestMixin:
    @classmethod
    def setUpTestData(cls):
        cls.password = "RptJobPass!123"
        cls.user = User.objects.create_user(
            username="rpt-job-user",
            email="rpt-job@example.com",
            password=cls.password,
        )
        cls.other_user = User.objects.create_user(
            username="rpt-job-other",
            email="rpt-job-other@example.com",
            password=cls.password,
        )
        cls.catalog = CatalogProject.objects.create(
            name="Report Jobs Project",
            slug="report-jobs-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.other_catalog = CatalogProject.objects.create(
            name="Other Report Jobs Project",
            slug="report-jobs-other-project",
            owner=cls.other_user,
            analysis_type="NLTHA",
        )
        cls.project = Project.objects.create(catalog_project=cls.catalog)
        cls.other_project = Project.objects.create(catalog_project=cls.other_catalog)
        cls.result_set = ResultSet.objects.create(
            project=cls.project,
            name="RS-RPT-JOB",
            analysis_type="NLTHA",
        )

    @staticmethod
    def _sections_payload():
        return [
            {
                "result_type": "Drifts",
                "direction": "X",
                "category": "Global",
                "include_table": True,
                "include_chart": True,
            }
        ]


class ReportJobViewTests(_ReportJobTestMixin, APITestCase):
    def _authenticate(self, user=None):
        user = user or self.user
        response = self.client.post(
            "/api/auth/login/",
            {"username": user.username, "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_create_report_job_dispatches_task(self):
        self._authenticate()
        with patch("apps.reporting.views.process_report_job.delay") as mock_delay:
            mock_delay.return_value = MagicMock(id="report-task-123")
            response = self.client.post(
                "/api/projects/report-jobs-project/reports/jobs/",
                {
                    "result_set_id": self.result_set.id,
                    "sections": self._sections_payload(),
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("id", response.data)
        mock_delay.assert_called_once()

        job = ExportJob.objects.get(id=response.data["id"])
        self.assertEqual(job.export_format, "pdf")
        self.assertEqual(job.export_config["progress_current"], 0)
        self.assertEqual(job.export_config["progress_total"], 3)

    def test_list_report_jobs_filters_non_pdf(self):
        ExportJob.objects.create(
            project=self.project,
            user=self.user,
            export_format="pdf",
            export_config={
                "result_set_id": self.result_set.id,
                "sections": self._sections_payload(),
                "project_name": None,
                "progress_current": 0,
                "progress_total": 3,
            },
            status="pending",
        )
        ExportJob.objects.create(
            project=self.project,
            user=self.user,
            export_format="csv",
            export_config={"result_set_id": self.result_set.id},
            status="pending",
        )

        self._authenticate()
        response = self.client.get("/api/projects/report-jobs-project/reports/jobs/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_download_report_file(self):
        job = ExportJob.objects.create(
            project=self.project,
            user=self.user,
            export_format="pdf",
            export_config={
                "result_set_id": self.result_set.id,
                "sections": self._sections_payload(),
                "project_name": None,
                "progress_current": 3,
                "progress_total": 3,
            },
            status="completed",
            file_name="report.pdf",
        )
        job.output_file.save("report.pdf", ContentFile(b"%PDF-mock"))

        self._authenticate()
        response = self.client.get(
            f"/api/projects/report-jobs-project/reports/jobs/{job.id}/download/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class ReportJobTaskTests(_ReportJobTestMixin, TestCase):
    def _build_job(self, *, result_set_id: int) -> ExportJob:
        return ExportJob.objects.create(
            project=self.project,
            user=self.user,
            export_format="pdf",
            export_config={
                "result_set_id": result_set_id,
                "sections": self._sections_payload(),
                "project_name": "Async Report",
                "progress_current": 0,
                "progress_total": 3,
            },
            status="pending",
        )

    @patch("apps.reporting.tasks.send_report_error")
    @patch("apps.reporting.tasks.send_report_complete")
    @patch("apps.reporting.tasks.send_report_progress")
    @patch("apps.reporting.tasks.PDFReportService")
    def test_process_report_job_completes(
        self,
        mock_service_cls,
        mock_progress,
        mock_complete,
        mock_error,
    ):
        mock_service = MagicMock()
        mock_service.generate_report.return_value = b"%PDF-1.7 async"
        mock_service_cls.return_value = mock_service

        job = self._build_job(result_set_id=self.result_set.id)
        process_report_job.apply(args=(job.id,))

        job.refresh_from_db()
        self.assertEqual(job.status, "completed")
        self.assertTrue(job.file_name.endswith(".pdf"))
        self.assertEqual(job.export_config["progress_current"], 3)
        self.assertEqual(job.export_config["progress_total"], 3)
        self.assertTrue(mock_progress.called)
        mock_complete.assert_called_once()
        mock_error.assert_not_called()

    @patch("apps.reporting.tasks.send_report_error")
    @patch("apps.reporting.tasks.send_report_complete")
    @patch("apps.reporting.tasks.send_report_progress")
    def test_process_report_job_fails_on_missing_result_set(
        self,
        mock_progress,
        mock_complete,
        mock_error,
    ):
        job = self._build_job(result_set_id=999999)
        process_report_job.apply(args=(job.id,))

        job.refresh_from_db()
        self.assertEqual(job.status, "failed")
        self.assertIn("Result set not found", job.error_message)
        mock_complete.assert_not_called()
        mock_error.assert_called_once()
