"""Tests for result providers via ResultDataService facade."""

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Element, LoadCase, Project, Story
from apps.results.models import (
    AbsoluteMaxMinDrift,
    ElementResultsCache,
    GlobalResultsCache,
    JointResultsCache,
    ResultSet,
)
from apps.results.services.result_service import ResultDataService

User = get_user_model()


class _ProviderTestMixin:
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="prov-user",
            email="prov@example.com",
            password="ProvPass!123",
        )
        cls.catalog = CatalogProject.objects.create(
            name="Provider Project",
            slug="provider-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.project = Project.objects.create(catalog_project=cls.catalog)
        cls.story_roof = Story.objects.create(project=cls.project, name="Roof", sort_order=3)
        cls.story_l2 = Story.objects.create(project=cls.project, name="L2", sort_order=2)
        cls.story_l1 = Story.objects.create(project=cls.project, name="L1", sort_order=1)

        cls.lc1 = LoadCase.objects.create(project=cls.project, name="TH01", case_type="Time History")
        cls.lc2 = LoadCase.objects.create(project=cls.project, name="TH02", case_type="Time History")

        cls.result_set = ResultSet.objects.create(
            project=cls.project, name="RS-PROV", analysis_type="NLTHA"
        )
        cls.result_set_b = ResultSet.objects.create(
            project=cls.project, name="RS-PROV-B", analysis_type="NLTHA"
        )
        cls.empty_result_set = ResultSet.objects.create(
            project=cls.project, name="RS-PROV-EMPTY", analysis_type="NLTHA"
        )

    def _service(self):
        return ResultDataService(self.project)


# ------------------------------------------------------------------
# Global Provider
# ------------------------------------------------------------------


class GlobalProviderTests(_ProviderTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        for story in [cls.story_roof, cls.story_l2, cls.story_l1]:
            vals = {"TH01": 0.003 * story.sort_order, "TH02": 0.004 * story.sort_order}
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
                load_case_count=2,
                story_sort_order=story.sort_order,
            )

    def test_correct_meta(self):
        ds = self._service().get_global_results(self.result_set.id, "Drifts", "X")
        self.assertEqual(ds.meta.result_type, "Drifts")
        self.assertEqual(ds.meta.direction, "X")
        self.assertEqual(ds.meta.result_set_id, self.result_set.id)

    def test_story_sort_descending(self):
        ds = self._service().get_global_results(self.result_set.id, "Drifts", "X")
        stories = [r["Story"] for r in ds.rows]
        # Roof (sort_order=3) should be first (descending)
        self.assertEqual(stories[0], "Roof")

    def test_multiplier_applied(self):
        ds = self._service().get_global_results(self.result_set.id, "Drifts", "X")
        # Drifts multiplier is 100 (%)
        row = ds.rows[0]  # Roof: TH01 = 0.003 * 3 = 0.009 → * 100 = 0.9
        self.assertAlmostEqual(row["TH01"], 0.009 * 100, places=3)

    def test_summary_columns(self):
        ds = self._service().get_global_results(self.result_set.id, "Drifts", "X")
        self.assertIn("Avg", ds.summary_columns)
        self.assertIn("Max", ds.summary_columns)
        self.assertIn("Min", ds.summary_columns)

    def test_none_when_empty(self):
        ds = self._service().get_global_results(self.empty_result_set.id, "Drifts", "X")
        self.assertIsNone(ds)

    def test_natural_sort(self):
        ds = self._service().get_global_results(self.result_set.id, "Drifts", "X")
        # TH01 before TH02
        self.assertEqual(ds.load_case_columns, ["TH01", "TH02"])


# ------------------------------------------------------------------
# Element Provider
# ------------------------------------------------------------------


class ElementProviderTests(_ProviderTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.wall = Element.objects.create(
            project=cls.project, element_type="Wall", name="W1", unique_name="W1",
            story=cls.story_l1,
        )
        ElementResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            result_type="WallShears_V2",
            element=cls.wall,
            story=cls.story_l1,
            results_matrix={"TH01": 120.5, "TH02": 135.0},
            avg_value=127.75,
            max_value=135.0,
            min_value=120.5,
            load_case_count=2,
            story_sort_order=cls.story_l1.sort_order,
        )

    def test_dataset_for_element(self):
        ds = self._service().get_element_results(
            self.result_set.id, self.wall.id, "WallShears", "V2"
        )
        self.assertIsNotNone(ds)
        self.assertTrue(len(ds.rows) > 0)

    def test_direction_resolution(self):
        ds = self._service().get_element_results(
            self.result_set.id, self.wall.id, "WallShears", "V2"
        )
        self.assertEqual(ds.meta.direction, "V2")

    def test_none_when_empty(self):
        ds = self._service().get_element_results(
            self.empty_result_set.id, self.wall.id, "WallShears", "V2"
        )
        self.assertIsNone(ds)

    def test_element_name_in_row(self):
        ds = self._service().get_element_results(
            self.result_set.id, self.wall.id, "WallShears", "V2"
        )
        self.assertEqual(ds.rows[0]["Element"], "W1")


# ------------------------------------------------------------------
# Joint Provider
# ------------------------------------------------------------------


class JointProviderTests(_ProviderTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        JointResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            result_type="SoilPressures_Min",
            shell_object="FDN1",
            unique_name="FDN1-PROV",
            results_matrix={"TH01": -450.2, "TH02": -380.5},
            avg_value=-415.35,
            max_value=-380.5,
            min_value=-450.2,
            load_case_count=2,
        )

    def test_shell_object_column(self):
        ds = self._service().get_joint_results(self.result_set.id, "SoilPressures")
        self.assertEqual(ds.story_column, "Shell Object")
        self.assertEqual(ds.rows[0]["Shell Object"], "FDN1")

    def test_absolute_values(self):
        ds = self._service().get_joint_results(self.result_set.id, "SoilPressures")
        # Soil pressures displayed as absolute values
        for row in ds.rows:
            for lc in ds.load_case_columns:
                if lc in row and row[lc] is not None:
                    self.assertGreaterEqual(row[lc], 0)

    def test_cache_type_resolution(self):
        # "SoilPressures" should resolve to "SoilPressures_Min"
        ds = self._service().get_joint_results(self.result_set.id, "SoilPressures")
        self.assertIsNotNone(ds)

    def test_none_when_empty(self):
        ds = self._service().get_joint_results(self.empty_result_set.id, "SoilPressures")
        self.assertIsNone(ds)


# ------------------------------------------------------------------
# Comparison Provider
# ------------------------------------------------------------------


class ComparisonProviderTests(_ProviderTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        for rs in [cls.result_set, cls.result_set_b]:
            for story in [cls.story_roof, cls.story_l1]:
                multiplier = 1.0 if rs == cls.result_set else 1.5
                vals = {
                    "TH01": 0.003 * story.sort_order * multiplier,
                    "TH02": 0.004 * story.sort_order * multiplier,
                }
                numeric = list(vals.values())
                GlobalResultsCache.objects.create(
                    project=cls.project,
                    result_set=rs,
                    result_type="Drifts_X",
                    story=story,
                    results_matrix=vals,
                    avg_value=sum(numeric) / len(numeric),
                    max_value=max(numeric),
                    min_value=min(numeric),
                    load_case_count=2,
                    story_sort_order=story.sort_order,
                )

    def test_two_series(self):
        ds = self._service().get_comparison_dataset(
            "Drifts", "X", [self.result_set.id, self.result_set_b.id]
        )
        self.assertIsNotNone(ds)
        self.assertEqual(len(ds.series), 2)

    def test_ratio_column(self):
        ds = self._service().get_comparison_dataset(
            "Drifts", "X", [self.result_set.id, self.result_set_b.id]
        )
        self.assertIsNotNone(ds.ratio_column)

    def test_none_less_than_2_sets(self):
        ds = self._service().get_comparison_dataset(
            "Drifts", "X", [self.result_set.id]
        )
        self.assertIsNone(ds)

    def test_missing_data_handling(self):
        ds = self._service().get_comparison_dataset(
            "Drifts", "X", [self.result_set.id, self.empty_result_set.id]
        )
        # One series has data, one doesn't — should still return dataset
        self.assertIsNotNone(ds)
        self.assertTrue(len(ds.warnings) > 0)

    def test_story_order(self):
        ds = self._service().get_comparison_dataset(
            "Drifts", "X", [self.result_set.id, self.result_set_b.id]
        )
        stories = [r["Story"] for r in ds.rows]
        # Roof (sort_order=3) before L1 (sort_order=1)
        self.assertEqual(stories[0], "Roof")


# ------------------------------------------------------------------
# MaxMin Provider
# ------------------------------------------------------------------


class MaxMinProviderTests(_ProviderTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        for story in [cls.story_roof, cls.story_l1]:
            for lc in [cls.lc1, cls.lc2]:
                for direction in ["X", "Y"]:
                    AbsoluteMaxMinDrift.objects.create(
                        project=cls.project,
                        result_set=cls.result_set,
                        story=story,
                        load_case=lc,
                        direction=direction,
                        absolute_max_drift=0.005 * story.sort_order,
                        sign="positive",
                        original_max=0.005 * story.sort_order,
                        original_min=-0.003 * story.sort_order,
                    )

    def test_maxmin_dataset(self):
        ds = self._service().get_maxmin_dataset(self.result_set.id, "Drifts")
        self.assertIsNotNone(ds)
        self.assertEqual(ds.source_type, "Drifts")
        self.assertTrue(len(ds.rows) > 0)

    def test_none_when_empty(self):
        ds = self._service().get_maxmin_dataset(self.empty_result_set.id, "Drifts")
        self.assertIsNone(ds)

    def test_directions_present(self):
        ds = self._service().get_maxmin_dataset(self.result_set.id, "Drifts")
        self.assertIn("X", ds.directions)
        self.assertIn("Y", ds.directions)
