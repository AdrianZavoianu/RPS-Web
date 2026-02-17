"""ViewSets for result-set management endpoints."""

from django.db.models import Exists, OuterRef
from rest_framework import permissions, viewsets

from ..models import ComparisonSet, PushoverCase, ResultSet
from ..serializers import ComparisonSetSerializer, ResultSetSerializer
from .mixins import ProjectResultsMixin


class ResultSetViewSet(ProjectResultsMixin, viewsets.ModelViewSet):
    """ViewSet for managing result sets."""

    serializer_class = ResultSetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project = self.get_project()
        pushover_cases_qs = PushoverCase.objects.filter(
            project=project,
            result_set_id=OuterRef("pk"),
        )
        return (
            ResultSet.objects.filter(project=project)
            .prefetch_related("categories")
            .annotate(has_pushover_cases=Exists(pushover_cases_qs))
        )

    def perform_create(self, serializer):
        serializer.save(project=self.get_project())


class ComparisonSetViewSet(ProjectResultsMixin, viewsets.ModelViewSet):
    """ViewSet for managing comparison sets."""

    serializer_class = ComparisonSetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ComparisonSet.objects.filter(project=self.get_project())

    def perform_create(self, serializer):
        serializer.save(project=self.get_project())
