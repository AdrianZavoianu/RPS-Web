"""URL patterns for reporting app."""
from django.urls import path

from .views import GenerateReportView, ReportPreviewView, ReportSectionDataView

app_name = "reporting"

urlpatterns = [
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
