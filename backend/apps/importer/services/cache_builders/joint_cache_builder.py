"""Foundation/joint-level cache builder."""

from collections import defaultdict
from typing import Dict

from django.db import transaction

from apps.projects.models import Project
from apps.results.models import JointResultsCache, ResultSet, SoilPressure, VerticalDisplacement

from .common import compute_aggregates


class JointCacheBuilder:
    """Builds ``JointResultsCache`` rows for a result set."""

    def __init__(
        self,
        *,
        project: Project,
        result_set: ResultSet,
        compute_aggregates_enabled: bool,
    ):
        self.project = project
        self.result_set = result_set
        self.compute_aggregates_enabled = compute_aggregates_enabled

    def build(self) -> int:
        """Build joint cache rows and return row count."""
        JointResultsCache.objects.filter(
            project=self.project,
            result_set=self.result_set,
        ).delete()

        return self._build_soil_pressure_cache() + self._build_vertical_displacement_cache()

    def _build_soil_pressure_cache(self) -> int:
        queryset = SoilPressure.objects.filter(
            project=self.project,
            result_set=self.result_set,
        ).select_related("load_case")

        joint_data: Dict[str, Dict[str, float]] = defaultdict(dict)
        joint_shell: Dict[str, str] = {}

        for result in queryset:
            unique_name = result.unique_name
            load_case_name = result.load_case.name
            joint_data[unique_name][load_case_name] = result.min_pressure
            joint_shell[unique_name] = result.shell_object

        if not joint_data:
            return 0

        cache_rows = []
        for unique_name, results_matrix in joint_data.items():
            row = JointResultsCache(
                project=self.project,
                result_set=self.result_set,
                result_type="SoilPressures_Min",
                shell_object=joint_shell.get(unique_name, ""),
                unique_name=unique_name,
                results_matrix=results_matrix,
            )
            if self.compute_aggregates_enabled:
                avg_val, max_val, min_val, count = compute_aggregates(results_matrix)
                row.avg_value = avg_val
                row.max_value = max_val
                row.min_value = min_val
                row.load_case_count = count
            cache_rows.append(row)

        with transaction.atomic():
            JointResultsCache.objects.bulk_create(cache_rows)

        return len(cache_rows)

    def _build_vertical_displacement_cache(self) -> int:
        queryset = VerticalDisplacement.objects.filter(
            project=self.project,
            result_set=self.result_set,
        ).select_related("load_case")

        joint_data: Dict[str, Dict[str, float]] = defaultdict(dict)
        joint_label: Dict[str, str] = {}

        for result in queryset:
            unique_name = result.unique_name
            load_case_name = result.load_case.name
            joint_data[unique_name][load_case_name] = result.min_displacement
            joint_label[unique_name] = result.label

        if not joint_data:
            return 0

        cache_rows = []
        for unique_name, results_matrix in joint_data.items():
            row = JointResultsCache(
                project=self.project,
                result_set=self.result_set,
                result_type="VerticalDisplacements_Min",
                shell_object=joint_label.get(unique_name, ""),
                results_matrix=results_matrix,
                unique_name=unique_name,
            )
            if self.compute_aggregates_enabled:
                avg_val, max_val, min_val, count = compute_aggregates(results_matrix)
                row.avg_value = avg_val
                row.max_value = max_val
                row.min_value = min_val
                row.load_case_count = count
            cache_rows.append(row)

        with transaction.atomic():
            JointResultsCache.objects.bulk_create(cache_rows)

        return len(cache_rows)
