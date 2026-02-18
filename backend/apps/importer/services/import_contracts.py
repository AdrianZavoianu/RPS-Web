"""Typed contracts for importer runner stats and completion payloads."""

from typing import Any, Literal, NotRequired, TypedDict


CompletionStatus = Literal["success", "warning", "failed"]


class ImportCompletionPayload(TypedDict):
    """Normalized completion payload used for websocket + task return flow."""

    status: CompletionStatus
    message: str


class ImportStatsBase(TypedDict):
    """Fields shared by all import runner stats."""

    files_processed: int
    files_total: int
    result_set_id: int | None
    errors: list[str]
    has_warnings: NotRequired[bool]
    warning_count: NotRequired[int]


class NlthaImportStats(ImportStatsBase):
    """Stats contract returned by the NLTHA import runner."""

    load_cases_imported: int
    stories_imported: int
    elements_imported: int
    time_history_results: NotRequired[list[Any]]
    stories_map: NotRequired[dict[str, Any]]
    global_cache_rows: NotRequired[int]
    element_cache_rows: NotRequired[int]
    joint_cache_rows: NotRequired[int]
    time_series_cache_rows: NotRequired[int]


class PushoverCurveImportStats(ImportStatsBase):
    """Stats contract returned by the pushover curve import runner."""

    pushover_cases_imported: int
    curve_points_imported: int


class PushoverResultsImportStats(ImportStatsBase):
    """Stats contract returned by the pushover source-sheet import runner."""

    load_cases_imported: int
    stories_imported: int
    elements_imported: int
    cache_rows_written: int
    directions_imported: list[str]
    global_cache_rows: NotRequired[int]
    element_cache_rows: NotRequired[int]
    joint_cache_rows: NotRequired[int]


ImportRunnerStats = NlthaImportStats | PushoverCurveImportStats | PushoverResultsImportStats
