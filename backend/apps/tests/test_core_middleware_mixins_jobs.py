"""Unit tests for shared middleware, mixins, and job events."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied
from django.http import Http404, HttpResponse
from django.test import RequestFactory

from apps.catalog.models import CatalogProject
from apps.projects.models import Project
from core.jobs.events import (
    build_job_group_name,
    calculate_percent,
    send_job_group_event,
)
from core.middleware import CorrelationIdMiddleware
from core.mixins import ProjectLookupMixin


class _DummyProjectLookupView(ProjectLookupMixin):
    request = None


def test_correlation_id_middleware_uses_valid_header_and_sets_response_header() -> None:
    request = RequestFactory().get("/", HTTP_X_CORRELATION_ID="job-123_abc")
    captured = {}

    def get_response(incoming_request):
        captured["correlation_id"] = incoming_request.correlation_id
        return HttpResponse("ok")

    middleware = CorrelationIdMiddleware(get_response)
    response = middleware(request)

    assert request.correlation_id == "job-123_abc"
    assert captured["correlation_id"] == "job-123_abc"
    assert response["X-Correlation-ID"] == "job-123_abc"


def test_correlation_id_middleware_generates_uuid_for_invalid_header() -> None:
    request = RequestFactory().get("/", HTTP_X_CORRELATION_ID="invalid header value!")
    middleware = CorrelationIdMiddleware(lambda _: HttpResponse("ok"))

    response = middleware(request)

    parsed_uuid = uuid.UUID(request.correlation_id)
    assert str(parsed_uuid) == request.correlation_id
    assert response["X-Correlation-ID"] == request.correlation_id


def test_correlation_id_middleware_trims_header_before_validation() -> None:
    request = RequestFactory().get("/", HTTP_X_CORRELATION_ID="  cid:trimmed  ")
    middleware = CorrelationIdMiddleware(lambda _: HttpResponse("ok"))

    response = middleware(request)

    assert request.correlation_id == "cid:trimmed"
    assert response["X-Correlation-ID"] == "cid:trimmed"


def test_project_lookup_mixin_resolves_user_priority(user) -> None:
    view = _DummyProjectLookupView()
    explicit_user = user

    view.request = SimpleNamespace(user=AnonymousUser())
    assert view._resolve_lookup_user(user=explicit_user) == explicit_user

    view.request = SimpleNamespace(user=explicit_user)
    assert view._resolve_lookup_user() == explicit_user

    view.request = SimpleNamespace(user=AnonymousUser())
    assert view._resolve_lookup_user() is None

    view.request = None
    assert view._resolve_lookup_user() is None


@pytest.mark.django_db
def test_get_catalog_project_requires_authenticated_user_by_default(catalog_project) -> None:
    view = _DummyProjectLookupView()
    with pytest.raises(PermissionDenied, match="Authenticated user is required"):
        view.get_catalog_project(catalog_project.slug)


@pytest.mark.django_db
def test_get_catalog_project_owner_scope_and_open_scope(user, catalog_project) -> None:
    other_user = type(user).objects.create_user(
        username="mixin-other",
        email="mixin-other@example.com",
        password="MixinOtherPass!123",
    )
    view = _DummyProjectLookupView()

    with pytest.raises(Http404):
        view.get_catalog_project(catalog_project.slug, user=other_user)

    resolved = view.get_catalog_project(catalog_project.slug, enforce_owner=False)
    assert resolved.id == catalog_project.id


@pytest.mark.django_db
def test_get_project_for_slug_returns_existing_and_can_create_missing(user) -> None:
    catalog_project = CatalogProject.objects.create(
        name="Mixin Existing Project",
        slug="mixin-existing-project",
        owner=user,
        analysis_type="NLTHA",
    )
    existing_project = Project.objects.create(catalog_project=catalog_project)
    view = _DummyProjectLookupView()

    resolved = view.get_project_for_slug(catalog_project.slug, user=user)
    assert resolved.id == existing_project.id

    missing_catalog_project = CatalogProject.objects.create(
        name="Mixin Missing Project",
        slug="mixin-missing-project",
        owner=user,
        analysis_type="NLTHA",
    )
    with pytest.raises(Http404):
        view.get_project_for_slug(missing_catalog_project.slug, user=user)

    created = view.get_project_for_slug(
        missing_catalog_project.slug,
        user=user,
        create_if_missing=True,
    )
    assert created.catalog_project_id == missing_catalog_project.id


def test_build_job_group_name_and_calculate_percent() -> None:
    assert build_job_group_name("import", 42) == "import_42"
    assert calculate_percent(current=0, total=0) == 0
    assert calculate_percent(current=3, total=2) == 150
    assert calculate_percent(current=1, total=4) == 25


def test_send_job_group_event_noops_without_channel_layer() -> None:
    with patch("core.jobs.events.get_channel_layer", return_value=None):
        send_job_group_event(
            group_name="report_1",
            event_type="job.progress",
            payload={"current": 1},
        )


def test_send_job_group_event_dispatches_payload_to_group() -> None:
    mock_layer = Mock()

    with (
        patch("core.jobs.events.get_channel_layer", return_value=mock_layer),
        patch("core.jobs.events.async_to_sync", side_effect=lambda fn: fn),
    ):
        send_job_group_event(
            group_name="export_9",
            event_type="job.progress",
            payload={"current": 3, "total": 8},
        )

    mock_layer.group_send.assert_called_once_with(
        "export_9",
        {"type": "job.progress", "current": 3, "total": 8},
    )
