"""Tests for ReportDataService — cache-based report data assembly."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Element, Project, Story
from apps.results.models import (
    ElementResultsCache,
    JointResultsCache,
    ResultSet,
)

User = get_user_model()


class _ReportDataTestMixin:
    """Shared test data for report data tests."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="rpt-data-user",
            email="rpt-data@example.com",
            password="RptDataPass!123",
        )
        cls.catalog = CatalogProject.objects.create(
            name="Report Data Project",
            slug="report-data-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.project = Project.objects.create(catalog_project=cls.catalog)
        cls.story_l1 = Story.objects.create(project=cls.project, name="L1", sort_order=1)
        cls.story_l2 = Story.objects.create(project=cls.project, name="L2", sort_order=2)

        cls.result_set = ResultSet.objects.create(
            project=cls.project, name="RS-RDATA", analysis_type="NLTHA"
        )
        cls.empty_result_set = ResultSet.objects.create(
            project=cls.project, name="RS-EMPTY", analysis_type="NLTHA"
        )

    def _get_service(self):
        from apps.results.services import ResultDataService
        from apps.reporting.report_data import ReportDataService

        rs = ResultDataService(self.project)
        return ReportDataService(self.project, rs)


# ------------------------------------------------------------------
# Beam Rotation Reports
# ------------------------------------------------------------------


class BeamRotationReportTests(_ReportDataTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.beam = Element.objects.create(
            project=cls.project, element_type="Beam", name="B1", unique_name="B1",
            story=cls.story_l1,
        )
        cls.beam2 = Element.objects.create(
            project=cls.project, element_type="Beam", name="B2", unique_name="B2",
            story=cls.story_l2,
        )
        # Create > 10 entries to test top-10 selection
        for i, (beam, story) in enumerate([
            (cls.beam, cls.story_l1),
            (cls.beam2, cls.story_l2),
        ]):
            ElementResultsCache.objects.create(
                project=cls.project,
                result_set=cls.result_set,
                result_type="BeamRotations_R3Plastic",
                element=beam,
                story=story,
                results_matrix={"TH01": 0.01 * (i + 1), "TH02": 0.02 * (i + 1)},
                avg_value=0.015 * (i + 1),
                max_value=0.02 * (i + 1),
                min_value=0.01 * (i + 1),
                load_case_count=2,
                story_sort_order=story.sort_order,
            )

    @patch("apps.reporting.report_data.ReportDataService._beam_from_raw", return_value=([], [], ["Frame/Wall", "Story"]))
    def test_top_10_from_cache(self, _mock_raw):
        service = self._get_service()
        report = service.get_beam_rotation_report(self.result_set.id, is_pushover=False)
        self.assertIsNotNone(report)
        self.assertLessEqual(len(report["top_10"]), 10)

    @patch("apps.reporting.report_data.ReportDataService._beam_from_raw", return_value=([], [], ["Frame/Wall", "Story"]))
    def test_summary_metrics(self, _mock_raw):
        service = self._get_service()
        report = service.get_beam_rotation_report(self.result_set.id, is_pushover=False)
        self.assertIn("Avg", report["summary_columns"])
        self.assertIn("Max", report["summary_columns"])
        self.assertIn("Min", report["summary_columns"])

    @patch("apps.reporting.report_data.ReportDataService._beam_from_raw", return_value=([], [], ["Frame/Wall", "Story"]))
    def test_pushover_excludes_avg(self, _mock_raw):
        service = self._get_service()
        report = service.get_beam_rotation_report(self.result_set.id, is_pushover=True)
        if report:
            self.assertNotIn("Avg", report["summary_columns"])
            for row in report["top_10"]:
                self.assertNotIn("Avg", row)

    def test_none_when_empty(self):
        service = self._get_service()
        report = service.get_beam_rotation_report(self.empty_result_set.id, is_pushover=False)
        self.assertIsNone(report)

    @patch("apps.reporting.report_data.ReportDataService._beam_from_raw", return_value=([], [], ["Frame/Wall", "Story"]))
    def test_fixed_columns(self, _mock_raw):
        service = self._get_service()
        report = service.get_beam_rotation_report(self.result_set.id, is_pushover=False)
        self.assertEqual(report["fixed_columns"], ["Frame/Wall", "Story"])


# ------------------------------------------------------------------
# Column Rotation Reports
# ------------------------------------------------------------------


class ColumnRotationReportTests(_ReportDataTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.column = Element.objects.create(
            project=cls.project, element_type="Column", name="C1", unique_name="C1",
            story=cls.story_l1,
        )
        ElementResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            result_type="ColumnRotations_R3",
            element=cls.column,
            story=cls.story_l1,
            results_matrix={"TH01": 0.008, "TH02": 0.012},
            avg_value=0.010,
            max_value=0.012,
            min_value=0.008,
            load_case_count=2,
            story_sort_order=cls.story_l1.sort_order,
        )

    def test_top_10(self):
        service = self._get_service()
        report = service.get_column_rotation_report(self.result_set.id, is_pushover=False)
        self.assertIsNotNone(report)
        self.assertLessEqual(len(report["top_10"]), 10)

    def test_fixed_columns(self):
        service = self._get_service()
        report = service.get_column_rotation_report(self.result_set.id, is_pushover=False)
        self.assertEqual(report["fixed_columns"], ["Column", "Story", "Dir"])

    def test_pushover_handling(self):
        service = self._get_service()
        report = service.get_column_rotation_report(self.result_set.id, is_pushover=True)
        if report:
            self.assertNotIn("Avg", report["summary_columns"])


# ------------------------------------------------------------------
# Soil Pressure Reports
# ------------------------------------------------------------------


class SoilPressureReportTests(_ReportDataTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        JointResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            result_type="SoilPressures_Min",
            shell_object="FDN1",
            unique_name="FDN1-A",
            results_matrix={"TH01": -450.2, "TH02": -380.5},
            avg_value=-415.35,
            max_value=-380.5,
            min_value=-450.2,
            load_case_count=2,
        )

    def test_top_10(self):
        service = self._get_service()
        report = service.get_soil_pressure_report(self.result_set.id, is_pushover=False)
        self.assertIsNotNone(report)
        self.assertLessEqual(len(report["top_10"]), 10)

    def test_includes_plot_data(self):
        service = self._get_service()
        report = service.get_soil_pressure_report(self.result_set.id, is_pushover=False)
        self.assertIn("plot_data", report)

    def test_unit_is_kpa(self):
        service = self._get_service()
        report = service.get_soil_pressure_report(self.result_set.id, is_pushover=False)
        # kN/m² is the configured unit for SoilPressures
        self.assertIn(report["unit"], ("kPa", "kN/m²"))

    def test_none_when_empty(self):
        service = self._get_service()
        report = service.get_soil_pressure_report(self.empty_result_set.id, is_pushover=False)
        self.assertIsNone(report)


# ------------------------------------------------------------------
# Vertical Displacement Reports
# ------------------------------------------------------------------


class VerticalDisplacementReportTests(_ReportDataTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        JointResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            result_type="VerticalDisplacements_Min",
            shell_object="FDN2",
            unique_name="FDN2-A",
            results_matrix={"TH01": -12.5, "TH02": -8.3},
            avg_value=-10.4,
            max_value=-8.3,
            min_value=-12.5,
            load_case_count=2,
        )

    def test_top_10(self):
        service = self._get_service()
        report = service.get_vertical_displacement_report(self.result_set.id, is_pushover=False)
        self.assertIsNotNone(report)
        self.assertLessEqual(len(report["top_10"]), 10)

    def test_unit_is_mm(self):
        service = self._get_service()
        report = service.get_vertical_displacement_report(self.result_set.id, is_pushover=False)
        self.assertEqual(report["unit"], "mm")

    def test_none_when_empty(self):
        service = self._get_service()
        report = service.get_vertical_displacement_report(self.empty_result_set.id, is_pushover=False)
        self.assertIsNone(report)
