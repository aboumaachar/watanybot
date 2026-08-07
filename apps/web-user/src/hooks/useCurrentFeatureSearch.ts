import { useEffect, useMemo, useRef, useState } from "react";
import { MOF_V9_DATA, type MofV9Card } from "../data/watanyMofMobileViewerV9";
import { api, type OfficialService, type UsefulLink } from "../lib/api";
import { FormsManager, type FormMetadata } from "../lib/formsManager";
import { sortWatanyListingsVeteransFirst } from "../lib/watany-veterans-first-ranking";
import type { DocumentItem, JobVacancy, MarketplaceListing, TxItem } from "../types/domain";
import { WORLD_CUP_FEATURES } from "../components/worldcup/worldCupFeatures";
import type { LiveKbDocumentResult } from "./useLiveKbSearch";

const FORMS_PREFIXES = ["/forms"] as const;
const OFFICIAL_SERVICES_PREFIXES = ["/services/official"] as const;
const JOBS_PREFIXES = ["/jobs"] as const;
const MARKETPLACE_PREFIXES = ["/market", "/marketplace"] as const;
const DOCUMENTS_PREFIXES = ["/documents"] as const;
const USEFUL_LINKS_PREFIXES = ["/useful-links"] as const;
const COMMUNITY_PREFIXES = ["/community", "/groups"] as const;
const ALERTS_PREFIXES = ["/alerts"] as const;
const NOTIFICATIONS_PREFIXES = ["/notifications"] as const;
const NETWORK_PREFIXES = ["/network"] as const;
const HYBRID_CHAT_PREFIXES = ["/hybrid-kb-chat"] as const;

let officialServicesCache: OfficialService[] | null = null;
let marketplaceCache: MarketplaceListing[] | null = null;
let documentsCache: DocumentItem[] | null = null;
let usefulLinksCache: UsefulLink[] | null = null;
let communityOverviewCache: Awaited<ReturnType<typeof api.getCommunityOverview>> | null = null;

const NETWORK_FEATURE_DOCUMENTS: LiveKbDocumentResult[] = [
  {
    id: "network-membership",
    title: "الانضمام إلى شبكة موطني العائلية الجغرافية",
    kbId: "network:membership",
    sourceUrl: "/network",
    score: 97,
    rankingScore: 1097,
    tags: ["network", "membership", "family"],
    sourceType: "document",
    sourceOrigin: "feature",
  },
  {
    id: "network-privacy",
    title: "خصوصية الظهور على مستوى الشبكة والقضاء والبلدة",
    kbId: "network:privacy",
    sourceUrl: "/network",
    score: 95,
    rankingScore: 1095,
    tags: ["network", "privacy", "visibility"],
    sourceType: "document",
    sourceOrigin: "feature",
  },
  {
    id: "network-family-tier",
    title: "فئات العضوية العائلية ونقاط المجتمع",
    kbId: "network:tiers",
    sourceUrl: "/network",
    score: 94,
    rankingScore: 1094,
    tags: ["network", "points", "family tiers"],
    sourceType: "document",
    sourceOrigin: "feature",
  },
  {
    id: "network-map-discovery",
    title: "استكشاف الخريطة بعد التحقق والاعتماد",
    kbId: "network:map",
    sourceUrl: "/network",
    score: 93,
    rankingScore: 1093,
    tags: ["network", "map", "verified"],
    sourceType: "document",
    sourceOrigin: "feature",
  },
];

