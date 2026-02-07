"""
Result set models - ResultSet, ResultCategory, ComparisonSet.
"""
from django.db import models

from apps.projects.models import Project


class ResultSet(models.Model):
    """
    Named collection of results (e.g., DES, MCE, SLE).
    """

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="result_sets")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    ANALYSIS_TYPE_CHOICES = [
        ("NLTHA", "NLTHA"),
        ("Pushover", "Pushover"),
    ]
    analysis_type = models.CharField(max_length=50, choices=ANALYSIS_TYPE_CHOICES, default="NLTHA")

    CACHE_STATUS_CHOICES = [
        ("none", "No Cache"),
        ("building", "Building"),
        ("ready", "Ready"),
        ("stale", "Stale"),
    ]
    cache_status = models.CharField(max_length=20, choices=CACHE_STATUS_CHOICES, default="none")
    cache_built_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "result_sets"
        unique_together = ["project", "name"]
        ordering = ["name"]

    def __str__(self):
        return f"{self.project.name} - {self.name}"


class ResultCategory(models.Model):
    """
    Category within a result set (e.g., Envelopes, Time-Series).
    """

    result_set = models.ForeignKey(ResultSet, on_delete=models.CASCADE, related_name="categories")

    CATEGORY_NAME_CHOICES = [
        ("Envelopes", "Envelopes"),
        ("Time-Series", "Time-Series"),
    ]
    category_name = models.CharField(max_length=50, choices=CATEGORY_NAME_CHOICES)

    CATEGORY_TYPE_CHOICES = [
        ("Global", "Global"),
        ("Elements", "Elements"),
        ("Joints", "Joints"),
    ]
    category_type = models.CharField(max_length=50, choices=CATEGORY_TYPE_CHOICES)

    class Meta:
        db_table = "result_categories"
        unique_together = ["result_set", "category_name", "category_type"]

    def __str__(self):
        return f"{self.result_set.name} - {self.category_name}/{self.category_type}"


class ComparisonSet(models.Model):
    """
    Configuration for comparing multiple result sets.
    """

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="comparison_sets")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    # JSON arrays
    result_set_ids = models.JSONField(default=list)  # [1, 2, 3]
    result_types = models.JSONField(default=list)  # ['Drifts', 'Forces', ...]

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "comparison_sets"
        unique_together = ["project", "name"]
        ordering = ["name"]

    def __str__(self):
        return f"{self.project.name} - {self.name}"

    @property
    def result_sets(self):
        """Get the ResultSet objects for this comparison."""
        return ResultSet.objects.filter(id__in=self.result_set_ids)
