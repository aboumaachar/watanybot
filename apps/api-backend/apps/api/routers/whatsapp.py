from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import FeedbackQueue, WAUser, WADedup, WAMedia
from routers.public import resolve_sqlite_answer, detect_language, build_action_intents
from services import input_normalizer
from services import intent_classifier
from services import ux_policy
from services import whatsapp_ui
from integrations import stt_provider, tts_provider
from integrations import whatsapp_client

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

_MEMORY_DEDUP: Dict[str, float] = {}
_MEMORY_USERS: Dict[str, "MemoryUser"] = {}


@dataclass
class MemoryUser:
    phone_number: str
    voice_preferred: bool = True
    muted: bool = False
    caregiver_mode: bool = False
    mode: str = "guided"
    language_pref: str = "ar"
    pending_paging: bool = False
    paging_cursor: int = 0
    paging_chunks_count: int = 0
    paging_chunks: List[str] = field(default_factory=list)
    paging_state_json: Dict[str, Any] = field(default_factory=dict)
    last_location_json: Optional[Dict[str, Any]] = None
    doc_type_hint: Optional[str] = None


def _extract_message(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    entries = payload.get("entry") or []
    for entry in entries:
        changes = entry.get("changes") or []
        for change in changes:
            value = change.get("value") or {}
            messages = value.get("messages") or []
            if messages:
                return messages[0]
    return None


def _has_status_only(payload: Dict[str, Any]) -> bool:
    entries = payload.get("entry") or []
    for entry in entries:
        changes = entry.get("changes") or []
        for change in changes:
            value = change.get("value") or {}
            statuses = value.get("statuses") or []
            messages = value.get("messages") or []
            if statuses and not messages:
                return True
    return False


def _verify_signature(body: bytes, header: str, secret: str) -> bool:
    if not header or not secret:
        return False
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)


def _interactive_enabled() -> bool:
    return bool(settings.whatsapp_interactive_enabled)


def _build_guided_payload(title: str, options: List[str]) -> Dict[str, Any]:
    if _interactive_enabled():
        items = [
            {"id": str(i + 1), "title": opt, "description": ""}
            for i, opt in enumerate(options)
        ]
        return whatsapp_ui.build_list_menu(title, items)
    return whatsapp_ui.build_text(whatsapp_ui.build_numbered_fallback(title, options))


def _persist_user(db: Optional[Session], user: Any) -> None:
    if not db or not isinstance(user, WAUser):
        return
    try:
        db.add(user)
        db.commit()
    except Exception:
        db.rollback()


def _get_or_create_user(db: Optional[Session], phone_number: str) -> Any:
    if db:
        try:
            user = db.query(WAUser).filter(WAUser.phone_number == phone_number).first()
            if user:
                return user
            mode = "guided" if settings.guided_mode_default else "direct"
            user = WAUser(phone_number=phone_number, voice_preferred=True, muted=False, mode=mode)
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        except Exception:
            db.rollback()

    user = _MEMORY_USERS.get(phone_number)
    if not user:
        mode = "guided" if settings.guided_mode_default else "direct"
        user = MemoryUser(phone_number=phone_number, voice_preferred=True, muted=False, mode=mode)
        _MEMORY_USERS[phone_number] = user
    return user


def _store_paging_state(db: Optional[Session], user: Any, chunks: List[str]) -> None:
    user.pending_paging = True
    user.paging_cursor = 0
    user.paging_chunks_count = len(chunks)
    user.paging_chunks = chunks
    _persist_user(db, user)


def _consume_next_chunk(db: Optional[Session], user: Any) -> Optional[str]:
    chunks = user.paging_chunks or []
    cursor = user.paging_cursor + 1
    if cursor >= len(chunks):
        user.pending_paging = False
        user.paging_cursor = 0
        user.paging_chunks_count = 0
        user.paging_chunks = []
        _persist_user(db, user)
        return None
    user.paging_cursor = cursor
    next_chunk = chunks[cursor]
    if cursor >= len(chunks) - 1:
        user.pending_paging = False
        user.paging_chunks = []
        user.paging_chunks_count = 0
        user.paging_cursor = 0
    _persist_user(db, user)
    return next_chunk


