import { normalizeArabic } from "@watany/shared/arabic";
import type { FormGovernance, FormReviewStatus, FormSourceRegistryEntry, FormTemplate } from "../data/forms-catalog";

const DEFAULT_REVIEW_WINDOW_DAYS = 90;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function inferSourceId(form: Pick<FormTemplate, "sourceId" | "authority" | "category">): string {
  if (form.sourceId) {
    const normalizedSource = normalizeArabic(form.sourceId || "");
    if (normalizedSource.includes("admin") || normalizedSource.includes("ادار")) return "admin";
    if (normalizedSource.includes("laf")) return "laf";
    if (normalizedSource.includes("mof")) return "mof";
    if (normalizedSource.includes("grant") || normalizedSource.includes("تعاضد")) return "grant";
    if (normalizedSource.includes("retirement") || normalizedSource.includes("تقاعد")) return "retirement";
    if (normalizedSource.includes("medical") || normalizedSource.includes("طبابة")) return "medical";
  }

  const authority = normalizeArabic(form.authority || "");
  const category = normalizeArabic(form.category || "");
  const haystack = `${authority} ${category}`;

  if (haystack.includes("ماليه")) return "mof";
  if (haystack.includes("تعاونيه") || haystack.includes("تعاضد") || category.includes("school")) return "grant";
  if (haystack.includes("طبابه") || category.includes("medical")) return "medical";
  if (haystack.includes("اداري") || haystack.includes("شؤون") || category.includes("administrative")) return "admin";
  if (haystack.includes("تقاعد") || haystack.includes("وضع عائلي") || category.includes("retire") || category.includes("family")) return "retirement";
  if (haystack.includes("جيش") || haystack.includes("دفاع")) return "laf";
  return "other";
}

function resolveActionUrls(form: FormTemplate) {
  const encodedId = encodeURIComponent(form.id);
  const sourceId = encodeURIComponent(inferSourceId(form));
  return {
    previewUrl: isNonEmptyString(form.previewUrl) ? form.previewUrl.trim() : `/api/forms/${encodedId}/preview`,
    downloadUrl: isNonEmptyString(form.downloadUrl) ? form.downloadUrl.trim() : `/api/forms/${encodedId}/download`,
    shareUrl: isNonEmptyString(form.shareUrl) ? form.shareUrl.trim() : `/forms/${sourceId}?formId=${encodedId}`,
  };
}

function isActionUrlValid(url: string): boolean {
  return Boolean(url) && (url.startsWith("/") || /^https?:\/\//i.test(url));
}

function getMissingGovernanceFields(governance?: FormGovernance): string[] {
  if (!governance) {
    return ["governance"];
  }

  const missing: string[] = [];
  if (!isNonEmptyString(governance.officialSourceLabel)) missing.push("governance.officialSourceLabel");
  if (!isNonEmptyString(governance.verifiedAt)) missing.push("governance.verifiedAt");
  if (!isNonEmptyString(governance.governanceState)) missing.push("governance.governanceState");
  if (!isNonEmptyString(governance.reviewStatus)) missing.push("governance.reviewStatus");
  if (!isNonEmptyString(governance.lastReviewedAt)) missing.push("governance.lastReviewedAt");
  if (!isNonEmptyString(governance.authorityLabel)) missing.push("governance.authorityLabel");
  if (!isNonEmptyString(governance.reviewOwner)) missing.push("governance.reviewOwner");
  if (!isNonEmptyString(governance.confidence)) missing.push("governance.confidence");
  if (!isNonEmptyString(governance.officialReference) && !isNonEmptyString(governance.officialSourceUrl)) {
    missing.push("governance.officialReference|governance.officialSourceUrl");
  }
  return missing;
}

function getDaysSince(value: string, generatedAt: Date): number | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((generatedAt.getTime() - parsed) / (24 * 60 * 60 * 1000));
}

