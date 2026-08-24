import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import type { UserRole } from "@watany/types";
import { hasMinRole } from "../auth/rbac";


function watanySafeStringField(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return fallback;
}

function watanySafeStringArrayField(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => watanySafeStringField(item)).filter(Boolean);
}
type FastifyLike = {
  get: (route: string, handler: (req: unknown, reply: unknown) => unknown) => void;
  post: (route: string, handler: (req: unknown, reply: unknown) => unknown) => void;
  patch: (route: string, handler: (req: unknown, reply: unknown) => unknown) => void;
};

type OfficialServiceMode =
  | "EXISTING_LOCAL"
  | "LOCAL_FORM_BRIDGE"
  | "SECURE_EXTERNAL_PORTAL"
  | "LOCAL_GUIDE_AND_DOWNLOADS"
  | "PENDING_URL_VALIDATION"
  | "EXCLUDED";

type OfficialServicePrivacy = "NORMAL" | "HIGH";

type OfficialServiceInputOption = {
  value: string;
  labelAr: string;
};

type OfficialServiceInputField = {
  key: string;
  labelAr: string;
  placeholderAr?: string;
  type: "text" | "select";
  required: boolean;
  options?: OfficialServiceInputOption[];
  helpTextAr?: string;
};

type OfficialServiceDownload = {
  id: string;
  titleAr: string;
  url: string;
  kind: "pdf" | "video" | "external";
};

type OfficialServiceRecord = {
  id: string;
  listingNo: number;
  titleAr: string;
  providerAr: string;
  category: string;
  sourceUrl: string;
  route: string;
  mode: OfficialServiceMode;
  enabled: boolean;
  summaryAr: string;
  helpTextAr: string;
  fallbackMessageAr?: string;
  guideBulletsAr?: string[];
  knownIssuesAr?: string[];
  inputFields?: OfficialServiceInputField[];
  downloads?: OfficialServiceDownload[];
  privacy?: OfficialServicePrivacy;
  cache?: boolean;
  storeInputs?: boolean;
  externalOnly?: boolean;
  bridgeSubmitUrl?: string;
  portalUrl?: string;
  iframeAllowed?: boolean | null;
  lastCheckedAt?: string | null;
  lastStatusCode?: number | null;
  lastHealthOk?: boolean | null;
};

type OfficialResultItem = {
  labelAr: string;
  valueAr: string;
};

type AlWafiyatSourceId = "army" | "isf" | "gsf";

type AlWafiyatProviderCode = "LEBANESE_ARMY" | "ISF" | "GENERAL_SECURITY";

type AlWafiyatNoticeStatus = "IMPORTED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

type AlWafiyatSourceRecord = {
  id: AlWafiyatSourceId;
  sourceKey: "army_official" | "isf_official" | "gsf_official";
  providerCode: AlWafiyatProviderCode;
  providerAr: string;
  titleAr: string;
  sourceUrl: string;
};

type ImportedAlWafiyatNotice = {
  title: string;
  rawText: string;
  noticeDate: string;
  originalUrl: string;
  sourceId: AlWafiyatSourceId;
  sourceKey: string;
  sourceProvider: AlWafiyatProviderCode;
  sourceProviderAr: string;
  sourceUrl: string;
  status: "IMPORTED";
  importedAt: string;
};

const OFFICIAL_SERVICE_TIMEOUT_MS = 15000;
const OFFICIAL_SERVICE_UPSTREAM_UNAVAILABLE_ERROR = "تعذّر الاتصال بالمصدر الرسمي حالياً. يمكنك فتح الرابط الرسمي مباشرةً والمحاولة لاحقاً.";
const AL_WAFIYAT_AUTO_SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000;
const AL_WAFIYAT_AUTO_SYNC_INITIAL_DELAY_MS = 60 * 1000;
const AL_WAFIYAT_TICKER_WINDOW_MS = 6 * 60 * 60 * 1000;
const AL_WAFIYAT_TICKER_PRIORITY = 95;
const AL_WAFIYAT_NOTIFICATION_KIND = "system";
const AL_WAFIYAT_SYNTHETIC_PATTERNS = [
  /(^|\s)اختبار(\s|$)/,
  /\b(?:test|phase\s*\d+[a-z]?|qa|demo|dummy|automated evidence capture)\b/i,
];

let alWafiyatAutoSyncTimer: ReturnType<typeof setInterval> | null = null;
let alWafiyatAutoSyncWarmupTimer: ReturnType<typeof setTimeout> | null = null;
let alWafiyatAutoSyncInFlight = false;

const AL_WAFIYAT_SOURCES: AlWafiyatSourceRecord[] = [
  {
    id: "army",
    sourceKey: "army_official",
    providerCode: "LEBANESE_ARMY",
    providerAr: "الجيش اللبناني",
    titleAr: "وفيات الجيش اللبناني",
    sourceUrl: "https://www.lebarmy.gov.lb/ar/deceased",
  },
  {
    id: "isf",
    sourceKey: "isf_official",
    providerCode: "ISF",
    providerAr: "قوى الأمن الداخلي",
    titleAr: "وفيات قوى الأمن الداخلي",
    sourceUrl: "https://isf.gov.lb/ar/deaths/",
  },
  {
    id: "gsf",
    sourceKey: "gsf_official",
    providerCode: "GENERAL_SECURITY",
    providerAr: "المديرية العامة للأمن العام",
    titleAr: "وفيات المديرية العامة للأمن العام",
    sourceUrl: "https://www.general-security.gov.lb/ar/posts/123",
  },
];

const OFFICIAL_SERVICE_MODES = new Set<OfficialServiceMode>([
  "EXISTING_LOCAL",
  "LOCAL_FORM_BRIDGE",
  "SECURE_EXTERNAL_PORTAL",
  "LOCAL_GUIDE_AND_DOWNLOADS",
  "PENDING_URL_VALIDATION",
  "EXCLUDED",
]);

function isOfficialServiceMode(value: string): value is OfficialServiceMode {
  return (
    value === "EXISTING_LOCAL" ||
    value === "LOCAL_FORM_BRIDGE" ||
    value === "SECURE_EXTERNAL_PORTAL" ||
    value === "LOCAL_GUIDE_AND_DOWNLOADS" ||
    value === "PENDING_URL_VALIDATION" ||
    value === "EXCLUDED"
  );
}

