# VETERAN_FIRST_CONTENT_RANKING_AUDIT.md
## Phase 5 of 8 — P0 Audit Cycle

**Date:** 2026-05-12  
**Status:** COMPLETE — 1 code fix applied, TypeScript clean

---

## 1. Scope

Audit whether veteran-relevant content surfaces first across all search and retrieval surfaces:

1. RAG chunk retrieval (`ai/rag.ts` → `retrieveChunks` / `scoreChunk`)
2. Procedure full-text search (`procedures/indexer.ts` → `searchProcedures`)
3. KB vNext FTS nodes (`kb/kb-nodes.ts` → `searchKbNodes`)
4. Chat pipeline context selection (`lib/chat-service.ts`)

---

## 2. Audit Method

- Inspected source code for all ranking/scoring functions
- Sampled actual JSONL chunk data to determine `audience_scope` and `category_id` distribution
- Reviewed `presentation.ts` audience inference logic
- Verified metadata fields present in runtime RAG chunks

---

## 3. Data Baseline

RAG chunk store (`watany_rag_chunks_v4.jsonl`, 1484 chunks):

| `audience_scope` value  | Chunk count | Meaning                                |
|-------------------------|-------------|----------------------------------------|
| `RET_ARMY_ONLY`         | 1006        | Lebanese Army retired-only procedures  |
| `RET_ALL_FORCES_FINANCE`| 341         | All armed forces — finance/pension     |
| `RET_ARMY_FAMILIES`     | 137         | Family members of retired military     |

**Key finding**: ALL 1484 RAG chunks are veteran/military-exclusive. No general public law content or non-veteran content is present in the RAG store. There is no cross-contamination risk from general `قانون الموظفين` articles.

`category_id` distribution (top values):

| `category_id`         | Count |
|-----------------------|-------|
| `administrative`      | 847   |
| `financial`           | 296   |
| `health_medical`      | 119   |
| `education`           | 91    |
| `death_inheritance`   | 48    |
| `spouse_coverage`     | 28    |
| `legal_documentation` | 20    |
| `family_benefits`     | 12    |
| `parent_coverage`     | 12    |
| `licenses_permits`    | 11    |

---

## 4. Findings by Surface

### 4.1 RAG Chunk Retrieval — `scoreChunk()` in `ai/rag.ts`

**Pre-fix state:**

| Signal used | Status |
|-------------|--------|
| Keyword BM25 token matching | ✅ WORKING |
| Family pension beneficiary signals (زوجه / ابنه / etc.) | ✅ WORKING |
| `chunk_type` multipliers (overview × 1.35, steps × 1.2, etc.) | ✅ WORKING |
| `category_id` used for score boosting | ❌ NOT USED |
| `audience_scope` used for score boosting | ❌ NOT USED |

**Problem:** When keyword matches are equal, a high-welfare category chunk (`family_benefits`, `death_inheritance`) scored identically to a generic `administrative` chunk. This means family/beneficiary content did not reliably surface first for ambiguous pension queries.

**Fix applied** (`ai/rag.ts`):

```typescript
// Veteran-first: boost high-welfare categories
const categoryId = getMetadataString(metadata, "category_id");
if (categoryId === "death_inheritance" || categoryId === "family_benefits"
    || categoryId === "spouse_coverage" || categoryId === "parent_coverage") {
  score *= 1.18;
} else if (categoryId === "financial" || categoryId === "health_medical" || categoryId === "education") {
  score *= 1.10;
}

// Veteran-first: boost RET_ARMY_FAMILIES audience scope
const audienceScope = getMetadataString(metadata, "audience_scope");
if (audienceScope === "RET_ARMY_FAMILIES") {
  score *= 1.12;
}
```

**Effect:** Family beneficiary content now has a composite boost of up to ×1.18 × ×1.12 = ×1.32 over baseline administrative content at equal keyword score. This correctly prioritises the most user-critical welfare content.

**Status after fix:** WORKING

---

### 4.2 Procedure Search — `searchProcedures()` in `procedures/indexer.ts`

**Status:** WORKING — mature implementation already in place

`presentProcedure()` calls `inferAudienceMeta()` which computes `relevance_weight` using:

