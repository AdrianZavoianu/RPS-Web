"""
Element-level result models.
"""
from django.db import models

from apps.projects.models import Story, LoadCase, Element
from .result_sets import ResultCategory


class BaseElementResult(models.Model):
    """Abstract base for element-level results."""

    element = models.ForeignKey(Element, on_delete=models.CASCADE)
    story = models.ForeignKey(Story, on_delete=models.CASCADE)
    load_case = models.ForeignKey(LoadCase, on_delete=models.CASCADE)
    result_category = models.ForeignKey(
        ResultCategory, on_delete=models.CASCADE, null=True, blank=True
    )

    # Per-result ordering
    story_sort_order = models.IntegerField(null=True, blank=True, db_index=True)

    class Meta:
        abstract = True


class WallShear(BaseElementResult):
    """Wall shear force results (kN)."""

    DIRECTION_CHOICES = [
        ("V2", "V2"),
        ("V3", "V3"),
    ]
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)

    LOCATION_CHOICES = [
        ("Top", "Top"),
        ("Bottom", "Bottom"),
    ]
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES, blank=True)

    force = models.FloatField()
    max_force = models.FloatField(null=True, blank=True)
    min_force = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "wall_shears"
        indexes = [
            models.Index(fields=["element", "story", "load_case", "direction"]),
            models.Index(fields=["result_category"]),
        ]

    def __str__(self):
        return f"{self.element.name} - {self.story.name} - {self.direction}: {self.force} kN"


class QuadRotation(BaseElementResult):
    """Quad strain gauge rotation results (%)."""

    quad_name = models.CharField(max_length=50, blank=True)
    direction = models.CharField(max_length=20, blank=True)  # Typically 'Pier'

    rotation = models.FloatField()  # In radians, displayed as %
    max_rotation = models.FloatField(null=True, blank=True)
    min_rotation = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "quad_rotations"
        indexes = [
            models.Index(fields=["element", "story", "load_case"]),
            models.Index(fields=["result_category"]),
        ]

    def __str__(self):
        return f"{self.element.name} - {self.story.name}: {self.rotation}"


class ColumnShear(BaseElementResult):
    """Column shear force results (kN)."""

    DIRECTION_CHOICES = [
        ("V2", "V2"),
        ("V3", "V3"),
    ]
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)

    LOCATION_CHOICES = [
        ("Top", "Top"),
        ("Bottom", "Bottom"),
    ]
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES, blank=True)

    force = models.FloatField()
    max_force = models.FloatField(null=True, blank=True)
    min_force = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "column_shears"
        indexes = [
            models.Index(fields=["element", "story", "load_case", "direction"]),
            models.Index(fields=["result_category"]),
        ]

    def __str__(self):
        return f"{self.element.name} - {self.story.name} - {self.direction}: {self.force} kN"


class ColumnAxial(BaseElementResult):
    """Column axial force results (kN)."""

    LOCATION_CHOICES = [
        ("Top", "Top"),
        ("Bottom", "Bottom"),
    ]
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES, blank=True)

    min_axial = models.FloatField()  # Most compression (typically negative)
    max_axial = models.FloatField(null=True, blank=True)  # Most tension

    class Meta:
        db_table = "column_axials"
        indexes = [
            models.Index(fields=["element", "story", "load_case"]),
            models.Index(fields=["result_category"]),
        ]

    def __str__(self):
        return f"{self.element.name} - {self.story.name}: P={self.min_axial} kN"


class ColumnRotation(BaseElementResult):
    """Column fiber hinge rotation results (%)."""

    DIRECTION_CHOICES = [
        ("R2", "R2"),
        ("R3", "R3"),
    ]
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)

    rotation = models.FloatField()  # In radians, displayed as %
    max_rotation = models.FloatField(null=True, blank=True)
    min_rotation = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "column_rotations"
        indexes = [
            models.Index(fields=["element", "story", "load_case", "direction"]),
            models.Index(fields=["result_category"]),
        ]

    def __str__(self):
        return f"{self.element.name} - {self.story.name} - {self.direction}: {self.rotation}"


class BeamRotation(BaseElementResult):
    """Beam hinge R3 plastic rotation results (%)."""

    step_type = models.CharField(max_length=10, blank=True)  # Max, Min
    hinge = models.CharField(max_length=20, blank=True)  # SB2
    generated_hinge = models.CharField(max_length=20, blank=True)  # B19H1
    rel_dist = models.FloatField(null=True, blank=True)  # Relative distance

    r3_plastic = models.FloatField()  # In radians, displayed as %
    max_r3_plastic = models.FloatField(null=True, blank=True)
    min_r3_plastic = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "beam_rotations"
        indexes = [
            models.Index(fields=["element", "story", "load_case"]),
            models.Index(fields=["result_category"]),
        ]

    def __str__(self):
        return f"{self.element.name} - {self.story.name}: R3={self.r3_plastic}"
