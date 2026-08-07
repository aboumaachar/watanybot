# Phase 3.5.1 Summary

## WhatsApp hardening

- Optional signature verification via `WHATSAPP_APP_SECRET` + `WHATSAPP_VERIFY_SIGNATURE`.
- Status-only webhook payloads are ignored safely.
- Idempotency using `wa_dedup` (message_id primary key).
- Media messages trigger a single follow-up question.

## Elderly-first UX

- Message paging with `split_text()` and "1 للمتابعة" continuation.
- Clarification limited to 2 options.
- Optional caregiver summary line (enabled per user in `wa_users`).

## Retrieval safety

- Public chat only uses approved KB entries (pending gated by `PUBLIC_SHOW_PENDING`).
- Evidence-first procedure answers: missing fields show "غير مذكور في الدليل".
- Low-confidence/no-match creates a feedback ticket with channel/phone context.

## New tables

- `wa_users` for paging and caregiver mode.
- `wa_dedup` for webhook idempotency.

## How to test

- Run tests:
  - `pytest apps/api/tests/test_phase35.py`
- Optional: verify webhook signature logic by enabling `WHATSAPP_VERIFY_SIGNATURE=true`.
- Optional: exercise paging by sending a long answer and replying with "1".
# Phase 3.5 Summary

## What changed

- Added a locator script and target docs for chat/KB/WhatsApp handlers.
- Added deterministic reranker with iterative retrieval support.
- Added WhatsApp guided UI payload builders and a webhook router.
- Updated chat handler to use reranking, iterative retrieval, and action intents.

## Files added/updated

- scripts/phase35_locator.py
- docs/PHASE35_TARGETS.md
- docs/PHASE35_TARGETS.json
- apps/api/services/reranker.py
- apps/api/services/whatsapp_ui.py
- apps/api/routers/whatsapp.py
- apps/api/routers/public.py
- apps/api/main.py
- apps/api/schemas.py
- apps/api/tests/test_phase35.py

## How to test

- Run unit tests:
  - pytest apps/api/tests/test_phase35.py
- Optional: hit WhatsApp verify endpoint:
  - GET /whatsapp/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=123
- Optional: send a WhatsApp webhook payload to POST /whatsapp/webhook and inspect the response payload.
