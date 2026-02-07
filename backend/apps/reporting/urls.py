"""URL patterns for reporting app."""
from django.urls import path

from .views import GenerateReportView, ReportPreviewView

app_name = 'reporting'

urlpatterns = [
    # Generate PDF report
    path(
        '<slug:project_slug>/reports/generate/',
        GenerateReportView.as_view(),
        name='generate-report'
    ),
    # Preview available sections
    path(
        '<slug:project_slug>/reports/preview/',
        ReportPreviewView.as_view(),
        name='report-preview'
    ),
]