def _caregiver_summary(kb_hits: List[Dict[str, Any]]) -> str:
    if not kb_hits:
        return ""
    first = kb_hits[0]
    if first.get("tx_no"):
        return f"ملخص للمتابعة: راجع المعاملة {first.get('tx_no')}"
    if first.get("article_no"):
        return f"ملخص للمتابعة: راجع المادة {first.get('article_no')}"
    return ""


def _build_media_prompt() -> Dict[str, Any]:
    prompt = "وصلت مرفقاً. هل هو (1) هوية (2) دفتر عائلة (3) إفادة (4) غير ذلك؟"
    if _interactive_enabled():
        return whatsapp_ui.build_reply_buttons(prompt, ["هوية", "دفتر عائلة", "إفادة", "غير ذلك"])
    return whatsapp_ui.build_text(whatsapp_ui.build_numbered_fallback(prompt, ["هوية", "دفتر عائلة", "إفادة", "غير ذلك"]))


def _build_voice_first_prompt() -> Dict[str, Any]:
    prompt = whatsapp_ui.build_three_option_voice_prompt()
    if _interactive_enabled():
        return whatsapp_ui.build_reply_buttons(prompt["text"], prompt["options"])
    return whatsapp_ui.build_text(whatsapp_ui.build_numbered_fallback(prompt["text"], prompt["options"]))


def _build_image_prompt() -> Dict[str, Any]:
    prompt = "وصلت الصورة. إذا بتقدر، ابعت وصف مختصر أو رسالة صوتية 🎤."
    return whatsapp_ui.build_text(prompt)


def _build_document_prompt() -> Dict[str, Any]:
    prompt = "وصلت الوثيقة. إذا بتقدر، ابعت وصف مختصر أو رسالة صوتية 🎤."
    return whatsapp_ui.build_text(prompt)


def _build_stt_confirmation_prompt(transcript: str) -> Dict[str, Any]:
    text = f"سمعت: {transcript}\nهل هذا صحيح؟"
    if _interactive_enabled():
        return whatsapp_ui.build_reply_buttons(text, ["نعم", "لا"])
    return whatsapp_ui.build_text(whatsapp_ui.build_numbered_fallback(text, ["نعم", "لا"]))


def _get_pending_stt(user: Any) -> Optional[Dict[str, Any]]:
    state = user.paging_state_json or {}
    pending = state.get("pending_stt")
    if isinstance(pending, dict):
        return pending
    return None


def _set_pending_stt(db: Optional[Session], user: Any, transcript: str) -> None:
    state = user.paging_state_json or {}
    state["pending_stt"] = {"transcript": transcript}
    user.paging_state_json = state
    _persist_user(db, user)


def _clear_pending_stt(db: Optional[Session], user: Any) -> None:
    state = user.paging_state_json or {}
    if "pending_stt" in state:
        state.pop("pending_stt", None)
        user.paging_state_json = state
        _persist_user(db, user)


def _handle_commands(db: Optional[Session], user: Any, text_body: str) -> Optional[Dict[str, Any]]:
    lowered = text_body.strip().lower()
    if lowered in {"mute", "كتم", "بدون صوت"}:
        user.muted = True
        _persist_user(db, user)
        return {"response": whatsapp_ui.build_text("تم كتم الصوت. يمكنك الكتابة متى شئت.")}
    if lowered in {"unmute", "تشغيل الصوت"}:
        user.muted = False
        _persist_user(db, user)
        return {"response": whatsapp_ui.build_text("تم تشغيل الصوت.")}
    if lowered in {"كتابة فقط"}:
        user.voice_preferred = False
        _persist_user(db, user)
        return {"response": whatsapp_ui.build_text("حاضر، سأتابع معك كتابة.")}
    if lowered in {"صوت", "voice"}:
        user.voice_preferred = True
        _persist_user(db, user)
        return {"response": whatsapp_ui.build_text("تمام، أرسل رسالة صوتية وقتما تشاء.")}
    return None


def _load_payload(body: bytes) -> Dict[str, Any]:
    try:
        return json.loads(body.decode("utf-8")) if body else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")


def _ensure_signature(request: Request, body: bytes) -> None:
    if not settings.whatsapp_verify_signature:
        return
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not _verify_signature(body, signature, settings.whatsapp_app_secret):
        raise HTTPException(status_code=401, detail="Invalid signature")


