"""URL patterns for exporter app."""
from django.urls import path

from . import views

app_name = "exporter"

urlpatterns = [
    path("<slug:project_slug>/exports/", views.ExportJobListView.as_view(), name="export-list"),
    path(
        "<slug:project_slug>/exports/<int:job_id>/",
        views.ExportJobDetailView.as_view(),
        name="export-detail",
    ),
    path(
        "<slug:project_slug>/exports/<int:job_id>/download/",
        views.ExportDownloadView.as_view(),
        name="export-download",
    ),
]
