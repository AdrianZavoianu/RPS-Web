"""
Import job tracking models.
"""
from django.conf import settings
from django.db import models

from apps.projects.models import Project
from apps.results.models import ResultSet


class ImportJob(models.Model):
    """Tracks import job status and progress."""
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='import_jobs'
    )
    result_set = models.ForeignKey(
        ResultSet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='import_jobs'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='import_jobs'
    )

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('scanning', 'Scanning'),
        ('processing', 'Processing'),
        ('building_cache', 'Building Cache'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Job configuration
    job_config = models.JSONField(default=dict)  # Selected load cases, conflict resolutions
    files = models.JSONField(default=list)       # List of uploaded file paths

    # Progress tracking
    current_phase = models.CharField(max_length=50, blank=True)
    progress_current = models.IntegerField(default=0)
    progress_total = models.IntegerField(default=0)

    # Results
    error_message = models.TextField(blank=True)
    import_summary = models.JSONField(default=dict)  # Stats after completion

    # Celery task tracking
    celery_task_id = models.CharField(max_length=255, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'import_jobs'
        ordering = ['-created_at']

    def __str__(self):
        return f"Import {self.id} - {self.project.name} ({self.status})"

    @property
    def progress_percent(self):
        if self.progress_total == 0:
            return 0
        return int((self.progress_current / self.progress_total) * 100)
