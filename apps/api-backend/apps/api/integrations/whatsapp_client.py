# WhatsApp client stub  placeholder for WhatsApp Cloud API integration.
import os
import logging

logger = logging.getLogger(__name__)

def is_configured():
    """Check if WhatsApp credentials are set."""
    return bool(os.getenv("WHATSAPP_TOKEN")) and bool(os.getenv("WHATSAPP_PHONE_NUMBER_ID"))

def build_text_payload(to: str, body: str):
    return {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": body},
    }

def send_text(to: str, body: str):
    """Build text payload (simulation only  does not actually send)."""
    payload = build_text_payload(to, body)
    logger.info("WhatsApp stub: would send to %s: %s", to, body[:80])
    return {"sent": False, "reason": "stub", "payload": payload}
