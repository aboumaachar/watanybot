import { getDefaultApiBaseUrl } from "./api-base";
import type { OfficialFileItem } from "../types/domain";

export type ProcedureCardKind = "procedure" | "reference" | "notice" | "fragment";

type ProcedureDisplayRecord = {
  record_kind?: ProcedureCardKind;
  title_clean?: string | null;
  title_ar?: string | null;
  summary_clean?: string | null;
  summary_lb?: string | null;
  tags?: string[];
};

type ProcedureDocAvailability = {
  asset_delivery_kind?: string | null;
};

export function normalizeProcedureText(value?: string | null): string {
  return (value || "")
    .replace(/^procedures:/iu, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanProcedureTitle(title?: string | null): string {
  return normalizeProcedureText(title)
    .replace(/^رابط\s*\(\s*لينك\s*\)/u, "رابط")
    .replace(/[.\s]+\d{1,4}$/u, "")
    .replace(/[.،:;\-–—\s]+[A-Z]{2,6}$/u, "")
    .replace(/([\p{Script=Arabic})])\d{1,4}$/u, "$1")
    .trim();
}

function isCodeLikeTitle(title: string): boolean {
  const compactTitle = title.replace(/[.،:;\-–—]+/gu, "").trim();
  return Boolean(compactTitle) && /^[\d\u0660-\u0669A-Za-z\s]+$/u.test(compactTitle);
}

export function classifyProcedureCard(title?: string | null, summary?: string | null, tags?: string[]): ProcedureCardKind {
  const cleanedTitle = cleanProcedureTitle(title);
  const cleanedSummary = normalizeProcedureText(summary);
  const tagSet = new Set((tags || []).map((tag) => normalizeProcedureText(tag)));

  if (
    /^(الفصل|الباب|القسم|المادة|نماذج|جدول|نظام)(?:\s|$)/u.test(cleanedTitle) ||
    /^(مليون|الف|ألف|ليرة|دولار)(?:\s|$)/u.test(cleanedTitle) ||
    isCodeLikeTitle(cleanedTitle)
  ) {
    return "fragment";
  }

  if (
    /^(أرقام هواتف|ارقام هواتف|هواتف|إيجاز|ايجاز)(?:\s|$)/u.test(cleanedTitle) ||
    ((/^(دوام|اوقات|أوقات|ساعات)(?:\s|$)/u.test(cleanedTitle) || tagSet.has("دوام")) && /(الساعة|دوام|اوقات|أوقات|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد)/u.test(cleanedSummary)) ||
    (/(بدل|رسوم|طابع|طوابع|كلفة|تكلفة|هاتف|هواتف|اتصال|تحويل|استعلامات)/u.test(cleanedSummary) && cleanedSummary.length >= 60)
  ) {
    return "notice";
  }

  if (
    /^رابط(?:\s|$)/u.test(cleanedTitle) ||
    /(?:^|\s)لينك(?:\s|$)/u.test(cleanedTitle) ||
    tagSet.has("رابط") ||
    tagSet.has("لينك")
  ) {
    return "reference";
  }

  if (!cleanedSummary && /^لائحة(?:\s|$)/u.test(cleanedTitle)) {
    return "reference";
  }

  return "procedure";
}

export function resolveProcedureKind(record: ProcedureDisplayRecord): ProcedureCardKind {
  return record.record_kind || classifyProcedureCard(record.title_ar, record.summary_lb, record.tags);
}

export function resolveProcedureTitle(record: Pick<ProcedureDisplayRecord, "title_clean" | "title_ar">): string {
  if (record.title_clean) {
    return normalizeProcedureText(record.title_clean);
  }

  return cleanProcedureTitle(record.title_ar);
}

export function summarizeProcedureCard(kind: ProcedureCardKind, summary?: string | null): string {
  const cleanedSummary = normalizeProcedureText(summary);
  if (cleanedSummary) return cleanedSummary;
  if (kind === "reference") return "مرجع مباشر من المصدر الرسمي أو رابط مرتبط بالمعاملة.";
  if (kind === "notice") return "هذا السجل يحتوي معلومات مرجعية أو تشغيلية مساندة، وليس مسار معاملة كاملاً.";
  if (kind === "fragment") return "هذا السجل مقتطف مرجعي أو عنوان تنظيمي، وليس إجراءً مستقلاً قابلاً للتنفيذ.";
  return "افتح البطاقة لعرض الشروط والمستندات والمراجع المرتبطة.";
}

export function resolveProcedureSummary(record: Pick<ProcedureDisplayRecord, "record_kind" | "summary_clean" | "summary_lb" | "title_ar" | "tags">): string {
  const kind = resolveProcedureKind(record);
  const cleanedSummary = normalizeProcedureText(record.summary_clean);
  if (cleanedSummary) return cleanedSummary;
  return summarizeProcedureCard(kind, record.summary_lb);
}

export function getReferenceViewerUrl(source: string | null | undefined, apiBase: string): string | null {
  const normalizedSource = normalizeProcedureText(source).toLowerCase();
  if (!normalizedSource) return null;

  if (normalizedSource === "procedures") {
    return `${apiBase}/api/v2/procedures/reference/procedures`;
  }

  if (normalizedSource === "laf" || normalizedSource === "mof" || normalizedSource === "shoon") {
    return `${apiBase}/api/v2/procedures/reference/${normalizedSource}`;
  }

  return null;
}

export function buildAbsoluteUrl(target: string): string {
  if (target.startsWith("http")) return target;

  const baseUrl = getDefaultApiBaseUrl();
  if (!baseUrl) return target;

  const resolvedBase = new URL(baseUrl, globalThis.location?.origin || undefined);
  const basePath = resolvedBase.pathname.replace(/\/$/, "");

  if (
    target.startsWith("/")
    && basePath
    && basePath !== "/"
    && !target.startsWith(`${basePath}/`)
  ) {
    return new URL(`${basePath}${target}`, resolvedBase.origin).toString();
  }

  return new URL(target, resolvedBase).toString();
}

type OfficialFileUrlRecord = Pick<OfficialFileItem, "url" | "preview_url" | "download_url" | "share_url">;

function buildOfficialFileUrl(target: string | undefined, apiBaseUrl?: string): string | undefined {
  if (!target) return undefined;
  if (/^https?:\/\//i.test(target)) return target;
  if (target.startsWith("/forms/")) return target;
  if (apiBaseUrl) {
    const base = apiBaseUrl.replace(/\/$/, "");
    const normalizedPath = target.startsWith("/") ? target : `/${target}`;
    return `${base}${normalizedPath}`;
  }
  return buildAbsoluteUrl(target);
}

export function resolveOfficialFileActionUrl(
  file: OfficialFileUrlRecord,
  action: "preview" | "download" | "share" | "default" = "default",
  apiBaseUrl?: string,
): string | undefined {
  let candidates: Array<string | undefined>;
  switch (action) {
    case "preview":
      candidates = [file.preview_url, file.url, file.download_url, file.share_url];
      break;
    case "download":
      candidates = [file.download_url, file.preview_url, file.url, file.share_url];
      break;
    case "share":
      candidates = [file.share_url, file.preview_url, file.download_url, file.url];
      break;
    default:
      candidates = [file.url, file.preview_url, file.download_url, file.share_url];
      break;
  }

  for (const candidate of candidates) {
    const resolved = buildOfficialFileUrl(candidate, apiBaseUrl);
    if (resolved) return resolved;
  }

  return undefined;
}

export async function copyText(value: string): Promise<boolean> {
  try {
    if (!globalThis.navigator?.clipboard?.writeText) {
      return false;
    }

    await globalThis.navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function sanitizeDownloadFileName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function getExtensionFromContentType(contentType: string | null): string {
  const normalized = (contentType || "").toLowerCase();
  if (normalized.includes("application/pdf")) return "pdf";
  if (normalized.includes("application/msword")) return "doc";
  if (normalized.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) return "docx";
  if (normalized.includes("application/vnd.ms-excel")) return "xls";
  if (normalized.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) return "xlsx";
  if (normalized.includes("text/plain")) return "txt";
  if (normalized.includes("text/html")) return "html";
  if (normalized.includes("application/json")) return "json";
  return "";
}

function getFileNameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;

  const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return sanitizeDownloadFileName(decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, "")));
    } catch {
      return sanitizeDownloadFileName(utf8Match[1].trim().replace(/^"|"$/g, ""));
    }
  }

  const filenameMatch = disposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  const candidate = filenameMatch?.[1] || filenameMatch?.[2];
  if (!candidate) return null;

  return sanitizeDownloadFileName(candidate.trim());
}

