"""URL patterns for reporting app."""
from django.urls import path

from .views import (
    GenerateReportView,
    ReportDownloadView,
    ReportJobDetailView,
    ReportJobListView,
    ReportPreviewView,
    ReportSectionDataView,
)

app_name = "reporting"

urlpatterns = [
    # Async report jobs
    path(
        "<slug:project_slug>/reports/jobs/",
        ReportJobListView.as_view(),
        name="report-job-list",
    ),
    path(
        "<slug:project_slug>/reports/jobs/<int:job_id>/",
        ReportJobDetailView.as_view(),
        name="report-job-detail",
    ),
    path(
        "<slug:project_slug>/reports/jobs/<int:job_id>/download/",
        ReportDownloadView.as_view(),
        name="report-job-download",
    ),
    # Generate PDF report
    path(
        "<slug:project_slug>/reports/generate/",
        GenerateReportView.as_view(),
        name="generate-report",
    ),
    # Preview available sections
    path(
        "<slug:project_slug>/reports/preview/", ReportPreviewView.as_view(), name="report-preview"
    ),
    # Section data for live preview
    path(
        "<slug:project_slug>/reports/sections/",
        ReportSectionDataView.as_view(),
        name="report-sections",
    ),
]