const OFFICIAL_RESULT_LABELS_AR: Record<string, string> = {
  amount: "المبلغ",
  code: "رمز الآلية",
  date: "التاريخ",
  fine_amount: "المبلغ",
  message: "الرسالة",
  military_number: "الرقم العسكري",
  name: "الاسم",
  plate_number: "رقم اللوحة",
  reference: "المرجع",
  result: "النتيجة",
  status: "الحالة",
  ticket_date: "التاريخ",
  ticket_number: "رقم المخالفة",
  total: "الإجمالي",
  violation: "المخالفة",
  violation_status: "حالة المخالفة",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");

function candidateDataRoots(): string[] {
  const roots = [
    process.env.KB_DATA_ROOT ? path.resolve(process.env.KB_DATA_ROOT) : "",
    path.resolve(repoRoot, "apps/gateway-api/data"),
    path.resolve(repoRoot, "data"),
    path.resolve(repoRoot, "gateway-api/data"),
  ].filter(Boolean);
  return Array.from(new Set(roots));
}

function firstExisting(paths: string[]): string {
  const found = paths.find((p) => fs.existsSync(p));
  return found ?? paths[0];
}

function readJson<T>(candidates: string[], fallback: T): T {
  const file = firstExisting(candidates);
  try {
    if (!file || !fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function readJsonl(candidates: string[]): any[] {
  const file = firstExisting(candidates);
  try {
    if (!file || !fs.existsSync(file)) return [];
    return fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function dataCandidates(relativePath: string): string[] {
  return candidateDataRoots().map((root) => path.resolve(root, relativePath));
}

function officialServicesCandidates(): string[] {
  return dataCandidates("official-services.json");
}

function limitItems(items: any[], limitValue: unknown): any[] {
  const n = Number(limitValue ?? 20);
  const safe = Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : 20;
  return items.slice(0, safe);
}

function textMatch(item: any, q: string): boolean {
  if (!q) return true;
  const haystack = JSON.stringify(item ?? {}).toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function normalizeScalar(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "number") return Number.isFinite(value) ? watanySafeStringField(value) : "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeScalar(item))
      .filter(Boolean)
      .join("، ");
  }
  try {
    const json = JSON.stringify(value);
    return typeof json === "string" ? json : "";
  } catch {
    return "";
  }
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeScalar).filter(Boolean);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8211;/gi, "-");
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOfficialServiceRecords(input: unknown): OfficialServiceRecord[] {
  if (!Array.isArray(input)) return [];

  const normalized = input.map((item): OfficialServiceRecord | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const id = normalizeScalar(record.id);
      const titleAr = normalizeScalar(record.titleAr);
      const providerAr = normalizeScalar(record.providerAr);
      const sourceUrl = normalizeScalar(record.sourceUrl);
      const route = normalizeScalar(record.route);
      const mode = normalizeScalar(record.mode) as OfficialServiceMode;

      if (!id || !titleAr || !providerAr || !sourceUrl || !route || !mode) {
        return null;
      }

      if (!isOfficialServiceMode(mode)) {
        return null;
      }

      const inputFields: OfficialServiceInputField[] = Array.isArray(record.inputFields)
        ? record.inputFields
          .filter((field) => field && typeof field === "object")
          .map((field) => {
            const typedField = field as Record<string, unknown>;
            const fieldKey = normalizeScalar(typedField.key);
            const fieldLabel = normalizeScalar(typedField.labelAr) || fieldKey;
            const fieldPlaceholder = normalizeScalar(typedField.placeholderAr);
            const fieldHelpText = normalizeScalar(typedField.helpTextAr);
            const fieldOptions: OfficialServiceInputOption[] | undefined = Array.isArray(typedField.options)
              ? typedField.options
                .filter((option) => option && typeof option === "object")
                .map((option) => {
                  const typedOption = option as Record<string, unknown>;
                  const optionValue = normalizeScalar(typedOption.value);
                  const optionLabel = normalizeScalar(typedOption.labelAr) || optionValue;
                  return {
                    value: optionValue,
                    labelAr: optionLabel,
                  } satisfies OfficialServiceInputOption;
                })
              : undefined;

            return {
              key: fieldKey,
              labelAr: fieldLabel,
              placeholderAr: fieldPlaceholder || undefined,
              type: typedField.type === "select" ? "select" : "text",
              required: typedField.required !== false,
              helpTextAr: fieldHelpText || undefined,
              options: fieldOptions,
            } satisfies OfficialServiceInputField;
          })
        : [];

      const downloads: OfficialServiceDownload[] = Array.isArray(record.downloads)
        ? record.downloads
          .filter((download) => download && typeof download === "object")
          .map((download) => {
            const typedDownload = download as Record<string, unknown>;
            const downloadId = normalizeScalar(typedDownload.id);
            const downloadTitle = normalizeScalar(typedDownload.titleAr) || downloadId;
            const downloadUrl = normalizeScalar(typedDownload.url);

            let kind: OfficialServiceDownload["kind"] = "pdf";
            if (typedDownload.kind === "video") {
              kind = "video";
            } else if (typedDownload.kind === "external") {
              kind = "external";
            }

            return {
              id: downloadId,
              titleAr: downloadTitle,
              url: downloadUrl,
              kind,
            } satisfies OfficialServiceDownload;
          })
        : [];

      return {
        id,
        listingNo: Number(record.listingNo || 0),
        titleAr,
        providerAr,
        category: normalizeScalar(record.category) || "general",
        sourceUrl,
        route,
        mode,
        enabled: Boolean(record.enabled),
        summaryAr: normalizeScalar(record.summaryAr),
        helpTextAr: normalizeScalar(record.helpTextAr),
        fallbackMessageAr: normalizeScalar(record.fallbackMessageAr) || undefined,
        guideBulletsAr: normalizeStringList(record.guideBulletsAr),
        knownIssuesAr: normalizeStringList(record.knownIssuesAr),
        inputFields,
        downloads,
        privacy: record.privacy === "HIGH" ? "HIGH" : "NORMAL",
        cache: record.cache === true,
        storeInputs: record.storeInputs === true,
        externalOnly: record.externalOnly === true,
        bridgeSubmitUrl: normalizeScalar(record.bridgeSubmitUrl) || undefined,
        portalUrl: normalizeScalar(record.portalUrl) || undefined,
        iframeAllowed: typeof record.iframeAllowed === "boolean" ? record.iframeAllowed : null,
        lastCheckedAt: normalizeScalar(record.lastCheckedAt) || null,
        lastStatusCode: typeof record.lastStatusCode === "number" ? record.lastStatusCode : null,
        lastHealthOk: typeof record.lastHealthOk === "boolean" ? record.lastHealthOk : null,
      } satisfies OfficialServiceRecord;
    });

  return normalized
    .filter((record): record is OfficialServiceRecord => record !== null)
    .sort((left, right) => left.listingNo - right.listingNo);
}

function readOfficialServices(): OfficialServiceRecord[] {
  return normalizeOfficialServiceRecords(readJson<unknown>(officialServicesCandidates(), []));
}

function officialServicesWritePath(): string {
  const candidates = officialServicesCandidates();
  return candidates[0];
}

function writeOfficialServices(services: OfficialServiceRecord[]): void {
  const file = officialServicesWritePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(services, null, 2)}\n`, "utf8");
}

function getOfficialServiceById(serviceId: string): OfficialServiceRecord | undefined {
  return readOfficialServices().find((service) => service.id === serviceId);
}

function mapOfficialServiceForResponse(service: OfficialServiceRecord) {
  const { bridgeSubmitUrl: _bridgeSubmitUrl, ...publicService } = service;
  return publicService;
}

function updateOfficialService(serviceId: string, mutate: (current: OfficialServiceRecord) => OfficialServiceRecord): OfficialServiceRecord | null {
  const services = readOfficialServices();
  const index = services.findIndex((service) => service.id === serviceId);
  if (index === -1) {
    return null;
  }

  const next = mutate(services[index]);
  services[index] = next;
  writeOfficialServices(services);
  return next;
}

function mapOfficialResultKeyToArabic(key: string): string {
  const normalized = key.trim();
  if (!normalized) return "النتيجة";
  return OFFICIAL_RESULT_LABELS_AR[normalized] || normalized.replace(/_/g, " ");
}

function buildItemsFromRecord(record: Record<string, unknown>, rowIndex?: number): OfficialResultItem[] {
  const prefix = typeof rowIndex === "number" ? `#${rowIndex + 1} ` : "";

  return Object.entries(record)
    .map(([key, value]) => {
      const nextValue = normalizeScalar(value);
      if (!nextValue) return null;
      return {
        labelAr: `${prefix}${mapOfficialResultKeyToArabic(key)}`.trim(),
        valueAr: nextValue,
      } satisfies OfficialResultItem;
    })
    .filter((item): item is OfficialResultItem => Boolean(item));
}

function buildOfficialResultItems(payload: unknown): OfficialResultItem[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((item, index) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return buildItemsFromRecord(item as Record<string, unknown>, payload.length > 1 ? index : undefined);
      }

      const nextValue = normalizeScalar(item);
      return nextValue ? [{ labelAr: payload.length > 1 ? `النتيجة ${index + 1}` : "النتيجة", valueAr: nextValue }] : [];
    });
  }

  if (payload && typeof payload === "object") {
    return buildItemsFromRecord(payload as Record<string, unknown>);
  }

  const nextValue = normalizeScalar(payload);
  return nextValue ? [{ labelAr: "النتيجة", valueAr: nextValue }] : [];
}

