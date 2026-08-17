const DEV_SUPERADMIN_REQUEST = import.meta.env.DEV && (import.meta.env.VITE_DISABLE_AUTH ?? "false").toLowerCase() === "true";
// PAYMENT_OVERRIDE_LIVE_PIPELINE_WIRING_V1: payment override wiring reviewed for live pipeline integration.
import type {
  CTAAction,
  CaseItem,
  ChatMessage,
  ChatSession,
  KBHit,
  ChatV2Response,
  Community,
  CommunityGroupDetail,
  CommunityGroup,
  CommunityGroupMembersOverview,
  CommunityGroupMembershipSummary,
  CommunityGroupPermission,
  CommunityMessagesPage,
  CommunityMembershipUpdate,
  CommunityReadUpdate,
  CommunityMessage,
  CommunityAppeal,
  CommunityAppealOutcome,
  CommunityReport,
  CommunityReportReasonCategory,
  CommunityReportStatus,
  CommunityReportTargetType,
  ConversationContext,
  DocumentItem,
  EmergencyAlert,
  FormTemplate,
  HybridRouteDecision,
  HybridRouteMode,
  OfficialFileItem,
  JobApplication,
  JobVacancy,
  LiveSession,
  MarketplaceListing,
  RecruitmentAnnouncement,
  NotificationItem,
  NotificationPreviewMode,
  NotificationPushPublicConfig,
  NotificationPushProvider,
  NotificationPushSubscription,
  NotificationRoomMuteDuration,
  NotificationSettings,
  PensionCalcResult,
  SalaryComputeV2Response,
  SalaryMeta,
  SalaryResult,
  SavedChatItem,
  SearchV2Response,
  TicketV2,
  TxDetail,
  TxItem,
  UserProfile,
  AuthTokens,
  WatanyModule,
} from "../types/domain";
import type {
  AlWafiyatApprovalAction,
  AlWafiyatHealthRecord,
  AlWafiyatImportRequest,
  AlWafiyatImportResponse,
  AlWafiyatListResponse,
  AlWafiyatNotice,
  AlWafiyatSourceId,
} from "../features/al-wafiyat/alWafiyat.types";
import type { PublishedWebUserSettingsPayload } from "@watany/shared/web-user-settings";
import { getCandidateApiBaseUrls, getDefaultApiBaseUrl, isSameOriginDevProxyBase } from "./api-base";
import { uid } from "./utils";
import { authHeaders, storeTokens, clearTokens, getCsrfToken, profileFromToken, getAnonymousVoterId, isLoggedIn, getAccessToken } from "./auth";
import { fixMojibake } from "./encoding";
import { normalizeSearchableArabicInput } from "./lang";

export type PensionAttestationDocument = {
  source: "mof";
  sourceUrl: string;
  fetchedAt: string;
  documentHtml: string;
};

export type PensionAttestationFailureReason = "validation_failed" | "upstream_unavailable" | "external_only";

export type NewsItem = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  image_url: string | null;
  source_url: string | null;
  is_published: number;
  published_at: number;
  created_at: number;
  created_by: string | null;
};

export type FakeNewsItem = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  status: "زائف" | "صحيح" | "غير مؤكد" | null;
  image_url: string | null;
  source_url: string;
  published_at: number;
  verified_at: number | null;
  source_name: string;
};

export type PensionAttestationError = Error & {
  source?: "mof";
  sourceUrl?: string;
  reason?: PensionAttestationFailureReason;
};

export type OfficialServiceMode =
  | "EXISTING_LOCAL"
  | "LOCAL_FORM_BRIDGE"
  | "SECURE_EXTERNAL_PORTAL"
  | "LOCAL_GUIDE_AND_DOWNLOADS"
  | "PENDING_URL_VALIDATION"
  | "EXCLUDED";

export type OfficialServicePrivacy = "NORMAL" | "HIGH";

export type OfficialServiceInputOption = {
  value: string;
  labelAr: string;
};

export type OfficialServiceInputField = {
  key: string;
  labelAr: string;
  placeholderAr?: string;
  type: "text" | "select";
  required: boolean;
  options?: OfficialServiceInputOption[];
  helpTextAr?: string;
};

export type OfficialServiceDownload = {
  id: string;
  titleAr: string;
  url: string;
  kind: "pdf" | "video" | "external";
};

export type UsefulLink = {
  id: string;
  label: string;
  url: string;
  category: string;
  description?: string;
  official?: boolean;
  status?: string;
};

export type OfficialService = {
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
  portalUrl?: string;
  iframeAllowed?: boolean | null;
  lastCheckedAt?: string | null;
  lastStatusCode?: number | null;
  lastHealthOk?: boolean | null;
};

export type OfficialServiceResultItem = {
  labelAr: string;
  valueAr: string;
};

export type OfficialServiceQueryResponse = {
  ok: boolean;
  serviceId: string;
  status: string;
  source: string;
  provider: string;
  lastCheckedAt: string;
  fallbackUrl: string;
  result: {
    summaryAr: string;
    items: OfficialServiceResultItem[];
  };
};

export type OfficialServiceQueryFailureReason = "service_disabled" | "upstream_unavailable" | "external_only";

export type OfficialServiceQueryError = Error & {
  serviceId?: string;
  source?: string;
  provider?: string;
  sourceUrl?: string;
  fallbackUrl?: string;
  reason?: OfficialServiceQueryFailureReason;
};

export type OfficialServiceHealthResponse = {
  ok: boolean;
  serviceId: string;
  sourceUrl: string;
  reachable: boolean;
  statusCode: number | null;
  lastCheckedAt: string;
};

export type UpdateOfficialServiceRequest = Partial<{
  enabled: boolean;
  sourceUrl: string;
  officialUrl: string;
  summaryAr: string;
  helpTextAr: string;
  fallbackMessageAr: string;
  externalOnly: boolean;
  mode: OfficialServiceMode;
  knownIssuesAr: string[];
}>;

export type ManagedJobPosting = {
  id: string;
  employerId: string;
  title: string;
  status: "draft" | "active" | "paused" | "closed" | "filled";
  applicationsCount: number;
  createdAt: string;
};

export type TaxiAdminDriverStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type TaxiDriverAvailabilityStatus = "AVAILABLE" | "BUSY" | "OFFLINE";

export type TaxiVehicleView = {
  color?: string;
  make?: string;
  model?: string;
  platePublicLastDigits?: string;
  plateType?: string;
};

export type TaxiDriverView = {
  id: string;
  fullName: string;
  phone: string;
  whatsappPhone?: string;
  profileImageUrl?: string;
  status: TaxiAdminDriverStatus;
  verificationLevel: "BASIC" | "LICENSED" | "TRUSTED";
  vehicles: TaxiVehicleView[];
  currentAvailability?: {
    status: TaxiDriverAvailabilityStatus;
    locationLabel?: string;
    lat?: number;
    lng?: number;
    lastSeenAt: string;
  };
  serviceAreas?: Array<{
    muhafaza?: string;
    caza?: string;
    village?: string;
  }>;
  averageRating?: number;
  totalReviews?: number;
};

export type TaxiDriverRatingSummary = {
  driverId: string;
  averageRating: number;
  totalReviews: number;
};

export type TaxiDriverReview = {
  id: string;
  driverId: string;
  userId?: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt?: string;
};

export type TaxiDriverReviewPayload = {
  userId?: string;
  rating: number;
  comment?: string;
};

export type TaxiComplaintPayload = {
  userId?: string;
  driverId?: string;
  category?: "driver" | "ride" | "service" | "other";
  message: string;
};

export type TaxiComplaintView = {
  id: string;
  userId?: string;
  driverId?: string;
  category: "driver" | "ride" | "service" | "other";
  message: string;
  createdAt: string;
};

export type TaxiSearchQueryInput = {
  q?: string;
  muhafaza?: string;
  caza?: string;
  village?: string;
};

export type TaxiDriverApplicationPayload = {
  fullName: string;
  phone: string;
  whatsappPhone?: string;
  profileImageUrl?: string;
  notes?: string;
  vehicleCarType?: string;
  vehicleColor?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  platePublicLastDigits?: string;
  plateType?: string;
  muhafaza?: string;
  caza?: string;
  village?: string;
};

export type TaxiDriverAvailabilityPayload = {
  driverId: string;
  status: TaxiDriverAvailabilityStatus;
  locationLabel?: string;
  lat?: number;
  lng?: number;
  availableUntil?: string;
};

export type TaxiReservationPayload = {
  driverId: string;
  riderUserId?: string;
  pickupText: string;
  pickupLat?: number;
  pickupLng?: number;
  destinationText?: string;
  scheduledAt?: string;
  notes?: string;
};

export type TaxiReservationView = {
  id: string;
  driverId: string;
  pickupText: string;
  pickupLat?: number;
  pickupLng?: number;
  destinationText?: string;
  scheduledAt?: string;
  status: "REQUESTED" | "ACCEPTED" | "DRIVER_CALLED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  notes?: string;
  createdAt: string;
};

export type TaxiAdminDriver = {
  id: string;
  fullName: string;
  phone: string;
  whatsappPhone?: string;
  status: TaxiAdminDriverStatus;
  areaLabel: string;
  vehicleLabel: string;
  platePublicLastDigits?: string;
  availability: TaxiDriverAvailabilityStatus;
  updatedAt: string;
};

export type TaxiAdminMonitoring = {
  totalDrivers: number;
  pendingDrivers: number;
  approvedDrivers: number;
  rejectedDrivers: number;
  suspendedDrivers: number;
  availableDrivers: number;
  busyDrivers: number;
  offlineDrivers: number;
  lastUpdatedAt: string | null;
};

export type TaxiAdminSettings = {
  requireAdminApproval: boolean;
  allowPhoneContact: boolean;
  allowWhatsappContact: boolean;
  complaintsEnabled: boolean;
  privacyMaskPlateDigits: boolean;
  veteranPriorityOnly: boolean;
  maxActiveReservationsPerDriver: number;
  availabilityHeartbeatMinutes: number;
};

export type NetworkVisibilityLevel = "VISIBLE_PUBLIC" | "VISIBLE_NETWORK_ONLY" | "VISIBLE_CAZA_ONLY" | "VISIBLE_VILLAGE_ONLY" | "HIDDEN";
export type NetworkFamilyTier = "BASIC_FAMILY_MEMBER" | "VERIFIED_FAMILY_MEMBER" | "CONTRIBUTOR" | "COMMUNITY_STEWARD";
export type NetworkApprovalStatus = "PENDING" | "APPROVED" | "SUSPENDED" | "HIDDEN_BY_ADMIN";

export type NetworkMembershipProfile = {
  id: string;
  userId: string;
  displayName: string;
  address: unknown;
  visibilityLevel: NetworkVisibilityLevel;
  familyTier?: NetworkFamilyTier;
  points?: number;
  isVerifiedUser?: boolean;
  approvalStatus: NetworkApprovalStatus;
  isActive: boolean;
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  updatedAt: string;
};

const resolveApiUrl = () => getDefaultApiBaseUrl();
const API_URL = {
  toString: resolveApiUrl,
  valueOf: resolveApiUrl,
  [Symbol.toPrimitive]: resolveApiUrl,
} as unknown as string;

function shouldSkipOptionalDevRequest(baseUrl: string): boolean {
  return isSameOriginDevProxyBase(baseUrl);
}
const OTP_REQUEST_FAILURE_MESSAGE = "تعذر إرسال رمز التحقق حالياً. حاول لاحقاً.";
const OTP_VERIFY_FAILURE_MESSAGE = "الرمز غير صحيح أو انتهت صلاحيته.";

function getClientChatSessionId(): string {
  if (globalThis.window === undefined) {
    return "server-session";
  }

  const storageKey = "watany_chat_session_id";
  const existing = globalThis.window.sessionStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const nextId = uid("chat_session");
  globalThis.window.sessionStorage.setItem(storageKey, nextId);
  return nextId;
}

type ChatHistoryOptions = {
  sessionId?: string;
  sessionScoped?: boolean;
};

function resolveClientHistorySessionId(options?: ChatHistoryOptions): string {
  if (options?.sessionScoped === false) {
    return "";
  }

  const explicitSessionId = typeof options?.sessionId === "string" ? options.sessionId.trim() : "";
  return explicitSessionId || getClientChatSessionId();
}

function sanitizeChatKbHits(hits: any[]): KBHit[] {
  return hits.map((hit: any) => {
    let title = "مرجع من قاعدة المعرفة";
    if (typeof hit.title === "string" && hit.title.trim() && !/^(rag|law|doc|kb)_[a-z0-9]+$/i.test(hit.title.trim())) {
      title = hit.title;
    } else if (typeof hit.body === "string" && hit.body.trim()) {
      title = hit.body.split(/\r?\n/)[0].trim().slice(0, 120);
    }

    return {
      source: hit.source || "kb",
      id: hit.id || "",
      title,
      body: hit.body || hit.text || "",
      score: hit.score ?? 0,
    };
  });
}

