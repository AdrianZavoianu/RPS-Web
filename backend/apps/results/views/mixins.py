"""Shared mixins and discovery views for results endpoints."""

from typing import Type

from rest_framework import permissions
from rest_framework.serializers import Serializer
from rest_framework.response import Response
from rest_framework.views import APIView

from core.mixins import ProjectLookupMixin

from ..services import ResultDataService
from ..services.availability_service import get_available_result_types_payload


class ProjectResultsMixin(ProjectLookupMixin):
    """Mixin to get project from slug in URL."""

    def get_project(self):
        project_slug = self.kwargs.get("project_slug")
        return self.get_project_for_slug(
            project_slug,
            create_if_missing=False,
            user=self.request.user,
        )

    def get_result_service(self):
        """Get ResultDataService for the project."""
        return ResultDataService(self.get_project())

    def validate_query_params(self, serializer_class: Type[Serializer]):
        """Validate query params through a DRF serializer contract."""
        serializer = serializer_class(
            data=self.request.query_params,
            context={
                "project": self.get_project(),
                "request": self.request,
                "view": self,
            },
        )
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data


class AvailableResultTypesView(ProjectResultsMixin, APIView):
    """Get available result types for a project."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        project = self.get_project()
        return Response(get_available_result_types_payload(project))
