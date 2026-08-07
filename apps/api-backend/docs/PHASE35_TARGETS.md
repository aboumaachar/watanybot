# Phase 3.5 Targets

Repo root: c:\xampp\htdocs\projectx\watanbot

## Chat handler file/function

- apps/api/routers/public.py
  - Function: chat_ask
  - Decorator: @router.post("/chat/ask")

## KB query modules

- apps/api/kb_sqlite.py

## WhatsApp webhook handler

- Not found (will add /whatsapp/webhook)

## Existing endpoints found

- Chat: /chat/ask (public router)
- Procedures search: /api/procedures/search (kb_v3 router)
- Procedures detail: /api/procedures/{tx_no} (kb_v3 router)
- Law search: /api/law/search (kb_v3 router)
- Law detail: /api/law/{article_no} (kb_v3 router)

## Endpoints missing (procedures_detail, law_detail)

- None detected
