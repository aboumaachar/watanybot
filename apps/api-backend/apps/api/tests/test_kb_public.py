import pytest


def test_kb_search(client, sample_kb_card):
    """Test KB search with published card."""
    response = client.get("/kb/search?q=test&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "took_ms" in data
    assert len(data["items"]) > 0
    assert data["items"][0]["slug"] == "test-card"


def test_kb_search_arabic(client, sample_kb_card):
    """Test KB search with Arabic query."""
    response = client.get("/kb/search?q=اختبار&lang=ar")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0


def test_kb_search_no_results(client):
    """Test KB search with no matching results."""
    response = client.get("/kb/search?q=nonexistentquery12345")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert len(data["items"]) == 0


def test_get_kb_card(client, sample_kb_card):
    """Test getting a single KB card."""
    response = client.get(f"/kb/card/{sample_kb_card.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == "test-card"
    assert data["status"] == "published"


def test_get_nonexistent_kb_card(client):
    """Test getting a nonexistent KB card."""
    import uuid
    fake_id = uuid.uuid4()
    response = client.get(f"/kb/card/{fake_id}")
    assert response.status_code == 404
