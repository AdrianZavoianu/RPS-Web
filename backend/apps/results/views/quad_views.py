"""Quad-specific result data views."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ..api import QuadRotationsQuerySerializer

from .mixins import ProjectResultsMixin


class QuadRotationsPlotDataView(ProjectResultsMixin, APIView):
    """
    Get all-quad rotation data for scatter and histogram views.

    Query params:
    - result_set_id: Required
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        params = self.validate_query_params(QuadRotationsQuerySerializer)
        result_set_id = params["result_set_id"]

        service = self.get_result_service()
        payload = service.get_quad_rotations_plot_data(result_set_id=result_set_id)
        if not payload:
            return Response(
                {
                    "meta": {
                        "result_type": "AllQuadRotations",
                        "result_set_id": result_set_id,
                        "unit": "%",
                        "x_label": "Quad Rotation (%)",
                    },
                    "stories": [],
                    "directions": [],
                    "max_points": [],
                    "min_points": [],
                    "histogram_bins": [],
                }
            )
        return Response(payload)
