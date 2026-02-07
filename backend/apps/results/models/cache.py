"""
Cache models for fast data retrieval.
Wide-format denormalized tables optimized for tabular display.
"""
from django.db import models

from apps.projects.models import Project, Story, LoadCase, Element
from .result_sets import ResultSet


class GlobalResultsCache(models.Model):
    """
    Wide-format cache for global/story-level results.
    One row per story with all load cases as JSON columns.
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='global_cache'
    )
    result_set = models.ForeignKey(
        ResultSet,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='global_cache'
    )

    # Result type: Drifts, Accelerations, Forces, Displacements + direction suffix
    result_type = models.CharField(max_length=50)

    story = models.ForeignKey(
        Story,
        on_delete=models.CASCADE,
        related_name='global_cache'
    )

    # Wide-format data: {"TH01_X": 0.0023, "TH02_X": 0.0019, ...}
    results_matrix = models.JSONField(default=dict)

    # Pre-computed aggregates (computed during cache build)
    avg_value = models.FloatField(null=True, blank=True)
    max_value = models.FloatField(null=True, blank=True)
    min_value = models.FloatField(null=True, blank=True)
    load_case_count = models.IntegerField(default=0)

    # Per-result-type ordering
    story_sort_order = models.IntegerField(null=True, blank=True, db_index=True)

    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'global_results_cache'
        indexes = [
            models.Index(fields=['project', 'result_set', 'result_type']),
            models.Index(fields=['project', 'result_type']),
            models.Index(fields=['story']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'result_set', 'result_type', 'story'],
                name='unique_global_cache_row'
            )
        ]

    def __str__(self):
        return f"{self.result_type} - {self.story.name}"


class ElementResultsCache(models.Model):
    """
    Wide-format cache for element-level results.
    One row per (element, story) with all load cases.
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='element_cache'
    )
    result_set = models.ForeignKey(
        ResultSet,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='element_cache'
    )

    # Result type with direction: WallShears_V2, ColumnShears_V3, etc.
    result_type = models.CharField(max_length=50)

    element = models.ForeignKey(
        Element,
        on_delete=models.CASCADE,
        related_name='element_cache'
    )
    story = models.ForeignKey(
        Story,
        on_delete=models.CASCADE,
        related_name='element_cache'
    )

    # Wide-format data: {"TH01": 123.4, "TH02": 145.6, ...}
    results_matrix = models.JSONField(default=dict)

    # Pre-computed aggregates (computed during cache build)
    avg_value = models.FloatField(null=True, blank=True)
    max_value = models.FloatField(null=True, blank=True)
    min_value = models.FloatField(null=True, blank=True)
    load_case_count = models.IntegerField(default=0)

    story_sort_order = models.IntegerField(null=True, blank=True, db_index=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'element_results_cache'
        indexes = [
            models.Index(fields=['project', 'result_set', 'result_type', 'element']),
            models.Index(fields=['project', 'result_type']),
            models.Index(fields=['element']),
            models.Index(fields=['story']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'result_set', 'result_type', 'element', 'story'],
                name='unique_element_cache_row'
            )
        ]

    def __str__(self):
        return f"{self.result_type} - {self.element.name} - {self.story.name}"


class JointResultsCache(models.Model):
    """
    Wide-format cache for foundation/joint results.
    One row per foundation element with all load cases.
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='joint_cache'
    )
    result_set = models.ForeignKey(
        ResultSet,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='joint_cache'
    )

    # Result type: SoilPressures_Min, VerticalDisplacements_Min
    result_type = models.CharField(max_length=50)

    shell_object = models.CharField(max_length=50)
    unique_name = models.CharField(max_length=50)

    # Wide-format data: {"TH01": -450.2, "TH02": -380.5, ...}
    results_matrix = models.JSONField(default=dict)

    # Pre-computed aggregates (computed during cache build)
    avg_value = models.FloatField(null=True, blank=True)
    max_value = models.FloatField(null=True, blank=True)
    min_value = models.FloatField(null=True, blank=True)
    load_case_count = models.IntegerField(default=0)

    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'joint_results_cache'
        unique_together = ['project', 'result_set', 'result_type', 'unique_name']
        indexes = [
            models.Index(fields=['project', 'result_set', 'result_type']),
            models.Index(fields=['project', 'result_type']),
        ]

    def __str__(self):
        return f"{self.result_type} - {self.shell_object} ({self.unique_name})"


class AbsoluteMaxMinDrift(models.Model):
    """
    Envelope analysis cache for absolute max/min drifts.
    Stores the larger of |Max| vs |Min| for each story/load case/direction.
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='maxmin_drifts'
    )
    result_set = models.ForeignKey(
        ResultSet,
        on_delete=models.CASCADE,
        related_name='maxmin_drifts'
    )
    story = models.ForeignKey(
        Story,
        on_delete=models.CASCADE,
        related_name='maxmin_drifts'
    )
    load_case = models.ForeignKey(
        LoadCase,
        on_delete=models.CASCADE,
        related_name='maxmin_drifts'
    )

    DIRECTION_CHOICES = [
        ('X', 'X'),
        ('Y', 'Y'),
    ]
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)

    absolute_max_drift = models.FloatField()  # max(|max_drift|, |min_drift|)

    SIGN_CHOICES = [
        ('positive', 'Positive'),
        ('negative', 'Negative'),
    ]
    sign = models.CharField(max_length=10, choices=SIGN_CHOICES)

    # Original values for reference
    original_max = models.FloatField()
    original_min = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'absolute_maxmin_drifts'
        unique_together = ['project', 'result_set', 'story', 'load_case', 'direction']
        indexes = [
            models.Index(fields=['result_set']),
        ]

    def __str__(self):
        return f"{self.story.name} - {self.load_case.name} - {self.direction}: {self.absolute_max_drift}"


class TimeSeriesGlobalCache(models.Model):
    """
    Time-series data cache for animated visualization.
    Stores time-step arrays per story for global results.
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='time_series_cache'
    )
    result_set = models.ForeignKey(
        ResultSet,
        on_delete=models.CASCADE,
        related_name='time_series_cache'
    )

    load_case_name = models.CharField(max_length=100)  # e.g., TH02
    result_type = models.CharField(max_length=50)      # Drifts, Displacements, etc.

    DIRECTION_CHOICES = [
        ('X', 'X'),
        ('Y', 'Y'),
    ]
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)

    story = models.ForeignKey(
        Story,
        on_delete=models.CASCADE,
        related_name='time_series_cache'
    )

    # JSON arrays for time-series data
    time_steps = models.JSONField(default=list)  # [0.0, 0.01, 0.02, ...]
    values = models.JSONField(default=list)      # [0.0012, 0.0015, 0.0018, ...]

    story_sort_order = models.IntegerField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'time_series_global_cache'
        unique_together = [
            'project', 'result_set', 'load_case_name', 'result_type', 'direction', 'story'
        ]
        indexes = [
            models.Index(fields=['project', 'result_set', 'load_case_name', 'result_type', 'direction']),
            models.Index(fields=['story']),
        ]

    def __str__(self):
        return f"{self.load_case_name} - {self.result_type} {self.direction} - {self.story.name}"
