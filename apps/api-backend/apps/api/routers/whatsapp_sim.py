from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from services import whatsapp_simulator

router = APIRouter(prefix="/dev/whatsapp", tags=["WhatsAppSim"])


def _require_simulation() -> None:
    if not (settings.app_env == "dev" and settings.whatsapp_simulation_enabled):
        raise HTTPException(status_code=404, detail="Not Found")


class SimulateRequest(BaseModel):
    phone: str = Field(default="96100000000")
    type: str = Field(description="text|voice|image|document|location")
    text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    media_id: Optional[str] = None


@router.post("/simulate")
async def simulate_whatsapp(
    request: SimulateRequest,
    db: Session = Depends(get_db),
    _: None = Depends(_require_simulation),
):
    payload: Dict[str, Any]
    msg_type = request.type.lower().strip()
    if msg_type == "text":
        payload = whatsapp_simulator.build_sample_payload_text(request.phone, request.text or "marhaba")
    elif msg_type == "voice":
        payload = whatsapp_simulator.build_sample_payload_voice(request.phone, request.media_id or "SIM_AUDIO_1")
    elif msg_type == "image":
        payload = whatsapp_simulator.build_sample_payload_image(request.phone, request.media_id or "SIM_IMG_1")
    elif msg_type == "document":
        payload = whatsapp_simulator.build_sample_payload_document(request.phone, request.media_id or "SIM_DOC_1")
    elif msg_type == "location":
        payload = whatsapp_simulator.build_sample_payload_location(
            request.phone,
            request.lat or 33.8938,
            request.lng or 35.5018,
            request.address,
        )
    else:
        raise HTTPException(status_code=400, detail="Unknown message type")

    return whatsapp_simulator.simulate_inbound(None, payload, db=db)


@router.get("/samples")
async def whatsapp_samples(_: None = Depends(_require_simulation)):
    phone = "96100000000"
    return {
        "text": whatsapp_simulator.build_sample_payload_text(phone, "marhaba"),
        "voice": whatsapp_simulator.build_sample_payload_voice(phone),
        "image": whatsapp_simulator.build_sample_payload_image(phone),
        "document": whatsapp_simulator.build_sample_payload_document(phone),
        "location": whatsapp_simulator.build_sample_payload_location(phone, 33.8938, 35.5018, "Beirut"),
        "status_only": whatsapp_simulator.build_sample_payload_status_only(phone),
    }


@router.post("/replay")
async def whatsapp_replay(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    _: None = Depends(_require_simulation),
):
    return whatsapp_simulator.simulate_inbound(None, payload, db=db)
