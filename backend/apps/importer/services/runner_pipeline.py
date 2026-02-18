"""Shared primitives for sheet-by-sheet importer runner execution."""

from dataclasses import dataclass
from typing import Any, Callable


ParsedSheetData = tuple[Any, ...]
AllowedCaseResolver = Callable[[list[str], set[str]], set[str]]
SheetImportHandler = Callable[[ParsedSheetData, set[str]], None]


@dataclass(frozen=True)
class SheetImportStep:
    """Configuration for one source-sheet import step."""

    sheet_name: str
    parse_sheet: Callable[[], ParsedSheetData]
    import_sheet: SheetImportHandler
    resolve_allowed_cases: AllowedCaseResolver
    skip_if_dataframe_empty: bool = False
    imported_sheet_name: str | None = None


def run_sheet_import_step(
    *,
    parser: Any,
    imported_by_sheet: dict[str, set[str]],
    step: SheetImportStep,
) -> set[str]:
    """Run one import step and update imported-by-sheet tracking."""
    if not parser.validate_sheet_exists(step.sheet_name):
        return set()

    parsed = step.parse_sheet()
    if len(parsed) < 2:
        raise ValueError(
            f"Sheet parser for '{step.sheet_name}' must return at least dataframe and load_cases"
        )

    load_cases = parsed[1]
    if not isinstance(load_cases, list):
        raise ValueError(f"Sheet parser for '{step.sheet_name}' must return load_cases as list")

    imported_sheet = step.imported_sheet_name or step.sheet_name
    already_imported = imported_by_sheet.setdefault(imported_sheet, set())
    allowed_cases = step.resolve_allowed_cases(load_cases, already_imported)
    if not allowed_cases:
        return set()

    if step.skip_if_dataframe_empty:
        dataframe = parsed[0]
        is_empty = getattr(dataframe, "empty", None)
        if not isinstance(is_empty, bool):
            raise ValueError(
                f"Sheet parser for '{step.sheet_name}' must return a dataframe-like first value"
            )
        if is_empty:
            return set()

    step.import_sheet(parsed, allowed_cases)
    already_imported.update(allowed_cases)
    return allowed_cases
