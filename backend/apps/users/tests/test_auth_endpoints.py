"""User authentication and profile API contract tests."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase


class UserAuthEndpointTests(APITestCase):
    """Validate authentication, profile, and password change endpoint behavior."""

    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()
        cls.password = "AuthFlowPass!123"
        cls.user = user_model.objects.create_user(
            username="auth-user",
            email="auth-user@example.com",
            password=cls.password,
            full_name="Auth User",
            organization="RPS QA",
        )

    def _authenticate(self, username=None, password=None):
        login_response = self.client.post(
            "/api/auth/login/",
            {
                "username": username or self.user.username,
                "password": password or self.password,
            },
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        return login_response

    def test_register_creates_user_and_hashes_password(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "new-user",
                "email": "new-user@example.com",
                "password": "StrongPass!456",
                "password_confirm": "StrongPass!456",
                "full_name": "New User",
                "organization": "RPS",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", response.data)
        self.assertNotIn("password_confirm", response.data)

        user_model = get_user_model()
        created_user = user_model.objects.get(username="new-user")
        self.assertTrue(created_user.check_password("StrongPass!456"))
        self.assertEqual(created_user.organization, "RPS")

    def test_register_rejects_password_mismatch(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "mismatch-user",
                "email": "mismatch-user@example.com",
                "password": "StrongPass!456",
                "password_confirm": "StrongPass!789",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)

    def test_login_returns_tokens_and_user_payload(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": self.user.username, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["id"], self.user.id)
        self.assertEqual(response.data["user"]["username"], self.user.username)
        self.assertEqual(response.data["user"]["email"], self.user.email)

    def test_profile_requires_authentication(self):
        response = self.client.get("/api/auth/profile/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_update_persists_user_fields(self):
        self._authenticate()

        response = self.client.patch(
            "/api/auth/profile/",
            {"full_name": "Updated Name", "organization": "Updated Org"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, "Updated Name")
        self.assertEqual(self.user.organization, "Updated Org")

    def test_change_password_rejects_incorrect_old_password(self):
        self._authenticate()

        response = self.client.post(
            "/api/auth/change-password/",
            {"old_password": "WrongPass!000", "new_password": "UpdatedPass!123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("old_password", response.data)

    def test_change_password_updates_credentials(self):
        self._authenticate()

        response = self.client.post(
            "/api/auth/change-password/",
            {"old_password": self.password, "new_password": "UpdatedPass!123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Password changed successfully.")

        old_login = self.client.post(
            "/api/auth/login/",
            {"username": self.user.username, "password": self.password},
            format="json",
        )
        self.assertEqual(old_login.status_code, status.HTTP_401_UNAUTHORIZED)

        new_login = self.client.post(
            "/api/auth/login/",
            {"username": self.user.username, "password": "UpdatedPass!123"},
            format="json",
        )
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)