const HYBRID_CHAT_FALLBACK_DOCUMENTS: LiveKbDocumentResult[] = [
  {
    id: "hybrid-fallback-salary-calculator",
    title: "حاسبة المعاش",
    kbId: "hybrid:salary-calculator",
    sourceUrl: "/salary",
    score: 100,
    rankingScore: 1100,
    tags: ["hybrid", "salary", "calculator", "pension", "compensation", "معاش", "التقاعد", "تعويضات", "حاسبة", "راتب", "حساب"],
    sourceType: "document",
    sourceOrigin: "feature",
  },
  {
    id: "hybrid-fallback-pension-benefits",
    title: "المعاش والتعويضات والاستحقاقات الأساسية",
    kbId: "hybrid:pension-benefits",
    sourceUrl: "/salary",
    score: 98,
    rankingScore: 1098,
    tags: ["hybrid", "salary", "pension", "compensation", "معاش", "تعويضات", "استحقاقات"],
    sourceType: "document",
    sourceOrigin: "feature",
  },
  {
    id: "hybrid-fallback-healthcare",
    title: "الطبابة والاستشفاء والتغطية الصحية",
    kbId: "hybrid:healthcare",
    sourceUrl: "/services/official",
    score: 97,
    rankingScore: 1097,
    tags: ["hybrid", "healthcare", "medical", "hospital", "طبابة", "استشفاء"],
    sourceType: "document",
    sourceOrigin: "feature",
  },
  {
    id: "hybrid-fallback-schools-grants",
    title: "المدارس والمنح والمساعدات التعليمية",
    kbId: "hybrid:schools-grants",
    sourceUrl: "/school-grants",
    score: 96,
    rankingScore: 1096,
    tags: ["hybrid", "schools", "grants", "education", "مدارس", "منح"],
    sourceType: "document",
    sourceOrigin: "feature",
  },
  {
    id: "hybrid-fallback-procedures-documents",
    title: "المعاملات والمستندات والنماذج المطلوبة",
    kbId: "hybrid:procedures-documents",
    sourceUrl: "/procedures",
    score: 95,
    rankingScore: 1095,
    tags: ["hybrid", "procedures", "documents", "forms", "معاملات", "مستندات", "نماذج"],
    sourceType: "document",
    sourceOrigin: "feature",
  },
  {
    id: "hybrid-fallback-alerts-followup",
    title: "التنبيهات والإشعارات ومتابعة الطلبات",
    kbId: "hybrid:alerts-followup",
    sourceUrl: "/alerts",
    score: 94,
    rankingScore: 1094,
    tags: ["hybrid", "alerts", "notifications", "follow-up", "تنبيهات", "إشعارات", "متابعة"],
    sourceType: "document",
    sourceOrigin: "feature",
  },
  {
    id: "hybrid-fallback-jobs-market",
    title: "الوظائف والسوق والخدمات المتاحة",
    kbId: "hybrid:jobs-market",
    sourceUrl: "/jobs",
    score: 93,
    rankingScore: 1093,
    tags: ["hybrid", "jobs", "marketplace", "services", "وظائف", "سوق"],
    sourceType: "document",
    sourceOrigin: "feature",
  },
];

const HYBRID_CHAT_SPOUSE_FALLBACK_DOCUMENTS: LiveKbDocumentResult[] = [
  {
    id: "hybrid-fallback-spouse-pension-guide",
    title: "معاش الزوجة: شروط الاستحقاق والمستندات",
    kbId: "spouse_coverage",
    sourceUrl: "/faq?query=%D9%85%D8%B9%D8%A7%D8%B4%20%D8%A7%D9%84%D8%B2%D9%88%D8%AC%D8%A9",
    score: 100,
    rankingScore: 1110,
    tags: ["hybrid", "spouse", "wife", "widow", "معاش", "زوجة", "الزوجة", "أرملة", "استحقاق"],
    sourceType: "faq",
    sourceOrigin: "feature",
  },
  {
    id: "hybrid-fallback-spouse-reallocation",
    title: "طلب إعادة تخصيص معاش تقاعدي - الزوجة",
    kbId: "spouse_coverage",
    sourceUrl: "/procedures?query=%D8%B7%D9%84%D8%A8%20%D8%A5%D8%B9%D8%A7%D8%AF%D8%A9%20%D8%AA%D8%AE%D8%B5%D9%8A%D8%B5%20%D9%85%D8%B9%D8%A7%D8%B4%20%D8%AA%D9%82%D8%A7%D8%B9%D8%AF%D9%8A%20-%20%D8%A7%D9%84%D8%B2%D9%88%D8%AC%D8%A9",
    score: 99,
    rankingScore: 1109,
    tags: ["hybrid", "spouse", "wife", "معاش", "زوجة", "الزوجة", "إعادة تخصيص", "تقاعد"],
    sourceType: "procedure",
    sourceOrigin: "feature",
  },
  {
    id: "hybrid-fallback-spouse-on-dependents",
    title: "تسجيل الزوجة على العاتق والمستندات المطلوبة",
    kbId: "spouse_coverage",
    sourceUrl: "/procedures?query=%D8%AA%D8%B3%D8%AC%D9%8A%D9%84%20%D8%A7%D9%84%D8%B2%D9%88%D8%AC%D8%A9%20%D8%B9%D9%84%D9%89%20%D8%A7%D9%84%D8%B9%D8%A7%D8%AA%D9%82",
    score: 98,
    rankingScore: 1108,
    tags: ["hybrid", "spouse", "wife", "زوجة", "الزوجة", "العاتق", "عائلي", "مستندات"],
    sourceType: "procedure",
    sourceOrigin: "feature",
  },
];

