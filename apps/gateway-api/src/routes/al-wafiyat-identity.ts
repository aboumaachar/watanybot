import { createHash } from "node:crypto";

/**
 * Pure, non-mutating identity and date contract for imported official death notices.
 * Legacy `date_of_death` on crawler records meant the listing/notice date; it
 * MUST NOT be treated as independently verified death-date evidence.
 */
export type DeathNoticeEventType = "DEATH_NOTICE" | "FOLLOW_UP" | "MEMORIAL";
export type ReconciliationDisposition = "NEW" | "DUPLICATE" | "REVIEW_REQUIRED";

export type OfficialDeathNoticeInput = {
  source: string;
  title: string;
  noticeDate: string;
  originalUrl?: string | null;
  rawText?: string | null;
};

export type OfficialDeathNoticeIdentity = {
  stableId: string;
  identityKey: string;
  semanticKey: string;
  detailUrl: string | null;
  notice_date: string;
  death_date: string | null;
  funeral_date: string | null;
  event_type: DeathNoticeEventType;
  date_evidence: {
    notice: "source_listing";
    death: "explicit_text" | "unknown";
    funeral: "explicit_text" | "unknown";
  };
};

export function normalizeArabicIdentity(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeOfficialDate(value: unknown): string | null {
  const text = normalizeArabicIdentity(value);
  let year: number;
  let month: number;
  let day: number;
  let match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (!match) return null;
    year = Number(match[3]);
    month = Number(match[2]);
    day = Number(match[1]);
  }
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const canonical = `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${canonical}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === canonical ? canonical : null;
}

function canonicalDetailUrl(value: string | null | undefined, source: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    const host = url.hostname.toLowerCase();
    if (source === "gsf_official"
      && (host === "general-security.gov.lb" || host === "www.general-security.gov.lb")
      && /^\/ar\/deaths\/details\/\d+\/\d+\/?$/.test(url.pathname)) {
      return `https://www.general-security.gov.lb${url.pathname.replace(/\/$/, "")}`;
    }
    return null; // Army and ISF listings have no distinct per-notice URLs in the current scraper.
  } catch {
    return null;
  }
}

export function classifyOfficialDeathNotice(title: string): DeathNoticeEventType {
  const text = normalizeArabicIdentity(title);
  if (/الذكري|احياء|اربعين|قداس/.test(text)) return "MEMORIAL";
  if (/الحاقا|اضافة يوم|اضافه يوم|نقل جثمان|تعديل|تصحيح|تمديد/.test(text)) return "FOLLOW_UP";
  return "DEATH_NOTICE";
}

