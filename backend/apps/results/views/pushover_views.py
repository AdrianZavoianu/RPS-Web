"""Pushover-specific result views."""

from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ..api import PushoverCasesQuerySerializer, PushoverCurvesBatchQuerySerializer
from ..models import PushoverCase
from ..services.pushover_service import get_curve_data_for_case, get_curves_batch_data
from .mixins import ProjectResultsMixin


class PushoverCasesView(ProjectResultsMixin, APIView):
    """
    Get pushover cases for a result set.

    Query params:
    - result_set_id: Optional
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        params = self.validate_query_params(PushoverCasesQuerySerializer)
        project = self.get_project()

        queryset = PushoverCase.objects.filter(project=project)
        result_set_id = params.get("result_set_id")
        if result_set_id is not None:
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
        return Response(get_curve_data_for_case(case))


class PushoverCurvesBatchView(ProjectResultsMixin, APIView):
    """
    Get all pushover curves for a result set and direction in a single request.

    Query params:
    - result_set_id: Required
    - direction: Required ('X' / 'Y' / 'XY')
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        params = self.validate_query_params(PushoverCurvesBatchQuerySerializer)
        project = self.get_project()
        curves = get_curves_batch_data(
            project=project,
            result_set_id=params["result_set_id"],
            direction=params["direction"],
        )
        return Response({"curves": curves})
