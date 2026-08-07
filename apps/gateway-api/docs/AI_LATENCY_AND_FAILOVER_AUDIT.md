# AI_LATENCY_AND_FAILOVER_AUDIT.md
## AI Latency & Failover Audit
## Date: 2026-05-12
## Auditor: Copilot Agent
## Status: EXECUTED — 2 P0 fixes applied, 3 P1 items tracked

---

# 1. SCOPE

This audit covers:
- AI provider configuration and timeout management
- Retry logic and exponential backoff
- Circuit breaker behavior and thresholds
- Streaming vs. non-streaming path
- Fallback chain on AI failure
- First-Token-Byte (TTFB) instrumentation
- KB pre-fetch cache and its limits
- Quality gate for AI responses
- Python API failover

---

# 2. SYSTEM ARCHITECTURE

```
User request → /api/chat
     │
     ├─► Deterministic fast-path (payment override, salary calculator, recruitment, directory, procedure)
     │       └─► Return immediately without calling AI or Python KB
     │
     ├─► KB Pre-fetch (parallel)
     │       ├─► Python KB (http://localhost:8010/chat/ask) — pythonApiCircuitBreaker
     │       └─► Local RAG chunks (SQLite cosine search) — kbCircuitBreaker
     │
     ├─► Pre-fetch shortcuts (clarification, family pension deterministic, topic disambiguation)
     │       └─► Return deterministic response without calling AI provider
     │
     └─► AI Provider (OpenAI-compat) — aiProviderCircuitBreaker
             ├─► complete() with retries
             └─► On failure → RAG-only fallback
```

---

# 3. COMPONENT REVIEW

---

## 3.1 AI Provider Configuration

**File:** `bootstrap/ai-state.ts`, `lib/config.ts`, `ai/openai-compat.ts`

| Parameter | Source | Default | Notes |
|-----------|--------|---------|-------|
| `AI_TIMEOUT_MS` | env | 60,000ms | Complete timeout for `complete()` |
| Streaming timeout | hardcoded | 90,000ms | Not configurable via env |
| `AI_TEMPERATURE` | env | 0.3 | Reasonable for factual Q&A |
| `AI_MAX_TOKENS` | env | 2,048 | Reasonable |
| `AbortSignal.timeout()` | built-in | both paths | Correctly used — aborts hanging requests |

**Status:** WORKING — timeout correctly applied via `AbortSignal.timeout()`.

**Gap (P1):** Streaming timeout (90s) is hardcoded in `openai-compat.ts` line 97. Should be configurable via `AI_STREAM_TIMEOUT_MS` env var so operators can tune it independently from non-streaming.

---

## 3.2 Retry Logic

**Files:** `lib/retry.ts`, `ai/provider-with-retry.ts`, `lib/chat-service.ts`

### Two Layers of Retry (P0 — Redundant)

**Layer 1:** `withRetryWrapper` (via `provider-with-retry.ts`)
- Wraps both `complete()` and `stream()` with `withExponentialBackoff`
- `AI_RETRY_COUNT` (default: 3) attempts total
- Base delay 100ms, max delay 30,000ms, factor 2.0, 20% jitter
- Only retries `isRetryableError`: timeout, ECONNRESET, ECONNREFUSED, network errors

**Layer 2:** `completeAiWithRetries` in `lib/chat-service.ts`
- A second manual retry loop around `aiChat.complete()`
- `AI_RETRY_COUNT` (default: 2) additional attempts
- Fixed 150ms × attempt delay (no jitter, no backoff)

**Problem:** Both layers fire for every AI completion:
- Layer 2 calls `aiChat.complete()` up to 3 times
- Each `aiChat.complete()` call goes through Layer 1 which retries up to 3 times
- **Total: up to 9 AI requests before failing**

This is unintentionally excessive. Under rate-limiting (HTTP 429), all 9 attempts fire without backing off between each top-level retry because `isRetryableError` does not check HTTP status codes — so 429 falls through Layer 1 immediately, then Layer 2 retries the same failing call 2 more times.

**Fix applied:** Removed the double-retry by deleting `completeAiWithRetries` and using `aiChat.complete()` directly — Layer 1 (provider-level backoff) is sufficient.

**Gap (P1 remaining):** `isRetryableError` in `lib/retry.ts` does not handle HTTP 429 (rate limit). Provider-level errors arrive as `Error("AI provider X error 429: ...")`. Need to detect `429` in message string and back off with full `maxDelayMs`.

### Streaming Retry Bug (P1)

`withRetryWrapper` also wraps `stream()`. But `stream()` calls `onEvent({ type: "delta" })` for each token. If the stream fails mid-way and is retried, `onEvent` will be called again from the start — **the caller receives duplicate deltas from the beginning of the response**.

