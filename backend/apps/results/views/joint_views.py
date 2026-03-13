"""Joint/foundation result views."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ..api import JointResultsQuerySerializer
from ..services.data_assembler import dataset_to_response

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
        params = self.validate_query_params(JointResultsQuerySerializer)

        service = self.get_result_service()
        dataset = service.get_joint_results(
            result_set_id=params["result_set_id"],
            result_type=params["result_type"],
            is_pushover=params["is_pushover"],
        )

        if not dataset:
            return Response({"rows": [], "load_case_columns": [], "meta": None})

        return Response(
            dataset_to_response(
                dataset=dataset,
                include_summary=not params["is_pushover"],
                fixed_columns=["Shell Object", "Unique Name"],
                required_columns=["Shell Object", "Unique Name"],
            )
        )