type CurrentFeatureSearchState = Readonly<{
  documents: LiveKbDocumentResult[];
  isSearching: boolean;
  error: string | null;
}>;

const EMPTY_STATE: CurrentFeatureSearchState = {
  documents: [],
  isSearching: false,
  error: null,
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u0640/g, "")
    .replace(/[\u200f\u200e]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/[ؤئ]/g, "ء")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

function getSearchTokens(value: string): string[] {
  return normalizeSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function matchesTokenizedQuery(haystackValue: string, queryValue: string): boolean {
  const haystack = normalizeSearchText(haystackValue);
  const normalizedQuery = normalizeSearchText(queryValue);
  if (!haystack || !normalizedQuery) {
    return false;
  }

  if (haystack.includes(normalizedQuery)) {
    return true;
  }

  const haystackTokens = getSearchTokens(haystack);
  const queryTokens = getSearchTokens(normalizedQuery);
  if (!haystackTokens.length || !queryTokens.length) {
    return false;
  }

  return queryTokens.some((queryToken) => haystackTokens.some((haystackToken) => haystackToken.includes(queryToken) || queryToken.includes(haystackToken)));
}

function getVisibleLength(value: string): number {
  return value.replace(/\s+/g, "").length;
}

function isUnavailableFeatureSearchError(message: string): boolean {
  return /HTTP 404/i.test(message) || /Unexpected token </i.test(message) || /not valid JSON/i.test(message);
}

function mapTxItemToFeatureDocument(item: TxItem): LiveKbDocumentResult {
  const title = `(${item.tx_no}) ${item.title_ar}`.trim();
  return {
    id: `tx-${item.tx_no}`,
    title,
    kbId: `tx_${item.tx_no}`,
    sourceUrl: `/procedures?query=${encodeURIComponent(title)}`,
    score: 100,
    rankingScore: 1100,
    tags: [item.section_ar].filter(Boolean),
    sourceType: "procedure",
    sourceOrigin: "feature",
  };
}

function matchesRoutePrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function mapFormToFeatureDocument(form: FormMetadata): LiveKbDocumentResult {
  return {
    id: `form-${form.code}`,
    title: `${form.code} - ${form.nameAr}`,
    kbId: `form:${form.code}`,
    sourceUrl: form.url || `/forms?query=${encodeURIComponent(form.nameAr)}`,
    score: 96,
    rankingScore: 1096,
    tags: ["hybrid", "salary", "calculator", "pension", "compensation", "معاش", "التقاعد", "تعويضات", "حاسبة", "راتب"],
    sourceType: "form",
    sourceOrigin: "feature",
  };
}

function mapMofCardToFeatureDocument(card: MofV9Card, rankingIndex: number): LiveKbDocumentResult {
  return {
    id: `mof-card-${card.id}`,
    title: card.title,
    kbId: `mof:${card.id}`,
    sourceUrl: `/procedures?query=${encodeURIComponent(card.title)}`,
    score: Math.max(84, 92 - rankingIndex),
    rankingScore: 1070 - rankingIndex,
    tags: [
      card.family_label,
      ...(card.person_tags || []),
      ...(card.document_ctas || []).map((button) => button.title),
      ...(card.form_ctas || []).map((button) => button.title),
    ].filter(isNonEmptyString),
    sourceType: "procedure",
    sourceOrigin: "feature",
  };
}

function mapOfficialServiceToFeatureDocument(service: OfficialService): LiveKbDocumentResult {
  return {
    id: `official-service-${service.id}`,
    title: service.titleAr,
    kbId: `official-service:${service.id}`,
    sourceUrl: service.route || `/services/official/${encodeURIComponent(service.id)}`,
    score: 95,
    rankingScore: 1095,
    tags: ["official-services", service.providerAr, service.category].filter(Boolean),
    sourceType: "service",
    sourceOrigin: "feature",
  };
}

function mapJobToFeatureDocument(job: JobVacancy): LiveKbDocumentResult {
  return {
    id: `job-${job.id}`,
    title: `${job.title} - ${job.company}`.trim(),
    kbId: `job:${job.id}`,
    sourceUrl: "/jobs",
    score: 93,
    rankingScore: 1093,
    tags: ["jobs", job.location, ...(job.tags || [])].filter(Boolean),
    sourceType: "job",
    sourceOrigin: "feature",
  };
}

function buildMarketplaceLocationText(listing: MarketplaceListing): string {
  return [
    listing.locationLabel,
    listing.location,
    listing.mohafaza,
    listing.caza,
    listing.village,
    listing.exactAddress,
  ].filter(isNonEmptyString).join(" · ");
}

function mapMarketplaceToFeatureDocument(listing: MarketplaceListing): LiveKbDocumentResult {
  const locationLabel = buildMarketplaceLocationText(listing);

  return {
    id: `marketplace-${listing.id}`,
    title: listing.title,
    kbId: `marketplace:${listing.id}`,
    sourceUrl: "/marketplace",
    score: 92,
    rankingScore: 1092,
    tags: ["marketplace", listing.category, locationLabel].filter(isNonEmptyString),
    sourceType: "listing",
    sourceOrigin: "feature",
  };
}

function getDocumentValue(item: DocumentItem, keys: string[]): string {
  const record = item as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function getDocumentTags(item: DocumentItem): string[] {
  const record = item as Record<string, unknown>;
  const tagsValue = record.tags;
  const tags = Array.isArray(tagsValue) ? tagsValue.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];
  return [
    getDocumentValue(item, ["category"]),
    getDocumentValue(item, ["authority", "sourceName"]),
    ...tags,
  ].filter(Boolean);
}

function mapDocumentToFeatureDocument(item: DocumentItem): LiveKbDocumentResult {
  const title = getDocumentValue(item, ["title_ar", "title", "name", "id"]);
  const sourceUrl = getDocumentValue(item, ["preview_url", "previewUrl", "download_url", "downloadUrl", "url"]);
  return {
    id: `document-${getDocumentValue(item, ["id", "title_ar", "title"])}`,
    title,
    kbId: `document:${getDocumentValue(item, ["id", "title_ar", "title"])}`,
    sourceUrl: sourceUrl || "/documents",
    score: 91,
    rankingScore: 1091,
    tags: getDocumentTags(item),
    sourceType: "document-item",
    sourceOrigin: "feature",
  };
}

function mapUsefulLinkToFeatureDocument(item: UsefulLink): LiveKbDocumentResult {
  return {
    id: `useful-link-${item.id}`,
    title: item.label,
    kbId: `useful-link:${item.id}`,
    sourceUrl: item.url,
    score: item.official ? 94 : 89,
    rankingScore: item.official ? 1094 : 1089,
    tags: ["useful-links", item.category, item.status].filter(isNonEmptyString),
    sourceType: "useful-link",
    sourceOrigin: "feature",
  };
}

function mapCommunityGroupToFeatureDocument(group: Awaited<ReturnType<typeof api.getCommunityOverview>>["groups"][number]): LiveKbDocumentResult {
  return {
    id: `community-group-${group.id}`,
    title: group.name,
    kbId: `community:${group.id}`,
    sourceUrl: `/groups/${encodeURIComponent(group.id)}`,
    score: group.isOfficial ? 96 : 91,
    rankingScore: group.isOfficial ? 1096 : 1091,
    tags: ["community", group.category, group.isOfficial ? "official" : "user", group.lastMessagePreview].filter(isNonEmptyString),
    sourceType: "document",
    sourceOrigin: "feature",
  };
}

function mapLiveSessionToFeatureDocument(session: Awaited<ReturnType<typeof api.getCommunityOverview>>["liveSessions"][number]): LiveKbDocumentResult {
  return {
    id: `community-live-${session.id}`,
    title: session.title,
    kbId: `community-live:${session.id}`,
    sourceUrl: session.groupId ? `/groups/${encodeURIComponent(session.groupId)}` : "/community",
    score: session.status === "live" ? 98 : 92,
    rankingScore: session.status === "live" ? 1098 : 1092,
    tags: ["community", "live", session.hostName, session.status].filter(Boolean),
    sourceType: "document",
    sourceOrigin: "feature",
  };
}

function mapAlertToFeatureDocument(alert: Awaited<ReturnType<typeof api.getEmergencyAlerts>>[number]): LiveKbDocumentResult {
  return {
    id: `alert-${alert.id}`,
    title: alert.title,
    kbId: `alert:${alert.id}`,
    sourceUrl: alert.url || "/alerts",
    score: 92,
    rankingScore: 1092,
    tags: ["alerts", alert.country, alert.summary].filter(isNonEmptyString),
    sourceType: "document",
    sourceOrigin: "feature",
  };
}

function mapNotificationToFeatureDocument(item: Awaited<ReturnType<typeof api.getNotifications>>[number]): LiveKbDocumentResult {
  return {
    id: `notification-${item.id}`,
    title: item.title,
    kbId: `notification:${item.id}`,
    sourceUrl: "/notifications",
    score: item.read ? 88 : 94,
    rankingScore: item.read ? 1088 : 1094,
    tags: ["notifications", item.read ? "read" : "unread", item.body].filter(isNonEmptyString),
    sourceType: "document",
    sourceOrigin: "feature",
  };
}

function haystackContainsAllQueryTokens(haystackValue: string, queryValue: string): boolean {
  const haystack = normalizeSearchText(haystackValue);
  const normalizedQuery = normalizeSearchText(queryValue);
  if (!haystack || !normalizedQuery) {
    return false;
  }

  if (haystack.includes(normalizedQuery)) {
    return true;
  }

  const queryTokens = getSearchTokens(normalizedQuery);
  if (!queryTokens.length) {
    return false;
  }

  return queryTokens.every((token) => haystack.includes(token));
}

function buildMofCardSearchText(card: MofV9Card): string {
  return [
    card.title,
    card.family_label,
    card.when_applies,
    ...(card.person_tags || []),
    ...(card.flow_steps || []),
    ...(card.document_ctas || []).map((button) => button.title),
    ...(card.form_ctas || []).map((button) => button.title),
    ...(card.related_cards || []).map((relatedCard) => relatedCard.title),
    ...(card.details_blocks || []),
  ].filter(Boolean).join(" ");
}

function buildHybridProcedureDocuments(query: string): LiveKbDocumentResult[] {
  return MOF_V9_DATA.cards
    .filter((card) => haystackContainsAllQueryTokens(buildMofCardSearchText(card), query))
    .slice(0, 8)
    .map((card, index) => mapMofCardToFeatureDocument(card, index));
}

function buildHybridFormDocuments(query: string): LiveKbDocumentResult[] {
  return FormsManager.searchForms(query)
    .slice(0, 6)
    .map((form, index) => {
      const document = mapFormToFeatureDocument(form);
      return {
        ...document,
        score: Math.max(document.score || 0, 90 - index),
        rankingScore: 1060 - index,
      };
    });
}

function filterDocuments(query: string, items: DocumentItem[]): LiveKbDocumentResult[] {
  const normalizedQuery = normalizeSearchText(query);
  return items
    .filter((item) => {
      const haystack = normalizeSearchText([
        getDocumentValue(item, ["title_ar", "title", "name"]),
        getDocumentValue(item, ["description_ar", "description_lb", "description"]),
        getDocumentValue(item, ["category"]),
        getDocumentValue(item, ["authority", "sourceName"]),
        ...getDocumentTags(item),
      ].filter(Boolean).join(" "));
      return haystack.includes(normalizedQuery);
    })
    .slice(0, 8)
    .map(mapDocumentToFeatureDocument);
}

function filterUsefulLinks(query: string, items: UsefulLink[]): LiveKbDocumentResult[] {
  const normalizedQuery = normalizeSearchText(query);
  return items
    .filter((item) => normalizeSearchText([
      item.label,
      item.description,
      item.category,
      item.status,
    ].filter(Boolean).join(" ")).includes(normalizedQuery))
    .slice(0, 8)
    .map(mapUsefulLinkToFeatureDocument);
}

function searchMarketplaceListings(query: string, listings: MarketplaceListing[]): LiveKbDocumentResult[] {
  const normalizedQuery = normalizeSearchText(query);
  return listings
    .filter((listing) => {
      const haystack = normalizeSearchText([
        listing.title,
        listing.description,
        listing.category,
        buildMarketplaceLocationText(listing),
        listing.seller,
        listing.sellerProfileLabel,
        listing.trustStatus,
      ].filter(isNonEmptyString).join(" "));
      return haystack.includes(normalizedQuery);
    })
    .slice(0, 8)
    .map(mapMarketplaceToFeatureDocument);
}

function buildWorldCupFeatureDocuments(query: string): LiveKbDocumentResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  return WORLD_CUP_FEATURES.filter((feature) => {
    const haystack = normalizeSearchText([feature.label, feature.desc, feature.path].join(" "));
    return haystack.includes(normalizedQuery);
  }).map((feature, index) => ({
    id: `world-cup-feature-${feature.id}`,
    title: feature.label,
    kbId: `world-cup:${feature.id}`,
    sourceUrl: feature.path,
    score: 100 - index,
    rankingScore: 1100 - index,
    tags: ["world-cup", feature.id],
    sourceType: "document",
    sourceOrigin: "feature",
  }));
}

