"""Phase 2 backend boundary and contract tests."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Project, Story
from apps.results.models import GlobalResultsCache, ResultSet


class Phase2BackendRefactorTests(APITestCase):
    """Verify serializer-backed query contracts and boundary cleanup."""

    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()
        cls.password = "Phase2RefactorPass!123"
        cls.user = user_model.objects.create_user(
            username="phase2-user",
            email="phase2-user@example.com",
            password=cls.password,
        )

        cls.primary_catalog_project = CatalogProject.objects.create(
            name="Phase 2 Primary Project",
            slug="phase2-primary-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.secondary_catalog_project = CatalogProject.objects.create(
            name="Phase 2 Secondary Project",
            slug="phase2-secondary-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )

        cls.primary_project = Project.objects.create(catalog_project=cls.primary_catalog_project)
        cls.secondary_project = Project.objects.create(catalog_project=cls.secondary_catalog_project)

        cls.primary_story = Story.objects.create(
            project=cls.primary_project,
            name="L1",
            sort_order=1,
        )

        cls.primary_result_set_a = ResultSet.objects.create(
            project=cls.primary_project,
            name="RS-A",
            analysis_type="NLTHA",
        )
        cls.primary_result_set_b = ResultSet.objects.create(
            project=cls.primary_project,
            name="RS-B",
            analysis_type="NLTHA",
        )
        cls.secondary_result_set = ResultSet.objects.create(
            project=cls.secondary_project,
            name="Foreign-RS",
            analysis_type="NLTHA",
        )

        GlobalResultsCache.objects.create(
            project=cls.primary_project,
            result_set=cls.primary_result_set_a,
            result_type="Drifts_X",
            story=cls.primary_story,
            results_matrix={"TH01": 0.01},
            avg_value=0.01,
            max_value=0.01,
            min_value=0.01,
            load_case_count=1,
            story_sort_order=1,
        )
        GlobalResultsCache.objects.create(
            project=cls.primary_project,
            result_set=cls.primary_result_set_b,
            result_type="Drifts_X",
            story=cls.primary_story,
            results_matrix={"TH01": 0.02},
            avg_value=0.02,
            max_value=0.02,
            min_value=0.02,
            load_case_count=1,
            story_sort_order=1,
        )

    def _authenticate(self) -> None:
        login_response = self.client.post(
            "/api/auth/login/",
            {
                "username": self.user.username,
                "password": self.password,
            },
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

    def test_comparison_requires_direction_for_directional_result_types(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.primary_catalog_project.slug}/results/comparison/"
                f"?result_set_ids={self.primary_result_set_a.id},{self.primary_result_set_b.id}"
                "&result_type=Drifts&metric=Avg"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("direction", response.data)

    def test_maxmin_rejects_element_id_for_non_element_result_type(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.primary_catalog_project.slug}/results/maxmin/"
                f"?result_set_id={self.primary_result_set_a.id}&result_type=Drifts&element_id=1"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("element_id", response.data)

    def test_chart_validation_rejects_invalid_direction(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.primary_catalog_project.slug}/results/chart/"
                f"?result_set_id={self.primary_result_set_a.id}&result_type=Drifts&direction=V2"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("direction", response.data)

    def test_global_results_validation_requires_direction(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.primary_catalog_project.slug}/results/global/"
                f"?result_set_id={self.primary_result_set_a.id}&result_type=Drifts"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("direction", response.data)

    def test_beam_endpoint_rejects_foreign_result_set_id(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.primary_catalog_project.slug}/results/beam-rotations/plot/"
                f"?result_set_id={self.secondary_result_set.id}"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("result_set_id", response.data)

    def test_pushover_batch_rejects_invalid_direction(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.primary_catalog_project.slug}/pushover-curves/batch/"
                f"?result_set_id={self.primary_result_set_a.id}&direction=invalid"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("direction", response.data)

    def test_time_series_load_cases_enforces_project_scope(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.primary_catalog_project.slug}/results/time-series/load-cases/"
                f"?result_set_id={self.secondary_result_set.id}"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("result_set_id", response.data)

    def test_result_type_metadata_endpoint_returns_contract(self):
        self._authenticate()

        response = self.client.get(
            f"/api/projects/{self.primary_catalog_project.slug}/result-type-metadata/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["version"], 1)
        self.assertIn("Drifts", response.data["categories"]["global"])
        self.assertIn("Drifts", response.data["result_type_config"])

    def test_raw_global_endpoint_is_removed(self):
        self._authenticate()

        response = self.client.get(
            f"/api/projects/{self.primary_catalog_project.slug}/global/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
