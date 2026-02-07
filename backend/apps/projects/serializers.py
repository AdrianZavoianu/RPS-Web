"""
Project data serializers for stories, load cases, and elements.
"""
from rest_framework import serializers

from .models import Element, LoadCase, Project, Story


class StorySerializer(serializers.ModelSerializer):
    """Serializer for building stories."""

    class Meta:
        model = Story
        fields = ['id', 'name', 'elevation', 'sort_order']
        read_only_fields = ['id']


class LoadCaseSerializer(serializers.ModelSerializer):
    """Serializer for load cases."""

    class Meta:
        model = LoadCase
        fields = ['id', 'name', 'case_type', 'description']
        read_only_fields = ['id']


class ElementSerializer(serializers.ModelSerializer):
    """Serializer for structural elements."""
    story_name = serializers.CharField(source='story.name', read_only=True)

    class Meta:
        model = Element
        fields = ['id', 'element_type', 'name', 'unique_name', 'story', 'story_name']
        read_only_fields = ['id']


class ProjectDataSerializer(serializers.ModelSerializer):
    """Serializer for full project data including related objects."""
    name = serializers.CharField(source='catalog_project.name', read_only=True)
    slug = serializers.CharField(source='catalog_project.slug', read_only=True)
    stories = StorySerializer(many=True, read_only=True)
    load_cases = LoadCaseSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = ['id', 'name', 'slug', 'created_at', 'updated_at', 'stories', 'load_cases']
        read_only_fields = ['id', 'created_at', 'updated_at']
