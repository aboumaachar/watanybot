/**
 * Watany RAG Pipeline
 *
 * Retrieves relevant KB chunks for a user query and builds
 * the context-augmented message list for the AI provider.
 *
 * Approach: lightweight keyword/BM25-style search over the
 * JSONL RAG chunks loaded at startup. No embedding model required.
 */
import fs from "node:fs";
import type { AiMessage, KbChunk } from "./types";

/* ------------------------------------------------------------------ */
/*  In-memory chunk store                                             */
/* ------------------------------------------------------------------ */

let chunks: KbChunk[] = [];

/**
 * Load RAG chunks from the JSONL file (one JSON object per line).
 * Called once at server startup.
 *
 * Handles field mapping: JSONL uses `chunk_id` → mapped to `id`,
 * and `metadata` may be a JSON string → parsed to an object.
 */
export function loadRagChunks(ragPath: string): number {
  try {
    if (!fs.existsSync(ragPath)) return 0;
    const lines = fs.readFileSync(ragPath, "utf8").split("\n").filter(Boolean);
    chunks = lines.map((line) => {
      const raw = JSON.parse(line);
      const metadata = typeof raw.metadata === "string" ? tryParseJson(raw.metadata) : (raw.metadata || {});
      return {
        id: raw.id || raw.chunk_id || "",
        text: buildChunkText(raw.text || "", metadata),
        chunk_type: raw.chunk_type || "",
        metadata,
        ...(raw.doc_topic_no == null ? {} : { doc_topic_no: raw.doc_topic_no }),
      } as KbChunk;
    });
    return chunks.length;
  } catch {
    return 0;
  }
}

/** Safely parse a JSON string, returning an empty object on failure. */
function tryParseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}

function getMetadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

function getMetadataStringList(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function buildChunkText(rawText: string, metadata: Record<string, unknown>): string {
  const text = rawText.trim();
  const title = getMetadataString(metadata, "title_ar");
  if (!title) return text;

  const titleNorm = normalizeAr(title);
  const textNorm = normalizeAr(text);
  if (textNorm.includes(titleNorm)) return text;

  return text ? `${title}\n${text}` : title;
}

function buildSearchText(chunk: KbChunk): string {
  const metadata = chunk.metadata || {};
  const searchParts = [
    chunk.text,
    getMetadataString(metadata, "title_ar"),
    getMetadataString(metadata, "section_name_ar"),
    getMetadataString(metadata, "category_id"),
    getMetadataString(metadata, "subcategory_id"),
    ...getMetadataStringList(metadata, "keywords_ar"),
    ...getMetadataStringList(metadata, "semantic_tags"),
  ];

  return searchParts.filter(Boolean).join("\n");
}

/** Reset chunks (for testing). */
export function resetRagChunks(): void {
  chunks = [];
}

export function getRagChunkCount(): number {
  return chunks.length;
}

/* ------------------------------------------------------------------ */
/*  Admin helpers: list/get/update/persist chunks                      */
/* ------------------------------------------------------------------ */

export function listChunks(page = 1, pageSize = 50, q?: string) {
  let pool = chunks;
  if (q?.trim()) {
    const tokens = tokenize(q).slice(0, 6);
    pool = pool.map((c) => ({ c, score: scoreChunk(q, tokens, c) })).filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.c);
  }
  const total = pool.length;
  const start = (page - 1) * pageSize;
  return { total, chunks: pool.slice(start, start + pageSize) };
}

export function getChunkById(id: string) {
  return chunks.find((c) => c.id === id) || null;
}

export function updateChunkById(id: string, patch: Partial<KbChunk>) {
  const idx = chunks.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated = { ...chunks[idx], ...patch } as KbChunk;
  chunks[idx] = updated;
  return updated;
}

