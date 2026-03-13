"""
Project data views for stories, load cases, and elements.
"""

from django.db.models import QuerySet
from rest_framework import permissions, viewsets
from rest_framework.exceptions import NotFound

from core.mixins import ProjectLookupMixin

from .models import Element, LoadCase, Project, Story
from .serializers import (
    ElementSerializer,
    LoadCaseSerializer,
    ProjectDataSerializer,
    StorySerializer,
)


class ProjectDataMixin(ProjectLookupMixin):
    """Mixin to get project from slug in URL."""

    def get_project(self) -> Project:
        project_slug = self.kwargs.get("project_slug")
        catalog_project = self.get_catalog_project(
            project_slug,
            user=self.request.user,
            enforce_owner=True,
        )
        if not hasattr(catalog_project, "project_data"):
            raise NotFound("Project data not found")
        return catalog_project.project_data


class StoryViewSet(ProjectDataMixin, viewsets.ModelViewSet):
    """ViewSet for managing project stories."""

    serializer_class = StorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self) -> QuerySet[Story]:
        return Story.objects.filter(project=self.get_project()).order_by("sort_order")

    def perform_create(self, serializer) -> None:
        serializer.save(project=self.get_project())


class LoadCaseViewSet(ProjectDataMixin, viewsets.ModelViewSet):
    """ViewSet for managing project load cases."""

    serializer_class = LoadCaseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self) -> QuerySet[LoadCase]:
        return LoadCase.objects.filter(project=self.get_project()).order_by("name")

    def perform_create(self, serializer) -> None:
        serializer.save(project=self.get_project())


class ElementViewSet(ProjectDataMixin, viewsets.ModelViewSet):
    """ViewSet for managing project elements."""

    serializer_class = ElementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self) -> QuerySet[Element]:
        queryset = Element.objects.filter(project=self.get_project())

        # Filter by element type
        element_type = self.request.query_params.get("type")
        if element_type:
            queryset = queryset.filter(element_type=element_type)

        # Filter by story
        story_id = self.request.query_params.get("story")
        if story_id:
            queryset = queryset.filter(story_id=story_id)

        return queryset.select_related("story").order_by("element_type", "name")

    def perform_create(self, serializer) -> None:
        serializer.save(project=self.get_project())


class ProjectDataView(ProjectDataMixin, viewsets.ReadOnlyModelViewSet):
    """ViewSet for retrieving full project data."""

    serializer_class = ProjectDataSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "catalog_project__slug"
    lookup_url_kwarg = "project_slug"

    def get_queryset(self) -> QuerySet[Project]:
        return (
            Project.objects.filter(catalog_project__owner=self.request.user)
            .select_related("catalog_project")
            .prefetch_related("stories", "load_cases")
        )

    def get_object(self) -> Project:
        return self.get_project()
