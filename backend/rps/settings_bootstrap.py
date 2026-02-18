"""Shared runtime settings-module bootstrap for Django entrypoints."""

import os


_KNOWN_SETTINGS_MODULES = {
    "development": "rps.settings.development",
    "production": "rps.settings.production",
    "test": "rps.settings.test",
}


def resolve_django_settings_module() -> str:
    """Resolve settings module from env with a single canonical policy."""
    explicit_module = os.getenv("DJANGO_SETTINGS_MODULE")
    if explicit_module:
        return explicit_module

    environment = os.getenv("RPS_ENV")
    if not environment:
        raise RuntimeError(
            "Missing settings module. Set DJANGO_SETTINGS_MODULE explicitly "
            "or set RPS_ENV to one of: development, production, test."
        )

    normalized = environment.strip().lower()
    if normalized not in _KNOWN_SETTINGS_MODULES:
        expected = ", ".join(sorted(_KNOWN_SETTINGS_MODULES.keys()))
        raise RuntimeError(
            f"Invalid RPS_ENV={environment!r}. Expected one of: {expected}."
        )
    return _KNOWN_SETTINGS_MODULES[normalized]


def configure_django_settings_module() -> str:
    """Set and return DJANGO_SETTINGS_MODULE if not already configured."""
    module = resolve_django_settings_module()
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", module)
    return module