export function persistChunksToFile(outPath: string) {
  try {
    const jsonl = chunks.map((c) => JSON.stringify(c)).join('\n') + '\n';
    fs.writeFileSync(outPath, jsonl, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Simple keyword search (no embeddings needed)                      */
/* ------------------------------------------------------------------ */

/** Normalize Arabic text: remove diacritics, kashida, normalize hamza/alef. */
function normalizeAr(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .trim();
}

/**
 * Arabic stopwords — common function words that appear everywhere
 * and add zero search signal. Filtering these prevents "لم" from
 * matching every chunk in the KB.
 */
const ARABIC_STOPWORDS = new Set([
  // Negation & particles
  "لم", "لا", "ما", "لن", "ليس", "مش", "مو",
  // Prepositions
  "في", "من", "على", "الى", "عن", "مع", "بين",
  // Pronouns
  "هو", "هي", "هم", "انا", "نحن", "انت", "انتم", "هن",
  // Conjunctions & connectors
  "و", "او", "ان", "اذا", "ثم", "بل", "لكن", "حتى",
  // Demonstratives
  "هذا", "هذه", "ذلك", "تلك", "هاد", "هيدا", "هيدي",
  // Common verbs (too generic)
  "كان", "يكون", "تكون", "كانت", "كانوا",
  // Articles & relative
  "ال", "الذي", "التي", "الذين",
  // Misc high-frequency
  "قد", "عند", "بعد", "قبل", "كل", "بعض", "غير", "فقط",
  "يا", "يلي", "اللي", "شو", "كيف", "وين", "ليش",
  // Single-char leftovers
  "ب", "ل", "ف", "ك",
]);

/** Tokenize text into searchable terms, filtering out stopwords. */
function tokenize(text: string): string[] {
  return normalizeAr(text)
    .split(/[\s\-_.,;:!?()[\]{}"'،؛؟]+/)
    .filter((t) => t.length > 1 && !ARABIC_STOPWORDS.has(t));
}

const TOKEN_PREFIX_RULES = [
  { prefix: "وال", minLength: 4, slice: 1 },
  { prefix: "بال", minLength: 4, slice: 1 },
  { prefix: "كال", minLength: 4, slice: 1 },
  { prefix: "فال", minLength: 4, slice: 1 },
  { prefix: "لل", minLength: 3, slice: 2 },
  { prefix: "ال", minLength: 3, slice: 2 },
  { prefix: "ل", minLength: 3, slice: 1 },
  { prefix: "ب", minLength: 3, slice: 1 },
  { prefix: "و", minLength: 3, slice: 1 },
] as const;

function buildTokenVariants(token: string): string[] {
  const variants = new Set([token]);

  for (const rule of TOKEN_PREFIX_RULES) {
    if (token.startsWith(rule.prefix) && token.length > rule.minLength) {
      variants.add(token.slice(rule.slice));
    }
  }

  return [...variants].filter((variant) => variant.length > 1);
}

function buildSearchTokenSet(text: string): Set<string> {
  return new Set(tokenize(text).flatMap((token) => buildTokenVariants(token)));
}

function includesAnyVariant(text: string, token: string): boolean {
  return buildTokenVariants(token).some((variant) => text.includes(variant));
}

const BENEFICIARY_TOKEN_GROUPS = [
  ["زوجه", "زوجه", "زوج"],
  ["والده", "ام", "والد"],
  ["ابنه", "بنت"],
  ["ابن", "ولد"],
  ["ارمله"],
  ["مطلقه"],
  ["دراسه", "طالب"],
] as const;

const BROAD_PENSION_COMPUTATION_SIGNALS = [
  "احتساب",
  "حساب",
  "تعويض",
  "صرف",
  "مراجعه",
  "مراجعات",
  "لجنه",
  "ماليه",
  "وزاره",
] as const;

function getBeneficiarySignals(queryTokens: string[]): string[] {
  return BENEFICIARY_TOKEN_GROUPS
    .filter((group) => group.some((token) => queryTokens.some((queryToken) => includesAnyVariant(queryToken, token) || includesAnyVariant(token, queryToken))))
    .flat();
}

function isBroadPensionComputationQuery(queryNorm: string, queryTokens: string[], beneficiarySignals: string[]): boolean {
  if (!queryTokens.some((token) => includesAnyVariant(token, "معاش") || includesAnyVariant(token, "تقاعد"))) {
    return false;
  }

  if (beneficiarySignals.length > 0) {
    return false;
  }

  if (queryNorm.includes("احتساب المعاش") || queryNorm.includes("حساب المعاش") || queryNorm.includes("كيف بتم") || queryNorm.includes("كيف يتم")) {
    return true;
  }

  return queryTokens.some((token) => BROAD_PENSION_COMPUTATION_SIGNALS.some((signal) => includesAnyVariant(token, signal) || includesAnyVariant(signal, token)));
}

function scoreToken(qt: string, searchTokens: Set<string>, titleTokens: Set<string>, searchNorm: string, titleNorm: string): number {
  const variants = buildTokenVariants(qt);
  let score = 0;

  for (const variant of variants) {
    if (searchTokens.has(variant)) score += 2;
    if (titleTokens.has(variant)) score += 3;
    if (searchNorm.includes(variant)) score += 1;
    if (titleNorm.includes(variant)) score += 2;
  }

  return score;
}

/** Simple BM25-like scoring for a query against a chunk. */
function scoreChunk(query: string, queryTokens: string[], chunk: KbChunk, scopeHints: string[] = []): number {
  const metadata = chunk.metadata || {};
  const title = getMetadataString(metadata, "title_ar");
  const titleNorm = normalizeAr(title);
  const titleTokens = buildSearchTokenSet(title);
  const searchText = buildSearchText(chunk);
  const searchNorm = normalizeAr(searchText);
  const searchTokens = buildSearchTokenSet(searchText);
  const queryNorm = normalizeAr(query);
  const hasPensionSignal = queryTokens.includes("معاش") || queryTokens.includes("تقاعد") || queryTokens.some((token) => token.startsWith("معاش"));
  const beneficiarySignals = getBeneficiarySignals(queryTokens);
  const broadPensionComputationQuery = isBroadPensionComputationQuery(queryNorm, queryTokens, beneficiarySignals);
  const matchedBeneficiarySignals = beneficiarySignals.filter((signal) => includesAnyVariant(searchNorm, signal) || includesAnyVariant(titleNorm, signal));
  const matchedAllBeneficiarySignals = beneficiarySignals.length > 0 && matchedBeneficiarySignals.length === beneficiarySignals.length;
  const matchedTokens = new Set<string>();
  let score = queryTokens.reduce(
    (total, qt) => {
      const tokenScore = scoreToken(qt, searchTokens, titleTokens, searchNorm, titleNorm);
      if (tokenScore > 0) matchedTokens.add(qt);
      return total + tokenScore;
    },
    0,
  );

  score += matchedTokens.size * matchedTokens.size;
  if (matchedTokens.size === queryTokens.length) {
    score += 6;
  } else if (matchedTokens.size >= Math.max(2, queryTokens.length - 1)) {
    score += 2;
  }

  if (matchedBeneficiarySignals.length > 0) {
    score += matchedBeneficiarySignals.length * 4;
    if (hasPensionSignal) score += 4;
  }
  if (matchedAllBeneficiarySignals) {
    score += hasPensionSignal ? 18 : 10;
  }

  if (queryTokens.includes("معاش") && !includesAnyVariant(searchNorm, "معاش")) {
    score *= matchedBeneficiarySignals.length > 0 ? 0.8 : 0.45;
  }

  if (queryNorm.length > 0 && searchNorm.includes(queryNorm)) {
    score += 3;
  }
  if (queryNorm.length > 0 && titleNorm.includes(queryNorm)) {
    score += 4;
  }

  // Boost overview and steps chunks
  if (chunk.chunk_type === "overview") score *= 1.35;
  if (chunk.chunk_type === "transaction_overview") score *= 1.3;
  if (chunk.chunk_type === "steps") score *= 1.2;
  if (chunk.chunk_type === "requirements") score *= 1.1;
  if (chunk.chunk_type === "documents") score *= 1.1;

  // Veteran-first: boost high-welfare categories (family pension, death/inheritance,
  // spouse/parent coverage). These categories are the most commonly needed by
  // retired veterans and their families and should surface above general
  // administrative content when keyword scores are otherwise equal.
  const categoryId = getMetadataString(metadata, "category_id");
  if (categoryId === "death_inheritance" || categoryId === "family_benefits" || categoryId === "spouse_coverage" || categoryId === "parent_coverage") {
    score *= 1.18;
  } else if (categoryId === "financial" || categoryId === "health_medical" || categoryId === "education") {
    score *= 1.10;
  }

  // Veteran-first: boost RET_ARMY_FAMILIES audience scope — content specifically
  // about dependents/beneficiaries of retired military personnel.
  const audienceScope = getMetadataString(metadata, "audience_scope");
  if (audienceScope === "RET_ARMY_FAMILIES") {
    score *= 1.12;
  }

  // Broad pension-calculation questions should prefer general finance/retirement
  // guidance over beneficiary-specific family cases unless the query names a
  // spouse/child/parent scenario explicitly.
  if (broadPensionComputationQuery && audienceScope === "RET_ARMY_FAMILIES") {
    score *= 0.72;
  } else if (broadPensionComputationQuery && audienceScope === "RET_ALL_FORCES_FINANCE") {
    score *= 1.08;
  }

  if (scopeHints.length > 0) {
    const matchedScopeTokens = new Set<string>();

    for (const scopeHint of scopeHints) {
      const hintTokens = buildSearchTokenSet(scopeHint.replace(/[_-]+/g, " "));
      for (const token of hintTokens) {
        if (searchTokens.has(token) || titleTokens.has(token) || searchNorm.includes(token) || titleNorm.includes(token)) {
          matchedScopeTokens.add(token);
        }
      }
    }

    if (matchedScopeTokens.size > 0) {
      score += matchedScopeTokens.size * 3;
      score *= 1.08;
    }
  }

  return score;
}

/**
 * Minimum score threshold — chunks below this are noise.
 * A 2-word casual query like "صباح الخير" might match common words
 * in law articles with score ~1-2. Real domain queries score 4+.
 */
const MIN_RELEVANCE_SCORE = 3;

/**
 * Retrieve the top-K most relevant chunks for a query.
 * Applies a minimum relevance threshold to filter noise.
 */
export function retrieveChunks(query: string, topK = 5, scopeHints: string[] = []): KbChunk[] {
  if (chunks.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = chunks
    .map((c) => ({ chunk: c, score: scoreChunk(query, queryTokens, c, scopeHints) }))
    .filter((s) => s.score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map((s) => ({ ...s.chunk, score: s.score }));
}

/**
 * Evaluate how relevant the RAG results are to the query.
 * Returns a confidence level: 'high' | 'medium' | 'low' | 'none'
 */
export function evaluateRelevance(query: string, topK = 5): {
  confidence: 'high' | 'medium' | 'low' | 'none';
  topScore: number;
  matchedChunks: number;
} {
  if (chunks.length === 0) return { confidence: 'none', topScore: 0, matchedChunks: 0 };
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return { confidence: 'none', topScore: 0, matchedChunks: 0 };

  const scored = chunks
    .map((c) => ({ chunk: c, score: scoreChunk(query, queryTokens, c) }))
    .filter((s) => s.score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const topScore = scored.length > 0 ? scored[0].score : 0;
  const matchedChunks = scored.length;

  let confidence: 'high' | 'medium' | 'low' | 'none';
  if (topScore >= 8 && matchedChunks >= 2) confidence = 'high';
  else if (topScore >= 5) confidence = 'medium';
  else if (topScore >= MIN_RELEVANCE_SCORE) confidence = 'low';
  else confidence = 'none';

  return { confidence, topScore, matchedChunks };
}

/* ------------------------------------------------------------------ */
/*  Build AI messages from RAG context                                */
/* ------------------------------------------------------------------ */

const DEFAULT_SYSTEM_PROMPT = `أنت "موطني" — مساعد افتراضي بخدمة العسكريين المتقاعدين وعيلهم.
أنت مساعد بأسلوب عسكري، ذكر، لهجتك لبنانية شبه رسمية ونبرتك محترمة وهادئة وداعمة.
أجب دائماً بالعربية اللبنانية شبه الرسمية ما لم يطلب المستخدم لغة أخرى.

قواعد مهمة:
1. استخدم فقط المعلومات الموجودة في سياق قاعدة المعرفة أدناه للإجابة.
2. إذا ما لقيت الجواب بالسياق، قول بصراحة "ما عندي معلومات كافية عن هالموضوع حالياً".
3. كن دقيق ومختصر.
4. اذكر رقم المعاملة والمستندات المطلوبة والخطوات عند الإمكان.
5. ما تخترع معلومات مش موجودة بالسياق.
6. بنهاية كل رد، قول "إذا بدك شي تاني أنا موجود لخدمتك."

إذا كان هناك سياق من قاعدة المعرفة، ستجده أدناه محاطاً بعلامة [KB_CONTEXT].`;

const AI_RAG_CHUNK_MAX_CHARS = Math.max(160, Number(process.env.AI_RAG_CHUNK_MAX_CHARS || "320"));
const AI_HISTORY_MAX_MESSAGES = Math.max(2, Number(process.env.AI_HISTORY_MAX_MESSAGES || "8"));

/**
 * Build the full message list for the AI provider.
 * Includes: system prompt → KB context → conversation history → user query.
 */
export function buildAiMessages(
  query: string,
  kbChunks: KbChunk[],
  history: AiMessage[] = [],
  systemPrompt?: string,
): AiMessage[] {
  // 1. System prompt with KB context
  let system = systemPrompt || DEFAULT_SYSTEM_PROMPT;
  if (kbChunks.length > 0) {
    const contextBlock = kbChunks
      .map((c, i) => {
        const text = c.text.length > AI_RAG_CHUNK_MAX_CHARS ? c.text.slice(0, AI_RAG_CHUNK_MAX_CHARS) + '…' : c.text;
        return `[مصدر ${i + 1} | ${c.chunk_type} | ${(c.metadata as any)?.title_ar || c.id}]\n${text}`;
      })
      .join("\n\n---\n\n");
    system += `\n\n[KB_CONTEXT]\n${contextBlock}\n[/KB_CONTEXT]`;
  } else {
    system += "\n\n[KB_CONTEXT]\nلا يوجد سياق من قاعدة المعرفة لهذا السؤال.\n[/KB_CONTEXT]";
  }

  // 2. Conversation history trimmed to keep streaming latency predictable.
  const recentHistory = history.slice(-AI_HISTORY_MAX_MESSAGES);

  return [
    { role: "system", content: system },
    ...recentHistory,
    { role: "user", content: query },
  ];
}
