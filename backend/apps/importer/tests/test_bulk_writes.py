"""Tests for strict bulk write helpers."""

from unittest.mock import patch

from django.contrib.auth.models import Group
from django.test import SimpleTestCase, TestCase

from apps.importer.services.bulk_writes import BulkWriteConflictError, bulk_create_strict
from apps.importer.tasks import _normalized_import_errors


class BulkCreateStrictTests(TestCase):
    """Validate strict conflict handling in bulk inserts."""

    def test_bulk_create_strict_success_returns_insert_count(self):
        created_count = bulk_create_strict(
            Group,
            [Group(name="engineering"), Group(name="analysis")],
            context="test write",
            key_builder=lambda row: (row.name,),
        )

        self.assertEqual(created_count, 2)
        self.assertSetEqual(
            set(Group.objects.values_list("name", flat=True)),
            {"engineering", "analysis"},
        )

    def test_bulk_create_strict_duplicate_key_in_batch_raises(self):
        with self.assertRaises(BulkWriteConflictError) as raised:
            bulk_create_strict(
                Group,
                [Group(name="engineering"), Group(name="engineering")],
                context="test write",
                key_builder=lambda row: (row.name,),
            )

        self.assertIn("Duplicate Group rows in batch", str(raised.exception))
        self.assertEqual(Group.objects.count(), 0)

    def test_bulk_create_strict_db_integrity_error_is_wrapped(self):
        Group.objects.create(name="engineering")

        with self.assertRaises(BulkWriteConflictError) as raised:
            bulk_create_strict(
                Group,
                [Group(name="engineering")],
                context="test write",
            )

        self.assertIn("database constraint conflict", str(raised.exception).lower())

    def test_bulk_create_strict_uses_chunked_bulk_batches(self):
        rows = [Group(name=f"group-{index}") for index in range(5)]

        with patch.object(
            Group.objects,
            "bulk_create",
            wraps=Group.objects.bulk_create,
        ) as bulk_create:
            created_count = bulk_create_strict(
                Group,
                rows,
                context="chunked write",
                batch_size=2,
            )

        self.assertEqual(created_count, 5)
        self.assertEqual(bulk_create.call_count, 3)
        self.assertTrue(
            all(call.kwargs.get("batch_size") == 2 for call in bulk_create.call_args_list)
        )

    def test_bulk_create_strict_rejects_non_positive_batch_size(self):
        with self.assertRaises(ValueError):
            bulk_create_strict(
                Group,
                [Group(name="engineering")],
                context="invalid batch size",
                batch_size=0,
            )


class ImportErrorNormalizationTests(SimpleTestCase):
    """Validate import error normalization for completion summaries."""

    def test_normalized_import_errors_strips_and_drops_empty(self):
        normalized = _normalized_import_errors(
            {
                "errors": [
                    "  file-a.xlsx: duplicate rows  ",
                    "",
                    "   ",
                    "file-b.xlsx: parse failure",
                ]
            }
        )

        self.assertListEqual(
            normalized,
            [
                "file-a.xlsx: duplicate rows",
                "file-b.xlsx: parse failure",
            ],
        )

    def test_normalized_import_errors_rejects_non_list(self):
        with self.assertRaises(ValueError):
            _normalized_import_errors({"errors": "not-a-list"})

    def test_normalized_import_errors_rejects_non_string_entries(self):
        with self.assertRaises(ValueError):
            _normalized_import_errors({"errors": ["ok", 123]})
