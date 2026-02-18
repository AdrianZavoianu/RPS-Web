"""
Catalog views for project listing and management.
"""
from django.db.models import Count, Exists, OuterRef
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.projects.models import Project

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
    lookup_field = "slug"

    def get_queryset(self):
        """Return projects owned by the current user."""
        project_exists_subquery = Project.objects.filter(catalog_project_id=OuterRef("pk"))
        return (
            CatalogProject.objects.filter(owner=self.request.user)
            .select_related("owner", "project_data")
            .annotate(
                has_data=Exists(project_exists_subquery),
                story_count=Count("project_data__stories", distinct=True),
                load_case_count=Count("project_data__load_cases", distinct=True),
                element_count=Count("project_data__elements", distinct=True),
                result_set_count=Count("project_data__result_sets", distinct=True),
            )
        )

    def get_serializer_class(self):
        if self.action == "create":
            return CatalogProjectCreateSerializer
        if self.action in ["retrieve", "update", "partial_update"]:
            return CatalogProjectDetailSerializer
        return CatalogProjectSerializer

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"])
    def open(self, request, slug=None):
        """Mark project as opened (updates last_opened timestamp)."""
        project = self.get_object()
        project.last_opened = timezone.now()
        project.save(update_fields=["last_opened"])
        return Response({"status": "opened"})

    @action(detail=True, methods=["post"])
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
