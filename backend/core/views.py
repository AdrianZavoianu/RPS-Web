"""Core views for infrastructure endpoints."""

from django.db import connection
from django.http import JsonResponse


def health_check(request):
    """Lightweight health check with DB ping."""
    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        db_ok = False

    status = "ok" if db_ok else "degraded"
    return JsonResponse(
        {"status": status, "db": "ok" if db_ok else "error"},
        status=200 if db_ok else 503,
    )
