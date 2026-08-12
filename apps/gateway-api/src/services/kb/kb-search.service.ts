import { expandArabiziAliases } from "../../utils/normalize-arabizi";
import { normalizeSearchText } from "../../utils/normalize-arabic";
import { getHybridKbIndexStats, searchWeightedKbIndex, type KbWeightedSearchHit } from "./kb-dynamic-index.service";

const NOISY_SOURCE_TYPES = new Set(["json", "markdown", "text", "unknown", "admin-override"]);
const TECHNICAL_NOISE_PATTERN = /(^|[\s_.-])(canonical|cluster|clusters|script|command|implementation|report|debug|diagnostic|pipeline|manifest|snapshot|fixture|spec|test|pilot)([\s_.-]|$)|\.(md|json|csv|tsx?|jsx?)$/i;

export type LiveSearchOptions = {
  limit?: number;
  selectedTags?: string[];
  forceRefreshIndex?: boolean;
};

export type LiveSearchTagResult = {
  id: string;
  label: string;
  labelAr?: string;
  labelEn?: string;
  aliases: string[];
  category: string;
  priority: number;
  score: number;
  matchedFields?: string[];
  matchedTerms?: string[];
};

export type LiveSearchDocumentResult = {
  id: string;
  title: string;
  kbId?: string;
  sourceUrl?: string;
  tags: string[];
  sourceType: "law" | "procedure" | "faq" | "payment" | "salary" | "document" | "admin-override" | "json" | "markdown" | "text" | "unknown";
  excerpt?: string;
  score: number;
  sourcePath?: string;
  matchedFields?: string[];
  matchedTerms?: string[];
};

export type LiveSearchResponse = {
  query: string;
  normalizedQuery: string;
  expandedTerms: string[];
  tags: LiveSearchTagResult[];
  documents: LiveSearchDocumentResult[];
  suggestedQuestions: string[];
  ambiguous: boolean;
  indexStats: {
    records: number;
    sources: number;
    generatedAt: string;
    sourceRoots: string[];
  };
  generatedAt: string;
};

function hasDependentDaughterIntent(text: string): boolean {
  const normalized = normalizeSearchText(text);
  return /(الابنة|ابنة|بنت|daughter|dependent daughter)/.test(normalized);
}

function hasFamilyDependentIntent(text: string): boolean {
  const normalized = normalizeSearchText(text);
  return /(العاتق|عائلي|عائلية|اولاد|الأولاد|ولد|ابن|ابنة|بنت|زوجة|زوجه|family|dependent|dependents|spouse|wife|daughter)/.test(normalized);
}

function buildFallbackDocuments(query: string): LiveSearchDocumentResult[] {
  if (hasDependentDaughterIntent(query)) {
    return [
      {
        id: "fallback-dependent-daughter-faq",
        title: "حقوق الابنة على العاتق: الشروط والمستندات",
        kbId: "family-dependents",
        sourceUrl: "/faq?query=%D8%A7%D9%84%D8%A7%D8%A8%D9%86%D8%A9%20%D8%B9%D9%84%D9%89%20%D8%A7%D9%84%D8%B9%D8%A7%D8%AA%D9%82",
        tags: ["family-dependents", "faq"],
        sourceType: "faq",
        excerpt: "دليل مختصر يشرح شروط الاستفادة للابنة على العاتق والمستندات اللازمة.",
        score: 98,
      },
      {
        id: "fallback-dependent-daughter-procedure",
        title: "إجراءات تسجيل الابنة ضمن المستفيدين",
        kbId: "family-dependents",
        sourceUrl: "/procedures?query=%D8%AA%D8%B3%D8%AC%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%A8%D9%86%D8%A9",
        tags: ["family-dependents", "procedures"],
        sourceType: "procedure",
        excerpt: "خطوات تقديم المعاملة، مكان التقديم، وكيفية متابعة الطلب.",
        score: 94,
      },
      {
        id: "fallback-dependent-daughter-forms",
        title: "النماذج المطلوبة لمعاملة الابنة على العاتق",
        kbId: "family-dependents",
        sourceUrl: "/forms?query=%D8%A7%D9%84%D8%A7%D8%A8%D9%86%D8%A9%20%D8%B9%D9%84%D9%89%20%D8%A7%D9%84%D8%B9%D8%A7%D8%AA%D9%82",
        tags: ["family-dependents", "forms"],
        sourceType: "document",
        excerpt: "قائمة النماذج والمرفقات الأساسية المطلوبة قبل تقديم الطلب.",
        score: 90,
      },
    ];
  }

  if (hasFamilyDependentIntent(query)) {
    return [
      {
        id: "fallback-family-dependents-guide",
        title: "دليل المستفيدين على العاتق",
        kbId: "family-dependents",
        sourceUrl: "/faq?query=%D8%A7%D9%84%D8%B9%D8%A7%D8%AA%D9%82",
        tags: ["family-dependents", "faq"],
        sourceType: "faq",
        excerpt: "مرجع سريع لفئات المستفيدين وشروط كل فئة.",
        score: 88,
      },
    ];
  }

  return [];
}

