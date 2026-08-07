import { randomUUID } from "node:crypto";
import type { RecruitmentAnnouncement } from "@watany/types";
import { normalizeArabic as normalizeSharedArabic } from "@watany/shared/arabic";
import { readStore, writeStore } from "./store.js";
import type { ResolvedRecruitmentQuery } from "./types.js";

const NOW = () => new Date().toISOString();
const RECRUITMENT_MATCH_THRESHOLD = 0.34;

const STOP_WORDS = new Set([
  "ال",
  "الى",
  "إلى",
  "في",
  "عن",
  "من",
  "على",
  "هل",
  "ما",
  "متى",
  "شو",
  "كيف",
  "اذا",
  "إذا",
  "بعد",
  "قبل",
  "وين",
]);

const APPARATUS_ALIASES: Array<{ apparatusName: string; aliases: string[] }> = [
  { apparatusName: "الجيش اللبناني", aliases: ["جيش", "الجيش", "الجيش اللبناني"] },
  { apparatusName: "قوى الأمن الداخلي", aliases: ["قوى الامن", "قوى الأمن", "الامن الداخلي", "الأمن الداخلي", "قوى الامن الداخلي", "قوى الأمن الداخلي"] },
  { apparatusName: "الأمن العام", aliases: ["الامن العام", "الأمن العام", "امن عام"] },
  { apparatusName: "أمن الدولة", aliases: ["امن الدولة", "أمن الدولة"] },
  { apparatusName: "الجمارك", aliases: ["جمارك", "الجمارك"] },
  { apparatusName: "الدفاع المدني", aliases: ["دفاع مدني", "الدفاع المدني"] },
];

const RECRUITMENT_SIGNALS = [
  "تطويع",
  "تطوع",
  "تجنيد",
  "انتساب",
  "التحاق",
  "مباراه",
  "مباراة",
  "مرشحين",
  "مرشح",
  "عسكري",
] as const;

const RECRUITMENT_DETAIL_SIGNALS = [
  "شروط",
  "المستندات",
  "مستندات",
  "اوراق",
  "أوراق",
  "وثائق",
  "وين",
  "مكان",
  "اين",
  "طريقة",
  "كيف",
  "تقديم",
  "قد",
  "متى",
  "فئات",
  "فئة",
] as const;

