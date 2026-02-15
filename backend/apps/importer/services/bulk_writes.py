"""Strict bulk write helpers for importer services."""

from collections import Counter
from typing import Callable, Sequence, Tuple, TypeVar

from django.db import IntegrityError, models

ModelT = TypeVar("ModelT", bound=models.Model)
KeyT = Tuple[object, ...]


class BulkWriteConflictError(ValueError):
    """Raised when bulk inserts detect duplicate or conflicting rows."""


def _find_duplicate_keys(
    objects: Sequence[ModelT],
    key_builder: Callable[[ModelT], KeyT],
) -> list[KeyT]:
    key_counts = Counter(key_builder(obj) for obj in objects)
    return [key for key, count in key_counts.items() if count > 1]


def bulk_create_strict(
    model_cls: type[ModelT],
    objects: Sequence[ModelT],
    *,
    context: str,
    key_builder: Callable[[ModelT], KeyT] | None = None,
) -> int:
    """Bulk-create rows and fail with explicit errors on conflicts."""
    if not objects:
        return 0

    if key_builder is not None:
        duplicate_keys = _find_duplicate_keys(objects, key_builder)
        if duplicate_keys:
            raise BulkWriteConflictError(
                f"Duplicate {model_cls.__name__} rows in batch during {context}. "
                f"duplicate_keys={len(duplicate_keys)} sample_key={duplicate_keys[0]!r}"
            )

    try:
        model_cls.objects.bulk_create(list(objects))
    except IntegrityError as exc:
        raise BulkWriteConflictError(
            f"Failed to insert {model_cls.__name__} rows during {context}. "
            "A database constraint conflict was detected."
        ) from exc

    return len(objects)
