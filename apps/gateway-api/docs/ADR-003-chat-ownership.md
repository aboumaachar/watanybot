# ADR-003: Chat Endpoint Ownership

## Status
Accepted — 2026-03-08

## Context
Both Node gateway and Python backend implement chat logic:

- **Node gateway**: `POST /api/chat` and `POST /api/chat/stream` — uses inline RAG (1,504 JSONL chunks), OpenAI/Ollama via `ai/` modules, intent extraction, emotional scoring, small-talk classification, circuit breakers, SSE streaming.
- **Python backend**: `POST /chat/ask`, `POST /api/chat` (alias), `POST /api/v2/chat` — uses SQLite v3 KB cards, FTS5 search, and a different answer pipeline.
- **Node also proxies** `/api/v2/chat` → Python backend.

The Node gateway is the primary user-facing entry point, handles auth, content moderation, conversation history, and SSE streaming. The Python chat is used via proxy for v2-style KB card answers.

## Decision
**Node gateway** is the authoritative chat service for all user-facing chat.

- Node owns: `/api/chat`, `/api/chat/stream`, conversation history, moderation, streaming, AI provider management.
- Python's `/api/v2/chat` remains as a **secondary backend** called via proxy when KB v2 card-based answers are needed.
- Python's `/chat/ask` and `/api/chat` are **deprecated** — Node should not proxy to them; direct Python chat is only for WhatsApp webhook internally.

## Consequences
- Single chat entry point for frontend (Node gateway).
- Python chat endpoints kept only for WhatsApp integration and v2 proxy.
- No duplicate chat logic to maintain for the user-facing web app.
