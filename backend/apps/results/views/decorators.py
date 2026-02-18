"""Reusable decorators for results view parameter validation."""

from functools import wraps
from typing import Any, Callable, Dict

from rest_framework.response import Response


def validated_result_params(*required_fields: str) -> Callable:
    """Validate required query params and parse required *_id fields as integers."""
    required = tuple(required_fields)
    int_fields = tuple(field for field in required if field.endswith("_id"))

    def decorator(view_method: Callable) -> Callable:
        @wraps(view_method)
        def wrapper(self, request, *args, **kwargs):
            params = self.validate_result_params(request, required)
            if isinstance(params, Response):
                return params

            validated_params: Dict[str, Any] = dict(params)
            for field in int_fields:
                parsed = self.parse_int_param(validated_params[field], field)
                if isinstance(parsed, Response):
                    return parsed
                validated_params[field] = parsed

            kwargs["validated_params"] = validated_params
            return view_method(self, request, *args, **kwargs)

        return wrapper

    return decorator
