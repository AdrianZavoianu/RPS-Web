"""Upload and import-job creation helpers for importer views."""

from pathlib import Path
from typing import Any, Iterable

from django.utils import timezone
from django.utils.text import get_valid_filename

from apps.importer.models import ImportJob
from apps.projects.models import Project


def create_upload_directory(media_root: str | Path, project_slug: str) -> tuple[Path, str]:
    """Create unique upload directory for a project and return directory + timestamp."""
    upload_root = Path(media_root) / "imports" / project_slug
    upload_root.mkdir(parents=True, exist_ok=True)

    timestamp = timezone.localtime().strftime("%Y%m%d_%H%M%S")
    upload_dir = upload_root / timestamp
    counter = 1
    while upload_dir.exists():
        upload_dir = upload_root / f"{timestamp}_{counter}"
        counter += 1
    upload_dir.mkdir(parents=True, exist_ok=False)
    return upload_dir, timestamp


def sanitize_upload_filename(file_name: str) -> str:
    """Normalize and validate upload filename."""
    raw_name = file_name.split("/")[-1].split("\\")[-1]
    safe_name = get_valid_filename(raw_name)
    if safe_name in {"", ".", ".."}:
        raise ValueError(f"Invalid filename: {file_name}")
    return safe_name


def save_uploaded_files(files: Iterable[Any], upload_dir: Path) -> list[str]:
    """Persist uploaded files to target folder and return absolute paths."""
    safe_names = [sanitize_upload_filename(upload.name) for upload in files]
    saved_paths: list[str] = []
    for upload, safe_name in zip(files, safe_names):
        file_path = upload_dir / safe_name
        with open(file_path, "wb") as destination:
            for chunk in upload.chunks():
                destination.write(chunk)
        saved_paths.append(str(file_path))
    return saved_paths


def create_import_job(
    *,
    project: Project,
    user: Any,
    upload_dir: Path,
    upload_timestamp: str,
    saved_paths: list[str],
) -> ImportJob:
    """Create pending import job for uploaded files."""
    return ImportJob.objects.create(
        project=project,
        user=user,
        job_config={
            "upload_dir": str(upload_dir),
            "upload_timestamp": upload_timestamp,
        },
        files=saved_paths,
        status="pending",
    )
