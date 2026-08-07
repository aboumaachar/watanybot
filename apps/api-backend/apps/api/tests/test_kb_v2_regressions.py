from fastapi.testclient import TestClient

from main import app
from services import intent_classifier


def test_kb_v2_chat_treats_masa_al_khair_as_greeting(monkeypatch) -> None:
    monkeypatch.setattr(
        intent_classifier,
        "_intents",
        [
            {
                "name": "greeting",
                "patterns": ["مسا الخير", "مساء الخير"],
                "responses": ["أهلين! أنا هون لخدمتك. احكيلي شو بدك وبساعدك."],
            }
        ],
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/v2/chat",
            json={"question": "مسا الخير", "context": {}},
        )

    assert response.status_code == 200
    data = response.json()

    assert data["intent"] == "greeting"
    assert data["domain"] == "chitchat"
    assert data["confidence"] >= 0.99
    assert data["kb_hits"] == []
    assert data["clarifying"] is None
    assert "قانون العمل" not in data["answer_lb"]
    assert "law_" not in data["answer_lb"]
    assert "rag_" not in data["answer_lb"]
    assert "شو" in data["answer_lb"] or "كيف" in data["answer_lb"]