function uniqueOfficialResultItems(items: OfficialResultItem[]): OfficialResultItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.labelAr}::${item.valueAr}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readUpstreamPayload(response: Response): Promise<unknown> {
  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (!trimmed) {
    return [];
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return stripHtml(trimmed);
  }
}

function serializeOfficialServiceError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: error };
  }

  const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
  return {
    name: error.name,
    message: error.message,
    causeCode: cause?.code,
    causeMessage: cause?.message,
  };
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ar,en;q=0.8",
      "user-agent": "WatanyBot/1.0 (+https://koudama.com/mcp)",
    },
    signal: AbortSignal.timeout(OFFICIAL_SERVICE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`upstream_html_failed_${response.status}`);
  }

  return response.text();
}

function extractMedicalAidSubmitUrl(pageHtml: string, fallbackUrl?: string): string {
  const match = /url:\s*['"]([^'"]*medical_aid\.php[^'"]*)['"]/i.exec(pageHtml);
  return match?.[1] || fallbackUrl || "";
}

function extractSpeedTicketSubmitUrl(pageHtml: string, fallbackUrl?: string): string {
  const match = /url:\s*['"]([^'"]*service-speed-ticket[^'"]*)['"]/i.exec(pageHtml);
  return match?.[1] || fallbackUrl || "";
}

function extractSpeedTicketToken(pageHtml: string): string {
  const match = /formData\.append\(["']_token["'],\s*["']([^"']+)["']\)/i.exec(pageHtml);
  return match?.[1] || "";
}

async function postOfficialForm(url: string, body: Record<string, string>, referer: string): Promise<unknown> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(body)) {
    formData.append(key, value);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "ar,en;q=0.8",
      referer,
      "user-agent": "WatanyBot/1.0 (+https://koudama.com/mcp)",
      "x-requested-with": "XMLHttpRequest",
    },
    body: formData,
    signal: AbortSignal.timeout(OFFICIAL_SERVICE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`upstream_query_failed_${response.status}`);
  }

  return readUpstreamPayload(response);
}

function buildOfficialSummary(serviceId: string, payload: unknown): string {
  let hasData = false;
  if (Array.isArray(payload)) {
    hasData = payload.length > 0;
  } else if (payload && typeof payload === "object") {
    hasData = Object.keys(payload).length > 0;
  } else {
    hasData = Boolean(normalizeScalar(payload));
  }

  if (hasData) {
    return "تم جلب النتيجة من المصدر الرسمي.";
  }

  switch (serviceId) {
    case "isf-traffic-tickets":
      return "لم تظهر مخالفات في النتيجة الحالية من المصدر الرسمي.";
    case "isf-medical-allowances":
      return "لا توجد نتيجة مطابقة حالياً في المصدر الرسمي.";
    default:
      return "لا توجد بيانات حالياً في المصدر الرسمي.";
  }
}

function getServiceFieldLabel(service: OfficialServiceRecord, key: string): string {
  const field = service.inputFields?.find((item) => item.key === key);
  return field?.labelAr || mapOfficialResultKeyToArabic(key);
}

function getServiceFieldOptionLabel(service: OfficialServiceRecord, key: string, value: string): string {
  const field = service.inputFields?.find((item) => item.key === key);
  const option = field?.options?.find((item) => item.value === value);
  return option?.labelAr || value;
}

function normalizePatchedService(service: OfficialServiceRecord, patch: Record<string, unknown>): OfficialServiceRecord {
  const next: OfficialServiceRecord = { ...service };

  if (typeof patch.enabled === "boolean") next.enabled = patch.enabled;
  if (typeof patch.sourceUrl === "string" && patch.sourceUrl.trim()) next.sourceUrl = patch.sourceUrl.trim();
  if (typeof patch.officialUrl === "string" && patch.officialUrl.trim()) next.sourceUrl = patch.officialUrl.trim();
  if (typeof patch.summaryAr === "string") next.summaryAr = patch.summaryAr.trim();
  if (typeof patch.helpTextAr === "string") next.helpTextAr = patch.helpTextAr.trim();
  if (typeof patch.fallbackMessageAr === "string") next.fallbackMessageAr = patch.fallbackMessageAr.trim() || undefined;
  if (typeof patch.externalOnly === "boolean") next.externalOnly = patch.externalOnly;
  if (typeof patch.mode === "string" && isOfficialServiceMode(patch.mode)) {
    next.mode = patch.mode;
  }
  if (Array.isArray(patch.knownIssuesAr)) {
    next.knownIssuesAr = patch.knownIssuesAr.map((value) => watanySafeStringField(value).trim()).filter(Boolean);
  }

  if (typeof patch.sourceUrl === "string" || typeof patch.officialUrl === "string") {
    next.lastCheckedAt = null;
    next.lastStatusCode = null;
    next.lastHealthOk = null;
  }

  return next;
}

async function probeOfficialSource(service: OfficialServiceRecord): Promise<{ reachable: boolean; statusCode: number | null; checkedAt: string }> {
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(service.sourceUrl, {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "ar,en;q=0.8",
        "user-agent": "WatanyBot/1.0 (+https://koudama.com/mcp)",
      },
      signal: AbortSignal.timeout(OFFICIAL_SERVICE_TIMEOUT_MS),
    });

    return {
      reachable: response.ok,
      statusCode: response.status,
      checkedAt,
    };
  } catch {
    return {
      reachable: false,
      statusCode: null,
      checkedAt,
    };
  }
}

function publishedDeathNotice(item: any): boolean {
  return String(item?.status ?? "") === "published";
}

function buildStoredDeathDisplayTitle(item: any): string {
  return compactText(item?.title || item?.name);
}

function buildStoredDeathSyntheticText(item: any): string {
  return [
    buildStoredDeathDisplayTitle(item),
    compactText(item?.notes),
    compactText(item?.rawText),
  ]
    .filter(Boolean)
    .join(" ");
}

function isSyntheticDeathNotice(item: any): boolean {
  const text = buildStoredDeathSyntheticText(item);
  if (!text) return false;
  return AL_WAFIYAT_SYNTHETIC_PATTERNS.some((pattern) => pattern.exec(text) !== null);
}

function isPubliclyDisplayableDeathNotice(item: any): boolean {
  return !isSyntheticDeathNotice(item);
}

function requireAdminRoute(req: any, reply: any) {
  const user = req?.user as { role?: UserRole } | undefined;

  if (!user) {
    reply.code(401);
    return { ok: false, error: "authentication_required" };
  }

  const role = String(user.role ?? "public") as UserRole;
  if (!hasMinRole(role, "admin")) {
    reply.code(403);
    return { ok: false, error: "admin_required" };
  }

  return null;
}

function normalizeArabicDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function compactText(value: unknown): string {
  return normalizeArabicDigits(normalizeScalar(value)).replace(/\s+/g, " ").trim();
}

function normalizeNoticeDate(value: unknown): string {
  const text = compactText(value);
  if (!text) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(text);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  return text;
}

function slugifyNoticeTitle(value: string): string {
  const normalized = compactText(value)
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return normalized.slice(0, 48) || "notice";
}

