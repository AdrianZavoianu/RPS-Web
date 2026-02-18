"""
WSGI config for RPS project.
"""

from django.core.wsgi import get_wsgi_application

from rps.settings_bootstrap import configure_django_settings_module

configure_django_settings_module()

application = get_wsgi_application()
