"""URL patterns for results app."""
from django.urls import path

from .views import (
    AvailableResultTypesView,
    ChartDataView,
    ComparisonDataView,
    ComparisonSetViewSet,
    ElementListView,
    ElementResultsDataView,
    GlobalResultsDataView,
    GlobalResultsView,
    JointResultsDataView,
    MaxMinDataView,
    PushoverCasesView,
    PushoverCurveView,
    ResultSetViewSet,
    TimeSeriesDataView,
    TimeSeriesLoadCasesView,
)

app_name = "results"

urlpatterns = [
    # Result Sets
    path(
        "<slug:project_slug>/result-sets/",
        ResultSetViewSet.as_view({"get": "list", "post": "create"}),
        name="resultset-list",
    ),
    path(
        "<slug:project_slug>/result-sets/<int:pk>/",
        ResultSetViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
        name="resultset-detail",
    ),
    # Comparison Sets
    path(
        "<slug:project_slug>/comparison-sets/",
        ComparisonSetViewSet.as_view({"get": "list", "post": "create"}),
        name="comparisonset-list",
    ),
    path(
        "<slug:project_slug>/comparison-sets/<int:pk>/",
        ComparisonSetViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
        name="comparisonset-detail",
    ),
    # --- Display-Ready Data (from cache) ---
    # Global results (story-level: drifts, accelerations, forces, displacements)
    path(
        "<slug:project_slug>/results/global/",
        GlobalResultsDataView.as_view(),
        name="global-results-data",
    ),
    # Element results (wall shears, column rotations, etc.)
    path(
        "<slug:project_slug>/results/element/",
        ElementResultsDataView.as_view(),
        name="element-results-data",
    ),
    # List of elements with results
    path("<slug:project_slug>/results/elements/", ElementListView.as_view(), name="element-list"),
    # Joint/foundation results (soil pressures, vertical displacements)
    path(
        "<slug:project_slug>/results/joint/",
        JointResultsDataView.as_view(),
        name="joint-results-data",
    ),
    # Max/min envelope data
    path("<slug:project_slug>/results/maxmin/", MaxMinDataView.as_view(), name="maxmin-data"),
    # Comparison data across result sets
    path(
        "<slug:project_slug>/results/comparison/",
        ComparisonDataView.as_view(),
        name="comparison-data",
    ),
    # Chart data (for building profile plots)
    path("<slug:project_slug>/results/chart/", ChartDataView.as_view(), name="chart-data"),
    # --- Pushover ---
    # Pushover cases
    path("<slug:project_slug>/pushover-cases/", PushoverCasesView.as_view(), name="pushover-cases"),
    # Pushover curve data
    path(
        "<slug:project_slug>/pushover-cases/<int:case_id>/curve/",
        PushoverCurveView.as_view(),
        name="pushover-curve",
    ),
    # --- Discovery ---
    # Available result types for a project
    path(
        "<slug:project_slug>/available-types/",
        AvailableResultTypesView.as_view(),
        name="available-types",
    ),
    # --- Time-Series ---
    # Time-series data for animation
    path(
        "<slug:project_slug>/results/time-series/",
        TimeSeriesDataView.as_view(),
        name="time-series-data",
    ),
    # Available time-series load cases
    path(
        "<slug:project_slug>/results/time-series/load-cases/",
        TimeSeriesLoadCasesView.as_view(),
        name="time-series-load-cases",
    ),
    # --- Legacy Raw Data ---
    # Raw global results (not cached, for debugging)
    path("<slug:project_slug>/global/", GlobalResultsView.as_view(), name="global-results-raw"),
]