function normalizeText(value: string): string {
  return normalizeSharedArabic(value)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function parseTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalString(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeStringArray(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function compareAnnouncements(left: RecruitmentAnnouncement, right: RecruitmentAnnouncement): number {
  const leftTs = parseTimestamp(left.startDate) ?? parseTimestamp(left.updatedAt) ?? parseTimestamp(left.createdAt) ?? 0;
  const rightTs = parseTimestamp(right.startDate) ?? parseTimestamp(right.updatedAt) ?? parseTimestamp(right.createdAt) ?? 0;
  return rightTs - leftTs || right.updatedAt.localeCompare(left.updatedAt);
}

function getEffectiveStatus(
  announcement: RecruitmentAnnouncement,
  nowMs = Date.now(),
): RecruitmentAnnouncement["status"] {
  if (announcement.status === "cancelled" || announcement.status === "draft") {
    return announcement.status;
  }

  const endMs = parseTimestamp(announcement.endDate);
  if (endMs !== null && endMs < nowMs) {
    return "expired";
  }

  return announcement.status;
}

function withEffectiveStatus(announcement: RecruitmentAnnouncement): RecruitmentAnnouncement {
  const status = getEffectiveStatus(announcement);
  return status === announcement.status ? announcement : { ...announcement, status };
}

function isPublicAnnouncement(announcement: RecruitmentAnnouncement, nowMs = Date.now()): boolean {
  return getEffectiveStatus(announcement, nowMs) === "published";
}

function detectApparatusSignals(query: string): string[] {
  const normalizedQuery = normalizeText(query);
  return APPARATUS_ALIASES
    .filter(({ aliases }) => aliases.some((alias) => normalizedQuery.includes(normalizeText(alias))))
    .map(({ apparatusName }) => apparatusName);
}

// These terms indicate pension/benefits context for retired/deceased soldiers — not recruitment.
const RECRUITMENT_ANTI_SIGNALS = [
  "متقاعد",
  "تقاعد",
  "وفاه",
  "وفاة",
  "متوفي",
  "متوفى",
  "توفي",
  "توفى",
  "مستحقات",
  "معاش",
  "ورثه",
  "ورثة",
  "ترك الخدمه",
  "ترك الخدمة",
  // Welfare/social affairs context — not recruitment
  "شؤون الاجتماعي",
  "رعاية الاجتماعي",
  "جهاز الرعاية",
  "رعاية والشؤون",
] as const;

function isRecruitmentQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return false;
  // Queries about retired soldiers or death benefits are not recruitment queries
  if (RECRUITMENT_ANTI_SIGNALS.some((signal) => normalizedQuery.includes(normalizeText(signal)))) return false;
  if (RECRUITMENT_SIGNALS.some((signal) => normalizedQuery.includes(signal))) return true;
  return detectApparatusSignals(query).length > 0;
}

function classifyRecruitmentQuery(query: string): "listing" | "details" | null {
  if (!isRecruitmentQuery(query)) return null;
  const normalizedQuery = normalizeText(query);
  if (RECRUITMENT_DETAIL_SIGNALS.some((signal) => normalizedQuery.includes(signal))) {
    return "details";
  }
  return "listing";
}

function scoreAnnouncementMatch(query: string, announcement: RecruitmentAnnouncement, matchedApparatus: string[]): number {
  const queryNorm = normalizeText(query);
  const titleNorm = normalizeText(announcement.title);
  const apparatusNorm = normalizeText(announcement.apparatusName);

  let score = 0;
  if (queryNorm.includes(titleNorm) || titleNorm.includes(queryNorm)) {
    score = Math.max(score, 0.96);
  }

  if (announcement.announcementNumber) {
    const numberNorm = normalizeText(announcement.announcementNumber);
    if (numberNorm && queryNorm.includes(numberNorm)) {
      score = Math.max(score, 0.94);
    }
  }

  if (matchedApparatus.some((apparatus) => normalizeText(apparatus) === apparatusNorm)) {
    score = Math.max(score, 0.88);
  }

  const queryTokens = tokenize(query);
  const announcementTokens = new Set([
    ...tokenize(announcement.title),
    ...tokenize(announcement.apparatusName),
    ...announcement.eligibleCategories.flatMap((entry) => tokenize(entry)),
    ...announcement.conditions.flatMap((entry) => tokenize(entry)),
  ]);

  if (queryTokens.length > 0 && announcementTokens.size > 0) {
    const sharedTokens = queryTokens.filter((token) => announcementTokens.has(token));
    const overlap = sharedTokens.length / Math.max(queryTokens.length, announcementTokens.size);
    score = Math.max(score, overlap);
  }

  return score;
}

export function createRecruitmentAnnouncement(
  payload: Omit<RecruitmentAnnouncement, "id" | "createdAt" | "updatedAt" | "createdBy">,
  adminId: string,
): RecruitmentAnnouncement {
  const store = readStore();
  const timestamp = NOW();
  const announcement: RecruitmentAnnouncement = {
    id: randomUUID(),
    title: payload.title.trim(),
    apparatusName: payload.apparatusName.trim(),
    announcementNumber: normalizeOptionalString(payload.announcementNumber),
    startDate: normalizeOptionalString(payload.startDate),
    endDate: normalizeOptionalString(payload.endDate),
    status: payload.status,
    conditions: normalizeStringArray(payload.conditions),
    requiredDocuments: normalizeStringArray(payload.requiredDocuments),
    eligibleCategories: normalizeStringArray(payload.eligibleCategories),
    applicationLocation: normalizeOptionalString(payload.applicationLocation),
    applicationMethod: normalizeOptionalString(payload.applicationMethod),
    sourceName: normalizeOptionalString(payload.sourceName),
    sourceUrl: normalizeOptionalString(payload.sourceUrl),
    notes: normalizeOptionalString(payload.notes),
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: adminId.trim() || "superadmin",
  };

  store.announcements.unshift(announcement);
  writeStore(store);
  return announcement;
}

export function listRecruitmentAnnouncements(options?: {
  status?: RecruitmentAnnouncement["status"];
  apparatus?: string;
  publicOnly?: boolean;
}): RecruitmentAnnouncement[] {
  const nowMs = Date.now();
  const apparatusFilter = normalizeOptionalString(options?.apparatus);

  return readStore().announcements
    .map((announcement) => withEffectiveStatus(announcement))
    .filter((announcement) => {
      if (options?.publicOnly && !isPublicAnnouncement(announcement, nowMs)) return false;
      if (options?.status && announcement.status !== options.status) return false;
      if (apparatusFilter && normalizeText(announcement.apparatusName) !== normalizeText(apparatusFilter)) return false;
      return true;
    })
    .sort(compareAnnouncements);
}

export function listPublicRecruitmentAnnouncements(): RecruitmentAnnouncement[] {
  return listRecruitmentAnnouncements({ publicOnly: true });
}

export function updateRecruitmentAnnouncement(
  id: string,
  patch: Partial<Omit<RecruitmentAnnouncement, "id" | "createdAt" | "updatedAt" | "createdBy">>,
): RecruitmentAnnouncement | null {
  const store = readStore();
  const announcement = store.announcements.find((entry) => entry.id === id);
  if (!announcement) return null;

  if (patch.title !== undefined) announcement.title = patch.title.trim();
  if (patch.apparatusName !== undefined) announcement.apparatusName = patch.apparatusName.trim();
  if (patch.announcementNumber !== undefined) announcement.announcementNumber = normalizeOptionalString(patch.announcementNumber);
  if (patch.startDate !== undefined) announcement.startDate = normalizeOptionalString(patch.startDate);
  if (patch.endDate !== undefined) announcement.endDate = normalizeOptionalString(patch.endDate);
  if (patch.status !== undefined) announcement.status = patch.status;
  if (patch.conditions !== undefined) announcement.conditions = normalizeStringArray(patch.conditions);
  if (patch.requiredDocuments !== undefined) announcement.requiredDocuments = normalizeStringArray(patch.requiredDocuments);
  if (patch.eligibleCategories !== undefined) announcement.eligibleCategories = normalizeStringArray(patch.eligibleCategories);
  if (patch.applicationLocation !== undefined) announcement.applicationLocation = normalizeOptionalString(patch.applicationLocation);
  if (patch.applicationMethod !== undefined) announcement.applicationMethod = normalizeOptionalString(patch.applicationMethod);
  if (patch.sourceName !== undefined) announcement.sourceName = normalizeOptionalString(patch.sourceName);
  if (patch.sourceUrl !== undefined) announcement.sourceUrl = normalizeOptionalString(patch.sourceUrl);
  if (patch.notes !== undefined) announcement.notes = normalizeOptionalString(patch.notes);
  announcement.updatedAt = NOW();

  writeStore(store);
  return withEffectiveStatus(announcement);
}

export function deleteRecruitmentAnnouncement(id: string): boolean {
  const store = readStore();
  const nextAnnouncements = store.announcements.filter((entry) => entry.id !== id);
  if (nextAnnouncements.length === store.announcements.length) {
    return false;
  }

  store.announcements = nextAnnouncements;
  writeStore(store);
  return true;
}

export function resolveRecruitmentAnnouncements(query: string): ResolvedRecruitmentQuery | null {
  const queryType = classifyRecruitmentQuery(query);
  if (!queryType) return null;

  const announcements = listPublicRecruitmentAnnouncements();
  const matchedApparatus = detectApparatusSignals(query);
  if (announcements.length === 0) {
    return {
      kind: queryType === "listing" ? "announcement" : "recruitment",
      announcements: [],
      queryType,
      score: 1,
      matchedApparatus,
    };
  }

  const scored = announcements
    .map((announcement) => ({
      announcement,
      score: scoreAnnouncementMatch(query, announcement, matchedApparatus),
    }))
    .filter((entry) => matchedApparatus.length === 0 || entry.score >= RECRUITMENT_MATCH_THRESHOLD)
    .sort((left, right) => right.score - left.score || compareAnnouncements(left.announcement, right.announcement));

  const selected = scored.length > 0
    ? scored.map((entry) => entry.announcement)
    : (matchedApparatus.length > 0
      ? announcements.filter((announcement) => matchedApparatus.some((apparatus) => normalizeText(apparatus) === normalizeText(announcement.apparatusName)))
      : announcements);

  const finalAnnouncements = selected.slice(0, queryType === "listing" ? 3 : 2);
  const topScore = scored[0]?.score ?? 0.5;

  return {
    kind: queryType === "listing" ? "announcement" : "recruitment",
    announcements: finalAnnouncements,
    queryType,
    score: topScore,
    matchedApparatus,
  };
}