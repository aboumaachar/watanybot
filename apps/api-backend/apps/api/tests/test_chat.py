import pytest


def test_chat_ask_with_kb_hit(client, sample_kb_card):
    """Test chat endpoint with KB match."""
    response = client.post("/chat/ask", json={
        "question": "Tell me about the test card",
        "lang": "en"
    })
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "session_id" in data
    assert "confidence" in data
    assert data["lang"] == "en"
    assert data["confidence"] > 0


def test_chat_ask_without_kb_hit(client):
    """Test chat endpoint without KB match (creates feedback)."""
    response = client.post("/chat/ask", json={
        "question": "What is the meaning of life?",
        "lang": "en"
    })
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "clarifying_question" in data
    assert data["confidence"] < 0.1


def test_chat_ask_language_detection(client, sample_kb_card):
    """Test automatic language detection."""
    # Arabic query
    response = client.post("/chat/ask", json={
        "question": "ما هو اختبار"
    })
    assert response.status_code == 200
    assert response.json()["lang"] == "ar"
    
    # English query
    response = client.post("/chat/ask", json={
        "question": "What is test"
    })
    assert response.status_code == 200
    assert response.json()["lang"] == "en"


def test_chat_ask_creates_session(client, sample_kb_card):
    """Test that chat creates a session."""
    response = client.post("/chat/ask", json={
        "question": "Test question"
    })
    assert response.status_code == 200
    session_id = response.json()["session_id"]
    assert session_id is not None
    
    # Use same session
    response = client.post("/chat/ask", json={
        "question": "Follow-up question",
        "session_id": session_id
    })
    assert response.status_code == 200
    assert response.json()["session_id"] == session_id
