"""Column-specific result data views."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .mixins import ProjectResultsMixin


class ColumnRotationsPlotDataView(ProjectResultsMixin, APIView):
    """
    Get all-column rotation data for scatter and histogram views.

    Query params:
    - result_set_id: Required
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        params = self.validate_result_params(request, ("result_set_id",))
        if isinstance(params, Response):
            return params

        result_set_id = self.parse_int_param(params["result_set_id"], "result_set_id")
        if isinstance(result_set_id, Response):
            return result_set_id

        service = self.get_result_service()
        payload = service.get_column_rotations_plot_data(result_set_id=result_set_id)
        if not payload:
            return Response(
                {
                    "meta": {
                        "result_type": "AllColumnRotations",
                        "result_set_id": result_set_id,
                        "unit": "%",
                        "x_label": "Column Rotation (%)",
                    },
                    "stories": [],
                    "directions": [],
                    "max_points": [],
                    "min_points": [],
                    "histogram_bins": [],
                }
            )
        return Response(payload)
