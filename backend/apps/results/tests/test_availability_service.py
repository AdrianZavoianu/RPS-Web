"""Tests for availability_service — result type discovery and report sections."""

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Element, Project, Story
from apps.results.models import (
    ElementResultsCache,
    GlobalResultsCache,
    JointResultsCache,
    ResultSet,
)
from apps.results.services.availability_service import (
    get_available_report_sections,
    get_available_result_types_payload,
)

User = get_user_model()

REPORT_GLOBAL_TYPES = ("Drifts", "Accelerations", "Forces", "Displacements")


class _AvailabilityTestMixin:
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="avail-user",
            email="avail@example.com",
            password="AvailPass!123",
        )
        cls.catalog = CatalogProject.objects.create(
            name="Availability Project",
            slug="availability-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.project = Project.objects.create(catalog_project=cls.catalog)
        cls.story = Story.objects.create(project=cls.project, name="L1", sort_order=1)
        cls.result_set = ResultSet.objects.create(
            project=cls.project, name="RS-AVAIL", analysis_type="NLTHA"
        )


class AvailableResultTypesPayloadTests(_AvailabilityTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
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

    def test_global_when_cache_present(self):
        payload = get_available_result_types_payload(self.project)
        global_types = [r["type"] for r in payload["global_results"]]
        self.assertIn("Drifts", global_types)

    def test_empty_lists_for_missing_data(self):
        empty_catalog = CatalogProject.objects.create(
            name="Empty Avail",
            slug="empty-avail",
            owner=self.user,
            analysis_type="NLTHA",
        )
        empty_project = Project.objects.create(catalog_project=empty_catalog)
        payload = get_available_result_types_payload(empty_project)
        self.assertEqual(payload["element_results"], [])
        self.assertEqual(payload["joint_results"], [])

    def test_pushover_flag(self):
        payload = get_available_result_types_payload(self.project)
        self.assertIn("has_pushover", payload)
        self.assertFalse(payload["has_pushover"])

    def test_config_metadata(self):
        payload = get_available_result_types_payload(self.project)
        self.assertIn("config", payload)
        self.assertIn("metadata", payload)
        self.assertIn("Drifts", payload["config"])


class AvailableReportSectionsTests(_AvailabilityTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
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

    def test_global_section_present(self):
        sections = get_available_report_sections(
            project=self.project,
            result_set=self.result_set,
            global_types=REPORT_GLOBAL_TYPES,
        )
        categories = [s["category"] for s in sections]
        self.assertIn("Global", categories)

    def test_element_section_present(self):
        elem = Element.objects.create(
            project=self.project, element_type="Beam", name="BA1", unique_name="BA1",
            story=self.story,
        )
        ElementResultsCache.objects.create(
            project=self.project,
            result_set=self.result_set,
            result_type="BeamRotations_R3Plastic",
            element=elem,
            story=self.story,
            results_matrix={"TH01": 0.01},
            avg_value=0.01,
            load_case_count=1,
            story_sort_order=1,
        )
        sections = get_available_report_sections(
            project=self.project,
            result_set=self.result_set,
            global_types=REPORT_GLOBAL_TYPES,
        )
        element_sections = [s for s in sections if s["category"] == "Element"]
        self.assertTrue(len(element_sections) > 0)

    def test_joint_section_present(self):
        JointResultsCache.objects.create(
            project=self.project,
            result_set=self.result_set,
            result_type="SoilPressures_Min",
            shell_object="FDN1",
            unique_name="FDN1-AVAIL",
            results_matrix={"TH01": -200.0},
            avg_value=-200.0,
            load_case_count=1,
        )
        sections = get_available_report_sections(
            project=self.project,
            result_set=self.result_set,
            global_types=REPORT_GLOBAL_TYPES,
        )
        joint_sections = [s for s in sections if s["category"] == "Joint"]
        self.assertTrue(len(joint_sections) > 0)

    def test_omits_missing_data(self):
        empty_rs = ResultSet.objects.create(
            project=self.project, name="RS-EMPTY-AVAIL", analysis_type="NLTHA"
        )
        sections = get_available_report_sections(
            project=self.project,
            result_set=empty_rs,
            global_types=REPORT_GLOBAL_TYPES,
        )
        self.assertEqual(sections, [])