function buildNetworkFeatureDocuments(query: string): LiveKbDocumentResult[] {
  const normalizedQuery = normalizeSearchText(query);
  return NETWORK_FEATURE_DOCUMENTS.filter((item) => {
    const haystack = normalizeSearchText([item.title, ...(item.tags || []), item.kbId || ""].join(" "));
    return haystack.includes(normalizedQuery);
  });
}

function hasSpouseCoverageIntent(value: string): boolean {
  return /(الزوجة|زوجة|زوجه|الأرملة|الارملة|أرملة|ارملة|spouse|wife|widow)/i.test(value);
}

function buildHybridChatFallbackDocuments(query: string): LiveKbDocumentResult[] {
  if (!normalizeSearchText(query)) {
    return [];
  }

  const genericMatches = HYBRID_CHAT_FALLBACK_DOCUMENTS.filter((item) => {
    const haystack = [item.title, ...(item.tags || []), item.kbId || ""].join(" ");
    return matchesTokenizedQuery(haystack, query);
  });

  if (!hasSpouseCoverageIntent(query)) {
    return genericMatches;
  }

  const seen = new Set<string>();
  return [...HYBRID_CHAT_SPOUSE_FALLBACK_DOCUMENTS, ...genericMatches].filter((item) => {
    const key = item.id || `${item.title}|${item.sourceUrl || ""}`;
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildHybridInstantSearchDocuments(query: string): LiveKbDocumentResult[] {
  if (!normalizeSearchText(query)) {
    return [];
  }

  const curatedMatches = buildHybridChatFallbackDocuments(query);
  const procedureMatches = buildHybridProcedureDocuments(query);
  const formMatches = buildHybridFormDocuments(query);

  return mergeFeatureAndKbDocuments(
    mergeFeatureAndKbDocuments(procedureMatches, formMatches),
    curatedMatches,
  );
}

function searchCommunityDocuments(
  query: string,
  overview: Awaited<ReturnType<typeof api.getCommunityOverview>>,
): LiveKbDocumentResult[] {
  const normalizedQuery = normalizeSearchText(query);
  const groupDocs = overview.groups
    .filter((group) => normalizeSearchText([
      group.name,
      group.description,
      group.lastMessagePreview,
      group.category,
      group.isOfficial ? "official" : "",
    ].filter(Boolean).join(" ")).includes(normalizedQuery))
    .slice(0, 5)
    .map(mapCommunityGroupToFeatureDocument);

  const liveDocs = overview.liveSessions
    .filter((session) => normalizeSearchText([
      session.title,
      session.hostName,
      session.status,
    ].filter(Boolean).join(" ")).includes(normalizedQuery))
    .slice(0, 3)
    .map(mapLiveSessionToFeatureDocument);

  return [...liveDocs, ...groupDocs].slice(0, 8);
}

export function mergeFeatureAndKbDocuments(
  featureDocuments: LiveKbDocumentResult[],
  kbDocuments: LiveKbDocumentResult[],
): LiveKbDocumentResult[] {
  const seen = new Set<string>();
  const merged: LiveKbDocumentResult[] = [];

  for (const document of [...featureDocuments, ...kbDocuments]) {
    const key = document.id || `${document.title}|${document.sourceUrl || ""}`;
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(document);
  }

  return merged.sort((left, right) => {
    const originDelta = (right.sourceOrigin === "feature" ? 1 : 0) - (left.sourceOrigin === "feature" ? 1 : 0);
    if (originDelta !== 0) {
      return originDelta;
    }

    return (right.rankingScore || right.score || 0) - (left.rankingScore || left.score || 0);
  });
}

export function useCurrentFeatureSearch(
  input: string,
  originPath: string,
  pageContext: string,
  apiBaseUrl?: string,
  minChars = 1,
): CurrentFeatureSearchState {
  const [state, setState] = useState<CurrentFeatureSearchState>(EMPTY_STATE);
  const requestCounter = useRef(0);

  const visibleQuery = useMemo(() => input.trim(), [input]);
  const visibleLength = useMemo(() => getVisibleLength(visibleQuery), [visibleQuery]);
  const normalizedOriginPath = useMemo(() => String(originPath || "").trim().toLowerCase(), [originPath]);
  const shouldSearch = visibleLength >= minChars;
  const isFormsRoute = useMemo(() => matchesRoutePrefix(normalizedOriginPath, FORMS_PREFIXES), [normalizedOriginPath]);
  const isOfficialServicesRoute = useMemo(() => matchesRoutePrefix(normalizedOriginPath, OFFICIAL_SERVICES_PREFIXES), [normalizedOriginPath]);
  const isJobsRoute = useMemo(() => matchesRoutePrefix(normalizedOriginPath, JOBS_PREFIXES), [normalizedOriginPath]);
  const isMarketplaceRoute = useMemo(() => matchesRoutePrefix(normalizedOriginPath, MARKETPLACE_PREFIXES), [normalizedOriginPath]);
  const isDocumentsRoute = useMemo(() => matchesRoutePrefix(normalizedOriginPath, DOCUMENTS_PREFIXES), [normalizedOriginPath]);
  const isUsefulLinksRoute = useMemo(() => matchesRoutePrefix(normalizedOriginPath, USEFUL_LINKS_PREFIXES), [normalizedOriginPath]);
  const isCommunityRoute = useMemo(() => matchesRoutePrefix(normalizedOriginPath, COMMUNITY_PREFIXES), [normalizedOriginPath]);
  const isAlertsRoute = useMemo(() => matchesRoutePrefix(normalizedOriginPath, ALERTS_PREFIXES), [normalizedOriginPath]);
  const isNotificationsRoute = useMemo(() => matchesRoutePrefix(normalizedOriginPath, NOTIFICATIONS_PREFIXES), [normalizedOriginPath]);
  const isNetworkRoute = useMemo(() => matchesRoutePrefix(normalizedOriginPath, NETWORK_PREFIXES), [normalizedOriginPath]);
  const isHybridChatRoute = useMemo(() => matchesRoutePrefix(normalizedOriginPath, HYBRID_CHAT_PREFIXES), [normalizedOriginPath]);
  const shouldUseHybridFallbackRoute = useMemo(
    () => isHybridChatRoute || (pageContext === "default" && normalizedOriginPath === "/"),
    [isHybridChatRoute, normalizedOriginPath, pageContext],
  );

  useEffect(() => {
    requestCounter.current += 1;
    const requestId = requestCounter.current;

    if (!shouldSearch) {
      setState(EMPTY_STATE);
      return;
    }

    if (pageContext === "world-cup") {
      setState({
        documents: buildWorldCupFeatureDocuments(visibleQuery),
        isSearching: false,
        error: null,
      });
      return;
    }

    if (isNetworkRoute) {
      setState({
        documents: buildNetworkFeatureDocuments(visibleQuery),
        isSearching: false,
        error: null,
      });
      return;
    }

    if (shouldUseHybridFallbackRoute) {
      setState({
        documents: buildHybridInstantSearchDocuments(visibleQuery),
        isSearching: false,
        error: null,
      });
      return;
    }

    if (isFormsRoute) {
      setState({
        documents: FormsManager.searchForms(visibleQuery).slice(0, 8).map(mapFormToFeatureDocument),
        isSearching: false,
        error: null,
      });
      return;
    }

    const timeoutId = globalThis.setTimeout(async () => {
      try {
        setState((current) => ({ ...current, isSearching: true, error: null }));

        if (isOfficialServicesRoute) {
          const services = officialServicesCache || await api.listOfficialServices(apiBaseUrl);
          officialServicesCache = services;
          const normalizedQuery = normalizeSearchText(visibleQuery);
          const documents = services
            .filter((service) => normalizeSearchText([
              service.titleAr,
              service.providerAr,
              service.summaryAr,
              service.helpTextAr,
              ...(service.guideBulletsAr || []),
            ].filter(Boolean).join(" ")).includes(normalizedQuery))
            .slice(0, 8)
            .map(mapOfficialServiceToFeatureDocument);

          if (requestId === requestCounter.current) {
            setState({ documents, isSearching: false, error: null });
          }
          return;
        }

        if (isJobsRoute) {
          const documents = (await api.searchJobs(visibleQuery, apiBaseUrl))
            .slice(0, 8)
            .map(mapJobToFeatureDocument);

          if (requestId === requestCounter.current) {
            setState({ documents, isSearching: false, error: null });
          }
          return;
        }

        if (isMarketplaceRoute) {
          const listings = marketplaceCache || await api.listMarketplace(apiBaseUrl);
          marketplaceCache = listings;
          const documents = searchMarketplaceListings(visibleQuery, listings);

          if (requestId === requestCounter.current) {
            setState({ documents, isSearching: false, error: null });
          }
          return;
        }

        if (isDocumentsRoute) {
          const items = documentsCache || await api.getDocuments(apiBaseUrl);
          documentsCache = items;
          const documents = filterDocuments(visibleQuery, items);

          if (requestId === requestCounter.current) {
            setState({ documents, isSearching: false, error: null });
          }
          return;
        }

        if (isUsefulLinksRoute) {
          const items = usefulLinksCache || await api.getUsefulLinks("", apiBaseUrl);
          usefulLinksCache = items;
          const documents = filterUsefulLinks(visibleQuery, items);

          if (requestId === requestCounter.current) {
            setState({ documents, isSearching: false, error: null });
          }
          return;
        }

        if (isCommunityRoute) {
          const overview = communityOverviewCache || await api.getCommunityOverview(apiBaseUrl);
          communityOverviewCache = overview;
          const documents = searchCommunityDocuments(visibleQuery, overview);

          if (requestId === requestCounter.current) {
            setState({ documents, isSearching: false, error: null });
          }
          return;
        }

        if (isAlertsRoute) {
          const documents = (await api.getEmergencyAlerts(visibleQuery, apiBaseUrl))
            .slice(0, 8)
            .map(mapAlertToFeatureDocument);

          if (requestId === requestCounter.current) {
            setState({ documents, isSearching: false, error: null });
          }
          return;
        }

        if (isNotificationsRoute) {
          const normalizedQuery = normalizeSearchText(visibleQuery);
          const documents = (await api.getNotifications(apiBaseUrl))
            .filter((item) => normalizeSearchText([item.title, item.body].join(" ")).includes(normalizedQuery))
            .slice(0, 8)
            .map(mapNotificationToFeatureDocument);

          if (requestId === requestCounter.current) {
            setState({ documents, isSearching: false, error: null });
          }
          return;
        }

        if (pageContext !== "procedures" && normalizedOriginPath !== "/search") {
          setState(EMPTY_STATE);
          return;
        }

        const results = await api.searchTx(visibleQuery, apiBaseUrl);
        if (requestId !== requestCounter.current) {
          return;
        }

        const ranked = sortWatanyListingsVeteransFirst(
          results.map((item) => ({ ...item, title: item.title_ar, titleAr: item.title_ar })),
          { query: visibleQuery },
        ) as typeof results;

        setState({
          documents: ranked.slice(0, 8).map(mapTxItemToFeatureDocument),
          isSearching: false,
          error: null,
        });
      } catch (error_) {
        if (requestId !== requestCounter.current) {
          return;
        }

        const message = error_ instanceof Error ? error_.message : "feature-search failed";
        setState({
          documents: [],
          isSearching: false,
          error: isUnavailableFeatureSearchError(message) ? null : message,
        });
      }
    }, 60);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [apiBaseUrl, isAlertsRoute, isCommunityRoute, isDocumentsRoute, isFormsRoute, isJobsRoute, isMarketplaceRoute, isNetworkRoute, isNotificationsRoute, isOfficialServicesRoute, isUsefulLinksRoute, normalizedOriginPath, pageContext, shouldSearch, shouldUseHybridFallbackRoute, visibleQuery]);

  return state;
}