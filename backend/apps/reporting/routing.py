"""WebSocket URL routing for report progress updates."""

from django.urls import re_path

from .consumers import ReportProgressConsumer

websocket_urlpatterns = [
    re_path(r"ws/reports/(?P<job_id>\d+)/$", ReportProgressConsumer.as_asgi()),
]
