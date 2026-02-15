"""
Serializers for exporter app.
"""
from rest_framework import serializers
from .models import ExportJob


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
