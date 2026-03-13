"""Strict bulk write helpers for importer services."""

from collections import Counter
from typing import Callable, Iterator, Sequence, Tuple, TypeVar

from django.db import IntegrityError, models, transaction

ModelT = TypeVar("ModelT", bound=models.Model)
KeyT = Tuple[object, ...]

DEFAULT_BULK_CREATE_BATCH_SIZE = 1000


class BulkWriteConflictError(ValueError):
    """Raised when bulk inserts detect duplicate or conflicting rows."""


def _find_duplicate_keys(
    objects: Sequence[ModelT],
    key_builder: Callable[[ModelT], KeyT],
) -> list[KeyT]:
    key_counts = Counter(key_builder(obj) for obj in objects)
    return [key for key, count in key_counts.items() if count > 1]


def _iter_batches(objects: Sequence[ModelT], batch_size: int) -> Iterator[Sequence[ModelT]]:
    for start in range(0, len(objects), batch_size):
        yield objects[start : start + batch_size]


def bulk_create_strict(
    model_cls: type[ModelT],
    objects: Sequence[ModelT],
    *,
    context: str,
    key_builder: Callable[[ModelT], KeyT] | None = None,
    batch_size: int = DEFAULT_BULK_CREATE_BATCH_SIZE,
) -> int:
    """Bulk-create rows and fail with explicit errors on conflicts."""
    if not objects:
        return 0
    if batch_size < 1:
        raise ValueError("batch_size must be greater than 0.")

    prepared_objects = objects if isinstance(objects, list) else list(objects)

    if key_builder is not None:
        duplicate_keys = _find_duplicate_keys(prepared_objects, key_builder)
        if duplicate_keys:
            raise BulkWriteConflictError(
                f"Duplicate {model_cls.__name__} rows in batch during {context}. "
                f"duplicate_keys={len(duplicate_keys)} sample_key={duplicate_keys[0]!r}"
            )

    try:
        created_count = 0
        with transaction.atomic():
            for batch in _iter_batches(prepared_objects, batch_size):
                model_cls.objects.bulk_create(batch, batch_size=batch_size)
                created_count += len(batch)
    except IntegrityError as exc:
        raise BulkWriteConflictError(
            f"Failed to insert {model_cls.__name__} rows during {context}. "
            "A database constraint conflict was detected."
        ) from exc

    return created_count
