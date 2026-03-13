"""Unit tests for shared API error-envelope helpers."""

from __future__ import annotations

from types import SimpleNamespace

from rest_framework.exceptions import APIException, ErrorDetail, ValidationError

from core.errors import (
    CORRELATION_HEADER,
    _extract_error_message,
    _normalize_error_data,
    api_error_response,
    api_exception_handler,
    build_error_envelope,
    get_request_correlation_id,
    resolve_error_code,
)


class _CodesException(Exception):
    def get_codes(self):
        return {"field": ["custom_code"]}


class _DefaultCodeException(Exception):
    default_code = " MixedCase_Code "


class _PreShapedApiException(APIException):
    status_code = 409
    default_detail = {
        "detail": "Already exists",
        "error": {
            "code": "already_exists",
            "message": "Already exists",
            "status": 409,
        },
    }


def test_get_request_correlation_id_normalizes_value() -> None:
    assert get_request_correlation_id(None) is None
    assert get_request_correlation_id(SimpleNamespace()) is None
    assert get_request_correlation_id(SimpleNamespace(correlation_id="   ")) is None
    assert get_request_correlation_id(SimpleNamespace(correlation_id="  req-123  ")) == "req-123"


def test_normalize_error_data_converts_error_detail_nodes() -> None:
    payload = {
        "field": [
            ErrorDetail("Required", code="required"),
            {"child": ErrorDetail("Invalid", code="invalid")},
        ]
    }

    assert _normalize_error_data(payload) == {
        "field": ["Required", {"child": "Invalid"}],
    }


def test_extract_error_message_prefers_meaningful_nested_text() -> None:
    payload = {"detail": "   ", "non_field_errors": ["", "Nested failure"]}
    assert _extract_error_message(payload) == "Nested failure"
    assert _extract_error_message({"something": {"else": []}}) == "Request failed"


def test_resolve_error_code_follows_priority_order() -> None:
    assert resolve_error_code(ValidationError({"field": ["Required"]}), 400) == "validation_error"
    assert resolve_error_code(_CodesException(), 400) == "custom_code"
    assert resolve_error_code(_DefaultCodeException(), 400) == "mixedcase_code"
    assert resolve_error_code(Exception(), 418) == "im_a_teapot"
    assert resolve_error_code(Exception(), 499) == "error"


def test_build_error_envelope_includes_optional_fields() -> None:
    payload = build_error_envelope(
        code="bad_request",
        message="Invalid payload",
        status_code=400,
        correlation_id="cid-1",
        details={"field": ["Required"]},
    )

    assert payload == {
        "error": {
            "code": "bad_request",
            "message": "Invalid payload",
            "status": 400,
            "correlation_id": "cid-1",
            "details": {"field": ["Required"]},
        }
    }


def test_api_error_response_merges_details_and_adds_header() -> None:
    request = SimpleNamespace(correlation_id="cid-9")

    response = api_error_response(
        request=request,
        status_code=400,
        code="bad_request",
        message="Invalid payload",
        details={"field": ["Required"]},
    )

    assert response.status_code == 400
    assert response.data["detail"] == "Invalid payload"
    assert response.data["field"] == ["Required"]
    assert response.data["error"]["code"] == "bad_request"
    assert response.data["error"]["details"] == {"field": ["Required"]}
    assert response[CORRELATION_HEADER] == "cid-9"


def test_api_error_response_handles_non_mapping_details() -> None:
    response = api_error_response(
        request=SimpleNamespace(correlation_id="cid-list"),
        status_code=422,
        code="unprocessable",
        message="Cannot parse values",
        details=["bad-row"],
    )

    assert response.status_code == 422
    assert response.data["detail"] == "Cannot parse values"
    assert response.data["details"] == ["bad-row"]
    assert response.data["error"]["details"] == ["bad-row"]


def test_api_exception_handler_returns_none_for_unhandled_exception() -> None:
    assert api_exception_handler(ValueError("boom"), {"request": None}) is None


def test_api_exception_handler_wraps_validation_error() -> None:
    request = SimpleNamespace(correlation_id="cid-val")
    response = api_exception_handler(
        ValidationError({"field": [ErrorDetail("Required", code="required")]}),
        {"request": request},
    )

    assert response is not None
    assert response.status_code == 400
    assert response.data["detail"] == "Required"
    assert response.data["error"]["code"] == "validation_error"
    assert response.data["error"]["message"] == "Required"
    assert response.data["error"]["details"] == {"field": ["Required"]}
    assert response[CORRELATION_HEADER] == "cid-val"


def test_api_exception_handler_preserves_existing_envelope() -> None:
    request = SimpleNamespace(correlation_id="cid-preserve")
    response = api_exception_handler(_PreShapedApiException(), {"request": request})

    assert response is not None
    assert response.status_code == 409
    assert response.data["error"]["code"] == "already_exists"
    assert response.data["error"]["message"] == "Already exists"
    assert int(response.data["error"]["status"]) == 409
    assert response.data["error"]["correlation_id"] == "cid-preserve"
    assert response[CORRELATION_HEADER] == "cid-preserve"


def test_api_exception_handler_handles_list_payloads() -> None:
    response = api_exception_handler(
        ValidationError([ErrorDetail("Bad item", code="invalid"), "Another"]),
        {"request": SimpleNamespace(correlation_id="cid-list")},
    )

    assert response is not None
    assert response.status_code == 400
    assert response.data["detail"] == "Bad item"
    assert response.data["details"] == ["Bad item", "Another"]
    assert response.data["error"]["message"] == "Bad item"
    assert response.data["error"]["code"] == "validation_error"
