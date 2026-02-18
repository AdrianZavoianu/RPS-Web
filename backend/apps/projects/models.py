"""
Core project models - Project, Story, LoadCase, Element.
"""
from django.db import models

from apps.catalog.models import CatalogProject


class Project(models.Model):
    """
    Per-project data container.
    Links to catalog entry for metadata.
    """

    catalog_project = models.OneToOneField(
        CatalogProject, on_delete=models.CASCADE, related_name="project_data"
    )

    # Timestamps (separate from catalog)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects"

    def __str__(self):
        return self.catalog_project.name

    @property
    def name(self):
        return self.catalog_project.name

    @property
    def slug(self):
        return self.catalog_project.slug


class Story(models.Model):
    """
    Building story/floor level.
    """

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="stories")
    name = models.CharField(max_length=100)
    elevation = models.FloatField(null=True, blank=True)
    sort_order = models.IntegerField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "stories"
        unique_together = ["project", "name"]
        ordering = ["sort_order"]
        indexes = [
            models.Index(fields=["project", "sort_order"]),
        ]

    def __str__(self):
        return f"{self.project.name} - {self.name}"


class LoadCase(models.Model):
    """
    Analysis load case (e.g., TH01, TH02, Push_X+).
    """

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="load_cases")
    name = models.CharField(max_length=100)

    CASE_TYPE_CHOICES = [
        ("Time History", "Time History"),
        ("Modal", "Modal"),
        ("Static", "Static"),
        ("Pushover", "Pushover"),
    ]
    case_type = models.CharField(max_length=50, choices=CASE_TYPE_CHOICES, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "load_cases"
        unique_together = ["project", "name"]
        ordering = ["name"]

    def __str__(self):
        return f"{self.project.name} - {self.name}"


class Element(models.Model):
    """
    Structural element (Wall, Column, Beam, etc.).
    """

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="elements")

    ELEMENT_TYPE_CHOICES = [
        ("Wall", "Wall"),
        ("Quad", "Quad"),
        ("Column", "Column"),
        ("Beam", "Beam"),
        ("Pier", "Pier"),
        ("Link", "Link"),
    ]
    element_type = models.CharField(max_length=50, choices=ELEMENT_TYPE_CHOICES)
    name = models.CharField(max_length=100)
    unique_name = models.CharField(max_length=100, blank=True)

    # Optional story association
    story = models.ForeignKey(
        Story, on_delete=models.SET_NULL, null=True, blank=True, related_name="elements"
    )

    class Meta:
        db_table = "elements"
        unique_together = ["project", "element_type", "unique_name"]
        ordering = ["element_type", "name"]
        indexes = [
            models.Index(fields=["project", "element_type"]),
        ]

    def __str__(self):
        return f"{self.element_type}: {self.name}"
