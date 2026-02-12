"""Joint/foundation result views."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .mixins import ProjectResultsMixin


class JointResultsDataView(ProjectResultsMixin, APIView):
    """
    Get joint/foundation results from cache.

    Query params:
    - result_set_id: Required
    - result_type: Required. 'SoilPressures_Min', 'VerticalDisplacements_Min'
    - is_pushover: Optional
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        params = self.validate_result_params(
            request,
            ("result_set_id", "result_type"),
        )
        if isinstance(params, Response):
            return params

        is_pushover = request.query_params.get("is_pushover", "").lower() == "true"
        result_set_id = self.parse_int_param(params["result_set_id"], "result_set_id")
        if isinstance(result_set_id, Response):
            return result_set_id

        service = self.get_result_service()
        dataset = service.get_joint_results(
            result_set_id=result_set_id,
            result_type=params["result_type"],
            is_pushover=is_pushover,
        )

        if not dataset:
            return Response({"rows": [], "load_case_columns": [], "meta": None})

        return Response(dataset.to_dict())
