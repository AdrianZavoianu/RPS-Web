"""
Foundation/Joint result models.
"""
from django.db import models

from apps.projects.models import Project, LoadCase
from .result_sets import ResultSet, ResultCategory


class SoilPressure(models.Model):
    """Soil pressure results for foundation elements (kN/m2)."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="soil_pressures")
    result_set = models.ForeignKey(
        ResultSet, on_delete=models.CASCADE, null=True, blank=True, related_name="soil_pressures"
    )
    result_category = models.ForeignKey(
        ResultCategory,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="soil_pressures",
    )
    load_case = models.ForeignKey(LoadCase, on_delete=models.CASCADE, related_name="soil_pressures")

    shell_object = models.CharField(max_length=50)  # e.g., F27
    unique_name = models.CharField(max_length=50)  # e.g., 72

    min_pressure = models.FloatField()  # Minimum across all joints (kN/m2)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "soil_pressures"
        unique_together = ["project", "result_set", "unique_name", "load_case"]
        indexes = [
            models.Index(fields=["project", "result_set"]),
            models.Index(fields=["load_case"]),
        ]

    def __str__(self):
        return f"{self.shell_object} ({self.unique_name}): {self.min_pressure} kN/m2"


class VerticalDisplacement(models.Model):
    """Joint vertical displacement results (mm)."""

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="vertical_displacements"
    )
    result_set = models.ForeignKey(
        ResultSet,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="vertical_displacements",
    )
    result_category = models.ForeignKey(
        ResultCategory,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="vertical_displacements",
    )
    load_case = models.ForeignKey(
        LoadCase, on_delete=models.CASCADE, related_name="vertical_displacements"
    )

    story = models.CharField(max_length=20)  # Story name (e.g., L10)
    label = models.CharField(max_length=50)  # Joint label
    unique_name = models.CharField(max_length=50)  # Unique joint ID (from Fou sheet)

    min_displacement = models.FloatField()  # Minimum Uz (mm)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vertical_displacements"
        unique_together = ["project", "result_set", "unique_name", "load_case"]
        indexes = [
            models.Index(fields=["project", "result_set"]),
            models.Index(fields=["load_case"]),
        ]

    def __str__(self):
        return f"{self.label} ({self.unique_name}): {self.min_displacement} mm"
