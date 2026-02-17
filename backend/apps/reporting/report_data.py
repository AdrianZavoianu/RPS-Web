"""Report data service for element/joint report sections.

Provides top-10 aggregation and scatter plot data assembly for
BeamRotations, ColumnRotations, SoilPressures, and VerticalDisplacements.

Strategy: try cache tables first, fall back to raw model providers
(matching desktop parity).
"""

import logging
from typing import Any, Dict, List, Optional

from django.db.models import Q

from apps.results.models import (
    ElementResultsCache,
    SoilPressure,
    VerticalDisplacement,
)
from apps.results.services import ResultDataService
from apps.results.services.providers.common import sort_load_case_columns

logger = logging.getLogger(__name__)


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
        # Try cache first
        rows, load_case_columns, fixed_columns = self._beam_from_cache(result_set_id)

        # Fall back to raw model provider if cache is empty
        if not rows:
            rows, load_case_columns, fixed_columns = self._beam_from_raw(result_set_id)

        plot_data = self.result_service.get_beam_rotations_plot_data(result_set_id)

        if not rows and not plot_data:
            return None

        # Compute summary columns
        for row in rows:
            numeric = [
                float(row[lc])
                for lc in load_case_columns
                if isinstance(row.get(lc), (int, float))
            ]
            if numeric:
                row["Avg"] = sum(numeric) / len(numeric)
                row["Max"] = max(numeric)
                row["Min"] = min(numeric)

        top_10 = self._top_10_by_abs_avg(rows, load_case_columns)

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
        """Build beam table rows from ElementResultsCache."""
        cache_entries = (
            ElementResultsCache.objects.filter(
                project=self.project,
                result_set_id=result_set_id,
                result_type__startswith="BeamRotations",
            )
            .select_related("element", "story")
            .order_by("story_sort_order", "element__name")
        )

        if not cache_entries.exists():
            return [], [], ["Frame/Wall", "Story"]

        rows_map: Dict[tuple, Dict[str, Any]] = {}
        load_case_set: set = set()

        for entry in cache_entries:
            key = (entry.story.name, entry.element.name)
            row = rows_map.setdefault(
                key,
                {
                    "Frame/Wall": entry.element.name,
                    "Story": entry.story.name,
                },
            )
            for lc_name, value in entry.results_matrix.items():
                row[lc_name] = self.result_service._apply_multiplier(value, "BeamRotations")
                load_case_set.add(lc_name)

        return (
            list(rows_map.values()),
            sort_load_case_columns(list(load_case_set)),
            ["Frame/Wall", "Story"],
        )

    def _beam_from_raw(self, result_set_id: int):
        """Fall back to raw BeamRotation provider (matches desktop approach)."""
        table_data = self.result_service.get_beam_rotations_table_data(result_set_id)
        if not table_data or not table_data.get("rows"):
            return [], [], ["Frame/Wall", "Story"]

        return (
            table_data["rows"],
            table_data.get("load_case_columns", []),
            table_data.get("fixed_columns", ["Frame/Wall", "Story"]),
        )

    # ------------------------------------------------------------------
    # Column Rotations
    # ------------------------------------------------------------------

    def get_column_rotation_report(
        self, result_set_id: int, is_pushover: bool = False
    ) -> Optional[Dict[str, Any]]:
        plot_data = self.result_service.get_column_rotations_plot_data(result_set_id)

        # Try cache first
        rows, load_case_columns = self._column_from_cache(result_set_id)

        # Fall back to raw model if cache is empty
        if not rows:
            rows, load_case_columns = self._column_from_raw(result_set_id)

        if not rows and not plot_data:
            return None

        # Compute summary columns
        for row in rows:
            numeric = [
                float(row[lc])
                for lc in load_case_columns
                if isinstance(row.get(lc), (int, float))
            ]
            if numeric:
                row["Avg"] = sum(numeric) / len(numeric)
                row["Max"] = max(numeric)
                row["Min"] = min(numeric)

        top_10 = self._top_10_by_abs_avg(rows, load_case_columns)

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

    def _column_from_cache(self, result_set_id: int):
        """Build column table rows from ElementResultsCache."""
        cache_entries = (
            ElementResultsCache.objects.filter(
                project=self.project,
                result_set_id=result_set_id,
                result_type__startswith="ColumnRotations_",
            )
            .select_related("element", "story")
            .order_by("story_sort_order", "element__name")
        )

        if not cache_entries.exists():
            return [], []

        rows_map: Dict[tuple, Dict[str, Any]] = {}
        load_case_set: set = set()

        for entry in cache_entries:
            direction = entry.result_type.replace("ColumnRotations_", "")
            key = (entry.story.name, entry.element.name, direction)
            row = rows_map.setdefault(
                key,
                {
                    "Column": entry.element.name,
                    "Story": entry.story.name,
                    "Dir": direction,
                },
            )
            for lc_name, value in entry.results_matrix.items():
                row[lc_name] = self.result_service._apply_multiplier(value, "ColumnRotations")
                load_case_set.add(lc_name)

        return list(rows_map.values()), sort_load_case_columns(list(load_case_set))

    def _column_from_raw(self, result_set_id: int):
        """Fall back to raw ColumnRotation model (matches desktop approach)."""
        from apps.results.models import ColumnRotation

        records = (
            ColumnRotation.objects.filter(story__project=self.project)
            .filter(
                Q(result_category__result_set_id=result_set_id)
                | Q(result_category__result_set__isnull=True)
            )
            .select_related("story", "load_case", "element")
            .order_by("story_sort_order", "element__name", "load_case__name")
        )

        if not records.exists():
            return [], []

        rows_map: Dict[tuple, Dict[str, Any]] = {}
        load_case_set: set = set()

        for record in records:
            direction = (record.direction or "").strip() or "R3"
            # Pick the dominant rotation value (desktop parity)
            value = None
            if record.max_rotation is not None and record.min_rotation is not None:
                value = record.max_rotation if abs(record.max_rotation) >= abs(record.min_rotation) else record.min_rotation
            elif record.max_rotation is not None:
                value = record.max_rotation
            elif record.min_rotation is not None:
                value = record.min_rotation
            elif record.rotation is not None:
                value = record.rotation

            if value is None:
                continue

            key = (record.story.name, record.element.name, direction)
            row = rows_map.setdefault(
                key,
                {
                    "Column": record.element.name,
                    "Story": record.story.name,
                    "Dir": direction,
                },
            )
            lc_name = record.load_case.name
            row[lc_name] = self.result_service._apply_multiplier(value, "ColumnRotations")
            load_case_set.add(lc_name)

        return list(rows_map.values()), sort_load_case_columns(list(load_case_set))

    # ------------------------------------------------------------------
    # Soil Pressures
    # ------------------------------------------------------------------

    def get_soil_pressure_report(
        self, result_set_id: int, is_pushover: bool = False
    ) -> Optional[Dict[str, Any]]:
        # Try joint cache via provider
        dataset = self.result_service.get_joint_results(
            result_set_id, "SoilPressures", is_pushover=is_pushover
        )

        if dataset and dataset.rows:
            rows = dataset.rows
            load_case_columns = dataset.load_case_columns
            unit = dataset.meta.unit or "kPa"
        else:
            # Fall back to raw SoilPressure model
            rows, load_case_columns = self._soil_pressure_from_raw(result_set_id)
            unit = "kPa"

        if not rows:
            return None

        # Compute Avg/Max/Min for soil pressures (joint_provider skips these)
        for row in rows:
            numeric = [
                float(row[lc])
                for lc in load_case_columns
                if isinstance(row.get(lc), (int, float))
            ]
            if numeric:
                if not is_pushover:
                    row["Avg"] = sum(numeric) / len(numeric)
                row["Max"] = max(numeric)
                row["Min"] = min(numeric)

        top_10 = self._top_10_by_abs_avg(rows, load_case_columns)

        if is_pushover:
            for row in top_10:
                row.pop("Avg", None)
            summary_cols = ["Max", "Min"]
        else:
            summary_cols = ["Avg", "Max", "Min"]

        # Build scatter data by load case index: [(load_case_index, abs_value), ...]
        plot_data: List[Dict[str, Any]] = []
        for lc_idx, lc_name in enumerate(load_case_columns):
            for row in rows:
                value = row.get(lc_name)
                if isinstance(value, (int, float)):
                    plot_data.append(
                        {"load_case_idx": lc_idx, "value": abs(float(value))}
                    )

        return {
            "top_10": top_10,
            "load_cases": load_case_columns,
            "summary_columns": summary_cols,
            "fixed_columns": ["Shell Object", "Unique Name"],
            "plot_data": plot_data,
            "unit": unit,
        }

    def _soil_pressure_from_raw(self, result_set_id: int):
        """Fall back to raw SoilPressure model."""
        records = SoilPressure.objects.filter(
            project=self.project,
            result_set_id=result_set_id,
        ).select_related("load_case")

        if not records.exists():
            return [], []

        rows_map: Dict[str, Dict[str, Any]] = {}
        load_case_set: set = set()

        for result in records:
            unique_name = result.unique_name
            row = rows_map.setdefault(
                unique_name,
                {
                    "Shell Object": result.shell_object,
                    "Unique Name": unique_name,
                },
            )
            lc_name = result.load_case.name
            row[lc_name] = abs(result.min_pressure)
            load_case_set.add(lc_name)

        return list(rows_map.values()), sort_load_case_columns(list(load_case_set))

    # ------------------------------------------------------------------
    # Vertical Displacements
    # ------------------------------------------------------------------

    def get_vertical_displacement_report(
        self, result_set_id: int, is_pushover: bool = False
    ) -> Optional[Dict[str, Any]]:
        # Try joint cache via provider
        dataset = self.result_service.get_joint_results(
            result_set_id, "VerticalDisplacements", is_pushover=is_pushover
        )

        if dataset and dataset.rows:
            rows = dataset.rows
            load_case_columns = dataset.load_case_columns
            unit = dataset.meta.unit or "mm"
        else:
            # Fall back to raw VerticalDisplacement model
            rows, load_case_columns = self._vertical_displacement_from_raw(result_set_id)
            unit = "mm"

        if not rows:
            return None

        # Compute Avg/Max/Min for vertical displacements.
        for row in rows:
            numeric = [
                float(row[lc])
                for lc in load_case_columns
                if isinstance(row.get(lc), (int, float))
            ]
            if numeric:
                if not is_pushover:
                    row["Avg"] = sum(numeric) / len(numeric)
                row["Max"] = max(numeric)
                row["Min"] = min(numeric)

        top_10 = self._top_10_by_abs_avg(rows, load_case_columns)

        if is_pushover:
            for row in top_10:
                row.pop("Avg", None)
            summary_cols = ["Max", "Min"]
        else:
            summary_cols = ["Avg", "Max", "Min"]

        # Build scatter data by load case index: [(load_case_index, abs_value), ...]
        plot_data: List[Dict[str, Any]] = []
        for lc_idx, lc_name in enumerate(load_case_columns):
            for row in rows:
                value = row.get(lc_name)
                if isinstance(value, (int, float)):
                    plot_data.append(
                        {"load_case_idx": lc_idx, "value": abs(float(value))}
                    )

        return {
            "top_10": top_10,
            "load_cases": load_case_columns,
            "summary_columns": summary_cols,
            "fixed_columns": ["Shell Object", "Unique Name"],
            "plot_data": plot_data,
            "unit": unit,
        }

    def _vertical_displacement_from_raw(self, result_set_id: int):
        """Fall back to raw VerticalDisplacement model."""
        records = VerticalDisplacement.objects.filter(
            project=self.project,
            result_set_id=result_set_id,
        ).select_related("load_case")

        if not records.exists():
            return [], []

        rows_map: Dict[str, Dict[str, Any]] = {}
        load_case_set: set = set()

        for result in records:
            unique_name = result.unique_name
            row = rows_map.setdefault(
                unique_name,
                {
                    "Shell Object": result.label,
                    "Unique Name": unique_name,
                },
            )
            lc_name = result.load_case.name
            row[lc_name] = abs(result.min_displacement)
            load_case_set.add(lc_name)

        return list(rows_map.values()), sort_load_case_columns(list(load_case_set))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _top_10_by_abs_avg(
        rows: List[Dict[str, Any]], load_case_columns: List[str]
    ) -> List[Dict[str, Any]]:
        """Select top 10 rows by absolute average across load cases."""
        scored = []
        for row in rows:
            numeric = [
                abs(float(row[lc]))
                for lc in load_case_columns
                if isinstance(row.get(lc), (int, float))
            ]
            abs_avg = sum(numeric) / len(numeric) if numeric else 0.0
            scored.append((abs_avg, row))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [dict(row) for _, row in scored[:10]]