/** Only extract dates after explicit death/funeral verbs. Never infer either from the listing date. */
export function extractExplicitEventDate(rawText: string, event: "death" | "funeral"): string | null {
  const text = normalizeArabicIdentity(rawText);
  const date = "(\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}/\\d{1,2}/\\d{4})";
  const patterns = event === "death"
    ? [
      new RegExp(`(?:توفي|توفيت|استشهد|استشهدت)[^.،\\n]{0,50}?(?:بتاريخ|تاريخ|يوم)\\s*${date}`, "u"),
      new RegExp(`(?:بتاريخ|يوم)\\s*${date}[^.،\\n]{0,40}?(?:توفي|توفيت|استشهد|استشهدت)`, "u"),
    ]
    : [
      new RegExp(`(?:يقام الماتم|اقيم الماتم|الدفن|الجنازه|الماتم|يواري الثري|ووري الثري)[^.،\\n]{0,90}?(?:بتاريخ|تاريخ|يوم|في)\\s*${date}`, "u"),
    ];
  for (const pattern of patterns) {
    const found = pattern.exec(text);
    if (!found) continue;
    const candidate = found[1];
    const normalized = normalizeOfficialDate(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export function buildOfficialDeathNoticeIdentity(input: OfficialDeathNoticeInput): OfficialDeathNoticeIdentity | null {
  const source = String(input.source ?? "").trim().toLowerCase();
  if (!["army_official", "isf_official", "gsf_official"].includes(source)) return null;
  const title = normalizeArabicIdentity(input.title);
  const noticeDate = normalizeOfficialDate(input.noticeDate);
  if (!title || title.length > 400 || !noticeDate) return null;
  const detailUrl = canonicalDetailUrl(input.originalUrl, source);
  const semanticKey = `${source}|${noticeDate}|${title}`;
  const identityKey = detailUrl ? `${source}|url|${detailUrl}` : `${source}|semantic|${noticeDate}|${title}`;
  const digest = createHash("sha256").update(identityKey, "utf8").digest("hex").slice(0, 24);
  const sourceId = source === "army_official" ? "army" : source === "isf_official" ? "isf" : "gsf";
  const eventType = classifyOfficialDeathNotice(input.title);
  const deathDate = eventType === "DEATH_NOTICE" ? extractExplicitEventDate(input.rawText || "", "death") : null;
  const funeralDate = extractExplicitEventDate(input.rawText || "", "funeral");
  return {
    stableId: `al-wafiyat-${sourceId}-v2-${digest}`,
    identityKey, semanticKey, detailUrl,
    notice_date: noticeDate,
    death_date: deathDate,
    funeral_date: funeralDate,
    event_type: eventType,
    date_evidence: {
      notice: "source_listing",
      death: deathDate ? "explicit_text" : "unknown",
      funeral: funeralDate ? "explicit_text" : "unknown",
    },
  };
}

export function reconcileOfficialDeathNotice(
  candidate: OfficialDeathNoticeIdentity,
  existing: ReadonlyArray<Record<string, unknown>>,
  source: string,
): { disposition: ReconciliationDisposition; existingId: string | null; reason: string } {
  const matches = existing.filter((item) => {
    const existingSource = String(item.source ?? "").toLowerCase();
    if (existingSource !== source) return false;
    const originalId = String(item.id ?? "");
    if (originalId === candidate.stableId) return true;
    const oldDetail = canonicalDetailUrl(String(item.originalUrl ?? ""), source);
    if (candidate.detailUrl && oldDetail === candidate.detailUrl) return true;
    const oldTitle = String(item.title ?? item.name ?? "");
    // Legacy crawl records stored notice-date in date_of_death.
    const oldDate = item.notice_date ?? (item.import_mode === "official_source_crawl" || originalId.startsWith("al-wafiyat-")
      ? item.date_of_death : null);
    const normalized = normalizeOfficialDate(oldDate);
    return Boolean(normalized && `${source}|${normalized}|${normalizeArabicIdentity(oldTitle)}` === candidate.semanticKey);
  });
  if (matches.length > 1) return { disposition: "REVIEW_REQUIRED", existingId: null, reason: "MULTIPLE_EXISTING_IDENTITIES" };
  if (matches.length === 1) {
    const matched = matches[0];
    const oldUrl = canonicalDetailUrl(String(matched.originalUrl ?? ""), source);
    const oldTitle = String(matched.title ?? matched.name ?? "");
    const legacyNoticeDate = matched.notice_date ?? (
      matched.import_mode === "official_source_crawl" || String(matched.id ?? "").startsWith("al-wafiyat-")
        ? matched.date_of_death : null);
    const legacySemantic = `${source}|${normalizeOfficialDate(legacyNoticeDate) ?? ""}|${normalizeArabicIdentity(oldTitle)}`;
    if (candidate.detailUrl && oldUrl && candidate.detailUrl !== oldUrl) {
      return { disposition: "REVIEW_REQUIRED", existingId: null, reason: "CONFLICTING_OFFICIAL_DETAIL_URL" };
    }
    if (candidate.detailUrl && oldUrl && candidate.detailUrl === oldUrl
      && legacySemantic !== candidate.semanticKey) {
      return { disposition: "REVIEW_REQUIRED", existingId: null, reason: "OFFICIAL_DETAIL_CONTENT_DRIFT" };
    }
    return { disposition: "DUPLICATE", existingId: String(matched.id ?? ""), reason: "EXISTING_NOTICE_IDENTITY" };
  }
  return { disposition: "NEW", existingId: null, reason: "NO_EXISTING_IDENTITY" };
}
