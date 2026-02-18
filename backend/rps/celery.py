"""
Celery configuration for RPS project.
"""
import os

from celery import Celery
from decouple import config

from rps.settings_bootstrap import configure_django_settings_module

# Optional celery-specific settings module override.
celery_settings_module = config("CELERY_DJANGO_SETTINGS_MODULE", default=None)
if celery_settings_module:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", celery_settings_module)

# Set Django settings module for Celery.
configure_django_settings_module()

app = Celery("rps")

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Load task modules from all registered Django apps.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
