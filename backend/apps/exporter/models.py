"""
Export job tracking models.
"""
from typing import Optional

from django.conf import settings
from django.db import models

from apps.projects.models import Project


class ExportJob(models.Model):
    """Tracks export job status and output files."""
    project: models.ForeignKey = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='export_jobs'
    )
    user: models.ForeignKey = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='export_jobs'
    )

    FORMAT_CHOICES: list[tuple[str, str]] = [
        ('excel', 'Excel'),
        ('csv', 'CSV'),
        ('pdf', 'PDF'),
    ]
    export_format: models.CharField = models.CharField(max_length=20, choices=FORMAT_CHOICES)

    STATUS_CHOICES: list[tuple[str, str]] = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    status: models.CharField = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Export configuration
    export_config: models.JSONField = models.JSONField(default=dict)  # Result sets, types to export

    # Output file
    output_file: models.FileField = models.FileField(upload_to='exports/', blank=True)
    file_name: models.CharField = models.CharField(max_length=255, blank=True)
    file_size: models.BigIntegerField = models.BigIntegerField(null=True, blank=True)

    # Error tracking
    error_message: models.TextField = models.TextField(blank=True)

    # Celery task tracking
    celery_task_id: models.CharField = models.CharField(max_length=255, blank=True)

    # Timestamps
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    completed_at: models.DateTimeField = models.DateTimeField(null=True, blank=True)
    expires_at: models.DateTimeField = models.DateTimeField(null=True, blank=True)  # Auto-cleanup

    class Meta:
        db_table = 'export_jobs'
        ordering = ['-created_at']

    @property
    def progress_current(self) -> Optional[int]:
        """Current processed unit count from export metadata."""
        value = self.export_config.get('progress_current')
        return int(value) if value is not None else None

    @property
    def progress_total(self) -> Optional[int]:
        """Total unit count from export metadata."""
        value = self.export_config.get('progress_total')
        return int(value) if value is not None else None

    def __str__(self) -> str:
        return f"Export {self.id} - {self.project.name} ({self.export_format})"
