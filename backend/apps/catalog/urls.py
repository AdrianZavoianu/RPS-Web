"""URL patterns for catalog app (project CRUD)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CatalogProjectViewSet

app_name = "catalog"

router = DefaultRouter()
router.register("", CatalogProjectViewSet, basename="projects")

urlpatterns = [
    path("", include(router.urls)),
]
