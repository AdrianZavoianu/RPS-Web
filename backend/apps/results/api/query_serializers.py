"""Serializer-backed query validation contracts for results endpoints."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from config.result_types import RESULT_TYPE_CONFIG

from apps.results.data import ResultSetRepository

GLOBAL_RESULT_TYPES = {
    "Drifts",
    "Accelerations",
    "Forces",
    "Displacements",
}
ELEMENT_RESULT_TYPES = {
    "WallShears",
    "QuadRotations",
    "ColumnShears",
    "ColumnAxials",
    "ColumnRotations",
    "BeamRotations",
}
JOINT_RESULT_TYPES = {
    "SoilPressures",
    "VerticalDisplacements",
}
ALL_RESULT_TYPES = sorted(RESULT_TYPE_CONFIG.keys())
COMPARISON_METRICS = ("Avg", "Max", "Min")


class CSVIntegerListField(serializers.Field):
    """Parse comma-separated query parameter values into positive integers."""

    default_error_messages = {
        "invalid": "Must be a comma-separated list of integers.",
        "invalid_value": "All IDs must be positive integers.",
    }

    def to_internal_value(self, data: Any) -> list[int]:
        if data in (None, ""):
            return []

        raw_parts: list[str]
        if isinstance(data, list):
            raw_parts = [str(item) for item in data]
        else:
            raw_parts = str(data).split(",")

        parsed: list[int] = []
        for raw_part in raw_parts:
            cleaned = raw_part.strip()
            if cleaned == "":
                self.fail("invalid")
            try:
                parsed_value = int(cleaned)
            except (TypeError, ValueError):
                self.fail("invalid")
            if parsed_value < 1:
                self.fail("invalid_value")
            if parsed_value not in parsed:
                parsed.append(parsed_value)

        return parsed

    def to_representation(self, value: Any) -> Any:
        return value


class ProjectScopedQuerySerializer(serializers.Serializer):
    """Base serializer for query contracts that require project context."""

    def _get_project(self):
        project = self.context.get("project")
        if project is None:
            raise serializers.ValidationError(
                {"project": "Project context is required for query validation."}
            )
        return project

    def _validate_result_set_scope(self, result_set_ids: list[int]) -> list[int]:
        project = self._get_project()
        existing_ids = ResultSetRepository.get_project_result_set_ids(project, result_set_ids)
        invalid_ids = [result_set_id for result_set_id in result_set_ids if result_set_id not in existing_ids]
        if invalid_ids:
            invalid_display = ", ".join(str(result_set_id) for result_set_id in invalid_ids)
            raise serializers.ValidationError(
                f"Result sets must belong to the requested project. Invalid IDs: {invalid_display}"
            )
        return result_set_ids


class ResultSetScopedQuerySerializer(ProjectScopedQuerySerializer):
    """Base query contract for endpoints requiring a single result_set_id."""

    result_set_id = serializers.IntegerField(min_value=1, required=True)

    def validate_result_set_id(self, value: int) -> int:
        self._validate_result_set_scope([value])
        return value


class MaxMinDataQuerySerializer(ResultSetScopedQuerySerializer):
    """Validation contract for max/min endpoints."""

    result_type = serializers.ChoiceField(choices=ALL_RESULT_TYPES, required=True)
    element_id = serializers.IntegerField(min_value=1, required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)
        if "element_id" in attrs and attrs["result_type"] not in ELEMENT_RESULT_TYPES:
            raise serializers.ValidationError(
                {"element_id": "element_id is only valid for element result types."}
            )
        return attrs


class ComparisonDataQuerySerializer(ProjectScopedQuerySerializer):
    """Validation contract for comparison endpoints."""

    result_set_ids = CSVIntegerListField(required=True)
    result_type = serializers.ChoiceField(choices=ALL_RESULT_TYPES, required=True)
    direction = serializers.CharField(required=False, allow_blank=False)
    metric = serializers.ChoiceField(choices=COMPARISON_METRICS, required=False, default="Avg")
    element_id = serializers.IntegerField(min_value=1, required=False)

    def validate_result_set_ids(self, value: list[int]) -> list[int]:
        if len(value) < 2:
            raise serializers.ValidationError("Select at least 2 result sets.")
        return self._validate_result_set_scope(value)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)

        result_type = attrs["result_type"]
        direction = attrs.get("direction")
        element_id = attrs.get("element_id")

        allowed_directions = RESULT_TYPE_CONFIG.get(result_type, {}).get("directions")
        if allowed_directions:
            if not direction:
                allowed_display = ", ".join(allowed_directions)
                raise serializers.ValidationError(
                    {"direction": f"direction is required and must be one of: {allowed_display}"}
                )
            if direction not in allowed_directions:
                allowed_display = ", ".join(allowed_directions)
                raise serializers.ValidationError(
                    {"direction": f"Invalid direction '{direction}'. Allowed: {allowed_display}"}
                )
        elif direction:
            raise serializers.ValidationError(
                {"direction": f"{result_type} does not accept direction."}
            )

        if element_id is not None and result_type not in ELEMENT_RESULT_TYPES:
            raise serializers.ValidationError(
                {"element_id": "element_id is only valid for element result types."}
            )

        return attrs


class ChartDataQuerySerializer(ResultSetScopedQuerySerializer):
    """Validation contract for chart endpoints."""

    result_type = serializers.ChoiceField(choices=sorted(GLOBAL_RESULT_TYPES), required=True)
    direction = serializers.CharField(required=True, allow_blank=False)
    column = serializers.CharField(required=False, allow_blank=False, default="Avg")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)

        allowed_directions = RESULT_TYPE_CONFIG[attrs["result_type"]]["directions"] or []
        if attrs["direction"] not in allowed_directions:
            allowed_display = ", ".join(allowed_directions)
            raise serializers.ValidationError(
                {"direction": f"Invalid direction '{attrs['direction']}'. Allowed: {allowed_display}"}
            )

        return attrs


class TimeSeriesDataQuerySerializer(ResultSetScopedQuerySerializer):
    """Validation contract for single-type time-series endpoint."""

    load_case = serializers.CharField(required=True, allow_blank=False)
    result_type = serializers.ChoiceField(choices=sorted(GLOBAL_RESULT_TYPES), required=True)
    direction = serializers.CharField(required=True, allow_blank=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)

        attrs["load_case"] = attrs["load_case"].strip()
        if attrs["load_case"] == "":
            raise serializers.ValidationError({"load_case": "load_case cannot be blank."})

        allowed_directions = RESULT_TYPE_CONFIG[attrs["result_type"]]["directions"] or []
        if attrs["direction"] not in allowed_directions:
            allowed_display = ", ".join(allowed_directions)
            raise serializers.ValidationError(
                {"direction": f"Invalid direction '{attrs['direction']}'. Allowed: {allowed_display}"}
            )

        return attrs


class TimeSeriesAllTypesQuerySerializer(ResultSetScopedQuerySerializer):
    """Validation contract for all-types time-series endpoint."""

    load_case = serializers.CharField(required=True, allow_blank=False)
    direction = serializers.ChoiceField(choices=("X", "Y"), required=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)

        attrs["load_case"] = attrs["load_case"].strip()
        if attrs["load_case"] == "":
            raise serializers.ValidationError({"load_case": "load_case cannot be blank."})

        return attrs


class TimeSeriesLoadCasesQuerySerializer(ProjectScopedQuerySerializer):
    """Validation contract for time-series load-case discovery endpoint."""

    result_set_id = serializers.IntegerField(min_value=1, required=False)

    def validate_result_set_id(self, value: int) -> int:
        self._validate_result_set_scope([value])
        return value


class TreeMetadataQuerySerializer(ResultSetScopedQuerySerializer):
    """Validation contract for batched tree metadata endpoint."""
