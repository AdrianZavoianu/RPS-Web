"""Typed contracts and validators for import-job configuration payloads."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


ConflictResolutionMap = dict[str, dict[str, str | None]]
FileLoadCasesMap = dict[str, dict[str, list[str]]]


@dataclass(frozen=True)
class ImportRunConfig:
    """Common import runner config fields used by all import tasks."""

    result_set_name: str
    result_set_id: int | None


@dataclass(frozen=True)
class NlthaImportRunConfig(ImportRunConfig):
    """NLTHA-specific task config parsed from ImportJob.job_config."""

    selected_load_cases: set[str]
    conflict_resolution: ConflictResolutionMap
    file_load_cases: FileLoadCasesMap
    foundation_joints: list[str]


@dataclass(frozen=True)
class PrescanSnapshot:
    """Normalized prescan payload persisted in ImportJob.job_config."""

    file_load_cases: FileLoadCasesMap
    foundation_joints: list[str]
    files_scanned: int
    errors: list[str]


def ensure_job_config_object(job_config: Any) -> dict[str, Any]:
    """Require mutable job-config payload object."""
    return _require_dict(job_config, field_name="job_config")


def parse_import_run_config(
    job_config: Any,
    *,
    default_result_set_name: str,
) -> ImportRunConfig:
    """Parse common import runner config with strict shape validation."""
    config = ensure_job_config_object(job_config)
    result_set_name = _parse_result_set_name(
        config=config,
        default_result_set_name=default_result_set_name,
    )
    result_set_id = _parse_optional_int(config, field_name="result_set_id")
    return ImportRunConfig(
        result_set_name=result_set_name,
        result_set_id=result_set_id,
    )


def parse_nltha_import_run_config(
    job_config: Any,
    *,
    default_result_set_name: str,
) -> NlthaImportRunConfig:
    """Parse NLTHA task config and validate prescan payload contracts."""
    base_config = parse_import_run_config(
        job_config,
        default_result_set_name=default_result_set_name,
    )
    config = ensure_job_config_object(job_config)

    selected_load_cases = set(
        _parse_string_list(
            config.get("selected_load_cases", []),
            field_name="selected_load_cases",
        )
    )
    conflict_resolution = _parse_conflict_resolution_map(config.get("conflict_resolution", {}))

    prescan = extract_prescan_snapshot(job_config)
    if prescan is None:
        raise ValueError("Import config field 'prescan' must be an object")

    return NlthaImportRunConfig(
        result_set_name=base_config.result_set_name,
        result_set_id=base_config.result_set_id,
        selected_load_cases=selected_load_cases,
        conflict_resolution=conflict_resolution,
        file_load_cases=prescan.file_load_cases,
        foundation_joints=prescan.foundation_joints,
    )


def apply_result_set_target(
    config: dict[str, Any],
    *,
    result_set_name: Any,
    result_set_id: Any,
) -> None:
    """Apply normalized result-set fields into mutable job config."""
    normalized_name = _parse_required_nonempty_string(
        result_set_name,
        field_name="result_set_name",
    )
    config["result_set_name"] = normalized_name

    normalized_result_set_id = _parse_optional_int(
        {"result_set_id": result_set_id},
        field_name="result_set_id",
    )
    if normalized_result_set_id is None:
        config.pop("result_set_id", None)
        return
    config["result_set_id"] = normalized_result_set_id


def apply_nltha_selection(
    config: dict[str, Any],
    *,
    selected_load_cases: Any,
    conflict_resolution: Any,
) -> None:
    """Apply normalized NLTHA selection and conflict-resolution fields."""
    config["selected_load_cases"] = _parse_string_list(
        selected_load_cases,
        field_name="selected_load_cases",
    )
    config["conflict_resolution"] = _parse_conflict_resolution_map(conflict_resolution)


def build_prescan_snapshot(
    *,
    file_load_cases: Any,
    foundation_joints: Any,
    files_scanned: Any,
    errors: Any,
) -> PrescanSnapshot:
    """Normalize prescan result values into a typed snapshot contract."""
    return PrescanSnapshot(
        file_load_cases=_parse_file_load_cases_map(file_load_cases),
        foundation_joints=_parse_string_list(
            foundation_joints,
            field_name="prescan.foundation_joints",
        ),
        files_scanned=_parse_non_negative_int(
            files_scanned,
            field_name="prescan.files_scanned",
        ),
        errors=_parse_string_list(
            errors,
            field_name="prescan.errors",
        ),
    )


def serialize_prescan_snapshot(snapshot: PrescanSnapshot) -> dict[str, Any]:
    """Serialize typed prescan snapshot back into JSON-storable dict payload."""
    return {
        "file_load_cases": snapshot.file_load_cases,
        "foundation_joints": snapshot.foundation_joints,
        "files_scanned": snapshot.files_scanned,
        "errors": snapshot.errors,
    }


def extract_prescan_snapshot(job_config: Any) -> PrescanSnapshot | None:
    """Extract and validate persisted prescan snapshot from job config."""
    config = ensure_job_config_object(job_config)
    raw_prescan = config.get("prescan")
    if raw_prescan is None:
        return None
    if not isinstance(raw_prescan, dict):
        raise ValueError("Import config field 'prescan' must be an object")

    return build_prescan_snapshot(
        file_load_cases=raw_prescan.get("file_load_cases", {}),
        foundation_joints=raw_prescan.get("foundation_joints", []),
        files_scanned=raw_prescan.get("files_scanned", 0),
        errors=raw_prescan.get("errors", []),
    )


def _require_dict(value: Any, *, field_name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"Import config field '{field_name}' must be an object")
    return value


def _parse_result_set_name(
    *,
    config: dict[str, Any],
    default_result_set_name: str,
) -> str:
    raw_name = config.get("result_set_name")
    if raw_name is None:
        return default_result_set_name
    if not isinstance(raw_name, str):
        raise ValueError("Import config field 'result_set_name' must be a string")
    cleaned = raw_name.strip()
    if not cleaned:
        raise ValueError("Import config field 'result_set_name' cannot be empty")
    return cleaned


def _parse_optional_int(config: dict[str, Any], *, field_name: str) -> int | None:
    value = config.get(field_name)
    if value is None:
        return None
    if not isinstance(value, int):
        raise ValueError(f"Import config field '{field_name}' must be an integer or null")
    return value


def _parse_non_negative_int(value: Any, *, field_name: str) -> int:
    if not isinstance(value, int):
        raise ValueError(f"Import config field '{field_name}' must be an integer")
    if value < 0:
        raise ValueError(f"Import config field '{field_name}' must be >= 0")
    return value


def _parse_required_nonempty_string(value: Any, *, field_name: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"Import config field '{field_name}' must be a string")
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"Import config field '{field_name}' cannot be empty")
    return cleaned


def _parse_string_list(value: Any, *, field_name: str) -> list[str]:
    if not isinstance(value, list):
        raise ValueError(f"Import config field '{field_name}' must be a list")
    normalized: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, str):
            raise ValueError(
                f"Import config field '{field_name}' must contain strings "
                f"(invalid index {index})"
            )
        cleaned = item.strip()
        if not cleaned:
            raise ValueError(
                f"Import config field '{field_name}' cannot contain empty strings "
                f"(invalid index {index})"
            )
        normalized.append(cleaned)
    return normalized


def _parse_conflict_resolution_map(value: Any) -> ConflictResolutionMap:
    if not isinstance(value, dict):
        raise ValueError("Import config field 'conflict_resolution' must be an object")

    normalized: ConflictResolutionMap = {}
    for sheet_name, load_case_map in value.items():
        if not isinstance(sheet_name, str) or not sheet_name.strip():
            raise ValueError("Import config field 'conflict_resolution' has an invalid sheet key")
        if not isinstance(load_case_map, dict):
            raise ValueError(
                "Import config field 'conflict_resolution' must map sheet names to objects"
            )

        normalized_sheet_name = sheet_name.strip()
        normalized_load_cases: dict[str, str | None] = {}
        for load_case_name, chosen_file in load_case_map.items():
            if not isinstance(load_case_name, str) or not load_case_name.strip():
                raise ValueError(
                    "Import config field 'conflict_resolution' has an invalid load_case key"
                )
            if chosen_file is not None and not isinstance(chosen_file, str):
                raise ValueError(
                    "Import config field 'conflict_resolution' values must be strings or null"
                )

            normalized_load_cases[load_case_name.strip()] = (
                chosen_file.strip() if isinstance(chosen_file, str) else None
            )
        normalized[normalized_sheet_name] = normalized_load_cases
    return normalized


def _parse_file_load_cases_map(value: Any) -> FileLoadCasesMap:
    if not isinstance(value, dict):
        raise ValueError("Import config field 'prescan.file_load_cases' must be an object")

    normalized: FileLoadCasesMap = {}
    for file_name, sheets in value.items():
        if not isinstance(file_name, str) or not file_name.strip():
            raise ValueError(
                "Import config field 'prescan.file_load_cases' has an invalid filename"
            )
        if not isinstance(sheets, dict):
            raise ValueError(
                "Import config field 'prescan.file_load_cases' must map filenames to objects"
            )

        normalized_sheets: dict[str, list[str]] = {}
        for sheet_name, load_cases in sheets.items():
            if not isinstance(sheet_name, str) or not sheet_name.strip():
                raise ValueError(
                    "Import config field 'prescan.file_load_cases' has an invalid sheet key"
                )
            normalized_sheets[sheet_name.strip()] = _parse_string_list(
                load_cases,
                field_name=f"prescan.file_load_cases[{file_name!r}][{sheet_name!r}]",
            )

        normalized[file_name.strip()] = normalized_sheets
    return normalized
