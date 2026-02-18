"""
Results serializers for result sets and result data.
"""
from rest_framework import serializers

from config.result_types import RESULT_TYPE_CONFIG

from .models import (
    ComparisonSet,
    ResultCategory,
    ResultSet,
    StoryAcceleration,
    StoryDisplacement,
    StoryDrift,
    StoryForce,
)

VALID_COMPARISON_RESULT_TYPES = frozenset(RESULT_TYPE_CONFIG.keys())


class ResultCategorySerializer(serializers.ModelSerializer):
    """Serializer for result categories."""

    class Meta:
        model = ResultCategory
        fields = ["id", "category_name", "category_type"]
        read_only_fields = ["id"]


class ResultSetSerializer(serializers.ModelSerializer):
    """Serializer for result sets."""

    categories = ResultCategorySerializer(many=True, read_only=True)
    has_pushover_cases = serializers.SerializerMethodField()

    def get_has_pushover_cases(self, obj) -> bool:
        annotated_value = getattr(obj, "has_pushover_cases", None)
        if annotated_value is not None:
            return bool(annotated_value)
        return obj.pushover_cases.exists()

    class Meta:
        model = ResultSet
        fields = [
            "id",
            "name",
            "description",
            "analysis_type",
            "has_pushover_cases",
            "created_at",
            "categories",
        ]
        read_only_fields = ["id", "created_at"]


class ComparisonSetSerializer(serializers.ModelSerializer):
    """Serializer for comparison sets."""

    result_set_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        required=True,
    )
    result_types = serializers.ListField(
        child=serializers.CharField(trim_whitespace=True),
        allow_empty=False,
        required=True,
    )

    def _get_project(self):
        if self.instance is not None:
            return self.instance.project

        project = self.context.get("project")
        if project is not None:
            return project

        view = self.context.get("view")
        if view is not None and hasattr(view, "get_project"):
            return view.get_project()

        return None

    def validate_result_set_ids(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("Select at least 2 result sets.")
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Duplicate result_set_ids are not allowed.")
        return value

    def validate_result_types(self, value):
        normalized_types = []
        for result_type in value:
            normalized_type = result_type.strip()
            if normalized_type == "":
                raise serializers.ValidationError("Result types cannot contain blank values.")
            normalized_types.append(normalized_type)

        if len(set(normalized_types)) != len(normalized_types):
            raise serializers.ValidationError("Duplicate result_types are not allowed.")

        invalid_types = sorted(set(normalized_types) - VALID_COMPARISON_RESULT_TYPES)
        if invalid_types:
            invalid_types_display = ", ".join(invalid_types)
            raise serializers.ValidationError(
                f"Unsupported result_types: {invalid_types_display}"
            )

        return normalized_types

    def validate(self, attrs):
        attrs = super().validate(attrs)

        project = self._get_project()
        if project is None:
            raise serializers.ValidationError(
                {"project": "Project context is required for comparison-set validation."}
            )

        result_set_ids = attrs.get(
            "result_set_ids",
            self.instance.result_set_ids if self.instance is not None else None,
        )
        if result_set_ids is None:
            raise serializers.ValidationError({"result_set_ids": "This field is required."})

        existing_ids = set(
            ResultSet.objects.filter(
                project=project,
                id__in=result_set_ids,
            ).values_list("id", flat=True)
        )
        invalid_result_set_ids = [
            result_set_id for result_set_id in result_set_ids if result_set_id not in existing_ids
        ]
        if invalid_result_set_ids:
            invalid_ids_display = ", ".join(str(result_set_id) for result_set_id in invalid_result_set_ids)
            raise serializers.ValidationError(
                {
                    "result_set_ids": (
                        "All result_set_ids must belong to the current project. "
                        f"Invalid IDs: {invalid_ids_display}"
                    )
                }
            )

        return attrs

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
