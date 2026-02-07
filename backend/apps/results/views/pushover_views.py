"""Pushover-specific result views."""

from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import PushoverCase, PushoverCurvePoint
from .mixins import ProjectResultsMixin


class PushoverCasesView(ProjectResultsMixin, APIView):
    """
    Get pushover cases for a result set.

    Query params:
    - result_set_id: Required
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        result_set_id = request.query_params.get("result_set_id")
        project = self.get_project()

        queryset = PushoverCase.objects.filter(project=project)
        if result_set_id:
            queryset = queryset.filter(result_set_id=result_set_id)

        cases = list(queryset.values("id", "name", "direction", "result_set_id"))
        return Response({"pushover_cases": cases})


class PushoverCurveView(ProjectResultsMixin, APIView):
    """
    Get pushover curve data for a specific case.

    URL param:
    - case_id: Pushover case ID
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug, case_id):
        project = self.get_project()

        case = get_object_or_404(PushoverCase, id=case_id, project=project)
        points = PushoverCurvePoint.objects.filter(pushover_case=case).order_by("step_number")

        curve_data = {
            "case": {
                "id": case.id,
                "name": case.name,
                "direction": case.direction,
            },
            "points": [
                {
                    "step": p.step_number,
                    "displacement": p.displacement,
                    "base_shear": p.base_shear,
                }
                for p in points
            ],
        }

        return Response(curve_data)
