"""Result metadata views."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ..api import TreeMetadataQuerySerializer
from ..application import get_result_type_metadata_contract
from ..services.tree_metadata_service import get_result_tree_metadata_payload
from .mixins import ProjectResultsMixin


class ResultTypeMetadataView(ProjectResultsMixin, APIView):
    """Expose canonical result-type metadata contract for frontend/backend consumers."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        # Project lookup enforces project ownership/access before returning contract data.
        self.get_project()
        return Response(get_result_type_metadata_contract())


class ResultTreeMetadataView(ProjectResultsMixin, APIView):
    """Return batched metadata used by tree node expansion."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_slug):
        project = self.get_project()
        serializer = TreeMetadataQuerySerializer(
            data=request.query_params,
            context={"project": project, "request": request, "view": self},
        )
        serializer.is_valid(raise_exception=True)
        params = serializer.validated_data
        payload = get_result_tree_metadata_payload(
            project=project,
            result_set_id=params["result_set_id"],
        )
        return Response(payload)
