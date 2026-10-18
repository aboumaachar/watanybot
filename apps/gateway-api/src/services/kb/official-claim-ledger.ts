import type { LiveSearchDocumentResult } from "./kb-search.service";

/**
 * WB-KB-004: closed-set, source-reviewed procedural claims.
 * Human-reviewed metadata and a source URL DO NOT automatically prove changing law.
 * No AI-generated claim may be promoted to a checked claim via token overlap or score.
 */
export type ReviewedProceduralClaim = {
  id: string;
  sourceId: string;
  sourceUrl: string;
  textAr: string;
  evidenceExcerpt: string;
  reviewedAt: string;
  reviewValidThrough: string;
};

export type ClaimCheck = {
  status: "source_checked" | "stale" | "unverified";
  reason: "EXACT_SOURCE_AND_STATEMENT" | "REVIEW_EXPIRED" | "UNREVIEWED_CLAIM" | "SOURCE_MISMATCH" | "INVALID_REVIEW_DATE";
  claim?: ReviewedProceduralClaim;
};

export const REVIEWED_PROCEDURAL_CLAIMS: readonly ReviewedProceduralClaim[] = [
  {
    id: "finance.pension.service",
    sourceId: "wbkb-finance-pension-certificate",
    sourceUrl: "https://eservices.finance.gov.lb/retiredInfo.aspx",
    textAr: "تتضمن خدمة معاش التقاعد لدى وزارة المالية حقلاً لرقم التقاعد.",
    evidenceExcerpt: "رقم التقاعد",
    reviewedAt: "2026-10-16",
    reviewValidThrough: "2026-11-15",
  },
  {
    id: "army.retirement.copy.request",
    sourceId: "wbkb-army-retirement-paper-copy",
    sourceUrl: "https://www.lebarmy.gov.lb/ar/node/91654",
    textAr: "تتيح معاملة نسخة مستند التسريح أو الإحالة على التقاعد تقديم كتاب من صاحب العلاقة أو تعبئة النموذج 76.",
    evidenceExcerpt: "كتاب من صاحب العلاقة يتضمن تفاصيل الطلب او تعبئة أنموذج رقم 76",
    reviewedAt: "2026-10-16",
    reviewValidThrough: "2026-11-15",
  },
  {
    id: "army.school.settlement.request",
    sourceId: "wbkb-army-school-paper-correction",
    sourceUrl: "https://www.lebarmy.gov.lb/ar/node/91666",
    textAr: "تتطلب معاملة تسوية الأوراق المدرسية كتاباً من صاحب العلاقة يتضمن تفاصيل الطلب.",
    evidenceExcerpt: "كتاب من صاحب العلاقة يتضمن تفاصيل الطلب",
    reviewedAt: "2026-10-16",
    reviewValidThrough: "2026-11-15",
  },
  {
    id: "army.school.overdue.request",
    sourceId: "wbkb-army-school-overdue-grant",
    sourceUrl: "https://www.lebarmy.gov.lb/ar/administrative_transactiont/%D8%B7%D9%84%D8%A8-%D9%85%D9%86%D8%AD-%D9%85%D8%B3%D8%A7%D8%B9%D8%AF%D8%A7%D8%AA-%D9%85%D8%AF%D8%B1%D8%B3%D9%8A%D8%A9-%D9%85%D8%AA%D8%A3%D8%AE%D8%B1%D8%A9",
    textAr: "تتضمن مستندات طلب المساعدات المدرسية المتأخرة بيان أقساط المؤسسة التعليمية.",
    evidenceExcerpt: "بيان أقساط المؤسسة التعليمية",
    reviewedAt: "2026-10-16",
    reviewValidThrough: "2026-11-15",
  },
  {
    id: "army.medical.declaration.request",
    sourceId: "wbkb-army-medical-benefit-declaration",
    sourceUrl: "https://www.lebarmy.gov.lb/ar/administrative_transactiont/%D8%B7%D9%84%D8%A8-%D8%AA%D8%B5%D8%B1%D9%8A%D8%AD-%D8%A8%D8%A7%D9%84%D8%A5%D8%B3%D8%AA%D9%81%D8%A7%D8%AF%D8%A9-%D8%A3%D9%88-%D8%B9%D8%AF%D9%85-%D8%A7%D9%84%D8%A5%D8%B3%D8%AA%D9%81%D8%A7%D8%AF%D8%A9-%D9%85%D9%86-%D8%A7%D9%84%D8%B7%D8%A8%D8%A7%D8%A8%D8%A9-%D9%88%D8%A7%D9%84%D9%85%D8%B9%D8%A7%D9%84%D8%AC%D8%A9-%D8%A7%D9%84%D9%85%D8%AC%D8%A7%D9%86%D9%8A%D8%A9-%D8%B9%D9%84%D9%89",
    textAr: "تتيح معاملة تصريح الاستفادة أو عدم الاستفادة من الطبابة تقديم كتاب من صاحب العلاقة أو تعبئة النموذج 22.",
    evidenceExcerpt: "كتاب من صاحب العلاقة يتضمن تفاصيل الطلب أو تعبئة أنموذج رقم 22",
    reviewedAt: "2026-10-16",
    reviewValidThrough: "2026-11-15",
  },
];

/** Only strict, closed-list matches can be labeled source-checked. */
export function assessProceduralClaim(
  statement: string,
  source: Pick<LiveSearchDocumentResult, "id" | "sourceUrl" | "referenceTier">,
  at: Date = new Date(),
): ClaimCheck {
  const record = REVIEWED_PROCEDURAL_CLAIMS.find((item) => item.textAr === statement);
  if (!record) return { status: "unverified", reason: "UNREVIEWED_CLAIM" };
  if (record.sourceId !== source.id || record.sourceUrl !== source.sourceUrl || source.referenceTier !== "curated_official") {
    return { status: "unverified", reason: "SOURCE_MISMATCH" };
  }
  if (!Number.isFinite(at.getTime())) return { status: "unverified", reason: "INVALID_REVIEW_DATE" };
  const day = at.toISOString().slice(0, 10);
  if (day < record.reviewedAt || day > record.reviewValidThrough) {
    return { status: "stale", reason: "REVIEW_EXPIRED" };
  }
  return { status: "source_checked", reason: "EXACT_SOURCE_AND_STATEMENT", claim: record };
}

export function getSourceCheckedClaims(
  sources: readonly LiveSearchDocumentResult[],
  at: Date = new Date(),
): ReviewedProceduralClaim[] {
  const result: ReviewedProceduralClaim[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const candidate of REVIEWED_PROCEDURAL_CLAIMS) {
      if (seen.has(candidate.id)) continue;
      const assessment = assessProceduralClaim(candidate.textAr, source, at);
      if (assessment.status !== "source_checked" || !assessment.claim) continue;
      seen.add(candidate.id);
      result.push(assessment.claim);
      if (result.length >= 2) return result;
    }
  }
  return result;
}
