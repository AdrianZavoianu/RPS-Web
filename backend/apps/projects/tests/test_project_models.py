"""Tests for core project models — Project, Story, LoadCase, Element."""

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Element, LoadCase, Project, Story

User = get_user_model()


class _ModelTestMixin:
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="model-user",
            email="model@example.com",
            password="ModelPass!123",
        )
        cls.catalog = CatalogProject.objects.create(
            name="Model Test Project",
            slug="model-test-project",
            owner=cls.user,
            analysis_type="NLTHA",
        )
        cls.project = Project.objects.create(catalog_project=cls.catalog)


class ProjectModelTests(_ModelTestMixin, TestCase):
    def test_str(self):
        self.assertEqual(str(self.project), "Model Test Project")

    def test_name_property(self):
        self.assertEqual(self.project.name, "Model Test Project")

    def test_slug_property(self):
        self.assertEqual(self.project.slug, "model-test-project")


class StoryModelTests(_ModelTestMixin, TestCase):
    def test_unique_together(self):
        Story.objects.create(project=self.project, name="L1", sort_order=1)
        with self.assertRaises(IntegrityError):
            Story.objects.create(project=self.project, name="L1", sort_order=2)

    def test_ordering(self):
        Story.objects.create(project=self.project, name="S-Roof", sort_order=3)
        Story.objects.create(project=self.project, name="S-L1", sort_order=1)
        Story.objects.create(project=self.project, name="S-L2", sort_order=2)

        stories = list(Story.objects.filter(project=self.project).values_list("name", flat=True))
        self.assertEqual(stories, ["S-L1", "S-L2", "S-Roof"])

    def test_str(self):
        story = Story.objects.create(project=self.project, name="S-Str", sort_order=1)
        self.assertEqual(str(story), "Model Test Project - S-Str")


class LoadCaseModelTests(_ModelTestMixin, TestCase):
    def test_unique_together(self):
        LoadCase.objects.create(project=self.project, name="TH01")
        with self.assertRaises(IntegrityError):
            LoadCase.objects.create(project=self.project, name="TH01")


class ElementModelTests(_ModelTestMixin, TestCase):
    def test_unique_together(self):
        Element.objects.create(
            project=self.project, element_type="Wall", name="W1", unique_name="W1"
        )
        with self.assertRaises(IntegrityError):
            Element.objects.create(
                project=self.project, element_type="Wall", name="W1-dup", unique_name="W1"
            )

    def test_nullable_story(self):
        elem = Element.objects.create(
            project=self.project, element_type="Beam", name="B-No-Story", unique_name="B-NS",
            story=None,
        )
        self.assertIsNone(elem.story)

    def test_str(self):
        elem = Element.objects.create(
            project=self.project, element_type="Column", name="C1", unique_name="C1"
        )
        self.assertEqual(str(elem), "Column: C1")
