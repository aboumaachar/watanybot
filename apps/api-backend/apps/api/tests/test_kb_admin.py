import pytest
import uuid


def test_create_kb_card(client, admin_token):
    """Test creating a KB card."""
    response = client.post(
        "/admin/kb/cards",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "slug": "new-test-card",
            "locales": {
                "en": {
                    "title": "New Test Card",
                    "summary": "Summary",
                    "body": "Body content",
                    "tags": ["test"]
                },
                "ar": {
                    "title": "بطاقة جديدة",
                    "summary": "ملخص",
                    "body": "محتوى النص",
                    "tags": ["اختبار"]
                }
            }
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["slug"] == "new-test-card"
    assert data["status"] == "draft"
    assert data["version"] == 1


def test_create_kb_card_duplicate_slug(client, admin_token, sample_kb_card):
    """Test creating a KB card with duplicate slug."""
    response = client.post(
        "/admin/kb/cards",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "slug": "test-card",  # Same as sample_kb_card
            "locales": {
                "en": {
                    "title": "Duplicate",
                    "summary": "Summary",
                    "body": "Body",
                    "tags": []
                }
            }
        }
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_publish_kb_card(client, admin_token, db):
    """Test publishing a draft KB card."""
    # Create draft card
    response = client.post(
        "/admin/kb/cards",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "slug": "draft-card",
            "locales": {
                "en": {
                    "title": "Draft Card",
                    "summary": "Summary",
                    "body": "Body",
                    "tags": []
                }
            }
        }
    )
    card_id = response.json()["id"]
    
    # Publish it
    response = client.post(
        f"/admin/kb/cards/{card_id}/publish",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "published"
    assert data["version"] == 2


def test_archive_kb_card(client, admin_token, sample_kb_card):
    """Test archiving a KB card."""
    response = client.post(
        f"/admin/kb/cards/{sample_kb_card.id}/archive",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "archived"


def test_list_kb_cards(client, admin_token, sample_kb_card):
    """Test listing KB cards."""
    response = client.get(
        "/admin/kb/cards",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(card["slug"] == "test-card" for card in data)


def test_unauthorized_access(client):
    """Test that endpoints require authentication."""
    response = client.get("/admin/kb/cards")
    assert response.status_code == 403  # No token provided


def test_admin_cannot_access_superadmin(client, admin_token):
    """Test that admin cannot access superadmin endpoints."""
    response = client.get(
        "/superadmin/doctor",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 403
