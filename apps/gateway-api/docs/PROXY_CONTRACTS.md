# Node → Python Proxy Contracts

> All proxies are implemented in [kb-v2-proxy.ts](../src/routes/kb-v2-proxy.ts).
> Python backend base URL: `PYTHON_BASE` env var (default `http://localhost:8012`).

---

## 1. Chat v2 — `POST /api/v2/chat`

**Purpose:** KB v2 card-based chat (multi-domain knowledge)

```typescript
// Request (Node → Python)
POST ${PYTHON_BASE}/api/v2/chat
Content-Type: application/json

{
  "message": string,       // User query (required)
  "session_id"?: string,   // Session tracking
  "channel"?: string       // "web" | "whatsapp"
}

// Response (Python → Node)
{
  "reply": string,         // Answer text
  "intents"?: string[],    // Detected intents
  "sources"?: object[],    // KB card sources
  "confidence"?: number    // 0-1 score
}
```

**SLA:** Timeout 10s, circuit breaker after 3 consecutive failures.

---

## 2. Search — `GET /api/v2/search`

**Purpose:** Multi-domain KB search across v2 tables

```typescript
// Request
GET ${PYTHON_BASE}/api/v2/search?q={query}&limit={n}

// Response
{
  "results": Array<{
    "title": string,
    "text": string,
    "domain": string,
    "score": number
  }>,
  "total": number
}
```

---

## 3. Intent — `POST /api/v2/intent`

**Purpose:** Lebanese dialect intent classification (deprecated — Node has inline classifier)

```typescript
// Request
POST ${PYTHON_BASE}/api/v2/intent
{ "text": string }

// Response
{
  "intent": string,
  "confidence": number,
  "entities"?: object
}
```

**Status:** Deprecated — Node's `ai/intent-extractor.ts` handles this inline.

---

## 4. Salary Compute — `POST /api/v2/salary/compute`

**Purpose:** Pension/severance calculation (deprecated — Node v4 calculator is authoritative)

```typescript
// Request
POST ${PYTHON_BASE}/api/v2/salary/compute
{
  "rank": string,
  "years_of_service": number,
  "degree"?: number
}

// Response
{
  "basic_salary": number,
  "pension": number,
  "severance": number,
  "breakdown": object
}
```

**Status:** Deprecated — Use Node's `POST /api/salary/calc` instead.

---

## 5. Tickets — `POST /api/v2/tickets`

**Purpose:** Create support ticket (Python authoritative — ADR-006)

```typescript
// Request
POST ${PYTHON_BASE}/api/v2/tickets
{
  "subject": string,
  "description": string,
  "category": string,
  "priority"?: "low" | "medium" | "high"
}

// Response
{
  "ticket_id": string,
  "status": "open",
  "created_at": string
}
```

---

## 6. Tickets List — `GET /api/v2/tickets`

**Purpose:** List support tickets with filters

```typescript
// Request
GET ${PYTHON_BASE}/api/v2/tickets?status={status}&limit={n}

// Response
{
  "tickets": Array<{
    "ticket_id": string,
    "subject": string,
    "status": string,
    "created_at": string
  }>,
  "total": number
}
```

---

## 7. Diagnostics — `GET /api/v2/diagnostics`

**Purpose:** Python backend health check

```typescript
// Response
{
  "status": "ok" | "degraded",
  "kb_v2_loaded": boolean,
  "kb_v3_loaded": boolean,
  "uptime": number
}
```

---

## Circuit Breaker Configuration

All proxies use the `python-api` circuit breaker:

```typescript
{
  threshold: 3,          // Open after 3 failures
  resetTimeout: 30_000,  // Try again after 30s
  onOpen: () => log.warn("Python backend circuit OPEN"),
  onClose: () => log.info("Python backend circuit CLOSED")
}
```

## Error Handling

All proxy routes return `502 Bad Gateway` if Python is unreachable:

```json
{
  "error": "Python backend unavailable",
  "fallback": true
}
```
