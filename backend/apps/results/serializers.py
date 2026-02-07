"""
Results serializers for result sets and result data.
"""
from rest_framework import serializers

from .models import (
    ComparisonSet,
    ResultCategory,
    ResultSet,
    StoryAcceleration,
    StoryDisplacement,
    StoryDrift,
    StoryForce,
)


class ResultCategorySerializer(serializers.ModelSerializer):
    """Serializer for result categories."""

    class Meta:
        model = ResultCategory
        fields = ["id", "category_name", "category_type"]
        read_only_fields = ["id"]


class ResultSetSerializer(serializers.ModelSerializer):
    """Serializer for result sets."""

    categories = ResultCategorySerializer(many=True, read_only=True)

    class Meta:
        model = ResultSet
        fields = ["id", "name", "description", "analysis_type", "created_at", "categories"]
        read_only_fields = ["id", "created_at"]


class ComparisonSetSerializer(serializers.ModelSerializer):
    """Serializer for comparison sets."""

    class Meta:
        model = ComparisonSet
        fields = ["id", "name", "description", "result_set_ids", "result_types", "created_at"]
        read_only_fields = ["id", "created_at"]


# Global result serializers
class StoryDriftSerializer(serializers.ModelSerializer):
    """Serializer for story drift results."""

    story_name = serializers.CharField(source="story.name", read_only=True)
    load_case_name = serializers.CharField(source="load_case.name", read_only=True)

    class Meta:
        model = StoryDrift
        fields = [
            "id",
            "story",
            "story_name",
            "load_case",
            "load_case_name",
            "direction",
            "drift",
            "max_drift",
            "min_drift",
            "story_sort_order",
        ]


class StoryAccelerationSerializer(serializers.ModelSerializer):
    """Serializer for story acceleration results."""

    story_name = serializers.CharField(source="story.name", read_only=True)
    load_case_name = serializers.CharField(source="load_case.name", read_only=True)

    class Meta:
        model = StoryAcceleration
        fields = [
            "id",
            "story",
            "story_name",
            "load_case",
            "load_case_name",
            "direction",
            "acceleration",
            "max_acceleration",
            "min_acceleration",
            "story_sort_order",
        ]


class StoryForceSerializer(serializers.ModelSerializer):
    """Serializer for story force results."""

    story_name = serializers.CharField(source="story.name", read_only=True)
    load_case_name = serializers.CharField(source="load_case.name", read_only=True)

    class Meta:
        model = StoryForce
        fields = [
            "id",
            "story",
            "story_name",
            "load_case",
            "load_case_name",
            "direction",
            "location",
            "force",
            "max_force",
            "min_force",
            "story_sort_order",
        ]


class StoryDisplacementSerializer(serializers.ModelSerializer):
    """Serializer for story displacement results."""

    story_name = serializers.CharField(source="story.name", read_only=True)
    load_case_name = serializers.CharField(source="load_case.name", read_only=True)

    class Meta:
        model = StoryDisplacement
        fields = [
            "id",
            "story",
            "story_name",
            "load_case",
            "load_case_name",
            "direction",
            "displacement",
            "max_displacement",
            "min_displacement",
            "story_sort_order",
        ]
