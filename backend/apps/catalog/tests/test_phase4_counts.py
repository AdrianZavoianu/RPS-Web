"""Phase 4 catalog count annotation tests."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Element, LoadCase, Project, Story
from apps.results.models import ResultSet


class CatalogProjectCountAnnotationTests(APITestCase):
    """Ensure project count fields come from queryset annotations."""

    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()
        cls.password = "Phase4CatalogPass!123"
        cls.user = user_model.objects.create_user(
            username="phase4-catalog-user",
            email="phase4-catalog-user@example.com",
            password=cls.password,
        )

        cls.catalog_project_a = CatalogProject.objects.create(
            name="Phase 4 Catalog A",
            slug="phase4-catalog-a",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.catalog_project_b = CatalogProject.objects.create(
            name="Phase 4 Catalog B",
            slug="phase4-catalog-b",
            owner=cls.user,
            analysis_type="Pushover",
        )

        cls.project_a = Project.objects.create(catalog_project=cls.catalog_project_a)
        cls.project_b = Project.objects.create(catalog_project=cls.catalog_project_b)

        Story.objects.create(project=cls.project_a, name="L2", sort_order=2)
        story_a = Story.objects.create(project=cls.project_a, name="L1", sort_order=1)
        Story.objects.create(project=cls.project_b, name="L1", sort_order=1)

        LoadCase.objects.create(project=cls.project_a, name="TH01")
        LoadCase.objects.create(project=cls.project_b, name="TH01")
        LoadCase.objects.create(project=cls.project_b, name="TH02")

        Element.objects.create(
            project=cls.project_a,
            element_type="Column",
            name="C1",
            unique_name="C1",
            story=story_a,
        )
        Element.objects.create(
            project=cls.project_a,
            element_type="Beam",
            name="B1",
            unique_name="B1",
            story=story_a,
        )
        Element.objects.create(
            project=cls.project_b,
            element_type="Wall",
            name="W1",
            unique_name="W1",
        )

        ResultSet.objects.create(project=cls.project_a, name="RS-A1", analysis_type="NLTHA")
        ResultSet.objects.create(project=cls.project_a, name="RS-A2", analysis_type="Pushover")

    def _authenticate(self) -> None:
        login_response = self.client.post(
            "/api/auth/login/",
            {"username": self.user.username, "password": self.password},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

    def test_project_list_includes_annotated_story_and_load_case_counts(self):
        self._authenticate()

        response = self.client.get("/api/projects/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data
        projects = payload["results"] if isinstance(payload, dict) else payload
        by_slug = {project["slug"]: project for project in projects}

        self.assertEqual(by_slug["phase4-catalog-a"]["story_count"], 2)
        self.assertEqual(by_slug["phase4-catalog-a"]["load_case_count"], 1)
        self.assertEqual(by_slug["phase4-catalog-b"]["story_count"], 1)
        self.assertEqual(by_slug["phase4-catalog-b"]["load_case_count"], 2)

    def test_project_detail_includes_annotated_element_and_result_set_counts(self):
        self._authenticate()

        response = self.client.get(f"/api/projects/{self.catalog_project_a.slug}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["story_count"], 2)
        self.assertEqual(response.data["load_case_count"], 1)
        self.assertEqual(response.data["element_count"], 2)
        self.assertEqual(response.data["result_set_count"], 2)