export type FormsGovernanceReport = {
  generatedAt: string;
  reviewWindowDays: number;
  totalForms: number;
  requiredSources: string[];
  missingSourceCoverage: string[];
  sourceCounts: Array<{ sourceId: string; sourceName: string; count: number; ids: string[] }>;
  sourceRegistry: Array<{
    sourceId: string;
    sourceNameAr: string;
    authorityLabel: string;
    reviewOwner: string;
    reviewStatus: FormReviewStatus;
    lastReviewedAt: string;
    confidence: string;
    formCount: number;
    approvedForms: number;
    nonApprovedForms: number;
    notes?: string;
  }>;
  categoryCounts: Array<{ category: string; count: number; ids: string[] }>;
  governanceStateCounts: Record<string, number>;
  reviewStatusCounts: Record<string, number>;
  confidenceCounts: Record<string, number>;
  missingGovernance: Array<{ id: string; titleAr: string; sourceId: string; missing: string[] }>;
  approvedWithoutEvidence: Array<{ id: string; titleAr: string; sourceId: string }>;
  staleReviews: Array<{ id: string; titleAr: string; sourceId: string; lastReviewedAt: string; daysSinceReview: number; reviewStatus: FormReviewStatus }>;
  nonApprovedRecords: Array<{ id: string; titleAr: string; sourceId: string; reviewStatus: FormReviewStatus; governanceState?: string; notes?: string }>;
  brokenActionUrls: Array<{ id: string; titleAr: string; brokenFields: string[] }>;
  duplicates: string[];
  hasBlockingIssues: boolean;
  blockingIssues: {
    missingSourceCoverage: string[];
    duplicates: string[];
    missingGovernance: Array<{ id: string; titleAr: string; sourceId: string; missing: string[] }>;
    brokenActionUrls: Array<{ id: string; titleAr: string; brokenFields: string[] }>;
    approvedWithoutEvidence: Array<{ id: string; titleAr: string; sourceId: string }>;
  };
};