function findAlWafiyatSource(sourceId: string): AlWafiyatSourceRecord | undefined {
  return AL_WAFIYAT_SOURCES.find((source) => source.id === sourceId);
}

function classifyAlWafiyatSource(item: any): AlWafiyatSourceRecord | null {
  const source = compactText(item?.source).toLowerCase();
  const apparatus = compactText(item?.apparatus).toLowerCase();

  if (source === "army_official" || apparatus.includes("الجيش")) {
    return findAlWafiyatSource("army") ?? null;
  }

  if (source === "isf_official" || apparatus.includes("قوى الأمن")) {
    return findAlWafiyatSource("isf") ?? null;
  }

  if (source === "gsf_official" || apparatus.includes("الأمن العام") || apparatus.includes("امن عام")) {
    return findAlWafiyatSource("gsf") ?? null;
  }

  return null;
}

const GENERAL_SECURITY_NOTICE_DATE_REGEX = /(\d{4}\/\d{1,2}\/\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})/;
const GENERAL_SECURITY_TITLE_SIGNAL_MARKERS = ["وفاة", "توفي", "توفيت", "استشهد", "استشهاد", "ينعي"];
const GENERAL_SECURITY_TITLE_STOP_MARKERS = [
  "أولاً",
  "ثانياً",
  "ثالثاً",
  "رابعاً",
  "ينعي",
  "وفي ما يلي",
  "في ما يلي",
  "يقام المأتم",
  "أقيم المأتم",
  "يصلّى",
  "يوارى",
  "تقبل التعازي",
  "توفي ",
  "توفيت ",
  "استشهد",
  "استشهاد",
];

function countGeneralSecurityNoticeDates(value: string): number {
  const dateRegex = /(\d{4}\/\d{1,2}\/\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})/g;
  let count = 0;
  while (dateRegex.exec(value) !== null) {
    count += 1;
  }
  return count;
}

function extractGeneralSecurityNoticeBlockText($: ReturnType<typeof load>, link: ReturnType<ReturnType<typeof load>>): string {
  const candidates = [link.closest(".news-row"), link.parent(), ...link.parents().toArray().map((node) => $(node))];
  let fallback = "";

  for (const candidate of candidates) {
    const text = compactText(candidate.text().replace(/إقرأ المزيد/g, " "));
    const dateCount = countGeneralSecurityNoticeDates(text);
    if (!text || dateCount === 0) continue;
    if (!fallback && dateCount <= 3 && text.length <= 900) {
      fallback = text;
    }

    const hasTitleSignal = GENERAL_SECURITY_TITLE_SIGNAL_MARKERS.some((marker) => text.includes(marker));
    if (hasTitleSignal && dateCount <= 3 && text.length <= 900) {
      return text;
    }
  }

  return fallback || compactText(link.parent().text().replace(/إقرأ المزيد/g, " "));
}

function extractGeneralSecurityTitle(textAfterDate: string): string {
  const cutAt = GENERAL_SECURITY_TITLE_STOP_MARKERS
    .map((marker) => textAfterDate.indexOf(marker))
    .filter((index) => index > 0)
    .sort((left, right) => left - right)[0];

  const title = cutAt ? textAfterDate.slice(0, cutAt) : textAfterDate;
  return compactText(title.replace(/إقرأ المزيد/g, " ").replace(/\s+و$/, ""));
}

function buildAlWafiyatRawText(rawText: string, apparatus: string): string {
  const normalizedRawText = compactText(rawText);
  const normalizedApparatus = compactText(apparatus);

  if (!normalizedApparatus) {
    return normalizedRawText;
  }

  if (!normalizedRawText) {
    return `الجهة: ${normalizedApparatus}`;
  }

  if (normalizedRawText.includes(normalizedApparatus)) {
    return normalizedRawText;
  }

  return `الجهة: ${normalizedApparatus}. ${normalizedRawText}`;
}

function mapStoredDeathStatusToAlWafiyat(status: string): AlWafiyatNoticeStatus {
  switch (status) {
    case "published":
      return "APPROVED";
    case "archived":
      return "REJECTED";
    case "pending":
    case "under_review":
      return "PENDING_APPROVAL";
    default:
      return "IMPORTED";
  }
}

function createImportedAlWafiyatNotice(
  source: AlWafiyatSourceRecord,
  title: string,
  rawText: string,
  noticeDate: string,
  originalUrl?: string,
): ImportedAlWafiyatNotice | null {
  const normalizedTitle = compactText(title);
  const normalizedDate = normalizeNoticeDate(noticeDate);

  if (!normalizedTitle || !normalizedDate) {
    return null;
  }

  return {
    title: normalizedTitle,
    rawText: compactText(rawText) || normalizedTitle,
    noticeDate: normalizedDate,
    originalUrl: compactText(originalUrl) || source.sourceUrl,
    sourceId: source.id,
    sourceKey: source.sourceKey,
    sourceProvider: source.providerCode,
    sourceProviderAr: source.providerAr,
    sourceUrl: source.sourceUrl,
    status: "IMPORTED",
    importedAt: new Date().toISOString(),
  };
}