**Impact:** Currently, the streaming path in `chat-service.ts` only calls `complete()` (non-streaming at the HTTP level). The `stream()` method is not called from within the service. Risk is limited to any future direct callers of `provider.stream()`.

**Recommended fix:** Remove `withRetryWrapper` from `stream()` — streaming should not be retried since callbacks are stateful.

---

## 3.3 Circuit Breakers

**File:** `bootstrap/circuit-breakers.ts`, `lib/circuit-breaker.ts`, `lib/config.ts`

Three circuit breakers instantiated at startup:

| Breaker | Threshold | Reset Timeout | Default |
|---------|-----------|---------------|---------|
| `kbCircuitBreaker` | `kbCbThreshold` | `kbCbTimeout` | 5 failures / 30s |
| `pythonApiCircuitBreaker` | `pythonCbThreshold` | `pythonCbTimeout` | 5 failures / 30s |
| `aiProviderCircuitBreaker` | `aiCbThreshold` | `aiCbTimeout` | 5 failures / 30s |

**Circuit breaker state machine:**
- CLOSED → OPEN after 5 failures
- OPEN → HALF_OPEN after 30 seconds
- HALF_OPEN → CLOSED after 3 consecutive successes

**Problem — Circuit breaker not applied to AI calls:**
The `aiProviderCircuitBreaker` exists but inspection of `lib/chat-service.ts` shows that `aiChat.complete()` is called **without wrapping in `aiProviderCircuitBreaker.call()`**. The circuit breaker is only used in `admin-overview.ts` for health check probes.

This means if the AI provider fails 100 times in a row, the circuit breaker never opens — the gateway keeps making AI requests until the retry count is exhausted per-request.

**Fix applied:** See Section 5.

**Python KB circuit breaker:** The `pythonApiCircuitBreaker.call()` is correctly used in `admin-overview.ts` health checks. In `fetchKbPrefetch`, the Python KB call does NOT use the circuit breaker either — it just catches errors and continues. This is acceptable because the Python KB is already a best-effort call with individual error handling.

---

## 3.4 TTFB / First-Token Measurement

**Files:** `lib/chat-service.ts`, `ai/openai-compat.ts`

**Finding:** `firstTokenMs` field exists in `ChatTimings` but is never populated. The streaming `stream()` method receives a `delta` callback and could record when the first delta arrives, but this is not done.

**Current state:** AI TTFB is not measured or logged anywhere in the request path. `openAiMs` in timings is set from `aiStartedAt` (before `complete()` call) to after it returns — this is total AI round-trip, not TTFB.

**Impact:** No visibility into AI provider latency breakdown. Cannot distinguish "AI is slow to start" from "AI is generating a long response".

**Gap (P1):** Add `firstTokenMs` capture in `stream()` — when first non-empty delta arrives, record `Date.now() - streamStart`. Pass this back via the `done` event or a separate callback.

---

## 3.5 AI Fallback Chain

**File:** `lib/chat-service.ts`

When AI `complete()` throws after all retries:
1. `aiFailureCount.value++`
2. `lastAiFailure.value = { at, route, message }` recorded
3. `retrieveChunks(message, aiRagTopK)` called
4. `buildDeterministicAiReply("", 0, fallbackChunks)` called
5. If `fallbackChunks.length > 0` → returns RAG-only answer
6. If no chunks → logs error and returns empty or default error

**Status:** WORKING — RAG-only fallback is functional and tested.

**Additional quality gates active:**
- Empty AI response → substitute KB answer if confidence ≥ 0.2
- Low Arabic ratio < 30% → substitute KB answer
- Raw KB echo pattern detected → substitute `buildKbFallbackReply()`
- All substitutions logged with `warn` level

**AI failure counter:** `aiFailureCount` is a monotonic in-memory counter. It increments but is never reset. This is used only for observability (visible in `GET /api/admin/overview`) — it does not feed the circuit breaker, which has its own internal counter. **ACCEPTABLE.**

---

## 3.6 KB Pre-fetch Cache

**File:** `lib/chat-service.ts`

```typescript
const kbPrefetchCache = new Map<string, { expiresAt: number; result: KbPrefetchResult }>();
const KB_PREFETCH_CACHE_TTL_MS = Number(process.env.AI_KB_PREFETCH_CACHE_TTL_MS || "120000");
```

**Cache key:** `lang:channel:normalized_arabic_message`

**TTL:** 120 seconds (configurable via `AI_KB_PREFETCH_CACHE_TTL_MS`)

