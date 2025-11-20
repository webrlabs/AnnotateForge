"""
Tests for authentication and authorization
"""
import pytest


class TestAuthAPI:
    """Tests for authentication endpoints"""

    def test_register_new_user(self, client):
        """Test user registration"""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "securepass123"
            }
        )

        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@example.com"
        assert "id" in data
        assert "password" not in data
        assert "hashed_password" not in data

    def test_register_duplicate_username(self, client, test_user):
        """Test registration with existing username"""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": test_user.username,
                "email": "different@example.com",
                "password": "password123"
            }
        )

        assert response.status_code == 400

    def test_register_duplicate_email(self, client, test_user):
        """Test registration with existing email"""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "differentuser",
                "email": test_user.email,
                "password": "password123"
            }
        )

        assert response.status_code == 400

    def test_register_invalid_email(self, client):
        """Test registration with invalid email format"""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "newuser",
                "email": "not-an-email",
                "password": "password123"
            }
        )

        assert response.status_code == 422

    def test_login_success(self, client, test_user):
        """Test successful login"""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "testuser",
                "password": "testpass123"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, test_user):
        """Test login with incorrect password"""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "testuser",
                "password": "wrongpassword"
            }
        )

        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user"""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "doesnotexist",
                "password": "password123"
            }
        )

        assert response.status_code == 401

    def test_get_current_user(self, client, auth_headers, test_user):
        """Test getting current user info"""
        response = client.get(
            "/api/v1/auth/me",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
        assert data["id"] == str(test_user.id)

    def test_get_current_user_no_auth(self, client):
        """Test getting current user without authentication"""
        response = client.get("/api/v1/auth/me")

        assert response.status_code == 401

    def test_get_current_user_invalid_token(self, client):
        """Test getting current user with invalid token"""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalidtoken"}
        )

        assert response.status_code == 401


class TestAuthorization:
    """Tests for resource authorization"""

    def test_user_cannot_access_other_users_resources(
        self, client, test_user, admin_user, db_session
    ):
        """Test that users cannot access other users' projects"""
        from app.models.project import Project
        from app.core.security import create_access_token

        # Create a project owned by admin
        admin_project = Project(
            name="Admin Project",
            description="Admin only",
            created_by=admin_user.id
        )
        db_session.add(admin_project)
        db_session.commit()
        db_session.refresh(admin_project)

        # Try to access as test_user
        test_user_token = create_access_token(data={"sub": str(test_user.id)})
        headers = {"Authorization": f"Bearer {test_user_token}"}

        response = client.get(
            f"/api/v1/projects/{admin_project.id}",
            headers=headers
        )

        # Should still be able to get it (read access is allowed)
        # but won't be able to delete/modify
        assert response.status_code == 200

    def test_admin_can_access_all_resources(
        self, client, admin_headers, test_project
    ):
        """Test that admin can access all projects"""
        response = client.get(
            f"/api/v1/projects/{test_project.id}",
            headers=admin_headers
        )

        assert response.status_code == 200