function hitToTag(hit: KbWeightedSearchHit): LiveSearchTagResult {
  const record = hit.record;
  const primaryTag = record.tags[0] || record.id;
  return {
    id: primaryTag,
    label: record.label,
    labelAr: record.label,
    labelEn: undefined,
    aliases: record.aliases,
    category: record.category,
    priority: record.priority,
    score: hit.score,
    matchedFields: hit.matchedFields,
    matchedTerms: hit.matchedTerms
  };
}

function hitToDocument(hit: KbWeightedSearchHit): LiveSearchDocumentResult {
  const record = hit.record;
  return {
    id: record.id,
    title: record.title,
    kbId: record.kbId,
    sourceUrl: record.sourceUrl,
    tags: record.tags,
    sourceType: record.sourceType,
    excerpt: hit.excerpt || "نتيجة من فهرس قاعدة المعرفة الديناميكي.",
    score: hit.score,
    sourcePath: record.sourcePath,
    matchedFields: hit.matchedFields,
    matchedTerms: hit.matchedTerms
  };
}

function uniqueTags(hits: KbWeightedSearchHit[], limit: number): LiveSearchTagResult[] {
  const byId = new Map<string, LiveSearchTagResult>();
  for (const hit of hits) {
    const tag = hitToTag(hit);
    const existing = byId.get(tag.id);
    if (!existing || tag.score > existing.score) {
      byId.set(tag.id, tag);
    }
  }
  return Array.from(byId.values()).sort((left, right) => right.score - left.score || right.priority - left.priority).slice(0, limit);
}

function hasArabicText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function isNoisyRecord(hit: KbWeightedSearchHit): boolean {
  const record = hit.record;
  if (NOISY_SOURCE_TYPES.has(record.sourceType)) {
    return true;
  }

  const title = String(record.title || "").trim();
  const id = String(record.id || "").trim();
  const label = String(record.label || "").trim();
  const combined = `${title} ${id} ${label}`.trim();

  if (!combined) {
    return true;
  }

  if (TECHNICAL_NOISE_PATTERN.test(combined)) {
    return true;
  }

  const hasLetters = /[\p{L}]/u.test(combined);
  if (!hasLetters) {
    return true;
  }

  if (!hasArabicText(combined) && /[_./\\]/.test(combined)) {
    return true;
  }

  return false;
}

function pickUserFacingHits(hits: KbWeightedSearchHit[]): KbWeightedSearchHit[] {
  return hits.filter((hit) => !isNoisyRecord(hit));
}

export async function searchKbLive(query: string, options: LiveSearchOptions = {}): Promise<LiveSearchResponse> {
  const normalizedQuery = normalizeSearchText(query);
  const limit = Math.max(1, Math.min(Number(options.limit || 8), 20));
  const expandedTerms = Array.from(new Set([query, normalizedQuery, ...expandArabiziAliases(query)].map(normalizeSearchText).filter(Boolean)));
  const hits = searchWeightedKbIndex(query, { limit: Math.max(limit * 3, 12), forceRefresh: Boolean(options.forceRefreshIndex) });
  const userFacingHits = pickUserFacingHits(hits);
  const tags = uniqueTags(userFacingHits, limit);
  const documents = userFacingHits.map(hitToDocument).slice(0, limit);
  const fallbackDocuments = documents.length === 0 ? buildFallbackDocuments(query).slice(0, limit) : [];
  const finalDocuments = documents.length > 0 ? documents : fallbackDocuments;
  const suggestedQuestions = Array.from(new Set(userFacingHits.flatMap((hit) => hit.record.suggestedQuestions))).slice(0, 6);
  const ambiguous = normalizedQuery.length > 0 && tags.length > 1 && Math.abs(tags[0].score - tags[1].score) < 12;
  const stats = getHybridKbIndexStats();
  return {
    query,
    normalizedQuery,
    expandedTerms,
    tags,
    documents: finalDocuments,
    suggestedQuestions,
    ambiguous,
    indexStats: {
      records: stats.records,
      sources: stats.sources,
      generatedAt: stats.generatedAt,
      sourceRoots: stats.sourceRoots
    },
    generatedAt: new Date().toISOString()
  };
}