def _record_dedup(db: Optional[Session], message_id: str, phone_number: str) -> bool:
    if not message_id:
        return False
    if db:
        try:
            existing = db.query(WADedup).filter(WADedup.message_id == message_id).first()
            if existing:
                return True
            db.add(WADedup(message_id=message_id, phone_number=phone_number))
            db.commit()
            return False
        except Exception:
            db.rollback()

    if message_id in _MEMORY_DEDUP:
        return True
    _MEMORY_DEDUP[message_id] = time.time()
    return False


def _handle_paging_response(db: Optional[Session], user: Any, text_body: str) -> Optional[Dict[str, Any]]:
    if text_body and user.pending_paging and text_body.strip() == "1":
        next_chunk = _consume_next_chunk(db, user)
        if not next_chunk:
            return {"response": whatsapp_ui.build_text("تمت المتابعة.")}
        if user.pending_paging:
            next_chunk = f"{next_chunk}\n\n1 للمتابعة"
        return {"response": whatsapp_ui.build_text(next_chunk)}
    return None


def _capture_feedback(db: Optional[Session], text_body: str, lang: str, kb_hits: List[Dict[str, Any]], phone_number: str) -> None:
    if not db:
        return
    feedback_item = FeedbackQueue(
        session_id=None,
        question=text_body,
        lang=lang,
        suggested_kb_ids=None,
        status="open",
        resolution={
            "capture": {
                "message": text_body,
                "tx_no": None,
                "article_no": None,
                "rating": None,
                "correction_text": None,
                "suggested_mapping": None,
                "source": "whatsapp_low_confidence",
                "best_candidates": kb_hits,
                "channel": "whatsapp",
                "phone_number": phone_number,
            }
        },
    )
    try:
        db.add(feedback_item)
        db.commit()
    except Exception:
        db.rollback()


def _build_clarification(db: Optional[Session], text_body: str, lang: str, kb_hits: List[Dict[str, Any]], phone_number: str) -> Dict[str, Any]:
    options: List[str] = []
    for hit in kb_hits[:2]:
        if hit.get("tx_no"):
            options.append(f"المعاملة {hit.get('tx_no')}")
        elif hit.get("article_no"):
            options.append(f"المادة {hit.get('article_no')}")
    if not options:
        options = ["شرح المعاملة المطلوبة", "شرح المادة المطلوبة"]
    guided = _build_guided_payload("اختر الخيار الأقرب لطلبك", options[:2])
    _capture_feedback(db, text_body, lang, kb_hits, phone_number)
    return {"response": guided}


def _apply_caregiver(user: Any, kb_hits: List[Dict[str, Any]], chunks: List[str]) -> List[str]:
    if user.caregiver_mode:
        summary = _caregiver_summary(kb_hits)
        if summary and chunks:
            chunks[-1] = f"{chunks[-1]}\n\n{summary}"
    return chunks


def _build_paged_response(db: Optional[Session], user: Any, chunks: List[str]) -> Dict[str, Any]:
    if len(chunks) > 1:
        _store_paging_state(db, user, chunks)
        first = f"{chunks[0]}\n\n1 للمتابعة"
        return {"response": whatsapp_ui.build_text(first)}
    return {"response": whatsapp_ui.build_text(chunks[0] if chunks else "")}


def _extract_text_body(message: Dict[str, Any]) -> Optional[str]:
    if message.get("type") != "text":
        return None
    return (message.get("text") or {}).get("body")


def _handle_media_message(db: Optional[Session], user: Any, phone_number: str, message: Dict[str, Any]) -> Dict[str, Any]:
    msg_type = message.get("type")
    media_payload = message.get(msg_type) or {}
    if db:
        try:
            entry = WAMedia(
                phone_number=phone_number,
                media_id=media_payload.get("id"),
                media_type=msg_type,
                mime_type=media_payload.get("mime_type"),
                file_path=None,
                metadata_json=media_payload,
            )
            db.add(entry)
            db.commit()
        except Exception:
            db.rollback()

    if msg_type == "audio":
        if not settings.stt_enabled:
            return {"response": whatsapp_ui.build_text("لم أتمكن من تفريغ الصوت. اكتب كلمتين مفتاحيتين لو سمحت.")}
        transcript, confidence = stt_provider.get_provider().transcribe("/data/media")
        if transcript:
            if confidence < settings.stt_confidence_threshold:
                _set_pending_stt(db, user, transcript)
                return {"response": _build_stt_confirmation_prompt(transcript)}
            return _handle_text_message(db, user, transcript, phone_number, allow_voice_prompt=False)
        return {"response": whatsapp_ui.build_text("لم أستطع فهم الرسالة الصوتية. ممكن تعيدها أو تبعتلي كلمتين أساسيتين؟")}

    if msg_type == "image":
        if settings.ocr_enabled:
            return {"response": whatsapp_ui.build_text("وصلت الصورة. إذا النص مش واضح، ابعت رسالة صوتية 🎤.")}
        return {"response": _build_media_prompt()}

    if msg_type == "document":
        if settings.ocr_enabled:
            return {"response": _build_document_prompt()}
        return {"response": _build_media_prompt()}

    if settings.ocr_enabled:
        return {"response": whatsapp_ui.build_text("وصلت الصورة. إذا النص مش واضح، ابعت رسالة صوتية 🎤.")}
    return {"response": _build_media_prompt()}


