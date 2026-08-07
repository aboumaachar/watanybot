import os
import sqlite3
import tempfile

from services import reranker
from services import whatsapp_ui
from services import input_normalizer
from config import settings
from models import WAUser


def _extract_whatsapp_body(response_json):
    payload = response_json.get("response", {})
    if payload.get("type") == "text":
        return payload.get("text", {}).get("body", "")
    if payload.get("type") == "interactive":
        return payload.get("interactive", {}).get("body", {}).get("text", "")
    return ""


def _extract_whatsapp_options(response_json):
    payload = response_json.get("response", {})
    if payload.get("type") != "interactive":
        return []
    action = payload.get("interactive", {}).get("action", {})
    buttons = action.get("buttons", [])
    return [btn.get("reply", {}).get("title", "") for btn in buttons]


def test_reranker_orders_deterministically():
    candidates = [
        {"tx_no": "TX-1", "title": "وفاة ومعاش", "summary": "", "score": 0.3},
        {"tx_no": "TX-2", "title": "خدمات عامة", "summary": "", "score": 0.3},
    ]
    reranked = reranker.rerank(candidates, "وفاة")
    assert reranked[0]["tx_no"] == "TX-1"


def test_iterative_trigger_only_when_ambiguous():
    assert reranker.should_iterate(0.2, 0.0, 0.25, 0.05) is True
    assert reranker.should_iterate(0.6, 0.58, 0.25, 0.05) is True
    assert reranker.should_iterate(0.6, 0.3, 0.25, 0.05) is False


def test_whatsapp_ui_payload_shapes():
    menu = whatsapp_ui.build_list_menu("اختر", [{"id": "1", "title": "خيار", "description": ""}])
    assert menu["type"] == "interactive"
    assert menu["interactive"]["type"] == "list"

    buttons = whatsapp_ui.build_reply_buttons("اختر", ["نعم", "لا"])
    assert buttons["interactive"]["type"] == "button"

    text = whatsapp_ui.build_text("مرحبا")
    assert text["type"] == "text"


def test_split_text_chunks():
    message = "\n".join(["سطر" for _ in range(200)])
    chunks = whatsapp_ui.split_text(message, max_len=100)
    assert len(chunks) > 1


def test_voice_first_default_user_creation(client, db):
    payload = {
        "entry": [
            {"changes": [{"value": {"messages": [{
                "id": "m-voice",
                "from": "333",
                "type": "text",
                "text": {"body": "مرحبا"},
            }]}}]}
        ]
    }
    client.post("/whatsapp/webhook", json=payload)
    user = db.query(WAUser).filter(WAUser.phone_number == "333").first()
    assert user is not None
    assert user.voice_preferred is True


def test_mute_unmute_commands(client, db):
    payload = {
        "entry": [
            {"changes": [{"value": {"messages": [{
                "id": "m-mute",
                "from": "444",
                "type": "text",
                "text": {"body": "كتم"},
            }]}}]}
        ]
    }
    client.post("/whatsapp/webhook", json=payload)
    user = db.query(WAUser).filter(WAUser.phone_number == "444").first()
    assert user.muted is True

    payload["entry"][0]["changes"][0]["value"]["messages"][0]["id"] = "m-unmute"
    payload["entry"][0]["changes"][0]["value"]["messages"][0]["text"]["body"] = "تشغيل الصوت"
    client.post("/whatsapp/webhook", json=payload)
    user = db.query(WAUser).filter(WAUser.phone_number == "444").first()
    assert user.muted is False


def test_arabizi_normalization():
    result = input_normalizer.normalize_input("3ala al2at3")
    assert result["normalized"]


def test_garbled_keyboard_normalization():
    result = input_normalizer.normalize_input("shg")
    assert result["normalized"]


