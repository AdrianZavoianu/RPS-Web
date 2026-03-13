"""Fallback policy helpers for cache/raw result retrieval."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Generic, TypeVar

FALLBACK_CACHE_ONLY = "cache_only"
FALLBACK_CACHE_THEN_RAW = "cache_then_raw"
ALLOWED_FALLBACK_POLICIES = {
    FALLBACK_CACHE_ONLY,
    FALLBACK_CACHE_THEN_RAW,
}

_T = TypeVar("_T")


@dataclass(frozen=True)
class FallbackSelection(Generic[_T]):
    """Selected data payload with explicit source metadata."""

    data: _T
    source: str


def resolve_fallback(
    *,
    fallback_policy: str,
    cache_loader: Callable[[], _T],
    raw_loader: Callable[[], _T],
    has_data: Callable[[_T], bool],
) -> FallbackSelection[_T]:
    """Resolve data with explicit cache/raw fallback semantics."""
    if fallback_policy not in ALLOWED_FALLBACK_POLICIES:
        allowed = ", ".join(sorted(ALLOWED_FALLBACK_POLICIES))
        raise ValueError(f"Unsupported fallback policy '{fallback_policy}'. Allowed: {allowed}")

    cached_data = cache_loader()
    if has_data(cached_data) or fallback_policy == FALLBACK_CACHE_ONLY:
        return FallbackSelection(data=cached_data, source="cache")

    return FallbackSelection(data=raw_loader(), source="raw")
