"""
Django development settings for RPS project.
"""
from .base import *  # noqa: F401, F403

DEBUG = True

# Development-specific apps
INSTALLED_APPS += ['debug_toolbar']  # noqa: F405

MIDDLEWARE.insert(0, 'debug_toolbar.middleware.DebugToolbarMiddleware')  # noqa: F405

# Dev authentication (auto-login for local development)
if config('DEV_AUTO_LOGIN', default=True, cast=bool):  # noqa: F405
    REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES'] = (  # noqa: F405
        'rps.auth.DevAutoLoginAuthentication',
    )

# Debug toolbar
INTERNAL_IPS = ['127.0.0.1', 'localhost']

# Allow all hosts in development
ALLOWED_HOSTS = ['*']

# Email backend for development
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}
