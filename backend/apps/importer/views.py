"""Views for importer app."""

import logging
from pathlib import Path

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import get_valid_filename
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from core.mixins import ProjectLookupMixin
from apps.projects.models import Project
from apps.importer.models import ImportJob
from apps.importer.serializers import (
    ImportJobSerializer,
    ImportJobCreateSerializer,
    ImportStartSerializer,
)
from apps.importer.services.import_preparation import detect_conflicts
from apps.importer.tasks import prescan_files_task, process_import_task, import_pushover_curves_task

logger = logging.getLogger(__name__)


class ImportViewSet(ProjectLookupMixin, ViewSet):
    """ViewSet for import operations.

    Endpoints:
        POST   /api/projects/{slug}/imports/upload/     - Upload files, create job
        POST   /api/projects/{slug}/imports/{id}/prescan/  - Trigger prescan
        GET    /api/projects/{slug}/imports/{id}/prescan/  - Get prescan results
        POST   /api/projects/{slug}/imports/{id}/start/    - Start import
        GET    /api/projects/{slug}/imports/{id}/          - Get job status
        DELETE /api/projects/{slug}/imports/{id}/          - Cancel job
        GET    /api/projects/{slug}/imports/               - List jobs
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, JSONParser]

    def get_project(self, slug: str) -> Project:
        """Get project by slug."""
        return self.get_project_for_slug(slug, create_if_missing=True)

    def get_queryset(self, project: Project):
        """Get import jobs for project."""
        return ImportJob.objects.filter(project=project)

    def list(self, request, project_slug=None):
        """List all import jobs for a project."""
        project = self.get_project(project_slug)
        jobs = self.get_queryset(project).order_by("-created_at")[:20]
        serializer = ImportJobSerializer(jobs, many=True)
        return Response(serializer.data)

    def retrieve(self, request, project_slug=None, pk=None):
        """Get a specific import job status."""
        project = self.get_project(project_slug)
        job = get_object_or_404(ImportJob, project=project, pk=pk)
        serializer = ImportJobSerializer(job)
        return Response(serializer.data)

    def destroy(self, request, project_slug=None, pk=None):
        """Cancel an import job."""
        project = self.get_project(project_slug)
        job = get_object_or_404(ImportJob, project=project, pk=pk)

        if job.status in ("completed", "failed", "cancelled"):
            return Response(
                {"detail": f"Job already {job.status}"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Cancel celery task if running
        if job.celery_task_id:
            from celery.result import AsyncResult

            AsyncResult(job.celery_task_id).revoke(terminate=True)

        job.status = "cancelled"
        job.save()

        return Response({"detail": "Job cancelled"})

    @action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request, project_slug=None):
        """Upload files and create an import job.

        Request:
            - files: List of Excel files (multipart)

        Returns:
            - job_id: Created job ID
            - files_uploaded: Number of files uploaded
        """
        project = self.get_project(project_slug)

        serializer = ImportJobCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        files = request.FILES.getlist("files")
        if not files:
            return Response({"detail": "No files uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        # Create upload directory per project and upload timestamp
        upload_root = Path(settings.MEDIA_ROOT) / "imports" / project_slug
        upload_root.mkdir(parents=True, exist_ok=True)
        timestamp = timezone.localtime().strftime("%Y%m%d_%H%M%S")
        upload_dir = upload_root / timestamp
        counter = 1
        while upload_dir.exists():
            upload_dir = upload_root / f"{timestamp}_{counter}"
            counter += 1
        upload_dir.mkdir(parents=True, exist_ok=False)

        # Save files
        saved_paths = []
        for file in files:
            filename = file.name.split("/")[-1].split("\\")[-1]
            safe_filename = get_valid_filename(filename)
            if safe_filename in {"", ".", ".."}:
                return Response(
                    {"detail": f"Invalid filename: {file.name}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            file_path = upload_dir / safe_filename
            with open(file_path, "wb") as dest:
                for chunk in file.chunks():
                    dest.write(chunk)
            saved_paths.append(str(file_path))

        # Create import job
        job = ImportJob.objects.create(
            project=project,
            user=request.user,
            job_config={
                "upload_dir": str(upload_dir),
                "upload_timestamp": timestamp,
            },
            files=saved_paths,
            status="pending",
        )

        return Response(
            {
                "job_id": job.id,
                "files_uploaded": len(saved_paths),
                "files": [Path(p).name for p in saved_paths],
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post", "get"], url_path="prescan")
    def prescan(self, request, project_slug=None, pk=None):
        """Trigger or get prescan results.

        POST: Trigger prescan task
        GET: Get prescan results (if available)
        """
        project = self.get_project(project_slug)
        job = get_object_or_404(ImportJob, project=project, pk=pk)

        if request.method == "POST":
            # Trigger prescan
            if job.status not in ("pending",):
                return Response(
                    {"detail": f"Cannot prescan job in status: {job.status}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            task = prescan_files_task.delay(job.id)
            job.celery_task_id = task.id
            job.save(update_fields=["celery_task_id"])

            return Response(
                {
                    "detail": "Prescan started",
                    "task_id": task.id,
                    "job_id": job.id,
                }
            )

        # GET: Return prescan results
        prescan_data = job.job_config.get("prescan")
        if not prescan_data:
            return Response(
                {"detail": "Prescan not yet complete"}, status=status.HTTP_404_NOT_FOUND
            )

        # Build load case summary for UI
        file_load_cases = prescan_data.get("file_load_cases", {})

        # Aggregate all unique load cases with their sources
        all_load_cases = {}
        for file_name, sheets in file_load_cases.items():
            for sheet_name, cases in sheets.items():
                for case in cases:
                    if case not in all_load_cases:
                        all_load_cases[case] = {"files": set(), "sheets": set()}
                    all_load_cases[case]["files"].add(file_name)
                    all_load_cases[case]["sheets"].add(sheet_name)

        # Convert to list
        load_case_list = [
            {
                "name": name,
                "files": sorted(info["files"]),
                "sheets": sorted(info["sheets"]),
            }
            for name, info in sorted(all_load_cases.items())
        ]

        # Detect conflicts
        all_case_names = set(all_load_cases.keys())
        conflicts = detect_conflicts(file_load_cases, all_case_names)

        # Mark load cases with conflicts
        for item in load_case_list:
            item["has_conflict"] = item["name"] in conflicts

        # Format conflicts for UI
        conflict_list = []
        for load_case, sheet_files in conflicts.items():
            for sheet, files in sheet_files.items():
                conflict_list.append(
                    {
                        "load_case": load_case,
                        "sheet": sheet,
                        "files": files,
                    }
                )

        return Response(
            {
                "job_id": job.id,
                "status": job.status,
                "files_scanned": prescan_data.get("files_scanned", 0),
                "load_cases": load_case_list,
                "conflicts": conflict_list,
                "foundation_joints": prescan_data.get("foundation_joints", []),
                "errors": prescan_data.get("errors", []),
            }
        )

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, project_slug=None, pk=None):
        """Start the import process.

        Request body:
            - selected_load_cases: List of load case names to import
            - conflict_resolutions: List of {sheet, load_case, chosen_file}
            - result_set_name: Name for the result set
            - result_set_id: Optional existing result set ID
        """
        project = self.get_project(project_slug)
        job = get_object_or_404(ImportJob, project=project, pk=pk)

        if job.status != "pending":
            return Response(
                {"detail": f"Cannot start job in status: {job.status}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prescan_data = job.job_config.get("prescan")
        if not prescan_data:
            return Response(
                {"detail": "Must complete prescan before starting import"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ImportStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Convert conflict resolutions list to dict format
        conflict_dict = {}
        for resolution in serializer.validated_data.get("conflict_resolutions", []):
            sheet = resolution["sheet"]
            load_case = resolution["load_case"]
            chosen_file = resolution["chosen_file"]
            if sheet not in conflict_dict:
                conflict_dict[sheet] = {}
            conflict_dict[sheet][load_case] = chosen_file

        # Update job config
        job.job_config["selected_load_cases"] = serializer.validated_data.get(
            "selected_load_cases", []
        )
        job.job_config["conflict_resolution"] = conflict_dict
        job.job_config["result_set_name"] = serializer.validated_data.get(
            "result_set_name", "Imported Results"
        )

        if serializer.validated_data.get("result_set_id"):
            job.job_config["result_set_id"] = serializer.validated_data["result_set_id"]

        job.save()

        # Start import task
        task = process_import_task.delay(job.id)
        job.celery_task_id = task.id
        job.save(update_fields=["celery_task_id"])

        return Response(
            {
                "detail": "Import started",
                "task_id": task.id,
                "job_id": job.id,
            }
        )

    @action(detail=True, methods=["post"], url_path="start-pushover")
    def start_pushover(self, request, project_slug=None, pk=None):
        """Start a pushover curve import.

        Request body:
            - result_set_name: Name for the result set (default: 'Pushover Results')
        """
        project = self.get_project(project_slug)
        job = get_object_or_404(ImportJob, project=project, pk=pk)

        if job.status not in ("pending",):
            return Response(
                {"detail": f"Cannot start job in status: {job.status}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result_set_name = request.data.get("result_set_name", "Pushover Results")

        # Update job config
        job.job_config["result_set_name"] = result_set_name
        job.save()

        # Start pushover import task
        task = import_pushover_curves_task.delay(job.id)
        job.celery_task_id = task.id
        job.save(update_fields=["celery_task_id"])

        return Response(
            {
                "detail": "Pushover import started",
                "task_id": task.id,
                "job_id": job.id,
            }
        )
