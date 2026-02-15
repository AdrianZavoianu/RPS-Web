"""
Views for exporter app.
"""
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.request import Request
from celery.result import AsyncResult

from core.mixins import ProjectLookupMixin
from .models import ExportJob
from .serializers import ExportJobSerializer, ExportRequestSerializer
from .progress_events import send_error as send_export_error
from .tasks import process_export_job


class ExportProjectMixin(ProjectLookupMixin):
    permission_classes = [permissions.IsAuthenticated]

    def get_project(self, slug: str):
        return self.get_project_for_slug(
            slug,
            create_if_missing=False,
            user=self.request.user,
        )


class ExportJobListView(ExportProjectMixin, APIView):
    """List export jobs or create new export."""

    def get(self, request: Request, slug: str) -> Response:
        """List export jobs for project."""
        project = self.get_project(slug)
        jobs = ExportJob.objects.filter(project=project).order_by("-created_at")[:20]
        serializer = ExportJobSerializer(jobs, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request: Request, slug: str) -> Response:
        """Start a new export job."""
        project = self.get_project(slug)

        serializer = ExportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Create export job
        job = ExportJob.objects.create(
            project=project,
            user=request.user,
            export_format=data["format"],
            export_config={
                "result_set_id": data["result_set_id"],
                "result_types": data.get("result_types", []),
                "element_types": data.get("element_types", []),
                "joint_types": data.get("joint_types", []),
                "directions": data.get("directions", ["X", "Y"]),
                "include_summary": data.get("include_summary", True),
            },
            status="pending",
        )

        # Start Celery task
        task = process_export_job.delay(job.id)
        job.celery_task_id = task.id
        job.save()

        response_serializer = ExportJobSerializer(job, context={"request": request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class ExportJobDetailView(ExportProjectMixin, APIView):
    """Get export job status or cancel job."""

    def get(self, request: Request, slug: str, job_id: int) -> Response:
        """Get export job status."""
        project = self.get_project(slug)
        job = get_object_or_404(ExportJob, id=job_id, project=project)
        serializer = ExportJobSerializer(job, context={"request": request})
        return Response(serializer.data)

    def delete(self, request: Request, slug: str, job_id: int) -> Response:
        """Cancel export job."""
        project = self.get_project(slug)
        job = get_object_or_404(ExportJob, id=job_id, project=project)

        if job.status in ["pending", "processing"]:
            if job.celery_task_id:
                AsyncResult(job.celery_task_id).revoke(terminate=True)
            job.status = "failed"
            job.error_message = "Cancelled by user"
            job.save(update_fields=["status", "error_message"])
            send_export_error(job.id, "Export cancelled", "Cancelled by user")

        return Response(status=status.HTTP_204_NO_CONTENT)


class ExportDownloadView(ExportProjectMixin, APIView):
    """Download exported file."""

    def get(self, request: Request, slug: str, job_id: int) -> FileResponse:
        """Download the exported file."""
        project = self.get_project(slug)
        job = get_object_or_404(ExportJob, id=job_id, project=project)

        if job.status != "completed" or not job.output_file:
            raise Http404("Export file not available")

        response = FileResponse(
            job.output_file.open("rb"),
            as_attachment=True,
            filename=job.file_name or f"export_{job.id}.{job.export_format}",
        )
        return response
