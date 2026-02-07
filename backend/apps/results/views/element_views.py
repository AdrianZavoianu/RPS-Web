"""Element-level result views."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .mixins import ProjectResultsMixin


class ElementResultsDataView(ProjectResultsMixin, APIView):
    """
    Get element-level results from cache.

    Query params:
    - result_set_id: Required
    - element_id: Required
    - result_type: Required. 'WallShears', 'ColumnShears', 'ColumnRotations', etc.
    - direction: Optional. 'V2', 'V3', 'R2', 'R3'
    - is_pushover: Optional
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        params = self.validate_result_params(
            request,
            ('result_set_id', 'element_id', 'result_type'),
        )
        if isinstance(params, Response):
            return params

        direction = request.query_params.get('direction')
        is_pushover = request.query_params.get('is_pushover', '').lower() == 'true'

        service = self.get_result_service()
        dataset = service.get_element_results(
            result_set_id=int(params['result_set_id']),
            element_id=int(params['element_id']),
            result_type=params['result_type'],
            direction=direction,
            is_pushover=is_pushover,
        )

        if not dataset:
            return Response({'rows': [], 'load_case_columns': [], 'meta': None})

        return Response(dataset.to_dict())


class ElementListView(ProjectResultsMixin, APIView):
    """
    Get list of elements with results for a given result type.

    Query params:
    - result_set_id: Required
    - result_type: Required
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        params = self.validate_result_params(
            request,
            ('result_set_id', 'result_type'),
        )
        if isinstance(params, Response):
            return params

        service = self.get_result_service()
        elements = service.get_all_elements_for_type(
            result_set_id=int(params['result_set_id']),
            result_type=params['result_type'],
        )

        return Response({'elements': elements})

