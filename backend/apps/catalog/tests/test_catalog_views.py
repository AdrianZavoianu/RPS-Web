"""Tests for catalog views — CRUD, auth, filtering."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Project

User = get_user_model()


class CatalogViewTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = "CatViewPass!123"
        cls.user = User.objects.create_user(
            username="cat-view-user",
            email="cat-view@example.com",
            password=cls.password,
        )
        cls.other_user = User.objects.create_user(
            username="cat-view-other",
            email="cat-view-other@example.com",
            password=cls.password,
        )
        cls.catalog = CatalogProject.objects.create(
            name="Cat View Project",
            slug="cat-view-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        Project.objects.create(catalog_project=cls.catalog)

        cls.other_catalog = CatalogProject.objects.create(
            name="Other Cat Project",
            slug="other-cat-project",
            owner=cls.other_user,
            analysis_type="Pushover",
        )

    def _authenticate(self, user=None):
        user = user or self.user
        response = self.client.post(
            "/api/auth/login/",
            {"username": user.username, "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_list_requires_auth(self):
        response = self.client.get("/api/projects/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_only_owned(self):
        self._authenticate()
        response = self.client.get("/api/projects/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p["slug"] for p in response.data["results"]]
        self.assertIn("cat-view-project", slugs)
        self.assertNotIn("other-cat-project", slugs)

    def test_create_auto_slug(self):
        self._authenticate()
        response = self.client.post(
            "/api/projects/",
            {"name": "New Catalog Entry", "analysis_type": "NLTHA"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["slug"].startswith("new-catalog-entry"))

    def test_reject_duplicate_name_at_db_level(self):
        """unique_together (owner, name) prevents duplicate creation at the DB level."""
        from django.db import IntegrityError as DjangoIntegrityError

        with self.assertRaises(DjangoIntegrityError):
            CatalogProject.objects.create(
                name="Cat View Project",
                owner=self.user,
                analysis_type="NLTHA",
            )

    def test_update_name(self):
        self._authenticate()
        response = self.client.patch(
            f"/api/projects/{self.catalog.slug}/",
            {"name": "Renamed Project"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_cascades(self):
        # Create a project to delete
        cat = CatalogProject.objects.create(
            name="Delete Me",
            slug="delete-me",
            owner=self.user,
            analysis_type="NLTHA",
        )
        Project.objects.create(catalog_project=cat)

        self._authenticate()
        response = self.client.delete(f"/api/projects/{cat.slug}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CatalogProject.objects.filter(slug="delete-me").exists())

    def test_filter_by_analysis_type(self):
        CatalogProject.objects.create(
            name="Pushover Cat",
            slug="pushover-cat",
            owner=self.user,
            analysis_type="Pushover",
        )
        self._authenticate()
        response = self.client.get("/api/projects/")
        types = {p["analysis_type"] for p in response.data["results"]}
        # Both NLTHA and Pushover should be present
        self.assertIn("NLTHA", types)
        self.assertIn("Pushover", types)
