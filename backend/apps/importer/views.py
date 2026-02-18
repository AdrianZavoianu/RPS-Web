"""Views for importer app."""

from pathlib import Path
from typing import Any, Callable

from django.conf import settings
from django.shortcuts import get_object_or_404
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
)
from apps.importer.services.prescan import (
    ImportPrescanError,
    get_prescan_payload_for_job,
    start_prescan_job,
)
from apps.importer.services.start import (
    ImportStartError,
    start_nltha_import_job,
    start_pushover_import_job,
)
from apps.importer.services.upload import (
    create_import_job,
    create_upload_directory,
    save_uploaded_files,
)
from apps.importer.tasks import (
    import_pushover_curves_task,
    import_pushover_results_task,
    prescan_files_task,
    process_import_task,
)


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
        return self.get_project_for_slug(
            slug,
            create_if_missing=True,
            user=self.request.user,
        )

    def get_queryset(self, project: Project):
        """Get import jobs for project."""
        return ImportJob.objects.filter(project=project)

    def _get_job(self, project: Project, pk: Any) -> ImportJob:
        return get_object_or_404(ImportJob, project=project, pk=pk)

    def _start_import_action(
        self,
        *,
        project_slug: str | None,
        pk: Any,
        request_data: Any,
        start_handler: Callable[..., dict[str, Any]],
        task: Any,
        task_started_message: str,
    ) -> Response:
        """Run a start-flow service handler and map domain errors to HTTP responses."""
        project = self.get_project(project_slug)
        job = self._get_job(project, pk)
        try:
            payload = start_handler(
                job=job,
                project=project,
                request_data=request_data,
                task=task,
                task_started_message=task_started_message,
            )
        except ImportStartError as exc:
            return Response({"detail": exc.detail}, status=exc.status_code)
        return Response(payload)

    def list(self, request, project_slug=None):
        """List all import jobs for a project."""
        project = self.get_project(project_slug)
        jobs = self.get_queryset(project).order_by("-created_at")[:20]
        serializer = ImportJobSerializer(jobs, many=True)
        return Response(serializer.data)

    def retrieve(self, request, project_slug=None, pk=None):
        """Get a specific import job status."""
        project = self.get_project(project_slug)
        job = self._get_job(project, pk)
        serializer = ImportJobSerializer(job)
        return Response(serializer.data)

    def destroy(self, request, project_slug=None, pk=None):
        """Cancel an import job."""
        project = self.get_project(project_slug)
        job = self._get_job(project, pk)

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

        upload_dir, upload_timestamp = create_upload_directory(
            settings.MEDIA_ROOT,
            project_slug or project.slug,
        )
        try:
            saved_paths = save_uploaded_files(files, upload_dir)
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        job = create_import_job(
            project=project,
            user=request.user,
            upload_dir=upload_dir,
            upload_timestamp=upload_timestamp,
            saved_paths=saved_paths,
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
        job = self._get_job(project, pk)

        if request.method == "POST":
            try:
                payload = start_prescan_job(
                    job=job,
                    task=prescan_files_task,
                    task_started_message="Prescan started",
                )
            except ImportPrescanError as exc:
                return Response({"detail": exc.detail}, status=exc.status_code)
            return Response(payload)

        try:
            payload = get_prescan_payload_for_job(job)
        except ImportPrescanError as exc:
            return Response(
                {"detail": exc.detail},
                status=exc.status_code,
            )
        return Response(payload)

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, project_slug=None, pk=None):
        """Start the import process.

        Request body:
            - selected_load_cases: List of load case names to import
            - conflict_resolutions: List of {sheet, load_case, chosen_file}
            - result_set_name: Name for the result set
            - result_set_id: Optional existing result set ID
        """
        return self._start_import_action(
            project_slug=project_slug,
            pk=pk,
            request_data=request.data,
            start_handler=start_nltha_import_job,
            task=process_import_task,
            task_started_message="Import started",
        )

    @action(detail=True, methods=["post"], url_path="start-pushover")
    def start_pushover(self, request, project_slug=None, pk=None):
        """Start a pushover curve import.

        Request body:
            - result_set_name: Name for the result set (default: 'Pushover Results')
            - result_set_id: Optional existing result set ID
        """
        return self._start_import_action(
            project_slug=project_slug,
            pk=pk,
            request_data=request.data,
            start_handler=start_pushover_import_job,
            task=import_pushover_curves_task,
            task_started_message="Pushover import started",
        )

    @action(detail=True, methods=["post"], url_path="start-pushover-results")
    def start_pushover_results(self, request, project_slug=None, pk=None):
        """Start a pushover global results import.

        Request body:
            - result_set_name: Name for the result set (default: 'Pushover Results')
            - result_set_id: Optional existing result set ID
        """
        return self._start_import_action(
            project_slug=project_slug,
            pk=pk,
            request_data=request.data,
            start_handler=start_pushover_import_job,
            task=import_pushover_results_task,
            task_started_message="Pushover results import started",
        )
