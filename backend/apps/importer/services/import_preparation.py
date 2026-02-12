"""Headless helpers for preparing enhanced imports.

Ported from RPS_desktop/src/processing/import_preparation.py
"""

from __future__ import annotations

import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from apps.importer.parsers.excel_parser import ExcelParser

logger = logging.getLogger(__name__)


# Target sheets mapped to result labels
TARGET_SHEETS: Dict[str, List[str]] = {
    "Story Drifts": ["Story Drifts"],
    "Diaphragm Accelerations": ["Story Accelerations"],
    "Story Forces": ["Story Forces"],
    "Joint Displacements": ["Floors Displacements"],
    "Pier Forces": ["Pier Forces"],
    "Element Forces - Columns": ["Column Forces", "Column Axials"],
    "Fiber Hinge States": ["Column Rotations"],
    "Hinge States": ["Beam Rotations"],
    "Quad Strain Gauge - Rotation": ["Quad Rotations"],
    "Soil Pressures": ["Soil Pressures"],
}


@dataclass
class FilePrescanSummary:
    """Summary for a single Excel file."""

    load_cases_by_sheet: Dict[str, List[str]]
    available_sheets: Set[str]
    foundation_joints: List[str]


@dataclass
class PrescanResult:
    """Results from scanning a folder of Excel files."""

    file_load_cases: Dict[str, Dict[str, List[str]]] = field(default_factory=dict)
    file_summaries: Dict[str, FilePrescanSummary] = field(default_factory=dict)
    foundation_joints: List[str] = field(default_factory=list)
    files_scanned: int = 0
    errors: List[str] = field(default_factory=list)


class ImportPreparationService:
    """Collects metadata needed before running the enhanced import."""

    def __init__(
        self,
        target_sheets: Optional[Dict[str, List[str]]] = None,
        parser_factory: Callable[[Path], ExcelParser] = None,
    ) -> None:
        self._target_sheets = target_sheets or TARGET_SHEETS
        self._parser_factory = parser_factory or (lambda p: ExcelParser(str(p)))

    def prescan_folder(
        self,
        folder_path: Path,
        result_types: Optional[Set[str]] = None,
        progress_callback: Optional[Callable[[str, int, int], None]] = None,
    ) -> PrescanResult:
        """Prescan every Excel file under a folder."""
        files: List[Path] = []
        for pattern in ("*.xlsx", "*.xls"):
            files.extend(folder_path.glob(pattern))
        excel_files = sorted(f for f in files if not f.name.startswith("~$"))
        return self.prescan_files(excel_files, result_types, progress_callback)

    def prescan_files(
        self,
        excel_files: Sequence[Path],
        result_types: Optional[Set[str]] = None,
        progress_callback: Optional[Callable[[str, int, int], None]] = None,
    ) -> PrescanResult:
        """Prescan a provided list of Excel files."""
        result = PrescanResult(files_scanned=len(excel_files))
        foundation_seen: Set[str] = set()

        def _scan_file(
            file_path: Path,
        ) -> Tuple[str, Dict[str, List[str]], List[str], List[str], List[str], Set[str]]:
            parser = self._parser_factory(file_path)
            load_cases_by_sheet: Dict[str, List[str]] = {}
            sheets_found: List[str] = []
            sheets_errored: List[str] = []
            available_sheets = set(parser.get_available_sheets())
            foundation_joints: List[str] = []

            try:
                for sheet_name, result_labels in self._target_sheets.items():
                    if not self._should_import_any(result_labels, result_types):
                        continue
                    if (
                        sheet_name not in available_sheets
                        and sheet_name != "Vertical Displacements"
                    ):
                        continue

                    try:
                        load_cases = self._extract_load_cases_from_sheet(parser, sheet_name)
                        if load_cases:
                            load_cases_by_sheet[sheet_name] = load_cases
                            sheets_found.append(f"{sheet_name}({len(load_cases)})")
                    except Exception as exc:
                        sheets_errored.append(f"{sheet_name}: {str(exc)[:30]}")

                if "Fou" in available_sheets:
                    try:
                        foundation_joints = parser.get_foundation_joints()
                    except Exception as exc:
                        sheets_errored.append(f"Fou: {str(exc)[:30]}")

                if "Joint Displacements" in available_sheets:
                    if result_types is None or "vertical displacements" in {
                        rt.lower() for rt in result_types
                    }:
                        try:
                            load_cases = parser.get_load_cases_only("Joint Displacements") or []
                            if load_cases:
                                load_cases_by_sheet["Vertical Displacements"] = load_cases
                                sheets_found.append(f"Vertical Displacements({len(load_cases)})")
                        except Exception as exc:
                            sheets_errored.append(f"Joint Displacements: {str(exc)[:30]}")
            finally:
                parser.close()

            return (
                file_path.name,
                load_cases_by_sheet,
                sheets_found,
                sheets_errored,
                foundation_joints,
                available_sheets,
            )

        max_workers = min(6, len(excel_files) or 1)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(_scan_file, path): path for path in excel_files}
            processed_count = 0
            for future in as_completed(futures):
                file_path = futures[future]
                processed_count += 1
                if progress_callback:
                    progress_callback(
                        f"Scanning {file_path.name}...",
                        processed_count,
                        len(excel_files),
                    )
                try:
                    (
                        file_name,
                        load_cases_by_sheet,
                        sheets_found,
                        sheets_errored,
                        joints,
                        available_sheets,
                    ) = future.result()

                    if load_cases_by_sheet:
                        result.file_load_cases[file_name] = load_cases_by_sheet

                    result.file_summaries[file_name] = FilePrescanSummary(
                        load_cases_by_sheet=load_cases_by_sheet,
                        available_sheets=available_sheets,
                        foundation_joints=joints,
                    )

                    for joint in joints:
                        if joint not in foundation_seen:
                            foundation_seen.add(joint)
                            result.foundation_joints.append(joint)

                    if progress_callback and (sheets_found or sheets_errored):
                        if sheets_found:
                            progress_callback(
                                f"  Found: {', '.join(sheets_found[:3])}"
                                f"{'...' if len(sheets_found) > 3 else ''}",
                                processed_count,
                                len(excel_files),
                            )
                        if sheets_errored:
                            progress_callback(
                                f"  Error: {sheets_errored[0]}",
                                processed_count,
                                len(excel_files),
                            )
                except Exception as exc:
                    result.errors.append(f"{file_path.name}: {exc}")
                    logger.exception(f"Error scanning file {file_path.name}")

        return result

    def _should_import_any(self, labels: Iterable[str], result_types: Optional[Set[str]]) -> bool:
        if not result_types:
            return True
        result_types_lower = {rt.lower() for rt in result_types}
        for label in labels:
            if label.strip().lower() in result_types_lower:
                return True
        return False

    def _extract_load_cases_from_sheet(self, parser: ExcelParser, sheet_name: str) -> List[str]:
        """Extract load cases from a specific sheet."""
        # Try quick method first
        quick_cases = parser.get_load_cases_only(sheet_name)
        if quick_cases is not None:
            return quick_cases

        # Fall back to full parsing
        if sheet_name == "Story Drifts":
            _, load_cases, _ = parser.get_story_drifts()
            return load_cases
        if sheet_name == "Diaphragm Accelerations":
            _, load_cases, _ = parser.get_story_accelerations()
            return load_cases
        if sheet_name == "Story Forces":
            _, load_cases, _ = parser.get_story_forces()
            return load_cases
        if sheet_name == "Joint Displacements":
            _, load_cases, _ = parser.get_joint_displacements()
            return load_cases
        if sheet_name == "Pier Forces":
            _, load_cases, _, _ = parser.get_pier_forces()
            return load_cases
        if sheet_name == "Element Forces - Columns":
            _, load_cases, _, _ = parser.get_column_forces()
            return load_cases
        if sheet_name == "Fiber Hinge States":
            _, load_cases, _, _ = parser.get_fiber_hinge_states()
            return load_cases
        if sheet_name == "Hinge States":
            _, load_cases, _, _ = parser.get_hinge_states()
            return load_cases
        if sheet_name == "Quad Strain Gauge - Rotation":
            _, load_cases, _, _ = parser.get_quad_rotations()
            return load_cases
        if sheet_name == "Soil Pressures":
            _, load_cases, _ = parser.get_soil_pressures()
            return load_cases
        return []


