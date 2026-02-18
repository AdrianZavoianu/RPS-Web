"""Tests for PDFReportService — section building and PDF generation.

WeasyPrint is mocked via ``apps.reporting.services.render_pdf_document``
so tests run without C dependencies.
"""

from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Project, Story
from apps.results.models import (
    ElementResultsCache,
    GlobalResultsCache,
    JointResultsCache,
    ResultSet,
)

User = get_user_model()

_MOCK_PDF_BYTES = b"%PDF-mock-content"
_MOCK_SVG = "<svg>mock</svg>"


def _patch_rendering():
    """Return a stack of patches that bypass WeasyPrint and SVG generators."""
    return [
        patch("apps.reporting.services.render_pdf_document", return_value=_MOCK_PDF_BYTES),
        patch("apps.reporting.services.generate_profile_svg", return_value=_MOCK_SVG),
        patch("apps.reporting.services.generate_scatter_svg", return_value=_MOCK_SVG),
        patch("apps.reporting.services.generate_joint_scatter_svg", return_value=_MOCK_SVG),
        patch("apps.reporting.services.load_logo_b64", return_value="data:image/png;base64,AA=="),
    ]


class _ReportServiceTestMixin:
    """Shared setUpTestData for report service tests."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="rpt-svc-user",
            email="rpt-svc@example.com",
            password="RptSvcPass!123",
        )
        cls.catalog = CatalogProject.objects.create(
            name="Report Service Project",
            slug="report-service-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.project = Project.objects.create(catalog_project=cls.catalog)

        cls.story_roof = Story.objects.create(project=cls.project, name="Roof", sort_order=3)
        cls.story_l1 = Story.objects.create(project=cls.project, name="L1", sort_order=1)

        cls.result_set = ResultSet.objects.create(
            project=cls.project, name="RS-RPT", analysis_type="NLTHA"
        )

        # Global cache
        for story, vals in [
            (cls.story_roof, {"TH01": 0.003, "TH02": 0.004}),
            (cls.story_l1, {"TH01": 0.002, "TH02": 0.001}),
        ]:
            numeric = list(vals.values())
            GlobalResultsCache.objects.create(
                project=cls.project,
                result_set=cls.result_set,
                result_type="Drifts_X",
                story=story,
                results_matrix=vals,
                avg_value=sum(numeric) / len(numeric),
                max_value=max(numeric),
                min_value=min(numeric),
                load_case_count=len(numeric),
                story_sort_order=story.sort_order,
            )


# ------------------------------------------------------------------
# Global section
# ------------------------------------------------------------------


class PDFReportServiceGlobalSectionTests(_ReportServiceTestMixin, TestCase):
    def _get_service(self):
        from apps.reporting.services import PDFReportService

        return PDFReportService(self.project)

    def test_correct_structure(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            service = self._get_service()
            section = service._build_global_section(
                self.result_set,
                {"result_type": "Drifts", "direction": "X"},
                is_pushover=False,
            )
            self.assertIsNotNone(section)
            self.assertEqual(section["title"], "Drifts X")
            self.assertEqual(section["category"], "Global")
            self.assertIn("table", section)
            self.assertIn("chart_svg", section)
        finally:
            for p in patches:
                p.stop()

    def test_none_for_missing_data(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            service = self._get_service()
            section = service._build_global_section(
                self.result_set,
                {"result_type": "Forces", "direction": "X"},
                is_pushover=False,
            )
            self.assertIsNone(section)
        finally:
            for p in patches:
                p.stop()

    def test_table_formatting(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            service = self._get_service()
            section = service._build_global_section(
                self.result_set,
                {"result_type": "Drifts", "direction": "X"},
                is_pushover=False,
            )
            table = section["table"]
            self.assertIn("columns", table)
            self.assertIn("rows", table)
            self.assertIn("label_headers", table)
            self.assertTrue(len(table["rows"]) > 0)
        finally:
            for p in patches:
                p.stop()

    def test_chart_inclusion(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            service = self._get_service()
            section = service._build_global_section(
                self.result_set,
                {"result_type": "Drifts", "direction": "X", "include_chart": True},
                is_pushover=False,
            )
            self.assertEqual(section["chart_svg"], _MOCK_SVG)
        finally:
            for p in patches:
                p.stop()

    def test_column_limit(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            service = self._get_service()
            section = service._build_global_section(
                self.result_set,
                {"result_type": "Drifts", "direction": "X"},
                is_pushover=False,
            )
            # Max 8 load case + 3 summary columns
            self.assertLessEqual(len(section["table"]["columns"]), 11)
        finally:
            for p in patches:
                p.stop()

    def test_row_limit(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            service = self._get_service()
            section = service._build_global_section(
                self.result_set,
                {"result_type": "Drifts", "direction": "X"},
                is_pushover=False,
            )
            # Max 20 rows
            self.assertLessEqual(len(section["table"]["rows"]), 20)
        finally:
            for p in patches:
                p.stop()


# ------------------------------------------------------------------
# Element section
# ------------------------------------------------------------------


class PDFReportServiceElementSectionTests(_ReportServiceTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        from apps.projects.models import Element

        cls.beam = Element.objects.create(
            project=cls.project, element_type="Beam", name="B1", unique_name="B1",
            story=cls.story_l1,
        )
        ElementResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            result_type="BeamRotations_R3Plastic",
            element=cls.beam,
            story=cls.story_l1,
            results_matrix={"TH01": 0.015, "TH02": 0.020},
            avg_value=0.0175,
            max_value=0.020,
            min_value=0.015,
            load_case_count=2,
            story_sort_order=cls.story_l1.sort_order,
        )

    def test_beam_structure(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            from apps.reporting.services import PDFReportService

            service = PDFReportService(self.project)
            section = service._build_element_section(
                self.result_set,
                {"result_type": "BeamRotations"},
                is_pushover=False,
            )
            self.assertIsNotNone(section)
            self.assertEqual(section["category"], "Element")
            self.assertIn("table", section)
        finally:
            for p in patches:
                p.stop()

    def test_unknown_type_returns_none(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            from apps.reporting.services import PDFReportService

            service = PDFReportService(self.project)
            section = service._build_element_section(
                self.result_set,
                {"result_type": "UnknownRotations"},
                is_pushover=False,
            )
            self.assertIsNone(section)
        finally:
            for p in patches:
                p.stop()

    def test_empty_data_returns_none(self):
        empty_rs = ResultSet.objects.create(
            project=self.project, name="RS-EMPTY-EL", analysis_type="NLTHA"
        )
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            from apps.reporting.services import PDFReportService

            service = PDFReportService(self.project)
            section = service._build_element_section(
                empty_rs,
                {"result_type": "BeamRotations"},
                is_pushover=False,
            )
            self.assertIsNone(section)
        finally:
            for p in patches:
                p.stop()


# ------------------------------------------------------------------
# Joint section
# ------------------------------------------------------------------


class PDFReportServiceJointSectionTests(_ReportServiceTestMixin, TestCase):
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

    def test_soil_pressures(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            from apps.reporting.services import PDFReportService

            service = PDFReportService(self.project)
            section = service._build_joint_section(
                self.result_set,
                {"result_type": "SoilPressures"},
                is_pushover=False,
            )
            self.assertIsNotNone(section)
            self.assertEqual(section["category"], "Joint")
            self.assertEqual(section["result_type"], "SoilPressures")
        finally:
            for p in patches:
                p.stop()

    def test_unknown_type_returns_none(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            from apps.reporting.services import PDFReportService

            service = PDFReportService(self.project)
            section = service._build_joint_section(
                self.result_set,
                {"result_type": "UnknownJoint"},
                is_pushover=False,
            )
            self.assertIsNone(section)
        finally:
            for p in patches:
                p.stop()


# ------------------------------------------------------------------
# generate_report
# ------------------------------------------------------------------


class PDFReportServiceGenerateTests(_ReportServiceTestMixin, TestCase):
    def test_returns_bytes(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            from apps.reporting.services import PDFReportService

            service = PDFReportService(self.project)
            result = service.generate_report(
                result_set_id=self.result_set.id,
                sections=[{"result_type": "Drifts", "direction": "X", "category": "Global"}],
                project_name="Test Project",
            )
            self.assertIsInstance(result, bytes)
            self.assertEqual(result, _MOCK_PDF_BYTES)
        finally:
            for p in patches:
                p.stop()

    def test_passes_project_name(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            from apps.reporting.services import PDFReportService

            service = PDFReportService(self.project)
            # Should not raise
            service.generate_report(
                result_set_id=self.result_set.id,
                sections=[{"result_type": "Drifts", "direction": "X"}],
                project_name="Custom Name",
            )
        finally:
            for p in patches:
                p.stop()

    def test_get_sections_data_structure(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            from apps.reporting.services import PDFReportService

            service = PDFReportService(self.project)
            data = service.get_sections_data(
                result_set_id=self.result_set.id,
                sections=[{"result_type": "Drifts", "direction": "X"}],
            )
            self.assertIsInstance(data, list)
            self.assertTrue(len(data) > 0)
            self.assertIn("title", data[0])
        finally:
            for p in patches:
                p.stop()

    def test_skips_empty_sections(self):
        patches = _patch_rendering()
        for p in patches:
            p.start()
        try:
            from apps.reporting.services import PDFReportService

            service = PDFReportService(self.project)
            data = service.get_sections_data(
                result_set_id=self.result_set.id,
                sections=[
                    {"result_type": "Drifts", "direction": "X"},
                    {"result_type": "Forces", "direction": "X"},  # No data
                ],
            )
            self.assertEqual(len(data), 1)
        finally:
            for p in patches:
                p.stop()