function shouldUseGatewayFallbackForChatV2(data: any): boolean {
  let answer = "";
  if (typeof data?.answer_lb === "string") {
    answer = data.answer_lb;
  } else if (typeof data?.answer_formal === "string") {
    answer = data.answer_formal;
  }
  const hasRawIdsInAnswer = /(rag|law|doc|kb)_[a-z0-9]{8,}/i.test(answer);
  const hasRawIdsInHits = Array.isArray(data?.kb_hits)
    && data.kb_hits.some((hit: any) => {
      const hasRawTitle = typeof hit?.title === "string" && /^(rag|law|doc|kb)_[a-z0-9]+$/i.test(hit.title.trim());
      const hasRawId = typeof hit?.id === "string" && /^(rag|law|doc|kb)_[a-z0-9]+$/i.test(hit.id.trim());
      return hasRawTitle || hasRawId;
    });
  const hasSerializedSourceDict = /📖\s*المصدر:\s*\{[^}]*['"]?(?:file|article)['"]?\s*:/i.test(answer);
  const nonEmptyLines = answer.split(/\r?\n/).filter((line: string) => line.trim().length > 0);
  const looksLikeDump = nonEmptyLines.length >= 5 && !/[.؟!]/.test(answer);
  const lowConfidence = typeof data?.confidence === "number" && data.confidence < 0.2;
  const hasClarificationUi = (Array.isArray(data?.menu) && data.menu.length > 0) || typeof data?.clarifying === "string";

  return (hasRawIdsInAnswer || hasRawIdsInHits || hasSerializedSourceDict || looksLikeDump || lowConfidence) && !hasClarificationUi;
}

function sanitizeChatMenu(items: unknown): string[] {
  return Array.isArray(items)
    ? items.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function mapPythonChatV2Response(data: any): ChatV2Response {
  return {
    ...data,
    kb_hits: sanitizeChatKbHits(Array.isArray(data.kb_hits) ? data.kb_hits : []),
    menu: sanitizeChatMenu(data.menu),
  };
}

function inferGatewayChatConfidence(data: any, sources: any[], debug: Record<string, unknown>): number {
  if (typeof data.confidence === "number") return data.confidence;
  if (debug.chitchat || debug.unrecognized) return 0.05;
  if (sources.length > 0) return 0.35;
  return 0.1;
}

function sanitizeChatCtas(value: unknown): CTAAction[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const ctas = value.filter((item): item is CTAAction => {
    return Boolean(item)
      && typeof item === "object"
      && typeof (item as CTAAction).id === "string"
      && typeof (item as CTAAction).label === "string"
      && typeof (item as CTAAction).type === "string";
  });

  return ctas.length > 0 ? ctas : undefined;
}

function mapGatewayChatResponse(data: any): ChatV2Response {
  const debug = (data.debug && typeof data.debug === "object") ? data.debug as Record<string, unknown> : {};
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const reply = data.reply || data.answer || "";
  const ctas = sanitizeChatCtas(data.ctas) || sanitizeChatCtas(data.routeDecision?.suggestedActions);

  return {
    answer_lb: reply,
    answer_formal: reply,
    confidence: inferGatewayChatConfidence(data, sources, debug),
    clarifying: typeof data.clarifying_question === "string" ? data.clarifying_question : undefined,
    intents: Array.isArray(data.intents) ? data.intents : [],
    ctas,
    routeDecision: data.routeDecision as HybridRouteDecision | undefined,
    context: data.context as ConversationContext | undefined,
    mode: data.mode as HybridRouteMode | undefined,
    module: data.module as WatanyModule | undefined,
    kb_hits: sanitizeChatKbHits(sources),
    intent: data.intent || "",
    domain: data.domain || "",
    intent_result: data.intent_result || {},
    menu: sanitizeChatMenu(data.menu),
  };
}

function mapGatewayChatStreamResponse(data: any, streamedReply: string): ChatV2Response {
  const normalizedReply = fixMojibake(streamedReply || data?.reply || data?.answer || "");
  const mapped = mapGatewayChatResponse({ ...data, reply: normalizedReply, answer: normalizedReply });

  if (normalizedReply.trim().length > 0 && mapped.confidence < 0.4) {
    mapped.confidence = 0.4;
  }

  return mapped;
}

async function tryPythonChatV2(
  question: string,
  context: Record<string, unknown> | undefined,
  baseUrl: string,
): Promise<ChatV2Response | null> {
  try {
    const res = await authFetch(`${baseUrl}/api/v2/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, context }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.error || shouldUseGatewayFallbackForChatV2(data)) return null;

    return mapPythonChatV2Response(data);
  } catch {
    return null;
  }
}

function isMutationMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function buildAuthRequestHeaders(init?: RequestInit, csrfToken?: string | null): Record<string, string> {
  const method = (init?.method || "GET").toUpperCase();
  const headers: Record<string, string> = { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) };

  if (DEV_SUPERADMIN_REQUEST) {
    headers["x-watany-role"] = "superadmin";
    headers["x-superadmin"] = "1";
  }

  if (csrfToken && isMutationMethod(method)) {
    headers["x-csrf-token"] = csrfToken;
  }
  return headers;
}

async function refreshAccessToken(csrfToken: string | null): Promise<AuthTokens | null> {
  const refreshHeaders: Record<string, string> = {};
  if (csrfToken) {
    refreshHeaders["x-csrf-token"] = csrfToken;
  }

  const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: refreshHeaders,
    credentials: "include",
  });

  if (!refreshRes.ok) {
    return null;
  }

  return (await refreshRes.json()) as AuthTokens;
}

/**
 * Authenticated fetch wrapper — attaches JWT Bearer token,
 * auto-refreshes on 401, and retries once.
 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const csrfToken = getCsrfToken();
  const headers = buildAuthRequestHeaders(init, csrfToken);
  let res = await fetch(url, { ...init, headers, credentials: "include" });

  // If 401, try the cookie-backed refresh flow and retry once.
  if (res.status === 401) {
    try {
      const tokens = await refreshAccessToken(csrfToken);
      if (tokens) {
        storeTokens(tokens);
        const retryHeaders = buildAuthRequestHeaders(init, csrfToken);
        res = await fetch(url, { ...init, headers: retryHeaders, credentials: "include" });
      }
    } catch {
      // Keep existing token state on refresh failures. A 401 may come from
      // endpoint-specific authorization rather than an expired session.
    }
  }
  return res;
}

export type SuperadminContact = {
  name: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company_name?: string;
  status?: string;
};

export async function getSuperadminContacts(limit = 50): Promise<SuperadminContact[]> {
  const response = await authFetch(`${API_URL}/api/admin-authority/crm/contacts?limit=${Math.min(Math.max(limit, 1), 100)}`);
  if (!response.ok) {
    throw new Error(`CRM_CONTACTS_HTTP_${response.status}`);
  }
  const payload = (await response.json()) as { items?: SuperadminContact[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

function parseContentDispositionFileName(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const utf8Pattern = /filename\*=UTF-8''([^;]+)/i;
  const utf8Match = utf8Pattern.exec(value);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const basicPattern = /filename="?([^";]+)"?/i;
  const basicMatch = basicPattern.exec(value);
  return basicMatch?.[1]?.trim() || undefined;
}

type ChatStreamHandlers = {
  onDelta?: (delta: string, fullText: string) => void;
};

type ParsedSseEvent = {
  event: string;
  data: string;
};

type GatewayStreamAccumulator = {
  fullText: string;
  meta: Record<string, unknown> | null;
  terminalError: string | null;
};

function splitSseBuffer(buffer: string): { chunks: string[]; remainder: string } {
  const chunks = buffer.split("\n\n");
  return {
    chunks: chunks.slice(0, -1),
    remainder: chunks.length > 0 ? chunks[chunks.length - 1] : "",
  };
}

function parseSseChunk(chunk: string): ParsedSseEvent | null {
  if (!chunk || chunk.startsWith(":")) return null;

  let event = "message";
  let data = "";

  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data += line.slice(5).trim();
  }

  return data ? { event, data } : null;
}

function stringifyStreamError(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value instanceof Error && value.message.trim()) return value.message;
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "chat_stream_error";
    }
  }
  return "chat_stream_error";
}

function applyGatewayStreamEvent(
  parsedEvent: ParsedSseEvent,
  accumulator: GatewayStreamAccumulator,
  handlers?: ChatStreamHandlers,
): void {
  try {
    const parsed = JSON.parse(parsedEvent.data) as Record<string, unknown>;

    if (parsedEvent.event === "delta" && typeof parsed.delta === "string") {
      const delta = fixMojibake(parsed.delta);
      accumulator.fullText += delta;
      handlers?.onDelta?.(delta, accumulator.fullText);
      return;
    }

    if (parsedEvent.event === "meta") {
      accumulator.meta = parsed;
      const reply = typeof parsed.reply === "string" ? fixMojibake(parsed.reply) : "";
      if (reply) {
        accumulator.fullText = reply;
      }
      return;
    }

    if (parsedEvent.event === "error") {
      accumulator.terminalError = stringifyStreamError(parsed.detail || parsed.message);
    }
  } catch {
    // Ignore malformed SSE payloads.
  }
}

function finalizeGatewayChatStream(accumulator: GatewayStreamAccumulator): ChatV2Response {
  if (!accumulator.fullText.trim() && accumulator.meta) {
    const reply = accumulator.meta.reply;
    if (typeof reply === "string" && reply.trim()) {
      accumulator.fullText = fixMojibake(reply);
    }
  }

  if (!accumulator.fullText.trim() && accumulator.terminalError) {
    throw new Error(accumulator.terminalError);
  }

  return mapGatewayChatStreamResponse(accumulator.meta || {}, accumulator.fullText);
}

async function readGatewayChatStream(
  question: string,
  handlers: ChatStreamHandlers | undefined,
  baseUrl: string,
): Promise<ChatV2Response> {
  const res = await authFetch(`${baseUrl}/api/chat/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: question, sessionId: getClientChatSessionId() }),
  });

  if (!res.ok || !res.body) {
    throw new Error("chat stream failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const accumulator: GatewayStreamAccumulator = {
    fullText: "",
    meta: null,
    terminalError: null,
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const { chunks, remainder } = splitSseBuffer(buffer);
    buffer = remainder;

    for (const chunk of chunks) {
      const parsedEvent = parseSseChunk(chunk);
      if (!parsedEvent) continue;
      applyGatewayStreamEvent(parsedEvent, accumulator, handlers);
    }
  }

  return finalizeGatewayChatStream(accumulator);
}

const MOCK_TX: TxItem[] = [
  {
    tx_no: 12,
    title_ar: "إضافة الزوجة على العاتق",
    section_ar: "الشؤون المالية",
    preview: "شروط إضافة الزوجة على العاتق والمستندات المطلوبة...",
  },
  {
    tx_no: 24,
    title_ar: "حصر الإرث للمتقاعد المتوفى",
    section_ar: "المعاملات الإدارية",
    preview: "إجراءات حصر الإرث والوثائق اللازمة...",
  },
  {
    tx_no: 41,
    title_ar: "مساعدة مدرسية",
    section_ar: "المساعدات الاجتماعية",
    preview: "آلية الاستفادة من المساعدة المدرسية...",
  },
];

const MOCK_DETAIL: Record<number, TxDetail> = {
  12: {
    tx_no: 12,
    title_ar: "إضافة الزوجة على العاتق",
    section_ar: "الشؤون المالية",
    preview: "شروط إضافة الزوجة على العاتق...",
    body: "هذا نص تجريبي. سيتم استبداله بنص المعاملة من قاعدة البيانات.",
    required_docs: ["إخراج قيد", "صورة عن الهوية", "طلب خطي"],
    steps: ["تجهيز المستندات", "تقديم الطلب لدى الجهة المختصة", "متابعة المعاملة"],
    phones: ["01XXXXXX"],
    urls: [],
    legal_basis: [{ law: "قانون الدفاع الوطني", article_no: 90, excerpt: "تعويضات الأعباء العائلية..." }],
    related: [{ tx_no: 24, title_ar: "حصر الإرث للمتقاعد المتوفى", similarity: 0.31 }],
  },
  24: {
    tx_no: 24,
    title_ar: "حصر الإرث للمتقاعد المتوفى",
    section_ar: "المعاملات الإدارية",
    preview: "إجراءات حصر الإرث...",
    body: "هذا نص تجريبي...",
    required_docs: ["شهادة وفاة", "حصر إرث", "إخراج قيد"],
    steps: ["استخراج شهادة الوفاة", "تنظيم حصر الإرث", "تقديم الملف للجهة المختصة"],
    legal_basis: [{ law: "قانون الدفاع الوطني", article_no: 94, excerpt: "انتقال الحقوق إلى المستحقين..." }],
    related: [{ tx_no: 12, title_ar: "إضافة الزوجة على العاتق", similarity: 0.31 }],
  },
};

const MOCK_SALARY: SalaryResult[] = [
  {
    rank_ar: "عميد",
    degree: 4,
    category: "الضباط العامون",
    basicSalary: 4992000,
    degreeValue: 150000,
    vetSalary: 4243200,
    equipment: 675000,
    driver: 982000,
    position: 982000,
    pension2026: 86437400,
    pension2026usd: 965.78,
    sixSalary: 37150200,
    totalSalary2026usd: 1380.76,
    source: { kind: "salary_table", label: "جدول الرواتب v6", ref: "salary_full_2026" },
  },
];

const FALLBACK_FORM_SOURCE_META: Record<string, Omit<FormSourceCard, "sourceId" | "formCount">> = {
  retirement: {
    sourceName: "مديرية التقاعد",
    description: "نماذج المعاشات والوضع العائلي للمتقاعدين.",
  },
  medical: {
    sourceName: "طبابة عسكرية",
    description: "نماذج الاستشفاء والتعويضات الطبية للمستفيدين.",
  },
  grant: {
    sourceName: "الشؤون",
    description: "نماذج المنح والمساعدات الدراسية والاجتماعية.",
  },
  laf: {
    sourceName: "الجيش اللبناني",
    description: "نماذج القيادة والخدمات الخاصة بالمتقاعدين.",
  },
  mof: {
    sourceName: "وزارة المالية",
    description: "نماذج مالية وإدارية مرتبطة بوزارة المالية.",
  },
  admin: {
    sourceName: "الجيش اللبناني",
    description: "إفادات ونماذج صادرة عن الجيش اللبناني.",
  },
  other: {
    sourceName: "مصادر أخرى",
    description: "نماذج إضافية من مصادر رسمية مختلفة.",
  },
};

const FALLBACK_FORM_SOURCE_ALIASES: Record<string, string> = {
  financial: "retirement",
  education: "grant",
  compensation: "grant",
  admin: "grant",
};

function normalizeFallbackFormSourceId(sourceId?: string): string | undefined {
  const normalized = (sourceId || "").trim().toLowerCase();
  if (!normalized) return undefined;
  return FALLBACK_FORM_SOURCE_ALIASES[normalized] || normalized;
}

function hasKnownFallbackSource(sourceId?: string): boolean {
  const normalized = normalizeFallbackFormSourceId(sourceId);
  if (!normalized) return false;
  return normalized in FALLBACK_FORM_SOURCE_META;
}

function isUsableFormSourcesResponse(value: unknown): value is { items: FormSourceCard[]; total: number } {
  if (!value || typeof value !== "object") return false;
  const payload = value as { items?: unknown; total?: unknown };
  if (!Array.isArray(payload.items) || typeof payload.total !== "number") return false;
  return payload.items.every((item) => !!item && typeof item === "object");
}

function isUsableFormsResponse(value: unknown): value is { items: FormListItem[]; total: number } {
  if (!value || typeof value !== "object") return false;
  const payload = value as { items?: unknown; total?: unknown };
  return Array.isArray(payload.items) && typeof payload.total === "number";
}

function isUsableFormGovernanceSummary(value: unknown): value is FormGovernanceSummary {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<FormGovernanceSummary>;
  return typeof payload.totalForms === "number"
    && Array.isArray(payload.requiredSources)
    && Array.isArray(payload.sourceRegistry)
    && Array.isArray(payload.nonApprovedRecords)
    && Array.isArray(payload.approvedWithoutEvidence)
    && typeof payload.hasBlockingIssues === "boolean";
}

function isUsableFormItem(value: unknown): value is FormListItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<FormListItem>;
  return typeof item.id === "string"
    && typeof item.title_ar === "string"
    && typeof item.code === "string";
}

const FALLBACK_RETIREE_FIELDS: FormTemplate["fields"] = [
  { id: "full_name", label: "الاسم الكامل", type: "text", required: true, width: "half" },
  { id: "military_number", label: "الرقم العسكري", type: "text", required: true, width: "half" },
  { id: "phone", label: "رقم الهاتف", type: "text", width: "half" },
  { id: "address", label: "العنوان", type: "text", width: "half" },
];

const FALLBACK_FAMILY_FIELDS: FormTemplate["fields"] = [
  { id: "beneficiary_name", label: "اسم المستفيد / المعال", type: "text", width: "half" },
  { id: "beneficiary_relation", label: "صلة القرابة", type: "select", width: "half", options: ["زوجة", "ابن", "ابنة", "والد", "والدة", "أخرى"] },
  { id: "notes", label: "ملاحظات", type: "textarea", width: "full" },
];

const FALLBACK_MEDICAL_FIELDS: FormTemplate["fields"] = [
  { id: "beneficiary_name", label: "اسم المستفيد", type: "text", required: true, width: "half" },
  { id: "hospital_name", label: "اسم المستشفى / المركز", type: "text", required: true, width: "half" },
  { id: "diagnosis", label: "التشخيص أو نوع الطلب", type: "textarea", required: true, width: "full" },
];

const FALLBACK_DATE_SIGNATURE_FIELDS: FormTemplate["fields"] = [
  { id: "date", label: "التاريخ", type: "date", required: true, width: "half" },
  { id: "signature", label: "التوقيع", type: "signature", required: true, width: "half" },
];

function mergeFallbackFields(...groups: FormTemplate["fields"][]): FormTemplate["fields"] {
  return groups.flatMap((group) => group.map((field) => ({ ...field })));
}

