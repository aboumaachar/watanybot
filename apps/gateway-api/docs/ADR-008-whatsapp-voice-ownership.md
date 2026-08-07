# ADR-008: WhatsApp & Voice Ownership

## Status
Accepted — 2026-03-08

## Context
- **WhatsApp**: Exclusively in Python — webhook verification, inbound message handling (text, audio, image, document, location), simulation endpoints for dev.
- **Voice**: Exclusively in Node — TTS (`/api/tts`), STT (`/api/stt`), advanced voice processing, voice E2E testing, admin voice config.
- No overlap between services for these domains.

## Decision
**Ownership matches current implementation:**

| Domain | Owner | Routes |
|--------|-------|--------|
| WhatsApp | **Python** | `/whatsapp/webhook`, `/dev/whatsapp/*` |
| Voice (TTS/STT) | **Node** | `/api/tts`, `/api/stt`, `/api/voice/*` |
| Voice Admin | **Node** | `/api/admin/voice-*` |

## Consequences
- No changes needed — ownership already clean.
- WhatsApp stays in Python (good fit for message processing pipelines).
- Voice stays in Node (integrates with OpenAI, Google, Voicerss APIs directly).
