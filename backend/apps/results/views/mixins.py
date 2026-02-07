"""Shared mixins and discovery views for results endpoints."""

from typing import Sequence

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.mixins import ProjectLookupMixin

from ..models import (
    StoryAcceleration,
    StoryDisplacement,
    StoryDrift,
    StoryForce,
    WallShear,
    QuadRotation,
    ColumnShear,
    ColumnAxial,
    ColumnRotation,
    BeamRotation,
    SoilPressure,
    VerticalDisplacement,
    PushoverCase,
)
from ..services import ResultDataService, RESULT_TYPE_CONFIG


GLOBAL_AVAILABILITY_MAP = {
    "Drifts": (StoryDrift, "story__project"),
    "Accelerations": (StoryAcceleration, "story__project"),
    "Forces": (StoryForce, "story__project"),
    "Displacements": (StoryDisplacement, "story__project"),
}

ELEMENT_AVAILABILITY_MAP = {
    "WallShears": (WallShear, "element__project"),
    "QuadRotations": (QuadRotation, "element__project"),
    "ColumnShears": (ColumnShear, "element__project"),
    "ColumnAxials": (ColumnAxial, "element__project"),
    "ColumnRotations": (ColumnRotation, "element__project"),
    "BeamRotations": (BeamRotation, "element__project"),
}

JOINT_AVAILABILITY_MAP = {
    "SoilPressures": (SoilPressure, "project"),
    "VerticalDisplacements": (VerticalDisplacement, "project"),
}


class ProjectResultsMixin(ProjectLookupMixin):
    """Mixin to get project from slug in URL."""

    def get_project(self):
        slug = self.kwargs.get("project_slug")
        return self.get_project_for_slug(slug, create_if_missing=False)

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
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)

        return params

    def get_result_service(self):
        """Get ResultDataService for the project."""
        return ResultDataService(self.get_project())


class AvailableResultTypesView(ProjectResultsMixin, APIView):
    """Get available result types for a project."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        project = self.get_project()

        global_results = []
        element_results = []
        joint_results = []

        for type_name, (model_class, project_field) in GLOBAL_AVAILABILITY_MAP.items():
            if not model_class.objects.filter(**{project_field: project}).exists():
                continue
            config = RESULT_TYPE_CONFIG[type_name]
            global_results.append(
                {
                    "type": type_name,
                    "directions": config["directions"],
                    "unit": config["unit"],
                }
            )

        for type_name, (model_class, project_field) in ELEMENT_AVAILABILITY_MAP.items():
            if not model_class.objects.filter(**{project_field: project}).exists():
                continue
            config = RESULT_TYPE_CONFIG[type_name]
            element_results.append(
                {
                    "type": type_name,
                    "directions": config["directions"],
                    "unit": config["unit"],
                }
            )

        for type_name, (model_class, project_field) in JOINT_AVAILABILITY_MAP.items():
            if not model_class.objects.filter(**{project_field: project}).exists():
                continue
            joint_results.append(
                {
                    "type": type_name,
                    "unit": RESULT_TYPE_CONFIG[type_name]["unit"],
                }
            )

        has_pushover = PushoverCase.objects.filter(project=project).exists()

        return Response(
            {
                "global_results": global_results,
                "element_results": element_results,
                "joint_results": joint_results,
                "has_pushover": has_pushover,
                "config": RESULT_TYPE_CONFIG,
            }
        )
