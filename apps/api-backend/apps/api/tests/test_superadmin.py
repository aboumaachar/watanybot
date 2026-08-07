import pytest


def test_superadmin_doctor(client, superadmin_token):
    """Test superadmin doctor endpoint."""
    response = client.get(
        "/superadmin/doctor",
        headers={"Authorization": f"Bearer {superadmin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "overall_status" in data
    assert "checks" in data
    assert isinstance(data["checks"], list)


def test_superadmin_metrics(client, superadmin_token, sample_kb_card):
    """Test superadmin metrics endpoint."""
    response = client.get(
        "/superadmin/metrics",
        headers={"Authorization": f"Bearer {superadmin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_kb_cards" in data
    assert "published_kb_cards" in data
    assert "total_chat_sessions" in data
    assert data["published_kb_cards"] >= 1  # sample_kb_card


def test_superadmin_audit_logs(client, superadmin_token):
    """Test superadmin audit logs endpoint."""
    response = client.get(
        "/superadmin/audit",
        headers={"Authorization": f"Bearer {superadmin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_admin_cannot_access_superadmin(client, admin_token):
    """Test that admin role cannot access superadmin endpoints."""
    response = client.get(
        "/superadmin/doctor",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 403
    
    response = client.get(
        "/superadmin/metrics",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 403
