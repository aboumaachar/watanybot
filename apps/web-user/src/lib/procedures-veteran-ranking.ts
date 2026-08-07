import type { ProcedureDetail } from "./procedures-api";
import { normalizeProcedureText, resolveProcedureTitle } from "./procedures-presenter";

export type ProcedureRankable = {
  id: string;
  title_ar: string;
  summary_lb: string;
  title_clean?: string;
  summary_clean?: string;
  tags?: string[];
  applies_to?: string[];
  source_label?: string;
  section_label?: string;
  audience_scope?: ProcedureDetail["audience_scope"];
  content_tier?: ProcedureDetail["content_tier"];
  domain?: string;
  relevance_weight?: number;
  score?: number;
};

const VETERAN_STRONG_SIGNALS = [
  "متقاعد",
  "متقاعدين",
  "التقاعد",
  "معاش",
  "محارب",
  "العسكري",
  "العسكريين",
  "الجيش",
  "خدمات المتقاعدين",
  "ورثة العسكري",
];

const VETERAN_FAMILY_SIGNALS = [
  "ارملة",
  "أرملة",
  "ارامل",
  "عائلة",
  "ابنة",
  "ابن",
  "ورثة",
  "وفاة",
  "استشهاد",
];

const GENERIC_ADMIN_SIGNALS = ["اداري", "إداري", "عام", "عمومي", "مؤسسي"];

function buildProcedureSearchableText(item: ProcedureRankable): string {
  return normalizeProcedureText([
    item.title_clean,
    item.title_ar,
    item.summary_clean,
    item.summary_lb,
    item.domain,
    item.source_label,
    item.section_label,
    ...(item.tags || []),
    ...(item.applies_to || []),
  ].filter(Boolean).join(" ")).toLowerCase();
}

export function getProcedureVeteranRelevance(item: ProcedureRankable): number {
  const searchable = buildProcedureSearchableText(item);
  let score = 0;

  switch (item.audience_scope) {
    case "retired_army_only":
      score += 220;
      break;
    case "veteran_direct":
      score += 200;
      break;
    case "veteran_or_family":
      score += 180;
      break;
    case "retired_all_forces":
      score += 170;
      break;
    case "family_direct":
      score += 155;
      break;
    case "active_service_only":
      score += 35;
      break;
    case "institutional_admin":
      score -= 10;
      break;
    case "public_general":
      score -= 20;
      break;
    default:
      break;
  }

  switch (item.content_tier) {
    case "frontline":
      score += 45;
      break;
    case "supporting":
      score += 18;
      break;
    case "archive":
      score -= 8;
      break;
    default:
      break;
  }

  switch (String(item.domain || "")) {
    case "pension":
      score += 40;
      break;
    case "death_inheritance":
      score += 36;
      break;
    case "family_status":
      score += 30;
      break;
    case "service_card":
      score += 26;
      break;
    case "medical":
      score += 22;
      break;
    case "schooling":
      score += 16;
      break;
    default:
      break;
  }

  score += Number.isFinite(item.relevance_weight) ? Number(item.relevance_weight) * 10 : 0;

  const strongHits = VETERAN_STRONG_SIGNALS.filter((term) => searchable.includes(term)).length;
  const familyHits = VETERAN_FAMILY_SIGNALS.filter((term) => searchable.includes(term)).length;
  const genericAdminHits = GENERIC_ADMIN_SIGNALS.filter((term) => searchable.includes(term)).length;

  score += strongHits * 22;
  score += familyHits * 12;

  if (strongHits === 0 && familyHits === 0) {
    score -= genericAdminHits * 12;
  }

  return score;
}

export function isVeteranRelevantProcedure(item: ProcedureRankable): boolean {
  if (["veteran_direct", "family_direct", "veteran_or_family", "retired_army_only", "retired_all_forces"].includes(String(item.audience_scope || ""))) {
    return true;
  }

  if (["institutional_admin", "public_general", "active_service_only"].includes(String(item.audience_scope || ""))) {
    return getProcedureVeteranRelevance(item) >= 70;
  }

  return getProcedureVeteranRelevance(item) >= 44;
}

export function sortByProcedureVeteranRelevance<T extends ProcedureRankable>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const relevanceDelta = getProcedureVeteranRelevance(right) - getProcedureVeteranRelevance(left);
    if (relevanceDelta !== 0) return relevanceDelta;

    const rightScore = Number.isFinite(right.score) ? Number(right.score) : 0;
    const leftScore = Number.isFinite(left.score) ? Number(left.score) : 0;
    const scoreDelta = rightScore - leftScore;
    if (scoreDelta !== 0) return scoreDelta;

    const rightTitle = normalizeProcedureText(resolveProcedureTitle(right));
    const leftTitle = normalizeProcedureText(resolveProcedureTitle(left));
    return leftTitle.localeCompare(rightTitle, "ar");
  });
}

export function getSectionVeteranRelevanceScore(
  procedures: ProcedureRankable[],
  notices: ProcedureRankable[],
  references: ProcedureRankable[],
): number {
  const rankedProcedures = sortByProcedureVeteranRelevance(procedures);
  const rankedNotices = sortByProcedureVeteranRelevance(notices);
  const rankedReferences = sortByProcedureVeteranRelevance(references);

  return Math.max(
    ...rankedProcedures.slice(0, 3).map((item) => getProcedureVeteranRelevance(item)),
    ...rankedNotices.slice(0, 2).map((item) => getProcedureVeteranRelevance(item)),
    ...rankedReferences.slice(0, 2).map((item) => getProcedureVeteranRelevance(item)),
    0,
  );
}