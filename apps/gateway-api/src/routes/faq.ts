import type { FastifyPluginAsync } from "fastify";
import { loadIndex } from "../procedures/indexer.js";
import type { Procedure } from "../procedures/types.js";

// Veteran-relevance signals for FAQ reranking
const FAQ_VETERAN_HIGH = [
  "متقاعد", "المتقاعد", "متقاعدين", "تقاعد", "معاش", "محارب", "قدامى",
  "أرملة", "ارملة", "ورثة", "شهيد", "عسكري", "الجيش", "قوى الأمن",
  "مساعدة", "تعويض", "طبابة", "منح مدرسية", "مساعدة مدرسية", "مدرسية",
  "pension", "veteran", "retired", "benefit", "compensation", "school aid",
];
const FAQ_GENERIC_SIGNALS = [
  "صورة جوية", "خريطة", "تصاريح عامة", "aerial", "mapping",
];

function scoreVeteranFaqRelevance(item: FaqCandidate): number {
  const hay = [item.question, item.answer, item.category, ...item.tags, ...item.searchTerms].join(" ").toLowerCase();
  const high = FAQ_VETERAN_HIGH.filter((t) => hay.includes(t.toLowerCase())).length;
  const generic = FAQ_GENERIC_SIGNALS.filter((t) => hay.includes(t.toLowerCase())).length;
  if (high >= 2) return 5;
  if (high >= 1) return 4;
  if (generic >= 1) return 1;
  return 3;
}

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
  procedureId: string;
  tags: string[];
};

type FaqCandidate = FaqItem & {
  searchTerms: string[];
  sortOrder: number;
};

type FaqSectionDefinition = {
  key: string;
  sortOrder: number;
  question: (title: string) => string;
  answer: (procedure: Procedure) => string | null;
};

const FAQ_SECTION_DEFINITIONS: FaqSectionDefinition[] = [
  {
    key: "overview",
    sortOrder: 0,
    question: (title) => `ما هي إجراءات ${title}؟`,
    answer: (procedure) => normalizeSummary(procedure.summary_lb),
  },
  {
    key: "requirements",
    sortOrder: 1,
    question: (title) => `ما هي المستندات المطلوبة لـ ${title}؟`,
    answer: (procedure) => formatListAnswer(procedure.requirements),
  },
  {
    key: "eligibility",
    sortOrder: 2,
    question: (title) => `من يمكنه الاستفادة من ${title}؟`,
    answer: (procedure) => formatListAnswer(procedure.eligibility),
  },
  {
    key: "where_to_apply",
    sortOrder: 3,
    question: (title) => `أين أقدّم ${title}؟`,
    answer: (procedure) => formatListAnswer(procedure.where_to_apply),
  },
  {
    key: "steps",
    sortOrder: 4,
    question: (title) => `ما هي خطوات ${title}؟`,
    answer: (procedure) => formatListAnswer(procedure.steps),
  },
  {
    key: "timelines",
    sortOrder: 5,
    question: (title) => `كم تستغرق معاملة ${title}؟`,
    answer: (procedure) => formatListAnswer(procedure.timelines),
  },
  {
    key: "fees",
    sortOrder: 6,
    question: (title) => `ما هي رسوم ${title}؟`,
    answer: (procedure) => formatListAnswer(procedure.fees),
  },
];

const TITLE_BLACKLIST_PATTERNS = [
  /أقسام الكتاب/u,
  /اضغط على القسم/u,
  /جدول تعرفة/u,
  /^(?:احكام|أحكام)(?:\s|$)/u,
  /^(?:ارقام هواتف|أرقام هواتف)/u,
  /^الباب\s+/u,
  /^الفصل\s+/u,
  /\.\d+$/u,
  /^[-–—\s\d.]+$/u,
];

function normalizeText(value: string): string {
  return value.split(/\s+/).filter(Boolean).join(" ");
}

function cleanProcedureTitle(value?: string): string | null {
  if (!value) return null;

  let cleaned = value.split(/[\u200B-\u200F\uFEFF]+/g).join(" ");
  cleaned = normalizeText(cleaned.replace(/[.؟!]+$/u, ""));
  cleaned = cleaned.replace(/^(?:إجراءات|اجراءات)\s+/u, "");

  const parts = cleaned.split(/\s*[-–—]\s*/u).map((part) => normalizeText(part)).filter(Boolean);
  if (parts.length > 1) {
    const preferredPart = parts.find((part) => !/(مستندات|النماذج|نماذج|دليل|رسوم|تعرفة|جدول)/u.test(part));
    cleaned = preferredPart || parts[0] || cleaned;
  }

  const arabicChars = (cleaned.match(/[\u0600-\u06FF]/g) || []).length;
  const digitCount = (cleaned.match(/\d/g) || []).length;
  if (TITLE_BLACKLIST_PATTERNS.some((pattern) => pattern.test(cleaned))) return null;
  if (/[\u0600-\u06FF]\d|\d[\u0600-\u06FF]/u.test(cleaned)) return null;
  if (/[A-Za-z]/.test(cleaned)) return null;
  if (arabicChars < 8) return null;
  if (digitCount > 3) return null;
  if (cleaned.length < 8 || cleaned.length > 80) return null;

  return cleaned;
}

