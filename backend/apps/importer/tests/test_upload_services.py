"""Unit tests for upload helper behavior."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.exceptions import SuspiciousFileOperation
from django.test import SimpleTestCase

from apps.importer.services.upload import (
    create_import_job,
    create_upload_directory,
    sanitize_upload_filename,
    save_uploaded_files,
)


class _FakeUpload:
    def __init__(self, *, name: str, chunks: list[bytes]):
        self.name = name
        self._chunks = chunks

    def chunks(self):
        for chunk in self._chunks:
            yield chunk


class UploadServiceTests(SimpleTestCase):
    def test_sanitize_upload_filename_strips_path_segments(self):
        sanitized = sanitize_upload_filename("../../nested\\folder/results file.xlsx")
        self.assertEqual(sanitized, "results_file.xlsx")

    def test_sanitize_upload_filename_rejects_dotdot_name(self):
        with self.assertRaisesRegex(SuspiciousFileOperation, "Could not derive file name"):
            sanitize_upload_filename("..")

    def test_save_uploaded_files_writes_all_chunks_and_returns_paths(self):
        with TemporaryDirectory() as tmp_dir:
            upload_dir = Path(tmp_dir) / "uploads"
            upload_dir.mkdir(parents=True, exist_ok=True)
            files = [
                _FakeUpload(name="a.xlsx", chunks=[b"ab", b"cd"]),
                _FakeUpload(name="subdir\\b.xlsx", chunks=[b"123"]),
            ]

            saved_paths = save_uploaded_files(files, upload_dir)

            self.assertEqual(saved_paths, [str(upload_dir / "a.xlsx"), str(upload_dir / "b.xlsx")])
            self.assertEqual((upload_dir / "a.xlsx").read_bytes(), b"abcd")
            self.assertEqual((upload_dir / "b.xlsx").read_bytes(), b"123")

    def test_save_uploaded_files_fails_before_writing_when_any_name_invalid(self):
        with TemporaryDirectory() as tmp_dir:
            upload_dir = Path(tmp_dir) / "uploads"
            upload_dir.mkdir(parents=True, exist_ok=True)
            files = [
                _FakeUpload(name="good.xlsx", chunks=[b"ok"]),
                _FakeUpload(name="///", chunks=[b"bad"]),
            ]

            with self.assertRaisesRegex(SuspiciousFileOperation, "Could not derive file name"):
                save_uploaded_files(files, upload_dir)

            self.assertFalse((upload_dir / "good.xlsx").exists())

    def test_create_upload_directory_uses_counter_for_timestamp_collision(self):
        with TemporaryDirectory() as tmp_dir:
            media_root = Path(tmp_dir) / "media"
            upload_root = media_root / "imports" / "my-project"
            upload_root.mkdir(parents=True, exist_ok=True)
            (upload_root / "20260218_140000").mkdir(parents=True, exist_ok=True)

            with patch("apps.importer.services.upload.timezone.localtime") as mock_localtime:
                mock_localtime.return_value = datetime(2026, 2, 18, 14, 0, 0)
                upload_dir, timestamp = create_upload_directory(media_root, "my-project")

            self.assertEqual(timestamp, "20260218_140000")
            self.assertEqual(upload_dir, upload_root / "20260218_140000_1")
            self.assertTrue(upload_dir.exists())

    @patch("apps.importer.services.upload.ImportJob.objects.create")
    def test_create_import_job_persists_expected_payload(self, mock_create):
        project = object()
        user = object()
        upload_dir = Path("/tmp/imports/project/20260218_140000")
        saved_paths = ["/tmp/imports/project/20260218_140000/a.xlsx"]
        expected_job = object()
        mock_create.return_value = expected_job

        created_job = create_import_job(
            project=project,
            user=user,
            upload_dir=upload_dir,
            upload_timestamp="20260218_140000",
            saved_paths=saved_paths,
        )

        self.assertIs(created_job, expected_job)
        mock_create.assert_called_once_with(
            project=project,
            user=user,
            job_config={
                "upload_dir": str(upload_dir),
                "upload_timestamp": "20260218_140000",
            },
            files=saved_paths,
            status="pending",
        )
