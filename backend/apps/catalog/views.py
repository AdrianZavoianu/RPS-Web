"""
Catalog views for project listing and management.
"""
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import CatalogProject
from .serializers import (
    CatalogProjectCreateSerializer,
    CatalogProjectDetailSerializer,
    CatalogProjectSerializer,
)


class IsOwner(permissions.BasePermission):
    """Permission to only allow owners to modify their projects."""

    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user


class CatalogProjectViewSet(viewsets.ModelViewSet):
    """
    ViewSet for catalog project CRUD operations.

    list: GET /api/projects/
    create: POST /api/projects/
    retrieve: GET /api/projects/{slug}/
    update: PUT /api/projects/{slug}/
    partial_update: PATCH /api/projects/{slug}/
    destroy: DELETE /api/projects/{slug}/
    """
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    lookup_field = 'slug'

    def get_queryset(self):
        """Return projects owned by the current user."""
        return CatalogProject.objects.filter(
            owner=self.request.user
        ).select_related('owner').prefetch_related('project_data')

    def get_serializer_class(self):
        if self.action == 'create':
            return CatalogProjectCreateSerializer
        if self.action in ['retrieve', 'update', 'partial_update']:
            return CatalogProjectDetailSerializer
        return CatalogProjectSerializer

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=['post'])
    def open(self, request, slug=None):
        """Mark project as opened (updates last_opened timestamp)."""
        project = self.get_object()
        project.last_opened = timezone.now()
        project.save(update_fields=['last_opened'])
        return Response({'status': 'opened'})

    @action(detail=True, methods=['post'])
    def duplicate(self, request, slug=None):
        """Create a copy of the project."""
        original = self.get_object()

        # Find unique name
        base_name = f"{original.name} (Copy)"
        name = base_name
        counter = 1
        while CatalogProject.objects.filter(owner=request.user, name=name).exists():
            name = f"{base_name} {counter}"
            counter += 1

        # Create catalog entry
        new_catalog = CatalogProject.objects.create(
            owner=request.user,
            name=name,
            description=original.description,
            analysis_type=original.analysis_type,
        )

        # Create empty project data container
        from apps.projects.models import Project
        Project.objects.create(catalog_project=new_catalog)

        serializer = CatalogProjectDetailSerializer(new_catalog)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
