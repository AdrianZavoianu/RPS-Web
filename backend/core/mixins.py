"""Shared mixins for project-scoped lookups."""

from django.shortcuts import get_object_or_404

from apps.catalog.models import CatalogProject
from apps.projects.models import Project


class ProjectLookupMixin:
    """Provide shared project lookup behavior for project-scoped views."""

    def get_catalog_project(self, slug: str) -> CatalogProject:
        """Resolve catalog project from slug."""
        return get_object_or_404(CatalogProject, slug=slug)

    def get_project_for_slug(self, slug: str, create_if_missing: bool = False) -> Project:
        """Resolve project from slug with optional creation."""
        catalog_project = self.get_catalog_project(slug)
        if create_if_missing:
            project, _ = Project.objects.get_or_create(catalog_project=catalog_project)
            return project
        return get_object_or_404(Project, catalog_project=catalog_project)