export function buildFormsGovernanceReport(
  forms: FormTemplate[],
  sourceRegistry: FormSourceRegistryEntry[],
  options?: { generatedAt?: Date; reviewWindowDays?: number }
): FormsGovernanceReport {
  const generatedAt = options?.generatedAt || new Date();
  const reviewWindowDays = options?.reviewWindowDays || DEFAULT_REVIEW_WINDOW_DAYS;
  const sourceCounts = new Map<string, { sourceId: string; sourceName: string; count: number; ids: string[] }>();
  const categoryCounts = new Map<string, { category: string; count: number; ids: string[] }>();
  const governanceStateCounts = new Map<string, number>();
  const reviewStatusCounts = new Map<string, number>();
  const confidenceCounts = new Map<string, number>();
  const missingGovernance: FormsGovernanceReport["missingGovernance"] = [];
  const approvedWithoutEvidence: FormsGovernanceReport["approvedWithoutEvidence"] = [];
  const staleReviews: FormsGovernanceReport["staleReviews"] = [];
  const nonApprovedRecords: FormsGovernanceReport["nonApprovedRecords"] = [];
  const brokenActionUrls: FormsGovernanceReport["brokenActionUrls"] = [];

  const idCounts = new Map<string, number>();
  for (const form of forms) {
    idCounts.set(form.id, (idCounts.get(form.id) || 0) + 1);
  }
  const duplicates = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);

  for (const form of forms) {
    const sourceId = inferSourceId(form);
    const registryEntry = sourceRegistry.find((item) => item.sourceId === sourceId);
    const sourceName = registryEntry?.sourceNameAr || sourceId;
    const sourceMeta = sourceCounts.get(sourceId) ?? { sourceId, sourceName, count: 0, ids: [] };
    sourceMeta.count += 1;
    sourceMeta.ids.push(form.id);
    sourceCounts.set(sourceId, sourceMeta);

    const categoryKey = form.category || "uncategorized";
    const categoryMeta = categoryCounts.get(categoryKey) ?? { category: categoryKey, count: 0, ids: [] };
    categoryMeta.count += 1;
    categoryMeta.ids.push(form.id);
    categoryCounts.set(categoryKey, categoryMeta);

    const missing = getMissingGovernanceFields(form.governance);
    if (missing.length) {
      missingGovernance.push({ id: form.id, titleAr: form.title_ar, sourceId, missing });
    }

    const governanceState = form.governance?.governanceState || "missing";
    governanceStateCounts.set(governanceState, (governanceStateCounts.get(governanceState) || 0) + 1);

    const reviewStatus = form.governance?.reviewStatus || "needs_source";
    reviewStatusCounts.set(reviewStatus, (reviewStatusCounts.get(reviewStatus) || 0) + 1);

    const confidence = form.governance?.confidence || "unknown";
    confidenceCounts.set(confidence, (confidenceCounts.get(confidence) || 0) + 1);

    if (reviewStatus !== "approved") {
      nonApprovedRecords.push({
        id: form.id,
        titleAr: form.title_ar,
        sourceId,
        reviewStatus,
        governanceState: form.governance?.governanceState,
        notes: form.governance?.notes,
      });
    }

    if (reviewStatus === "approved" && !isNonEmptyString(form.governance?.officialReference) && !isNonEmptyString(form.governance?.officialSourceUrl)) {
      approvedWithoutEvidence.push({ id: form.id, titleAr: form.title_ar, sourceId });
    }

    const daysSinceReview = getDaysSince(form.governance?.lastReviewedAt || "", generatedAt);
    if (daysSinceReview !== null && daysSinceReview > reviewWindowDays) {
      staleReviews.push({
        id: form.id,
        titleAr: form.title_ar,
        sourceId,
        lastReviewedAt: form.governance?.lastReviewedAt || "",
        daysSinceReview,
        reviewStatus,
      });
    }

    const actionUrls = resolveActionUrls(form);
    const brokenFields = Object.entries(actionUrls)
      .filter(([, url]) => !isActionUrlValid(url))
      .map(([field]) => field);
    if (brokenFields.length) {
      brokenActionUrls.push({ id: form.id, titleAr: form.title_ar, brokenFields });
    }
  }

  const requiredSources = sourceRegistry.map((item) => item.sourceId);
  const missingSourceCoverage = requiredSources.filter((sourceId) => !sourceCounts.has(sourceId));
  const sourceRegistrySummary = sourceRegistry.map((entry) => {
    const formsInSource = forms.filter((form) => inferSourceId(form) === entry.sourceId);
    const approvedForms = formsInSource.filter((form) => form.governance?.reviewStatus === "approved").length;
    return {
      sourceId: entry.sourceId,
      sourceNameAr: entry.sourceNameAr,
      authorityLabel: entry.authorityLabel,
      reviewOwner: entry.reviewOwner,
      reviewStatus: entry.reviewStatus,
      lastReviewedAt: entry.lastReviewedAt,
      confidence: entry.confidence,
      formCount: formsInSource.length,
      approvedForms,
      nonApprovedForms: formsInSource.length - approvedForms,
      notes: entry.notes,
    };
  });

  const sourceCountArray = [...sourceCounts.values()].sort((a, b) => b.count - a.count || a.sourceName.localeCompare(b.sourceName, "ar"));
  const categoryCountArray = [...categoryCounts.values()].sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, "ar"));

  const blockingIssues = {
    missingSourceCoverage,
    duplicates,
    missingGovernance,
    brokenActionUrls,
    approvedWithoutEvidence,
  };

  return {
    generatedAt: generatedAt.toISOString(),
    reviewWindowDays,
    totalForms: forms.length,
    requiredSources,
    missingSourceCoverage,
    sourceCounts: sourceCountArray,
    sourceRegistry: sourceRegistrySummary,
    categoryCounts: categoryCountArray,
    governanceStateCounts: Object.fromEntries(governanceStateCounts.entries()),
    reviewStatusCounts: Object.fromEntries(reviewStatusCounts.entries()),
    confidenceCounts: Object.fromEntries(confidenceCounts.entries()),
    missingGovernance,
    approvedWithoutEvidence,
    staleReviews,
    nonApprovedRecords,
    brokenActionUrls,
    duplicates,
    hasBlockingIssues: Boolean(
      missingSourceCoverage.length || duplicates.length || missingGovernance.length || brokenActionUrls.length || approvedWithoutEvidence.length
    ),
    blockingIssues,
  };
}