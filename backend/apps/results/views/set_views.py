"""ViewSets for result-set management endpoints."""

from rest_framework import permissions, viewsets

from ..models import ComparisonSet, ResultSet
from ..serializers import ComparisonSetSerializer, ResultSetSerializer
from .mixins import ProjectResultsMixin


class ResultSetViewSet(ProjectResultsMixin, viewsets.ModelViewSet):
    """ViewSet for managing result sets."""

    serializer_class = ResultSetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ResultSet.objects.filter(project=self.get_project()).prefetch_related("categories")

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
