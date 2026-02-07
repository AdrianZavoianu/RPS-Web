import os

from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication


class DevAutoLoginAuthentication(BaseAuthentication):
    """Authenticate every request as a fixed dev user in development."""

    def authenticate(self, request):
        username = os.getenv('DEV_USERNAME', 'dev')
        email = os.getenv('DEV_EMAIL', 'dev@example.com')
        User = get_user_model()
        user, created = User.objects.get_or_create(username=username, defaults={'email': email})
        if created:
            user.set_unusable_password()
            user.save(update_fields=['password'])
        return user, None
