import pytest


def test_health_check(client):
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_login_success(client, admin_user):
    """Test successful login."""
    response = client.post("/auth/login", json={
        "email": "admin@test.local",
        "password": "testpassword"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@test.local"
    assert data["user"]["role"] == "admin"


def test_login_invalid_credentials(client, admin_user):
    """Test login with invalid credentials."""
    response = client.post("/auth/login", json={
        "email": "admin@test.local",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert "Invalid credentials" in response.json()["detail"]


def test_login_nonexistent_user(client):
    """Test login with nonexistent user."""
    response = client.post("/auth/login", json={
        "email": "nonexistent@test.local",
        "password": "password"
    })
    assert response.status_code == 401
