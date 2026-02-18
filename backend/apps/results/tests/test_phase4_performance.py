"""Phase 4 performance tests for batched tree metadata and time-series envelopes."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Element, Project, Story
from apps.results.models import (
    ElementResultsCache,
    JointResultsCache,
    PushoverCase,
    ResultSet,
    TimeSeriesGlobalCache,
)


class Phase4PerformanceResultsTests(APITestCase):
    """Verify batched metadata and backend envelope precompute behavior."""

    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()
        cls.password = "Phase4ResultsPass!123"
        cls.user = user_model.objects.create_user(
            username="phase4-results-user",
            email="phase4-results-user@example.com",
            password=cls.password,
        )

        cls.catalog_project = CatalogProject.objects.create(
            name="Phase 4 Results Project",
            slug="phase4-results-project",
            owner=cls.user,
            analysis_type="Pushover",
        )
        cls.project = Project.objects.create(catalog_project=cls.catalog_project)

        cls.foreign_catalog_project = CatalogProject.objects.create(
            name="Phase 4 Foreign Project",
            slug="phase4-foreign-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.foreign_project = Project.objects.create(catalog_project=cls.foreign_catalog_project)

        cls.story_l2 = Story.objects.create(project=cls.project, name="L2", sort_order=2)
        cls.story_l1 = Story.objects.create(project=cls.project, name="L1", sort_order=1)

        cls.result_set = ResultSet.objects.create(
            project=cls.project,
            name="PUSH-SET",
            analysis_type="Pushover",
        )
        cls.foreign_result_set = ResultSet.objects.create(
            project=cls.foreign_project,
            name="FOREIGN-SET",
            analysis_type="NLTHA",
        )

        column = Element.objects.create(
            project=cls.project,
            element_type="Column",
            name="C1",
            unique_name="C1",
            story=cls.story_l2,
        )
        beam = Element.objects.create(
            project=cls.project,
            element_type="Beam",
            name="B1",
            unique_name="B1",
            story=cls.story_l2,
        )

        ElementResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            result_type="ColumnShears_V2",
            element=column,
            story=cls.story_l2,
            results_matrix={"TH01": 12.0},
            avg_value=12.0,
            max_value=12.0,
            min_value=12.0,
            load_case_count=1,
            story_sort_order=2,
        )
        ElementResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            result_type="BeamRotations_R3Plastic",
            element=beam,
            story=cls.story_l2,
            results_matrix={"TH01": 0.005},
            avg_value=0.005,
            max_value=0.005,
            min_value=0.005,
            load_case_count=1,
            story_sort_order=2,
        )

        JointResultsCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            result_type="SoilPressures_Min",
            shell_object="S1",
            unique_name="J1",
            results_matrix={"TH01": -100.0},
        )

        PushoverCase.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            name="Push X+",
            direction="X",
        )

        time_steps = [0.0, 0.1, 0.2]
        TimeSeriesGlobalCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            load_case_name="TH01",
            result_type="Drifts",
            direction="X",
            story=cls.story_l2,
            time_steps=time_steps,
            values=[1.0, 5.0, -1.0],
            story_sort_order=2,
        )
        TimeSeriesGlobalCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            load_case_name="TH01",
            result_type="Drifts",
            direction="X",
            story=cls.story_l1,
            time_steps=time_steps,
            values=[2.0, 3.0, 4.0],
            story_sort_order=1,
        )
        TimeSeriesGlobalCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            load_case_name="TH01",
            result_type="Forces",
            direction="X",
            story=cls.story_l2,
            time_steps=time_steps,
            values=[-10.0, -3.0, 2.0],
            story_sort_order=2,
        )
        TimeSeriesGlobalCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            load_case_name="TH01",
            result_type="Forces",
            direction="X",
            story=cls.story_l1,
            time_steps=time_steps,
            values=[1.0, -4.0, 0.0],
            story_sort_order=1,
        )
        TimeSeriesGlobalCache.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            load_case_name="TH02",
            result_type="Drifts",
            direction="X",
            story=cls.story_l2,
            time_steps=time_steps,
            values=[0.5, 0.25, 0.1],
            story_sort_order=2,
        )

    def _authenticate(self) -> None:
        login_response = self.client.post(
            "/api/auth/login/",
            {"username": self.user.username, "password": self.password},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

    def test_tree_metadata_batches_expansion_data(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.catalog_project.slug}/results/tree-metadata/"
                f"?result_set_id={self.result_set.id}"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["result_set_id"], self.result_set.id)
        self.assertEqual(response.data["analysis_type"], "Pushover")
        self.assertEqual(response.data["time_series_load_cases"], ["TH01", "TH02"])
        self.assertEqual(len(response.data["pushover_cases"]), 1)
        self.assertEqual(response.data["elements_by_type"]["ColumnShears"][0]["name"], "C1")
        self.assertEqual(response.data["elements_by_type"]["BeamRotations"][0]["name"], "B1")
        self.assertTrue(response.data["joint_availability"]["SoilPressures"])
        self.assertFalse(response.data["joint_availability"]["VerticalDisplacements"])

    def test_tree_metadata_rejects_foreign_result_set(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.catalog_project.slug}/results/tree-metadata/"
                f"?result_set_id={self.foreign_result_set.id}"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("result_set_id", response.data)

    def test_time_series_all_types_includes_backend_envelopes(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.catalog_project.slug}/results/time-series/all-types/"
                f"?result_set_id={self.result_set.id}&load_case=TH01&direction=X"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["stories"], ["L2", "L1"])
        self.assertEqual(response.data["envelopes"]["Drifts"]["max_values"], [5.0, 4.0])
        self.assertEqual(response.data["envelopes"]["Drifts"]["min_values"], [-1.0, 2.0])
        self.assertEqual(response.data["envelopes"]["Forces"]["max_values"], [2.0, 1.0])
        self.assertEqual(response.data["envelopes"]["Forces"]["min_values"], [-10.0, -4.0])
