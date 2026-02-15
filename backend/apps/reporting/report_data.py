"""Report data service for element/joint report sections.

Provides top-10 aggregation and scatter plot data assembly for
BeamRotations, ColumnRotations, and SoilPressures, reusing existing providers.
"""

from typing import Any, Dict, List, Optional

from apps.results.models import ElementResultsCache, JointResultsCache
from apps.results.services import ResultDataService
from apps.results.services.providers.common import sort_load_case_columns


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
        table_data = self.result_service.get_beam_rotations_table_data(result_set_id)
        if not table_data or not table_data.get("rows"):
            return None

        plot_data = self.result_service.get_beam_rotations_plot_data(result_set_id)

        rows = table_data["rows"]
        load_case_columns = table_data["load_case_columns"]
        top_10 = self._top_10_by_abs_avg(rows, load_case_columns)

        if is_pushover:
            for row in top_10:
                row.pop("Avg", None)
            summary_cols = [c for c in table_data.get("summary_columns", []) if c != "Avg"]
        else:
            summary_cols = table_data.get("summary_columns", [])

        stories = plot_data["stories"] if plot_data else []

        return {
            "top_10": top_10,
            "stories": stories,
            "plot_data_max": plot_data["max_points"] if plot_data else [],
            "plot_data_min": plot_data["min_points"] if plot_data else [],
            "load_cases": load_case_columns,
            "summary_columns": summary_cols,
            "fixed_columns": table_data.get("fixed_columns", []),
            "unit": table_data.get("meta", {}).get("unit", "%"),
        }

    # ------------------------------------------------------------------
    # Column Rotations
    # ------------------------------------------------------------------

    def get_column_rotation_report(
        self, result_set_id: int, is_pushover: bool = False
    ) -> Optional[Dict[str, Any]]:
        plot_data = self.result_service.get_column_rotations_plot_data(result_set_id)

        # Build table from ElementResultsCache for ColumnRotations_R2/R3
        cache_entries = (
            ElementResultsCache.objects.filter(
                project=self.project,
                result_set_id=result_set_id,
                result_type__startswith="ColumnRotations_",
            )
            .select_related("element", "story")
            .order_by("story_sort_order", "element__name")
        )

        if not cache_entries.exists() and not plot_data:
            return None

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
                row[lc_name] = value
                load_case_set.add(lc_name)

        load_case_columns = sort_load_case_columns(list(load_case_set))
        rows = list(rows_map.values())

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
            "unit": plot_data["meta"]["unit"] if plot_data else "%",
        }

    # ------------------------------------------------------------------
    # Soil Pressures
    # ------------------------------------------------------------------

    def get_soil_pressure_report(
        self, result_set_id: int, is_pushover: bool = False
    ) -> Optional[Dict[str, Any]]:
        dataset = self.result_service.get_joint_results(
            result_set_id, "SoilPressures", is_pushover=is_pushover
        )
        if not dataset or not dataset.rows:
            return None

        rows = dataset.rows
        load_case_columns = dataset.load_case_columns

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

        # Build scatter data: [(joint_name, abs_value), ...]
        plot_data = []
        for row in rows:
            name = row.get("Unique Name", row.get("Shell Object", ""))
            numeric = [
                abs(float(row[lc]))
                for lc in load_case_columns
                if isinstance(row.get(lc), (int, float))
            ]
            for val in numeric:
                plot_data.append({"name": name, "value": val})

        return {
            "top_10": top_10,
            "load_cases": load_case_columns,
            "summary_columns": summary_cols,
            "fixed_columns": ["Shell Object", "Unique Name"],
            "plot_data": plot_data,
            "unit": dataset.meta.unit or "kPa",
        }

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
