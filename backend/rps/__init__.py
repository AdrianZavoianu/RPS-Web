"""RPS package bootstrap."""

from __future__ import annotations

import os


def _is_test_runtime() -> bool:
    settings_module = os.getenv("DJANGO_SETTINGS_MODULE", "")
    return settings_module.endswith(".test") or os.getenv("RPS_ENV", "").lower() == "test"


try:
    # Ensure Celery app is imported for non-test runtimes.
    from .celery import app as celery_app
except ModuleNotFoundError as exc:
    if exc.name != "celery" or not _is_test_runtime():
        raise
    celery_app = None  # type: ignore[assignment]


__all__ = ("celery_app",)