def detect_conflicts(
    file_load_cases: Dict[str, Dict[str, List[str]]],
    selected_load_cases: Set[str],
) -> Dict[str, Dict[str, List[str]]]:
    """Detect conflicting load cases (same sheet + load case appearing in multiple files).

    Args:
        file_load_cases: {filename: {sheet: [load_cases]}}
        selected_load_cases: Set of selected load case names

    Returns:
        {load_case: {sheet: [files]}} for conflicts only
    """
    conflicts: Dict[str, Dict[str, List[str]]] = {}
    sheet_types = {sheet for sheets in file_load_cases.values() for sheet in sheets.keys()}

    for sheet_name in sheet_types:
        lc_files: Dict[str, List[str]] = defaultdict(list)
        for file_name, sheets in file_load_cases.items():
            if sheet_name not in sheets:
                continue
            for load_case in sheets[sheet_name]:
                if load_case in selected_load_cases:
                    lc_files[load_case].append(file_name)
        for load_case, files in lc_files.items():
            if len(files) > 1:
                conflicts.setdefault(load_case, {})[sheet_name] = files
    return conflicts


def determine_allowed_load_cases(
    file_name: str,
    file_sheets: Dict[str, List[str]],
    selected_load_cases: Set[str],
    resolution: Dict[str, Dict[str, Optional[str]]],
    already_imported: Dict[str, Set[str]],
) -> Tuple[Set[str], Dict[str, List[str]]]:
    """Decide which load cases can be imported for a single file.

    Args:
        file_name: Current file name
        file_sheets: {sheet: [load_cases]} for this file
        selected_load_cases: Set of user-selected load cases
        resolution: {sheet: {load_case: chosen_file}} conflict resolution
        already_imported: {sheet: {load_cases}} already imported

    Returns:
        Tuple of (allowed_load_cases, skipped_by_sheet)
    """
    allowed: Set[str] = set()
    skipped_by_sheet: Dict[str, List[str]] = defaultdict(list)

    for sheet_name, load_cases_in_sheet in file_sheets.items():
        imported_for_sheet = already_imported.get(sheet_name, set())
        resolution_for_sheet = resolution.get(sheet_name, {})

        for load_case in load_cases_in_sheet:
            if load_case not in selected_load_cases:
                continue

            if load_case in resolution_for_sheet:
                chosen_file = resolution_for_sheet[load_case]
                if chosen_file is None:
                    skipped_by_sheet[sheet_name].append(f"{load_case} (user skipped)")
                elif chosen_file == file_name:
                    allowed.add(load_case)
                else:
                    skipped_by_sheet[sheet_name].append(f"{load_case} (using {chosen_file})")
                continue

            if load_case in imported_for_sheet:
                skipped_by_sheet[sheet_name].append(f"{load_case} (already imported)")
                continue

            allowed.add(load_case)

    return allowed, dict(skipped_by_sheet)