function normalizeSummary(value?: string): string | null {
  if (!value) return null;
  const withoutVersion = normalizeText(value)
    .replace(/^\(نسخة معدلة بتاريخ[^)]*\)\s*/u, "")
    .replace(/^نسخة معدلة بتاريخ[^:]*:\s*/u, "");

  if (/^ملاحظة[:：]/u.test(withoutVersion)) {
    return null;
  }

  if (/^\*\s*\d+/u.test(withoutVersion)) {
    return null;
  }

  const cleaned = withoutVersion.replace(/^ملاحظة:\s*/u, "");

  if (cleaned.length < 40) return null;
  return cleaned;
}

function formatListAnswer(values?: string[]): string | null {
  if (!values?.length) return null;

  const cleaned = Array.from(new Set(values.map((value) => normalizeText(value)).filter((value) => value.length > 0)));
  if (cleaned.length === 0) return null;
  return cleaned.join(" | ");
}

function getProcedureCategory(procedure: Procedure): string {
  const category = procedure.tags?.find((tag) => {
    const cleanedTag = normalizeText(tag);
    return cleanedTag.length >= 3 && cleanedTag.length <= 24 && !/[A-Za-z]/.test(cleanedTag) && !/\d{3,}/.test(cleanedTag);
  }) || procedure.source || "عام";
  return normalizeText(category);
}

function getSearchTerms(procedure: Procedure): string[] {
  return Array.from(new Set([
    procedure.title_ar,
    procedure.summary_lb,
    ...(procedure.faq_variants || []),
    ...(procedure.tags || []),
  ].map((value) => normalizeText(value || "")).filter(Boolean)));
}

function buildFaqCandidates(procedures: Procedure[]): FaqCandidate[] {
  const seen = new Set<string>();
  const items: FaqCandidate[] = [];

  for (const procedure of procedures) {
    const title = cleanProcedureTitle(procedure.title_ar);
    if (!title) continue;

    const category = getProcedureCategory(procedure);
    const searchTerms = getSearchTerms(procedure);

    for (const section of FAQ_SECTION_DEFINITIONS) {
      const answer = section.answer(procedure);
      if (!answer) continue;

      const question = section.question(title);
      const dedupeKey = question.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      items.push({
        id: `${procedure.id}-${section.key}`,
        question,
        answer,
        category,
        procedureId: procedure.id,
        tags: procedure.tags || [],
        searchTerms,
        sortOrder: section.sortOrder,
      });
    }
  }

  // Primary sort: veteran-relevance first. Within same relevance bucket, preserve section sortOrder then alphabetical.
  const sortedItems = [...items].sort((left: FaqCandidate, right: FaqCandidate) => {
    const leftVet = scoreVeteranFaqRelevance(left);
    const rightVet = scoreVeteranFaqRelevance(right);
    if (rightVet !== leftVet) return rightVet - leftVet;
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return left.question.localeCompare(right.question, "ar");
  });
  return sortedItems;
}

export function buildFaqItems(procedures: Procedure[]): FaqItem[] {
  return buildFaqCandidates(procedures).map(({ searchTerms: _searchTerms, sortOrder: _sortOrder, ...item }) => item);
}

function buildFaqSearchHaystack(item: FaqCandidate): string {
  return [item.question, item.answer, item.category, ...item.tags, ...item.searchTerms].join(" ").toLowerCase();
}

export const faqRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v2/faq", async (req) => {
    const { q, limit } = req.query as { q?: string; limit?: string };
    const query = (q || "").trim().toLowerCase();
    const maxItems = Math.min(Math.max(Number(limit) || 100, 1), 200);

    const state = await loadIndex(false);
    let items = buildFaqCandidates(state.procedures);

    if (query) {
      items = items.filter((item) => {
        return buildFaqSearchHaystack(item).includes(query);
      });
    }

    return {
      items: items.slice(0, maxItems).map(({ searchTerms: _searchTerms, sortOrder: _sortOrder, ...item }) => item),
      total: items.length,
    };
  });
};