def _handle_location_message(db: Optional[Session], user: Any, message: Dict[str, Any]) -> Dict[str, Any]:
    user.last_location_json = message.get("location")
    _persist_user(db, user)
    prompt = "شكراً. بدك (1) أقرب مركز (2) رقم هاتف (3) شو تعمل هلأ؟"
    return {"response": whatsapp_ui.build_text(prompt)}


def _process_message(db: Optional[Session], user: Any, phone_number: str, message: Dict[str, Any]) -> Dict[str, Any]:
    msg_type = message.get("type")
    text_body = _extract_text_body(message)

    pending_response = _handle_pending_stt_response(db, user, text_body or "", phone_number)
    if pending_response:
        return pending_response

    paging_response = _handle_paging_response(db, user, text_body or "")
    if paging_response:
        return paging_response

    if msg_type in {"image", "audio", "document"}:
        return _handle_media_message(db, user, phone_number, message)

    if msg_type == "location":
        return _handle_location_message(db, user, message)

    if not text_body:
        prompt = "كيف يمكنني مساعدتك؟ اختر خياراً:"
        options = ["استعلام عن معاملة", "استعلام عن مادة"]
        if _interactive_enabled():
            payload = whatsapp_ui.build_reply_buttons(prompt, options)
        else:
            payload = whatsapp_ui.build_text(whatsapp_ui.build_numbered_fallback(prompt, options))
        return {"response": payload}

    return _handle_text_message(db, user, text_body, phone_number)


def _handle_text_message(
    db: Optional[Session],
    user: Any,
    text_body: str,
    phone_number: str,
    allow_voice_prompt: bool = True,
) -> Dict[str, Any]:
    pending_response = _handle_pending_stt_response(db, user, text_body or "", phone_number)
    if pending_response:
        return pending_response

    command_response = _handle_commands(db, user, text_body)
    if command_response:
        return command_response

    if allow_voice_prompt and user.voice_preferred and not user.muted and len(text_body) < 40:
        return {"response": _build_voice_first_prompt()}

    normalized = input_normalizer.normalize_input(
        text_body,
        arabizi_enabled=settings.arabizi_enabled,
        keyboard_fix_enabled=settings.keyboard_garble_fix_enabled,
    )
    if normalized["clarify_needed"]:
        prompt = f"الكتابة مش واضحة. هل تقصد (1) {normalized['candidates'][0]} أم (2) {normalized['candidates'][1]}؟"
        return {
            "response": whatsapp_ui.build_text(prompt),
            "debug": {"normalized": normalized, "guided": True, "paging": False},
        }

    question = normalized["normalized"]
    lang = detect_language(question)

    # ── Small-talk fast path ──────────────────────────────────
    chitchat = intent_classifier.classify(question)
    if chitchat:
        return {
            "response": whatsapp_ui.build_text(chitchat["response"]),
            "debug": {"normalized": normalized, "guided": False, "paging": False, "chitchat": chitchat["name"]},
        }
    # ─────────────────────────────────────────────────────────

    answer, confidence, kb_hits, clarifying, _ = resolve_sqlite_answer(lang, question)
    action_intents = build_action_intents(text_body, answer)

    if clarifying or confidence < settings.sqlite_confidence_threshold:
        response = _build_clarification(db, text_body, lang, kb_hits, phone_number)
        response["action_intents"] = action_intents
        response["debug"] = {"normalized": normalized, "guided": True, "paging": False}
        return response

    emo_score = intent_classifier.emotional_score(question)
    policy = ux_policy.enforce_policy(answer, emotional_score=emo_score)
    answer = policy["message"]
    chunks = _apply_caregiver(user, kb_hits, whatsapp_ui.split_text(answer))
    response = _build_paged_response(db, user, chunks)
    response["action_intents"] = action_intents
    response["debug"] = {
        "normalized": normalized,
        "guided": False,
        "paging": len(chunks) > 1,
    }

    if settings.tts_enabled and not user.muted:
        audio_path = tts_provider.get_provider().synthesize(answer)
        if audio_path:
            response["response_audio"] = audio_path
    return response


