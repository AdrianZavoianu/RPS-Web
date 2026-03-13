"""Global/story-level result views."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ..api import GlobalResultsQuerySerializer
from ..services.data_assembler import dataset_to_response

from .mixins import ProjectResultsMixin


class GlobalResultsDataView(ProjectResultsMixin, APIView):
    """
    Get global/story-level results from cache in display-ready format.

    Query params:
    - result_set_id: Required. Result set ID
    - result_type: Required. 'Drifts', 'Accelerations', 'Forces', 'Displacements'
    - direction: Required. 'X', 'Y', 'UX', 'UY', 'VX', 'VY'
    - is_pushover: Optional. If 'true', skip summary columns
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        params = self.validate_query_params(GlobalResultsQuerySerializer)

        service = self.get_result_service()
        dataset = service.get_global_results(
            result_set_id=params["result_set_id"],
            result_type=params["result_type"],
            direction=params["direction"],
            is_pushover=params["is_pushover"],
        )

        if not dataset:
            return Response({"rows": [], "load_case_columns": [], "meta": None})

        return Response(
            dataset_to_response(
                dataset=dataset,
                include_summary=not params["is_pushover"],
                fixed_columns=[dataset.story_column],
                required_columns=[dataset.story_column],
            )
        )
