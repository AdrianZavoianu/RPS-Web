"""Comparison and max/min envelope views."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ..api import ComparisonDataQuerySerializer, MaxMinDataQuerySerializer
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
        params = self.validate_query_params(MaxMinDataQuerySerializer)

        service = self.get_result_service()
        dataset = service.get_maxmin_dataset(
            result_set_id=params["result_set_id"],
            base_result_type=params["result_type"],
            element_id=params.get("element_id"),
        )

        if not dataset:
            return Response({"rows": [], "directions": [], "meta": None})

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
        params = self.validate_query_params(ComparisonDataQuerySerializer)

        service = self.get_result_service()
        dataset = service.get_comparison_dataset(
            result_type=params["result_type"],
            direction=params.get("direction"),
            result_set_ids=params["result_set_ids"],
            metric=params["metric"],
            element_id=params.get("element_id"),
        )

        if not dataset:
            return Response({"rows": [], "series": [], "warnings": []})

        return Response(dataset.to_dict())
