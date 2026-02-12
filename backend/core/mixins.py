"""Shared mixins for project-scoped lookups."""

from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404

from apps.catalog.models import CatalogProject
from apps.projects.models import Project


class ProjectLookupMixin:
    """Provide shared project lookup behavior for project-scoped views."""

    def _resolve_lookup_user(self, user=None):
        if user is not None:
            return user

        request = getattr(self, "request", None)
        if request is None:
            return None

        request_user = getattr(request, "user", None)
        if request_user is None or not request_user.is_authenticated:
            return None
        return request_user

    def get_catalog_project(
        self,
        slug: str,
        *,
        user=None,
        enforce_owner: bool = True,
    ) -> CatalogProject:
        """Resolve catalog project from slug, optionally owner-scoped."""
        filters = {"slug": slug}
        lookup_user = self._resolve_lookup_user(user=user)
        if enforce_owner:
            if lookup_user is None:
                raise PermissionDenied("Authenticated user is required for project lookup")
            filters["owner"] = lookup_user
        return get_object_or_404(CatalogProject, **filters)

    def get_project_for_slug(
        self,
        slug: str,
        create_if_missing: bool = False,
        *,
        user=None,
        enforce_owner: bool = True,
    ) -> Project:
        """Resolve project from slug with optional creation."""
        catalog_project = self.get_catalog_project(
            slug,
            user=user,
            enforce_owner=enforce_owner,
        )
        if create_if_missing:
            project, _ = Project.objects.get_or_create(catalog_project=catalog_project)
            return project
        return get_object_or_404(Project, catalog_project=catalog_project)
