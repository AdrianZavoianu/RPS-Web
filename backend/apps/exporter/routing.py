"""WebSocket URL routing for export progress."""

from django.urls import re_path

from .consumers import ExportProgressConsumer

websocket_urlpatterns = [
    re_path(r"ws/exports/(?P<job_id>\d+)/$", ExportProgressConsumer.as_asgi()),
]
