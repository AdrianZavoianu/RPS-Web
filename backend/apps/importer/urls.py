"""URL patterns for importer app."""

from django.urls import path

from apps.importer.views import ImportViewSet

app_name = "importer"

# URL patterns nested under /api/projects/{slug}/imports/
urlpatterns = [
    # List jobs
    path(
        "<slug:project_slug>/imports/", ImportViewSet.as_view({"get": "list"}), name="import-list"
    ),
    # Upload files
    path(
        "<slug:project_slug>/imports/upload/",
        ImportViewSet.as_view({"post": "upload"}),
        name="import-upload",
    ),
    # Job detail
    path(
        "<slug:project_slug>/imports/<int:pk>/",
        ImportViewSet.as_view({"get": "retrieve", "delete": "destroy"}),
        name="import-detail",
    ),
    # Prescan
    path(
        "<slug:project_slug>/imports/<int:pk>/prescan/",
        ImportViewSet.as_view({"get": "prescan", "post": "prescan"}),
        name="import-prescan",
    ),
    # Start import
    path(
        "<slug:project_slug>/imports/<int:pk>/start/",
        ImportViewSet.as_view({"post": "start"}),
        name="import-start",
    ),
    # Start pushover import
    path(
        "<slug:project_slug>/imports/<int:pk>/start-pushover/",
        ImportViewSet.as_view({"post": "start_pushover"}),
        name="import-start-pushover",
    ),
    # Start pushover global results import
    path(
        "<slug:project_slug>/imports/<int:pk>/start-pushover-results/",
        ImportViewSet.as_view({"post": "start_pushover_results"}),
        name="import-start-pushover-results",
    ),
]
