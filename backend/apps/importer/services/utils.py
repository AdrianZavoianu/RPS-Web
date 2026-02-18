"""Shared importer utility helpers."""

from logging import Logger
from typing import Optional

from .import_contracts import ImportStatsBase

def to_float(value) -> Optional[float]:
    """Convert incoming sheet values to float, returning None for invalid/NaN."""
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed != parsed:  # NaN check
        return None
    return parsed


def append_import_error(stats: ImportStatsBase, source: str, exc: Exception) -> None:
    """Append a normalized import error string to stats['errors']."""
    errors = stats.get("errors")
    if not isinstance(errors, list):
        raise ValueError("Import stats field 'errors' must be a list")
    errors.append(f"{source}: {exc}")


def append_import_error_with_log(
    *,
    stats: ImportStatsBase,
    source: str,
    exc: Exception,
    logger: Logger,
    log_template: str,
) -> None:
    """Append import error to stats and log stack trace consistently."""
    append_import_error(stats, source, exc)
    logger.exception(log_template, source)
