"""Cache builder service for post-import cache population.

Transforms normalized result data into wide-format cache tables
optimized for tabular display and chart rendering.
"""

import logging
from typing import Callable, Dict, List, Optional

from django.utils import timezone

from apps.importer.parsers.excel_parser import TimeHistoryParseResult
from apps.projects.models import Project, Story
from apps.results.models import ResultSet

from .cache_builders import (
    ElementCacheBuilder,
    GlobalCacheBuilder,
    JointCacheBuilder,
    TimeSeriesCacheBuilder,
)

logger = logging.getLogger(__name__)


class CacheBuilderService:
    """Builds wide-format cache tables from normalized result data."""

    def __init__(
        self,
        project: Project,
        result_set: ResultSet,
        progress_callback: Optional[Callable[[str, int, int], None]] = None,
        compute_aggregates: bool = True,
    ):
        self.project = project
        self.result_set = result_set
        self.progress_callback = progress_callback or (lambda m, c, t: None)
        self.compute_aggregates = compute_aggregates

    def build_all_caches(self) -> Dict[str, int]:
        """Build all cache tables for the result set.

        Updates result_set.cache_status to track progress:
        - 'building' at start
        - 'ready' on success
        - 'stale' on failure

        Returns:
            Dict with counts of cached items by type
        """
        stats = {
            "global_cache_rows": 0,
            "element_cache_rows": 0,
            "joint_cache_rows": 0,
            "time_series_cache_rows": 0,
        }

        self.result_set.cache_status = "building"
        self.result_set.save(update_fields=["cache_status"])

        try:
            self.progress_callback("Building global results cache...", 1, 4)
            stats["global_cache_rows"] = GlobalCacheBuilder(
                project=self.project,
                result_set=self.result_set,
                compute_aggregates_enabled=self.compute_aggregates,
            ).build()

            self.progress_callback("Building element results cache...", 2, 4)
            stats["element_cache_rows"] = ElementCacheBuilder(
                project=self.project,
                result_set=self.result_set,
                compute_aggregates_enabled=self.compute_aggregates,
            ).build()

            self.progress_callback("Building joint results cache...", 3, 4)
            stats["joint_cache_rows"] = JointCacheBuilder(
                project=self.project,
                result_set=self.result_set,
                compute_aggregates_enabled=self.compute_aggregates,
            ).build()

            self.progress_callback("Cache building complete", 4, 4)

            self.result_set.cache_status = "ready"
            self.result_set.cache_built_at = timezone.now()
        except Exception:
            logger.exception(
                "Failed to build caches for project_id=%s result_set_id=%s",
                self.project.id,
                self.result_set.id,
            )
            self.result_set.cache_status = "stale"
            raise
        finally:
            self.result_set.save(update_fields=["cache_status", "cache_built_at"])

        return stats

    def build_time_series_cache(
        self,
        time_history_results: List[TimeHistoryParseResult],
        stories_map: Dict[str, Story],
    ) -> int:
        """Build TimeSeriesGlobalCache from parsed time-history data."""
        return TimeSeriesCacheBuilder(
            project=self.project,
            result_set=self.result_set,
        ).build(
            time_history_results=time_history_results,
            stories_map=stories_map,
        )
