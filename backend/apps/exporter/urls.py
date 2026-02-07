"""URL patterns for exporter app."""
from django.urls import path

from . import views

app_name = "exporter"

urlpatterns = [
    path("<slug:slug>/exports/", views.ExportJobListView.as_view(), name="export-list"),
    path(
        "<slug:slug>/exports/<int:job_id>/",
        views.ExportJobDetailView.as_view(),
        name="export-detail",
    ),
    path(
        "<slug:slug>/exports/<int:job_id>/download/",
        views.ExportDownloadView.as_view(),
        name="export-download",
    ),
]
