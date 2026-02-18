"""Repository/query objects for results data access."""

from __future__ import annotations

from typing import Iterable, Sequence

from apps.projects.models import Project
from apps.results.models import (
    AbsoluteMaxMinDrift,
    ElementResultsCache,
    GlobalResultsCache,
    JointResultsCache,
    ResultCategory,
    ResultSet,
    TimeSeriesGlobalCache,
)


class ResultSetRepository:
    """Project-scoped query operations for result sets."""

    @staticmethod
    def exists_in_project(project: Project, result_set_id: int) -> bool:
        return ResultSet.objects.filter(project=project, id=result_set_id).exists()

    @staticmethod
    def get_project_result_set_ids(project: Project, result_set_ids: Sequence[int]) -> set[int]:
        if not result_set_ids:
            return set()
        return set(
            ResultSet.objects.filter(project=project, id__in=result_set_ids).values_list("id", flat=True)
        )

    @staticmethod
    def get_project_result_set_name_map(project: Project, result_set_ids: Sequence[int]) -> dict[int, str]:
        if not result_set_ids:
            return {}
        return {
            rs_id: rs_name
            for rs_id, rs_name in ResultSet.objects.filter(
                project=project,
                id__in=result_set_ids,
            ).values_list("id", "name")
        }


class ResultCategoryRepository:
    """Project-scoped query operations for result categories."""

    @staticmethod
    def get_ids_for_project_result_set(project: Project, result_set_id: int) -> list[int]:
        return list(
            ResultCategory.objects.filter(
                result_set__project=project,
                result_set_id=result_set_id,
            ).values_list("id", flat=True)
        )


class GlobalResultsCacheRepository:
    """Query operations for global results cache tables."""

    @staticmethod
    def list_entries(project: Project, result_set_id: int, result_type: str):
        return list(
            GlobalResultsCache.objects.filter(
                project=project,
                result_set_id=result_set_id,
                result_type=result_type,
            )
            .select_related("story")
            .order_by("-story_sort_order")
        )

    @staticmethod
    def list_aggregate_rows(
        project: Project,
        result_set_id: int,
        result_type: str,
        aggregate_column: str,
    ) -> list[dict[str, object]]:
        return list(
            GlobalResultsCache.objects.filter(
                project=project,
                result_set_id=result_set_id,
                result_type=result_type,
            )
            .exclude(**{f"{aggregate_column}__isnull": True})
            .select_related("story")
            .order_by("-story_sort_order")
            .values("story__name", aggregate_column)
        )

    @staticmethod
    def list_result_types(project: Project) -> set[str]:
        return set(GlobalResultsCache.objects.filter(project=project).values_list("result_type", flat=True))


class ElementResultsCacheRepository:
    """Query operations for element results cache tables."""

    @staticmethod
    def list_entries(
        project: Project,
        result_set_id: int,
        result_type: str,
        *,
        element_id: int | None = None,
    ):
        filters = {
            "project": project,
            "result_set_id": result_set_id,
            "result_type": result_type,
        }
        if element_id is not None:
            filters["element_id"] = element_id

        return list(
            ElementResultsCache.objects.filter(**filters)
            .select_related("story", "element")
            .order_by("-story_sort_order")
        )

    @staticmethod
    def list_entries_for_types(project: Project, result_set_id: int, result_types: Iterable[str]):
        return list(
            ElementResultsCache.objects.filter(
                project=project,
                result_set_id=result_set_id,
                result_type__in=list(result_types),
            )
            .select_related("story", "element")
            .order_by("story_sort_order", "element__name", "id")
        )

    @staticmethod
    def list_distinct_elements_for_type(project: Project, result_set_id: int, result_type_prefix: str):
        return list(
            ElementResultsCache.objects.filter(
                project=project,
                result_set_id=result_set_id,
                result_type__startswith=result_type_prefix,
            )
            .select_related("element")
            .values("element__id", "element__name", "element__element_type")
            .distinct()
        )


class JointResultsCacheRepository:
    """Query operations for joint/foundation cache tables."""

    @staticmethod
    def list_available_result_types(
        project: Project,
        result_set_id: int,
        candidates: Sequence[str],
    ) -> set[str]:
        if not candidates:
            return set()
        return set(
            JointResultsCache.objects.filter(
                project=project,
                result_set_id=result_set_id,
                result_type__in=candidates,
            ).values_list("result_type", flat=True)
        )

    @staticmethod
    def list_entries(project: Project, result_set_id: int, result_type: str):
        return list(
            JointResultsCache.objects.filter(
                project=project,
                result_set_id=result_set_id,
                result_type=result_type,
            ).order_by("unique_name")
        )


class AbsoluteMaxMinDriftRepository:
    """Query operations for precomputed drift max/min tables."""

    @staticmethod
    def list_entries(project: Project, result_set_id: int):
        return list(
            AbsoluteMaxMinDrift.objects.filter(
                project=project,
                result_set_id=result_set_id,
            )
            .select_related("story", "load_case")
            .order_by("-story__sort_order")
        )


class TimeSeriesGlobalCacheRepository:
    """Query operations for time-series cache tables."""

    @staticmethod
    def list_entries(
        project: Project,
        *,
        result_set_id: int,
        load_case_name: str,
        direction: str,
        result_type: str | None = None,
        result_types: Sequence[str] | None = None,
    ):
        filters: dict[str, object] = {
            "project": project,
            "result_set_id": result_set_id,
            "load_case_name": load_case_name,
            "direction": direction,
        }

        queryset = TimeSeriesGlobalCache.objects.filter(**filters)
        if result_type is not None:
            queryset = queryset.filter(result_type=result_type)
        if result_types is not None:
            queryset = queryset.filter(result_type__in=list(result_types))

        return list(
            queryset.select_related("story").order_by("-story_sort_order")
        )

    @staticmethod
    def list_load_case_names(project: Project, result_set_id: int | None = None) -> list[str]:
        queryset = TimeSeriesGlobalCache.objects.filter(project=project)
        if result_set_id is not None:
            queryset = queryset.filter(result_set_id=result_set_id)

        return list(queryset.values_list("load_case_name", flat=True).distinct())
