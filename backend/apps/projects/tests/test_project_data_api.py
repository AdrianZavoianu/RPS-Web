"""Project data API tests for project-scoped data endpoints."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Element, LoadCase, Project, Story


class ProjectDataApiTests(APITestCase):
    """Validate owner scoping and data contracts for project data routes."""

    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()
        cls.owner_password = "ProjectDataOwner!123"
        cls.owner = user_model.objects.create_user(
            username="project-data-owner",
            email="project-data-owner@example.com",
            password=cls.owner_password,
        )
        cls.other_password = "ProjectDataOther!123"
        cls.other_user = user_model.objects.create_user(
            username="project-data-other",
            email="project-data-other@example.com",
            password=cls.other_password,
        )

        cls.catalog_project = CatalogProject.objects.create(
            name="Project Data Contract",
            slug="project-data-contract",
            owner=cls.owner,
            analysis_type="NLTHA",
        )
        cls.project = Project.objects.create(catalog_project=cls.catalog_project)

        cls.story_l2 = Story.objects.create(project=cls.project, name="L2", sort_order=2)
        cls.story_l1 = Story.objects.create(project=cls.project, name="L1", sort_order=1)

        LoadCase.objects.create(project=cls.project, name="TH02")
        LoadCase.objects.create(project=cls.project, name="TH01")

        Element.objects.create(
            project=cls.project,
            element_type="Column",
            name="C1",
            unique_name="C1",
            story=cls.story_l1,
        )
        Element.objects.create(
            project=cls.project,
            element_type="Column",
            name="C2",
            unique_name="C2",
            story=cls.story_l2,
        )
        Element.objects.create(
            project=cls.project,
            element_type="Beam",
            name="B1",
            unique_name="B1",
            story=cls.story_l1,
        )

    def _authenticate(self, username, password):
        login_response = self.client.post(
            "/api/auth/login/",
            {"username": username, "password": password},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

    def test_stories_endpoint_requires_authentication(self):
        response = self.client.get(f"/api/projects/{self.catalog_project.slug}/stories/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_stories_list_is_project_scoped_and_sorted_by_sort_order(self):
        self._authenticate(self.owner.username, self.owner_password)

        response = self.client.get(f"/api/projects/{self.catalog_project.slug}/stories/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        stories = response.data["results"] if isinstance(response.data, dict) else response.data
        story_names = [story["name"] for story in stories]
        self.assertEqual(story_names, ["L1", "L2"])

    def test_other_user_cannot_access_project_data_by_slug(self):
        self._authenticate(self.other_user.username, self.other_password)

        response = self.client.get(f"/api/projects/{self.catalog_project.slug}/data/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_story_attaches_to_project_in_url(self):
        self._authenticate(self.owner.username, self.owner_password)

        response = self.client.post(
            f"/api/projects/{self.catalog_project.slug}/stories/",
            {"name": "Roof", "sort_order": 99},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_story = Story.objects.get(id=response.data["id"])
        self.assertEqual(created_story.project_id, self.project.id)
        self.assertEqual(created_story.name, "Roof")

    def test_project_data_endpoint_returns_nested_stories_and_load_cases(self):
        self._authenticate(self.owner.username, self.owner_password)

        response = self.client.get(f"/api/projects/{self.catalog_project.slug}/data/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], self.catalog_project.slug)
        self.assertEqual([story["name"] for story in response.data["stories"]], ["L1", "L2"])
        self.assertEqual(
            [load_case["name"] for load_case in response.data["load_cases"]],
            ["TH01", "TH02"],
        )

    def test_element_list_filters_by_type_and_story(self):
        self._authenticate(self.owner.username, self.owner_password)

        response = self.client.get(
            (
                f"/api/projects/{self.catalog_project.slug}/elements/"
                f"?type=Column&story={self.story_l2.id}"
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        elements = response.data["results"] if isinstance(response.data, dict) else response.data
        element_names = [element["name"] for element in elements]
        self.assertEqual(element_names, ["C2"])
