"""
Serializers for exporter app.
"""
from rest_framework import serializers

from config.result_types import RESULT_TYPE_BASE_MAP

from .models import ExportJob

ALLOWED_GLOBAL_EXPORT_TYPES = frozenset({"Drifts", "Accelerations", "Forces", "Displacements"})
ALLOWED_ELEMENT_EXPORT_TYPES = frozenset(
    {"WallShears", "QuadRotations", "ColumnShears", "ColumnAxials", "ColumnRotations", "BeamRotations"}
)
ALLOWED_JOINT_EXPORT_TYPES = frozenset({"SoilPressures", "VerticalDisplacements"})
ALLOWED_DIRECTIONS = frozenset({"X", "Y"})

MAX_ITEMS_PER_SELECTION_FIELD = 32
MAX_EXPORT_WORK_UNITS = 80


class ExportJobSerializer(serializers.ModelSerializer):
    """Serializer for export job status."""

    download_url = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = ExportJob
        fields = [
            "id",
            "status",
            "progress",
            "export_format",
            "file_name",
            "download_url",
            "error_message",
            "created_at",
            "completed_at",
        ]

    def get_download_url(self, obj):
        if obj.status == "completed" and obj.output_file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(
                    f"/api/projects/{obj.project.slug}/exports/{obj.id}/download/"
                )
        return None

    def get_progress(self, obj):
        if obj.status == "completed":
            return 100
        elif obj.status == "failed":
            return 0
        elif obj.status == "processing":
            if (
                obj.progress_total is None
                or obj.progress_total <= 0
                or obj.progress_current is None
            ):
                raise serializers.ValidationError(
                    "Export job progress metadata is missing for processing status"
                )
            return int((obj.progress_current / obj.progress_total) * 100)
        return 0


class ExportRequestSerializer(serializers.Serializer):
    """Serializer for export request."""

    result_set_id = serializers.IntegerField()
    result_types = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    element_types = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    joint_types = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    directions = serializers.ListField(
        child=serializers.CharField(), required=False, default=["X", "Y"]
    )
    format = serializers.ChoiceField(choices=["excel", "csv"], default="excel")
    include_summary = serializers.BooleanField(default=True)

    @staticmethod
    def _normalize_unique_list(values: list[str], *, field_name: str) -> list[str]:
        normalized = [str(value).strip() for value in values]
        if any(value == "" for value in normalized):
            raise serializers.ValidationError(f"{field_name} contains blank values.")
        if len(normalized) > MAX_ITEMS_PER_SELECTION_FIELD:
            raise serializers.ValidationError(
                f"{field_name} exceeds guardrail limit ({MAX_ITEMS_PER_SELECTION_FIELD})."
            )
        duplicates = sorted(
            {
                value
                for value in normalized
                if normalized.count(value) > 1
            }
        )
        if duplicates:
            duplicate_display = ", ".join(duplicates)
            raise serializers.ValidationError(
                f"{field_name} contains duplicate values: {duplicate_display}"
            )
        return normalized

    def validate_result_types(self, value: list[str]) -> list[str]:
        normalized = self._normalize_unique_list(value, field_name="result_types")
        invalid = sorted(set(normalized) - ALLOWED_GLOBAL_EXPORT_TYPES)
        if invalid:
            invalid_display = ", ".join(invalid)
            raise serializers.ValidationError(
                f"Unsupported global result_types: {invalid_display}"
            )
        return normalized

    def validate_element_types(self, value: list[str]) -> list[str]:
        normalized = self._normalize_unique_list(value, field_name="element_types")
        invalid = sorted(set(normalized) - ALLOWED_ELEMENT_EXPORT_TYPES)
        if invalid:
            invalid_display = ", ".join(invalid)
            raise serializers.ValidationError(
                f"Unsupported element_types: {invalid_display}"
            )
        return normalized

    def validate_joint_types(self, value: list[str]) -> list[str]:
        normalized = self._normalize_unique_list(value, field_name="joint_types")
        invalid = sorted(set(normalized) - ALLOWED_JOINT_EXPORT_TYPES)
        if invalid:
            invalid_display = ", ".join(invalid)
            raise serializers.ValidationError(
                f"Unsupported joint_types: {invalid_display}"
            )
        return normalized

    def validate_directions(self, value: list[str]) -> list[str]:
        normalized = self._normalize_unique_list(value, field_name="directions")
        invalid = sorted(set(normalized) - ALLOWED_DIRECTIONS)
        if invalid:
            invalid_display = ", ".join(invalid)
            allowed_display = ", ".join(sorted(ALLOWED_DIRECTIONS))
            raise serializers.ValidationError(
                f"Unsupported directions: {invalid_display}. Allowed: {allowed_display}"
            )
        return normalized

    def validate(self, attrs):
        attrs = super().validate(attrs)

        result_types = attrs.get("result_types", [])
        element_types = attrs.get("element_types", [])
        joint_types = attrs.get("joint_types", [])
        directions = attrs.get("directions", [])

        if not result_types and not element_types and not joint_types:
            raise serializers.ValidationError(
                {"non_field_errors": ["Select at least one global, element, or joint result type."]}
            )

        if result_types and not directions:
            raise serializers.ValidationError(
                {"directions": ["directions are required when exporting global result types."]}
            )

        global_units = len(result_types) * len(directions)
        element_units = 0
        for element_type in element_types:
            variants = RESULT_TYPE_BASE_MAP.get(element_type, {}).get("variants", (element_type,))
            element_units += len(variants)
        joint_units = len(joint_types)
        estimated_units = global_units + element_units + joint_units

        if estimated_units > MAX_EXPORT_WORK_UNITS:
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        (
                            "Export request exceeds guardrail limits "
                            f"({estimated_units} estimated units, max {MAX_EXPORT_WORK_UNITS}). "
                            "Reduce selected result types or directions."
                        )
                    ]
                }
            )

        return attrs