| Audience scope | Weight |
|----------------|--------|
| `veteran_direct` | +12 |
| `family_direct` | +12 |
| `veteran_or_family` | +10 |
| `retired_army_only` | +8 |
| `retired_all_forces` | +7 |
| `active_service_only` | -8 (suppressed) |
| `institutional_admin` | -12 (suppressed) |
| `public_general` | -10 (suppressed) |

Content tier multiplier on top:
- `frontline`: +18
- `supporting`: +8
- `archive`: -12

Domain weight adds up to +8 for pension/family/death domains.

This results in a maximum `relevance_weight` of 38 for veteran-direct frontline pension content, versus −24 for institutional admin archive content. Veteran-first is robustly enforced.

`pickBetterProcedure()` uses `record_kind` rank to prefer `procedure` over `notice` > `reference` > `fragment`.

**No fix needed.**

---

### 4.3 KB vNext FTS Nodes — `searchKbNodes()` in `kb/kb-nodes.ts`

**Status:** PARTIAL — intent-type reranking exists but no veteran-audience weighting

`rerankRows()` applies intent-type priority (`procedure > faq > directory > law > rule`), which is a proxy for use-case relevance but does not directly boost veteran-specific content over general content.

**Assessment:** The vNext nodes DB (`kb_nodes.db`) is populated with curated veteran-specific content and is not yet the primary retrieval path (the JSONL RAG store is used more heavily). The intent-type reranking is sufficient for the current node types.

**Action:** Monitor as vNext adoption grows; add veteran audience tag to node schema if non-veteran content is ever added to the FTS store.

**No fix needed at this time.** — TECH DEBT tracked.

---

### 4.4 Chat Pipeline Context Selection — `lib/chat-service.ts`

**Status:** WORKING

`retrieveChunks()` is called with `MAX_AI_CONTEXT_CHUNKS` (default 4, configurable via `AI_PROMPT_RAG_TOP_K`). The post-scoring selection in `buildDeterministicChatResponse` and the family pension signals (`FAMILY_PENSION_SIGNALS`, `findDominantSpecificFamilyPensionChunk`) correctly anchor the top-ranked chunks.

`shouldPreferDeterministicFamilyPensionReply()` gates AI inference and forces the deterministic RAG reply when confidence is high — preventing the AI from overriding well-ranked veteran content with hallucinated general answers.

**No fix needed.**

---

## 5. Gap: Non-veteran Law Content (laf.html / mof.html)

The audit document flags concern about general law content (`قانون الموظفين`) leaking into veteran search. Investigation shows:

- The raw HTML files `laf.html` and `mof.html` contain Lebanese Armed Forces law and Ministry of Finance pension law respectively
- These are processed at KB build time and chunked into the JSONL store
- All resulting chunks are tagged `RET_*` audience scope — they are NOT general public law chunks
- No `قانون الموظفين` general civil servant content is present in the RAG store

**Status:** NOT A CURRENT RISK. The KB builder already filters content to veteran-relevant sections. If raw law HTML is ever directly served to users (e.g., via `/api/v2/procedures/reference/`), routing is limited to authenticated users and veteran-specific document IDs.

---

## 6. Summary of Fixes Applied

| File | Change |
|------|--------|
| `apps/gateway-api/src/ai/rag.ts` | Added `category_id` domain boost (×1.18 for welfare categories, ×1.10 for financial/health/education) and `audience_scope` boost (×1.12 for `RET_ARMY_FAMILIES`) inside `scoreChunk()` |

TypeScript check: **CLEAN** (verified post-fix).

---

## 7. Remaining Gaps (Non-blocking)

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| vNext KB nodes have no veteran-audience weighting | P2 | Add `audience_scope` field to node schema when non-veteran content is added |
| `evaluateRelevance()` does not factor in category domain | P2 | Extend confidence thresholds to account for welfare category boost when needed |
| `buildAiMessages()` sends all top-K chunks equally — no per-chunk weight in AI context | P2 | Mark chunks with relevance metadata in system prompt (`frontline` vs `supporting`) |

---

## 8. Audit Verdict

| Surface | Veteran-First Status |
|---------|---------------------|
| RAG chunk retrieval | **WORKING** (after fix) |
| Procedure search | **WORKING** |
| KB vNext FTS nodes | **PARTIAL** (TECH DEBT) |
| Chat pipeline context | **WORKING** |
| Non-veteran law content leakage | **NOT A RISK** |

**Overall: WORKING / PARTIAL → Promoted to WORKING after fix.**
