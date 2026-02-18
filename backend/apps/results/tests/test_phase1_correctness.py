"""Phase 1 correctness and security tests for results flows."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Element, Project, Story
from apps.results.models import ElementResultsCache, GlobalResultsCache, ResultSet
from apps.results.services.result_service import ResultDataService


class Phase1CorrectnessTests(APITestCase):
    """Validate Phase 1 fixes for comparison scoping and result contracts."""

    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()
        cls.password = "Phase1TestPass!123"
        cls.user = user_model.objects.create_user(
            username="phase1-user",
            email="phase1-user@example.com",
            password=cls.password,
        )

        cls.primary_catalog_project = CatalogProject.objects.create(
            name="Phase 1 Primary Project",
            slug="phase1-primary-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.secondary_catalog_project = CatalogProject.objects.create(
            name="Phase 1 Secondary Project",
            slug="phase1-secondary-project",
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

    def test_comparison_provider_filters_foreign_result_set_name(self):
        service = ResultDataService(self.primary_project)

        dataset = service.get_comparison_dataset(
            result_type="Drifts",
            direction="X",
            result_set_ids=[self.primary_result_set_a.id, self.secondary_result_set.id],
            metric="Avg",
        )

        self.assertIsNotNone(dataset)
        self.assertEqual(dataset.series[0].result_set_name, self.primary_result_set_a.name)
        self.assertNotEqual(dataset.series[1].result_set_name, self.secondary_result_set.name)

    def test_comparison_endpoint_rejects_foreign_result_set_ids(self):
        self._authenticate()

        response = self.client.get(
            (
                f"/api/projects/{self.primary_catalog_project.slug}/results/comparison/"
                f"?result_set_ids={self.primary_result_set_a.id},{self.secondary_result_set.id}"
                "&result_type=Drifts&direction=X&metric=Avg"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("result_set_ids", response.data)
        self.assertIn("Invalid IDs", response.data["result_set_ids"][0])
        self.assertIn(str(self.secondary_result_set.id), response.data["result_set_ids"][0])

    def test_comparison_set_validation_rejects_foreign_result_set_ids(self):
        self._authenticate()

        response = self.client.post(
            f"/api/projects/{self.primary_catalog_project.slug}/comparison-sets/",
            {
                "name": "COM-FOREIGN",
                "description": "scope validation",
                "result_set_ids": [self.primary_result_set_a.id, self.secondary_result_set.id],
                "result_types": ["Drifts"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current project", response.data["result_set_ids"][0])

    def test_comparison_set_validation_rejects_invalid_result_types(self):
        self._authenticate()

        response = self.client.post(
            f"/api/projects/{self.primary_catalog_project.slug}/comparison-sets/",
            {
                "name": "COM-INVALID-TYPE",
                "description": "type validation",
                "result_set_ids": [self.primary_result_set_a.id, self.primary_result_set_b.id],
                "result_types": ["NotAResultType"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Unsupported result_types", response.data["result_types"][0])

    def test_comparison_set_validation_rejects_duplicate_result_set_ids(self):
        self._authenticate()

        response = self.client.post(
            f"/api/projects/{self.primary_catalog_project.slug}/comparison-sets/",
            {
                "name": "COM-DUPLICATE-IDS",
                "description": "structure validation",
                "result_set_ids": [self.primary_result_set_a.id, self.primary_result_set_a.id],
                "result_types": ["Drifts"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Duplicate result_set_ids", response.data["result_set_ids"][0])

    def test_element_list_returns_quad_element_type(self):
        self._authenticate()

        quad_element = Element.objects.create(
            project=self.primary_project,
            element_type="Quad",
            name="Q1",
            unique_name="Q1",
            story=self.primary_story,
        )
        ElementResultsCache.objects.create(
            project=self.primary_project,
            result_set=self.primary_result_set_a,
            result_type="QuadRotations",
            element=quad_element,
            story=self.primary_story,
            results_matrix={"TH01": 0.001},
            avg_value=0.001,
            max_value=0.001,
            min_value=0.001,
            load_case_count=1,
            story_sort_order=1,
        )

        response = self.client.get(
            (
                f"/api/projects/{self.primary_catalog_project.slug}/results/elements/"
                f"?result_set_id={self.primary_result_set_a.id}&result_type=QuadRotations"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["elements"][0]["element_type"], "Quad")
