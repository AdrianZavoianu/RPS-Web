"""
ASGI config for RPS project.

Supports HTTP and WebSocket protocols via Django Channels.
"""
import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "rps.settings.development")

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

# Import websocket routing after Django setup
from apps.importer.routing import websocket_urlpatterns as importer_websocket_patterns  # noqa: E402
from apps.exporter.routing import websocket_urlpatterns as exporter_websocket_patterns  # noqa: E402

websocket_urlpatterns = [*importer_websocket_patterns, *exporter_websocket_patterns]

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        ),
    }
)
