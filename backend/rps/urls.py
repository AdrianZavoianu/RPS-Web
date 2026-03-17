"""
URL configuration for RPS project.
"""
from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core.views import health_check

urlpatterns = [
    path("admin/", admin.site.urls),
    # Health check
    path("api/health/", health_check, name="health-check"),
    # API documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # API endpoints
    path("api/auth/", include("apps.users.urls")),
    path("api/projects/", include("apps.catalog.urls")),  # Project CRUD (catalog)
    path("api/projects/", include("apps.projects.urls")),  # Project data (stories, load cases, etc)
    path("api/projects/", include("apps.results.urls")),  # Project results
    path("api/projects/", include("apps.importer.urls")),  # Project imports
    path("api/projects/", include("apps.exporter.urls")),  # Project exports
    path("api/projects/", include("apps.reporting.urls")),  # Project reports
]

# Debug toolbar in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    try:
        import debug_toolbar

        urlpatterns = [path("__debug__/", include(debug_toolbar.urls))] + urlpatterns
    except ImportError:
        pass
