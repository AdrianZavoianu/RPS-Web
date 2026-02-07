"""
Catalog models - Project metadata and listing.
"""
from django.conf import settings
from django.db import models
from django.utils.text import slugify


class CatalogProject(models.Model):
    """
    Project entry in the catalog.
    Contains metadata about the project and links to the owner.
    """
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True)

    # Owner
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='catalog_projects'
    )

    # Analysis type
    ANALYSIS_TYPE_CHOICES = [
        ('NLTHA', 'NLTHA'),
        ('Pushover', 'Pushover'),
        ('Mixed', 'Mixed'),
    ]
    analysis_type = models.CharField(
        max_length=50,
        choices=ANALYSIS_TYPE_CHOICES,
        default='NLTHA'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_opened = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'catalog_projects'
        ordering = ['-created_at']
        unique_together = ['owner', 'name']

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs) -> None:
        if not self.slug:
            self.slug = slugify(self.name)
            # Ensure uniqueness
            base_slug = self.slug
            counter = 1
            while CatalogProject.objects.filter(slug=self.slug).exclude(pk=self.pk).exists():
                self.slug = f"{base_slug}-{counter}"
                counter += 1
        super().save(*args, **kwargs)
