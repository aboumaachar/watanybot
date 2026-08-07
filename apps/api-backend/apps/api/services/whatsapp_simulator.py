from __future__ import annotations

import time
import uuid
from typing import Any, Dict, Optional

from database import get_db_context
from routers import whatsapp as whatsapp_router


def _base_payload(phone: str, message: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "SIM_ENTRY_1",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "000000000",
                                "phone_number_id": "SIM_PHONE_ID",
                            },
                            "contacts": [
                                {
                                    "wa_id": phone,
                                    "profile": {"name": "Sim User"},
                                }
                            ],
                            "messages": [message],
                        },
                    }
                ],
            }
        ],
    }


def build_sample_payload_text(phone: str, text: str) -> Dict[str, Any]:
    message = {
        "from": phone,
        "id": f"SIM_MSG_{uuid.uuid4().hex}",
        "timestamp": str(int(time.time())),
        "type": "text",
        "text": {"body": text},
    }
    return _base_payload(phone, message)


def build_sample_payload_voice(phone: str, media_id: str = "SIM_AUDIO_1") -> Dict[str, Any]:
    message = {
        "from": phone,
        "id": f"SIM_VOICE_{uuid.uuid4().hex}",
        "timestamp": str(int(time.time())),
        "type": "audio",
        "audio": {"id": media_id, "mime_type": "audio/ogg"},
    }
    return _base_payload(phone, message)


def build_sample_payload_image(phone: str, media_id: str = "SIM_IMG_1") -> Dict[str, Any]:
    message = {
        "from": phone,
        "id": f"SIM_IMG_{uuid.uuid4().hex}",
        "timestamp": str(int(time.time())),
        "type": "image",
        "image": {"id": media_id, "mime_type": "image/jpeg"},
    }
    return _base_payload(phone, message)


def build_sample_payload_document(phone: str, media_id: str = "SIM_DOC_1") -> Dict[str, Any]:
    message = {
        "from": phone,
        "id": f"SIM_DOC_{uuid.uuid4().hex}",
        "timestamp": str(int(time.time())),
        "type": "document",
        "document": {"id": media_id, "mime_type": "application/pdf", "filename": "sample.pdf"},
    }
    return _base_payload(phone, message)


def build_sample_payload_location(
    phone: str,
    lat: float,
    lng: float,
    address: Optional[str] = None,
) -> Dict[str, Any]:
    message = {
        "from": phone,
        "id": f"SIM_LOC_{uuid.uuid4().hex}",
        "timestamp": str(int(time.time())),
        "type": "location",
        "location": {
            "latitude": lat,
            "longitude": lng,
            "address": address or "",
        },
    }
    return _base_payload(phone, message)


def build_sample_payload_status_only(phone: str = "000") -> Dict[str, Any]:
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "SIM_ENTRY_1",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "000000000",
                                "phone_number_id": "SIM_PHONE_ID",
                            },
                            "statuses": [
                                {
                                    "id": f"SIM_STATUS_{uuid.uuid4().hex}",
                                    "status": "delivered",
                                    "timestamp": str(int(time.time())),
                                    "recipient_id": phone,
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }


def simulate_inbound(
    app: Any,
    payload: Dict[str, Any],
    db: Optional[Any] = None,
) -> Dict[str, Any]:
    if db is not None:
        return whatsapp_router.handle_whatsapp_payload(payload, db, simulate_mode=True)
    try:
        with get_db_context() as session:
            return whatsapp_router.handle_whatsapp_payload(payload, session, simulate_mode=True)
    except Exception:
        return whatsapp_router.handle_whatsapp_payload(payload, None, simulate_mode=True)
