# WhatsApp Simulation Mode (Dev)

## Overview
This project includes a local WhatsApp simulation mode that exercises the same inbound webhook path used in production, but **never** calls external APIs. The simulation returns the outbound payloads as JSON so you can inspect exactly what would be sent to Meta.

## How It Works
- Simulated inbound payloads follow WhatsApp Cloud API webhook structure.
- The handler runs the normal pipeline: normalization, UX policy, KB retrieval, reranking, and response building.
- Outbound payloads are returned in the response when simulation mode is enabled.

## Endpoints (Dev Only)
These endpoints are only available when:
- `APP_ENV=dev`
- `WHATSAPP_SIMULATION_ENABLED=true`

### POST /dev/whatsapp/simulate
Send a minimal simulation request and get outbound payloads back.

**Example**:
```json
{
  "phone": "96100000000",
  "type": "text",
  "text": "marhaba"
}
```

### POST /dev/whatsapp/replay
Replay a raw WhatsApp webhook payload and get outbound payloads back.

### GET /dev/whatsapp/samples
Returns ready-to-copy JSON webhook samples for text, voice, image, document, location, and status-only events.

## Switching to Live Mode
When you are ready to use Meta WhatsApp Cloud API:

1) Set outbound mode to live:
```
WHATSAPP_OUTBOUND_MODE=live
```

2) Provide tokens:
```
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...
```

3) Keep simulation disabled in production:
```
WHATSAPP_SIMULATION_ENABLED=false
APP_ENV=prod
```

## Notes
- Simulation mode does **not** send any external network requests.
- It is safe to use without real tokens.
- All responses remain KB-grounded; no external facts are invented.
