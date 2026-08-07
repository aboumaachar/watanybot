/**
 * @watany/types — Shared type definitions for the Watany monorepo.
 *
 * ALL domain types live here. Both web-user and gateway-api import from this package.
 */

import type {
  CTAAction,
  ConversationContext,
  HybridRouteDecision,
  HybridRouteMode,
} from "./hybrid";

export type {
  CTAAction,
  ConversationContext,
  Community,
  CommunityGroupDetail,
  CommunityGroup,
  CommunityGroupCategory,
  CommunityGroupMembersOverview,
  CommunityGroupMembership,
  CommunityGroupMembershipSummary,
  CommunityGroupMemberStatus,
  CommunityMembershipUpdate,
  CommunityMessageCursor,
  CommunityRealtimeEvent,
  CommunityRealtimeEventType,
  CommunityGroupPermission,
  CommunityMessageMention,
  CommunityMessageReaction,
  CommunityGroupMemberRole,
  CommunityGroupVisibility,
  CommunityReport,
  CommunityReportReasonCategory,
  CommunityReportStatus,
  CommunityReportTargetType,
  CommunityModerationAction,
  CommunityModerationActionTargetType,
  CommunityModerationActionType,
  CommunityAppeal,
  CommunityAppealOutcome,
  CommunityAppealStatus,
  CommunitySuspensionDuration,
  CommunityMessage,
  CommunityMessagesPage,
  CommunityMessagePage,
  CommunityMessagePageInfo,
  CommunityReadState,
  CommunityReadUpdate,
  HybridIntent,
  HybridRouteDecision,
  HybridRouteInput,
  HybridRouteMode,
  LiveSession,
  WatanyAssistantResponse,
  WatanyModule,
} from "./hybrid";