function uniqueImportedAlWafiyatNotices(items: Array<ImportedAlWafiyatNotice | null>): ImportedAlWafiyatNotice[] {
  const seen = new Set<string>();

  return items.filter((item): item is ImportedAlWafiyatNotice => {
    if (!item) return false;
    const key = `${item.sourceKey}::${item.noticeDate}::${item.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractArmyAlWafiyatNotices(pageHtml: string): ImportedAlWafiyatNotice[] {
  const source = findAlWafiyatSource("army");
  if (!source) return [];

  const $ = load(pageHtml);
  const items = $("a.collapseTitle")
    .map((_, element) => {
      const link = $(element);
      const fullTitle = compactText(link.find("h5").first().text() || link.text());
      const titleDateMatch = /\d{2}\/\d{2}\/\d{4}/.exec(fullTitle);
      const dateText = compactText(link.find(".date").first().text()) || (titleDateMatch?.[0] ?? "");
      const title = compactText(fullTitle.replace(dateText, ""));
      const rawText = compactText(link.next(".collapsible").text()) || title;
      return createImportedAlWafiyatNotice(source, title, rawText, dateText, source.sourceUrl);
    })
    .get();

  return uniqueImportedAlWafiyatNotices(items);
}

function extractIsfAlWafiyatNotices(pageHtml: string): ImportedAlWafiyatNotice[] {
  const source = findAlWafiyatSource("isf");
  if (!source) return [];

  const $ = load(pageHtml);
  const items = $("div.col-lg-4")
    .map((_, element) => {
      const card = $(element);
      const title = compactText(card.find(".card-title").first().text());
      const bodyParagraph = card
        .find(".card-body p")
        .toArray()
        .map((node) => compactText($(node).text()))
        .find((value) => Boolean(value) && !/^\d{2}\/\d{2}\/\d{4}$/.test(value));
      const body = bodyParagraph || compactText(card.find(".card-body").first().text());
      const cardDateMatch = /\d{2}\/\d{2}\/\d{4}/.exec(card.text());
      const dateText = cardDateMatch?.[0] ?? "";
      return createImportedAlWafiyatNotice(source, title, body, dateText, source.sourceUrl);
    })
    .get();

  return uniqueImportedAlWafiyatNotices(items);
}

function extractGeneralSecurityAlWafiyatNotices(pageHtml: string): ImportedAlWafiyatNotice[] {
  const source = findAlWafiyatSource("gsf");
  if (!source) return [];

  const $ = load(pageHtml);
  const items = $("a[href*='/ar/deaths/details/']")
    .map((_, element) => {
      const link = $(element);
      const blockText = extractGeneralSecurityNoticeBlockText($, link);
      const dateMatch = GENERAL_SECURITY_NOTICE_DATE_REGEX.exec(blockText);
      if (!dateMatch) {
        return null;
      }

      const textAfterDate = compactText(blockText.slice(dateMatch.index + dateMatch[0].length));
      const title = extractGeneralSecurityTitle(textAfterDate);
      const href = compactText(link.attr("href"));

      let originalUrl = source.sourceUrl;
      if (href) {
        try {
          originalUrl = new URL(href, source.sourceUrl).toString();
        } catch {
          originalUrl = source.sourceUrl;
        }
      }

      return createImportedAlWafiyatNotice(source, title, blockText, dateMatch[0], originalUrl);
    })
    .get();

  return uniqueImportedAlWafiyatNotices(items);
}

function extractAlWafiyatNotices(source: AlWafiyatSourceRecord, pageHtml: string): ImportedAlWafiyatNotice[] {
  if (source.id === "army") {
    return extractArmyAlWafiyatNotices(pageHtml);
  }

  if (source.id === "gsf") {
    return extractGeneralSecurityAlWafiyatNotices(pageHtml);
  }

  return extractIsfAlWafiyatNotices(pageHtml);
}

async function fetchAlWafiyatSourceHtml(source: AlWafiyatSourceRecord): Promise<{ html: string; statusCode: number }> {
  const response = await fetch(source.sourceUrl, {
    method: "GET",
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ar,en;q=0.8",
      "user-agent": "WatanyBot/1.0 (+https://koudama.com/mcp)",
    },
    signal: AbortSignal.timeout(OFFICIAL_SERVICE_TIMEOUT_MS),
  });

  const html = await response.text();
  if (!response.ok) {
    throw new Error(`upstream_html_failed_${response.status}`);
  }

  return { html, statusCode: response.status };
}

function buildStoredDeathIdentity(item: any): string {
  const sourceKey = compactText(item?.source).toLowerCase();
  const title = compactText(item?.title || item?.name).toLowerCase();
  const noticeDate = normalizeNoticeDate(item?.date_of_death);
  return `${sourceKey}::${noticeDate}::${title}`;
}

function mapImportedAlWafiyatToStoredDeathRecord(item: ImportedAlWafiyatNotice, index: number) {
  const id = `al-wafiyat-${item.sourceId}-${item.noticeDate}-${slugifyNoticeTitle(item.title)}-${index + 1}`;
  return {
    id,
    name: item.title,
    title: item.title,
    rank: "",
    apparatus: item.sourceProviderAr,
    date_of_death: item.noticeDate,
    source: item.sourceKey,
    sourceUrl: item.sourceUrl,
    originalUrl: item.originalUrl,
    status: "under_review",
    submitted_at: item.importedAt,
    imported_at: item.importedAt,
    notes: item.rawText,
    import_mode: "official_source_crawl",
    source_provider: item.sourceProvider,
  };
}

function appendImportedDeathNotices(allNotices: any[], imported: ImportedAlWafiyatNotice[]) {
  const seen = new Set(allNotices.map((item) => buildStoredDeathIdentity(item)));
  const inserted: any[] = [];

  imported.forEach((item, index) => {
    const next = mapImportedAlWafiyatToStoredDeathRecord(item, index);
    const key = buildStoredDeathIdentity(next);
    if (seen.has(key)) return;
    seen.add(key);
    allNotices.push(next);
    inserted.push(next);
  });

  return inserted;
}

function mapStoredDeathNoticeToAlWafiyat(item: any) {
  const source = classifyAlWafiyatSource(item);
  if (!source) return null;

  const title = compactText(item?.title || item?.name);
  const noticeDate = normalizeNoticeDate(item?.date_of_death);
  if (!title || !noticeDate) return null;

  const rank = compactText(item?.rank);
  const apparatus = compactText(item?.apparatus) || source.providerAr;
  const rawText = buildAlWafiyatRawText(
    compactText(item?.rawText || item?.notes) || [rank, apparatus].filter(Boolean).join(" - ") || title,
    apparatus,
  );

  return {
    id: String(item?.id ?? `al-wafiyat-${source.id}-${noticeDate}`),
    title,
    rank: rank || null,
    apparatus,
    noticeDate,
    sourceId: source.id,
    sourceProvider: source.providerCode,
    sourceProviderAr: source.providerAr,
    sourceLabelAr: source.titleAr,
    sourceUrl: compactText(item?.sourceUrl) || source.sourceUrl,
    originalUrl: compactText(item?.originalUrl) || compactText(item?.sourceUrl) || source.sourceUrl,
    status: mapStoredDeathStatusToAlWafiyat(String(item?.status ?? "")),
    importedAt: compactText(item?.submitted_at || item?.imported_at || item?.created_at || item?.published_at) || new Date().toISOString(),
    approvedAt: compactText(item?.published_at) || null,
    rawText,
  };
}

function alWafiyatSortTime(value?: string | null): number {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? time : 0;
}

function compareAlWafiyatNotices(left: ReturnType<typeof mapStoredDeathNoticeToAlWafiyat>, right: ReturnType<typeof mapStoredDeathNoticeToAlWafiyat>): number {
  const leftDate = left?.noticeDate ?? "";
  const rightDate = right?.noticeDate ?? "";
  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate);
  }

  const leftApprovedAt = alWafiyatSortTime(left?.approvedAt);
  const rightApprovedAt = alWafiyatSortTime(right?.approvedAt);
  if (leftApprovedAt !== rightApprovedAt) {
    return rightApprovedAt - leftApprovedAt;
  }

  const leftImportedAt = alWafiyatSortTime(left?.importedAt);
  const rightImportedAt = alWafiyatSortTime(right?.importedAt);
  if (leftImportedAt !== rightImportedAt) {
    return rightImportedAt - leftImportedAt;
  }

  return (left?.title ?? "").localeCompare(right?.title ?? "", "ar");
}

function deathNoticesWritePath(): string {
  const candidates = dataCandidates("death-notices.jsonl");
  const existing = candidates.find((p) => fs.existsSync(p));
  return existing ?? candidates[0];
}

function readAllDeathNotices(): any[] {
  return readJsonl(dataCandidates("death-notices.jsonl"));
}

function writeAllDeathNotices(notices: any[]): void {
  const file = deathNoticesWritePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const content = notices.map((n) => JSON.stringify(n)).join("\n") + "\n";
  fs.writeFileSync(file, content, "utf8");
}

function publishStoredDeathNotices(items: any[], publishedAt: string) {
  items.forEach((item) => {
    item.status = "published";
    item.updated_at = publishedAt;
    item.published_at = publishedAt;
  });
}

function buildAlWafiyatSyncAnnouncement(inserted: any[]) {
  const titles = inserted
    .map((item) => buildStoredDeathDisplayTitle(item))
    .filter(Boolean);
  const count = titles.length;
  const preview = titles.slice(0, 4);
  const remaining = count - preview.length;

  if (count <= 1) {
    const title = preview[0] || "وفاة جديدة معلنة رسمياً";
    return {
      title: `وفاة جديدة في الوفيات الرسمية: ${title}`,
      body: `تمت إضافة ${title} إلى قائمة الوفيات الرسمية.`,
    };
  }

  const suffix = remaining > 0 ? `، و${remaining} حالات إضافية` : "";
  return {
    title: `تم تحديث الوفيات الرسمية (${count})`,
    body: `أُضيفت وفيات جديدة إلى القائمة الرسمية: ${preview.join("، ")}${suffix}.`,
  };
}

async function importAlWafiyatSource(sourceId: AlWafiyatSourceId, req: any, reply: any) {
  const denied = requireAdminRoute(req, reply);
  if (denied) return denied;

  const source = findAlWafiyatSource(sourceId);
  if (!source) {
    reply.code(404);
    return { ok: false, error: "source_not_found" };
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const previewOnly = body.previewOnly === true;

  try {
    const { html } = await fetchAlWafiyatSourceHtml(source);
    const extracted = limitItems(extractAlWafiyatNotices(source, html), body.limit ?? req.query?.limit) as ImportedAlWafiyatNotice[];

    if (previewOnly) {
      return {
        ok: true,
        source,
        previewOnly: true,
        importedCount: 0,
        total: extracted.length,
        items: extracted,
      };
    }

    const all = readAllDeathNotices();
    const inserted = appendImportedDeathNotices(all, extracted);
    writeAllDeathNotices(all);

    return {
      ok: true,
      source,
      previewOnly: false,
      importedCount: inserted.length,
      total: inserted.length,
      items: inserted
        .map((item) => mapStoredDeathNoticeToAlWafiyat(item))
        .filter((item): item is NonNullable<ReturnType<typeof mapStoredDeathNoticeToAlWafiyat>> => Boolean(item)),
    };
  } catch {
    reply.code(502);
    return {
      ok: false,
      error: "source_fetch_failed",
      source,
    };
  }
}

function alWafiyatTextMatch(item: any, q: string): boolean {
  if (!q) return true;
  return textMatch(item, q);
}

async function probeAlWafiyatSource(source: AlWafiyatSourceRecord) {
  const checkedAt = new Date().toISOString();

  try {
    const { html, statusCode } = await fetchAlWafiyatSourceHtml(source);
    return {
      sourceId: source.id,
      sourceProvider: source.providerCode,
      sourceProviderAr: source.providerAr,
      sourceUrl: source.sourceUrl,
      reachable: true,
      statusCode,
      checkedAt,
      parsedCount: extractAlWafiyatNotices(source, html).length,
    };
  } catch {
    return {
      sourceId: source.id,
      sourceProvider: source.providerCode,
      sourceProviderAr: source.providerAr,
      sourceUrl: source.sourceUrl,
      reachable: false,
      statusCode: null,
      checkedAt,
      parsedCount: 0,
    };
  }
}

export async function registerOfficialSourcesRoutes(app: FastifyLike) {
  app.get("/api/official-services", async () => {
    const items = readOfficialServices()
      .filter((service) => service.mode !== "EXCLUDED")
      .map((service) => mapOfficialServiceForResponse(service));

    return {
      ok: true,
      items,
      total: items.length,
    };
  });

  app.get("/api/official-services/:serviceId", async (req: any, reply: any) => {
    const serviceId = String(req.params?.serviceId ?? "");
    const service = getOfficialServiceById(serviceId);

    if (!service || service.mode === "EXCLUDED") {
      reply.code(404);
      return { ok: false, error: "not_found" };
    }

    return {
      ok: true,
      item: mapOfficialServiceForResponse(service),
    };
  });

  app.post("/api/official-services/:serviceId/query", async (req: any, reply: any) => {
    const serviceId = String(req.params?.serviceId ?? "");
    const service = getOfficialServiceById(serviceId);
    const body = (req.body || {}) as Record<string, unknown>;

    if (!service || service.mode === "EXCLUDED") {
      reply.code(404);
      return { ok: false, error: "not_found" };
    }

    if (service.externalOnly) {
      reply.code(409);
      return {
        ok: false,
        error: service.fallbackMessageAr || "هذه الخدمة متاحة فقط عبر المصدر الرسمي الخارجي.",
        serviceId: service.id,
        source: "official",
        provider: service.providerAr,
        sourceUrl: service.portalUrl || service.sourceUrl,
        fallbackUrl: service.portalUrl || service.sourceUrl,
        reason: "external_only",
      };
    }

    if (service.mode !== "LOCAL_FORM_BRIDGE") {
      reply.code(405);
      return { ok: false, error: "service_not_queryable" };
    }

    if (!service.enabled) {
      reply.code(409);
      return {
        ok: false,
        error: service.fallbackMessageAr || "الخدمة غير متاحة حالياً داخل موطني.",
        serviceId: service.id,
        source: "official",
        provider: service.providerAr,
        sourceUrl: service.sourceUrl,
        fallbackUrl: service.sourceUrl,
        reason: "service_disabled",
      };
    }

    try {
      if (service.id === "isf-medical-allowances") {
        const name = normalizeScalar(body.name);
        const militaryNumber = normalizeScalar(body.military_number ?? body.militaryNumber);

        if (!name || !militaryNumber) {
          reply.code(400);
          return {
            ok: false,
            error: "name and military_number are required",
          };
        }

        const pageHtml = await fetchHtml(service.sourceUrl);
        const submitUrl = extractMedicalAidSubmitUrl(pageHtml, service.bridgeSubmitUrl);
        if (!submitUrl) {
          reply.code(502);
          return {
            ok: false,
            error: OFFICIAL_SERVICE_UPSTREAM_UNAVAILABLE_ERROR,
            serviceId: service.id,
            source: "official",
            provider: service.providerAr,
            sourceUrl: service.sourceUrl,
            fallbackUrl: service.sourceUrl,
            reason: "upstream_unavailable",
          };
        }

        const payload = await postOfficialForm(submitUrl, {
          name,
          military_number: militaryNumber,
        }, service.sourceUrl);

        const resultItems = uniqueOfficialResultItems(buildOfficialResultItems(payload));
        return {
          ok: true,
          serviceId: service.id,
          status: "success",
          source: "official",
          provider: service.providerAr,
          lastCheckedAt: new Date().toISOString(),
          fallbackUrl: service.sourceUrl,
          result: {
            summaryAr: buildOfficialSummary(service.id, payload),
            items: resultItems,
          },
        };
      }

      if (service.id === "isf-traffic-tickets") {
        const plateNumber = normalizeScalar(body.plate_number ?? body.plateNumber);
        const code = normalizeScalar(body.code);

        if (!plateNumber || !code) {
          reply.code(400);
          return {
            ok: false,
            error: "plate_number and code are required",
          };
        }

        const pageHtml = await fetchHtml(service.sourceUrl);
        const submitUrl = extractSpeedTicketSubmitUrl(pageHtml, service.bridgeSubmitUrl);
        const token = extractSpeedTicketToken(pageHtml);

        if (!submitUrl || !token) {
          reply.code(502);
          return {
            ok: false,
            error: OFFICIAL_SERVICE_UPSTREAM_UNAVAILABLE_ERROR,
            serviceId: service.id,
            source: "official",
            provider: service.providerAr,
            sourceUrl: service.sourceUrl,
            fallbackUrl: service.sourceUrl,
            reason: "upstream_unavailable",
          };
        }

        const payload = await postOfficialForm(submitUrl, {
          plate_number: plateNumber,
          code,
          _token: token,
          lang: "ar",
        }, service.sourceUrl);

        const extraItems: OfficialResultItem[] = [
          { labelAr: getServiceFieldLabel(service, "plate_number"), valueAr: plateNumber },
          { labelAr: getServiceFieldLabel(service, "code"), valueAr: getServiceFieldOptionLabel(service, "code", code) },
        ];

        const resultItems = uniqueOfficialResultItems([...extraItems, ...buildOfficialResultItems(payload)]);
        return {
          ok: true,
          serviceId: service.id,
          status: "success",
          source: "official",
          provider: service.providerAr,
          lastCheckedAt: new Date().toISOString(),
          fallbackUrl: service.sourceUrl,
          result: {
            summaryAr: buildOfficialSummary(service.id, payload),
            items: resultItems,
          },
        };
      }

      reply.code(501);
      return { ok: false, error: "bridge_not_implemented" };
    } catch (error) {
      (app as any).log?.error?.({ serviceId: service.id, error: serializeOfficialServiceError(error) }, "Official service bridge query failed");
      reply.code(502);
      return {
        ok: false,
        error: service.fallbackMessageAr || OFFICIAL_SERVICE_UPSTREAM_UNAVAILABLE_ERROR,
        serviceId: service.id,
        source: "official",
        provider: service.providerAr,
        sourceUrl: service.sourceUrl,
        fallbackUrl: service.sourceUrl,
        reason: "upstream_unavailable",
      };
    }
  });

  app.get("/api/official-services/:serviceId/health", async (req: any, reply: any) => {
    const serviceId = String(req.params?.serviceId ?? "");
    const service = getOfficialServiceById(serviceId);

    if (!service || service.mode === "EXCLUDED") {
      reply.code(404);
      return { ok: false, error: "not_found" };
    }

    const health = await probeOfficialSource(service);
    const updated = updateOfficialService(service.id, (current) => ({
      ...current,
      lastCheckedAt: health.checkedAt,
      lastStatusCode: health.statusCode,
      lastHealthOk: health.reachable,
    }));

    return {
      ok: true,
      serviceId: service.id,
      sourceUrl: service.sourceUrl,
      reachable: health.reachable,
      statusCode: health.statusCode,
      lastCheckedAt: updated?.lastCheckedAt || health.checkedAt,
    };
  });

  app.get("/api/admin/official-services", async (req: any, reply: any) => {
    const denied = requireAdminRoute(req, reply);
    if (denied) return denied;

    return {
      ok: true,
      items: readOfficialServices().map((service) => mapOfficialServiceForResponse(service)),
    };
  });

  app.patch("/api/admin/official-services/:serviceId", async (req: any, reply: any) => {
    const denied = requireAdminRoute(req, reply);
    if (denied) return denied;

    const serviceId = String(req.params?.serviceId ?? "");
    const patch = (req.body || {}) as Record<string, unknown>;
    const updated = updateOfficialService(serviceId, (current) => normalizePatchedService(current, patch));

    if (!updated) {
      reply.code(404);
      return { ok: false, error: "not_found" };
    }

    return {
      ok: true,
      item: mapOfficialServiceForResponse(updated),
    };
  });

  app.get("/api/deaths", async (req: any) => {
    const q = String(req.query?.q ?? "");
    const all = readJsonl(dataCandidates("death-notices.jsonl"))
      .filter(publishedDeathNotice)
      .filter(isPubliclyDisplayableDeathNotice)
      .filter((item) => textMatch(item, q));
    return { ok: true, items: limitItems(all, req.query?.limit), total: all.length };
  });

  app.get("/api/deaths/:id", async (req: any, reply: any) => {
    const id = String(req.params?.id ?? "");
    const all = readJsonl(dataCandidates("death-notices.jsonl"))
      .filter(publishedDeathNotice)
      .filter(isPubliclyDisplayableDeathNotice);
    const item = all.find((x) => String(x?.id ?? "") === id);
    if (!item) {
      reply.code(404);
      return { ok: false, error: "not_found" };
    }
    return { ok: true, item };
  });

  app.get("/api/recruitment/conditions", async () => {
    const item = readJson(
      dataCandidates("official-sources/lebarmy-volunteer-conditions.json"),
      {
        id: "lebarmy_volunteer_conditions",
        type: "official_reference",
        category: "recruitment_conditions",
        sourceUrl:
          "https://www.lebarmy.gov.lb/ar/content/%D8%B4%D8%B1%D9%88%D8%B7-%D8%A7%D9%84%D8%AA%D8%B7%D9%88%D8%B9",
        status: "source_mapped",
      },
    );
    return { ok: true, item };
  });

  app.get("/api/legal/isf-laws", async (req: any) => {
    const q = String(req.query?.q ?? "");
    const all = readJsonl(dataCandidates("legal/isf-laws.jsonl")).filter((item) => textMatch(item, q));
    return { ok: true, items: limitItems(all, req.query?.limit), total: all.length };
  });

  app.get("/api/useful-links", async (req: any) => {
    const q = String(req.query?.q ?? "");
    const data = readJson<any[]>(dataCandidates("official-sources/useful-links.json"), []);
    const items = data.filter((item) => textMatch(item, q));
    return { ok: true, items: limitItems(items, req.query?.limit), total: items.length };
  });

  // ── Admin: death notices management ────────────────────────────────────────

  function createAlWafiyatSyncArtifacts(inserted: any[]) {
    const pluginDb = (app as any)?.pluginDb;
    if (!pluginDb || inserted.length === 0) return;

    const nowMs = Date.now();
    const summary = buildAlWafiyatSyncAnnouncement(inserted);

    try {
      pluginDb
        .prepare(
          "INSERT INTO notifications (id, title, body, kind, ts, read, user_id, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          `notif_al_wafiyat_sync_${nowMs}`,
          summary.title,
          summary.body,
          AL_WAFIYAT_NOTIFICATION_KIND,
          nowMs,
          0,
          null,
          "route",
          "/al-wafiyat",
        );
    } catch (error) {
      (app as any)?.log?.warn?.({ err: error }, "al_wafiyat_auto_sync_notification_failed");
    }

    try {
      pluginDb
        .prepare(
          "INSERT INTO ticker_items (id, type, title, body, link_type, link_id, priority, starts_at, ends_at, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          `ticker_al_wafiyat_sync_${nowMs}`,
          "announcement",
          summary.title,
          summary.body,
          "route",
          "/al-wafiyat",
          AL_WAFIYAT_TICKER_PRIORITY,
          nowMs,
          nowMs + AL_WAFIYAT_TICKER_WINDOW_MS,
          nowMs,
          nowMs,
          "al_wafiyat_auto_sync",
        );
    } catch (error) {
      (app as any)?.log?.warn?.({ err: error }, "al_wafiyat_auto_sync_ticker_failed");
    }
  }

  async function runAlWafiyatAutoSyncCycle() {
    const all = readAllDeathNotices();
    const inserted: any[] = [];
    const failedSources: string[] = [];
    const publishedAt = new Date().toISOString();

    for (const source of AL_WAFIYAT_SOURCES) {
      try {
        const { html } = await fetchAlWafiyatSourceHtml(source);
        const extracted = extractAlWafiyatNotices(source, html);
        const nextInserted = appendImportedDeathNotices(all, extracted);
        if (nextInserted.length > 0) {
          publishStoredDeathNotices(nextInserted, publishedAt);
          inserted.push(...nextInserted);
        }
      } catch (error) {
        failedSources.push(source.id);
        (app as any)?.log?.warn?.({ err: error, sourceId: source.id }, "al_wafiyat_auto_sync_source_failed");
      }
    }

    if (inserted.length > 0) {
      writeAllDeathNotices(all);
      createAlWafiyatSyncArtifacts(inserted);
    }

    return { importedCount: inserted.length, failedSources };
  }

  function startAlWafiyatAutoSyncJob() {
    if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") return;
    if (process.env.AL_WAFIYAT_AUTO_SYNC !== "true") return;
    if (alWafiyatAutoSyncTimer) return;

    const runCycle = async () => {
      if (alWafiyatAutoSyncInFlight) return;
      alWafiyatAutoSyncInFlight = true;
      try {
        const result = await runAlWafiyatAutoSyncCycle();
        (app as any)?.log?.info?.(
          { importedCount: result.importedCount, failedSources: result.failedSources },
          "al_wafiyat_auto_sync_cycle_completed",
        );
      } catch (error) {
        (app as any)?.log?.error?.({ err: error }, "al_wafiyat_auto_sync_cycle_failed");
      } finally {
        alWafiyatAutoSyncInFlight = false;
      }
    };

    alWafiyatAutoSyncWarmupTimer = setTimeout(() => {
      void runCycle();
    }, AL_WAFIYAT_AUTO_SYNC_INITIAL_DELAY_MS);
    alWafiyatAutoSyncTimer = setInterval(() => {
      void runCycle();
    }, AL_WAFIYAT_AUTO_SYNC_INTERVAL_MS);

    (app as any)?.log?.info?.(
      {
        intervalMs: AL_WAFIYAT_AUTO_SYNC_INTERVAL_MS,
        warmupMs: AL_WAFIYAT_AUTO_SYNC_INITIAL_DELAY_MS,
        tickerWindowMs: AL_WAFIYAT_TICKER_WINDOW_MS,
      },
      "al_wafiyat_auto_sync_started",
    );
  }

  app.get("/api/al-wafiyat", async (req: any) => {
    const q = String(req.query?.q ?? "");
    const provider = String(req.query?.provider ?? "").toLowerCase();
    const items = readAllDeathNotices()
      .filter(isPubliclyDisplayableDeathNotice)
      .map((item) => mapStoredDeathNoticeToAlWafiyat(item))
      .filter((item): item is NonNullable<ReturnType<typeof mapStoredDeathNoticeToAlWafiyat>> => Boolean(item))
      .filter((item) => item.status === "APPROVED")
      .filter((item) => !provider || item.sourceId === provider)
      .filter((item) => alWafiyatTextMatch(item, q))
      .sort(compareAlWafiyatNotices);

    return {
      ok: true,
      items: limitItems(items, req.query?.limit),
      total: items.length,
      sources: AL_WAFIYAT_SOURCES,
    };
  });

  app.get("/api/admin/al-wafiyat", async (req: any, reply: any) => {
    const denied = requireAdminRoute(req, reply);
    if (denied) return denied;

    const q = String(req.query?.q ?? "");
    const provider = String(req.query?.provider ?? "").toLowerCase();
    const status = String(req.query?.status ?? "").toUpperCase();
    const items = readAllDeathNotices()
      .map((item) => mapStoredDeathNoticeToAlWafiyat(item))
      .filter((item): item is NonNullable<ReturnType<typeof mapStoredDeathNoticeToAlWafiyat>> => Boolean(item))
      .filter((item) => !provider || item.sourceId === provider)
      .filter((item) => !status || item.status === status)
      .filter((item) => alWafiyatTextMatch(item, q))
      .sort(compareAlWafiyatNotices);

    return {
      ok: true,
      items: limitItems(items, req.query?.limit),
      total: items.length,
      sources: AL_WAFIYAT_SOURCES,
    };
  });

  app.get("/api/al-wafiyat/sources/health", async (req: any, reply: any) => {
    const denied = requireAdminRoute(req, reply);
    if (denied) return denied;

    return {
      ok: true,
      sources: await Promise.all(AL_WAFIYAT_SOURCES.map((source) => probeAlWafiyatSource(source))),
    };
  });

  app.post("/api/al-wafiyat/import/army", async (req: any, reply: any) => importAlWafiyatSource("army", req, reply));

  app.post("/api/al-wafiyat/import/isf", async (req: any, reply: any) => importAlWafiyatSource("isf", req, reply));

  app.post("/api/al-wafiyat/import/gsf", async (req: any, reply: any) => importAlWafiyatSource("gsf", req, reply));

  app.post("/api/al-wafiyat/approve", async (req: any, reply: any) => {
    const denied = requireAdminRoute(req, reply);
    if (denied) return denied;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const id = compactText(body.id ?? body.noticeId);
    const action = compactText(body.action).toUpperCase();

    if (!id || !["APPROVE", "REJECT"].includes(action)) {
      reply.code(400);
      return {
        ok: false,
        error: "invalid_approval_request",
        allowedActions: ["APPROVE", "REJECT"],
      };
    }

    const all = readAllDeathNotices();
    const idx = all.findIndex((item) => String(item?.id ?? "") === id);
    if (idx === -1) {
      reply.code(404);
      return { ok: false, error: "not_found" };
    }
    if (action === "APPROVE" && isSyntheticDeathNotice(all[idx])) {
      reply.code(400);
      return { ok: false, error: "synthetic_test_notice_blocked" };
    }

    const nextStatus = action === "APPROVE" ? "published" : "archived";
    const now = new Date().toISOString();
    all[idx] = {
      ...all[idx],
      status: nextStatus,
      updated_at: now,
      published_at: action === "APPROVE" ? now : all[idx]?.published_at,
    };
    writeAllDeathNotices(all);

    return {
      ok: true,
      action,
      item: mapStoredDeathNoticeToAlWafiyat(all[idx]),
    };
  });

  app.get("/api/admin/deaths", async (req: any, reply: any) => {
    const denied = requireAdminRoute(req, reply);
    if (denied) return denied;

    const q = String(req.query?.q ?? "");
    const all = readAllDeathNotices().filter((item) => textMatch(item, q));
    return { ok: true, items: limitItems(all, req.query?.limit), total: all.length };
  });

  app.post("/api/admin/deaths", async (req: any, reply: any) => {
    const denied = requireAdminRoute(req, reply);
    if (denied) return denied;

    const body = req.body ?? {};
    const { name, rank, apparatus, date_of_death, source, notes } = body;
    if (!name || !rank || !apparatus || !date_of_death) {
      reply.code(400);
      return { ok: false, error: "missing_required_fields", required: ["name", "rank", "apparatus", "date_of_death"] };
    }
    if (isSyntheticDeathNotice({ name, notes })) {
      reply.code(400);
      return { ok: false, error: "synthetic_test_notice_blocked" };
    }
    const allowedSources = ["army_official", "isf_official", "admin_input"];
    const resolvedSource = allowedSources.includes(String(source ?? "")) ? String(source) : "admin_input";
    const id = `death-${Date.now()}`;
    const notice = {
      id,
      name: String(name),
      rank: String(rank),
      apparatus: String(apparatus),
      date_of_death: String(date_of_death),
      source: resolvedSource,
      status: "pending",
      submitted_at: new Date().toISOString(),
      notes: notes ? String(notes) : "",
    };
    const all = readAllDeathNotices();
    all.push(notice);
    writeAllDeathNotices(all);
    reply.code(201);
    return { ok: true, id, notice };
  });

  app.patch("/api/admin/deaths/:id/status", async (req: any, reply: any) => {
    const denied = requireAdminRoute(req, reply);
    if (denied) return denied;

    const id = String(req.params?.id ?? "");
    const body = req.body ?? {};
    const allowedStatuses = ["pending", "published", "archived", "under_review"];
    const newStatus = String(body.status ?? "");
    if (!allowedStatuses.includes(newStatus)) {
      reply.code(400);
      return { ok: false, error: "invalid_status", allowed: allowedStatuses };
    }
    const all = readAllDeathNotices();
    const idx = all.findIndex((x) => String(x?.id ?? "") === id);
    if (idx === -1) {
      reply.code(404);
      return { ok: false, error: "not_found" };
    }
    if (newStatus === "published" && isSyntheticDeathNotice(all[idx])) {
      reply.code(400);
      return { ok: false, error: "synthetic_test_notice_blocked" };
    }
    all[idx] = { ...all[idx], status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "published") {
      all[idx].published_at = new Date().toISOString();
    }
    writeAllDeathNotices(all);
    return { ok: true, id, status: newStatus, notice: all[idx] };
  });

  startAlWafiyatAutoSyncJob();
}