"""Channels middleware for JWT websocket authentication."""

from urllib.parse import parse_qs

from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError


@database_sync_to_async
def _get_user_from_token(raw_token: str):
    auth = JWTAuthentication()
    validated_token = auth.get_validated_token(raw_token)
    return auth.get_user(validated_token)


class QueryStringJWTAuthMiddleware:
    """Attach a user to websocket scope from `?token=<jwt>` when provided."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        current_user = scope.get("user")
        if current_user and current_user.is_authenticated:
            return await self.app(scope, receive, send)

        query_string = scope.get("query_string", b"").decode("utf-8")
        params = parse_qs(query_string)
        token_values = params.get("token", [])
        raw_token = token_values[0] if token_values else ""

        if raw_token:
            try:
                scope["user"] = await _get_user_from_token(raw_token)
            except (TokenError, AuthenticationFailed, ValueError, TypeError):
                scope["user"] = AnonymousUser()
        else:
            scope["user"] = AnonymousUser()

        return await self.app(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """Combine session auth middleware with query-token JWT authentication."""
    return AuthMiddlewareStack(QueryStringJWTAuthMiddleware(inner))
