"""Beam-specific result data views."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .mixins import ProjectResultsMixin


class BeamRotationsPlotDataView(ProjectResultsMixin, APIView):
    """
    Get all-beam R3 plastic rotation data for scatter and histogram views.

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
        payload = service.get_beam_rotations_plot_data(result_set_id=result_set_id)
        if not payload:
            return Response(
                {
                    "meta": {
                        "result_type": "AllBeamRotations",
                        "result_set_id": result_set_id,
                        "unit": "%",
                        "x_label": "R3 Plastic Rotation (%)",
                    },
                    "stories": [],
                    "max_points": [],
                    "min_points": [],
                    "histogram_bins": [],
                }
            )
        return Response(payload)


class BeamRotationsTableDataView(ProjectResultsMixin, APIView):
    """
    Get all-beam R3 plastic rotation table data.

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
        payload = service.get_beam_rotations_table_data(result_set_id=result_set_id)
        if not payload:
            return Response(
                {
                    "meta": {
                        "result_type": "BeamRotationsTable",
                        "result_set_id": result_set_id,
                        "unit": "%",
                    },
                    "columns": [],
                    "rows": [],
                    "fixed_columns": [],
                    "load_case_columns": [],
                    "summary_columns": [],
                }
            )
        return Response(payload)

