"""URL patterns for projects app (project data: stories, load cases, elements)."""
from django.urls import path

from .views import ElementViewSet, LoadCaseViewSet, ProjectDataView, StoryViewSet

app_name = "projects"

# Nested routers for project-specific data
# These are accessed via /api/projects/{slug}/...
urlpatterns = [
    # Project data overview
    path(
        "<slug:project_slug>/data/",
        ProjectDataView.as_view({"get": "retrieve"}),
        name="project-data",
    ),
    # Stories
    path(
        "<slug:project_slug>/stories/",
        StoryViewSet.as_view({"get": "list", "post": "create"}),
        name="story-list",
    ),
    path(
        "<slug:project_slug>/stories/<int:pk>/",
        StoryViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
        name="story-detail",
    ),
    # Load Cases
    path(
        "<slug:project_slug>/load-cases/",
        LoadCaseViewSet.as_view({"get": "list", "post": "create"}),
        name="loadcase-list",
    ),
    path(
        "<slug:project_slug>/load-cases/<int:pk>/",
        LoadCaseViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
        name="loadcase-detail",
    ),
    # Elements
    path(
        "<slug:project_slug>/elements/",
        ElementViewSet.as_view({"get": "list", "post": "create"}),
        name="element-list",
    ),
    path(
        "<slug:project_slug>/elements/<int:pk>/",
        ElementViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
        name="element-detail",
    ),
]
