"""Global/story-level result views."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    StoryAcceleration,
    StoryDisplacement,
    StoryDrift,
    StoryForce,
)
from ..serializers import (
    StoryAccelerationSerializer,
    StoryDisplacementSerializer,
    StoryDriftSerializer,
    StoryForceSerializer,
)
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
        params = self.validate_result_params(
            request,
            ("result_set_id", "result_type", "direction"),
        )
        if isinstance(params, Response):
            return params

        is_pushover = request.query_params.get("is_pushover", "").lower() == "true"

        service = self.get_result_service()
        dataset = service.get_global_results(
            result_set_id=int(params["result_set_id"]),
            result_type=params["result_type"],
            direction=params["direction"],
            is_pushover=is_pushover,
        )

        if not dataset:
            return Response({"rows": [], "load_case_columns": [], "meta": None})

        return Response(dataset.to_dict())


class GlobalResultsView(ProjectResultsMixin, APIView):
    """
    View for retrieving raw global/story-level results (not cached).
    Use GlobalResultsDataView for display-ready cached data.

    Query params:
    - result_set_id: Filter by result set
    - result_type: Type of result (Drifts, Accelerations, Forces, Displacements)
    - direction: X or Y
    - category: Envelopes or Time-Series
    """

    permission_classes = [permissions.IsAuthenticated]

    RESULT_TYPE_MAP = {
        "Drifts": (StoryDrift, StoryDriftSerializer),
        "Accelerations": (StoryAcceleration, StoryAccelerationSerializer),
        "Forces": (StoryForce, StoryForceSerializer),
        "Displacements": (StoryDisplacement, StoryDisplacementSerializer),
    }

    def get(self, request, project_slug):
        project = self.get_project()

        result_type = request.query_params.get("result_type", "Drifts")
        result_set_id = request.query_params.get("result_set_id")
        direction = request.query_params.get("direction")
        category_name = request.query_params.get("category")

        if result_type not in self.RESULT_TYPE_MAP:
            return Response(
                {"error": f"Invalid result_type: {result_type}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        model_class, serializer_class = self.RESULT_TYPE_MAP[result_type]

        queryset = model_class.objects.filter(story__project=project).select_related(
            "story", "load_case", "result_category"
        )

        if result_set_id:
            queryset = queryset.filter(result_category__result_set_id=result_set_id)

        if direction:
            queryset = queryset.filter(direction=direction)

        if category_name:
            queryset = queryset.filter(result_category__category_name=category_name)

        queryset = queryset.order_by("story_sort_order", "load_case__name")

        serializer = serializer_class(queryset, many=True)
        return Response(serializer.data)
