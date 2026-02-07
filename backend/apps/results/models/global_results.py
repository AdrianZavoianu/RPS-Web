"""
Global/Story-level result models.
"""
from django.db import models

from apps.projects.models import Story, LoadCase
from .result_sets import ResultCategory


class BaseGlobalResult(models.Model):
    """Abstract base for story-level results."""
    story = models.ForeignKey(Story, on_delete=models.CASCADE)
    load_case = models.ForeignKey(LoadCase, on_delete=models.CASCADE)
    result_category = models.ForeignKey(
        ResultCategory,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    DIRECTION_CHOICES = [
        ('X', 'X'),
        ('Y', 'Y'),
        ('Z', 'Z'),
        ('UX', 'UX'),
        ('UY', 'UY'),
        ('UZ', 'UZ'),
        ('VX', 'VX'),
        ('VY', 'VY'),
    ]
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)

    # Per-result ordering (preserves Excel sheet order)
    story_sort_order = models.IntegerField(null=True, blank=True, db_index=True)

    class Meta:
        abstract = True


class StoryDrift(BaseGlobalResult):
    """Story drift results (%)."""
    drift = models.FloatField()
    max_drift = models.FloatField(null=True, blank=True)
    min_drift = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = 'story_drifts'
        indexes = [
            models.Index(fields=['story', 'load_case', 'direction']),
            models.Index(fields=['result_category']),
        ]

    def __str__(self):
        return f"{self.story.name} - {self.load_case.name} - {self.direction}: {self.drift}"


class StoryAcceleration(BaseGlobalResult):
    """Story acceleration results (g)."""
    acceleration = models.FloatField()
    max_acceleration = models.FloatField(null=True, blank=True)
    min_acceleration = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = 'story_accelerations'
        indexes = [
            models.Index(fields=['story', 'load_case', 'direction']),
            models.Index(fields=['result_category']),
        ]

    def __str__(self):
        return f"{self.story.name} - {self.load_case.name} - {self.direction}: {self.acceleration}g"


class StoryForce(BaseGlobalResult):
    """Story force/shear results (kN)."""
    LOCATION_CHOICES = [
        ('Top', 'Top'),
        ('Bottom', 'Bottom'),
    ]
    location = models.CharField(
        max_length=20,
        choices=LOCATION_CHOICES,
        blank=True
    )

    force = models.FloatField()
    max_force = models.FloatField(null=True, blank=True)
    min_force = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = 'story_forces'
        indexes = [
            models.Index(fields=['story', 'load_case', 'direction']),
            models.Index(fields=['result_category']),
        ]

    def __str__(self):
        return f"{self.story.name} - {self.load_case.name} - {self.direction}: {self.force} kN"


class StoryDisplacement(BaseGlobalResult):
    """Story displacement results (mm)."""
    displacement = models.FloatField()
    max_displacement = models.FloatField(null=True, blank=True)
    min_displacement = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = 'story_displacements'
        indexes = [
            models.Index(fields=['story', 'load_case', 'direction']),
            models.Index(fields=['result_category']),
        ]

    def __str__(self):
        return f"{self.story.name} - {self.load_case.name} - {self.direction}: {self.displacement} mm"