def test_whatsapp_status_payload_ignored(client):
    payload = {
        "entry": [
            {"changes": [{"value": {"statuses": [{"id": "s1"}]}}]}
        ]
    }
    response = client.post("/whatsapp/webhook", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "ignored"


def test_audio_webhook_stt_fallback(client):
    payload = {
        "entry": [
            {"changes": [{"value": {"messages": [{
                "id": "m-audio",
                "from": "666",
                "type": "audio",
                "audio": {"id": "media-1", "mime_type": "audio/ogg"},
            }]}}]}
        ]
    }
    response = client.post("/whatsapp/webhook", json=payload)
    assert response.status_code == 200


def test_voice_first_prompt_text(client):
    payload = {
        "entry": [
            {"changes": [{"value": {"messages": [{
                "id": "m-voice-prompt",
                "from": "777",
                "type": "text",
                "text": {"body": "مرحبا"},
            }]}}]}
        ]
    }
    response = client.post("/whatsapp/webhook", json=payload)
    assert response.status_code == 200
    body = _extract_whatsapp_body(response.json())
    assert "ابعتلي رسالة صوتية 🎤" in body
    options = _extract_whatsapp_options(response.json())
    if options:
        assert "متابعة كتابة" in options
        assert "إرسال صوت" in options
        assert "القائمة" in options
    else:
        assert "1) متابعة كتابة" in body
        assert "2) إرسال صوت" in body
        assert "3) القائمة" in body


def test_stt_low_confidence_confirmation(client, db, monkeypatch):
    class FakeSTT:
        def transcribe(self, audio_path: str):
            return "مرحبا", 0.4

    from integrations import stt_provider
    monkeypatch.setattr(stt_provider, "get_provider", lambda: FakeSTT())

    payload = {
        "entry": [
            {"changes": [{"value": {"messages": [{
                "id": "m-audio-low",
                "from": "888",
                "type": "audio",
                "audio": {"id": "media-2", "mime_type": "audio/ogg"},
            }]}}]}
        ]
    }
    response = client.post("/whatsapp/webhook", json=payload)
    assert response.status_code == 200
    body = _extract_whatsapp_body(response.json())
    assert "سمعت" in body
    assert "هل هذا صحيح" in body

    user = db.query(WAUser).filter(WAUser.phone_number == "888").first()
    assert user is not None
    assert user.paging_state_json is not None
    assert "pending_stt" in user.paging_state_json


def test_image_document_prompts(client):
    image_payload = {
        "entry": [
            {"changes": [{"value": {"messages": [{
                "id": "m-img",
                "from": "999",
                "type": "image",
                "image": {"id": "media-3", "mime_type": "image/png"},
            }]}}]}
        ]
    }
    image_response = client.post("/whatsapp/webhook", json=image_payload)
    assert image_response.status_code == 200
    assert "وصلت الصورة" in image_response.json()["response"]["text"]["body"]

    doc_payload = {
        "entry": [
            {"changes": [{"value": {"messages": [{
                "id": "m-doc",
                "from": "1000",
                "type": "document",
                "document": {"id": "media-4", "mime_type": "application/pdf"},
            }]}}]}
        ]
    }
    doc_response = client.post("/whatsapp/webhook", json=doc_payload)
    assert doc_response.status_code == 200
    assert "وصلت الوثيقة" in doc_response.json()["response"]["text"]["body"]


def test_unreadable_text_clarification(client):
    payload = {
        "entry": [
            {"changes": [{"value": {"messages": [{
                "id": "m-clarify-1",
                "from": "1010",
                "type": "text",
                "text": {"body": "كتابة فقط"},
            }]}}]}
        ]
    }
    client.post("/whatsapp/webhook", json=payload)

    payload["entry"][0]["changes"][0]["value"]["messages"][0]["id"] = "m-clarify-2"
    payload["entry"][0]["changes"][0]["value"]["messages"][0]["text"]["body"] = "shg"
    response = client.post("/whatsapp/webhook", json=payload)
    assert response.status_code == 200
    body = response.json()["response"]["text"]["body"]
    assert "الكتابة مش واضحة" in body


def test_whatsapp_dedup_prevents_double_response(client):
    payload = {
        "entry": [
            {"changes": [{"value": {"messages": [{
                "id": "m-123",
                "from": "111",
                "type": "text",
                "text": {"body": "مرحبا"},
            }]}}]}
        ]
    }
    first = client.post("/whatsapp/webhook", json=payload)
    assert first.status_code == 200
    second = client.post("/whatsapp/webhook", json=payload)
    assert second.status_code == 200
    assert second.json()["status"] == "duplicate"


def test_whatsapp_paging_advances_on_one(client, db):
    user = WAUser(
        phone_number="222",
        pending_paging=True,
        paging_cursor=0,
        paging_chunks_count=2,
        paging_chunks=["أول", "ثاني"],
    )
    db.add(user)
    db.commit()

    payload = {
        "entry": [
            {"changes": [{"value": {"messages": [{
                "id": "m-222",
                "from": "222",
                "type": "text",
                "text": {"body": "1"},
            }]}}]}
        ]
    }
    response = client.post("/whatsapp/webhook", json=payload)
    assert response.status_code == 200
    updated = db.query(WAUser).filter(WAUser.phone_number == "222").first()
    assert updated is not None
    assert updated.pending_paging is False


def test_location_message_handling(client, db):
    payload = {
        "entry": [
            {"changes": [{"value": {"messages": [{
                "id": "m-loc",
                "from": "555",
                "type": "location",
                "location": {"latitude": 1, "longitude": 2},
            }]}}]}
        ]
    }
    response = client.post("/whatsapp/webhook", json=payload)
    assert response.status_code == 200


def test_approved_only_filtering_in_sqlite():
    prev_path = settings.kb_sqlite_path
    prev_use = settings.use_sqlite_v3_kb
    prev_pending = settings.public_show_pending
    prev_threshold = settings.sqlite_confidence_threshold
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)

    conn = sqlite3.connect(path)
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE transactions (tx_no TEXT PRIMARY KEY, title_ar TEXT, summary_ar TEXT, review_status TEXT)")
    cursor.execute("CREATE VIRTUAL TABLE tx_fts USING fts5(tx_no, content='transactions', content_rowid='rowid')")
    cursor.execute("INSERT INTO transactions (tx_no, title_ar, summary_ar, review_status) VALUES (?, ?, ?, ?)", ("TX-P", "معاملة", "ملخص", "pending"))
    cursor.execute("INSERT INTO tx_fts (rowid, tx_no) VALUES (1, ?)", ("TX-P",))
    conn.commit()
    conn.close()

    settings.kb_sqlite_path = path
    settings.use_sqlite_v3_kb = True
    settings.public_show_pending = False
    settings.sqlite_confidence_threshold = 0.0

    from routers.public import resolve_sqlite_answer
    answer, _, _, clarifying, _ = resolve_sqlite_answer("ar", "معاملة")
    assert answer == ""
    assert clarifying is None

    settings.kb_sqlite_path = prev_path
    settings.use_sqlite_v3_kb = prev_use
    settings.public_show_pending = prev_pending
    settings.sqlite_confidence_threshold = prev_threshold
    os.remove(path)
