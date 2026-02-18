"""Tests for reporting views — auth, param validation, PDF generation.

PDFReportService.generate_report is mocked to avoid WeasyPrint.
"""

from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Project, Story
from apps.results.models import GlobalResultsCache, JointResultsCache, ResultSet

User = get_user_model()


class _ReportViewTestMixin:
    """Shared test data for report view tests."""

    @classmethod
    def setUpTestData(cls):
        cls.password = "RptViewPass!123"
        cls.user = User.objects.create_user(
            username="rpt-view-user",
            email="rpt-view@example.com",
            password=cls.password,
        )
        cls.other_user = User.objects.create_user(
            username="rpt-view-other",
            email="rpt-view-other@example.com",
            password=cls.password,
        )
        cls.catalog = CatalogProject.objects.create(
            name="Report View Project",
            slug="report-view-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.other_catalog = CatalogProject.objects.create(
            name="Other View Project",
            slug="other-view-project",
            owner=cls.other_user,
            analysis_type="NLTHA",
        )
        cls.project = Project.objects.create(catalog_project=cls.catalog)
        cls.other_project = Project.objects.create(catalog_project=cls.other_catalog)

        cls.story = Story.objects.create(project=cls.project, name="L1", sort_order=1)

        cls.result_set = ResultSet.objects.create(
            project=cls.project, name="RS-VIEW", analysis_type="NLTHA"
        )
        cls.other_result_set = ResultSet.objects.create(
            project=cls.other_project, name="RS-OTHER", analysis_type="NLTHA"
        )

        GlobalResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            result_type="Drifts_X",
            story=cls.story,
            results_matrix={"TH01": 0.003},
            avg_value=0.003,
            max_value=0.003,
            min_value=0.003,
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
# GenerateReportView
# ------------------------------------------------------------------


class GenerateReportViewTests(_ReportViewTestMixin, APITestCase):
    url = "/api/projects/report-view-project/reports/generate/"

    def test_auth_required(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_params(self):
        self._authenticate()
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_sections(self):
        self._authenticate()
        response = self.client.post(
            self.url,
            {"result_set_id": self.result_set.id, "sections": []},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_foreign_result_set(self):
        self._authenticate()
        response = self.client.post(
            self.url,
            {
                "result_set_id": self.other_result_set.id,
                "sections": [{"result_type": "Drifts", "direction": "X"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("apps.reporting.views.PDFReportService")
    def test_pdf_content_type(self, MockService):
        mock_instance = MagicMock()
        mock_instance.generate_report.return_value = b"%PDF-1.7 mock"
        MockService.return_value = mock_instance

        self._authenticate()
        response = self.client.post(
            self.url,
            {
                "result_set_id": self.result_set.id,
                "sections": [{"result_type": "Drifts", "direction": "X"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")

    @patch("apps.reporting.views.PDFReportService")
    def test_filename(self, MockService):
        mock_instance = MagicMock()
        mock_instance.generate_report.return_value = b"%PDF"
        MockService.return_value = mock_instance

        self._authenticate()
        response = self.client.post(
            self.url,
            {
                "result_set_id": self.result_set.id,
                "sections": [{"result_type": "Drifts", "direction": "X"}],
                "project_name": "My Project",
            },
            format="json",
        )
        self.assertIn("My_Project", response["Content-Disposition"])


# ------------------------------------------------------------------
# ReportSectionDataView
# ------------------------------------------------------------------


class ReportSectionDataViewTests(_ReportViewTestMixin, APITestCase):
    url = "/api/projects/report-view-project/reports/sections/"

    def test_auth_required(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_params(self):
        self._authenticate()
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.reporting.views.PDFReportService")
    def test_structured_response(self, MockService):
        mock_instance = MagicMock()
        mock_instance.get_sections_data.return_value = [
            {"title": "Drifts X", "result_type": "Drifts", "direction": "X"}
        ]
        MockService.return_value = mock_instance

        self._authenticate()
        response = self.client.post(
            self.url,
            {
                "result_set_id": self.result_set.id,
                "sections": [{"result_type": "Drifts", "direction": "X"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("sections", response.data)
        self.assertIn("result_set_name", response.data)

    def test_foreign_result_set_rejected(self):
        self._authenticate()
        response = self.client.post(
            self.url,
            {
                "result_set_id": self.other_result_set.id,
                "sections": [{"result_type": "Drifts", "direction": "X"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ------------------------------------------------------------------
# ReportPreviewView
# ------------------------------------------------------------------


class ReportPreviewViewTests(_ReportViewTestMixin, APITestCase):
    url_base = "/api/projects/report-view-project/reports/preview/"

    def test_auth_required(self):
        response = self.client.get(self.url_base)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_params(self):
        self._authenticate()
        response = self.client.get(self.url_base)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_global_availability(self):
        self._authenticate()
        response = self.client.get(
            self.url_base, {"result_set_id": self.result_set.id}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sections = response.data["available_sections"]
        global_sections = [s for s in sections if s["category"] == "Global"]
        self.assertTrue(len(global_sections) > 0)

    def test_joint_availability(self):
        JointResultsCache.objects.create(
            project=self.project,
            result_set=self.result_set,
            result_type="SoilPressures_Min",
            shell_object="FDN1",
            unique_name="FDN1-PREV",
            results_matrix={"TH01": -100.0},
            avg_value=-100.0,
            load_case_count=1,
        )
        self._authenticate()
        response = self.client.get(
            self.url_base, {"result_set_id": self.result_set.id}
        )
        sections = response.data["available_sections"]
        joint_sections = [s for s in sections if s["category"] == "Joint"]
        self.assertTrue(len(joint_sections) > 0)

    def test_foreign_result_set_rejection(self):
        self._authenticate()
        response = self.client.get(
            self.url_base, {"result_set_id": self.other_result_set.id}
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
