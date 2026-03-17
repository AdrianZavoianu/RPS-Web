"""Report data service for report section payload assembly.

Uses ResultDataService contracts so reporting stays decoupled from low-level
results cache/raw models.
"""

from typing import Any, Dict, Optional

from apps.results.services import (
    FALLBACK_CACHE_ONLY,
    FALLBACK_CACHE_THEN_RAW,
    ResultDataService,
)
from core.data_assembler import (
    add_summary_metrics,
    build_abs_scatter_data,
    select_top_rows_by_abs_avg,
)


class ReportDataService:
    """Assemble report-focused data for element and joint result sections."""

    def __init__(self, project, result_service: ResultDataService):
        self.project = project
        self.result_service = result_service

    # ------------------------------------------------------------------
    # Beam Rotations
    # ------------------------------------------------------------------

    def get_beam_rotation_report(
        self, result_set_id: int, is_pushover: bool = False
    ) -> Optional[Dict[str, Any]]:
        rows, load_case_columns, fixed_columns = self._beam_from_cache(result_set_id)
        if not rows:
            rows, load_case_columns, fixed_columns = self._beam_from_raw(result_set_id)

        plot_data = self.result_service.get_beam_rotations_plot_data(result_set_id)
        if not rows and not plot_data:
            return None

        add_summary_metrics(
            rows=rows,
            load_case_columns=load_case_columns,
            include_avg=True,
        )
        top_10 = select_top_rows_by_abs_avg(
            rows=rows,
            load_case_columns=load_case_columns,
        )

        if is_pushover:
            for row in top_10:
                row.pop("Avg", None)
            summary_cols = ["Max", "Min"]
        else:
            summary_cols = ["Avg", "Max", "Min"]

        stories = plot_data["stories"] if plot_data else []

        return {
            "top_10": top_10,
            "stories": stories,
            "plot_data_max": plot_data["max_points"] if plot_data else [],
            "plot_data_min": plot_data["min_points"] if plot_data else [],
            "load_cases": load_case_columns,
            "summary_columns": summary_cols,
            "fixed_columns": fixed_columns,
            "unit": self.result_service._build_meta("BeamRotations", None, result_set_id).unit,
        }

    def _beam_from_cache(self, result_set_id: int):
        table_data = self.result_service.get_beam_rotations_table_data(
            result_set_id,
            fallback_policy=FALLBACK_CACHE_ONLY,
        )
        if not table_data or not table_data.get("rows"):
            return [], [], ["Frame/Wall", "Story"]

        return (
            [dict(row) for row in table_data.get("rows", [])],
            list(table_data.get("load_case_columns", [])),
            ["Frame/Wall", "Story"],
        )

    def _beam_from_raw(self, result_set_id: int):
        table_data = self.result_service.get_beam_rotations_table_data(
            result_set_id,
            fallback_policy=FALLBACK_CACHE_THEN_RAW,
        )
        if not table_data or not table_data.get("rows"):
            return [], [], ["Frame/Wall", "Story"]

        return (
            [dict(row) for row in table_data.get("rows", [])],
            list(table_data.get("load_case_columns", [])),
            ["Frame/Wall", "Story"],
        )

    # ------------------------------------------------------------------
    # Column Rotations
    # ------------------------------------------------------------------

    def get_column_rotation_report(
        self, result_set_id: int, is_pushover: bool = False
    ) -> Optional[Dict[str, Any]]:
        table_data = self.result_service.get_column_rotations_table_data(
            result_set_id,
            fallback_policy=FALLBACK_CACHE_THEN_RAW,
        )
        rows = [dict(row) for row in table_data.get("rows", [])] if table_data else []
        load_case_columns = list(table_data.get("load_case_columns", [])) if table_data else []

        plot_data = self.result_service.get_column_rotations_plot_data(result_set_id)
        if not rows and not plot_data:
            return None

        add_summary_metrics(
            rows=rows,
            load_case_columns=load_case_columns,
            include_avg=True,
        )
        top_10 = select_top_rows_by_abs_avg(
            rows=rows,
            load_case_columns=load_case_columns,
        )

        if is_pushover:
            for row in top_10:
                row.pop("Avg", None)
            summary_cols = ["Max", "Min"]
        else:
            summary_cols = ["Avg", "Max", "Min"]

        stories = plot_data["stories"] if plot_data else []

        return {
            "top_10": top_10,
            "stories": stories,
            "plot_data_max": plot_data["max_points"] if plot_data else [],
            "plot_data_min": plot_data["min_points"] if plot_data else [],
            "load_cases": load_case_columns,
            "summary_columns": summary_cols,
            "fixed_columns": ["Column", "Story", "Dir"],
            "unit": self.result_service._build_meta("ColumnRotations", None, result_set_id).unit,
        }

    # ------------------------------------------------------------------
    # Soil Pressures
    # ------------------------------------------------------------------

    def get_soil_pressure_report(
        self, result_set_id: int, is_pushover: bool = False
    ) -> Optional[Dict[str, Any]]:
        dataset = self.result_service.get_joint_results(
            result_set_id,
            "SoilPressures",
            is_pushover=is_pushover,
            fallback_policy=FALLBACK_CACHE_THEN_RAW,
        )

        if not dataset or not dataset.rows:
            return None

        rows = [dict(row) for row in dataset.rows]
        load_case_columns = list(dataset.load_case_columns)
        unit = dataset.meta.unit or "kPa"

        add_summary_metrics(
            rows=rows,
            load_case_columns=load_case_columns,
            include_avg=not is_pushover,
        )
        top_10 = select_top_rows_by_abs_avg(
            rows=rows,
            load_case_columns=load_case_columns,
        )

        if is_pushover:
            for row in top_10:
                row.pop("Avg", None)
            summary_cols = ["Max", "Min"]
        else:
            summary_cols = ["Avg", "Max", "Min"]

        plot_data = build_abs_scatter_data(
            rows=rows,
            load_case_columns=load_case_columns,
        )

        return {
            "top_10": top_10,
            "load_cases": load_case_columns,
            "summary_columns": summary_cols,
            "fixed_columns": ["Shell Object", "Unique Name"],
            "plot_data": plot_data,
            "unit": unit,
        }

    # ------------------------------------------------------------------
    # Vertical Displacements
    # ------------------------------------------------------------------

    def get_vertical_displacement_report(
        self, result_set_id: int, is_pushover: bool = False
    ) -> Optional[Dict[str, Any]]:
        dataset = self.result_service.get_joint_results(
            result_set_id,
            "VerticalDisplacements",
            is_pushover=is_pushover,
            fallback_policy=FALLBACK_CACHE_THEN_RAW,
        )

        if not dataset or not dataset.rows:
            return None

        rows = [dict(row) for row in dataset.rows]
        load_case_columns = list(dataset.load_case_columns)
        unit = dataset.meta.unit or "mm"

        add_summary_metrics(
            rows=rows,
            load_case_columns=load_case_columns,
            include_avg=not is_pushover,
        )
        top_10 = select_top_rows_by_abs_avg(
            rows=rows,
            load_case_columns=load_case_columns,
        )

        if is_pushover:
            for row in top_10:
                row.pop("Avg", None)
            summary_cols = ["Max", "Min"]
        else:
            summary_cols = ["Avg", "Max", "Min"]

        plot_data = build_abs_scatter_data(
            rows=rows,
            load_case_columns=load_case_columns,
        )

        return {
            "top_10": top_10,
            "load_cases": load_case_columns,
            "summary_columns": summary_cols,
            "fixed_columns": ["Shell Object", "Unique Name"],
            "plot_data": plot_data,
            "unit": unit,
        }
