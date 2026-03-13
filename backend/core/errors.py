"""Shared API error-envelope helpers and DRF exception handling."""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

from rest_framework.exceptions import ErrorDetail, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

CORRELATION_HEADER = "X-Correlation-ID"


def get_request_correlation_id(request: Any) -> str | None:
    """Return correlation id attached by middleware, if present."""
    if request is None:
        return None
    raw_value = getattr(request, "correlation_id", None)
    if isinstance(raw_value, str):
        normalized = raw_value.strip()
        if normalized:
            return normalized
    return None


def _normalize_error_data(payload: Any) -> Any:
    """Convert DRF ErrorDetail nodes into plain JSON-serializable strings."""
    if isinstance(payload, ErrorDetail):
        return str(payload)
    if isinstance(payload, dict):
        return {key: _normalize_error_data(value) for key, value in payload.items()}
    if isinstance(payload, (list, tuple)):
        return [_normalize_error_data(value) for value in payload]
    return payload


def _extract_error_message(payload: Any) -> str:
    """Extract a stable message string from nested error payloads."""
    if isinstance(payload, str):
        normalized = payload.strip()
        return normalized if normalized else "Request failed"
    if isinstance(payload, list):
        for item in payload:
            message = _extract_error_message(item)
            if message != "Request failed":
                return message
        return "Request failed"
    if isinstance(payload, dict):
        for key in ("message", "detail", "non_field_errors", "error"):
            if key in payload:
                message = _extract_error_message(payload[key])
                if message != "Request failed":
                    return message
        for value in payload.values():
            message = _extract_error_message(value)
            if message != "Request failed":
                return message
    return "Request failed"


def _extract_code(payload: Any) -> str | None:
    if isinstance(payload, str):
        normalized = payload.strip().lower()
        if normalized:
            return normalized
        return None
    if isinstance(payload, list):
        for item in payload:
            code = _extract_code(item)
            if code:
                return code
        return None
    if isinstance(payload, dict):
        for value in payload.values():
            code = _extract_code(value)
            if code:
                return code
    return None


def _default_status_code_label(status_code: int) -> str:
    try:
        return HTTPStatus(status_code).name.lower()
    except ValueError:
        return "error"


def resolve_error_code(exc: Exception, status_code: int) -> str:
    """Resolve a stable machine-readable error code."""
    if isinstance(exc, ValidationError):
        return "validation_error"

    if hasattr(exc, "get_codes"):
        candidate = _extract_code(exc.get_codes())
        if candidate:
            return candidate

    default_code = getattr(exc, "default_code", None)
    if isinstance(default_code, str):
        normalized = default_code.strip().lower()
        if normalized:
            return normalized

    return _default_status_code_label(status_code)


def build_error_envelope(
    *,
    code: str,
    message: str,
    status_code: int,
    correlation_id: str | None = None,
    details: Any = None,
) -> dict[str, Any]:
    """Build the standardized API error envelope."""
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "status": status_code,
        }
    }
    if correlation_id:
        payload["error"]["correlation_id"] = correlation_id
    if details is not None:
        payload["error"]["details"] = details
    return payload


def api_error_response(
    *,
    request: Any,
    status_code: int,
    code: str,
    message: str,
    details: Any = None,
) -> Response:
    """Return a response with the standardized error envelope."""
    correlation_id = get_request_correlation_id(request)
    envelope = build_error_envelope(
        code=code,
        message=message,
        status_code=status_code,
        correlation_id=correlation_id,
        details=details,
    )
    payload: dict[str, Any]
    if isinstance(details, dict):
        payload = dict(details)
        payload["detail"] = payload.get("detail", message)
    else:
        payload = {"detail": message}
        if details is not None:
            payload["details"] = details

    payload.update(envelope)
    response = Response(payload, status=status_code)
    if correlation_id:
        response[CORRELATION_HEADER] = correlation_id
    return response


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Wrap DRF errors in the standardized API error envelope."""
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    request = context.get("request")
    correlation_id = get_request_correlation_id(request)

    # Preserve already-shaped envelopes and only inject correlation id/header.
    if isinstance(response.data, dict):
        existing_error = response.data.get("error")
        if isinstance(existing_error, dict) and {
            "code",
            "message",
            "status",
        }.issubset(existing_error):
            if correlation_id and not existing_error.get("correlation_id"):
                existing_error["correlation_id"] = correlation_id
            if correlation_id:
                response[CORRELATION_HEADER] = correlation_id
            return response

    normalized_details = _normalize_error_data(response.data)
    message = _extract_error_message(normalized_details)
    envelope = build_error_envelope(
        code=resolve_error_code(exc, response.status_code),
        message=message,
        status_code=response.status_code,
        correlation_id=correlation_id,
        details=normalized_details,
    )

    if isinstance(normalized_details, dict):
        merged_payload = dict(normalized_details)
        merged_payload["detail"] = merged_payload.get("detail", message)
        merged_payload.update(envelope)
        response.data = merged_payload
    elif isinstance(normalized_details, list):
        response.data = {
            "detail": message,
            "details": normalized_details,
            **envelope,
        }
    else:
        response.data = {
            "detail": message,
            **envelope,
        }

    if correlation_id:
        response[CORRELATION_HEADER] = correlation_id
    return response
