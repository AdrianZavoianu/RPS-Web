"""Shared parser base for sheet-specific Excel parsers."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

import pandas as pd

if TYPE_CHECKING:
    from .excel_parser import ExcelParser


class BaseSheetParser:
    """Thin adapter over ExcelParser shared read/validation helpers."""

    def __init__(self, parser: "ExcelParser") -> None:
        self.parser = parser

    def read_sheet(
        self,
        sheet_name: str,
        columns: List[int],
        skiprows: Optional[List[int]] = None,
    ) -> pd.DataFrame:
        return self.parser.read_sheet(sheet_name, columns, skiprows)

    def get_unique_values(self, df: pd.DataFrame, column_names: List[str]) -> Dict[str, List[Any]]:
        return self.parser.get_unique_values(df, column_names)

    def validate_sheet_exists(self, sheet_name: str) -> bool:
        return self.parser.validate_sheet_exists(sheet_name)

    def get_excel_file(self) -> pd.ExcelFile:
        return self.parser._get_excel_file()

    def load_joint_displacements_full(self) -> pd.DataFrame:
        return self.parser._load_joint_displacements_full()
