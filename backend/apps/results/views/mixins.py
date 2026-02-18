"""Shared mixins and discovery views for results endpoints."""

from typing import List, Sequence, Type

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.serializers import Serializer
from rest_framework.views import APIView

from core.mixins import ProjectLookupMixin

from ..application import ResultDataService
from ..services.availability_service import get_available_result_types_payload


class ProjectResultsMixin(ProjectLookupMixin):
    """Mixin to get project from slug in URL."""

    def get_project(self):
        slug = self.kwargs.get("project_slug")
        return self.get_project_for_slug(
            slug,
            create_if_missing=False,
            user=self.request.user,
        )

    def validate_result_params(self, request, required_fields: Sequence[str]):
        """Validate required query params or return HTTP 400 response."""
        params = {}
        missing = []

        for field in required_fields:
            value = request.query_params.get(field)
            if value in (None, ""):
                missing.append(field)
            else:
                params[field] = value

        if missing:
            if len(required_fields) == 1:
                message = f"{required_fields[0]} is required"
            else:
                message = f"{', '.join(required_fields)} are required"
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

        return params

    def parse_int_param(self, value, field_name: str):
        """Parse integer query/body parameter with user-facing error response."""
        try:
            return int(value)
        except (TypeError, ValueError):
            return Response(
                {"detail": f"{field_name} must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def parse_int_list_param(self, value, field_name: str) -> List[int]:
        """Parse comma-separated integer parameter with user-facing error response."""
        if value is None or value == "":
            return Response(
                {"detail": f"{field_name} is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parts = [part.strip() for part in str(value).split(",")]
        if not all(parts):
            return Response(
                {"detail": f"{field_name} must be comma-separated integers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parsed: List[int] = []
        seen = set()
        try:
            for part in parts:
                parsed_value = int(part)
                if parsed_value in seen:
                    continue
                seen.add(parsed_value)
                parsed.append(parsed_value)
        except (TypeError, ValueError):
            return Response(
                {"detail": f"{field_name} must be comma-separated integers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return parsed

    def get_result_service(self):
        """Get ResultDataService for the project."""
        return ResultDataService(self.get_project())

    def validate_query_params(self, serializer_class: Type[Serializer]):
        """Validate query params through a DRF serializer contract."""
        serializer = serializer_class(
            data=self.request.query_params,
            context={"project": self.get_project(), "request": self.request, "view": self},
        )
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data


class AvailableResultTypesView(ProjectResultsMixin, APIView):
    """Get available result types for a project."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        project = self.get_project()
        return Response(get_available_result_types_payload(project))
