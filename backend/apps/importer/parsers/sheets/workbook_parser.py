"""Workbook-level Excel helpers and lightweight sheet accessors."""

from __future__ import annotations

from typing import Any, List, Optional

import pandas as pd

from ..base import BaseSheetParser


class WorkbookSheetParser(BaseSheetParser):
    """Shared workbook/caching operations used by all sheet parsers."""

    @staticmethod
    def _normalize_header_name(name: object) -> str:
        return "".join(ch for ch in str(name).lower() if ch.isalnum())

    def read_sheet(
        self,
        sheet_name: str,
        columns: List[int],
        skiprows: Optional[List[int]] = None,
    ) -> pd.DataFrame:
        if skiprows is None:
            skiprows = [0, 2]

        try:
            return self.get_excel_file().parse(
                sheet_name=sheet_name,
                skiprows=skiprows,
                usecols=columns,
            )
        except Exception as exc:
            raise ValueError(f"Error reading sheet '{sheet_name}': {exc}")

    def get_available_sheets(self) -> List[str]:
        try:
            if self.parser._available_sheets is None:
                self.parser._available_sheets = list(self.get_excel_file().sheet_names)
            return list(self.parser._available_sheets)
        except Exception as exc:
            raise ValueError(f"Error reading Excel file: {exc}")

    def validate_sheet_exists(self, sheet_name: str) -> bool:
        return sheet_name in self.get_available_sheets()

    def load_joint_displacements_full(self) -> pd.DataFrame:
        if self.parser._joint_displacements_df is None:
            sheet = "Joint Displacements"
            columns = [0, 1, 2, 3, 5, 6, 7, 8]
            df = self.read_sheet(sheet, columns, skiprows=[0, 2])
            df.columns = [
                "Story",
                "Label",
                "Unique Name",
                "Output Case",
                "Step Type",
                "Ux",
                "Uy",
                "Uz",
            ]
            self.parser._joint_displacements_df = df
        return self.parser._joint_displacements_df.copy()

    def get_sheet_headers(self, sheet_name: str) -> Optional[List[Any]]:
        if sheet_name not in self.parser._sheet_headers_cache:
            try:
                header_df = self.get_excel_file().parse(
                    sheet_name=sheet_name,
                    skiprows=[0, 2],
                    nrows=0,
                )
                self.parser._sheet_headers_cache[sheet_name] = list(header_df.columns)
            except (KeyError, TypeError, ValueError):
                return None
        return self.parser._sheet_headers_cache[sheet_name]

    def get_load_cases_only_openpyxl(self, sheet_name: str) -> Optional[List[str]]:
        excel_file = self.get_excel_file()
        workbook = getattr(excel_file, "book", None)
        if workbook is None or not hasattr(workbook, "__getitem__"):
            return None

        try:
            worksheet = workbook[sheet_name]
        except Exception:
            return None

        if not hasattr(worksheet, "iter_rows"):
            return None

        try:
            header_row_values = None
            for row in worksheet.iter_rows(min_row=2, max_row=2, values_only=True):
                header_row_values = list(row)
                break
            if not header_row_values:
                return []

            output_case_column = None
            for idx, value in enumerate(header_row_values, start=1):
                if self._normalize_header_name(value) == "outputcase":
                    output_case_column = idx
                    break
            if output_case_column is None:
                return None

            seen: set[str] = set()
            load_cases: List[str] = []
            for row in worksheet.iter_rows(
                min_row=4,
                min_col=output_case_column,
                max_col=output_case_column,
                values_only=True,
            ):
                value = row[0]
                if value is None:
                    continue
                case_name = str(value).strip()
                if not case_name or case_name in seen:
                    continue
                seen.add(case_name)
                load_cases.append(case_name)
            return load_cases
        except Exception:
            return None

    def get_load_cases_only(self, sheet_name: str) -> Optional[List[str]]:
        cached = self.parser._load_cases_cache.get(sheet_name)
        if cached is not None:
            return list(cached)

        if not self.validate_sheet_exists(sheet_name):
            self.parser._load_cases_cache[sheet_name] = []
            return []

        openpyxl_cases = self.get_load_cases_only_openpyxl(sheet_name)
        if openpyxl_cases is not None:
            self.parser._load_cases_cache[sheet_name] = openpyxl_cases
            return list(openpyxl_cases)

        columns = self.get_sheet_headers(sheet_name)
        if columns is None:
            return None

        output_case_idx = None
        for idx, col in enumerate(columns):
            if self._normalize_header_name(col) == "outputcase":
                output_case_idx = idx
                break

        if output_case_idx is None:
            return None

        try:
            df = self.get_excel_file().parse(
                sheet_name=sheet_name,
                skiprows=[0, 2],
                usecols=[output_case_idx],
            )
        except (KeyError, TypeError, ValueError):
            return None

        if df.empty:
            self.parser._load_cases_cache[sheet_name] = []
            return []

        series = df.iloc[:, 0].dropna()
        if series.empty:
            self.parser._load_cases_cache[sheet_name] = []
            return []

        load_cases = pd.unique(series.astype(str)).tolist()
        self.parser._load_cases_cache[sheet_name] = load_cases
        return list(load_cases)