function resolveDownloadFileName(url: string, headers: Headers, fallbackName?: string): string {
  const fromDisposition = getFileNameFromDisposition(headers.get("content-disposition"));
  if (fromDisposition) return fromDisposition;

  const requestedName = sanitizeDownloadFileName(fallbackName || "");
  const requestedExtension = requestedName.includes(".")
    ? ""
    : getExtensionFromContentType(headers.get("content-type"));

  if (requestedName) {
    return requestedExtension ? `${requestedName}.${requestedExtension}` : requestedName;
  }

  try {
    const parsedUrl = new URL(url, globalThis.location?.origin || undefined);
    const lastSegment = sanitizeDownloadFileName(decodeURIComponent(parsedUrl.pathname.split("/").pop() || ""));
    if (lastSegment) return lastSegment;
  } catch {
    // Ignore URL parsing issues and fall back to a generated name.
  }

  const extension = getExtensionFromContentType(headers.get("content-type"));
  return extension ? `procedure-document.${extension}` : "procedure-document";
}

export async function downloadFileFromUrl(url: string, fallbackName?: string): Promise<boolean> {
  const absoluteUrl = buildAbsoluteUrl(url);

  try {
    const response = await fetch(absoluteUrl, {
      credentials: "include",
    });

    if (!response.ok) {
      return false;
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = resolveDownloadFileName(absoluteUrl, response.headers, fallbackName);
    anchor.rel = "noreferrer";
    anchor.style.display = "none";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    globalThis.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    return true;
  } catch {
    return false;
  }
}

export function getProcedureDocAvailabilityLabel(doc: ProcedureDocAvailability): string | null {
  switch (doc.asset_delivery_kind) {
    case "staged_file":
      return "ملف فعلي ضمن الحزمة";
    case "source_fallback":
      return "بديل من صفحة المصدر";
    case "public_url":
      return "رابط خارجي مباشر";
    case "missing_local_asset":
      return "الملف الأصلي غير متوفر";
    default:
      return null;
  }
}