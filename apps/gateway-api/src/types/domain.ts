/**
 * Domain types extracted from server.ts
 * These types define the shared data shapes used across gateway modules.
 */

export type LegacyHealth = {
  enabled: boolean;
  ok: boolean;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
};

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
  phones?: string[];
  urls?: string[];
  related?: { tx_no: number; title_ar: string; similarity: number }[];
  legal_basis?: { law: string; article_no: number; excerpt: string }[];
};

export type SalaryResult = {
  rank_ar: string;
  degree: number;
  new_salary_lbp?: number;
  base_salary_old_lbp?: number;
  cola_lbp?: number;
  notes?: string;
};

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

export type MarketplaceListing = {
  id: string;
  title: string;
  price: number;
  currency: string;
  location: string;
  seller: string;
  contact: string;
  description: string;
  category: string;
  status: "active" | "sold";
  createdAt: number;
};

export type EmergencyAlert = {
  id: string;
  title: string;
  country: string;
  date: string;
  url?: string;
  summary?: string;
  source: string;
};

export type CaseItem = {
  id: string;
  title: string;
  type: "dependents" | "death_inheritance" | "medical" | "schooling" | "pension_payment" | "other";
  status: "draft" | "in_progress" | "submitted" | "done";
  checklist: { label: string; done: boolean }[];
  createdAt: number;
  updatedAt: number;
};

export type UserProfile = {
  isAuthed: boolean;
  role?: "public" | "accredited" | "moderator" | "admin" | "superadmin";
  name?: string;
  phone?: string;
  email?: string;
  region?: string;
  note?: string;
  lastLogin?: number;
};

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

export type ChatHistoryMessage = {
  id: string;
  role: string;
  ts: number;
  text: string;
  replyTo?: {
    id: string;
    role: string;
    text: string;
  };
  reactions?: Array<{
    emoji: string;
    count: number;
    reactedByMe?: boolean;
  }>;
  deliveryStatus?: "sending" | "sent" | "read";
  deletedForMeAt?: number;
  deletedForEveryoneAt?: number;
  deletedForEveryoneBy?: string;
  citations?: unknown;
  intents?: unknown;
  attachments?: unknown;
  meta?: unknown;
};

export type ChatMessage = ChatHistoryMessage;

export type ChatSession = {
  id: string;
  status: "open" | "in_progress" | "closed";
  messages: ChatMessage[];
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export type VoiceE2ECheckResult = {
  ts: string;
  ok: boolean;
  sampleText: string;
  transcript?: string;
  confidence?: number;
  durationMs?: number;
  error?: string;
};

export type VoiceE2EAlert = {
  ts: string;
  level: 'warning' | 'critical' | 'info';
  message: string;
  payload?: any;
};

export type LegacyChatResponse = {
  answer?: string;
  action_intents?: unknown[];
  clarifying_question?: string | null;
  whatsapp_payloads?: unknown[];
  debug?: unknown;
  [key: string]: unknown;
};

export type PluginDbStatement = {
  all: (...args: any[]) => Array<Record<string, unknown>>;
  get: (...args: any[]) => Record<string, unknown> | undefined;
  run: (...args: any[]) => { changes: number; lastInsertRowid?: string | number };
};

export type PluginDb = {
  prepare: (sql: string) => PluginDbStatement;
};

export const ROLE_ORDER = ["public", "accredited", "moderator", "admin", "superadmin"] as const;
export type Role = typeof ROLE_ORDER[number];
