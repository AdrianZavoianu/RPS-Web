"""Comparison and max/min envelope views."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .mixins import ProjectResultsMixin


class MaxMinDataView(ProjectResultsMixin, APIView):
    """
    Get max/min envelope data.

    Query params:
    - result_set_id: Required
    - result_type: Required. 'Drifts', 'Accelerations', 'Forces', 'Displacements'
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        result_set_id = request.query_params.get('result_set_id')
        result_type = request.query_params.get('result_type', 'Drifts')

        if not result_set_id:
            return Response(
                {'error': 'result_set_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = self.get_result_service()
        dataset = service.get_maxmin_dataset(
            result_set_id=int(result_set_id),
            base_result_type=result_type,
        )

        if not dataset:
            return Response({'rows': [], 'directions': [], 'meta': None})

        return Response(dataset.to_dict())


class ComparisonDataView(ProjectResultsMixin, APIView):
    """
    Get comparison data across multiple result sets.

    Query params:
    - result_set_ids: Required. Comma-separated list of result set IDs
    - result_type: Required
    - direction: Optional
    - metric: Optional. 'Avg', 'Max', 'Min' (default: 'Avg')
    - element_id: Optional. For element comparisons
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        result_set_ids_str = request.query_params.get('result_set_ids', '')
        result_type = request.query_params.get('result_type')
        direction = request.query_params.get('direction')
        metric = request.query_params.get('metric', 'Avg')
        element_id = request.query_params.get('element_id')

        if not result_set_ids_str or not result_type:
            return Response(
                {'error': 'result_set_ids and result_type are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result_set_ids = [int(x.strip()) for x in result_set_ids_str.split(',')]
        except ValueError:
            return Response(
                {'error': 'result_set_ids must be comma-separated integers'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = self.get_result_service()
        dataset = service.get_comparison_dataset(
            result_type=result_type,
            direction=direction,
            result_set_ids=result_set_ids,
            metric=metric,
            element_id=int(element_id) if element_id else None,
        )

        if not dataset:
            return Response({'rows': [], 'series': [], 'warnings': []})

        return Response(dataset.to_dict())

