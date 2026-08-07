from __future__ import annotations

from typing import Any, Dict, List


def build_list_menu(title: str, items: List[Any]) -> Dict[str, Any]:
    rows = []
    for idx, item in enumerate(items[:7], start=1):
        if isinstance(item, dict):
            row_id = item.get("id", str(idx))
            title_text = item.get("title", "")
            description = item.get("description", "")
        else:
            row_id = str(idx)
            title_text = str(item)
            description = ""
        rows.append({
            "id": row_id,
            "title": title_text[:24],
            "description": description[:72],
        })
    return {
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {"text": title},
            "action": {
                "button": "اختر",
                "sections": [{"title": "الخيارات", "rows": rows}],
            },
        },
    }


def build_reply_buttons(text: str, buttons: List[str]) -> Dict[str, Any]:
    return {
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": text},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": str(i + 1), "title": b[:20]}}
                    for i, b in enumerate(buttons[:3])
                ]
            },
        },
    }


def build_three_option_voice_prompt() -> Dict[str, Any]:
    text = "ابعتلي رسالة صوتية 🎤"
    options = ["متابعة كتابة", "إرسال صوت", "القائمة"]
    return {
        "text": text,
        "options": options,
    }


def build_text(message: str) -> Dict[str, Any]:
    return {"type": "text", "text": {"body": message}}


def build_numbered_fallback(title: str, options: List[str]) -> str:
    lines = [title]
    for i, opt in enumerate(options, start=1):
        lines.append(f"{i}) {opt}")
    return "\n".join(lines)


def split_text(message: str, max_len: int = 900) -> List[str]:
    if not message:
        return [""]
    chunks: List[str] = []
    current = []
    size = 0
    for part in message.split("\n"):
        part_len = len(part) + 1
        if size + part_len > max_len and current:
            chunks.append("\n".join(current).strip())
            current = [part]
            size = part_len
        else:
            current.append(part)
            size += part_len
    if current:
        chunks.append("\n".join(current).strip())
    return [c for c in chunks if c]


def render_action_intents(intents: List[Dict[str, Any]], interactive_enabled: bool = True) -> List[Dict[str, Any]]:
    payloads: List[Dict[str, Any]] = []
    for intent in intents:
        intent_type = (intent.get("type") or "").lower()
        if intent_type == "call_phone":
            text = "اضغط للاتصال عند الحاجة."
            payloads.append(build_text(text))
        elif intent_type == "open_url":
            url = intent.get("url") or ""
            text = f"الرابط: {url}" if url else "لديك رابط للمراجعة."
            payloads.append(build_text(text))
        elif intent_type == "request_location":
            text = "أرسل موقعك لمساعدتك بشكل أدق."
            if interactive_enabled:
                payloads.append(build_reply_buttons(text, ["إرسال الموقع"]))
            else:
                payloads.append(build_text(build_numbered_fallback(text, ["إرسال الموقع"])))
        elif intent_type == "request_photo":
            text = "أرسل صورة واضحة للمراجعة."
            if interactive_enabled:
                payloads.append(build_reply_buttons(text, ["إرسال صورة"]))
            else:
                payloads.append(build_text(build_numbered_fallback(text, ["إرسال صورة"])))
        elif intent_type == "request_voice":
            text = "أرسل رسالة صوتية قصيرة."
            if interactive_enabled:
                payloads.append(build_reply_buttons(text, ["إرسال صوت"]))
            else:
                payloads.append(build_text(build_numbered_fallback(text, ["إرسال صوت"])))
    return payloads
