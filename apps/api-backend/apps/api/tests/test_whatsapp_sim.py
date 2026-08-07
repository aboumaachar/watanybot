from config import settings
from services import whatsapp_simulator


def test_whatsapp_sim_text_payload(client, db):
    settings.whatsapp_outbound_mode = "simulate"
    payload = whatsapp_simulator.build_sample_payload_text("96100000000", "marhaba")
    response = client.post("/whatsapp/webhook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data.get("mode") == "simulate"
    assert isinstance(data.get("outbound"), list)


def test_whatsapp_sim_arabizi_normalization(client, db):
    settings.whatsapp_outbound_mode = "simulate"
    payload = whatsapp_simulator.build_sample_payload_text("96100000000", "ma3ash ta2o3od")
    response = client.post("/whatsapp/webhook", json=payload)
    assert response.status_code == 200
    data = response.json()
    debug = data.get("debug") or {}
    normalized = debug.get("normalized") or {}
    assert normalized.get("candidates")


def test_whatsapp_status_only_ignored(client, db):
    settings.whatsapp_outbound_mode = "simulate"
    payload = whatsapp_simulator.build_sample_payload_status_only("96100000000")
    response = client.post("/whatsapp/webhook", json=payload)
    assert response.status_code == 200
    assert response.json().get("status") == "ignored"


def test_chat_alias_same_core_answer(client, db):
    question = "no match"
    response_primary = client.post("/chat/ask", json={"question": question, "lang": "ar"})
    response_legacy = client.post("/api/chat", json={"question": question, "lang": "ar"})

    assert response_primary.status_code == 200
    assert response_legacy.status_code == 200

    primary = response_primary.json()
    legacy = response_legacy.json()

    assert primary.get("answer") == legacy.get("answer")
    assert primary.get("clarifying_question") == legacy.get("clarifying_question")