def _handle_pending_stt_response(
    db: Optional[Session],
    user: Any,
    text_body: str,
    phone_number: str,
) -> Optional[Dict[str, Any]]:
    pending = _get_pending_stt(user)
    if not pending:
        return None

    lowered = (text_body or "").strip().lower()
    if lowered in {"1", "نعم", "yes"}:
        transcript = pending.get("transcript", "")
        _clear_pending_stt(db, user)
        if transcript:
            return _handle_text_message(db, user, transcript, phone_number, allow_voice_prompt=False)
        return {"response": whatsapp_ui.build_text("تمام، ابعت الرسالة الصوتية من جديد.")}
    if lowered in {"2", "لا", "no"}:
        _clear_pending_stt(db, user)
        return {"response": whatsapp_ui.build_text("تمام، ابعت الرسالة الصوتية من جديد.")}
    return {"response": whatsapp_ui.build_text("لو سمحت، رد بـ 1 للموافقة أو 2 للرفض.")}


def _payload_to_send(to: str, payload: Any) -> Dict[str, Any]:
    if isinstance(payload, dict):
        payload_type = payload.get("type")
        if payload_type == "text":
            body = (payload.get("text") or {}).get("body") or ""
            return whatsapp_client.build_text_payload(to, body)
        if payload_type == "interactive":
            return {
                "messaging_product": "whatsapp",
                "to": to,
                "type": "interactive",
                "interactive": payload.get("interactive") or {},
            }
    return whatsapp_client.build_text_payload(to, str(payload))


def _build_outbound_payloads(phone_number: str, result: Dict[str, Any]) -> List[Dict[str, Any]]:
    outbound: List[Dict[str, Any]] = []
    response_payload = result.get("response")
    if response_payload is not None:
        outbound.append(_payload_to_send(phone_number, response_payload))
    if result.get("response_audio"):
        outbound.append(whatsapp_client.build_audio_payload(phone_number, result["response_audio"]))
    return outbound


def handle_whatsapp_payload(
    payload: Dict[str, Any],
    db: Optional[Session],
    simulate_mode: bool,
) -> Dict[str, Any]:
    if _has_status_only(payload):
        return {"status": "ignored"}

    message = _extract_message(payload)
    if not message:
        return {"status": "ignored"}

    message_id = message.get("id") or ""
    phone_number = message.get("from") or "unknown"
    if _record_dedup(db, message_id, phone_number):
        return {"status": "duplicate"}

    user = _get_or_create_user(db, phone_number)
    result = _process_message(db, user, phone_number, message)
    outbound = _build_outbound_payloads(phone_number, result)

    debug = result.get("debug") or {}
    debug.setdefault("user", {
        "mode": getattr(user, "mode", None),
        "pending_paging": getattr(user, "pending_paging", None),
    })

    outbound_mode = (settings.whatsapp_outbound_mode or "simulate").lower()
    if outbound_mode == "live" and not simulate_mode:
        sent = [whatsapp_client.send_payload(item) for item in outbound]
        return {
            "mode": "live",
            "to": phone_number,
            "sent": sent,
        }

    return {
        "mode": "simulate",
        "to": phone_number,
        "outbound": outbound,
        "debug": debug,
        "action_intents": result.get("action_intents") or [],
    }


@router.get("/webhook")
async def whatsapp_verify(
    mode: str = Query("", alias="hub.mode"),
    token: str = Query("", alias="hub.verify_token"),
    challenge: str = Query("", alias="hub.challenge"),
):
    expected = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
    if mode == "subscribe" and token and token == expected:
        return challenge
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    _ensure_signature(request, body)
    payload = _load_payload(body)
    outbound_mode = (settings.whatsapp_outbound_mode or "simulate").lower()
    simulate_mode = outbound_mode != "live"
    return handle_whatsapp_payload(payload, db, simulate_mode)
