"""WebSocket URL routing for import progress."""
from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/imports/(?P<job_id>\w+)/$", consumers.ImportProgressConsumer.as_asgi()),
]