**Problem:** `kbPrefetchCache` is a plain `Map` with no size limit. Each unique user query adds a new entry. Under high query volume with diverse questions, this grows unbounded and leaks memory.

**Fix applied:** Added a max-size eviction policy — when cache exceeds 500 entries, evict all expired entries. This is a simple O(n) scan on eviction which is acceptable given the expected cache size. See Section 5.

---

## 3.7 Python API Failover

**File:** `lib/chat-service.ts` — `fetchChatResponseLegacy`

```typescript
const candidates = [pythonBase, fallbackBase].filter(Boolean);
for (const base of candidates) {
  const response = await requestLegacyCandidate(deps, base, payload);
  if (response) return response;
}
```

Fallback base is `pythonBase.includes(":8010") ? "http://localhost:8000" : ""` — tries port 8000 if primary is 8010.

**Status:** WORKING — minimal failover exists.

**Gap (P1):** The fallback base URL is hardcoded derivation logic (`8010 → 8000`). Should be configurable via `PYTHON_API_FALLBACK_URL` env var.

---

# 4. ISSUES SUMMARY

| ID | Issue | Severity | Fixed |
|----|-------|----------|-------|
| AI-01 | Double retry: `completeAiWithRetries` + `withRetryWrapper` = 9 max requests | P0 | ✅ Applied |
| AI-02 | `aiProviderCircuitBreaker` not applied to AI calls | P0 | ✅ Applied |
| AI-03 | `kbPrefetchCache` unbounded — memory leak under load | P0 | ✅ Applied |
| AI-04 | Streaming timeout (90s) hardcoded — not env-configurable | P1 | ⬜ Tracked |
| AI-05 | `isRetryableError` ignores HTTP 429 — no rate-limit backoff | P1 | ⬜ Tracked |
| AI-06 | `stream()` retry via `withRetryWrapper` causes duplicate deltas | P1 | ⬜ Tracked |
| AI-07 | `firstTokenMs` field defined but never captured | P1 | ⬜ Tracked |
| AI-08 | Python API fallback URL hardcoded — not env-configurable | P1 | ⬜ Tracked |

---

# 5. FIXES APPLIED

## FIX AI-01: Remove double retry

**File:** `lib/chat-service.ts`

Replaced `completeAiWithRetries` call with direct `aiChat.complete(messages)`. The provider-level `withRetryWrapper` (3 retries with exponential backoff) is sufficient.

```typescript
// BEFORE: double retry
const aiCompletion = await completeAiWithRetries(deps, aiChat, body, messages, userId);
const replyText = applyAiQualityGate(deps, body, aiCompletion.replyText, prefetch);

// AFTER: single retry layer (withRetryWrapper handles it)
const replyText = applyAiQualityGate(deps, body, await aiChat.complete(messages), prefetch);
```

## FIX AI-02: Apply aiProviderCircuitBreaker to AI calls

**File:** `lib/chat-service.ts`

Wrapped the `aiChat.complete()` call in the injected circuit breaker.

```typescript
// BEFORE:
const replyText = applyAiQualityGate(deps, body, await aiChat.complete(messages), prefetch);

// AFTER:
let rawReply: string;
try {
  rawReply = deps.aiProviderCircuitBreaker
    ? await deps.aiProviderCircuitBreaker.call(() => aiChat.complete(messages))
    : await aiChat.complete(messages);
} catch (err) {
  throw err; // fallback in outer catch
}
const replyText = applyAiQualityGate(deps, body, rawReply, prefetch);
```

## FIX AI-03: Bound the KB pre-fetch cache

**File:** `lib/chat-service.ts`

Added eviction when cache exceeds 500 entries:

```typescript
function evictKbPrefetchCache(): void {
  if (kbPrefetchCache.size < 500) return;
  const now = Date.now();
  for (const [key, entry] of kbPrefetchCache) {
    if (entry.expiresAt <= now) kbPrefetchCache.delete(key);
  }
  // If still too large, drop oldest half
  if (kbPrefetchCache.size >= 500) {
    const keys = [...kbPrefetchCache.keys()];
    for (const key of keys.slice(0, 250)) kbPrefetchCache.delete(key);
  }
}
```

Called at the start of `fetchKbPrefetch` before any cache read.

**TypeScript:** `pnpm --dir apps/gateway-api exec tsc --noEmit` → clean after all fixes.

---

# 6. NEXT AUDIT

Per `WATANY_PLATFORM_AUDIT.md` execution order:

```
Next: VETERAN_FIRST_CONTENT_RANKING_AUDIT.md
  — RAG relevance scoring
  — KB chunk quality
  — Deterministic override coverage
  — Query routing accuracy
```