/* â”€â”€ Language â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type Lang = "ar";

/* â”€â”€ Chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type Citation = {
  kind: "guide_tx" | "law_article" | "salary_table";
  label: string;
  ref?: string;
};

export type ActionIntent = {
  type:
    | "call_phone"
    | "open_url"
    | "open_module"
    | "request_location"
    | "request_photo"
    | "request_voice"
    | "create_followup_ticket"
    | "open_form"
    | "suggest_query";
  label?: string;
  url?: string;
  moduleId?: string;
  phone?: string;
  formId?: string;
  query?: string;
};

export type ChatSource = {
  id: string;
  title?: string;
  text?: string;
  score?: number;
  source?: string;
};

export type Attachment = {
  kind: "image" | "file";
  name: string;
  url: string;
  previewUrl?: string;
};

export type ChatRole = "user" | "assistant" | "system";

export type ChatReplyPreview = {
  id: string;
  role: ChatRole;
  text: string;
};

export type ChatMessageReaction = {
  emoji: string;
  count: number;
  reactedByMe?: boolean;
};

export type ChatMessageDeliveryStatus = "sending" | "sent" | "read";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  ts: number;
  text: string;
  replyTo?: ChatReplyPreview;
  reactions?: ChatMessageReaction[];
  deliveryStatus?: ChatMessageDeliveryStatus;
  deletedForMeAt?: number;
  deletedForEveryoneAt?: number;
  deletedForEveryoneBy?: ChatRole;
  citations?: Citation[];
  intents?: ActionIntent[];
  ctas?: CTAAction[];
  routeDecision?: HybridRouteDecision;
  context?: ConversationContext;
  mode?: HybridRouteMode;
  module?: string;
  attachments?: Attachment[];
  meta?: Record<string, unknown>;
};

export interface ChatRequest {
  message: string;
  lang?: string;
  channel?: string;
  userId?: string;
  sessionId?: string;
  phone_number?: string;
}

export interface ChatResponse {
  reply: string;
  intents: ActionIntent[];
  ctas?: CTAAction[];
  routeDecision?: HybridRouteDecision;
  context?: ConversationContext;
  mode?: HybridRouteMode;
  module?: string;
  clarifying_question?: string;
  menu?: string[];
  sources?: ChatSource[];
  whatsapp_payloads?: unknown[];
  debug?: Record<string, unknown>;
}

/* â”€â”€ Transactions (KB guide) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type TxItem = {
  tx_no: number;
  title_ar: string;
  section_ar: string;
  preview: string;
};

export type TxDetail = TxItem & {
  body: string;
  required_docs?: string[];
  steps?: string[];
  fees_lbp?: number[];
  time_limits?: string[];
  phones?: string[];
  urls?: string[];
  related?: { tx_no: number; title_ar: string; similarity: number }[];
  legal_basis?: { law: string; article_no: number; excerpt: string }[];
};

/* â”€â”€ Salary & Pension â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type SalaryResult = {
  rank_ar: string;
  degree: number;
  category?: string;
  basicSalary?: number;
  degreeValue?: number;
  vetSalary?: number;
  equipment?: number;
  driver?: number;
  position?: number;
  pension2026?: number;
  pension2026usd?: number;
  sixSalary?: number;
  totalSalary2026usd?: number;
  new_salary_lbp?: number;
  base_salary_old_lbp?: number;
  cola_lbp?: number;
  notes?: string;
  source?: Citation;
};

export type RankInfo = { rank: string; category: string; maxDegree: number };
export type OrnamentChoice = { id: string; name_ar: string; monthlyValue: number; annualValue: number };

export type SalaryMeta = {
  ranks: RankInfo[];
  familyAllowance: { wife: number; perChild: number };
  familyAllowanceAfterRaise: { wife: number; perChild: number; note_ar?: string };
  ornamentChoices: OrnamentChoice[];
  usdRate: number;
};

export type PensionCalcResult = {
  ok: boolean;
  input: { rank: string; degree: number; category: string; married: boolean; kidsCount: number; selectedOrnaments: string[] };
  breakdown: {
    basicSalary: number;
    vetSalary: number;
    deduction15Pct: number;
    equipment: number;
    driver: number;
    position: number;
    aids: {
      grant2025: number;
      d13020: number;
      d11227_2: number;
      d11227_1: number;
      budget2022: number;
    };
    pension2026: number;
    pension2026usd: number;
    familyAllowance: { wife: number; children: number; total: number };
    medals: { items: { id: string; name_ar: string; monthlyValue: number; annualValue: number }[]; total: number };
  };
  totalPension: number;
  totalPensionUsd: number;
  raise: {
    sixSalary: number;
    pensionAfterSixRaise: number;
    pensionAfterSixRaiseUsd: number;
    familyAfterRaise: { wife: number; children: number; total: number };
    totalAfterSixRaise: number;
    totalAfterSixRaiseUsd: number;
    sixPct: number;
  };
  fiftyPctRaise: {
    val2019: number;
    val2019usd: number;
    fiftyPctTargetUsd: number;
    fiftyPctTargetLbp: number;
    additionalRaise: number;
    pensionAfterFiftyPct: number;
    pensionAfterFiftyPctUsd: number;
    familyAfterRaise: { wife: number; children: number; total: number };
    totalAfterFiftyPct: number;
    totalAfterFiftyPctUsd: number;
  };
  usdRate: number;
};

/* â”€â”€ Cases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type CaseItem = {
  id: string;
  title: string;
  type: "dependents" | "death_inheritance" | "medical" | "schooling" | "pension_payment" | "other";
  status: "draft" | "in_progress" | "submitted" | "done";
  checklist: { label: string; done: boolean }[];
  createdAt: number;
  updatedAt: number;
};

/* â”€â”€ Chat Sessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type ChatSession = {
  id: string;
  status: "open" | "in_progress" | "closed";
  messages: ChatMessage[];
  note?: string;
  createdAt: number;
  updatedAt: number;
};

/* â”€â”€ Jobs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type JobVacancy = {
  id: string;
  title: string;
  company: string;
  location: string;
  mode: "onsite" | "hybrid" | "remote";
  postedAt: string;
  summary: string;
  tags: string[];
};

export type JobApplication = {
  id: string;
  jobId: string;
  name: string;
  phone: string;
  email?: string;
  note?: string;
  createdAt: number;
};

export type RecruitmentAnnouncement = {
  id: string;
  title: string;
  apparatusName: string;
  announcementNumber?: string;
  startDate?: string;
  endDate?: string;
  status: "draft" | "published" | "expired" | "cancelled";
  conditions: string[];
  requiredDocuments: string[];
  eligibleCategories: string[];
  applicationLocation?: string;
  applicationMethod?: string;
  sourceName?: string;
  sourceUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

/* â”€â”€ Marketplace â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type MarketplaceListingType = "SELL" | "BUY" | "DONATE" | "SERVICE" | "sell" | "buy" | "service" | "skill";

export type MarketplaceContactPreference = "WHATSAPP" | "PHONE" | "IN_APP" | "HIDDEN";

export type MarketplaceModerationStatus = "APPROVED" | "PENDING_REVIEW" | "NEEDS_REVISION" | "REJECTED" | "REMOVED";

export type MarketplaceLifecycleStatus = "active" | "sold" | "reserved" | "hidden" | "archived" | "expired" | "draft";

export type MarketplaceTrustState = {
  verifiedByWatany?: boolean;
  featuredVeteranSeller?: boolean;
  sellerTrustLevel?: "NEW" | "TRUSTED" | "FEATURED";
  note?: string;
};

export type MarketplaceImage = {
  id?: string;
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  sortOrder?: number;
  uploadedAt?: string;
};

export type MarketplaceListing = {
  id: string;
  title: string;
  price: number | string;
  currency: string;
  location: string;
  seller: string;
  contact: string;
  description: string;
  category: string;
  status: MarketplaceLifecycleStatus | MarketplaceModerationStatus;
  createdAt: number | string;
  updatedAt?: string;
  ownerId?: string;
  sellerUserId?: string;
  sellerPhone?: string;
  sellerWhatsapp?: string;
  sellerEmail?: string;
  sellerProfileLabel?: string;
  locationLabel?: string;
  mohafaza?: string;
  caza?: string;
  village?: string;
  exactAddress?: string;
  listingType?: MarketplaceListingType;
  contactPreference?: MarketplaceContactPreference;
  moderationStatus?: MarketplaceModerationStatus;
  trustStatus?: string;
  trust?: MarketplaceTrustState;
  reportCount?: number;
  favouriteCount?: number;
  isFavorited?: boolean;
  isOwnerListing?: boolean;
  images?: MarketplaceImage[];
  primaryImageUrl?: string;
  reservedAt?: string;
  soldAt?: string;
  archivedAt?: string;
  hiddenAt?: string;
  expiresAt?: string;
  renewedAt?: string;
};

/* â”€â”€ Alerts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type EmergencyAlert = {
  id: string;
  title: string;
  country: string;
  date: string;
  url?: string;
  summary?: string;
  source: string;
};

/* â”€â”€ Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type UserRole = "public" | "accredited" | "driver" | "moderator" | "admin" | "superadmin";

export type UserProfile = {
  isAuthed: boolean;
  id?: string;
  role?: UserRole;
  name?: string;
  phone?: string;
  email?: string;
  apparatus?: string;
  region?: string;
  note?: string;
  lastLogin?: number;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string;
  profileCompleted?: boolean;
};

/* â”€â”€ Documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type DocumentExtractionStatus = "not_started" | "queued" | "processing" | "ready" | "failed";

export type DocumentItem = {
  id: string;
  name: string;
  kind: "image" | "pdf" | "doc" | "file";
  status: "pending" | "verified" | "rejected";
  updatedAt: number;
  sourceFileName?: string;
  mimeType?: string;
  slug?: string;
  extractionStatus?: DocumentExtractionStatus;
  extractionError?: string;
  chunkCount?: number;
  tags: string[];
};

/* â”€â”€ Official Forms / Templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type FormField = {
  id: string;
  label: string;
  type: "text" | "date" | "number" | "select" | "checkbox" | "textarea" | "signature";
  placeholder?: string;
  options?: string[];
  required?: boolean;
  width?: "full" | "half" | "third";
};

export type FormTemplate = {
  id: string;
  code: string;
  title_ar: string;
  description_ar: string;
  category: string;
  related_tx: number[];
  authority: string;
  fields: FormField[];
  header_html?: string;
  footer_html?: string;
  instructions_ar?: string;
  version: string;
  updatedAt: string;
};

export type AudienceScope =
  | "veteran_direct"
  | "family_direct"
  | "veteran_or_family"
  | "retired_army_only"
  | "retired_all_forces"
  | "active_service_only"
  | "institutional_admin"
  | "public_general";

export type ContentTier = "frontline" | "supporting" | "archive";

export type OfficialFileItem = FormTemplate & {
  kind: "form" | "reference";
  source: string;
  tags?: string[];
  url?: string;
  preview_url?: string;
  download_url?: string;
  share_url?: string;
  relatedProcedureIds?: string[];
  audience_scope?: AudienceScope;
  content_tier?: ContentTier;
  applies_to?: string[];
  domain?: string;
  relevance_weight?: number;
};

/* â”€â”€ Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  kind: "alert" | "case" | "doc" | "system";
  ts: number;
  read: boolean;
  userId?: string;
  refType?: string;
  refId?: string;
};

export type NotificationPreviewMode = "safe" | "rich";

export type NotificationQuietHours = {
  enabled: boolean;
  start: "22:00";
  end: "07:00";
  timezone: string;
};

export type NotificationPreference = {
  userId: string;
  replyEnabled: boolean;
  mentionEnabled: boolean;
  pushEnabled: boolean;
  previewMode: NotificationPreviewMode;
  quietHours: NotificationQuietHours;
  updatedAt: number;
};

export type NotificationRoomMuteDuration = "8h" | "1w" | "indefinite";

export type NotificationRoomMute = {
  roomId: string;
  mutedUntil?: string;
  isIndefinite: boolean;
  updatedAt: number;
};

export type NotificationPushProvider = "mock" | "webpush";

export type NotificationPushDeviceStatus = "idle" | "sent" | "retryable_failure" | "permanent_failure";

export type NotificationPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type NotificationPushPublicConfig = {
  provider: "webpush";
  configured: boolean;
  publicKey?: string;
  subject?: string;
  source: "env" | "runtime_file" | "unconfigured";
  error?: string;
};

export type NotificationPushDevice = {
  id: string;
  provider: NotificationPushProvider;
  endpoint: string;
  label?: string;
  lastDeliveryStatus: NotificationPushDeviceStatus;
  lastDeliveryError?: string;
  lastDeliveredAt?: number;
  retryCount: number;
  createdAt: number;
  updatedAt: number;
};

export type NotificationSettings = {
  preference: NotificationPreference;
  roomMutes: NotificationRoomMute[];
  devices: NotificationPushDevice[];
};

export type TickerItem = {
  id?: number | string;
  kind: string;
  title: string;
  body?: string;
  url?: string;
  linkType?: string;
  linkId?: string;
  createdAt?: string;
};

/* â”€â”€ Saved Chats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type SavedChatItem = {
  id: string;
  text: string;
  ts: number;
  status: "active" | "closed" | "archived" | "deleted_for_me";
  updatedAt: number;
  closedAt?: number;
  archivedAt?: number;
  deletedForMeAt?: number;
};

/* â”€â”€ KB v2 types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type KBHit = {
  id: string;
  source: string;
  score: number;
};

export type IntentInfoV2 = {
  intent: string;
  domain: string;
  request_type: string;
  urgency: string;
  slots_filled: Record<string, unknown>;
  slots_missing: string[];
  confidence: number;
};

export type ChatV2Response = {
  answer_lb: string;
  answer_formal: string;
  confidence: number;
  kb_hits: KBHit[];
  clarifying?: string;
  intents?: ActionIntent[];
  ctas?: CTAAction[];
  routeDecision?: HybridRouteDecision;
  context?: ConversationContext;
  mode?: HybridRouteMode;
  module?: string;
  intent: string;
  domain: string;
  intent_result: IntentInfoV2;
  menu: string[];
  ticket?: Record<string, unknown>;
  salary_breakdown?: Record<string, unknown>;
};

export type SearchV2Hit = {
  source: string;
  id: string;
  title: string;
  body: string;
  domain: string;
  score: number;
};

export type SearchV2Response = {
  items: SearchV2Hit[];
  total: number;
  query: string;
};

export type SalaryComputeV2Response = {
  error: boolean;
  type?: string;
  summary_lb: string;
  summary_formal: string;
  breakdown?: {
    base_salary_LBP?: number;
    pension_rate?: number;
    service_factor?: number;
    gross_pension?: number;
    tax_deduction?: number;
    after_tax?: number;
    family_allowance?: number;
    medals_bonus?: number;
    net_pension?: number;
    severance_factor?: number;
    total_severance?: number;
  };
  message_lb?: string;
  note_lb?: string;
};

export type TicketV2 = {
  id: string;
  status: string;
  priority: string;
  category: string;
  title_lb: string;
  description: string;
  intent: string;
  domain: string;
  assigned_to: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  escalation_reason: string;
  history: Record<string, unknown>[];
};

/* â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  militaryId?: string;
  rank?: string;
}

export interface JWTPayload {
  sub: string;
  role: UserRole;
  email: string;
  iat: number;
  exp: number;
}

/* â”€â”€ Audit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  timestamp: number;
}

/* â”€â”€ Content Filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type FilterSeverity = "low" | "medium" | "high" | "critical";
export type FilterAction = "warn" | "block" | "redact" | "notify_admin";

export interface FilterRule {
  id: string;
  name: string;
  pattern: string;
  severity: FilterSeverity;
  action: FilterAction;
  enabled: boolean;
  description?: string;
}

export interface FilterResult {
  passed: boolean;
  violations: { rule: string; severity: FilterSeverity; action: FilterAction; match: string }[];
  sanitized: string;
}

/* â”€â”€ Decision Tree â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type DecisionNodeType = "question" | "action" | "result" | "form" | "external_link";

export interface ButtonOption {
  label: string;
  icon?: string;
  nextNodeId: string;
  action?: ActionIntent;
}

export interface DecisionNode {
  id: string;
  type: DecisionNodeType;
  title: string;
  body?: string;
  buttons: ButtonOption[];
  formId?: string;
  url?: string;
  resultText?: string;
}

export interface DecisionTree {
  id: string;
  name: string;
  rootNodeId: string;
  nodes: Record<string, DecisionNode>;
}

/* â”€â”€ WebSocket Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type WSEventType =
  | "user.message"
  | "user.connected"
  | "user.disconnected"
  | "alert.flagged"
  | "system.health"
  | "admin.broadcast"
  | "chat"
  | "moderation"
  | "user";

export interface WSEvent<T = unknown> {
  type: WSEventType;
  payload: T;
  timestamp: number;
}
