import type { KbWeightedSearchHit } from "./kb-dynamic-index.service";
import { normalizeSearchText } from "../../utils/normalize-arabic";

/**
 * Relevance/provenance gate for local KB candidates.
 * A verified host is not evidence that a particular document supports the user's claim.
 */
export type ReferenceTier = "curated_official" | "linked_indexed" | "unlinked_indexed";

const CURATED_FILE = /(?:^|[\\/])wb-kb-curated-references-20261016\.json$/i;
const CURATED_HOSTS = new Set(["www.lebarmy.gov.lb", "lebarmy.gov.lb", "eservices.finance.gov.lb"]);
const NOISY_TITLES = /(?:^|[\s_.-])(demo|readiness|test|fixture|admin-payments|snapshot|manifest)(?:$|[\s_.-])/i;

function safeHttpsOfficial(url: string | undefined): boolean {
  try {
    const parsed = new URL(url || "");
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && CURATED_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isCuratedOfficialRecord(hit: KbWeightedSearchHit): boolean {
  const r = hit.record;
  return r.id.startsWith("wbkb-")
    && CURATED_FILE.test(r.sourcePath || "")
    && safeHttpsOfficial(r.sourceUrl);
}

/** Curated service pages must not masquerade as evidence for broader legal rights. */
export function curatedScopeMatchesQuery(hit: KbWeightedSearchHit, query: string): boolean {
  if (!isCuratedOfficialRecord(hit)) return true;
  const q = normalizeSearchText(query);
  switch (hit.record.id) {
    case "wbkb-finance-pension-certificate":
      return /(افاده|استعلام|استخرج|شهاده|احصل علي افاده)/.test(q);
    case "wbkb-army-retirement-paper-copy":
      return /(تسريح|احاله|نسخه|مستند التقاعد|وثيقه التقاعد)/.test(q);
    case "wbkb-army-school-paper-correction":
      return /(تسويه|اوراق|تصحيح)/.test(q) && /(مدرس|تعليم|جامع)/.test(q);
    case "wbkb-army-school-overdue-grant":
      return /(متاخر)/.test(q) && /(مدرس|منح|مساعد)/.test(q);
    case "wbkb-army-medical-benefit-declaration":
      return /(تصريح|عدم الاستفاده|الاستفاده)/.test(q) && /(طباب|معالج|استشف)/.test(q);
    default:
      return false;
  }
}

/** A generic "which documents for the transaction?" question needs a specific transaction first. */
export function isGenericUnspecifiedTransaction(query: string): boolean {
  const q = normalizeSearchText(query);
  const asksDocuments = /(مستند|اوراق|معامل|اجراء)/.test(q);
  const qualifying = /(تقاعد|تسريح|معاش|راتب|مدرس|منح|طباب|استشف|صحه|زواج|طلاق|وفاه|سكن|ضريب|سيار|ابنه|ولد|ابن|زوج|دواء|تصريح|معوق)/.test(q);
  return asksDocuments && !qualifying && /(المعامل|معامل|المستند|مستند|الاوراق|اوراق)/.test(q);
}

export function candidateReferenceTier(hit: KbWeightedSearchHit): ReferenceTier {
  if (isCuratedOfficialRecord(hit)) return "curated_official";
  if (/^https:\/\//i.test(hit.record.sourceUrl || "") || /^\/(?!\/)/.test(hit.record.sourceUrl || "")) return "linked_indexed";
  return "unlinked_indexed";
}

const weight: Record<ReferenceTier, number> = {
  curated_official: 3,
  linked_indexed: 2,
  unlinked_indexed: 1,
};

function matchesUserTopic(hit: KbWeightedSearchHit, query: string): boolean {
  const q = normalizeSearchText(query);
  const r = hit.record;
  const identity = normalizeSearchText([r.title, r.label, r.category, ...(r.tags || []), ...(r.aliases || [])].join(" "));
  if (/(مدرس|منح مدرسي|مساعدات مدرسي)/.test(q) && !/(مدرس|تعليم|school)/.test(identity)) return false;
  if (/(طباب|استشف|معالج|medical)/.test(q) && !/(طباب|استشف|معالج|صحه|health|medical)/.test(identity)) return false;
  if (/(معاش|تقاعد|راتب)/.test(q) && !/(معاش|تقاعد|راتب|salary|pension|تسريح)/.test(identity)) return false;

  // A generic ministry homepage is not evidence for a procedure or eligibility rule.
  const title = normalizeSearchText(r.title);
  const isPortal = /^(وزاره|الوزاره|الجيش|الصندوق الوطني)/.test(title);
  if (isPortal && /^(?:https:\/\/[^/]+\/?|https:\/\/[^/]+\/ar\/?)$/i.test(r.sourceUrl || "")) return false;

  // A service form is not a legal authority on pension eligibility/calculation.
  if (/(معاش|تقاعد|راتب)/.test(q) && /(شروط|استحقاق|احتساب|زياد|قانون)/.test(q)) {
    return /(شروط|استحقاق|احتساب|قانون|مرسوم)/.test(identity) && r.sourcePath !== "seed:default-watany-tags";
  }
  return true;
}

export function rankEvidenceCandidates(hits: KbWeightedSearchHit[], query: string): KbWeightedSearchHit[] {
  return hits
    .filter((hit) => hit.record.sourcePath !== "seed:default-watany-tags")
    .filter((hit) => !NOISY_TITLES.test(hit.record.title))
    .filter((hit) => curatedScopeMatchesQuery(hit, query))
    .filter((hit) => matchesUserTopic(hit, query))
    .sort((a, b) =>
      weight[candidateReferenceTier(b)] - weight[candidateReferenceTier(a)]
      || b.score - a.score
      || b.record.priority - a.record.priority
      || a.record.title.localeCompare(b.record.title)
    );
}
