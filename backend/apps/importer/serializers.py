"""Serializers for importer app."""

from rest_framework import serializers

from apps.importer.models import ImportJob


class ImportJobSerializer(serializers.ModelSerializer):
    """Serializer for ImportJob model."""

    progress_percent = serializers.ReadOnlyField()
    project_name = serializers.CharField(source="project.name", read_only=True)
    result_set_name = serializers.CharField(source="result_set.name", read_only=True)

    class Meta:
        model = ImportJob
        fields = [
            "id",
            "project",
            "project_name",
            "result_set",
            "result_set_name",
            "status",
            "current_phase",
            "progress_current",
            "progress_total",
            "progress_percent",
            "error_message",
            "import_summary",
            "created_at",
            "started_at",
            "completed_at",
        ]
        read_only_fields = fields


class ImportJobCreateSerializer(serializers.Serializer):
    """Serializer for creating an import job (upload files)."""

    files = serializers.ListField(
        child=serializers.FileField(), min_length=1, help_text="Excel files to import"
    )

    def validate_files(self, value):
        """Validate uploaded files are Excel files."""
        allowed_extensions = (".xlsx", ".xls")
        for file in value:
            if not file.name.lower().endswith(allowed_extensions):
                raise serializers.ValidationError(
                    f"File '{file.name}' is not an Excel file. "
                    f"Allowed extensions: {', '.join(allowed_extensions)}"
                )
        return value


class PrescanResultSerializer(serializers.Serializer):
    """Serializer for prescan results."""

    file_load_cases = serializers.DictField(
        child=serializers.DictField(child=serializers.ListField(child=serializers.CharField())),
        help_text="Map of filename -> sheet -> load_cases",
    )
    foundation_joints = serializers.ListField(
        child=serializers.CharField(), help_text="List of foundation joint names"
    )
    files_scanned = serializers.IntegerField()
    errors = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class ConflictSerializer(serializers.Serializer):
    """Serializer for a single conflict."""

    load_case = serializers.CharField()
    sheet = serializers.CharField()
    files = serializers.ListField(child=serializers.CharField())


class ConflictResolutionSerializer(serializers.Serializer):
    """Serializer for conflict resolution choice."""

    sheet = serializers.CharField()
    load_case = serializers.CharField()
    chosen_file = serializers.CharField(
        allow_null=True, help_text="Filename to use, or null to skip"
    )


class ImportStartSerializer(serializers.Serializer):
    """Serializer for starting an import job."""

    selected_load_cases = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="Load cases to import (empty = all)",
    )
    conflict_resolutions = serializers.ListField(
        child=ConflictResolutionSerializer(),
        required=False,
        default=list,
        help_text="Conflict resolution choices",
    )
    result_set_name = serializers.CharField(
        required=False, default="Imported Results", help_text="Name for the result set"
    )
    result_set_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Existing result set ID to add to (for pushover global results)",
    )

    def validate_result_set_name(self, value):
        if not value or not value.strip():
            return "Imported Results"
        return value.strip()


class PushoverImportStartSerializer(serializers.Serializer):
    """Serializer for starting pushover import."""

    result_set_name = serializers.CharField(
        required=False,
        default="Pushover Results",
        help_text="Name for the result set when result_set_id is not provided",
    )
    result_set_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Existing result set ID to add pushover curves to",
    )

    def validate_result_set_name(self, value):
        if not value or not value.strip():
            return "Pushover Results"
        return value.strip()


class LoadCaseSelectionSerializer(serializers.Serializer):
    """Serializer for grouped load case display."""

    name = serializers.CharField()
    files = serializers.ListField(child=serializers.CharField())
    sheets = serializers.ListField(child=serializers.CharField())
    has_conflict = serializers.BooleanField(default=False)
