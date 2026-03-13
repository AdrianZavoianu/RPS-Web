"""Middleware for request/response correlation-id propagation."""

from __future__ import annotations

import re
import uuid

from .errors import CORRELATION_HEADER

_CORRELATION_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$")


class CorrelationIdMiddleware:
    """Attach a stable correlation id to each request/response cycle."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        correlation_id = self._resolve_correlation_id(request)
        request.correlation_id = correlation_id
        response = self.get_response(request)
        response[CORRELATION_HEADER] = correlation_id
        return response

    @staticmethod
    def _resolve_correlation_id(request) -> str:
        raw_value = request.META.get("HTTP_X_CORRELATION_ID", "")
        if isinstance(raw_value, str):
            normalized = raw_value.strip()
            if normalized and _CORRELATION_ID_PATTERN.fullmatch(normalized):
                return normalized
        return str(uuid.uuid4())
