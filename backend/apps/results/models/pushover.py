"""
Pushover analysis models.
"""
from django.db import models

from apps.projects.models import Project
from .result_sets import ResultSet


class PushoverCase(models.Model):
    """Pushover analysis case definition."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="pushover_cases")
    result_set = models.ForeignKey(
        ResultSet, on_delete=models.CASCADE, null=True, blank=True, related_name="pushover_cases"
    )

    name = models.CharField(max_length=100)  # e.g., Push_Mod_X+Ecc+

    DIRECTION_CHOICES = [
        ("X", "X"),
        ("Y", "Y"),
        ("XY", "XY"),
    ]
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)

    base_story = models.CharField(max_length=100, blank=True)  # Base story for shear
    description = models.TextField(blank=True)

    class Meta:
        db_table = "pushover_cases"
        unique_together = ["project", "result_set", "name"]
        ordering = ["name"]

    def __str__(self):
        return f"{self.project.name} - {self.name}"


class PushoverCurvePoint(models.Model):
    """Individual point on a pushover curve."""

    pushover_case = models.ForeignKey(
        PushoverCase, on_delete=models.CASCADE, related_name="curve_points"
    )

    step_number = models.IntegerField()
    displacement = models.FloatField()  # Roof displacement (mm)
    base_shear = models.FloatField()  # Base shear force (kN)

    class Meta:
        db_table = "pushover_curve_points"
        ordering = ["step_number"]
        indexes = [
            models.Index(fields=["pushover_case", "step_number"]),
        ]

    def __str__(self):
        return f"Step {self.step_number}: D={self.displacement}mm, V={self.base_shear}kN"