const FALLBACK_FORM_ITEMS: FormListItem[] = [
  {
    id: "form_t2",
    code: "ت2",
    title_ar: "طلب تعديل وضع عائلي",
    description_ar: "نموذج أساسي لتسجيل زواج أو ولادة أو وفاة أو طلاق ضمن ملف المتقاعد.",
    category: "family_status",
    related_tx: [8, 64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    fields: mergeFallbackFields(FALLBACK_RETIREE_FIELDS, FALLBACK_FAMILY_FIELDS, FALLBACK_DATE_SIGNATURE_FIELDS),
    instructions_ar: "يُرفق بالمستندات الثبوتية الخاصة بالتعديل المطلوب.",
    version: "2024-01",
    updatedAt: "2024-01-15",
    sourceId: "retirement",
    sourceName: "مديرية التقاعد",
    fileType: "html",
    shareUrl: "/forms/source/retirement",
    tags: ["وضع عائلي", "زواج", "طلاق", "ولادة", "وفاة"],
  },
  {
    id: "form_t11",
    code: "ت11",
    title_ar: "تعهد طلاق",
    description_ar: "إقرار خاص بالابنة المطلقة ضمن ملف التقاعد.",
    category: "divorce_declaration",
    related_tx: [64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    fields: mergeFallbackFields(FALLBACK_RETIREE_FIELDS, [
      { id: "daughter_name", label: "اسم الابنة المطلقة", type: "text", required: true, width: "half" },
      { id: "divorce_date", label: "تاريخ الطلاق", type: "date", required: true, width: "half" },
      { id: "declaration", label: "نص التعهد", type: "textarea", required: true, width: "full" },
    ], FALLBACK_DATE_SIGNATURE_FIELDS),
    instructions_ar: "ينظم بحضور المعنيين أو يصدق لدى الكاتب العدل وفق الأصول.",
    version: "2024-01",
    updatedAt: "2024-01-15",
    sourceId: "retirement",
    sourceName: "مديرية التقاعد",
    fileType: "html",
    shareUrl: "/forms/source/retirement",
    tags: ["طلاق", "ابنة", "تعهد"],
  },
  {
    id: "form_t12",
    code: "ت12",
    title_ar: "إقرار من متقاعد",
    description_ar: "إقرار لتأكيد البيانات الشخصية والعائلية عند تعديل الملف أو تجديد البطاقة.",
    category: "retiree_declaration",
    related_tx: [8, 64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    fields: mergeFallbackFields(FALLBACK_RETIREE_FIELDS, [
      { id: "marital_status", label: "الحالة الاجتماعية", type: "select", required: true, width: "half", options: ["أعزب", "متأهل", "أرمل", "مطلق"] },
      { id: "dependents_details", label: "تفاصيل المعالين", type: "textarea", width: "full" },
    ], FALLBACK_DATE_SIGNATURE_FIELDS),
    instructions_ar: "يستخدم لتأكيد البيانات عندما يكون المتقاعد حياً ويوقعه بنفسه.",
    version: "2024-01",
    updatedAt: "2024-01-15",
    sourceId: "retirement",
    sourceName: "مديرية التقاعد",
    fileType: "html",
    shareUrl: "/forms/source/retirement",
    tags: ["إقرار", "متقاعد", "بيانات شخصية"],
  },
  {
    id: "form_service_card",
    code: "بطاقة-خ",
    title_ar: "طلب تجديد بطاقة الخدمات الاجتماعية",
    description_ar: "طلب لتجديد أو استبدال بطاقة الخدمات الاجتماعية للمتقاعد.",
    category: "service_card",
    related_tx: [64],
    authority: "دائرة التقاعد - قيادة الجيش",
    fields: mergeFallbackFields(FALLBACK_RETIREE_FIELDS, [
      { id: "card_reason", label: "سبب الطلب", type: "select", required: true, width: "half", options: ["تجديد", "بدل فاقد", "بدل تالف", "بطاقة جديدة"] },
      { id: "dependents_on_card", label: "المعالون المسجلون", type: "textarea", width: "full" },
    ], FALLBACK_DATE_SIGNATURE_FIELDS),
    instructions_ar: "يُرفق بصورة شمسية حديثة والبطاقة القديمة عند التجديد.",
    version: "2024-01",
    updatedAt: "2024-01-15",
    sourceId: "retirement",
    sourceName: "مديرية التقاعد",
    fileType: "html",
    shareUrl: "/forms/source/retirement",
    tags: ["بطاقة خدمات", "تجديد", "بدل فاقد"],
  },
  {
    id: "form_t22",
    code: "ت22",
    title_ar: "طلب مساعدة مدرسية",
    description_ar: "طلب منحة أو مساعدة تعليمية مع إفادات الدراسة.",
    category: "schooling_aid",
    related_tx: [53],
    authority: "تعاونية موظفي الدولة",
    fields: mergeFallbackFields(FALLBACK_RETIREE_FIELDS, [
      { id: "student_name", label: "اسم الطالب/ة", type: "text", required: true, width: "half" },
      { id: "school_name", label: "اسم المدرسة / الجامعة", type: "text", required: true, width: "half" },
      { id: "academic_year", label: "العام الدراسي", type: "text", required: true, width: "half" },
      { id: "notes", label: "ملاحظات", type: "textarea", width: "full" },
    ], FALLBACK_DATE_SIGNATURE_FIELDS),
    instructions_ar: "يرفق بإفادة متابعة دراسة حديثة وإخراج قيد عائلي.",
    version: "2024-01",
    updatedAt: "2024-01-15",
    sourceId: "grant",
    sourceName: "الشؤون",
    fileType: "html",
    shareUrl: "/forms/source/grant",
    tags: ["مساعدة مدرسية", "منحة", "تعليم"],
  },
  {
    id: "form_pension_attestation",
    code: "مال-1",
    title_ar: "طلب إفادة معاش تقاعدي",
    description_ar: "إفادة رسمية لتأكيد قيمة المعاش أو صفة المستفيد أمام المصارف والجهات الإدارية.",
    category: "pension_attestation",
    related_tx: [],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    fields: mergeFallbackFields(FALLBACK_RETIREE_FIELDS, [
      { id: "purpose", label: "سبب طلب الإفادة", type: "select", required: true, width: "half", options: ["مصرف", "منحة", "سفارة", "إدارة رسمية", "أخرى"] },
      { id: "delivery_method", label: "طريقة الاستلام", type: "select", width: "half", options: ["ورقي", "نسخة مختومة", "إرسال إلى مصرف"] },
      { id: "notes", label: "ملاحظات", type: "textarea", width: "full" },
    ], FALLBACK_DATE_SIGNATURE_FIELDS),
    instructions_ar: "تُطلب عند الحاجة لإثبات وضع المعاش أو تقديمها إلى مصرف أو إدارة رسمية.",
    version: "2024-01",
    updatedAt: "2024-01-15",
    sourceId: "retirement",
    sourceName: "مديرية التقاعد",
    fileType: "html",
    shareUrl: "/salary",
    tags: ["إفادة معاش", "معاش تقاعدي", "مصرف", "مالية"],
    governance: {
      officialSourceLabel: "وزارة المالية - خدمة المتقاعدين العسكريين",
      officialSourceUrl: "https://eservices.finance.gov.lb/retiredInfo.aspx",
      officialReference: "إفادة معاش تقاعدي للمتقاعدين العسكريين",
      verifiedAt: "2026-05-20",
      governanceState: "official_verified",
      reviewStatus: "approved",
      lastReviewedAt: "2026-05-20",
      authorityLabel: "وزارة المالية - خدمة المتقاعدين العسكريين",
      reviewOwner: "فريق حوكمة النماذج",
      confidence: "high",
      notes: "مرجع مالي رسمي للتحقق من الإفادة المرتبطة بالمعاش.",
    },
  },
  {
    id: "form_medical_hospitalization",
    code: "طب-1",
    title_ar: "طلب موافقة استشفاء",
    description_ar: "طلب فتح ملف علاجي أو موافقة استشفاء ضمن الطبابة العسكرية.",
    category: "medical_hospitalization",
    related_tx: [],
    authority: "الطبابة العسكرية - قيادة الجيش",
    fields: mergeFallbackFields(FALLBACK_RETIREE_FIELDS, FALLBACK_MEDICAL_FIELDS, FALLBACK_DATE_SIGNATURE_FIELDS),
    instructions_ar: "يُرفق بتقرير الطبيب المعالج وصور الفحوص الأساسية.",
    version: "2024-01",
    updatedAt: "2024-01-15",
    sourceId: "medical",
    sourceName: "طبابة عسكرية",
    fileType: "html",
    shareUrl: "/forms/source/medical",
    tags: ["طبابة", "استشفاء", "موافقة"],
  },
  {
    id: "form_medical_reimbursement",
    code: "طب-2",
    title_ar: "طلب تعويض نفقات طبية",
    description_ar: "طلب تعويض عن استشفاء أو دواء أو فحوصات للمستفيدين من الطبابة العسكرية.",
    category: "medical_reimbursement",
    related_tx: [],
    authority: "الطبابة العسكرية - قيادة الجيش",
    fields: mergeFallbackFields(FALLBACK_RETIREE_FIELDS, [
      { id: "medical_provider", label: "اسم الجهة الطبية", type: "text", required: true, width: "half" },
      { id: "expense_type", label: "نوع النفقة", type: "select", required: true, width: "half", options: ["استشفاء", "دواء", "فحوصات", "مختبر", "علاج فيزيائي", "أخرى"] },
      { id: "invoice_number", label: "رقم الفاتورة", type: "text", width: "half" },
      { id: "amount", label: "القيمة الإجمالية", type: "number", required: true, width: "half" },
      { id: "notes", label: "ملاحظات", type: "textarea", width: "full" },
    ], FALLBACK_DATE_SIGNATURE_FIELDS),
    instructions_ar: "يُرفق بالفواتير الأصلية والتقارير الطبية ذات الصلة.",
    version: "2024-01",
    updatedAt: "2024-01-15",
    sourceId: "medical",
    sourceName: "طبابة عسكرية",
    fileType: "html",
    shareUrl: "/forms/source/medical",
    tags: ["طبابة", "تعويض طبي", "فاتورة", "دواء"],
  },
  {
    id: "form_birth_grant",
    code: "تع-1",
    title_ar: "طلب مساعدة ولادة أو زواج",
    description_ar: "طلب تعويض أو مساعدة اجتماعية مرتبطة بالولادة أو الزواج للمستفيدين من الصندوق أو التعاضد.",
    category: "social_compensation",
    related_tx: [],
    authority: "الشؤون",
    fields: mergeFallbackFields(FALLBACK_RETIREE_FIELDS, [
      { id: "event_type", label: "نوع المناسبة", type: "select", required: true, width: "half", options: ["ولادة", "زواج"] },
      { id: "beneficiary_name", label: "اسم المستفيد", type: "text", required: true, width: "half" },
      { id: "event_date", label: "تاريخ المناسبة", type: "date", required: true, width: "half" },
      { id: "supporting_docs", label: "المستندات المرفقة", type: "textarea", width: "full", placeholder: "إخراج قيد، عقد زواج، إفادة ولادة..." },
    ], FALLBACK_DATE_SIGNATURE_FIELDS),
    instructions_ar: "يُرفق بالمستندات الثبوتية الخاصة بالمناسبة ضمن المهلة المعتمدة.",
    version: "2024-01",
    updatedAt: "2024-01-15",
    sourceId: "grant",
    sourceName: "الشؤون",
    fileType: "html",
    shareUrl: "/forms/source/grant",
    tags: ["تعويض", "مساعدة", "ولادة", "زواج"],
    governance: {
      officialSourceLabel: "الشؤون",
      officialReference: "طلب مساعدة اجتماعية عن الولادة أو الزواج للمستفيدين",
      verifiedAt: "2026-05-20",
      governanceState: "official_verified",
      reviewStatus: "approved",
      lastReviewedAt: "2026-05-20",
      authorityLabel: "الشؤون",
      reviewOwner: "فريق حوكمة النماذج",
      confidence: "high",
      notes: "النموذج مرتبط بملف المساعدات الاجتماعية المعتمد.",
    },
  },
  {
    id: "form_service_attestation",
    code: "إدار-1",
    title_ar: "طلب إفادة خدمة أو وضع إداري",
    description_ar: "طلب إفادة خدمة أو وضع إداري للاستعمال لدى الإدارات الرسمية والسفارات والجهات العامة.",
    category: "administrative_certificate",
    related_tx: [],
    authority: "قيادة الجيش - مديرية الشؤون الإدارية",
    fields: mergeFallbackFields(FALLBACK_RETIREE_FIELDS, [
      { id: "certificate_type", label: "نوع الإفادة", type: "select", required: true, width: "half", options: ["إفادة خدمة", "إفادة وضع إداري", "إفادة للاستعمال الرسمي"] },
      { id: "submission_target", label: "الجهة المطلوب تقديم الإفادة إليها", type: "text", required: true, width: "half" },
      { id: "purpose", label: "سبب الطلب", type: "textarea", width: "full", placeholder: "مثال: مصرف، سفارة، إدارة عامة" },
    ], FALLBACK_DATE_SIGNATURE_FIELDS),
    instructions_ar: "يُحدد نوع الإفادة والجهة المستفيدة منها قبل تسليم الطلب إلى المرجع الإداري المختص.",
    version: "2024-01",
    updatedAt: "2024-01-15",
    sourceId: "grant",
    sourceName: "الشؤون",
    fileType: "html",
    shareUrl: "/forms/source/grant",
    tags: ["إفادة خدمة", "وضع إداري"],
    governance: {
      officialSourceLabel: "قيادة الجيش - مديرية الشؤون الإدارية",
      officialReference: "طلب إفادة خدمة أو وضع إداري للمتقاعد للاستعمال الرسمي",
      verifiedAt: "2026-05-20",
      governanceState: "official_reference",
      reviewStatus: "under_review",
      lastReviewedAt: "2026-05-20",
      authorityLabel: "قيادة الجيش - مديرية الشؤون الإدارية",
      reviewOwner: "فريق حوكمة النماذج",
      confidence: "medium",
      notes: "الفهرس الإداري موسع ولكن يعتمد مراجعة قبل اعتماد أي سجل إضافي.",
    },
  },
  {
    id: "form_weapon_license",
    code: "رخصة-س",
    title_ar: "طلب تجديد رخصة مسدس أميري",
    description_ar: "طلب لتجديد رخصة حمل مسدس أميري لمتقاعدي الجيش.",
    category: "weapon_license",
    related_tx: [64],
    authority: "قيادة الجيش",
    fields: mergeFallbackFields(FALLBACK_RETIREE_FIELDS, [
      { id: "weapon_type", label: "نوع المسدس", type: "text", required: true, width: "half" },
      { id: "weapon_serial", label: "الرقم التسلسلي", type: "text", required: true, width: "half" },
      { id: "current_license_expiry", label: "تاريخ انتهاء الرخصة الحالية", type: "date", width: "half" },
    ], FALLBACK_DATE_SIGNATURE_FIELDS),
    instructions_ar: "يُقدّم لدى الشرطة العسكرية التابعة لمنطقة السكن.",
    version: "2024-01",
    updatedAt: "2024-01-15",
    sourceId: "laf",
    sourceName: "الجيش اللبناني",
    fileType: "html",
    shareUrl: "/forms/source/laf",
    tags: ["رخصة", "مسدس", "سلاح"],
  },
];

function normalizeFallbackFormSearch(value: string): string {
  return normalizeSearchableArabicInput(value)
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F]/g, "")
    .trim();
}

function getFallbackForms(options?: FormsQueryOptions): { items: FormListItem[]; total: number } {
  const sourceId = normalizeFallbackFormSourceId(options?.sourceId);
  const normalizedQuery = normalizeFallbackFormSearch(options?.q || "");
  const normalizedFilter = normalizeFallbackFormSearch(options?.filter || "");

  const items = FALLBACK_FORM_ITEMS.filter((item) => {
    if (sourceId && item.sourceId !== sourceId) {
      return false;
    }

    if (normalizedFilter) {
      const filterHaystack = normalizeFallbackFormSearch([item.category || "", ...(item.tags || [])].join(" "));
      if (!filterHaystack.includes(normalizedFilter)) {
        return false;
      }
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = normalizeFallbackFormSearch([
      item.code,
      item.title_ar,
      item.description_ar,
      item.authority,
      item.sourceName,
      item.category || "",
      ...(item.tags || []),
    ].join(" "));

    return haystack.includes(normalizedQuery);
  });

  return { items, total: items.length };
}

function getFallbackFormSources(): { items: FormSourceCard[]; total: number } {
  const counts = new Map<string, number>();
  for (const item of FALLBACK_FORM_ITEMS) {
    counts.set(item.sourceId, (counts.get(item.sourceId) || 0) + 1);
  }

  const items = Object.entries(FALLBACK_FORM_SOURCE_META)
    .map(([sourceId, meta]) => ({
      sourceId,
      sourceName: meta.sourceName,
      icon: meta.icon,
      description: meta.description,
      formCount: counts.get(sourceId) || 0,
    }))
    .filter((item) => item.formCount > 0);

  return { items, total: items.length };
}

function getFallbackFormById(id: string): FormListItem | null {
  return FALLBACK_FORM_ITEMS.find((item) => item.id === id) ?? null;
}

let mockProfile: UserProfile = { isAuthed: false };
let mockHistory: ChatMessage[] = [];
let mockBookmarks: number[] = [24110982, 24108731, 24099844, 24091572];
let mockCases: CaseItem[] = [];
let mockDocuments: DocumentItem[] = [];
let mockEmergencyAlerts: EmergencyAlert[] = [
  {
    id: "alert-demo-border-01",
    title: "تنبيه ميداني: تحديث دوام مكتب شؤون المتقاعدين",
    country: "لبنان",
    date: "2026-06-20T08:30:00.000Z",
    summary: "تم اعتماد دوام مختصر في مكتب شؤون المتقاعدين هذا الأسبوع مع أولوية للمعاملات العاجلة المرتبطة بالطبابة والرواتب.",
    url: "/services/official",
    source: "watanybot-demo",
  },
  {
    id: "alert-demo-docs-02",
    title: "تنبيه وثائق: إبراز الهوية الأصلية عند مراجعة الملفات",
    country: "لبنان",
    date: "2026-06-18T11:15:00.000Z",
    summary: "عند مراجعة الملفات المرتبطة بالمنح أو التعويضات يجب إحضار الهوية الأصلية وصورة حديثة عن المستندات الداعمة.",
    url: "/documents",
    source: "watanybot-demo",
  },
  {
    id: "alert-demo-hotline-03",
    title: "إشعار خدمة: تفعيل رقم متابعة جديد للحالات الطارئة",
    country: "لبنان",
    date: "2026-06-16T06:45:00.000Z",
    summary: "تم تفعيل قناة متابعة جديدة للحالات الطارئة المرتبطة بالتنقل والمراجعات السريعة، مع تحديث ساعات الاستجابة اليومية.",
    url: "/notifications",
    source: "watanybot-demo",
  },
];
let mockNotifications: NotificationItem[] = [];
let mockNotificationSettings: NotificationSettings = {
  preference: {
    userId: "default",
    replyEnabled: true,
    mentionEnabled: true,
    pushEnabled: false,
    previewMode: "safe",
    quietHours: {
      enabled: false,
      start: "22:00",
      end: "07:00",
      timezone: "Asia/Beirut",
    },
    updatedAt: Date.now(),
  },
  roomMutes: [],
  devices: [],
};
let mockSaved: SavedChatItem[] = [];

function delay(ms = 220) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneNotificationSettings(settings: NotificationSettings): NotificationSettings {
  return {
    preference: {
      ...settings.preference,
      quietHours: {
        ...settings.preference.quietHours,
      },
    },
    roomMutes: settings.roomMutes.map((mute) => ({ ...mute })),
    devices: settings.devices.map((device) => ({ ...device })),
  };
}

function filterEmergencyAlertsByQuery(items: EmergencyAlert[], query: string): EmergencyAlert[] {
  const normalizedQuery = normalizeSearchableArabicInput(String(query || "")).trim().toLowerCase();
  if (!normalizedQuery) {
    return items;
  }

  return items.filter((alert) => normalizeSearchableArabicInput([
    alert.title,
    alert.country,
    alert.summary,
  ].filter(Boolean).join(" ")).toLowerCase().includes(normalizedQuery));
}

type FeatureFlagsResponse = {
  flags: Record<string, boolean>;
  lastUpdatedAt: string | null;
};

type AdminPaymentsQuestion = {
  id: string;
  text: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type AdminPaymentsAnswer = {
  id: string;
  questionId: string;
  value: string;
  isActive: boolean;
  activateAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
};

type AdminPaymentsAnnouncement = {
  id: string;
  text: string;
  enabled: boolean;
  createdAt: string;
};

type AdminPaymentsDashboard = {
  questions: AdminPaymentsQuestion[];
  activeAnswers: AdminPaymentsAnswer[];
  scheduledAnswers: AdminPaymentsAnswer[];
  answers: AdminPaymentsAnswer[];
  announcements: AdminPaymentsAnnouncement[];
  activeAnnouncements: AdminPaymentsAnnouncement[];
};

export type SurveyStatus = "draft" | "active" | "closed";

export type SurveyOption = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
};

export type SurveySummary = {
  id: string;
  title: string;
  description?: string | null;
  status: SurveyStatus;
  startDate?: string | null;
  endDate?: string | null;
  createdBy: string;
  optionCount: number;
  hasVoted?: boolean;
};

export type SurveyDetail = {
  election: SurveySummary;
  options: SurveyOption[];
  canEdit: boolean;
  canVote: boolean;
  hasVoted: boolean;
};

export type SurveyResultItem = {
  optionId: string;
  optionName: string;
  voteCount: number;
};

export type SurveyResults = {
  electionId: string;
  totalVotes: number;
  items: SurveyResultItem[];
};

export type WorldCupPoll = {
  id: string;
  type: "champion_team" | "best_player" | "match_winner";
  title: string;
  question: string;
  options: string[];
};

export type WorldCupVote = {
  pollId: string;
  optionId: string;
  userId: string;
  createdAt: string;
};

export type WorldCupPollPublishResult = {
  ok: boolean;
  force: boolean;
  pollsCount: number;
  published: boolean;
  groupsPosted: number;
  notificationPosted: boolean;
  reason?: string;
};

export type WorldCupPlayer = {
  id: string;
  name: string;
  position: "goalkeeper" | "defender" | "midfielder" | "forward" | "unknown";
  shirtNumber?: number;
  imageQuery?: string;
  imageUrl?: string;
  imageSource?: "wikimedia" | "fallback";
  imageFallbackUrl?: string;
  teamId?: string;
  teamNameAr?: string;
  teamNameEn?: string;
  teamCode?: string;
};

export type WorldCupTeam = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  group?: string;
  flagEmoji?: string;
  players: WorldCupPlayer[];
};

export type WorldCupNewsItem = {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  sourceLabel: string;
  sourceUrl: string;
  tags: string[];
  isBreaking: boolean;
};

export type WorldCupNewsCrawlSource = {
  id: string;
  label: string;
  baseUrl: string;
  feedUrl?: string;
  crawlIntervalMinutes: number;
  parser: "rss" | "html" | "api";
  enabled: boolean;
};

export type WorldCupMatchDto = {
  id: string;
  dateTime: string;
  teamA: string;
  teamB: string;
  stage: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
  score?: string;
  officialSourceUrl?: string;
  route?: string;
};

export type WorldCupLiveDto = {
  status: "ok";
  generatedAt: string;
  matches: WorldCupMatchDto[];
};

export type WorldCupMatchEvent = {
  id: string;
  minute?: number;
  kind: "event" | "news";
  title: string;
  detail: string;
  ts: string;
};

export type WorldCupMatchChatMessage = {
  id: string;
  matchId: string;
  userId: string;
  author: string;
  text: string;
  createdAt: string;
};

export type SurveyBridgeStatus = {
  ready: boolean;
  implemented: boolean;
  provider: "pending_bridge" | "supabase_rest_bridge" | "watany_plugin_db";
  scope: "watany_gateway";
  nextStep: string;
};

export type CreateSurveyRequest = {
  title: string;
  description?: string;
  status?: SurveyStatus;
  options: Array<{ name: string; description?: string; imageUrl?: string }>;
};

export type UpdateSurveyRequest = {
  title?: string;
  description?: string;
  status?: SurveyStatus;
};

export type LegalArticle = {
  id: string;
  article_number?: string;
  text: string;
  topic_tags: string[];
};

export type LegalLawArticlesResponse = {
  lawId: string;
  lawName: string;
  articleCount: number;
  items: LegalArticle[];
};

export type CreateSurveyOptionRequest = {
  name: string;
  description?: string;
  imageUrl?: string;
};

export type FormFileType = "pdf" | "docx" | "image" | "html" | "unknown";

export type FormGovernanceState = "official_verified" | "official_reference";
export type FormReviewStatus = "approved" | "under_review" | "needs_source" | "deprecated" | "fallback_only";
export type FormGovernanceConfidence = "high" | "medium" | "low";

export type FormGovernance = {
  officialSourceLabel: string;
  officialSourceUrl?: string;
  officialReference?: string;
  verifiedAt: string;
  governanceState: FormGovernanceState;
  reviewStatus: FormReviewStatus;
  lastReviewedAt: string;
  authorityLabel: string;
  reviewOwner: string;
  confidence: FormGovernanceConfidence;
  notes?: string;
};

export type FormGovernanceSummary = {
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

export type FormSourceCard = {
  sourceId: string;
  sourceName: string;
  formCount: number;
  icon?: string;
  description?: string;
};

export type PhoneVerificationRequestResponse = {
  ok: boolean;
  requestId: string;
  phoneNumber: string;
  expiresAt: string;
  message: string;
};

type PhoneVerificationVerifyResponse = {
  ok: boolean;
  phoneNumber: string;
  verifiedAt: string;
  profile?: UserProfile;
};

export type FormListItem = FormTemplate & {
  sourceId: string;
  sourceName: string;
  category?: string;
  description?: string;
  fileType?: FormFileType;
  previewUrl?: string;
  downloadUrl?: string;
  shareUrl?: string;
  tags: string[];
  governance?: FormGovernance;
  origin?: "forms_catalog" | "procedure_doc" | "document_asset" | "official_file" | "kb_node";
};

type FormsQueryOptions = {
  q?: string;
  sourceId?: string;
  filter?: string;
};

type AdminRecruitmentAnnouncementPayload = {
  title: string;
  apparatusName: string;
  announcementNumber?: string;
  startDate?: string;
  endDate?: string;
  status: RecruitmentAnnouncement["status"];
  conditions: string[];
  requiredDocuments: string[];
  eligibleCategories: string[];
  applicationLocation?: string;
  applicationMethod?: string;
  sourceName?: string;
  sourceUrl?: string;
  notes?: string;
};

type AuthenticatedProfilePayload = {
  id?: string | null;
  role?: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  phone?: string | null;
  region?: string | null;
  note?: string | null;
  profile_completed?: boolean | null;
  phone_verified_at?: string | null;
  last_login?: string | number | null;
};

function parseLastLogin(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function pickTrimmedString(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function pickOptionalString(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return value || undefined;
}

function mapAuthenticatedProfile(user: AuthenticatedProfilePayload, fallback?: UserProfile): UserProfile {
  const next: UserProfile = {
    ...fallback,
    isAuthed: true,
    phoneVerified: Boolean(user.phone_verified_at),
    phoneVerifiedAt: user.phone_verified_at || undefined,
  };

  const id = pickTrimmedString(user.id);
  const role = pickTrimmedString(user.role);
  const name = pickTrimmedString(user.full_name, user.name);
  const phone = pickTrimmedString(user.phone_number, user.phone);
  const email = pickOptionalString(user.email);
  const region = pickOptionalString(user.region);
  const note = pickOptionalString(user.note);
  const lastLogin = parseLastLogin(user.last_login);

  if (id) next.id = id;
  if (role) next.role = role as UserProfile["role"];
  if (name) next.name = name;
  if (phone) next.phone = phone;

  if (email !== undefined) next.email = email;
  if (region !== undefined) next.region = region;
  if (note !== undefined) next.note = note;

  if (typeof user.profile_completed === "boolean") {
    next.profileCompleted = user.profile_completed;
  }

  if (lastLogin !== undefined) {
    next.lastLogin = lastLogin;
  }

  return next;
}

async function loadLegacyProfile(baseUrl: string): Promise<UserProfile | null> {
  try {
    const res = await authFetch(`${baseUrl}/api/profile`);
    if (!res.ok) return null;
    const data = (await res.json()) as { profile: UserProfile };
    return data.profile;
  } catch {
    return null;
  }
}

async function loadAuthenticatedProfile(baseUrl: string, fallback?: UserProfile): Promise<UserProfile | null> {
  try {
    const res = await authFetch(`${baseUrl}/api/me`);
    if (!res.ok) return null;
    const data = (await res.json()) as { user: AuthenticatedProfilePayload };
    return mapAuthenticatedProfile(data.user || {}, fallback);
  } catch {
    return null;
  }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const payload = await res.json();
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Ignore malformed payloads.
  }

  return fallback;
}

export const api = {
  async health() {
    await delay(120);
    return { ok: true, mode: "mock" as const };
  },

  async getProfile(baseUrl = API_URL): Promise<UserProfile> {
    const tokenProfile = profileFromToken();
    const legacyProfile = await loadLegacyProfile(baseUrl);
    // debug: log profiles for auth-sync triage
    // eslint-disable-next-line no-console
    console.debug('[api.getProfile] tokenProfile', tokenProfile, 'legacyProfile', legacyProfile);

    if (tokenProfile) {
      const mergedFallback = legacyProfile
        ? { ...legacyProfile, ...tokenProfile, isAuthed: true }
        : tokenProfile;
      const authenticatedProfile = await loadAuthenticatedProfile(baseUrl, mergedFallback);
      if (authenticatedProfile) {
        return authenticatedProfile;
      }

      // If both legacy and authenticated profile endpoints failed, assume the
      // access token is stale/invalid and clear local tokens to avoid reusing
      // stale claims from `profileFromToken()` in downstream logic.
      if (!legacyProfile) {
        // Debug: capture token state before clearing to help triage test race
        // eslint-disable-next-line no-console
        try {
          // eslint-disable-next-line no-console
          console.debug('[api.getProfile] clearing tokens; getAccessToken()', getAccessToken(), {
            sessionToken: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('watany_access_token') : null,
            localRemember: typeof localStorage !== 'undefined' ? localStorage.getItem('watany_remember') : null,
          });
        } catch (e) {
          // ignore
        }
        clearTokens();
        // eslint-disable-next-line no-console
        console.debug('[api.getProfile] after clearTokens getAccessToken()', getAccessToken());
        return { isAuthed: false, role: "public" };
      }

      const refreshedTokenProfile = profileFromToken();
      // eslint-disable-next-line no-console
      console.debug('[api.getProfile] refreshedTokenProfile', refreshedTokenProfile);
      if (!refreshedTokenProfile) {
        // No token available after attempted refresh — clear any lingering state.
        clearTokens();
        return legacyProfile ?? { isAuthed: false, role: "public" };
      }

      return legacyProfile
        ? { ...legacyProfile, ...refreshedTokenProfile, isAuthed: true }
        : refreshedTokenProfile;
    }

    return legacyProfile ?? { isAuthed: false, role: "public" };
  },

  async login(
    email: string,
    password: string,
    baseUrl = API_URL,
    rememberMe = true
  ): Promise<UserProfile> {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe }),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error || "Login failed");
    }
    const tokens = (await res.json()) as AuthTokens;
    storeTokens(tokens, rememberMe);
    return api.getProfile(baseUrl);
  },

  async loginWithGoogleCredential(
    credential: string,
    baseUrl = API_URL,
    rememberMe = true,
  ): Promise<UserProfile> {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential, rememberMe }),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Google login failed" }));
      throw new Error(err.error || "Google login failed");
    }
    const tokens = (await res.json()) as AuthTokens;
    storeTokens(tokens, rememberMe);
    return api.getProfile(baseUrl);
  },

  /** Request a 6-digit OTP to be sent to the given phone number. */
  async requestOtp(
    phoneNumber: string,
    baseUrl = API_URL,
  ): Promise<{ ok: boolean; message: string }> {
    const res = await fetch(`${baseUrl}/api/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error || OTP_REQUEST_FAILURE_MESSAGE);
    }
    return res.json();
  },

  /** Verify the OTP, create/log-in the account, and return the user profile. */
  async verifyOtp(
    phoneNumber: string,
    code: string,
    baseUrl = API_URL,
  ): Promise<UserProfile> {
    const res = await fetch(`${baseUrl}/api/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, code }),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error || OTP_VERIFY_FAILURE_MESSAGE);
    }
    const data = (await res.json()) as { accessToken: string; expiresIn: number };
    storeTokens({ accessToken: data.accessToken, expiresIn: data.expiresIn });
    return api.getProfile(baseUrl);
  },

  async requestPhoneVerification(
    phoneNumber: string,
    baseUrl = API_URL,
  ): Promise<PhoneVerificationRequestResponse> {
    const res = await authFetch(`${baseUrl}/api/auth/phone-verification/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });

    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر بدء التحقق من رقم الهاتف."));
    }

    return (await res.json()) as PhoneVerificationRequestResponse;
  },

  async verifyPhoneVerification(
    requestId: string,
    code: string,
    baseUrl = API_URL,
  ): Promise<UserProfile> {
    const res = await authFetch(`${baseUrl}/api/auth/phone-verification/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, code }),
    });

    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر التحقق من الرمز."));
    }

    const data = (await res.json()) as PhoneVerificationVerifyResponse;
    if (data.profile) {
      return data.profile;
    }

    return {
      ...(profileFromToken() ?? { isAuthed: true }),
      isAuthed: true,
      phone: data.phoneNumber,
      phoneVerified: true,
      phoneVerifiedAt: data.verifiedAt,
    };
  },

  async logout(baseUrl = API_URL): Promise<UserProfile> {
    try {
      await authFetch(`${baseUrl}/api/auth/logout`, { method: "POST" });
    } catch { /* ignore */ }
    try {
      await authFetch(`${baseUrl}/api/profile/logout`, { method: "POST" });
    } catch { /* ignore */ }
    clearTokens();
    return { isAuthed: false, role: "public" };
  },

  async register(
    data: { email: string; password: string; username: string; fullName: string; phoneNumber?: string },
    baseUrl = API_URL
  ): Promise<UserProfile> {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Registration failed" }));
      throw new Error(err.error || "Registration failed");
    }
    const tokens = (await res.json()) as AuthTokens;
    storeTokens(tokens);
    return api.getProfile(baseUrl);
  },

  async updateProfile(patch: Partial<UserProfile>, baseUrl = API_URL): Promise<UserProfile> {
    try {
      const res = await authFetch(`${baseUrl}/api/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("profile update failed");
      const data = (await res.json()) as { profile: UserProfile };
      return data.profile;
    } catch {
      // Fallback: merge locally
      const current = profileFromToken() ?? { isAuthed: false };
      return { ...current, ...patch };
    }
  },

  async getSurveyBridgeStatus(baseUrl = API_URL): Promise<SurveyBridgeStatus> {
    const res = await authFetch(`${baseUrl}/api/voting/status`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر التحقق من حالة وحدة الاستطلاعات حالياً."));
    }
    return (await res.json()) as SurveyBridgeStatus;
  },

  async listSurveys(baseUrl = API_URL, status: SurveyStatus = "active"): Promise<SurveySummary[]> {
    const res = await authFetch(`${baseUrl}/api/voting/elections?status=${encodeURIComponent(status)}`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل الاستطلاعات حالياً."));
    }
    const data = (await res.json()) as { items: SurveySummary[] };
    return data.items || [];
  },

  async listSurveyAdminItems(baseUrl = API_URL): Promise<SurveyDetail[]> {
    const res = await authFetch(`${baseUrl}/api/voting/admin/elections`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل إدارة الاستطلاعات حالياً."));
    }
    const data = (await res.json()) as { items: SurveyDetail[] };
    return data.items || [];
  },

  async getSurvey(id: string, baseUrl = API_URL): Promise<SurveyDetail> {
    const res = await authFetch(`${baseUrl}/api/voting/elections/${encodeURIComponent(id)}`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل تفاصيل الاستطلاع المطلوب."));
    }
    return (await res.json()) as SurveyDetail;
  },

  async createSurvey(payload: CreateSurveyRequest, baseUrl = API_URL): Promise<SurveyDetail> {
    const res = await authFetch(`${baseUrl}/api/voting/elections`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر إنشاء الاستطلاع الجديد."));
    }
    return (await res.json()) as SurveyDetail;
  },

  async updateSurvey(
    surveyId: string,
    payload: UpdateSurveyRequest,
    baseUrl = API_URL,
  ): Promise<SurveyDetail> {
    const res = await authFetch(`${baseUrl}/api/voting/elections/${encodeURIComponent(surveyId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر حفظ تعديلات الاستطلاع."));
    }
    return (await res.json()) as SurveyDetail;
  },

  async addSurveyOption(
    surveyId: string,
    payload: CreateSurveyOptionRequest,
    baseUrl = API_URL,
  ): Promise<SurveyDetail> {
    const res = await authFetch(`${baseUrl}/api/voting/elections/${encodeURIComponent(surveyId)}/options`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر إضافة خيار جديد إلى الاستطلاع."));
    }
    return (await res.json()) as SurveyDetail;
  },

  async deleteSurveyOption(
    surveyId: string,
    optionId: string,
    baseUrl = API_URL,
  ): Promise<SurveyDetail> {
    const res = await authFetch(`${baseUrl}/api/voting/elections/${encodeURIComponent(surveyId)}/options/${encodeURIComponent(optionId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر حذف هذا الخيار من الاستطلاع."));
    }
    return (await res.json()) as SurveyDetail;
  },

  async deleteSurvey(surveyId: string, baseUrl = API_URL): Promise<{ ok: true }> {
    const res = await authFetch(`${baseUrl}/api/voting/elections/${encodeURIComponent(surveyId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر حذف الاستطلاع."));
    }
    return (await res.json()) as { ok: true };
  },

  async submitSurveyVote(surveyId: string, optionId: string, baseUrl = API_URL): Promise<{ ok: true }> {
    const res = await authFetch(`${baseUrl}/api/voting/elections/${encodeURIComponent(surveyId)}/vote`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-watany-voter-id": getAnonymousVoterId(),
      },
      body: JSON.stringify({ optionId }),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تسجيل صوتك في الاستطلاع."));
    }
    return (await res.json()) as { ok: true };
  },

  async getSurveyResults(surveyId: string, baseUrl = API_URL): Promise<SurveyResults> {
    const res = await authFetch(`${baseUrl}/api/voting/elections/${encodeURIComponent(surveyId)}/results`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل نتائج الاستطلاع."));
    }
    return (await res.json()) as SurveyResults;
  },

  async getWorldCupPolls(baseUrl = API_URL): Promise<WorldCupPoll[]> {
    const res = await authFetch(`${baseUrl}/api/world-cup/polls`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل تصويتات كأس العالم."));
    }
    const payload = (await res.json()) as { polls: WorldCupPoll[] };
    return payload.polls ?? [];
  },

  async getWorldCupTeams(baseUrl = API_URL): Promise<WorldCupTeam[]> {
    const res = await authFetch(`${baseUrl}/api/world-cup/teams`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل منتخبات كأس العالم."));
    }
    const payload = (await res.json()) as { teams: WorldCupTeam[] };
    return payload.teams ?? [];
  },

  async getWorldCupPlayers(baseUrl = API_URL): Promise<WorldCupPlayer[]> {
    const res = await authFetch(`${baseUrl}/api/world-cup/players`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل لاعبي كأس العالم."));
    }
    const payload = (await res.json()) as { players: WorldCupPlayer[] };
    return payload.players ?? [];
  },

  async getWorldCupVotes(pollId?: string, baseUrl = API_URL): Promise<WorldCupVote[]> {
    const query = pollId ? `?pollId=${encodeURIComponent(pollId)}` : "";
    const res = await authFetch(`${baseUrl}/api/world-cup/votes${query}`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل نتائج التصويت حالياً."));
    }
    const payload = (await res.json()) as { votes: WorldCupVote[] };
    return payload.votes ?? [];
  },

  async submitWorldCupVote(
    pollId: string,
    optionId: string,
    userId: string,
    baseUrl = API_URL,
  ): Promise<WorldCupVote> {
    const res = await authFetch(`${baseUrl}/api/world-cup/polls/${encodeURIComponent(pollId)}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ optionId, userId }),
    });

    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تسجيل التصويت للمباراة."));
    }

    const payload = (await res.json()) as { vote: WorldCupVote };
    return payload.vote;
  },

  async publishWorldCupPolls(
    force = false,
    baseUrl = API_URL,
  ): Promise<WorldCupPollPublishResult> {
    const res = await authFetch(`${baseUrl}/api/world-cup/polls/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force }),
    });

    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر إطلاق تصويتات كأس العالم الآن."));
    }

    return (await res.json()) as WorldCupPollPublishResult;
  },

  async getWorldCupNews(baseUrl = API_URL): Promise<WorldCupNewsItem[]> {
    const res = await authFetch(`${baseUrl}/api/world-cup/news`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل أخبار كأس العالم."));
    }
    const payload = (await res.json()) as { items: WorldCupNewsItem[] };
    return payload.items ?? [];
  },

  async getWorldCupBreakingNews(baseUrl = API_URL): Promise<WorldCupNewsItem[]> {
    const res = await authFetch(`${baseUrl}/api/world-cup/news/breaking`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل الأخبار العاجلة."));
    }
    const payload = (await res.json()) as { items: WorldCupNewsItem[] };
    return payload.items ?? [];
  },

  async getWorldCupNewsSources(baseUrl = API_URL): Promise<WorldCupNewsCrawlSource[]> {
    const res = await authFetch(`${baseUrl}/api/world-cup/news/sources`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل مصادر تغذية الأخبار."));
    }
    const payload = (await res.json()) as { sources: WorldCupNewsCrawlSource[] };
    return payload.sources ?? [];
  },

  async getWorldCupMatchById(matchId: string, baseUrl = API_URL): Promise<WorldCupMatchDto> {
    const res = await authFetch(`${baseUrl}/api/world-cup/matches/${encodeURIComponent(matchId)}`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل تفاصيل المباراة."));
    }

    const payload = (await res.json()) as { match: WorldCupMatchDto };
    return payload.match;
  },

  async getWorldCupTodayHomeMatches(baseUrl = API_URL): Promise<WorldCupMatchDto[]> {
    const res = await authFetch(`${baseUrl}/api/world-cup/home/today-matches`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل مباريات اليوم للرئيسية."));
    }

    const payload = (await res.json()) as { matches: WorldCupMatchDto[] };
    return payload.matches ?? [];
  },

  async getWorldCupMatches(baseUrl = API_URL): Promise<WorldCupMatchDto[]> {
    const res = await authFetch(`${baseUrl}/api/world-cup/matches`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل جدول مباريات كأس العالم."));
    }

    const payload = (await res.json()) as { matches: WorldCupMatchDto[] };
    return payload.matches ?? [];
  },

  async getWorldCupLive(baseUrl = API_URL): Promise<WorldCupLiveDto> {
    const res = await authFetch(`${baseUrl}/api/world-cup/live`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل آخر تحديثات كأس العالم."));
    }

    const payload = (await res.json()) as WorldCupLiveDto;
    return {
      status: payload.status ?? "ok",
      generatedAt: payload.generatedAt,
      matches: payload.matches ?? [],
    };
  },

  async getWorldCupMatchEvents(matchId: string, baseUrl = API_URL): Promise<{ status: "scheduled" | "live" | "finished"; events: WorldCupMatchEvent[] }> {
    const res = await authFetch(`${baseUrl}/api/world-cup/matches/${encodeURIComponent(matchId)}/events`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل تغذية المباراة."));
    }

    const payload = (await res.json()) as { status: "scheduled" | "live" | "finished"; events: WorldCupMatchEvent[] };
    return { status: payload.status, events: payload.events ?? [] };
  },

  async getWorldCupMatchChat(matchId: string, baseUrl = API_URL): Promise<WorldCupMatchChatMessage[]> {
    const res = await authFetch(`${baseUrl}/api/world-cup/matches/${encodeURIComponent(matchId)}/chat`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل دردشة المباراة."));
    }

    const payload = (await res.json()) as { messages: WorldCupMatchChatMessage[] };
    return payload.messages ?? [];
  },

  async postWorldCupMatchChat(
    matchId: string,
    body: { userId: string; author: string; text: string },
    baseUrl = API_URL,
  ): Promise<WorldCupMatchChatMessage> {
    const res = await authFetch(`${baseUrl}/api/world-cup/matches/${encodeURIComponent(matchId)}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر إرسال رسالة الدردشة."));
    }

    const payload = (await res.json()) as { message: WorldCupMatchChatMessage };
    return payload.message;
  },

  async searchTx(query: string, baseUrl = API_URL): Promise<TxItem[]> {
    const trimmed = normalizeSearchableArabicInput(query);
    if (!trimmed) return [];
    const res = await fetch(`${baseUrl}/api/tx/search?q=${encodeURIComponent(trimmed)}`);
    if (!res.ok) throw new Error("tx search failed");
    const data = (await res.json()) as { results: TxItem[] };
    return data.results || [];
  },

  async getTx(tx_no: number, baseUrl = API_URL): Promise<TxDetail> {
    const res = await fetch(`${baseUrl}/api/tx/${tx_no}`);
    if (!res.ok) throw new Error("tx not found");
    return (await res.json()) as TxDetail;
  },

  async salaryLookup(rank_ar: string, degree: number, baseUrl = API_URL): Promise<SalaryResult | null> {
    const params = new URLSearchParams({ rank: rank_ar, degree: String(degree) });
    const res = await fetch(`${baseUrl}/api/salary?${params.toString()}`);
    if (!res.ok) throw new Error("salary lookup failed");
    const data = (await res.json()) as { result: SalaryResult | null };
    return data.result || null;
  },

  async salaryMeta(baseUrl = API_URL): Promise<SalaryMeta> {
    const res = await fetch(`${baseUrl}/api/salary/meta`);
    if (!res.ok) throw new Error("salary meta failed");
    return (await res.json()) as SalaryMeta;
  },

  async salaryHealth(baseUrl = API_URL): Promise<{
    ok: boolean;
    status: "ready" | "partial_data_loaded" | "metadata_missing" | "server_unavailable";
    metadataReady: boolean;
    rankCount: number;
    degreeCount: number;
    medalCount: number;
  }> {
    const res = await fetch(`${baseUrl}/api/salary/health`);
    if (!res.ok) throw new Error("salary health failed");
    return (await res.json()) as {
      ok: boolean;
      status: "ready" | "partial_data_loaded" | "metadata_missing" | "server_unavailable";
      metadataReady: boolean;
      rankCount: number;
      degreeCount: number;
      medalCount: number;
    };
  },

  async salaryCalc(
    params: { rank: string; degree: number; married: boolean; kidsCount: number; selectedOrnaments: string[] },
    baseUrl = API_URL,
  ): Promise<PensionCalcResult> {
    const res = await fetch(`${baseUrl}/api/salary/calc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error("salary calc failed");
    return (await res.json()) as PensionCalcResult;
  },

  async pensionAttestation(
    params: { fullName: string; fatherName: string; surname: string; pensionNumber: string },
    baseUrl = API_URL,
  ): Promise<PensionAttestationDocument> {
    const res = await fetch(`${baseUrl}/api/pension/attestation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => null) as {
      ok?: boolean;
      error?: string;
      source?: "mof";
      sourceUrl?: string;
      reason?: PensionAttestationFailureReason;
      fetchedAt?: string;
      documentHtml?: string;
    } | null;

    if (!res.ok || !data?.ok || !data.documentHtml || !data.sourceUrl || !data.fetchedAt) {
      const error = new Error(data?.error || "تعذر جلب الإفادة الرسمية حالياً.") as PensionAttestationError;
      error.name = "PensionAttestationError";
      error.source = data?.source;
      error.sourceUrl = data?.sourceUrl;
      error.reason = data?.reason;
      throw error;
    }

    return {
      source: data.source || "mof",
      sourceUrl: data.sourceUrl,
      fetchedAt: data.fetchedAt,
      documentHtml: data.documentHtml,
    };
  },

  async listOfficialServices(baseUrl = API_URL): Promise<OfficialService[]> {
    const res = await fetch(`${baseUrl}/api/official-services`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل الخدمات الرسمية السريعة"));
    }
    const data = (await res.json()) as { items: OfficialService[] };
    return data.items || [];
  },

  async getOfficialService(serviceId: string, baseUrl = API_URL): Promise<OfficialService> {
    const res = await fetch(`${baseUrl}/api/official-services/${encodeURIComponent(serviceId)}`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل تفاصيل الخدمة الرسمية"));
    }
    const data = (await res.json()) as { item: OfficialService };
    return data.item;
  },

  async queryOfficialService(
    serviceId: string,
    payload: Record<string, string>,
    baseUrl = API_URL,
  ): Promise<OfficialServiceQueryResponse> {
    const res = await fetch(`${baseUrl}/api/official-services/${encodeURIComponent(serviceId)}/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null) as {
      ok?: boolean;
      error?: string;
      serviceId?: string;
      source?: string;
      provider?: string;
      sourceUrl?: string;
      fallbackUrl?: string;
      reason?: OfficialServiceQueryFailureReason;
      status?: string;
      lastCheckedAt?: string;
      result?: OfficialServiceQueryResponse["result"];
    } | null;

    if (!res.ok) {
      const error = new Error(data?.error || "تعذر تنفيذ الاستعلام الرسمي حالياً") as OfficialServiceQueryError;
      error.name = "OfficialServiceQueryError";
      error.serviceId = data?.serviceId;
      error.source = data?.source;
      error.provider = data?.provider;
      error.sourceUrl = data?.sourceUrl;
      error.fallbackUrl = data?.fallbackUrl;
      error.reason = data?.reason;
      throw error;
    }

    return data as OfficialServiceQueryResponse;
  },

  async checkOfficialServiceHealth(serviceId: string, baseUrl = API_URL): Promise<OfficialServiceHealthResponse> {
    const res = await fetch(`${baseUrl}/api/official-services/${encodeURIComponent(serviceId)}/health`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر فحص حالة الرابط الرسمي"));
    }
    return (await res.json()) as OfficialServiceHealthResponse;
  },

  async listAdminOfficialServices(baseUrl = API_URL): Promise<OfficialService[]> {
    const res = await authFetch(`${baseUrl}/api/admin/official-services`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل إدارة الخدمات الرسمية"));
    }
    const data = (await res.json()) as { items: OfficialService[] };
    return data.items || [];
  },

  async updateAdminOfficialService(
    serviceId: string,
    payload: UpdateOfficialServiceRequest,
    baseUrl = API_URL,
  ): Promise<OfficialService> {
    const res = await authFetch(`${baseUrl}/api/admin/official-services/${encodeURIComponent(serviceId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحديث إعدادات الخدمة الرسمية"));
    }
    const data = (await res.json()) as { item: OfficialService };
    return data.item;
  },

  async listAlWafiyat(
    params: { q?: string; provider?: AlWafiyatSourceId; limit?: number } = {},
    baseUrl = API_URL,
  ): Promise<AlWafiyatListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.provider) query.set("provider", params.provider);
    if (typeof params.limit === "number") query.set("limit", String(params.limit));

    const suffix = query.toString();
    const querySuffix = suffix ? `?${suffix}` : "";
    const res = await fetch(`${baseUrl}/api/al-wafiyat${querySuffix}`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل الوفيات الرسمية"));
    }

    return (await res.json()) as AlWafiyatListResponse;
  },

  async listAdminAlWafiyat(
    params: { q?: string; provider?: AlWafiyatSourceId; status?: string; limit?: number } = {},
    baseUrl = API_URL,
  ): Promise<AlWafiyatListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.provider) query.set("provider", params.provider);
    if (params.status) query.set("status", params.status);
    if (typeof params.limit === "number") query.set("limit", String(params.limit));

    const suffix = query.toString();
    const querySuffix = suffix ? `?${suffix}` : "";
    const res = await authFetch(`${baseUrl}/api/admin/al-wafiyat${querySuffix}`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل إدارة الوفيات الرسمية"));
    }

    return (await res.json()) as AlWafiyatListResponse;
  },

  async listAlWafiyatSourcesHealth(baseUrl = API_URL): Promise<AlWafiyatHealthRecord[]> {
    const res = await authFetch(`${baseUrl}/api/al-wafiyat/sources/health`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر فحص المصادر الرسمية للوفيات"));
    }

    const data = (await res.json()) as { sources?: AlWafiyatHealthRecord[] };
    return Array.isArray(data.sources) ? data.sources : [];
  },

  async importAlWafiyatSource(
    sourceId: AlWafiyatSourceId,
    payload: AlWafiyatImportRequest = {},
    baseUrl = API_URL,
  ): Promise<AlWafiyatImportResponse> {
    const res = await authFetch(`${baseUrl}/api/al-wafiyat/import/${encodeURIComponent(sourceId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر استيراد بيانات الوفيات الرسمية"));
    }

    return (await res.json()) as AlWafiyatImportResponse;
  },

  async approveAlWafiyatNotice(
    id: string,
    action: AlWafiyatApprovalAction,
    baseUrl = API_URL,
  ): Promise<AlWafiyatNotice> {
    const res = await authFetch(`${baseUrl}/api/al-wafiyat/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحديث حالة إشعار الوفاة"));
    }

    const data = (await res.json()) as { item: AlWafiyatNotice };
    return data.item;
  },

  async pushHistory(msg: ChatMessage, baseUrl = API_URL, options?: ChatHistoryOptions) {
    const sessionId = resolveClientHistorySessionId(options);
    const historyMessage = sessionId
      ? {
          ...msg,
          meta: {
            ...(msg.meta ?? undefined),
            sessionId,
          },
        }
      : msg;

    try {
      const res = await authFetch(`${baseUrl}/api/history`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(historyMessage),
      });
      if (!res.ok) throw new Error("history push failed");
      return true;
    } catch {
      // Non-critical — never let history failure break the chat flow
      return false;
    }
  },

  async getHistory(baseUrl = API_URL, options?: ChatHistoryOptions): Promise<ChatMessage[]> {
    const params = new URLSearchParams({ limit: "200" });
    const sessionId = resolveClientHistorySessionId(options);
    if (sessionId) {
      params.set("sessionId", sessionId);
    }

    try {
      const res = await authFetch(`${baseUrl}/api/history?${params.toString()}`);
      if (!res.ok) throw new Error("history fetch failed");
      const data = (await res.json()) as { items: ChatMessage[] };
      return data.items || [];
    } catch {
      return [];
    }
  },

  async toggleBookmark(tx_no: number) {
    await delay(80);
    if (mockBookmarks.includes(tx_no)) {
      mockBookmarks = mockBookmarks.filter((item) => item !== tx_no);
    } else {
      mockBookmarks = [tx_no, ...mockBookmarks];
    }
    return mockBookmarks;
  },

  async getBookmarks(): Promise<number[]> {
    await delay(60);
    return mockBookmarks;
  },

  async getCases(baseUrl = API_URL): Promise<CaseItem[]> {
    const res = await authFetch(`${baseUrl}/api/cases`);
    if (!res.ok) throw new Error("cases fetch failed");
    const data = (await res.json()) as { cases: CaseItem[] };
    return data.cases || [];
  },

  async createCase(
    data: Omit<CaseItem, "id" | "createdAt" | "updatedAt">,
    baseUrl = API_URL
  ): Promise<CaseItem> {
    const res = await authFetch(`${baseUrl}/api/cases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("case create failed");
    return (await res.json()) as CaseItem;
  },

  async updateCase(id: string, patch: Partial<CaseItem>, baseUrl = API_URL): Promise<CaseItem> {
    const res = await authFetch(`${baseUrl}/api/cases/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("case update failed");
    return (await res.json()) as CaseItem;
  },

  // create a flagged chat session for human intervention
  async createChatSession(
    data: { messages: ChatMessage[]; note?: string },
    baseUrl = API_URL
  ): Promise<ChatSession> {
    const res = await authFetch(`${baseUrl}/api/chat-sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("chat session create failed");
    return (await res.json()) as ChatSession;
  },

  async getChatSessions(baseUrl = API_URL): Promise<ChatSession[]> {
    const res = await authFetch(`${baseUrl}/api/chat-sessions`);
    if (!res.ok) throw new Error("chat sessions fetch failed");
    const data = (await res.json()) as { sessions: ChatSession[] };
    return data.sessions || [];
  },

  async getChatSession(id: string, baseUrl = API_URL): Promise<ChatSession> {
    const res = await authFetch(`${baseUrl}/api/chat-sessions/${id}`);
    if (!res.ok) throw new Error("chat session fetch failed");
    return (await res.json()) as ChatSession;
  },

  async updateChatSession(
    id: string,
    patch: Partial<ChatSession>,
    baseUrl = API_URL
  ): Promise<ChatSession> {
    const res = await authFetch(`${baseUrl}/api/chat-sessions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("chat session update failed");
    return (await res.json()) as ChatSession;
  },

  async feedback(payload: { kind: "bad_answer" | "good_answer" | "mapping_issue"; details?: string }) {
    await delay(80);
    return { ok: true, payload };
  },

  async getDocuments(baseUrl = API_URL): Promise<DocumentItem[]> {
    try {
      const res = await authFetch(`${baseUrl}/api/documents`);
      if (!res.ok) throw new Error("documents fetch failed");
      const data = (await res.json()) as { items: DocumentItem[] };
      return data.items || [];
    } catch {
      await delay(100);
      return mockDocuments;
    }
  },

  async getUsefulLinks(query = "", baseUrl = API_URL): Promise<UsefulLink[]> {
    const trimmed = String(query || "").trim();
    const res = await fetch(`${baseUrl}/api/useful-links?limit=100&q=${encodeURIComponent(trimmed)}`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذّر تحميل الروابط المفيدة"));
    }
    const data = (await res.json()) as { items?: UsefulLink[] };
    return Array.isArray(data.items) ? data.items : [];
  },

  async addDocument(payload: Omit<DocumentItem, "id" | "updatedAt">, baseUrl = API_URL): Promise<DocumentItem> {
    try {
      const res = await authFetch(`${baseUrl}/api/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("documents create failed");
      const data = (await res.json()) as DocumentItem;
      return data;
    } catch {
      await delay(80);
      const next: DocumentItem = { ...payload, id: uid("doc"), updatedAt: Date.now() };
      mockDocuments = [next, ...mockDocuments];
      return next;
    }
  },

  async updateDocument(id: string, patch: Partial<DocumentItem>, baseUrl = API_URL): Promise<DocumentItem> {
    try {
      const res = await authFetch(`${baseUrl}/api/documents/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("documents update failed");
      const data = (await res.json()) as DocumentItem;
      return data;
    } catch {
      await delay(60);
      const updated = { ...(mockDocuments.find((doc) => doc.id === id) as DocumentItem), ...patch };
      mockDocuments = mockDocuments.map((doc) => (doc.id === id ? updated : doc));
      return updated;
    }
  },

  async getNotifications(baseUrl = API_URL): Promise<NotificationItem[]> {
    if (!isLoggedIn() && !DEV_SUPERADMIN_REQUEST) {
      return [];
    }

    let res: Response;
    try {
      res = await authFetch(`${baseUrl}/api/notifications`);
    } catch {
      await delay(80);
      return mockNotifications;
    }

    if (!res.ok) throw new Error(await readApiError(res, "تعذّر تحميل سجل الإشعارات."));
    const data = (await res.json()) as { items: NotificationItem[] };
    return data.items || [];
  },

  async markNotification(id: string, read: boolean, baseUrl = API_URL): Promise<NotificationItem> {
    let res: Response;
    try {
      res = await authFetch(`${baseUrl}/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ read }),
      });
    } catch {
      await delay(60);
      const updated = { ...(mockNotifications.find((item) => item.id === id) as NotificationItem), read };
      mockNotifications = mockNotifications.map((item) => (item.id === id ? updated : item));
      return updated;
    }

    if (!res.ok) throw new Error("notifications update failed");
    return (await res.json()) as NotificationItem;
  },

  async clearNotifications(baseUrl = API_URL): Promise<NotificationItem[]> {
    let res: Response;
    try {
      res = await authFetch(`${baseUrl}/api/notifications/clear`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      await delay(60);
      mockNotifications = mockNotifications.map((item) => ({ ...item, read: true }));
      return mockNotifications;
    }

    if (!res.ok) throw new Error("notifications clear failed");
    const data = (await res.json()) as { items: NotificationItem[] };
    return data.items || [];
  },

  async getNotificationSettings(baseUrl = API_URL): Promise<NotificationSettings> {
    try {
      const res = await authFetch(`${baseUrl}/api/notifications/preferences`);
      if (!res.ok) throw new Error("notification settings fetch failed");
      return (await res.json()) as NotificationSettings;
    } catch {
      await delay(60);
      return cloneNotificationSettings(mockNotificationSettings);
    }
  },

  async getNotificationPushPublicConfig(baseUrl = API_URL): Promise<NotificationPushPublicConfig> {
    const res = await authFetch(`${baseUrl}/api/notifications/push/public-key`);
    if (!res.ok) throw new Error("notification push public key failed");
    return (await res.json()) as NotificationPushPublicConfig;
  },

  async updateNotificationPreferences(input: {
    replyEnabled?: boolean;
    mentionEnabled?: boolean;
    pushEnabled?: boolean;
    previewMode?: NotificationPreviewMode;
    quietHoursEnabled?: boolean;
    timezone?: string;
  }, baseUrl = API_URL): Promise<NotificationSettings> {
    try {
      const res = await authFetch(`${baseUrl}/api/notifications/preferences`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("notification settings update failed");
      return (await res.json()) as NotificationSettings;
    } catch {
      await delay(60);
      mockNotificationSettings = {
        ...mockNotificationSettings,
        preference: {
          ...mockNotificationSettings.preference,
          replyEnabled: input.replyEnabled ?? mockNotificationSettings.preference.replyEnabled,
          mentionEnabled: input.mentionEnabled ?? mockNotificationSettings.preference.mentionEnabled,
          pushEnabled: input.pushEnabled ?? mockNotificationSettings.preference.pushEnabled,
          previewMode: input.previewMode ?? mockNotificationSettings.preference.previewMode,
          quietHours: {
            ...mockNotificationSettings.preference.quietHours,
            enabled: input.quietHoursEnabled ?? mockNotificationSettings.preference.quietHours.enabled,
            timezone: input.timezone ?? mockNotificationSettings.preference.quietHours.timezone,
          },
          updatedAt: Date.now(),
        },
      };
      return cloneNotificationSettings(mockNotificationSettings);
    }
  },

  async registerNotificationPushSubscription(input: {
    label?: string;
    subscription: NotificationPushSubscription;
  }, baseUrl = API_URL): Promise<NotificationSettings> {
    const res = await authFetch(`${baseUrl}/api/notifications/push/subscriptions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("notification push subscription failed");
    return (await res.json()) as NotificationSettings;
  },

  async removeNotificationPushSubscription(deviceId: string, baseUrl = API_URL): Promise<NotificationSettings> {
    const res = await authFetch(`${baseUrl}/api/notifications/push/subscriptions/${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("notification push subscription remove failed");
    return (await res.json()) as NotificationSettings;
  },

  async muteNotificationRoom(roomId: string, duration: NotificationRoomMuteDuration, baseUrl = API_URL): Promise<NotificationSettings> {
    try {
      const res = await authFetch(`${baseUrl}/api/notifications/rooms/${encodeURIComponent(roomId)}/mute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ duration }),
      });
      if (!res.ok) throw new Error("notification room mute failed");
      return (await res.json()) as NotificationSettings;
    } catch {
      await delay(60);
      const now = Date.now();
      let mutedUntil: string | undefined;
      if (duration === "8h") {
        mutedUntil = new Date(now + (8 * 60 * 60 * 1000)).toISOString();
      } else if (duration === "1w") {
        mutedUntil = new Date(now + (7 * 24 * 60 * 60 * 1000)).toISOString();
      }
      mockNotificationSettings = {
        ...mockNotificationSettings,
        roomMutes: [
          {
            roomId,
            mutedUntil,
            isIndefinite: duration === "indefinite",
            updatedAt: now,
          },
          ...mockNotificationSettings.roomMutes.filter((mute) => mute.roomId !== roomId),
        ],
      };
      return cloneNotificationSettings(mockNotificationSettings);
    }
  },

  async unmuteNotificationRoom(roomId: string, baseUrl = API_URL): Promise<NotificationSettings> {
    try {
      const res = await authFetch(`${baseUrl}/api/notifications/rooms/${encodeURIComponent(roomId)}/mute`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("notification room unmute failed");
      return (await res.json()) as NotificationSettings;
    } catch {
      await delay(60);
      mockNotificationSettings = {
        ...mockNotificationSettings,
        roomMutes: mockNotificationSettings.roomMutes.filter((mute) => mute.roomId !== roomId),
      };
      return cloneNotificationSettings(mockNotificationSettings);
    }
  },

  async registerNotificationDevice(input: {
    provider?: NotificationPushProvider;
    endpoint: string;
    label?: string;
  }, baseUrl = API_URL): Promise<NotificationSettings> {
    try {
      const res = await authFetch(`${baseUrl}/api/notifications/devices`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("notification device register failed");
      return (await res.json()) as NotificationSettings;
    } catch {
      await delay(60);
      const existingDevice = mockNotificationSettings.devices.find((device) => device.endpoint === input.endpoint);
      const now = Date.now();
      const nextDevice = existingDevice
        ? {
            ...existingDevice,
            provider: input.provider ?? existingDevice.provider,
            label: input.label ?? existingDevice.label,
            updatedAt: now,
          }
        : {
            id: uid(),
            provider: input.provider ?? "mock",
            endpoint: input.endpoint,
            label: input.label,
            lastDeliveryStatus: "idle" as const,
            retryCount: 0,
            createdAt: now,
            updatedAt: now,
          };
      mockNotificationSettings = {
        ...mockNotificationSettings,
        devices: [
          nextDevice,
          ...mockNotificationSettings.devices.filter((device) => device.endpoint !== input.endpoint),
        ],
      };
      return cloneNotificationSettings(mockNotificationSettings);
    }
  },

  async removeNotificationDevice(deviceId: string, baseUrl = API_URL): Promise<NotificationSettings> {
    try {
      const res = await authFetch(`${baseUrl}/api/notifications/devices/${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("notification device remove failed");
      return (await res.json()) as NotificationSettings;
    } catch {
      await delay(60);
      mockNotificationSettings = {
        ...mockNotificationSettings,
        devices: mockNotificationSettings.devices.filter((device) => device.id !== deviceId),
      };
      return cloneNotificationSettings(mockNotificationSettings);
    }
  },

  async getSavedChats(baseUrl = API_URL): Promise<SavedChatItem[]> {
    try {
      const res = await authFetch(`${baseUrl}/api/saved`);
      if (!res.ok) throw new Error("saved fetch failed");
      const data = (await res.json()) as { items: SavedChatItem[] };
      return data.items || [];
    } catch {
      await delay(80);
      return mockSaved;
    }
  },

  async saveChat(text: string, baseUrl = API_URL): Promise<SavedChatItem> {
    try {
      const res = await authFetch(`${baseUrl}/api/saved`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("saved create failed");
      return (await res.json()) as SavedChatItem;
    } catch {
      await delay(60);
      const now = Date.now();
      const item: SavedChatItem = {
        id: uid("saved"),
        text,
        ts: now,
        status: "active",
        updatedAt: now,
      };
      mockSaved = [item, ...mockSaved];
      return item;
    }
  },

  async updateSavedChat(id: string, patch: { status: SavedChatItem["status"] }, baseUrl = API_URL): Promise<SavedChatItem> {
    try {
      const res = await authFetch(`${baseUrl}/api/saved/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("saved update failed");
      return (await res.json()) as SavedChatItem;
    } catch {
      await delay(60);
      const now = Date.now();
      const next = mockSaved.find((item) => item.id === id);
      if (!next) throw new Error("saved chat not found");

      const updated: SavedChatItem = {
        ...next,
        status: patch.status,
        updatedAt: now,
        closedAt: patch.status === "closed" ? (next.closedAt ?? now) : undefined,
        archivedAt: patch.status === "archived" ? (next.archivedAt ?? now) : undefined,
        deletedForMeAt: patch.status === "deleted_for_me" ? (next.deletedForMeAt ?? now) : undefined,
      };

      if (patch.status === "active") {
        updated.closedAt = undefined;
        updated.archivedAt = undefined;
        updated.deletedForMeAt = undefined;
      }

      mockSaved = mockSaved.map((item) => (item.id === id ? updated : item));
      return updated;
    }
  },

  async removeSavedChat(id: string, baseUrl = API_URL): Promise<void> {
    try {
      const res = await authFetch(`${baseUrl}/api/saved/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("saved delete failed");
    } catch {
      mockSaved = mockSaved.filter((item) => item.id !== id);
    }
  },

  async searchJobs(query: string, baseUrl = API_URL): Promise<JobVacancy[]> {
    const trimmed = (query || "").trim();
    try {
      const res = await fetch(`${baseUrl}/api/v2/jobs?q=${encodeURIComponent(trimmed)}&limit=30&offset=0`);
      if (!res.ok) throw new Error("jobs v2 search failed");
      const data = (await res.json()) as {
        results?: Array<{
          id: string;
          title_ar: string;
          company_name: string;
          location_city?: string;
          published_at: string;
          tags?: string[];
        }>;
      };
      return (data.results || []).map((entry) => ({
        id: entry.id,
        title: entry.title_ar,
        company: entry.company_name,
        location: entry.location_city || "غير محدد",
        mode: "onsite",
        postedAt: entry.published_at,
        summary: "",
        tags: entry.tags || [],
      }));
    } catch {
      const res = await fetch(`${baseUrl}/api/plugins/jobs?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error("jobs search failed");
      const data = (await res.json()) as { results: JobVacancy[] };
      return data.results || [];
    }
  },

  async applyJob(
    payload: { jobId: string; name: string; phone: string; email?: string; note?: string },
    baseUrl = API_URL
  ): Promise<JobApplication> {
    try {
      const res = await fetch(`${baseUrl}/api/v2/jobs/${encodeURIComponent(payload.jobId)}/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          cover_letter: payload.note,
        }),
      });
      if (!res.ok) throw new Error("job v2 apply failed");
      const data = (await res.json()) as {
        application?: {
          id: string;
          job_id: string;
          veteran_name: string;
          phone: string;
          email?: string;
          cover_letter?: string;
          applied_at: string;
        };
      };
      if (!data.application) throw new Error("job v2 apply invalid response");
      return {
        id: data.application.id,
        jobId: data.application.job_id,
        name: data.application.veteran_name,
        phone: data.application.phone,
        email: data.application.email,
        note: data.application.cover_letter,
        createdAt: Date.parse(data.application.applied_at) || Date.now(),
      };
    } catch {
      const res = await fetch(`${baseUrl}/api/plugins/jobs/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("job apply failed");
      const data = (await res.json()) as { application: JobApplication };
      return data.application;
    }
  },

  async createJobPosting(
    payload: {
      employerId: string;
      title: string;
      description: string;
      categoryId: number;
      locationCity?: string;
      jobType?: "full_time" | "part_time" | "contract" | "freelance";
    },
    baseUrl = API_URL,
  ): Promise<ManagedJobPosting> {
    const res = await fetch(`${baseUrl}/api/v2/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        employer_id: payload.employerId,
        title_ar: payload.title,
        description_ar: payload.description,
        category_id: payload.categoryId,
        location_city: payload.locationCity,
        job_type: payload.jobType || "full_time",
      }),
    });
    if (!res.ok) throw new Error("job create failed");
    const data = (await res.json()) as {
      job?: {
        id: string;
        employer_id: string;
        title_ar: string;
        status: ManagedJobPosting["status"];
        applications_count?: number;
        created_at: string;
      };
    };
    if (!data.job) throw new Error("job create invalid response");
    return {
      id: data.job.id,
      employerId: data.job.employer_id,
      title: data.job.title_ar,
      status: data.job.status,
      applicationsCount: data.job.applications_count || 0,
      createdAt: data.job.created_at,
    };
  },

  async listMyJobPostings(employerId: string, baseUrl = API_URL): Promise<ManagedJobPosting[]> {
    const id = (employerId || "").trim();
    if (!id) return [];
    const res = await fetch(`${baseUrl}/api/v2/jobs/my/postings?employer_id=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("job postings fetch failed");
    const data = (await res.json()) as {
      postings?: Array<{
        id: string;
        employer_id: string;
        title_ar: string;
        status: ManagedJobPosting["status"];
        applications_count?: number;
        created_at: string;
      }>;
    };
    return (data.postings || []).map((entry) => ({
      id: entry.id,
      employerId: entry.employer_id,
      title: entry.title_ar,
      status: entry.status,
      applicationsCount: entry.applications_count || 0,
      createdAt: entry.created_at,
    }));
  },

  async updateJobPostingStatus(
    jobId: string,
    payload: { employerId: string; status: ManagedJobPosting["status"] },
    baseUrl = API_URL,
  ): Promise<ManagedJobPosting> {
    const res = await fetch(`${baseUrl}/api/v2/jobs/${encodeURIComponent(jobId)}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor_employer_id: payload.employerId,
        status: payload.status,
      }),
    });
    if (!res.ok) throw new Error("job status update failed");
    const data = (await res.json()) as {
      job?: {
        id: string;
        employer_id: string;
        title_ar: string;
        status: ManagedJobPosting["status"];
        applications_count?: number;
        created_at: string;
      };
    };
    if (!data.job) throw new Error("job status update invalid response");
    return {
      id: data.job.id,
      employerId: data.job.employer_id,
      title: data.job.title_ar,
      status: data.job.status,
      applicationsCount: data.job.applications_count || 0,
      createdAt: data.job.created_at,
    };
  },

  async listMarketplace(baseUrl = API_URL): Promise<MarketplaceListing[]> {
    const res = isLoggedIn()
      ? await authFetch(`${baseUrl}/api/market/listings`)
      : await fetch(`${baseUrl}/api/market/listings`, { credentials: "include" });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace fetch failed"));
    const data = (await res.json()) as { listings?: MarketplaceListing[] };
    return data.listings || [];
  },

  async getMarketplaceListing(id: string, baseUrl = API_URL): Promise<MarketplaceListing> {
    const res = isLoggedIn()
      ? await authFetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}`)
      : await fetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}`, { credentials: "include" });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace detail fetch failed"));
    const data = (await res.json()) as { listing?: MarketplaceListing };
    if (!data.listing) throw new Error("marketplace detail invalid response");
    return data.listing;
  },

  async listMarketCategories(baseUrl = API_URL): Promise<Array<{ id: string; labelAr: string; labelEn?: string; icon?: string; enabled?: boolean; sortOrder?: number }>> {
    const res = await fetch(`${baseUrl}/api/market/categories`);
    if (!res.ok) throw new Error(await readApiError(res, "market categories fetch failed"));
    const data = (await res.json()) as { categories?: Array<{ id: string; labelAr: string; labelEn?: string; icon?: string; enabled?: boolean; sortOrder?: number }> };
    return data.categories || [];
  },

  async getMarketplaceSellerProfile(ownerId: string, baseUrl = API_URL): Promise<{
    seller: { id: string; label: string; trustStatus: string; featuredVeteranSeller?: boolean; verifiedByWatany?: boolean; listingCount: number };
    listings: MarketplaceListing[];
  }> {
    const res = isLoggedIn()
      ? await authFetch(`${baseUrl}/api/market/sellers/${encodeURIComponent(ownerId)}`)
      : await fetch(`${baseUrl}/api/market/sellers/${encodeURIComponent(ownerId)}`, { credentials: "include" });
    if (!res.ok) throw new Error(await readApiError(res, "market seller profile fetch failed"));
    return (await res.json()) as {
      seller: { id: string; label: string; trustStatus: string; featuredVeteranSeller?: boolean; verifiedByWatany?: boolean; listingCount: number };
      listings: MarketplaceListing[];
    };
  },

  async createListing(
    payload: {
      title: string;
      price: number | string;
      currency?: string;
      location: string;
      seller: string;
      contact: string;
      description?: string;
      category?: string;
      listingType?: MarketplaceListing["listingType"];
      contactPreference?: MarketplaceListing["contactPreference"];
      locationLabel?: string;
      mohafaza?: string;
      caza?: string;
      village?: string;
      exactAddress?: string;
      sellerEmail?: string;
      sellerWhatsapp?: string;
      images?: Array<{ url: string; filename?: string; mimeType?: string; size?: number }>;
    },
    baseUrl = API_URL
  ): Promise<MarketplaceListing> {
    const res = await authFetch(`${baseUrl}/api/market/listings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace create failed"));
    const data = (await res.json()) as { listing?: MarketplaceListing };
    if (!data.listing) throw new Error("marketplace create invalid response");
    return data.listing;
  },

  async sendMarketplaceInterest(id: string, baseUrl = API_URL): Promise<boolean> {
    const res = await authFetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}/favorite`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(await readApiError(res, "favorite failed"));
    return true;
  },

  async listMyMarketplaceListings(_contact: string, baseUrl = API_URL): Promise<MarketplaceListing[]> {
    const res = await authFetch(`${baseUrl}/api/market/my/listings`);
    if (!res.ok) throw new Error(await readApiError(res, "my marketplace fetch failed"));
    const data = (await res.json()) as { listings?: MarketplaceListing[] };
    return data.listings || [];
  },

  async listMyFavoriteMarketplaceListings(baseUrl = API_URL): Promise<MarketplaceListing[]> {
    const res = await authFetch(`${baseUrl}/api/market/my/favorites`);
    if (!res.ok) throw new Error(await readApiError(res, "my marketplace favorites fetch failed"));
    const data = (await res.json()) as { listings?: MarketplaceListing[] };
    return data.listings || [];
  },

  async updateMarketplaceListing(
    id: string,
    payload: {
      actorContact?: string;
      price?: number | string;
      description?: string;
      title?: string;
      location?: string;
      locationLabel?: string;
      categoryId?: string;
      category?: string;
      listingType?: MarketplaceListing["listingType"];
      contactPreference?: MarketplaceListing["contactPreference"];
      mohafaza?: string;
      caza?: string;
      village?: string;
      exactAddress?: string;
      seller?: string;
      contact?: string;
      sellerEmail?: string;
      sellerWhatsapp?: string;
    },
    baseUrl = API_URL,
  ): Promise<MarketplaceListing> {
    const res = await authFetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        price: payload.price,
        description: payload.description,
        title: payload.title,
        location: payload.location,
        locationLabel: payload.locationLabel,
        categoryId: payload.categoryId || payload.category,
        listingType: payload.listingType,
        contactPreference: payload.contactPreference,
        mohafaza: payload.mohafaza,
        caza: payload.caza,
        village: payload.village,
        exactAddress: payload.exactAddress,
        seller: payload.seller,
        contact: payload.contact,
        sellerEmail: payload.sellerEmail,
        sellerWhatsapp: payload.sellerWhatsapp,
      }),
    });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace update failed"));
    const data = (await res.json()) as { listing?: MarketplaceListing };
    if (!data.listing) throw new Error("marketplace update invalid response");
    return data.listing;
  },

  async closeMarketplaceListing(id: string, _actorContact: string, baseUrl = API_URL): Promise<MarketplaceListing> {
    const res = await authFetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}/sold`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace close failed"));
    const data = (await res.json()) as { listing?: MarketplaceListing };
    if (!data.listing) throw new Error("marketplace close invalid response");
    return data.listing;
  },

  async reserveMarketplaceListing(id: string, baseUrl = API_URL): Promise<MarketplaceListing> {
    const res = await authFetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}/reserve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace reserve failed"));
    const data = (await res.json()) as { listing?: MarketplaceListing };
    if (!data.listing) throw new Error("marketplace reserve invalid response");
    return data.listing;
  },

  async hideMarketplaceListing(id: string, baseUrl = API_URL): Promise<MarketplaceListing> {
    const res = await authFetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}/hide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace hide failed"));
    const data = (await res.json()) as { listing?: MarketplaceListing };
    if (!data.listing) throw new Error("marketplace hide invalid response");
    return data.listing;
  },

  async archiveMarketplaceListing(id: string, baseUrl = API_URL): Promise<MarketplaceListing> {
    const res = await authFetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}/archive`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace archive failed"));
    const data = (await res.json()) as { listing?: MarketplaceListing };
    if (!data.listing) throw new Error("marketplace archive invalid response");
    return data.listing;
  },

  async renewMarketplaceListing(id: string, baseUrl = API_URL): Promise<MarketplaceListing> {
    const res = await authFetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}/renew`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace renew failed"));
    const data = (await res.json()) as { listing?: MarketplaceListing };
    if (!data.listing) throw new Error("marketplace renew invalid response");
    return data.listing;
  },

  async unfavoriteMarketplaceListing(id: string, baseUrl = API_URL): Promise<boolean> {
    const res = await authFetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}/favorite`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace unfavorite failed"));
    return true;
  },

  async reportMarketplaceListing(id: string, payload: { reason: string; note?: string }, baseUrl = API_URL): Promise<boolean> {
    const res = await authFetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace report failed"));
    return true;
  },

  async uploadMarketplaceImage(payload: { filename?: string; mimeType: string; dataUrl: string }, baseUrl = API_URL): Promise<{ url: string; filename: string; mimeType: string; size: number }> {
    const res = await fetch(`${baseUrl}/api/files/upload`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace image upload failed"));
    const data = (await res.json()) as { file?: { url: string; filename: string; mimeType: string; size: number } };
    if (!data.file) throw new Error("marketplace image upload invalid response");
    return data.file;
  },

  async attachMarketplaceImages(id: string, images: Array<{ url: string; filename?: string; mimeType?: string; size?: number }>, baseUrl = API_URL): Promise<MarketplaceListing> {
    const res = await authFetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}/images`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ images }),
    });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace attach images failed"));
    const data = (await res.json()) as { listing?: MarketplaceListing };
    if (!data.listing) throw new Error("marketplace attach images invalid response");
    return data.listing;
  },

  async removeMarketplaceImage(id: string, imageId: string, baseUrl = API_URL): Promise<MarketplaceListing> {
    const res = await authFetch(`${baseUrl}/api/market/listings/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await readApiError(res, "marketplace remove image failed"));
    const data = (await res.json()) as { listing?: MarketplaceListing };
    if (!data.listing) throw new Error("marketplace remove image invalid response");
    return data.listing;
  },

  async getEmergencyAlerts(query: string, baseUrl = API_URL): Promise<EmergencyAlert[]> {
    try {
      const res = await fetch(`${baseUrl}/api/plugins/emergency?q=${encodeURIComponent(query || "")}`);
      if (!res.ok) throw new Error(`alerts fetch failed with HTTP ${res.status}`);
      const data = (await res.json()) as { alerts: EmergencyAlert[] };
      return data.alerts || [];
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "alerts fetch failed";
      if (/HTTP 404/i.test(message) || /Unexpected token </i.test(message) || /not valid JSON/i.test(message)) {
        return filterEmergencyAlertsByQuery(mockEmergencyAlerts, query);
      }

      throw error_;
    }
  },

  async getNews(baseUrl = API_URL, category?: string): Promise<NewsItem[]> {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const candidateBases = Array.from(
      new Set([
        baseUrl,
        globalThis.location?.origin,
        ...getCandidateApiBaseUrls(),
      ].filter((candidate): candidate is string => Boolean(candidate))),
    );

    let lastError: unknown = null;

    for (const candidateBase of candidateBases) {
      try {
        const res = await fetch(`${candidateBase}/api/news${qs}`, {
          headers: { Accept: "application/json" },
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`news fetch failed (${res.status})`);
        }

        const raw = await res.text();
        if (!raw.trim()) {
          throw new Error("news fetch returned empty body");
        }

        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
          throw new TypeError("news fetch returned invalid payload");
        }

        return parsed as NewsItem[];
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("news fetch failed");
  },

  async getFakeNews(baseUrl = API_URL, status?: string): Promise<FakeNewsItem[]> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const candidateBases = Array.from(
      new Set([
        baseUrl,
        globalThis.location?.origin,
        ...getCandidateApiBaseUrls(),
      ].filter((candidate): candidate is string => Boolean(candidate))),
    );

    let lastError: unknown = null;

    for (const candidateBase of candidateBases) {
      try {
        const res = await fetch(`${candidateBase}/api/fake-news${qs}`, {
          headers: { Accept: "application/json" },
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`fake news fetch failed (${res.status})`);
        }

        const raw = await res.text();
        if (!raw.trim()) {
          throw new Error("fake news fetch returned empty body");
        }

        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
          throw new TypeError("fake news fetch returned invalid payload");
        }

        return parsed as FakeNewsItem[];
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("fake news fetch failed");
  },

  /* ── KB v2 API methods ──────────────────────────────────── */

  async chatV2(
    question: string,
    context?: Record<string, unknown>,
    baseUrl = API_URL,
  ): Promise<ChatV2Response> {
    const normalizedQuestion = normalizeSearchableArabicInput(question);
    const pythonResponse = await tryPythonChatV2(normalizedQuestion, context, baseUrl);
    if (pythonResponse) {
      return pythonResponse;
    }

    const res2 = await authFetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: normalizedQuestion, context, sessionId: getClientChatSessionId() }),
    });
    if (!res2.ok) throw new Error("chat failed");
    return mapGatewayChatResponse(await res2.json());
  },

  async chatV2Stream(
    question: string,
    handlers?: ChatStreamHandlers,
    baseUrl = API_URL,
  ): Promise<ChatV2Response> {
    return readGatewayChatStream(normalizeSearchableArabicInput(question), handlers, baseUrl);
  },

  async searchV2(
    q: string,
    limit = 10,
    domain?: string,
    baseUrl = API_URL,
  ): Promise<SearchV2Response> {
    const normalizedQuery = normalizeSearchableArabicInput(q);
    const params = new URLSearchParams({ q: normalizedQuery, limit: String(limit) });
    if (domain) params.set("domain", domain);
    const res = await authFetch(`${baseUrl}/api/v2/search?${params}`, { method: "GET" });
    if (!res.ok) throw new Error("v2 search failed");
    return (await res.json()) as SearchV2Response;
  },

  /** Local legal content — served from law_nodes.jsonl without Python backend */
  async getLegalContent(
    q: string,
    limit = 20,
    domain?: string,
    baseUrl = API_URL,
  ): Promise<SearchV2Response> {
    const params = new URLSearchParams({ q, limit: String(limit) });
    if (domain) params.set("domain", domain);
    const res = await fetch(`${baseUrl}/api/legal/content?${params}`, { method: "GET" });
    if (!res.ok) throw new Error("legal content unavailable");
    return (await res.json()) as SearchV2Response;
  },

  async getLegalLawArticles(
    lawId: string,
    baseUrl = API_URL,
  ): Promise<LegalLawArticlesResponse> {
    const res = await fetch(`${baseUrl}/api/legal/content/${encodeURIComponent(lawId)}/articles`, { method: "GET" });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل مواد هذا القانون حالياً."));
    }
    return (await res.json()) as LegalLawArticlesResponse;
  },

  async salaryComputeV2(
    params: {
      rank: string;
      degree: string;
      category: string;
      service_years: number;
      spouse?: boolean;
      children?: number;
      medals?: string[];
    },
    baseUrl = API_URL,
  ): Promise<SalaryComputeV2Response> {
    const res = await authFetch(`${baseUrl}/api/v2/salary/compute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error("v2 salary compute failed");
    return (await res.json()) as SalaryComputeV2Response;
  },

  async feedbackV2(
    payload: {
      user_message: string;
      bot_response: string;
      rating: number;
      comment?: string;
      intent?: string;
      domain?: string;
    },
    baseUrl = API_URL,
  ): Promise<{ status: string; feedback_id: string }> {
    const res = await authFetch(`${baseUrl}/api/v2/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("v2 feedback failed");
    return (await res.json()) as { status: string; feedback_id: string };
  },

  async createTicketV2(
    payload: {
      title_lb: string;
      description?: string;
      category?: string;
      intent?: string;
      domain?: string;
      priority?: string;
    },
    baseUrl = API_URL,
  ): Promise<TicketV2> {
    const res = await authFetch(`${baseUrl}/api/v2/tickets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("v2 ticket create failed");
    return (await res.json()) as TicketV2;
  },

  async listTicketsV2(baseUrl = API_URL): Promise<{ tickets: TicketV2[]; total: number }> {
    const res = await authFetch(`${baseUrl}/api/v2/tickets`, { method: "GET" });
    if (!res.ok) throw new Error("v2 tickets list failed");
    return (await res.json()) as { tickets: TicketV2[]; total: number };
  },

  /* ── Official Forms ──────────────────────────────────────────────── */

  async getFormSources(baseUrl = API_URL): Promise<{ items: FormSourceCard[]; total: number }> {
    if (shouldSkipOptionalDevRequest(baseUrl)) {
      return getFallbackFormSources();
    }

    try {
      const res = await fetch(`${baseUrl}/api/forms/sources`);
      if (!res.ok) throw new Error("form sources fetch failed");
      const data = await res.json();
      return isUsableFormSourcesResponse(data) && data.items.length > 0
        ? data
        : getFallbackFormSources();
    } catch {
      return getFallbackFormSources();
    }
  },

  async getForms(queryOrOptions?: string | FormsQueryOptions, baseUrl = API_URL): Promise<{ items: FormListItem[]; total: number }> {
    const options: FormsQueryOptions = typeof queryOrOptions === "string"
      ? { q: queryOrOptions }
      : (queryOrOptions || {});
    const requestSourceId = normalizeFallbackFormSourceId(options.sourceId);

    try {
      const params = new URLSearchParams();
      if (options.q) params.set("q", options.q);
      if (requestSourceId) params.set("sourceId", requestSourceId);
      if (options.filter) params.set("filter", options.filter);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const url = `${baseUrl}/api/forms${suffix}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("forms fetch failed");
      const data = await res.json();
      if (!isUsableFormsResponse(data)) {
        return getFallbackForms(options);
      }
      if (hasKnownFallbackSource(options.sourceId) && data.items.length === 0) {
        return getFallbackForms(options);
      }
      return data;
    } catch {
      return getFallbackForms(options);
    }
  },

  async getFormById(id: string, baseUrl = API_URL): Promise<FormListItem | null> {
    try {
      const res = await fetch(`${baseUrl}/api/forms/${id}`);
      if (!res.ok) return getFallbackFormById(id);
      const data = await res.json();
      return isUsableFormItem(data) ? data : getFallbackFormById(id);
    } catch {
      return getFallbackFormById(id);
    }
  },

  async getFormGovernanceSummary(baseUrl = API_URL): Promise<FormGovernanceSummary | null> {
    try {
      const res = await fetch(`${baseUrl}/api/forms/governance-summary`);
      if (!res.ok) return null;
      const data = await res.json();
      return isUsableFormGovernanceSummary(data) ? data : null;
    } catch {
      return null;
    }
  },

  async detectFormIntent(text: string, baseUrl = API_URL): Promise<{ matched: FormListItem[]; isGenericFormRequest: boolean }> {
    try {
      const res = await fetch(`${baseUrl}/api/forms/detect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("form detect failed");
      return (await res.json()) as { matched: FormListItem[]; isGenericFormRequest: boolean };
    } catch {
      return { matched: [], isGenericFormRequest: false };
    }
  },

  async getFaqs(query?: string, baseUrl = API_URL): Promise<{
    items: Array<{
      id: string;
      question: string;
      answer: string;
      category?: string;
      procedureId?: string;
      tags?: string[];
      hitsTotal?: number;
      lastAskedAt?: string | null;
    }>;
    total: number;
  }> {
    try {
      const url = query ? `${baseUrl}/api/v2/faq?q=${encodeURIComponent(query)}` : `${baseUrl}/api/v2/faq`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("faq fetch failed");
      return (await res.json()) as {
        items: Array<{
          id: string;
          question: string;
          answer: string;
          category?: string;
          procedureId?: string;
          tags?: string[];
          hitsTotal?: number;
          lastAskedAt?: string | null;
        }>;
        total: number;
      };
    } catch {
      return { items: [], total: 0 };
    }
  },

  async getAdminPaymentsDashboard(baseUrl = API_URL): Promise<AdminPaymentsDashboard> {
    const res = await authFetch(`${baseUrl}/api/admin/payments/dashboard`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل لوحة الدفعات"));
    }
    const data = await res.json() as { dashboard: AdminPaymentsDashboard };
    return data.dashboard;
  },

  async createAdminPaymentsQuestion(
    payload: { text: string; tags: string[] },
    baseUrl = API_URL,
  ): Promise<AdminPaymentsQuestion> {
    const res = await authFetch(`${baseUrl}/api/admin/payments/questions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر حفظ السؤال"));
    }
    const data = await res.json() as { question: AdminPaymentsQuestion };
    return data.question;
  },

  async updateAdminPaymentsQuestion(
    id: string,
    payload: { text?: string; tags?: string[] },
    baseUrl = API_URL,
  ): Promise<AdminPaymentsQuestion> {
    const res = await authFetch(`${baseUrl}/api/admin/payments/questions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحديث السؤال"));
    }
    const data = await res.json() as { question: AdminPaymentsQuestion };
    return data.question;
  },

  async deleteAdminPaymentsQuestion(id: string, baseUrl = API_URL): Promise<void> {
    const res = await authFetch(`${baseUrl}/api/admin/payments/questions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر حذف السؤال"));
    }
  },

  async createAdminPaymentsAnswer(
    payload: { questionId: string; value: string; activateAt?: string | null; expiresAt?: string | null },
    baseUrl = API_URL,
  ): Promise<AdminPaymentsAnswer> {
    const res = await authFetch(`${baseUrl}/api/admin/payments/answers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر حفظ الإجابة"));
    }
    const data = await res.json() as { answer: AdminPaymentsAnswer };
    return data.answer;
  },

  async updateAdminPaymentsAnswer(
    id: string,
    payload: { questionId?: string; value?: string; activateAt?: string | null; expiresAt?: string | null },
    baseUrl = API_URL,
  ): Promise<AdminPaymentsAnswer> {
    const res = await authFetch(`${baseUrl}/api/admin/payments/answers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحديث الإجابة"));
    }
    const data = await res.json() as { answer: AdminPaymentsAnswer };
    return data.answer;
  },

  async deleteAdminPaymentsAnswer(id: string, baseUrl = API_URL): Promise<void> {
    const res = await authFetch(`${baseUrl}/api/admin/payments/answers/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر حذف الإجابة"));
    }
  },

  async createAdminPaymentsAnnouncement(
    payload: { text: string },
    baseUrl = API_URL,
  ): Promise<AdminPaymentsAnnouncement> {
    const res = await authFetch(`${baseUrl}/api/admin/payments/announcements`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر حفظ التنبيه"));
    }
    const data = await res.json() as { announcement: AdminPaymentsAnnouncement };
    return data.announcement;
  },

  async toggleAdminPaymentsAnnouncement(
    id: string,
    enabled: boolean,
    baseUrl = API_URL,
  ): Promise<AdminPaymentsAnnouncement> {
    const res = await authFetch(`${baseUrl}/api/admin/payments/announcements/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحديث حالة التنبيه"));
    }
    const data = await res.json() as { announcement: AdminPaymentsAnnouncement };
    return data.announcement;
  },

  async getAdminRecruitmentAnnouncements(baseUrl = API_URL): Promise<RecruitmentAnnouncement[]> {
    const res = await authFetch(`${baseUrl}/api/admin/recruitment/announcements`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل التعاميم"));
    }
    const data = await res.json() as { announcements: RecruitmentAnnouncement[] };
    return data.announcements;
  },

  async createAdminRecruitmentAnnouncement(
    payload: AdminRecruitmentAnnouncementPayload,
    baseUrl = API_URL,
  ): Promise<RecruitmentAnnouncement> {
    const res = await authFetch(`${baseUrl}/api/admin/recruitment/announcements`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر حفظ إعلان التطويع"));
    }
    const data = await res.json() as { announcement: RecruitmentAnnouncement };
    return data.announcement;
  },

  async updateAdminRecruitmentAnnouncement(
    id: string,
    payload: Partial<AdminRecruitmentAnnouncementPayload>,
    baseUrl = API_URL,
  ): Promise<RecruitmentAnnouncement> {
    const res = await authFetch(`${baseUrl}/api/admin/recruitment/announcements/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحديث إعلان التطويع"));
    }
    const data = await res.json() as { announcement: RecruitmentAnnouncement };
    return data.announcement;
  },

  async deleteAdminRecruitmentAnnouncement(id: string, baseUrl = API_URL): Promise<void> {
    const res = await authFetch(`${baseUrl}/api/admin/recruitment/announcements/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر حذف إعلان التطويع"));
    }
  },

  async searchTaxiDrivers(query: TaxiSearchQueryInput, baseUrl = API_URL): Promise<TaxiDriverView[]> {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.muhafaza) params.set("muhafaza", query.muhafaza);
    if (query.caza) params.set("caza", query.caza);
    if (query.village) params.set("village", query.village);
    const suffix = params.toString();
    let path = baseUrl + "/api/taxi/search";
    if (suffix) {
      path += "?" + suffix;
    }
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل لائحة السائقين"));
    }
    const data = await res.json() as { drivers?: TaxiDriverView[] };
    return data.drivers || [];
  },

  async getNetworkMembership(userId: string, baseUrl = API_URL): Promise<NetworkMembershipProfile | null> {
    const res = await authFetch(`${baseUrl}/api/network/membership?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل حالة عضوية الشبكة"));
    }
    const data = await res.json() as { profile?: NetworkMembershipProfile | null };
    return data.profile ?? null;
  },

  async saveNetworkMembershipDraft(
    payload: {
      userId: string;
      displayName: string;
      visibilityLevel: NetworkVisibilityLevel;
      familyTier: NetworkFamilyTier;
      points: number;
      address?: unknown;
      isVerifiedUser?: boolean;
    },
    baseUrl = API_URL,
  ): Promise<NetworkMembershipProfile> {
    const res = await authFetch(`${baseUrl}/api/network/membership`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر حفظ مسودة عضوية الشبكة"));
    }
    const data = await res.json() as { profile: NetworkMembershipProfile };
    return data.profile;
  },

  async submitNetworkMembership(userId: string, baseUrl = API_URL): Promise<NetworkMembershipProfile> {
    const res = await authFetch(`${baseUrl}/api/network/membership/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر إرسال طلب الانضمام إلى الشبكة"));
    }
    const data = await res.json() as { profile: NetworkMembershipProfile };
    return data.profile;
  },

  async approveNetworkMembership(userId: string, baseUrl = API_URL): Promise<NetworkMembershipProfile> {
    const res = await authFetch(`${baseUrl}/api/network/membership/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر اعتماد العضوية"));
    }
    const data = await res.json() as { profile: NetworkMembershipProfile };
    return data.profile;
  },

  async applyTaxiDriver(payload: TaxiDriverApplicationPayload, baseUrl = API_URL): Promise<TaxiDriverView> {
    const res = await authFetch(`${baseUrl}/api/taxi/driver/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر إرسال طلب الانضمام إلى لائحة السائقين"));
    }
    const data = await res.json() as { driver: TaxiDriverView };
    return data.driver;
  },

  async updateTaxiDriverAvailability(payload: TaxiDriverAvailabilityPayload, baseUrl = API_URL): Promise<TaxiDriverView["currentAvailability"]> {
    const res = await authFetch(`${baseUrl}/api/taxi/driver/availability`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحديث حالة السائق"));
    }
    const data = await res.json() as { availability?: TaxiDriverView["currentAvailability"] };
    return data.availability;
  },

  async createTaxiReservation(payload: TaxiReservationPayload, baseUrl = API_URL): Promise<TaxiReservationView> {
    const res = await authFetch(`${baseUrl}/api/taxi/reservations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر إرسال طلب الحجز"));
    }
    const data = await res.json() as { reservation: TaxiReservationView };
    return data.reservation;
  },

  async getTaxiDriverRatingSummaries(driverIds: string[], baseUrl = API_URL): Promise<TaxiDriverRatingSummary[]> {
    if (!driverIds.length) return [];
    const params = new URLSearchParams();
    params.set("driverIds", Array.from(new Set(driverIds)).join(","));
    const res = await fetch(`${baseUrl}/api/taxi/ratings?${params.toString()}`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل تقييمات السائقين"));
    }
    const data = await res.json() as { ratings?: TaxiDriverRatingSummary[] };
    return data.ratings || [];
  },

  async listTaxiDriverReviews(driverId: string, baseUrl = API_URL): Promise<TaxiDriverReview[]> {
    const res = await fetch(`${baseUrl}/api/taxi/drivers/${encodeURIComponent(driverId)}/reviews`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل مراجعات السائق"));
    }
    const data = await res.json() as { reviews?: TaxiDriverReview[] };
    return data.reviews || [];
  },

  async createTaxiDriverReview(driverId: string, payload: TaxiDriverReviewPayload, baseUrl = API_URL): Promise<{ review: TaxiDriverReview; summary: TaxiDriverRatingSummary }> {
    const res = await authFetch(`${baseUrl}/api/taxi/drivers/${encodeURIComponent(driverId)}/reviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر إرسال التقييم"));
    }
    const data = await res.json() as { review: TaxiDriverReview; summary: TaxiDriverRatingSummary };
    return data;
  },

  async createTaxiComplaint(payload: TaxiComplaintPayload, baseUrl = API_URL): Promise<TaxiComplaintView> {
    const res = await authFetch(`${baseUrl}/api/taxi/complaints`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر إرسال الشكوى"));
    }
    const data = await res.json() as { complaint: TaxiComplaintView };
    return data.complaint;
  },

  async getMyTaxiReservations(userId: string, baseUrl = API_URL): Promise<TaxiReservationView[]> {
    const params = new URLSearchParams();
    if (userId) params.set("user_id", userId);
    const suffix = params.toString();
    let path = baseUrl + "/api/taxi/my/reservations";
    if (suffix) {
      path += "?" + suffix;
    }
    const res = await authFetch(path);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل طلبات التاكسي"));
    }
    const data = await res.json() as { reservations?: TaxiReservationView[] };
    return data.reservations || [];
  },

  async recordTaxiCallEvent(driverId: string, reservationId?: string, callType: "DIRECT_PHONE" | "WHATSAPP" | "IN_APP_REQUEST" = "DIRECT_PHONE", baseUrl = API_URL): Promise<void> {
    const res = await authFetch(`${baseUrl}/api/taxi/call-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ driverId, reservationId, callType }),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تسجيل عملية التواصل مع السائق"));
    }
  },

  async getAdminTaxiDrivers(baseUrl = API_URL): Promise<TaxiAdminDriver[]> {
    const res = await authFetch(`${baseUrl}/api/admin/taxi/drivers`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل لائحة السائقين"));
    }
    const data = await res.json() as { drivers?: TaxiAdminDriver[] };
    return data.drivers || [];
  },

  async updateAdminTaxiDriverStatus(
    id: string,
    status: TaxiAdminDriverStatus,
    baseUrl = API_URL,
  ): Promise<TaxiAdminDriver> {
    const res = await authFetch(`${baseUrl}/api/admin/taxi/drivers/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحديث حالة السائق"));
    }
    const data = await res.json() as { driver: TaxiAdminDriver };
    return data.driver;
  },

  async getAdminTaxiMonitoring(baseUrl = API_URL): Promise<TaxiAdminMonitoring> {
    const res = await authFetch(`${baseUrl}/api/admin/taxi/monitoring`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل مؤشرات التاكسي"));
    }
    const data = await res.json() as { monitoring: TaxiAdminMonitoring };
    return data.monitoring;
  },

  async getAdminTaxiSettings(baseUrl = API_URL): Promise<TaxiAdminSettings> {
    const res = await authFetch(`${baseUrl}/api/admin/taxi/settings`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل إعدادات التاكسي"));
    }
    const data = await res.json() as { settings: TaxiAdminSettings };
    return data.settings;
  },

  async updateAdminTaxiSettings(
    payload: Partial<TaxiAdminSettings>,
    baseUrl = API_URL,
  ): Promise<TaxiAdminSettings> {
    const res = await authFetch(`${baseUrl}/api/admin/taxi/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر حفظ إعدادات التاكسي"));
    }
    const data = await res.json() as { settings: TaxiAdminSettings };
    return data.settings;
  },

  async getRecruitmentAnnouncements(baseUrl = API_URL): Promise<RecruitmentAnnouncement[]> {
    const res = await fetch(`${baseUrl}/api/recruitment/announcements`);
    if (!res.ok) {
      throw new Error(await readApiError(res, "تعذر تحميل التعاميم"));
    }
    const data = await res.json() as { announcements: RecruitmentAnnouncement[] };
    return data.announcements;
  },

  async getFiles(
    query?: string,
    baseUrl = API_URL,
    opts?: { includeArchive?: boolean; procedureId?: string },
  ): Promise<{ items: OfficialFileItem[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (opts?.includeArchive) params.set("includeArchive", "true");
      if (opts?.procedureId) params.set("procedureId", opts.procedureId);
      const url = params.size > 0 ? `${baseUrl}/api/v2/files?${params.toString()}` : `${baseUrl}/api/v2/files`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("files fetch failed");
      return (await res.json()) as { items: OfficialFileItem[]; total: number };
    } catch {
      return { items: [], total: 0 };
    }
  },

  /* ── Ticker / Suggestions ────────────────────────────────────────── */

  async getTicker(baseUrl = API_URL): Promise<{
    items: Array<{
      kind: string;
      title: string;
      body?: string;
      url?: string;
      linkType?: string;
      linkId?: string;
    }>;
  }> {
    try {
      const res = await fetch(`${baseUrl}/api/ticker`);
      if (!res.ok) throw new Error("ticker fetch failed");
      return (await res.json()) as {
        items: Array<{
          kind: string;
          title: string;
          body?: string;
          url?: string;
          linkType?: string;
          linkId?: string;
        }>;
      };
    } catch {
      return { items: [] };
    }
  },

  async getAnnouncements(baseUrl = API_URL): Promise<{ announcements: Array<{ id: string; title: string; body?: string; timestamp?: number; source?: string; url?: string; }> }> {
    try {
      const res = await fetch(`${baseUrl}/announcements`);
      if (!res.ok) throw new Error("announcements fetch failed");
      return (await res.json()) as { announcements: Array<{ id: string; title: string; body?: string; timestamp?: number; source?: string; url?: string; }> };
    } catch {
      return { announcements: [] };
    }
  },
  // admin helpers
  async createTickerItem(item: any, baseUrl = API_URL): Promise<any> {
    const res = await authFetch(`${baseUrl}/api/admin/ticker/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(item),
    });
    return res.json();
  },
  async updateTickerItem(id: string, changes: any, baseUrl = API_URL): Promise<any> {
    const res = await authFetch(`${baseUrl}/api/admin/ticker/items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(changes),
    });
    return res.json();
  },
  async deleteTickerItem(id: string, baseUrl = API_URL): Promise<any> {
    const res = await authFetch(`${baseUrl}/api/admin/ticker/items/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },
  async recomputeFaq(baseUrl = API_URL): Promise<any> {
    const res = await authFetch(`${baseUrl}/api/admin/ticker/recompute-faq`, { method: "POST" });
    return res.json();
  },

  /* ── Procedures Management (SuperAdmin) ────────────────────────────── */

  async getProceduresList(baseUrl = API_URL): Promise<any> {
    const res = await authFetch(`${baseUrl}/api/admin/procedures`);
    if (!res.ok) throw new Error("Failed to fetch procedures");
    return await res.json();
  },

  async createProcedure(data: any, baseUrl = API_URL): Promise<any> {
    const res = await authFetch(`${baseUrl}/api/admin/procedures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create procedure");
    return await res.json();
  },

  async updateProcedure(id: string, data: any, baseUrl = API_URL): Promise<any> {
    const res = await authFetch(`${baseUrl}/api/admin/procedures/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update procedure");
    return await res.json();
  },

  async deleteProcedure(id: string, baseUrl = API_URL): Promise<any> {
    const res = await authFetch(`${baseUrl}/api/admin/procedures/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete procedure");
    return await res.json();
  },

  async exportProcedures(baseUrl = API_URL): Promise<Blob> {
    const res = await authFetch(`${baseUrl}/api/admin/procedures/export`);
    if (!res.ok) throw new Error("Failed to export procedures");
    return await res.blob();
  },

  async validateProcedures(baseUrl = API_URL): Promise<any> {
    const res = await authFetch(`${baseUrl}/api/admin/procedures/validate`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to validate procedures");
    return await res.json();
  },

  async getProcedureDocumentLinks(id: string, baseUrl = API_URL): Promise<{
    procedure: any;
    mapping: {
      procedure_id: string;
      doc_ids: string[];
      confidence?: number;
      reason?: string;
      attached_docs?: Array<Record<string, unknown>>;
    };
  }> {
    const res = await authFetch(`${baseUrl}/api/admin/procedures/${encodeURIComponent(id)}/doc-links`);
    if (!res.ok) throw new Error("Failed to fetch procedure document links");
    return await res.json();
  },

  async updateProcedureDocumentLinks(
    id: string,
    docIds: string[],
    baseUrl = API_URL,
  ): Promise<{
    ok: boolean;
    mapping: {
      procedure_id: string;
      doc_ids: string[];
      confidence?: number;
      reason?: string;
      attached_docs?: Array<Record<string, unknown>>;
    };
  }> {
    const res = await authFetch(`${baseUrl}/api/admin/procedures/${encodeURIComponent(id)}/doc-links`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ doc_ids: docIds, reason: "superadmin_manual" }),
    });
    if (!res.ok) throw new Error("Failed to update procedure document links");
    return await res.json();
  },

  /* ── Unified Search ──────────────────────────────────────────────── */

  async searchUnified(
    q: string,
    opts?: { limit?: number; sources?: string[] },
    baseUrl = API_URL,
  ): Promise<{
    query: string;
    sources: string[];
    results: Record<string, unknown[]>;
    total: number;
    errors?: string[];
  }> {
    const params = new URLSearchParams({ q, limit: String(opts?.limit ?? 5) });
    if (opts?.sources?.length) params.set("sources", opts.sources.join(","));
    try {
      const res = await fetch(`${baseUrl}/api/search/unified?${params}`);
      if (!res.ok) throw new Error("unified search failed");
      return await res.json();
    } catch {
      return { query: q, sources: [], results: {}, total: 0, errors: ["Network error"] };
    }
  },

  /* ── Feature Flags (SuperAdmin) ─────────────────────────────────── */

  async getFeatureFlags(baseUrl = API_URL): Promise<FeatureFlagsResponse> {
    if (shouldSkipOptionalDevRequest(baseUrl)) {
      return { flags: {}, lastUpdatedAt: null };
    }

    try {
      const res = await fetch(`${baseUrl}/api/admin/features`);
      if (!res.ok) return { flags: {}, lastUpdatedAt: null };
      const data = await res.json();
      return {
        flags: data.flags ?? {},
        lastUpdatedAt: data.lastUpdatedAt ?? null,
      };
    } catch {
      return { flags: {}, lastUpdatedAt: null };
    }
  },

  async getPublishedWebUserSettings(baseUrl = API_URL): Promise<PublishedWebUserSettingsPayload | null> {
    if (shouldSkipOptionalDevRequest(baseUrl)) {
      return null;
    }

    try {
      const res = await fetch(`${baseUrl}/api/web-user/settings`);
      if (!res.ok) return null;
      return await res.json() as PublishedWebUserSettingsPayload;
    } catch {
      return null;
    }
  },

  async saveFeatureFlags(flags: Record<string, boolean>, baseUrl = API_URL): Promise<boolean> {
    try {
      const res = await authFetch(`${baseUrl}/api/admin/features`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(flags),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /* ── Groups ──────────────────────────────────────────────── */
  async getGroups(baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups`);
    if (!res.ok) throw new Error("groups fetch failed");
    const data = await res.json() as { groups: any[] };
    return data.groups || [];
  },

  async getGroup(id: string, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("group fetch failed");
    const data = await res.json() as { group: any };
    return data.group;
  },

  async getCommunityOverview(baseUrl = API_URL): Promise<{ community: Community; groups: CommunityGroup[]; liveSessions: LiveSession[] }> {
    const res = await authFetch(`${baseUrl}/api/community/groups`);
    if (!res.ok) throw new Error("community overview fetch failed");
    return await res.json() as { community: Community; groups: CommunityGroup[]; liveSessions: LiveSession[] };
  },

  async getCommunityGroup(
    groupId: string,
    options?: { before?: string; limit?: number },
    baseUrl = API_URL,
  ): Promise<CommunityGroupDetail> {
    const params = new URLSearchParams();
    if (options?.before) {
      params.set("before", options.before);
    }
    if (typeof options?.limit === "number") {
      params.set("limit", String(options.limit));
    }

    const query = params.size ? `?${params.toString()}` : "";
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}${query}`);
    if (!res.ok) throw new Error("community group fetch failed");
    return await res.json() as CommunityGroupDetail;
  },

  async getCommunityGroupMessagesPage(
    groupId: string,
    options?: { before?: string; limit?: number; search?: string },
    baseUrl = API_URL,
  ): Promise<CommunityMessagesPage> {
    const params = new URLSearchParams();
    if (options?.before) {
      params.set("before", options.before);
    }
    if (typeof options?.limit === "number") {
      params.set("limit", String(options.limit));
    }
    if (options?.search?.trim()) {
      params.set("q", options.search.trim());
    }

    const query = params.size ? `?${params.toString()}` : "";
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/messages${query}`);
    if (!res.ok) throw new Error("community group messages fetch failed");
    return await res.json() as CommunityMessagesPage;
  },

  async searchCommunityGroupMessages(
    groupId: string,
    options: { query?: string; filter?: "all" | "media" | "links" | "documents" | "audio"; limit?: number },
    baseUrl = API_URL,
  ): Promise<CommunityMessagesPage> {
    const params = new URLSearchParams();
    const normalizedQuery = options.query?.trim() || "";
    const filter = options.filter || "all";
    if (!normalizedQuery && filter === "all") {
      throw new Error("community group search query required");
    }
    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    }
    params.set("filter", filter);
    if (typeof options.limit === "number") {
      params.set("limit", String(options.limit));
    }

    const query = params.size ? `?${params.toString()}` : "";
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/search${query}`);
    if (!res.ok) throw new Error("community group search failed");
    return await res.json() as CommunityMessagesPage;
  },

  async getCommunityGroupMembers(groupId: string, baseUrl = API_URL): Promise<CommunityGroupMembersOverview> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/members`);
    if (!res.ok) throw new Error("community group members fetch failed");
    return await res.json() as CommunityGroupMembersOverview;
  },

  async getCommunityGroupReports(
    groupId: string,
    baseUrl = API_URL,
  ): Promise<{
    groupId: string;
    currentMembership: CommunityGroupMembershipSummary | null;
    actorPermissions: CommunityGroupPermission[];
    reports: CommunityReport[];
  }> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/reports`);
    if (!res.ok) throw new Error("community reports fetch failed");
    return await res.json() as {
      groupId: string;
      currentMembership: CommunityGroupMembershipSummary | null;
      actorPermissions: CommunityGroupPermission[];
      reports: CommunityReport[];
    };
  },

  async createCommunityReport(
    groupId: string,
    payload: {
      targetType: CommunityReportTargetType;
      targetId: string;
      reasonCategory: CommunityReportReasonCategory;
      description?: string;
    },
    baseUrl = API_URL,
  ): Promise<CommunityReport> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("community report create failed");
    return await res.json() as CommunityReport;
  },

  async reviewCommunityReport(
    groupId: string,
    reportId: string,
    payload: {
      status: Exclude<CommunityReportStatus, "open" | "appealed">;
      resolution?: string;
      linkedModerationActionIds?: string[];
    },
    baseUrl = API_URL,
  ): Promise<CommunityReport> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/reports/${encodeURIComponent(reportId)}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("community report review failed");
    return await res.json() as CommunityReport;
  },

  async getCommunityGroupAppeals(
    groupId: string,
    baseUrl = API_URL,
  ): Promise<{
    groupId: string;
    currentMembership: CommunityGroupMembershipSummary | null;
    actorPermissions: CommunityGroupPermission[];
    appeals: CommunityAppeal[];
  }> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/appeals`);
    if (!res.ok) throw new Error("community appeals fetch failed");
    return await res.json() as {
      groupId: string;
      currentMembership: CommunityGroupMembershipSummary | null;
      actorPermissions: CommunityGroupPermission[];
      appeals: CommunityAppeal[];
    };
  },

  async createCommunityAppeal(
    groupId: string,
    payload: {
      moderationActionId: string;
      reason: string;
    },
    baseUrl = API_URL,
  ): Promise<CommunityAppeal> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/appeals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("community appeal create failed");
    return await res.json() as CommunityAppeal;
  },

  async resolveCommunityAppeal(
    groupId: string,
    appealId: string,
    payload: {
      outcome: CommunityAppealOutcome;
      resolutionReason: string;
    },
    baseUrl = API_URL,
  ): Promise<CommunityAppeal> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/appeals/${encodeURIComponent(appealId)}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("community appeal resolve failed");
    return await res.json() as CommunityAppeal;
  },

  async requestCommunityGroupMembership(groupId: string, baseUrl = API_URL): Promise<CommunityMembershipUpdate> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/membership/request`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("community membership request failed");
    return await res.json() as CommunityMembershipUpdate;
  },

  async leaveCommunityGroup(groupId: string, baseUrl = API_URL): Promise<CommunityMembershipUpdate> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/membership/leave`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("community membership leave failed");
    return await res.json() as CommunityMembershipUpdate;
  },

  async inviteCommunityGroupMember(
    groupId: string,
    payload: { invitedUserId: string; note?: string; expiresInDays?: number },
    baseUrl = API_URL,
  ): Promise<CommunityGroupMembersOverview> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/invitations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("community invitation create failed");
    return await res.json() as CommunityGroupMembersOverview;
  },

  async acceptCommunityGroupInvitation(groupId: string, baseUrl = API_URL): Promise<CommunityMembershipUpdate> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/invitations/accept`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("community invitation accept failed");
    return await res.json() as CommunityMembershipUpdate;
  },

  async revokeCommunityGroupInvitation(
    groupId: string,
    userId: string,
    payload?: { reason?: string },
    baseUrl = API_URL,
  ): Promise<CommunityGroupMembersOverview> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/invitations/${encodeURIComponent(userId)}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) throw new Error("community invitation revoke failed");
    return await res.json() as CommunityGroupMembersOverview;
  },

  async approveCommunityGroupMembership(
    groupId: string,
    userId: string,
    payload?: { reason?: string },
    baseUrl = API_URL,
  ): Promise<CommunityMembershipUpdate> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) throw new Error("community membership approve failed");
    return await res.json() as CommunityMembershipUpdate;
  },

  async rejectCommunityGroupMembership(
    groupId: string,
    userId: string,
    payload?: { reason?: string },
    baseUrl = API_URL,
  ): Promise<CommunityMembershipUpdate> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) throw new Error("community membership reject failed");
    return await res.json() as CommunityMembershipUpdate;
  },

  async sendCommunityMessage(
    groupId: string,
    payload: {
      body: string;
      clientRequestId?: string;
      replyToMessageId?: string;
      senderId?: string;
      senderName?: string;
      type?: CommunityMessage["type"];
      replyToPreview?: CommunityMessage["replyToPreview"];
    },
    baseUrl = API_URL,
  ): Promise<CommunityMessage> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("community message send failed");
    return await res.json() as CommunityMessage;
  },

  async forwardCommunityMessage(
    groupId: string,
    payload: { sourceMessageId: string; clientRequestId: string },
    baseUrl = API_URL,
  ): Promise<CommunityMessage> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/forward`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("community message forward failed");
    return await res.json() as CommunityMessage;
  },

  async uploadCommunityAttachment(
    groupId: string,
    payload: {
      file?: File;
      files?: File[];
      body?: string;
      type?: Extract<CommunityMessage["type"], "attachment" | "voice">;
      replyToMessageId?: string;
      replyToPreview?: CommunityMessage["replyToPreview"];
    },
    baseUrl = API_URL,
  ): Promise<{
    ok: true;
    message: CommunityMessage;
    attachment: {
      id: string;
      groupId: string;
      messageId?: string;
      originalName: string;
      mimeType: string;
      size: number;
      sha256: string;
      createdAt: string;
      scannedAt?: string;
      scanProvider?: string;
      attachmentUrl: string;
      durationMs?: number;
    };
  }> {
    const form = new FormData();
    for (const file of payload.files || (payload.file ? [payload.file] : [])) {
      form.append("file", file);
    }
    if (payload.body?.trim()) {
      form.append("body", payload.body.trim());
    }
    if (payload.type) {
      form.append("type", payload.type);
    }
    if (payload.replyToMessageId) {
      form.append("replyToMessageId", payload.replyToMessageId);
    }
    if (payload.replyToPreview) {
      form.append("replyToPreview", JSON.stringify(payload.replyToPreview));
    }

    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/attachments`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("community attachment upload failed");
    return await res.json() as {
      ok: true;
      message: CommunityMessage;
      attachment: {
        id: string;
        groupId: string;
        messageId?: string;
        originalName: string;
        mimeType: string;
        size: number;
        sha256: string;
        createdAt: string;
        scannedAt?: string;
        scanProvider?: string;
        attachmentUrl: string;
        durationMs?: number;
      };
      attachments?: Array<{
        id: string;
        groupId: string;
        messageId?: string;
        originalName: string;
        mimeType: string;
        size: number;
        sha256: string;
        createdAt: string;
        attachmentUrl: string;
      }>;
    };
  },

  async fetchCommunityAttachmentAsset(
    attachmentUrl: string,
    baseUrl = API_URL,
  ): Promise<{ blob: Blob; contentType: string; fileName?: string }> {
    const normalizedPath = attachmentUrl.startsWith("/") ? attachmentUrl : `/${attachmentUrl}`;
    let requestUrl = attachmentUrl;
    if (!attachmentUrl.startsWith("http")) {
      requestUrl = `${baseUrl}${normalizedPath}`;
    }
    const res = await authFetch(requestUrl);
    if (!res.ok) throw new Error("community attachment fetch failed");

    const blob = await res.blob();
    return {
      blob,
      contentType: res.headers.get("content-type") || blob.type || "application/octet-stream",
      fileName: parseContentDispositionFileName(res.headers.get("content-disposition")),
    };
  },

  async markCommunityGroupRead(groupId: string, baseUrl = API_URL, messageId?: string): Promise<CommunityReadUpdate> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/read`, {
      method: "POST",
      headers: messageId ? { "content-type": "application/json" } : undefined,
      body: messageId ? JSON.stringify({ messageId }) : undefined,
    });
    if (!res.ok) throw new Error("community read failed");
    return await res.json() as CommunityReadUpdate;
  },

  async setCommunityGroupTyping(groupId: string, payload: { userName?: string; isTyping?: boolean }, baseUrl = API_URL): Promise<{ ok: true; typingUsers: string[] }> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/typing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("community typing failed");
    return await res.json() as { ok: true; typingUsers: string[] };
  },

  async deleteCommunityMessageForEveryone(groupId: string, messageId: string, deletedByName?: string, baseUrl = API_URL): Promise<{ message: CommunityMessage; group: CommunityGroup }> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}/delete-for-everyone`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deletedByName }),
    });
    if (!res.ok) throw new Error("community delete-for-everyone failed");
    return await res.json() as { message: CommunityMessage; group: CommunityGroup };
  },

  async deleteCommunityMessageForSelf(
    groupId: string,
    messageId: string,
    baseUrl = API_URL,
  ): Promise<{ messageId: string; deletedForMeAt: string; group: CommunityGroup }> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}/delete-for-self`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("community delete-for-self failed");
    return await res.json() as { messageId: string; deletedForMeAt: string; group: CommunityGroup };
  },

  async toggleCommunityMessageReaction(
    groupId: string,
    messageId: string,
    emoji: string,
    baseUrl = API_URL,
  ): Promise<{ message: CommunityMessage; group: CommunityGroup }> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}/reactions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) throw new Error("community reaction toggle failed");
    return await res.json() as { message: CommunityMessage; group: CommunityGroup };
  },

  async setCommunityMessageStarredState(
    groupId: string,
    messageId: string,
    starred: boolean,
    baseUrl = API_URL,
  ): Promise<{ message: CommunityMessage; group: CommunityGroup }> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}/star`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ starred }),
    });
    if (!res.ok) throw new Error("community star toggle failed");
    return await res.json() as { message: CommunityMessage; group: CommunityGroup };
  },

  async getCommunityStarredMessages(
    options?: { before?: string; limit?: number },
    baseUrl = API_URL,
  ): Promise<CommunityMessagesPage> {
    const params = new URLSearchParams();
    if (options?.before) params.set("before", options.before);
    if (typeof options?.limit === "number") params.set("limit", String(options.limit));
    const query = params.size ? `?${params.toString()}` : "";
    const res = await authFetch(`${baseUrl}/api/community/starred-messages${query}`);
    if (!res.ok) throw new Error("community starred messages fetch failed");
    return await res.json() as CommunityMessagesPage;
  },

  async pinCommunityMessage(
    groupId: string,
    messageId: string,
    baseUrl = API_URL,
  ): Promise<{ message: CommunityMessage; group: CommunityGroup }> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}/pin`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("community pin failed");
    return await res.json() as { message: CommunityMessage; group: CommunityGroup };
  },

  async unpinCommunityMessage(
    groupId: string,
    messageId: string,
    baseUrl = API_URL,
  ): Promise<{ message: CommunityMessage; group: CommunityGroup }> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}/unpin`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("community unpin failed");
    return await res.json() as { message: CommunityMessage; group: CommunityGroup };
  },

  async editCommunityMessage(
    groupId: string,
    messageId: string,
    body: string,
    baseUrl = API_URL,
  ): Promise<{ message: CommunityMessage; group: CommunityGroup }> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      const error = new Error("community message edit failed") as Error & { status?: number; code?: string };
      error.status = res.status;
      error.code = payload?.error;
      throw error;
    }
    return await res.json() as { message: CommunityMessage; group: CommunityGroup };
  },

  async createCommunityGroup(
    payload: { name: string; description?: string; category: CommunityGroup["category"]; isOfficial?: boolean },
    baseUrl = API_URL,
  ): Promise<CommunityGroup> {
    const res = await authFetch(`${baseUrl}/api/community/groups`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("community group create failed");
    return await res.json() as CommunityGroup;
  },

  async updateCommunityGroup(
    groupId: string,
    payload: Partial<Pick<CommunityGroup, "name" | "description" | "category" | "isOfficial">>,
    baseUrl = API_URL,
  ): Promise<CommunityGroup> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("community group update failed");
    return await res.json() as CommunityGroup;
  },

  async postCommunityAnnouncement(
    groupId: string,
    payload: { body: string; clientRequestId?: string; senderName?: string },
    baseUrl = API_URL,
  ): Promise<CommunityMessage> {
    const res = await authFetch(`${baseUrl}/api/community/groups/${encodeURIComponent(groupId)}/announcements`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("community announcement failed");
    return await res.json() as CommunityMessage;
  },

  async createGroupPost(groupId: string, content: string, authorId: string, authorName: string, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(groupId)}/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, authorId, authorName }),
    });
    if (!res.ok) throw new Error("post create failed");
    return await res.json();
  },

  async deleteGroupPost(groupId: string, postId: string, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("post delete failed");
    return await res.json();
  },

  async deleteGroupPostForEveryone(groupId: string, postId: string, deletedByName?: string, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/delete-for-everyone`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deletedByName }),
    });
    if (!res.ok) throw new Error("post delete-for-everyone failed");
    return await res.json();
  },

  async markGroupRead(groupId: string, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(groupId)}/read`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("group read failed");
    return await res.json();
  },

  async setGroupTyping(groupId: string, payload: { isTyping?: boolean; userId?: string; userName?: string }, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(groupId)}/typing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("group typing failed");
    return await res.json() as { ok: true; typingUsers: string[] };
  },

  async createGroupReply(groupId: string, postId: string, content: string, authorId: string, authorName: string, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/replies`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, authorId, authorName }),
    });
    if (!res.ok) throw new Error("reply create failed");
    return await res.json();
  },

  async addGroupReaction(groupId: string, postId: string, emoji: string, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/reactions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) throw new Error("reaction failed");
    return await res.json();
  },

  async toggleGroupPin(groupId: string, postId: string, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/pin`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("pin failed");
    return await res.json();
  },

  async forwardGroupPost(groupId: string, postId: string, targetGroupId: string, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/forward`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetGroupId }),
    });
    if (!res.ok) throw new Error("forward failed");
    return await res.json();
  },

  async updateGroup(groupId: string, patch: { name?: string; description?: string }, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("group update failed");
    return await res.json();
  },

  async updateGroupMember(groupId: string, memberId: string, patch: Record<string, unknown>, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("member update failed");
    return await res.json();
  },

  async reportGroupPost(groupId: string, postId: string, reason: string, baseUrl = API_URL) {
    const res = await authFetch(`${baseUrl}/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error("report failed");
    return await res.json();
  },
};
// PAYMENT_OVERRIDE_LIVE_PIPELINE_WIRING_V1
export type PaymentOverrideRecord = {
  id: string;
  topic: string;
  status: string;
  answer: string;
  updatedAt?: string;
};

export async function fetchPaymentOverrides(): Promise<PaymentOverrideRecord[]> {
  const response = await fetch('/api/admin/payment-overrides', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('PAYMENT_OVERRIDES_FETCH_FAILED');
  }
  const data = await response.json();
  return Array.isArray(data?.overrides) ? data.overrides : [];
}