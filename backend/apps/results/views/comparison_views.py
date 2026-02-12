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
        result_set_id = request.query_params.get("result_set_id")
        result_type = request.query_params.get("result_type", "Drifts")
        element_id = request.query_params.get("element_id")

        if not result_set_id:
            return Response(
                {"error": "result_set_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        parsed_result_set_id = self.parse_int_param(result_set_id, "result_set_id")
        if isinstance(parsed_result_set_id, Response):
            return parsed_result_set_id

        parsed_element_id = None
        if element_id:
            parsed_element_id = self.parse_int_param(element_id, "element_id")
            if isinstance(parsed_element_id, Response):
                return parsed_element_id

        service = self.get_result_service()
        dataset = service.get_maxmin_dataset(
            result_set_id=parsed_result_set_id,
            base_result_type=result_type,
            element_id=parsed_element_id,
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
        result_set_ids_str = request.query_params.get("result_set_ids", "")
        result_type = request.query_params.get("result_type")
        direction = request.query_params.get("direction")
        metric = request.query_params.get("metric", "Avg")
        element_id = request.query_params.get("element_id")

        if not result_set_ids_str or not result_type:
            return Response(
                {"error": "result_set_ids and result_type are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if metric not in {"Avg", "Max", "Min"}:
            return Response(
                {"error": "metric must be one of: Avg, Max, Min"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result_set_ids = self.parse_int_list_param(result_set_ids_str, "result_set_ids")
        if isinstance(result_set_ids, Response):
            return result_set_ids
        if len(result_set_ids) < 2:
            return Response(
                {"error": "result_set_ids must include at least 2 IDs"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        parsed_element_id = None
        if element_id:
            parsed_element_id = self.parse_int_param(element_id, "element_id")
            if isinstance(parsed_element_id, Response):
                return parsed_element_id

        service = self.get_result_service()
        dataset = service.get_comparison_dataset(
            result_type=result_type,
            direction=direction,
            result_set_ids=result_set_ids,
            metric=metric,
            element_id=parsed_element_id,
        )

        if not dataset:
            return Response({"rows": [], "series": [], "warnings": []})

        return Response(dataset.to_dict())
