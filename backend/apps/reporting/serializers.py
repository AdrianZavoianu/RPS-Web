"""Serializer contracts for reporting endpoints."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.exporter.models import ExportJob

REPORT_CATEGORY_GLOBAL = "Global"
REPORT_CATEGORY_ELEMENT = "Element"
REPORT_CATEGORY_JOINT = "Joint"

REPORT_CATEGORIES = {
    REPORT_CATEGORY_GLOBAL,
    REPORT_CATEGORY_ELEMENT,
    REPORT_CATEGORY_JOINT,
}

GLOBAL_REPORT_TYPES = {
    "Drifts",
    "Accelerations",
    "Forces",
    "Displacements",
}
ELEMENT_REPORT_TYPES = {
    "BeamRotations",
    "ColumnRotations",
}
JOINT_REPORT_TYPES = {
    "SoilPressures",
    "VerticalDisplacements",
}

ALL_REPORT_TYPES = GLOBAL_REPORT_TYPES | ELEMENT_REPORT_TYPES | JOINT_REPORT_TYPES


class ProjectScopedReportSerializer(serializers.Serializer):
    """Base serializer with project context helpers."""

    def _get_project(self):
        project = self.context.get("project")
        if project is None:
            raise serializers.ValidationError(
                {"project": "Project context is required for reporting validation."}
            )
        return project


class ReportSectionSerializer(serializers.Serializer):
    """Validation contract for a single report section request."""

    result_type = serializers.CharField(required=True, allow_blank=False)
    direction = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    category = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    include_table = serializers.BooleanField(required=False, default=True)
    include_chart = serializers.BooleanField(required=False, default=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)

        result_type = attrs["result_type"].strip()
        if result_type not in ALL_REPORT_TYPES:
            allowed_display = ", ".join(sorted(ALL_REPORT_TYPES))
            raise serializers.ValidationError(
                {
                    "result_type": f"Unsupported result_type '{result_type}'. Allowed: {allowed_display}"
                }
            )

        requested_category = attrs.get("category")
        normalized_category = (requested_category or "").strip()
        if not normalized_category:
            if result_type in GLOBAL_REPORT_TYPES:
                normalized_category = REPORT_CATEGORY_GLOBAL
            elif result_type in ELEMENT_REPORT_TYPES:
                normalized_category = REPORT_CATEGORY_ELEMENT
            else:
                normalized_category = REPORT_CATEGORY_JOINT

        if normalized_category not in REPORT_CATEGORIES:
            allowed_display = ", ".join(sorted(REPORT_CATEGORIES))
            raise serializers.ValidationError(
                {
                    "category": f"Unsupported category '{normalized_category}'. Allowed: {allowed_display}"
                }
            )

        direction = (attrs.get("direction") or "").strip()

        if normalized_category == REPORT_CATEGORY_GLOBAL:
            if result_type not in GLOBAL_REPORT_TYPES:
                raise serializers.ValidationError(
                    {
                        "result_type": (
                            f"{result_type} is not valid for category {REPORT_CATEGORY_GLOBAL}."
                        )
                    }
                )
            if direction == "":
                raise serializers.ValidationError(
                    {"direction": "direction is required for Global sections."}
                )
        elif normalized_category == REPORT_CATEGORY_ELEMENT:
            if result_type not in ELEMENT_REPORT_TYPES:
                raise serializers.ValidationError(
                    {
                        "result_type": (
                            f"{result_type} is not valid for category {REPORT_CATEGORY_ELEMENT}."
                        )
                    }
                )
        else:
            if result_type not in JOINT_REPORT_TYPES:
                raise serializers.ValidationError(
                    {
                        "result_type": (
                            f"{result_type} is not valid for category {REPORT_CATEGORY_JOINT}."
                        )
                    }
                )

        include_table = attrs.get("include_table", True)
        include_chart = attrs.get("include_chart", True)
        if not include_table and not include_chart:
            raise serializers.ValidationError(
                "At least one of include_table/include_chart must be true."
            )

        attrs["result_type"] = result_type
        attrs["direction"] = direction
        attrs["category"] = normalized_category
        return attrs


class ReportRequestSerializer(ProjectScopedReportSerializer):
    """Validation contract for report generation and section-data requests."""

    result_set_id = serializers.IntegerField(min_value=1, required=True)
    sections = ReportSectionSerializer(many=True, allow_empty=False, required=True)
    project_name = serializers.CharField(required=False, allow_blank=True)

    def validate_result_set_id(self, value: int) -> int:
        # Keep resource lookup/404 semantics in the view layer while using serializer shape validation.
        self._get_project()
        return value


class ReportPreviewQuerySerializer(ProjectScopedReportSerializer):
    """Validation contract for report preview endpoint."""

    result_set_id = serializers.IntegerField(min_value=1, required=True)

    def validate_result_set_id(self, value: int) -> int:
        # Keep resource lookup/404 semantics in the view layer while using serializer shape validation.
        self._get_project()
        return value


class ReportJobRequestSerializer(ReportRequestSerializer):
    """Validation contract for asynchronous report generation jobs."""


class ReportJobSerializer(serializers.ModelSerializer):
    """Serializer for report job status and download endpoint metadata."""

    download_url = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = ExportJob
        fields = [
            "id",
            "status",
            "progress",
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
                    f"/api/projects/{obj.project.slug}/reports/jobs/{obj.id}/download/"
                )
        return None

    def get_progress(self, obj):
        if obj.status == "completed":
            return 100
        if obj.status == "failed":
            return 0
        if obj.status == "processing":
            if obj.progress_total is None or obj.progress_total <= 0 or obj.progress_current is None:
                raise serializers.ValidationError(
                    "Report job progress metadata is missing for processing status"
                )
            return int((obj.progress_current / obj.progress_total) * 100)
        return 0
