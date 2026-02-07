"""
Catalog serializers for project listing and management.
"""
from rest_framework import serializers

from apps.projects.models import Project

from .models import CatalogProject


class CatalogProjectSerializer(serializers.ModelSerializer):
    """Serializer for project catalog entries."""
    has_data = serializers.SerializerMethodField()
    story_count = serializers.SerializerMethodField()
    load_case_count = serializers.SerializerMethodField()

    class Meta:
        model = CatalogProject
        fields = [
            'id', 'name', 'slug', 'description', 'analysis_type',
            'created_at', 'updated_at', 'last_opened',
            'has_data', 'story_count', 'load_case_count'
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at', 'last_opened']

    def get_has_data(self, obj):
        return hasattr(obj, 'project_data')

    def get_story_count(self, obj):
        if hasattr(obj, 'project_data'):
            return obj.project_data.stories.count()
        return 0

    def get_load_case_count(self, obj):
        if hasattr(obj, 'project_data'):
            return obj.project_data.load_cases.count()
        return 0


class CatalogProjectCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new catalog projects."""

    class Meta:
        model = CatalogProject
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'analysis_type',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at']

    def create(self, validated_data):
        user = self.context['request'].user
        catalog_project = CatalogProject.objects.create(owner=user, **validated_data)
        # Also create the associated Project data container
        Project.objects.create(catalog_project=catalog_project)
        return catalog_project


class CatalogProjectDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for single project view."""
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    has_data = serializers.SerializerMethodField()
    story_count = serializers.SerializerMethodField()
    load_case_count = serializers.SerializerMethodField()
    element_count = serializers.SerializerMethodField()
    result_set_count = serializers.SerializerMethodField()

    class Meta:
        model = CatalogProject
        fields = [
            'id', 'name', 'slug', 'description', 'analysis_type',
            'owner_username', 'created_at', 'updated_at', 'last_opened',
            'has_data', 'story_count', 'load_case_count', 'element_count',
            'result_set_count'
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at', 'last_opened', 'owner_username']

    def get_has_data(self, obj):
        return hasattr(obj, 'project_data')

    def get_story_count(self, obj):
        if hasattr(obj, 'project_data'):
            return obj.project_data.stories.count()
        return 0

    def get_load_case_count(self, obj):
        if hasattr(obj, 'project_data'):
            return obj.project_data.load_cases.count()
        return 0

    def get_element_count(self, obj):
        if hasattr(obj, 'project_data'):
            return obj.project_data.elements.count()
        return 0

    def get_result_set_count(self, obj):
        if hasattr(obj, 'project_data'):
            return obj.project_data.result_sets.count()
        return 0
