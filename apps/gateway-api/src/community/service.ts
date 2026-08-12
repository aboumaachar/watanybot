import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import { createAdminAuditEvent, type AdminAuditEvent } from "../admin-authority/adminAuthorityAudit.js";
import { ensureAdminAuthorityTables } from "../admin-authority/adminAuthorityStore.js";
import { getClient, query } from "../lib/db.js";
import { buildCommunityAttachmentContentUrl } from "./attachment-security.js";
import type {
  Community,
  CommunityAppeal,
  CommunityAppealOutcome,
  CommunityAppealStatus,
  CommunityGroup,
  CommunityGroupDetail,
  CommunityGroupMembership,
  CommunityGroupMembershipSummary,
  CommunityGroupMemberStatus,
  CommunityModerationActionType,
  CommunityGroupPermission,
  CommunityMessage,
  CommunityMessageMention,
  CommunityMessagesPage,
  CommunityMessagePage,
  CommunityMessagePageInfo,
  CommunityMessageReaction,
  CommunityRealtimeEvent,
  CommunityReadState,
  CommunityReport,
  CommunityReportReasonCategory,
  CommunityReportStatus,
  CommunityReportTargetType,
  CommunitySuspensionDuration,
  LiveSession,
} from "@watany/types";

type CommunityVisibility = "public" | "private" | "invite_only";

export type CommunityViewer = {
  id?: string;
  role?: string;
};

export type CommunityActor = {
  id: string;
  role: string;
  displayName: string;
};

export type CommunityServiceErrorCode =
  | "community_group_not_found"
  | "community_group_auth_required"
  | "community_group_forbidden"
  | "community_member_limit_reached"
  | "community_membership_not_found"
  | "community_invalid_cursor"
  | "community_message_not_found"
  | "community_read_message_invalid"
  | "community_message_forbidden"
  | "community_message_deleted"
  | "community_forward_source_invalid"
  | "community_forward_destination_forbidden"
  | "community_message_edit_window_expired"
  | "community_report_not_found"
  | "community_report_duplicate"
  | "community_report_invalid_target"
  | "community_moderation_action_not_found"
  | "community_appeal_not_found"
  | "community_appeal_duplicate";

export type CommunityResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: CommunityServiceErrorCode };

export type CommunityGroupView = CommunityGroup & {
  visibility?: CommunityVisibility;
};

export type CommunityOverview = {
  community: Community;
  groups: CommunityGroupView[];
  liveSessions: LiveSession[];
};

export type CommunityDetail = CommunityGroupDetail;

export type CommunityDetailOptions = {
  beforeMessageId?: string;
  beforeCursor?: string;
  limit?: number;
  search?: string;
  filter?: CommunityMessageFilter;
};

export type CommunityMessageFilter = "all" | "media" | "links" | "documents" | "audio";

type CommunityMessageCursorPayload = {
  groupId: string;
  createdAt: string;
  id: string;
};

type CommunityRealtimeSequencePayload = {
  groupId: string;
  occurredAt: string;
  eventId: string;
};

export type CommunityReadUpdateResult = {
  group: CommunityGroupView;
  readState: CommunityReadState;
};

export type CommunityGroupMembersOverview = {
  group: CommunityGroupView;
  memberCount: number;
  memberLimit: number;
  currentMembership: CommunityGroupMembershipSummary | null;
  actorPermissions: CommunityGroupPermission[];
  membersByStatus: Record<CommunityGroupMemberStatus, CommunityGroupMembership[]>;
};

export type CommunityMembershipUpdateResult = {
  group: CommunityGroupView;
  currentMembership: CommunityGroupMembershipSummary | null;
  actorPermissions: CommunityGroupPermission[];
};

export type CommunityReportsOverview = {
  groupId: string;
  currentMembership: CommunityGroupMembershipSummary | null;
  actorPermissions: CommunityGroupPermission[];
  reports: CommunityReport[];
};

export type CommunityAppealsOverview = {
  groupId: string;
  currentMembership: CommunityGroupMembershipSummary | null;
  actorPermissions: CommunityGroupPermission[];
  appeals: CommunityAppeal[];
};

export type CommunityMessageInput = CommunityMessage & {
  clientRequestId?: string;
  forwardSourceMessageId?: string;
};

export async function validateCommunityMessageInGroup(groupId: string, messageId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM community_messages WHERE group_id = $1 AND id = $2 LIMIT 1`,
    [groupId, messageId],
  );
  return Number(result.rowCount || 0) > 0;
}

export type CommunityGroupCreateInput = CommunityGroup & {
  visibility?: CommunityVisibility;
  memberIds?: string[];
};

export type CommunityGroupUpdateInput = Partial<Pick<CommunityGroup, "name" | "description" | "category" | "isOfficial">> & {
  visibility?: CommunityVisibility;
  memberIds?: string[];
};

type CommunityModerationDuration = CommunitySuspensionDuration | "permanent";

type QueryExecutor = {
  query: <TRow extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount?: number | null }>;
};

type CommunityServiceTelemetryLevel = "info" | "warn" | "error";

export type CommunityServiceTelemetryEvent = {
  event: "community.idempotent_replay" | "community.message_moderated";
  level?: CommunityServiceTelemetryLevel;
  data: Record<string, unknown>;
};

export type CommunityServiceRealtimeEvent = CommunityRealtimeEvent<Record<string, unknown>>;

type GroupRow = {
  id: string;
  community_id: string;
  name: string;
  description: string | null;
  category: CommunityGroup["category"];
  member_count: number;
  member_limit: number;
  is_official: boolean;
  visibility: CommunityVisibility;
  pinned_message_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  membership_role: string | null;
  membership_status: string | null;
  membership_joined_at: string | Date | null;
  membership_muted_until: string | Date | null;
  membership_suspended_until: string | Date | null;
  membership_banned_at: string | Date | null;
};

type MessageRow = {
  id: string;
  group_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: CommunityMessage["senderRole"];
  type: CommunityMessage["type"];
  body: string | null;
  attachment_url: string | null;
  created_at: string | Date;
  edited_at: string | Date | null;
  reply_to_message_id: string | null;
  reply_to_preview: unknown;
  mentions: unknown;
  deleted_for_everyone_at: string | Date | null;
  deleted_for_everyone_by: string | null;
  is_pinned: boolean;
  client_request_id: string | null;
  is_forwarded: boolean;
  forward_source_message_id: string | null;
  is_starred_by_me?: boolean;
  starred_created_at?: string | Date;
};

type MessageAttachmentRow = {
  id: string;
  message_id: string;
  original_name: string;
  mime_type: string;
  bytes: string | number;
  content_url: string | null;
};

type LiveSessionRow = {
  id: string;
  group_id: string | null;
  title: string;
  host_name: string;
  starts_at: string | Date;
  ends_at: string | Date | null;
  status: LiveSession["status"];
  join_url: string | null;
  recording_url: string | null;
};

type ReadStateRow = {
  last_read_message_id: string | null;
  last_read_at: string | Date | null;
};

type MembershipRow = {
  group_id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string | Date | null;
  requested_at: string | Date | null;
  invited_at: string | Date | null;
  added_by: string | null;
  updated_at: string | Date;
  status_reason: string | null;
  muted_until: string | Date | null;
  suspended_until: string | Date | null;
  banned_at: string | Date | null;
  user_name: string | null;
  user_email: string | null;
};

type InvitationRow = {
  id: string;
  group_id: string;
  invited_user_id: string;
  invited_by_user_id: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  note: string | null;
  expires_at: string | Date;
  accepted_at: string | Date | null;
  revoked_at: string | Date | null;
  revoked_by_user_id: string | null;
  created_at: string | Date;
};

type ReportRow = {
  id: string;
  group_id: string;
  reporter_user_id: string;
  target_type: CommunityReportTargetType;
  target_id: string;
  reason_category: CommunityReportReasonCategory;
  description: string | null;
  status: CommunityReportStatus;
  assigned_reviewer_id: string | null;
  resolution: string | null;
  appeal_status: CommunityAppealStatus | null;
  audit_event_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  resolved_at: string | Date | null;
  resolved_by_user_id: string | null;
};

type ModerationActionRow = {
  id: string;
  group_id: string;
  actor_user_id: string;
  actor_role: string;
  target_type: "group" | "member" | "message" | "report";
  target_id: string;
  action_type: CommunityModerationActionType;
  reason: string;
  duration: CommunityModerationDuration | null;
  report_id: string | null;
  previous_state: unknown;
  resulting_state: unknown;
  audit_event_id: string;
  created_at: string | Date;
};

type AppealRow = {
  id: string;
  group_id: string;
  moderation_action_id: string;
  audit_event_id: string;
  appellant_user_id: string;
  reason: string;
  status: CommunityAppealStatus;
  resolution_outcome: CommunityAppealOutcome | null;
  resolution_reason: string | null;
  resolved_by_user_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  resolved_at: string | Date | null;
};

type MembershipAuditSnapshot = {
  groupId: string;
  userId: string;
  role: CommunityGroupMembership["role"] | null;
  status: CommunityGroupMemberStatus | null;
  requestedAt: string | null;
  invitedAt: string | null;
  invitedByUserId: string | null;
  joinedAt: string | null;
  mutedUntil: string | null;
  suspendedUntil: string | null;
  bannedAt: string | null;
  reason: string | null;
};

const DEFAULT_COMMUNITY_PAGE_LIMIT = 30;
const MAX_COMMUNITY_PAGE_LIMIT = 80;
const COMMUNITY_MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
const COMMUNITY_MENTION_PATTERN = /(^|\s)@([^\s@]{1,64})/gu;

const defaultExecutor: QueryExecutor = {
  query: <TRow extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => query<TRow>(text, params),
};

let communityServiceTelemetryEmitter: ((event: CommunityServiceTelemetryEvent) => void) | null = null;
let communityServiceRealtimeEmitter: ((event: CommunityServiceRealtimeEvent) => void) | null = null;

export function setCommunityServiceTelemetryEmitter(
  emitter: ((event: CommunityServiceTelemetryEvent) => void) | null,
): void {
  communityServiceTelemetryEmitter = emitter;
}

export function setCommunityServiceRealtimeEmitter(
  emitter: ((event: CommunityServiceRealtimeEvent) => void) | null,
): void {
  communityServiceRealtimeEmitter = emitter;
}

function emitCommunityServiceTelemetry(event: CommunityServiceTelemetryEvent): void {
  try {
    communityServiceTelemetryEmitter?.(event);
  } catch {
    // Telemetry must never change the persistence path.
  }
}

function emitCommunityServiceRealtime(event: CommunityServiceRealtimeEvent): void {
  try {
    communityServiceRealtimeEmitter?.(event);
  } catch {
    // Realtime publication must never change the persistence path.
  }
}

const parseJsonText: (text: string) => unknown = JSON.parse;
const stringifyJsonValue: (value: unknown) => string = JSON.stringify;

const COMMUNITY_SEED_KEY = "watany-community-v1";

const SEED_COMMUNITY: Community = {
  id: "watany-community",
  name: "مجتمع موطني",
  description: "مجموعات  والخبرة والجلسات المباشرة الخاصة بالمحاربين القدامى وعائلاتهم.",
  icon: "ph-fill ph-users-three",
  createdAt: "2025-01-10T09:00:00.000Z",
};

const SEED_GROUPS: Array<CommunityGroupView> = [
  {
    id: "salary-room",
    communityId: SEED_COMMUNITY.id,
    name: "الرواتب والتعويضات",
    description: "أسئلة الحاسبة، التعويضات، وفروقات المعاش.",
    category: "salary",
    memberCount: 184,
    unreadCount: 0,
    isOfficial: true,
    visibility: "public",
  },
  {
    id: "health-room",
    communityId: SEED_COMMUNITY.id,
    name: "الطبابة والتحويلات",
    description: "تجارب المستشفيات والتحويلات الطبية والمتابعة.",
    category: "healthcare",
    memberCount: 132,
    unreadCount: 0,
    visibility: "public",
  },
  {
    id: "grants-room",
    communityId: SEED_COMMUNITY.id,
    name: "المساعدات المدرسية",
    description: "الأوراق المطلوبة للمساعدات المدرسية ومواعيد التقديم وتجارب الأهالي.",
    category: "grants",
    memberCount: 96,
    unreadCount: 0,
    visibility: "public",
  },
  {
    id: "recruitment-room",
    communityId: SEED_COMMUNITY.id,
    name: "التطويع والإعلانات",
    description: "الأسئلة المرتبطة بالإعلانات الحالية ومكان التقديم.",
    category: "recruitment",
    memberCount: 211,
    unreadCount: 0,
    isOfficial: true,
    visibility: "public",
  },
];

const SEED_MESSAGES: Record<string, CommunityMessageInput[]> = {
  "salary-room": [
    {
      id: "salary-announcement-1",
      groupId: "salary-room",
      senderId: "system",
      senderName: "إدارة موطني",
      senderRole: "system",
      type: "announcement",
      body: "تم تحديث مسار حاسبة الراتب. صارت الخطوة التالية تظهر مباشرة بعد الجواب داخل المحادثة.",
      createdAt: "2026-05-12T19:20:00.000Z",
      isPinned: true,
    },
    {
      id: "salary-msg-1",
      groupId: "salary-room",
      senderId: "user_ahmad",
      senderName: "أحمد",
      senderRole: "user",
      type: "text",
      body: "جرّبت الحاسبة الجديدة، وفتحت معي مباشرة على خيار المقارنة بعد النتيجة.",
      createdAt: "2026-05-12T19:35:00.000Z",
    },
    {
      id: "salary-msg-2",
      groupId: "salary-room",
      senderId: "admin_nour",
      senderName: "نور",
      senderRole: "admin",
      type: "text",
      body: "إذا اختلفت النتيجة عن كشفك السابق، ابعت الرتبة وسنوات الخدمة حتى نراجع السبب.",
      createdAt: "2026-05-12T19:42:00.000Z",
    },
  ],
  "health-room": [
    {
      id: "health-msg-1",
      groupId: "health-room",
      senderId: "user_maya",
      senderName: "مايا",
      senderRole: "user",
      type: "text",
      body: "مين عنده تجربة حديثة مع تحويل المستشفى العسكري على بيروت؟",
      createdAt: "2026-05-12T18:50:00.000Z",
    },
    {
      id: "health-msg-2",
      groupId: "health-room",
      senderId: "user_samir",
      senderName: "سمير",
      senderRole: "user",
      type: "text",
      body: "أنا قدّمت الأسبوع الماضي، والمهم يكون التقرير الطبي الأخير واضح ومختوم.",
      createdAt: "2026-05-12T19:05:00.000Z",
    },
  ],
  "grants-room": [
    {
      id: "grants-msg-1",
      groupId: "grants-room",
      senderId: "admin_lina",
      senderName: "لينا",
      senderRole: "admin",
      type: "text",
      body: "الأوراق المطلوبة للمساعدات المدرسية موجودة الآن أيضاً داخل مسار المستندات المرتبط بالخدمة.",
      createdAt: "2026-05-12T17:40:00.000Z",
    },
  ],
  "recruitment-room": [
    {
      id: "recruitment-session-1",
      groupId: "recruitment-room",
      senderId: "system",
      senderName: "إدارة موطني",
      senderRole: "system",
      type: "session_invite",
      body: "جلسة مباشرة الليلة لشرح إعلان التطويع الحالي والإجابة عن أسئلة مكان التقديم.",
      createdAt: "2026-05-12T18:00:00.000Z",
      isPinned: true,
    },
    {
      id: "recruitment-msg-1",
      groupId: "recruitment-room",
      senderId: "user_hassan",
      senderName: "حسن",
      senderRole: "user",
      type: "text",
      body: "مبارح سألت موطني عن مكان التقديم وفتح لي المسار مباشرة على الإعلان الحالي.",
      createdAt: "2026-05-12T18:15:00.000Z",
    },
    {
      id: "recruitment-msg-2",
      groupId: "recruitment-room",
      senderId: "admin_rasha",
      senderName: "رشا",
      senderRole: "admin",
      type: "text",
      body: "إذا سؤالك متابعة قصيرة مثل " + '"وين؟"' + " أو " + '"؟"' + ", سيبقى الرد مربوطاً بالإعلان نفسه.",
      createdAt: "2026-05-12T18:25:00.000Z",
    },
  ],
};

const SEED_LIVE_SESSIONS: LiveSession[] = [
  {
    id: "session-recruitment-live",
    groupId: "recruitment-room",
    title: "جلسة مباشرة: شرح إعلان التطويع الحالي",
    hostName: "فريق موطني",
    startsAt: "2026-05-12T20:00:00.000Z",
    endsAt: "2026-05-12T20:45:00.000Z",
    status: "live",
    joinUrl: "https://koudama.com/live/recruitment-room",
  },
];

function copyCommunity(): Community {
  return { ...SEED_COMMUNITY };
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
  }

  return new Date().toISOString();
}

function normalizeVisibility(value: unknown): CommunityVisibility {
  if (value === "private" || value === "invite_only") {
    return value;
  }

  return "public";
}

function uniqueTrimmedStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const items: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    items.push(trimmed);
  }

  return items;
}

function normalizeCommunityPageLimit(limit?: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_COMMUNITY_PAGE_LIMIT;
  }

  const normalized = Math.trunc(Number(limit));
  if (normalized <= 0) {
    return DEFAULT_COMMUNITY_PAGE_LIMIT;
  }

  return Math.min(normalized, MAX_COMMUNITY_PAGE_LIMIT);
}

function encodeCommunityMessageCursor(groupId: string, createdAt: string, id: string): string {
  return Buffer.from(stringifyJsonValue({ groupId, createdAt, id } satisfies CommunityMessageCursorPayload), "utf-8").toString("base64url");
}

export function encodeCommunityRealtimeSequence(groupId: string, occurredAt: string, eventId: string): string {
  return Buffer.from(stringifyJsonValue({ groupId, occurredAt, eventId } satisfies CommunityRealtimeSequencePayload), "utf-8").toString("base64url");
}

function decodeCommunityMessageCursor(cursor?: string): CommunityMessageCursorPayload | null {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = parseJsonText(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const candidate = parsed as Partial<CommunityMessageCursorPayload>;
    if (typeof candidate.groupId !== "string" || typeof candidate.createdAt !== "string" || typeof candidate.id !== "string") {
      return null;
    }

    const parsedDate = Date.parse(candidate.createdAt);
    if (Number.isNaN(parsedDate)) {
      return null;
    }

    return {
      groupId: candidate.groupId,
      createdAt: new Date(parsedDate).toISOString(),
      id: candidate.id,
    };
  } catch {
    return null;
  }
}

export function decodeCommunityRealtimeSequence(sequence?: string): CommunityRealtimeSequencePayload | null {
  if (!sequence) {
    return null;
  }

  try {
    const decoded = Buffer.from(sequence, "base64url").toString("utf-8");
    const parsed = parseJsonText(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const candidate = parsed as Partial<CommunityRealtimeSequencePayload>;
    if (typeof candidate.groupId !== "string" || typeof candidate.occurredAt !== "string" || typeof candidate.eventId !== "string") {
      return null;
    }

    const parsedDate = Date.parse(candidate.occurredAt);
    if (Number.isNaN(parsedDate)) {
      return null;
    }

    return {
      groupId: candidate.groupId,
      occurredAt: new Date(parsedDate).toISOString(),
      eventId: candidate.eventId,
    };
  } catch {
    return null;
  }
}

function buildCommunityRealtimeEvent(params: {
  eventId: string;
  eventType: CommunityServiceRealtimeEvent["eventType"];
  occurredAt: string;
  groupId: string;
  actorId?: string | null;
  messageId?: string | null;
  sequence?: string | null;
  payload?: Record<string, unknown>;
}): CommunityServiceRealtimeEvent {
  return {
    eventId: params.eventId,
    eventType: params.eventType,
    occurredAt: params.occurredAt,
    groupId: params.groupId,
    actorId: params.actorId ?? null,
    messageId: params.messageId ?? null,
    sequence: params.sequence ?? null,
    payload: params.payload ?? {},
  };
}

function toNullableReadState(readState: CommunityReadState): CommunityMessagesPage["readState"] {
  return {
    unreadCount: readState.unreadCount,
    lastReadMessageId: readState.lastReadMessageId ?? null,
    lastReadAt: readState.lastReadAt ?? null,
  };
}

function isCommunityModeratorRole(role?: string): boolean {
  return role === "moderator" || role === "admin" || role === "superadmin";
}

function isCommunityAdminRole(role?: string): boolean {
  return role === "admin" || role === "superadmin";
}

function isCommunitySuperadminRole(role?: string): boolean {
  return role === "superadmin";
}

function toCommunityMembershipStatus(value: string | null): CommunityGroupMemberStatus | null {
  switch (value) {
    case "pending":
    case "active":
    case "invited":
    case "muted":
    case "suspended":
    case "removed":
    case "left":
    case "banned":
    case "rejected":
      return value;
    default:
      return null;
  }
}

function isExpiredStatus(until: string | Date | null | undefined): boolean {
  if (!until) {
    return false;
  }

  return Date.parse(toIsoString(until)) <= Date.now();
}

function getEffectiveMembershipStatus(row: GroupRow): CommunityGroupMemberStatus | null {
  const status = toCommunityMembershipStatus(row.membership_status);
  if (status === "muted" && isExpiredStatus(row.membership_muted_until)) {
    return "active";
  }

  if (status === "suspended" && isExpiredStatus(row.membership_suspended_until)) {
    return "active";
  }

  return status;
}

function isReadableMembershipStatus(status: CommunityGroupMemberStatus | null): boolean {
  return status === "active" || status === "muted";
}

function isWritableMembershipStatus(status: CommunityGroupMemberStatus | null): boolean {
  return status === "active";
}

function isRestrictedMembershipStatus(status: CommunityGroupMemberStatus | null): boolean {
  return status === "suspended" || status === "banned";
}

function addGroupPermissions(target: Set<CommunityGroupPermission>, permissions: readonly CommunityGroupPermission[]): void {
  for (const permission of permissions) {
    target.add(permission);
  }
}

function resolveCommunityGroupPermissions(
  row: GroupRow,
  viewer?: CommunityViewer,
): CommunityGroupPermission[] {
  const permissions = new Set<CommunityGroupPermission>();
  const status = getEffectiveMembershipStatus(row);
  const role = row.membership_role;
  const readableMembership = isReadableMembershipStatus(status);
  const writableMembership = isWritableMembershipStatus(status);
  const isOwner = readableMembership && role === "owner";
  const isAssignedModerator = readableMembership && role === "moderator";
  const globalAdmin = isCommunityAdminRole(viewer?.role);
  const globalSuperadmin = isCommunitySuperadminRole(viewer?.role);

  if ((row.visibility === "public" && !isRestrictedMembershipStatus(status)) || readableMembership || globalAdmin || globalSuperadmin) {
    permissions.add("community.group.read");
  }

  if (writableMembership || globalAdmin || globalSuperadmin) {
    permissions.add("community.group.write");
  }

  if (isAssignedModerator || isOwner || globalAdmin || globalSuperadmin) {
    addGroupPermissions(permissions, [
      "community.members.view",
      "community.reports.review",
      "community.messages.moderate",
      "community.members.warn",
      "community.members.mute",
    ]);
  }

  if (isOwner || globalAdmin || globalSuperadmin) {
    addGroupPermissions(permissions, [
      "community.group.manage",
      "community.members.invite",
      "community.members.approve",
      "community.members.remove",
      "community.roles.assign_moderator",
      "community.announcements.publish",
      "community.members.suspend",
    ]);
  }

  if (globalSuperadmin) {
    addGroupPermissions(permissions, [
      "community.members.ban",
      "community.appeals.resolve",
    ]);
  }

  return [...permissions];
}

function buildCommunityMembershipSummary(
  row: GroupRow,
  viewer?: CommunityViewer,
): CommunityGroupMembershipSummary | null {
  const status = getEffectiveMembershipStatus(row);
  if (!status && !row.membership_role) {
    return null;
  }

  return {
    status,
    role: row.membership_role === "member" || row.membership_role === "moderator" || row.membership_role === "owner"
      ? row.membership_role
      : null,
    permissions: resolveCommunityGroupPermissions(row, viewer),
    mutedUntil: row.membership_muted_until ? toIsoString(row.membership_muted_until) : undefined,
    suspendedUntil: row.membership_suspended_until ? toIsoString(row.membership_suspended_until) : undefined,
    bannedAt: row.membership_banned_at ? toIsoString(row.membership_banned_at) : undefined,
  };
}

function buildMembershipSummaryFromMembershipRow(
  row: MembershipRow | null,
  permissions: CommunityGroupPermission[] = [],
): CommunityGroupMembershipSummary | null {
  if (!row) {
    return null;
  }

  return {
    status: getEffectiveMembershipStatusFromMembershipRow(row),
    role: row.role === "member" || row.role === "moderator" || row.role === "owner"
      ? row.role
      : null,
    permissions,
    mutedUntil: row.muted_until ? toIsoString(row.muted_until) : undefined,
    suspendedUntil: row.suspended_until ? toIsoString(row.suspended_until) : undefined,
    bannedAt: row.banned_at ? toIsoString(row.banned_at) : undefined,
  };
}

function toCommunityMembershipRole(value: string | null): CommunityGroupMembership["role"] {
  if (value === "moderator" || value === "owner") {
    return value;
  }

  return "member";
}

function getEffectiveMembershipStatusFromMembershipRow(row: MembershipRow): CommunityGroupMemberStatus {
  const status = toCommunityMembershipStatus(row.status) ?? "pending";
  if (status === "muted" && isExpiredStatus(row.muted_until)) {
    return "active";
  }

  if (status === "suspended" && isExpiredStatus(row.suspended_until)) {
    return "active";
  }

  return status;
}

function buildMembershipDisplayName(row: MembershipRow): string {
  const name = row.user_name?.trim();
  if (name) {
    return name;
  }

  const emailLocalPart = row.user_email?.split("@")[0]?.trim();
  return emailLocalPart || row.user_id;
}

function normalizeCommunityMentionToken(value: string): string {
  return value.trim().replace(/^@+/, "").replace(/\s+/g, "_").toLocaleLowerCase("ar-LB");
}

function buildCommunityMentionAliases(row: MembershipRow): string[] {
  const displayName = buildMembershipDisplayName(row);
  const emailLocalPart = row.user_email?.split("@")[0]?.trim();
  return Array.from(new Set([
    normalizeCommunityMentionToken(displayName),
    normalizeCommunityMentionToken(row.user_id),
    emailLocalPart ? normalizeCommunityMentionToken(emailLocalPart) : null,
  ].filter((value): value is string => Boolean(value))));
}

function isMentionableCommunityMember(row: MembershipRow): boolean {
  const effectiveStatus = getEffectiveMembershipStatusFromMembershipRow(row);
  return effectiveStatus === "active" || effectiveStatus === "muted";
}

function buildCommunityMentionAliasMap(members: MembershipRow[]): Map<string, MembershipRow> {
  const aliasToMember = new Map<string, MembershipRow>();
  for (const member of members) {
    if (!isMentionableCommunityMember(member)) {
      continue;
    }

    for (const alias of buildCommunityMentionAliases(member)) {
      if (!aliasToMember.has(alias)) {
        aliasToMember.set(alias, member);
      }
    }
  }

  return aliasToMember;
}

function resolveCommunityMessageMentions(
  body: string | undefined,
  members: MembershipRow[],
): CommunityMessageMention[] | undefined {
  if (!body?.trim()) {
    return undefined;
  }

  const aliasToMember = buildCommunityMentionAliasMap(members);

  const mentions: CommunityMessageMention[] = [];
  const seenUserIds = new Set<string>();
  for (const match of body.matchAll(COMMUNITY_MENTION_PATTERN)) {
    const rawToken = match[2]?.trim();
    if (!rawToken) {
      continue;
    }

    const resolvedMember = aliasToMember.get(normalizeCommunityMentionToken(rawToken));
    if (!resolvedMember || seenUserIds.has(resolvedMember.user_id)) {
      continue;
    }

    seenUserIds.add(resolvedMember.user_id);
    mentions.push({
      userId: resolvedMember.user_id,
      displayName: buildMembershipDisplayName(resolvedMember),
      token: `@${rawToken}`,
    });
  }

  return mentions.length > 0 ? mentions : undefined;
}

async function resolveCommunityMessageMentionsForGroup(
  executor: QueryExecutor,
  groupId: string,
  body: string | undefined,
): Promise<CommunityMessageMention[] | undefined> {
  if (!body?.trim()) {
    return undefined;
  }

  const members = await listMembershipRows(executor, groupId);
  return resolveCommunityMessageMentions(body, members);
}

function mapMembershipRow(row: MembershipRow): CommunityGroupMembership {
  return {
    id: `${row.group_id}:${row.user_id}`,
    groupId: row.group_id,
    userId: row.user_id,
    displayName: buildMembershipDisplayName(row),
    role: toCommunityMembershipRole(row.role),
    status: getEffectiveMembershipStatusFromMembershipRow(row),
    permissions: [],
    requestedAt: row.requested_at ? toIsoString(row.requested_at) : undefined,
    invitedAt: row.invited_at ? toIsoString(row.invited_at) : undefined,
    invitedByUserId: row.added_by || undefined,
    joinedAt: row.joined_at ? toIsoString(row.joined_at) : undefined,
    mutedUntil: row.muted_until ? toIsoString(row.muted_until) : undefined,
    suspendedUntil: row.suspended_until ? toIsoString(row.suspended_until) : undefined,
    bannedAt: row.banned_at ? toIsoString(row.banned_at) : undefined,
    reason: row.status_reason || undefined,
  };
}

function createEmptyMembershipBuckets(): Record<CommunityGroupMemberStatus, CommunityGroupMembership[]> {
  return {
    pending: [],
    active: [],
    invited: [],
    muted: [],
    suspended: [],
    removed: [],
    left: [],
    banned: [],
    rejected: [],
  };
}

function countsTowardMemberLimit(status: CommunityGroupMemberStatus | null): boolean {
  return status === "active" || status === "muted";
}

function getMembershipCountDelta(
  previousStatus: CommunityGroupMemberStatus | null,
  nextStatus: CommunityGroupMemberStatus | null,
): number {
  return Number(countsTowardMemberLimit(nextStatus)) - Number(countsTowardMemberLimit(previousStatus));
}

function parseReplyPreview(value: unknown): CommunityMessage["replyToPreview"] | undefined {
  const candidate = typeof value === "string"
    ? (() => {
        try {
          return parseJsonText(value);
        } catch {
          return null;
        }
      })()
    : value;

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return undefined;
  }

  const reply = candidate as Record<string, unknown>;
  if (typeof reply.id !== "string" || typeof reply.senderName !== "string" || typeof reply.body !== "string") {
    return undefined;
  }

  return {
    id: reply.id,
    senderName: reply.senderName,
    body: reply.body,
  };
}

function parseMessageMentions(value: unknown): CommunityMessageMention[] | undefined {
  const candidate = typeof value === "string"
    ? (() => {
        try {
          return parseJsonText(value);
        } catch {
          return null;
        }
      })()
    : value;

  if (!Array.isArray(candidate)) {
    return undefined;
  }

  const mentions = candidate.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const mention = entry as Record<string, unknown>;
    if (typeof mention.userId !== "string" || typeof mention.displayName !== "string" || typeof mention.token !== "string") {
      return [];
    }

    return [{
      userId: mention.userId,
      displayName: mention.displayName,
      token: mention.token,
    } satisfies CommunityMessageMention];
  });

  return mentions.length > 0 ? mentions : undefined;
}

function normalizeCommunityMessageSearch(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const escapeChar = String.fromCodePoint(92);
  const escaped = Array.from(trimmed, (character) => (
    character === escapeChar || character === "%" || character === "_"
      ? escapeChar + character
      : character
  )).join("");

  return `%${escaped}%`;
}

function buildCommunityMessageSearchClause(paramIndex: number): string {
  return String.raw` AND body ILIKE $${paramIndex} ESCAPE '\' AND deleted_for_everyone_at IS NULL`;
}

function buildCommunityMessageFilterClause(filter: CommunityMessageFilter | undefined): string {
  if (!filter || filter === "all") {
    return "";
  }

  if (filter === "links") {
    return " AND deleted_for_everyone_at IS NULL AND body ~* 'https?://|www\\.'";
  }

  const mediaPredicate = "attachment.mime_type LIKE 'image/%' OR attachment.mime_type LIKE 'video/%'";
  const audioPredicate = "community_messages.type = 'voice' OR attachment.mime_type LIKE 'audio/%'";
  const documentPredicate = "attachment.mime_type NOT LIKE 'image/%' AND attachment.mime_type NOT LIKE 'video/%' AND attachment.mime_type NOT LIKE 'audio/%'";
  const predicate = filter === "media" ? mediaPredicate : filter === "audio" ? audioPredicate : documentPredicate;

  return ` AND deleted_for_everyone_at IS NULL AND EXISTS (
        SELECT 1
        FROM community_message_attachments attachment
        WHERE attachment.message_id = community_messages.id
          AND (${predicate})
      )`;
}

function buildCommunityMessagePageQuery(options: {
  groupId: string;
  rowLimit: number;
  searchValue?: string;
  filter?: CommunityMessageFilter;
  viewerId?: string;
  before?: { createdAt: string | Date; id: string };
}): { text: string; params: unknown[] } {
  const params: unknown[] = [options.groupId];
  let beforeClause = "";
  if (options.before) {
    params.push(options.before.createdAt, options.before.id);
    beforeClause = " AND (created_at, id) < ($2, $3)";
  }

  let nextParamIndex = params.length + 1;
  let searchClause = "";
  if (options.searchValue) {
    searchClause = buildCommunityMessageSearchClause(nextParamIndex);
    params.push(options.searchValue);
    nextParamIndex += 1;
  }

  const filterClause = buildCommunityMessageFilterClause(options.filter);

  let hiddenClause = "";
  if (options.viewerId) {
    hiddenClause = ` AND NOT EXISTS (SELECT 1 FROM community_message_hidden_for_user hidden WHERE hidden.message_id = community_messages.id AND hidden.user_id = $${nextParamIndex})`;
    params.push(options.viewerId);
    nextParamIndex += 1;
  }

  params.push(options.rowLimit);

  return {
    text: `SELECT
        id,
        group_id,
        sender_id,
        sender_name,
        sender_role,
        type,
        body,
        attachment_url,
        created_at,
        edited_at,
        reply_to_message_id,
        reply_to_preview,
        mentions,
        deleted_for_everyone_at,
        deleted_for_everyone_by,
        is_pinned,
        client_request_id,
        COALESCE((to_jsonb(community_messages) ->> 'is_forwarded')::boolean, FALSE) AS is_forwarded,
        to_jsonb(community_messages) ->> 'forward_source_message_id' AS forward_source_message_id
      FROM community_messages
      WHERE group_id = $1${beforeClause}${searchClause}${filterClause}${hiddenClause}
      ORDER BY created_at DESC, id DESC
      LIMIT $${nextParamIndex}`,
    params,
  };
}

function buildMessagePreview(message: Pick<MessageRow, "body" | "type" | "deleted_for_everyone_at"> | undefined): string | undefined {
  if (!message) return undefined;
  if (message.deleted_for_everyone_at) return "تم حذف هذه الرسالة للجميع";
  if (typeof message.body === "string" && message.body.trim()) return message.body;
  if (message.type === "attachment") return "مرفق";
  if (message.type === "voice") return "رسالة صوتية";
  if (message.type === "session_invite") return "دعوة إلى جلسة مباشرة";
  if (message.type === "procedure_card") return "بطاقة إجراء";
  return "رسالة جديدة";
}

function mapMessageRow(row: MessageRow, reactions?: CommunityMessageReaction[]): CommunityMessage {
  return {
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    type: row.type,
    body: row.deleted_for_everyone_at ? undefined : (typeof row.body === "string" ? row.body : undefined),
    attachmentUrl: typeof row.attachment_url === "string" ? row.attachment_url : undefined,
    createdAt: toIsoString(row.created_at),
    editedAt: row.edited_at ? toIsoString(row.edited_at) : undefined,
    replyToMessageId: typeof row.reply_to_message_id === "string" ? row.reply_to_message_id : undefined,
    replyToPreview: parseReplyPreview(row.reply_to_preview),
    mentions: parseMessageMentions(row.mentions),
    reactions: reactions && reactions.length > 0 ? reactions : undefined,
    isStarredByMe: row.is_starred_by_me ? true : undefined,
    deletedForEveryoneAt: row.deleted_for_everyone_at ? toIsoString(row.deleted_for_everyone_at) : undefined,
    deletedForEveryoneBy: typeof row.deleted_for_everyone_by === "string" ? row.deleted_for_everyone_by : undefined,
    isPinned: Boolean(row.is_pinned),
    isForwarded: Boolean(row.is_forwarded),
    forwardSourceMessageId: typeof row.forward_source_message_id === "string" ? row.forward_source_message_id : undefined,
  };
}

async function loadMessageAttachments(executor: QueryExecutor, messageIds: string[]): Promise<Map<string, NonNullable<CommunityMessage["attachments"]>>> {
  if (messageIds.length === 0) return new Map();
  const result = await executor.query<MessageAttachmentRow>(
    `SELECT id, message_id, original_name, mime_type, bytes, storage_key AS content_url
       FROM community_message_attachments
      WHERE message_id = ANY($1::text[]) AND scan_status = 'clean'
      ORDER BY message_id, position ASC, created_at ASC, id ASC`,
    [messageIds],
  );
  const attachments = new Map<string, NonNullable<CommunityMessage["attachments"]>>();
  for (const row of result.rows) {
    const list = attachments.get(row.message_id) ?? [];
    list.push({
      id: row.id,
      url: buildCommunityAttachmentContentUrl(row.id),
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: Number(row.bytes) || 0,
    });
    attachments.set(row.message_id, list);
  }
  return attachments;
}

function mapLiveSessionRow(row: LiveSessionRow): LiveSession {
  return {
    id: row.id,
    groupId: typeof row.group_id === "string" ? row.group_id : undefined,
    title: row.title,
    hostName: row.host_name,
    startsAt: toIsoString(row.starts_at),
    endsAt: row.ends_at ? toIsoString(row.ends_at) : undefined,
    status: row.status,
    joinUrl: typeof row.join_url === "string" ? row.join_url : undefined,
    recordingUrl: typeof row.recording_url === "string" ? row.recording_url : undefined,
  };
}

function getGroupAccessCode(
  row: GroupRow,
  viewer: CommunityViewer | undefined,
  requireAuthenticated: boolean,
): CommunityServiceErrorCode | null {
  const membershipStatus = getEffectiveMembershipStatus(row);

  if (requireAuthenticated && !viewer?.id) {
    return "community_group_auth_required";
  }

  if (isCommunityAdminRole(viewer?.role)) {
    return null;
  }

  if (isRestrictedMembershipStatus(membershipStatus)) {
    return "community_group_forbidden";
  }

  if (row.visibility === "public") {
    return null;
  }

  if (!viewer?.id) {
    return "community_group_auth_required";
  }

  return isReadableMembershipStatus(membershipStatus) ? null : "community_group_forbidden";
}

function getGroupWriteAccessCode(
  row: GroupRow,
  viewer: CommunityViewer | undefined,
  requireAuthenticated: boolean,
): CommunityServiceErrorCode | null {
  const membershipStatus = getEffectiveMembershipStatus(row);

  if (requireAuthenticated && !viewer?.id) {
    return "community_group_auth_required";
  }

  // When no viewer is present (for example, system messages), allow writes
  // to public groups even when authentication is not required. Otherwise
  // require authentication for non-public groups.
  if (!viewer?.id) {
    return row.visibility === "public" ? null : "community_group_auth_required";
  }

  if (isCommunityAdminRole(viewer.role)) {
    return null;
  }

  return isWritableMembershipStatus(membershipStatus) ? null : "community_group_forbidden";
}

function getGroupPresenceAccessCode(
  row: GroupRow,
  viewer: CommunityViewer | undefined,
  requireAuthenticated: boolean,
): CommunityServiceErrorCode | null {
  const membershipStatus = getEffectiveMembershipStatus(row);

  if (requireAuthenticated && !viewer?.id) {
    return "community_group_auth_required";
  }

  if (!viewer?.id) {
    return "community_group_auth_required";
  }

  if (isCommunityAdminRole(viewer.role)) {
    return null;
  }

  return isReadableMembershipStatus(membershipStatus) ? null : "community_group_forbidden";
}

async function insertMessageEvent(
  executor: QueryExecutor,
  params: {
    messageId: string;
    groupId: string;
    actorUserId?: string;
    actorDisplayName?: string;
    eventType:
      | "created"
      | "edited"
      | "deleted_for_everyone"
      | "announcement"
      | "reaction_added"
      | "reaction_removed"
      | "deleted_for_self"
      | "pinned"
      | "unpinned";
    payload?: Record<string, unknown>;
  },
): Promise<{ id: string; created_at: string | Date; event_type: string }> {
  const result = await executor.query(
    `INSERT INTO community_message_events (message_id, group_id, actor_user_id, actor_display_name, event_type, payload)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, created_at, event_type`,
    [
      params.messageId,
      params.groupId,
      params.actorUserId || null,
      params.actorDisplayName || null,
      params.eventType,
      params.payload ? stringifyJsonValue(params.payload) : null,
    ],
  );

  return result.rows[0] as { id: string; created_at: string | Date; event_type: string };
}

async function fetchGroupRows(executor: QueryExecutor, viewer: CommunityViewer | undefined, groupId?: string): Promise<GroupRow[]> {
  const params: unknown[] = [viewer?.id ?? null];
  let sql = `
    SELECT
      g.id,
      g.community_id,
      g.name,
      g.description,
      g.category,
      g.member_count,
      g.member_limit,
      g.is_official,
      g.visibility,
      g.pinned_message_id,
      g.created_at,
      g.updated_at,
      membership.role AS membership_role,
      membership.status AS membership_status,
      membership.joined_at AS membership_joined_at,
      membership.muted_until AS membership_muted_until,
      membership.suspended_until AS membership_suspended_until,
      membership.banned_at AS membership_banned_at
    FROM community_groups g
    LEFT JOIN community_group_members membership
      ON membership.group_id = g.id
     AND membership.user_id = $1
  `;

  if (groupId) {
    params.push(groupId);
    sql += ` WHERE g.id = $2`;
  }

  const result = await executor.query(sql, params);
  return result.rows as GroupRow[];
}

async function fetchSingleGroupRow(executor: QueryExecutor, groupId: string, viewer?: CommunityViewer): Promise<GroupRow | null> {
  await normalizeExpiredMembershipStates(executor, { groupId });
  const rows = await fetchGroupRows(executor, viewer, groupId);
  return rows[0] ?? null;
}

async function loadLatestMessages(executor: QueryExecutor, groupIds: string[], viewerId?: string): Promise<Map<string, MessageRow>> {
  if (groupIds.length === 0) {
    return new Map();
  }

  const params: unknown[] = [groupIds];
  const hiddenClause = viewerId
    ? `
      AND NOT EXISTS (
        SELECT 1
        FROM community_message_hidden_for_user hidden
        WHERE hidden.message_id = community_messages.id
          AND hidden.user_id = $2
      )`
    : "";
  if (viewerId) {
    params.push(viewerId);
  }

  const result = await executor.query(
    `SELECT DISTINCT ON (group_id)
        id,
        group_id,
        sender_id,
        sender_name,
        sender_role,
        type,
        body,
        attachment_url,
        created_at,
        edited_at,
        reply_to_message_id,
        reply_to_preview,
        mentions,
        deleted_for_everyone_at,
        deleted_for_everyone_by,
        is_pinned,
        client_request_id,
        COALESCE((to_jsonb(community_messages) ->> 'is_forwarded')::boolean, FALSE) AS is_forwarded,
        to_jsonb(community_messages) ->> 'forward_source_message_id' AS forward_source_message_id
      FROM community_messages
      WHERE group_id = ANY($1::text[])
      ${hiddenClause}
      ORDER BY group_id, created_at DESC, id DESC`,
    params,
  );

  return new Map((result.rows as MessageRow[]).map((row) => [row.group_id, row]));
}

async function loadUnreadCounts(executor: QueryExecutor, groupIds: string[], viewerId?: string): Promise<Map<string, number>> {
  if (!viewerId || groupIds.length === 0) {
    return new Map();
  }

  const result = await executor.query(
    `SELECT
        g.id AS group_id,
        COALESCE(COUNT(m.id), 0)::int AS unread_count
      FROM community_groups g
      LEFT JOIN community_group_read_state rs
        ON rs.group_id = g.id
       AND rs.user_id = $2
      LEFT JOIN community_messages m
        ON m.group_id = g.id
       AND m.sender_id <> $2
       AND NOT EXISTS (
         SELECT 1
         FROM community_message_hidden_for_user hidden
         WHERE hidden.message_id = m.id
           AND hidden.user_id = $2
       )
       AND (
         rs.last_read_at IS NULL
         OR m.created_at > rs.last_read_at
         OR (
           rs.last_read_at IS NOT NULL
           AND m.created_at = rs.last_read_at
           AND rs.last_read_message_id IS NOT NULL
           AND m.id > rs.last_read_message_id
         )
       )
      WHERE g.id = ANY($1::text[])
      GROUP BY g.id`,
    [groupIds, viewerId],
  );

  return new Map((result.rows as Array<{ group_id: string; unread_count: number }>).map((row) => [row.group_id, Number(row.unread_count || 0)]));
}

async function loadMessageReactions(
  executor: QueryExecutor,
  messageIds: string[],
  viewerId?: string,
): Promise<Map<string, CommunityMessageReaction[]>> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const params: unknown[] = [messageIds];
  const reactedByMeSelect = viewerId ? "BOOL_OR(user_id = $2) AS reacted_by_me" : "FALSE AS reacted_by_me";
  if (viewerId) {
    params.push(viewerId);
  }

  const result = await executor.query<{
    message_id: string;
    emoji: string;
    reaction_count: number;
    reacted_by_me: boolean;
  }>(
    `SELECT
        message_id,
        emoji,
        COUNT(*)::int AS reaction_count,
        ${reactedByMeSelect}
      FROM community_message_reactions
      WHERE message_id = ANY($1::text[])
      GROUP BY message_id, emoji
      ORDER BY MIN(created_at) ASC`,
    params,
  );

  const reactionsByMessageId = new Map<string, CommunityMessageReaction[]>();
  for (const row of result.rows) {
    const current = reactionsByMessageId.get(row.message_id) || [];
    current.push({
      emoji: row.emoji,
      count: Number(row.reaction_count || 0),
      reactedByMe: row.reacted_by_me ? true : undefined,
    });
    reactionsByMessageId.set(row.message_id, current);
  }

  return reactionsByMessageId;
}

async function loadMessageStars(
  executor: QueryExecutor,
  messageIds: string[],
  viewerId?: string,
): Promise<Set<string>> {
  if (!viewerId || messageIds.length === 0) {
    return new Set();
  }

  const result = await executor.query<{ message_id: string }>(
    `SELECT message_id
       FROM community_message_stars
      WHERE user_id = $1 AND message_id = ANY($2::text[])`,
    [viewerId, messageIds],
  );
  return new Set(result.rows.map((row) => row.message_id));
}

async function hydrateCommunityMessages(
  executor: QueryExecutor,
  rows: MessageRow[],
  viewerId?: string,
): Promise<CommunityMessage[]> {
  const messageIds = rows.map((row) => row.id);
  const [reactionsByMessageId, starredMessageIds] = await Promise.all([
    loadMessageReactions(executor, messageIds, viewerId),
    loadMessageStars(executor, messageIds, viewerId),
  ]);
  const attachmentsByMessageId = await loadMessageAttachments(executor, messageIds);
  return rows.map((row) => {
    const attachments = attachmentsByMessageId.get(row.id);
    return {
      ...mapMessageRow({ ...row, is_starred_by_me: starredMessageIds.has(row.id) }, reactionsByMessageId.get(row.id)),
      ...(attachments && attachments.length > 0 ? { attachments, attachmentUrl: attachments[0].url } : {}),
    };
  });
}

async function hydrateCommunityMessage(
  executor: QueryExecutor,
  row: MessageRow,
  viewerId?: string,
): Promise<CommunityMessage> {
  const messages = await hydrateCommunityMessages(executor, [row], viewerId);
  return messages[0];
}

async function loadTypingUsers(executor: QueryExecutor, groupIds: string[]): Promise<Map<string, string[]>> {
  if (groupIds.length === 0) {
    return new Map();
  }

  await executor.query(`DELETE FROM community_typing_state WHERE expires_at <= now()`);

  const result = await executor.query(
    `SELECT group_id, user_name
      FROM community_typing_state
      WHERE group_id = ANY($1::text[])
        AND expires_at > now()
      ORDER BY updated_at ASC`,
    [groupIds],
  );

  const typingUsers = new Map<string, string[]>();
  for (const row of result.rows as Array<{ group_id: string; user_name: string }>) {
    const current = typingUsers.get(row.group_id) || [];
    current.push(row.user_name);
    typingUsers.set(row.group_id, current);
  }

  return typingUsers;
}

async function loadMembershipRow(
  executor: QueryExecutor,
  groupId: string,
  userId: string,
): Promise<MembershipRow | null> {
  const result = await executor.query(
    `SELECT
        membership.group_id,
        membership.user_id,
        membership.role,
        membership.status,
        membership.joined_at,
        membership.requested_at,
        membership.invited_at,
        membership.added_by,
        membership.updated_at,
        membership.status_reason,
        membership.muted_until,
        membership.suspended_until,
        membership.banned_at,
        NULLIF(TRIM(users.name), '') AS user_name,
        users.email AS user_email
      FROM community_group_members membership
      LEFT JOIN users ON users.id::text = membership.user_id
      WHERE membership.group_id = $1 AND membership.user_id = $2
      LIMIT 1`,
    [groupId, userId],
  );

  return (result.rows[0] as MembershipRow | undefined) ?? null;
}

async function listMembershipRows(executor: QueryExecutor, groupId: string): Promise<MembershipRow[]> {
  const result = await executor.query(
    `SELECT
        membership.group_id,
        membership.user_id,
        membership.role,
        membership.status,
        membership.joined_at,
        membership.requested_at,
        membership.invited_at,
        membership.added_by,
        membership.updated_at,
        membership.status_reason,
        membership.muted_until,
        membership.suspended_until,
        membership.banned_at,
        NULLIF(TRIM(users.name), '') AS user_name,
        users.email AS user_email
      FROM community_group_members membership
      LEFT JOIN users ON users.id::text = membership.user_id
      WHERE membership.group_id = $1
      ORDER BY membership.updated_at DESC, membership.joined_at DESC NULLS LAST, membership.user_id ASC`,
    [groupId],
  );

  return result.rows as MembershipRow[];
}

async function loadPendingInvitationRow(
  executor: QueryExecutor,
  groupId: string,
  userId: string,
  options?: { forUpdate?: boolean },
): Promise<InvitationRow | null> {
  const forUpdateClause = options?.forUpdate ? " FOR UPDATE" : "";
  const result = await executor.query(
    `SELECT
        invitation.id,
        invitation.group_id,
        invitation.invited_user_id,
        invitation.invited_by_user_id,
        invitation.status,
        invitation.note,
        invitation.expires_at,
        invitation.accepted_at,
        invitation.revoked_at,
        invitation.revoked_by_user_id,
        invitation.created_at
      FROM community_group_invitations invitation
      WHERE invitation.group_id = $1
        AND invitation.invited_user_id = $2
        AND invitation.status = 'pending'
      ORDER BY invitation.created_at DESC
      LIMIT 1${forUpdateClause}`,
    [groupId, userId],
  );

  return (result.rows[0] as InvitationRow | undefined) ?? null;
}

async function communityGroupExists(
  executor: QueryExecutor,
  groupId: string,
): Promise<boolean> {
  const result = await executor.query<{ id: string }>(
    `SELECT id
       FROM community_groups
      WHERE id = $1
      LIMIT 1`,
    [groupId],
  );

  return result.rows.length > 0;
}

async function loadReportRow(
  executor: QueryExecutor,
  groupId: string,
  reportId: string,
  options?: { forUpdate?: boolean },
): Promise<ReportRow | null> {
  const forUpdateClause = options?.forUpdate ? " FOR UPDATE" : "";
  const result = await executor.query(
    `SELECT
        id,
        group_id,
        reporter_user_id,
        target_type,
        target_id,
        reason_category,
        description,
        status,
        assigned_reviewer_id,
        resolution,
        appeal_status,
        audit_event_id,
        created_at,
        updated_at,
        resolved_at,
        resolved_by_user_id
      FROM community_reports
      WHERE group_id = $1 AND id = $2
      LIMIT 1${forUpdateClause}`,
    [groupId, reportId],
  );

  return (result.rows[0] as ReportRow | undefined) ?? null;
}

async function loadReportRows(
  executor: QueryExecutor,
  groupId: string,
  options?: { reporterUserId?: string },
): Promise<ReportRow[]> {
  const params: unknown[] = [groupId];
  let reporterClause = "";
  if (options?.reporterUserId) {
    params.push(options.reporterUserId);
    reporterClause = ` AND reporter_user_id = $${params.length}`;
  }

  const result = await executor.query(
    `SELECT
        id,
        group_id,
        reporter_user_id,
        target_type,
        target_id,
        reason_category,
        description,
        status,
        assigned_reviewer_id,
        resolution,
        appeal_status,
        audit_event_id,
        created_at,
        updated_at,
        resolved_at,
        resolved_by_user_id
      FROM community_reports
      WHERE group_id = $1${reporterClause}
      ORDER BY updated_at DESC, created_at DESC, id DESC`,
    params,
  );

  return result.rows as ReportRow[];
}

async function loadReportLinkedActionIds(
  executor: QueryExecutor,
  reportIds: string[],
): Promise<Map<string, string[]>> {
  if (reportIds.length === 0) {
    return new Map();
  }

  const result = await executor.query<{ report_id: string; action_ids: string[] }>(
    `SELECT report_id, array_agg(id ORDER BY created_at ASC, id ASC) AS action_ids
       FROM community_moderation_actions
      WHERE report_id = ANY($1::text[])
      GROUP BY report_id`,
    [reportIds],
  );

  return new Map(result.rows.map((row) => [row.report_id, row.action_ids ?? []]));
}

async function loadModerationActionRow(
  executor: QueryExecutor,
  groupId: string,
  actionId: string,
  options?: { forUpdate?: boolean },
): Promise<ModerationActionRow | null> {
  const forUpdateClause = options?.forUpdate ? " FOR UPDATE" : "";
  const result = await executor.query(
    `SELECT
        id,
        group_id,
        actor_user_id,
        actor_role,
        target_type,
        target_id,
        action_type,
        reason,
        duration,
        report_id,
        previous_state,
        resulting_state,
        audit_event_id,
        created_at
      FROM community_moderation_actions
      WHERE group_id = $1 AND id = $2
      LIMIT 1${forUpdateClause}`,
    [groupId, actionId],
  );

  return (result.rows[0] as ModerationActionRow | undefined) ?? null;
}

async function loadAppealRow(
  executor: QueryExecutor,
  groupId: string,
  appealId: string,
  options?: { forUpdate?: boolean },
): Promise<AppealRow | null> {
  const forUpdateClause = options?.forUpdate ? " FOR UPDATE" : "";
  const result = await executor.query(
    `SELECT
        id,
        group_id,
        moderation_action_id,
        audit_event_id,
        appellant_user_id,
        reason,
        status,
        resolution_outcome,
        resolution_reason,
        resolved_by_user_id,
        created_at,
        updated_at,
        resolved_at
      FROM community_appeals
      WHERE group_id = $1 AND id = $2
      LIMIT 1${forUpdateClause}`,
    [groupId, appealId],
  );

  return (result.rows[0] as AppealRow | undefined) ?? null;
}

async function loadAppealRows(
  executor: QueryExecutor,
  groupId: string,
  options?: { appellantUserId?: string },
): Promise<AppealRow[]> {
  const params: unknown[] = [groupId];
  let appellantClause = "";
  if (options?.appellantUserId) {
    params.push(options.appellantUserId);
    appellantClause = ` AND appellant_user_id = $${params.length}`;
  }

  const result = await executor.query(
    `SELECT
        id,
        group_id,
        moderation_action_id,
        audit_event_id,
        appellant_user_id,
        reason,
        status,
        resolution_outcome,
        resolution_reason,
        resolved_by_user_id,
        created_at,
        updated_at,
        resolved_at
      FROM community_appeals
      WHERE group_id = $1${appellantClause}
      ORDER BY updated_at DESC, created_at DESC, id DESC`,
    params,
  );

  return result.rows as AppealRow[];
}

async function expirePendingInvitations(
  executor: QueryExecutor,
  groupId: string,
  userId?: string,
): Promise<void> {
  const params = userId ? [groupId, userId] : [groupId];
  const userFilter = userId ? "AND invited_user_id = $2" : "";

  await executor.query(
    `WITH expired AS (
        UPDATE community_group_invitations
           SET status = 'expired'
         WHERE group_id = $1
           AND status = 'pending'
           AND expires_at <= now()
           ${userFilter}
         RETURNING invited_user_id
      )
      DELETE FROM community_group_members membership
       USING expired
       WHERE membership.group_id = $1
         AND membership.user_id = expired.invited_user_id
         AND membership.status = 'invited'`,
    params,
  );
}

async function normalizeExpiredMembershipStates(
  executor: QueryExecutor,
  options?: { groupId?: string; userId?: string },
): Promise<void> {
  const filters: string[] = [];
  const params: unknown[] = [];

  if (options?.groupId) {
    params.push(options.groupId);
    filters.push(`group_id = $${params.length}`);
  }

  if (options?.userId) {
    params.push(options.userId);
    filters.push(`user_id = $${params.length}`);
  }

  const scopedFilter = filters.length > 0 ? ` AND ${filters.join(" AND ")}` : "";

  await executor.query(
    `UPDATE community_group_members
        SET status = 'active',
            updated_at = now(),
            status_reason = NULL,
            muted_until = NULL
      WHERE status = 'muted'
        AND muted_until IS NOT NULL
        AND muted_until <= now()
        ${scopedFilter}`,
    params,
  );

  const restoredSuspensions = await executor.query<{ group_id: string }>(
    `UPDATE community_group_members
        SET status = 'active',
            updated_at = now(),
            status_reason = NULL,
            suspended_until = NULL
      WHERE status = 'suspended'
        AND suspended_until IS NOT NULL
        AND suspended_until <= now()
        ${scopedFilter}
      RETURNING group_id`,
    params,
  );

  const memberCountRestorations = new Map<string, number>();
  for (const row of restoredSuspensions.rows as Array<{ group_id: string }>) {
    memberCountRestorations.set(row.group_id, (memberCountRestorations.get(row.group_id) ?? 0) + 1);
  }

  for (const [groupId, delta] of memberCountRestorations) {
    await adjustGroupMemberCount(executor, groupId, delta);
  }
}

function clampCommunityMuteDurationHours(value?: number): number {
  const candidate = typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : 24;

  return Math.min(Math.max(candidate, 1), 168);
}

function resolveCommunitySuspensionWindow(duration: CommunitySuspensionDuration): {
  duration: CommunitySuspensionDuration;
  suspendedUntil: string;
} {
  let durationHours = 30 * 24;
  if (duration === "24h") {
    durationHours = 24;
  } else if (duration === "7d") {
    durationHours = 7 * 24;
  }

  return {
    duration,
    suspendedUntil: new Date(Date.now() + (durationHours * 60 * 60 * 1000)).toISOString(),
  };
}

function buildMembershipAuditSnapshot(row: MembershipRow | null): Record<string, unknown> | null {
  if (!row) {
    return null;
  }

  const membership = mapMembershipRow(row);
  return {
    groupId: membership.groupId,
    userId: membership.userId,
    role: membership.role,
    status: membership.status,
    requestedAt: membership.requestedAt ?? null,
    invitedAt: membership.invitedAt ?? null,
    invitedByUserId: membership.invitedByUserId ?? null,
    joinedAt: membership.joinedAt ?? null,
    mutedUntil: membership.mutedUntil ?? null,
    suspendedUntil: membership.suspendedUntil ?? null,
    bannedAt: membership.bannedAt ?? null,
    reason: membership.reason ?? null,
  };
}

function buildInvitationAuditSnapshot(row: InvitationRow | null): Record<string, unknown> | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    groupId: row.group_id,
    invitedUserId: row.invited_user_id,
    invitedByUserId: row.invited_by_user_id,
    status: row.status,
    note: row.note ?? null,
    expiresAt: toIsoString(row.expires_at),
    acceptedAt: row.accepted_at ? toIsoString(row.accepted_at) : null,
    revokedAt: row.revoked_at ? toIsoString(row.revoked_at) : null,
    revokedByUserId: row.revoked_by_user_id ?? null,
    createdAt: toIsoString(row.created_at),
  };
}

function mapReportRow(row: ReportRow, linkedModerationActionIds: string[]): CommunityReport {
  return {
    id: row.id,
    reporterId: row.reporter_user_id,
    groupId: row.group_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reasonCategory: row.reason_category,
    description: row.description ?? undefined,
    status: row.status,
    assignedReviewerId: row.assigned_reviewer_id ?? undefined,
    resolution: row.resolution ?? undefined,
    linkedModerationActionIds: linkedModerationActionIds.length > 0 ? linkedModerationActionIds : undefined,
    appealStatus: row.appeal_status ?? undefined,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function buildReportAuditSnapshot(row: ReportRow, linkedModerationActionIds: string[]): Record<string, unknown> {
  const report = mapReportRow(row, linkedModerationActionIds);
  return {
    id: report.id,
    reporterId: report.reporterId,
    groupId: report.groupId,
    targetType: report.targetType,
    targetId: report.targetId,
    reasonCategory: report.reasonCategory,
    description: report.description ?? null,
    status: report.status,
    assignedReviewerId: report.assignedReviewerId ?? null,
    resolution: report.resolution ?? null,
    linkedModerationActionIds: report.linkedModerationActionIds ?? [],
    appealStatus: report.appealStatus ?? null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt ?? null,
  };
}

function mapAppealRow(row: AppealRow): CommunityAppeal {
  return {
    id: row.id,
    groupId: row.group_id,
    moderationActionId: row.moderation_action_id,
    auditEventId: row.audit_event_id,
    appellantId: row.appellant_user_id,
    reason: row.reason,
    status: row.status,
    resolutionOutcome: row.resolution_outcome ?? undefined,
    resolutionReason: row.resolution_reason ?? undefined,
    resolvedByUserId: row.resolved_by_user_id ?? undefined,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    resolvedAt: row.resolved_at ? toIsoString(row.resolved_at) : undefined,
  };
}

function buildAppealAuditSnapshot(row: AppealRow): Record<string, unknown> {
  const appeal = mapAppealRow(row);
  return {
    id: appeal.id,
    groupId: appeal.groupId,
    moderationActionId: appeal.moderationActionId,
    auditEventId: appeal.auditEventId,
    appellantId: appeal.appellantId,
    reason: appeal.reason,
    status: appeal.status,
    resolutionOutcome: appeal.resolutionOutcome ?? null,
    resolutionReason: appeal.resolutionReason ?? null,
    resolvedByUserId: appeal.resolvedByUserId ?? null,
    createdAt: appeal.createdAt,
    updatedAt: appeal.updatedAt ?? null,
    resolvedAt: appeal.resolvedAt ?? null,
  };
}

function isAppealableModerationActionType(actionType: CommunityModerationActionType): boolean {
  return actionType === "member_warned"
    || actionType === "member_muted"
    || actionType === "member_suspended"
    || actionType === "member_removed"
    || actionType === "member_banned";
}

function isConstraintViolation(error: unknown, constraint: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  const actualConstraint = "constraint" in error ? error.constraint : undefined;
  return code === "23505" && actualConstraint === constraint;
}

function parseMembershipAuditSnapshot(value: unknown): MembershipAuditSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const snapshot = value as Record<string, unknown>;
  if (typeof snapshot.groupId !== "string" || typeof snapshot.userId !== "string") {
    return null;
  }

  const status = typeof snapshot.status === "string"
    ? toCommunityMembershipStatus(snapshot.status)
    : null;
  const role = snapshot.role === "member" || snapshot.role === "moderator" || snapshot.role === "owner"
    ? snapshot.role
    : null;

  const readNullableString = (candidate: unknown): string | null => typeof candidate === "string" ? candidate : null;

  return {
    groupId: snapshot.groupId,
    userId: snapshot.userId,
    role,
    status,
    requestedAt: readNullableString(snapshot.requestedAt),
    invitedAt: readNullableString(snapshot.invitedAt),
    invitedByUserId: readNullableString(snapshot.invitedByUserId),
    joinedAt: readNullableString(snapshot.joinedAt),
    mutedUntil: readNullableString(snapshot.mutedUntil),
    suspendedUntil: readNullableString(snapshot.suspendedUntil),
    bannedAt: readNullableString(snapshot.bannedAt),
    reason: readNullableString(snapshot.reason),
  };
}

async function validateCommunityReportTarget(
  executor: QueryExecutor,
  groupId: string,
  targetType: CommunityReportTargetType,
  targetId: string,
): Promise<boolean> {
  if (targetType === "group") {
    return targetId === groupId && await communityGroupExists(executor, groupId);
  }

  if (targetType === "member") {
    return Boolean(await loadMembershipRow(executor, groupId, targetId));
  }

  if (targetType === "message") {
    const result = await executor.query<{ id: string }>(
      `SELECT id
         FROM community_messages
        WHERE group_id = $1 AND id = $2
        LIMIT 1`,
      [groupId, targetId],
    );
    return result.rows.length > 0;
  }

  return Boolean(await loadModerationActionRow(executor, groupId, targetId));
}

async function restoreMembershipFromAppealSnapshot(
  executor: QueryExecutor,
  groupId: string,
  userId: string,
  snapshot: MembershipAuditSnapshot | null,
  actorId: string,
): Promise<MembershipRow | null> {
  if (!snapshot?.status) {
    await executor.query(
      `DELETE FROM community_group_members
        WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId],
    );
    return null;
  }

  const existing = await loadMembershipRow(executor, groupId, userId);
  if (existing) {
    await executor.query(
      `UPDATE community_group_members
          SET role = $3,
              status = $4,
              joined_at = $5::timestamptz,
              requested_at = $6::timestamptz,
              invited_at = $7::timestamptz,
              added_by = $8,
              updated_at = now(),
              status_reason = $9,
              status_updated_by = $10,
              muted_until = $11::timestamptz,
              suspended_until = $12::timestamptz,
              removed_at = NULL,
              left_at = NULL,
              banned_at = $13::timestamptz,
              rejected_at = NULL
        WHERE group_id = $1 AND user_id = $2`,
      [
        groupId,
        userId,
        snapshot.role ?? "member",
        snapshot.status,
        snapshot.joinedAt,
        snapshot.requestedAt,
        snapshot.invitedAt,
        snapshot.invitedByUserId,
        snapshot.reason,
        actorId,
        snapshot.status === "muted" ? snapshot.mutedUntil : null,
        snapshot.status === "suspended" ? snapshot.suspendedUntil : null,
        snapshot.status === "banned" ? snapshot.bannedAt : null,
      ],
    );
  } else {
    await executor.query(
      `INSERT INTO community_group_members (
          group_id,
          user_id,
          role,
          status,
          joined_at,
          requested_at,
          invited_at,
          added_by,
          updated_at,
          status_reason,
          status_updated_by,
          muted_until,
          suspended_until,
          removed_at,
          left_at,
          banned_at,
          rejected_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::timestamptz,
          $6::timestamptz,
          $7::timestamptz,
          $8,
          now(),
          $9,
          $10,
          $11::timestamptz,
          $12::timestamptz,
          NULL,
          NULL,
          $13::timestamptz,
          NULL
        )`,
      [
        groupId,
        userId,
        snapshot.role ?? "member",
        snapshot.status,
        snapshot.joinedAt,
        snapshot.requestedAt,
        snapshot.invitedAt,
        snapshot.invitedByUserId,
        snapshot.reason,
        actorId,
        snapshot.status === "muted" ? snapshot.mutedUntil : null,
        snapshot.status === "suspended" ? snapshot.suspendedUntil : null,
        snapshot.status === "banned" ? snapshot.bannedAt : null,
      ],
    );
  }

  return loadMembershipRow(executor, groupId, userId);
}

async function applyAppealOutcomeToMembership(
  executor: QueryExecutor,
  groupId: string,
  moderationAction: ModerationActionRow,
  appellantUserId: string,
  actorId: string,
  outcome: CommunityAppealOutcome,
): Promise<{
  previousStatus: CommunityGroupMemberStatus | null;
  nextStatus: CommunityGroupMemberStatus | null;
}> {
  const previousMembership = await loadMembershipRow(executor, groupId, appellantUserId);
  const previousStatus = previousMembership ? getEffectiveMembershipStatusFromMembershipRow(previousMembership) : null;
  let nextStatus = previousStatus;

  if (
    outcome !== "upheld"
    && moderationAction.target_type === "member"
    && moderationAction.target_id === appellantUserId
  ) {
    const snapshot = parseMembershipAuditSnapshot(moderationAction.previous_state);
    const restoredMembership = await restoreMembershipFromAppealSnapshot(
      executor,
      groupId,
      appellantUserId,
      snapshot,
      actorId,
    );
    nextStatus = restoredMembership ? getEffectiveMembershipStatusFromMembershipRow(restoredMembership) : snapshot?.status ?? null;
    await adjustGroupMemberCount(executor, groupId, getMembershipCountDelta(previousStatus, nextStatus));
  }

  return { previousStatus, nextStatus };
}

async function syncReportAfterAppealResolution(
  executor: QueryExecutor,
  groupId: string,
  moderationAction: ModerationActionRow,
  actorId: string,
  resolutionReason: string,
  resolvedAt: string,
): Promise<CommunityReport | null> {
  if (!moderationAction.report_id) {
    return null;
  }

  await executor.query(
    `UPDATE community_reports
        SET status = 'resolved',
            appeal_status = 'resolved',
            resolution = COALESCE(resolution, $3),
            updated_at = $4::timestamptz,
            resolved_at = COALESCE(resolved_at, $4::timestamptz),
            resolved_by_user_id = COALESCE(resolved_by_user_id, $2)
      WHERE group_id = $1 AND id = $5`,
    [groupId, actorId, resolutionReason, resolvedAt, moderationAction.report_id],
  );

  const reportRow = await loadReportRow(executor, groupId, moderationAction.report_id);
  if (!reportRow) {
    return null;
  }

  const linkedActionIds = await loadReportLinkedActionIds(executor, [reportRow.id]);
  return mapReportRow(reportRow, linkedActionIds.get(reportRow.id) ?? []);
}

async function insertAdminAuditEventInTransaction(
  executor: QueryExecutor,
  event: AdminAuditEvent,
): Promise<void> {
  await executor.query(
    `INSERT INTO admin_audit_events (
        id,
        event_type,
        actor_id,
        entity_type,
        entity_id,
        before_state,
        after_state,
        reason,
        approval_id,
        request_id,
        ip,
        user_agent,
        immutable_hash,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7::jsonb,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14::timestamptz
      )`,
    [
      event.id,
      event.eventType,
      event.actorId,
      event.entityType,
      event.entityId ?? null,
      JSON.stringify(event.before ?? null),
      JSON.stringify(event.after ?? null),
      event.reason ?? null,
      event.approvalId ?? null,
      event.requestId ?? null,
      event.ip ?? null,
      event.userAgent ?? null,
      event.immutableHash ?? null,
      event.createdAt,
    ],
  );
}

async function recordCommunityModerationAction(
  executor: QueryExecutor,
  params: {
    groupId: string;
    actor: CommunityActor;
    entityType: string;
    entityId: string;
    targetId: string;
    targetType?: "group" | "member" | "message" | "report";
    actionType: CommunityModerationActionType;
    reason: string;
    duration?: CommunityModerationDuration | null;
    reportId?: string | null;
    beforeState?: unknown;
    afterState?: unknown;
  },
): Promise<void> {
  const auditEvent = createAdminAuditEvent({
    eventType: `community.${params.actionType}`,
    actorId: params.actor.id,
    entityType: params.entityType,
    entityId: params.entityId,
    before: params.beforeState,
    after: params.afterState,
    reason: params.reason,
  });

  await insertAdminAuditEventInTransaction(executor, auditEvent);

  await executor.query(
    `INSERT INTO community_moderation_actions (
        id,
        group_id,
        actor_user_id,
        actor_role,
        target_type,
        target_id,
        action_type,
        reason,
        duration,
        report_id,
        previous_state,
        resulting_state,
        audit_event_id,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11::jsonb,
        $12::jsonb,
        $13,
        now()
      )`,
    [
      `community_moderation_${randomUUID()}`,
      params.groupId,
      params.actor.id,
      params.actor.role,
      params.targetType ?? "member",
      params.targetId,
      params.actionType,
      params.reason,
      params.duration ?? null,
      params.reportId ?? null,
      JSON.stringify(params.beforeState ?? null),
      JSON.stringify(params.afterState ?? null),
      auditEvent.id,
    ],
  );
}

async function adjustGroupMemberCount(executor: QueryExecutor, groupId: string, delta: number): Promise<void> {
  if (delta === 0) {
    return;
  }

  await executor.query(
    `UPDATE community_groups
        SET member_count = GREATEST(0, member_count + $2),
            updated_at = now()
      WHERE id = $1`,
    [groupId, delta],
  );
}

async function ensureGroupHasCapacity(executor: QueryExecutor, groupId: string): Promise<boolean> {
  const result = await executor.query<{ member_count: number; member_limit: number }>(
    `SELECT member_count, member_limit
       FROM community_groups
      WHERE id = $1
      FOR UPDATE`,
    [groupId],
  );

  const row = result.rows[0];
  if (!row) {
    return false;
  }

  return Number(row.member_count || 0) < Number(row.member_limit || 0);
}

async function loadLiveSessions(executor: QueryExecutor, groupIds: string[]): Promise<LiveSession[]> {
  if (groupIds.length === 0) {
    return [];
  }

  const result = await executor.query(
    `SELECT id, group_id, title, host_name, starts_at, ends_at, status, join_url, recording_url
      FROM community_live_sessions
      WHERE group_id IS NULL OR group_id = ANY($1::text[])
      ORDER BY starts_at DESC, id ASC`,
    [groupIds],
  );

  return (result.rows as LiveSessionRow[]).map(mapLiveSessionRow);
}

async function loadMessagesForGroup(executor: QueryExecutor, groupId: string, viewerId?: string): Promise<CommunityMessage[]> {
  return (await loadMessagesPageForGroup(executor, groupId, undefined, viewerId)).messages;
}

async function loadMessagesPageForGroup(
  executor: QueryExecutor,
  groupId: string,
  options?: CommunityDetailOptions,
  viewerId?: string,
): Promise<{ messages: CommunityMessage[]; page: CommunityMessagePage }> {
  const requestedLimit = normalizeCommunityPageLimit(options?.limit);
  const rowLimit = requestedLimit + 1;
  const searchValue = normalizeCommunityMessageSearch(options?.search);
  let result: { rows: any[]; rowCount?: number | null };

  if (options?.beforeMessageId) {
    const anchorResult = await executor.query(
      `SELECT id, created_at
       FROM community_messages
       WHERE group_id = $1 AND id = $2
       LIMIT 1`,
      [groupId, options.beforeMessageId],
    );

    const anchor = anchorResult.rows[0] as { id: string; created_at: string | Date } | undefined;
    if (!anchor) {
      return {
        messages: [],
        page: {
          requestedLimit,
          hasOlder: false,
        },
      };
    }

    const pageQuery = buildCommunityMessagePageQuery({
      groupId,
      rowLimit,
      searchValue,
      filter: options?.filter,
      viewerId,
      before: {
        createdAt: anchor.created_at,
        id: anchor.id,
      },
    });
    result = await executor.query(pageQuery.text, pageQuery.params);
  } else {
    const pageQuery = buildCommunityMessagePageQuery({
      groupId,
      rowLimit,
      searchValue,
      filter: options?.filter,
      viewerId,
    });
    result = await executor.query(pageQuery.text, pageQuery.params);
  }

  const rawRows = result.rows as MessageRow[];
  const hasOlder = rawRows.length > requestedLimit;
  const pageRowsDescending = rawRows.slice(0, requestedLimit);
  const pageRows = pageRowsDescending.slice().reverse();
  const oldestMessage = pageRows[0];
  const newestMessage = pageRows.at(-1);

  return {
    messages: await hydrateCommunityMessages(executor, pageRows, viewerId),
    page: {
      requestedLimit,
      oldestMessageId: oldestMessage?.id,
      newestMessageId: newestMessage?.id,
      olderCursor: hasOlder ? oldestMessage?.id : undefined,
      hasOlder,
    },
  };
}

async function listCommunityMessagesPage(
  executor: QueryExecutor,
  groupId: string,
  options?: CommunityDetailOptions,
  viewerId?: string,
): Promise<{ messages: CommunityMessage[]; pageInfo: CommunityMessagePageInfo }> {
  const requestedLimit = normalizeCommunityPageLimit(options?.limit);
  const rowLimit = requestedLimit + 1;
  const searchValue = normalizeCommunityMessageSearch(options?.search);
  let result: { rows: any[]; rowCount?: number | null };

  const beforeCursor = decodeCommunityMessageCursor(options?.beforeCursor);
  if (options?.beforeCursor && !beforeCursor) {
    throw new Error("community_invalid_cursor");
  }

  if (beforeCursor && beforeCursor.groupId !== groupId) {
    throw new Error("community_invalid_cursor");
  }

  if (beforeCursor) {
    const pageQuery = buildCommunityMessagePageQuery({
      groupId,
      rowLimit,
      searchValue,
      filter: options?.filter,
      viewerId,
      before: {
        createdAt: beforeCursor.createdAt,
        id: beforeCursor.id,
      },
    });
    result = await executor.query(pageQuery.text, pageQuery.params);
  } else {
    const pageQuery = buildCommunityMessagePageQuery({
      groupId,
      rowLimit,
      searchValue,
      filter: options?.filter,
      viewerId,
    });
    result = await executor.query(pageQuery.text, pageQuery.params);
  }

  const rawRows = result.rows as MessageRow[];
  const hasMoreBefore = rawRows.length > requestedLimit;
  const pageRowsDescending = rawRows.slice(0, requestedLimit);
  const pageRows = pageRowsDescending.slice().reverse();
  const oldestMessage = pageRows[0];
  const newestMessage = pageRows.at(-1);

  return {
    messages: await hydrateCommunityMessages(executor, pageRows, viewerId),
    pageInfo: {
      hasMoreBefore,
      startCursor: hasMoreBefore && oldestMessage
        ? encodeCommunityMessageCursor(groupId, toIsoString(oldestMessage.created_at), oldestMessage.id)
        : null,
      endCursor: newestMessage
        ? encodeCommunityMessageCursor(groupId, toIsoString(newestMessage.created_at), newestMessage.id)
        : null,
    },
  };
}

async function loadReadStateForGroup(
  executor: QueryExecutor,
  groupId: string,
  viewer: CommunityViewer | undefined,
  unreadCount: number,
): Promise<CommunityReadState> {
  if (!viewer?.id) {
    return { unreadCount: 0 };
  }

  const result = await executor.query(
    `SELECT last_read_message_id, last_read_at
     FROM community_group_read_state
     WHERE group_id = $1 AND user_id = $2
     LIMIT 1`,
    [groupId, viewer.id],
  );

  const row = result.rows[0] as ReadStateRow | undefined;
  return {
    unreadCount,
    lastReadMessageId: row?.last_read_message_id || undefined,
    lastReadAt: row?.last_read_at ? toIsoString(row.last_read_at) : undefined,
  };
}

async function buildGroupViews(
  executor: QueryExecutor,
  rows: GroupRow[],
  viewer?: CommunityViewer,
): Promise<CommunityGroupView[]> {
  if (rows.length === 0) {
    return [];
  }

  const groupIds = rows.map((row) => row.id);
  const [latestMessages, unreadCounts, typingUsers] = await Promise.all([
    loadLatestMessages(executor, groupIds, viewer?.id),
    loadUnreadCounts(executor, groupIds, viewer?.id),
    loadTypingUsers(executor, groupIds),
  ]);

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const groups = rows.map((row) => {
    const latestMessage = latestMessages.get(row.id);
    const group: CommunityGroupView = {
      id: row.id,
      communityId: row.community_id,
      name: row.name,
      description: row.description || undefined,
      category: row.category,
      memberCount: Number(row.member_count || 0),
      memberLimit: Number(row.member_limit || 0),
      unreadCount: unreadCounts.get(row.id) ?? 0,
      lastMessagePreview: buildMessagePreview(latestMessage),
      lastMessageAt: latestMessage ? toIsoString(latestMessage.created_at) : undefined,
      pinnedMessageId: row.pinned_message_id || undefined,
      isOfficial: Boolean(row.is_official),
      typingUsers: typingUsers.get(row.id) || [],
      visibility: row.visibility,
      currentMembership: buildCommunityMembershipSummary(row, viewer),
      actorPermissions: resolveCommunityGroupPermissions(row, viewer),
    };
    return group;
  });

  groups.sort((left, right) => {
    const leftRow = rowById.get(left.id);
    const rightRow = rowById.get(right.id);
    const leftTs = Date.parse(left.lastMessageAt || toIsoString(leftRow?.created_at));
    const rightTs = Date.parse(right.lastMessageAt || toIsoString(rightRow?.created_at));
    if (rightTs !== leftTs) {
      return rightTs - leftTs;
    }

    return left.name.localeCompare(right.name, "ar-LB");
  });

  return groups;
}

async function buildGroupViewFromRow(
  executor: QueryExecutor,
  row: GroupRow,
  viewer?: CommunityViewer,
): Promise<CommunityGroupView | null> {
  const views = await buildGroupViews(executor, [row], viewer);
  return views[0] ?? null;
}

async function readGroupView(executor: QueryExecutor, groupId: string, viewer?: CommunityViewer): Promise<CommunityGroupView | null> {
  const row = await fetchSingleGroupRow(executor, groupId, viewer);
  if (!row || getGroupAccessCode(row, viewer, false)) {
    return null;
  }

  const views = await buildGroupViews(executor, [row], viewer);
  return views[0] ?? null;
}

async function requireGroupAccess(
  executor: QueryExecutor,
  groupId: string,
  viewer: CommunityViewer | undefined,
  requireAuthenticated: boolean,
): Promise<CommunityResult<GroupRow>> {
  return requireGroupAccessWithResolver(executor, groupId, viewer, requireAuthenticated, getGroupAccessCode);
}

async function requireGroupAccessWithResolver(
  executor: QueryExecutor,
  groupId: string,
  viewer: CommunityViewer | undefined,
  requireAuthenticated: boolean,
  resolver: (row: GroupRow, viewer: CommunityViewer | undefined, requireAuthenticated: boolean) => CommunityServiceErrorCode | null,
): Promise<CommunityResult<GroupRow>> {
  const row = await fetchSingleGroupRow(executor, groupId, viewer);
  if (!row) {
    return { ok: false, code: "community_group_not_found" };
  }

  const accessCode = resolver(row, viewer, requireAuthenticated);
  if (accessCode) {
    return { ok: false, code: accessCode };
  }

  return { ok: true, value: row };
}

async function requireGroupWriteAccess(
  executor: QueryExecutor,
  groupId: string,
  viewer: CommunityViewer | undefined,
  requireAuthenticated: boolean,
): Promise<CommunityResult<GroupRow>> {
  return requireGroupAccessWithResolver(executor, groupId, viewer, requireAuthenticated, getGroupWriteAccessCode);
}

async function requireGroupPresenceAccess(
  executor: QueryExecutor,
  groupId: string,
  viewer: CommunityViewer | undefined,
  requireAuthenticated: boolean,
): Promise<CommunityResult<GroupRow>> {
  return requireGroupAccessWithResolver(executor, groupId, viewer, requireAuthenticated, getGroupPresenceAccessCode);
}

export async function validateCommunityGroupAccess(
  groupId: string,
  viewer?: CommunityViewer,
  options?: { requireAuthenticated?: boolean },
): Promise<CommunityResult<CommunityGroupView>> {
  await ensureCommunitySeeded();

  const access = await requireGroupAccess(defaultExecutor, groupId, viewer, options?.requireAuthenticated === true);
  if (!access.ok) {
    return access;
  }

  const group = await readGroupView(defaultExecutor, groupId, viewer);
  if (!group) {
    return { ok: false, code: "community_group_not_found" };
  }

  return { ok: true, value: group };
}

export async function validateCommunityGroupWriteAccess(
  groupId: string,
  viewer?: CommunityViewer,
  options?: { requireAuthenticated?: boolean },
): Promise<CommunityResult<CommunityGroupView>> {
  await ensureCommunitySeeded();

  const access = await requireGroupWriteAccess(defaultExecutor, groupId, viewer, options?.requireAuthenticated === true);
  if (!access.ok) {
    return access;
  }

  const group = await readGroupView(defaultExecutor, groupId, viewer);
  if (!group) {
    return { ok: false, code: "community_group_not_found" };
  }

  return { ok: true, value: group };
}

export async function getLatestCommunityRealtimeSequence(groupId: string): Promise<string | null> {
  await ensureCommunitySeeded();

  const result = await query<{ id: string; created_at: string | Date }>(
    `SELECT id, created_at
       FROM community_message_events
      WHERE group_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [groupId],
  );

  const latest = result.rows[0];
  if (!latest) {
    return null;
  }

  return encodeCommunityRealtimeSequence(groupId, toIsoString(latest.created_at), latest.id);
}

async function insertMembership(
  executor: QueryExecutor,
  params: { groupId: string; userId: string; role: "member" | "moderator" | "owner"; addedBy?: string },
): Promise<boolean> {
  const result = await executor.query(
    `INSERT INTO community_group_members (
        group_id,
        user_id,
        role,
        status,
        added_by,
        updated_at,
        status_updated_by,
        status_reason,
        muted_until,
        suspended_until,
        removed_at,
        left_at,
        banned_at,
        rejected_at
      )
     VALUES ($1, $2, $3, 'active', $4, now(), $4, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
     ON CONFLICT (group_id, user_id) DO UPDATE
       SET role = EXCLUDED.role,
           status = 'active',
           added_by = EXCLUDED.added_by,
           updated_at = now(),
           status_updated_by = EXCLUDED.status_updated_by,
           status_reason = NULL,
           muted_until = NULL,
           suspended_until = NULL,
           removed_at = NULL,
           left_at = NULL,
           banned_at = NULL,
           rejected_at = NULL
     RETURNING user_id`,
    [params.groupId, params.userId, params.role, params.addedBy || null],
  );

  return Number(result.rowCount || 0) > 0;
}

async function ensureCommunitySeeded(): Promise<void> {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const marker = await client.query(
      `INSERT INTO community_seed_state (key, data)
       VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [COMMUNITY_SEED_KEY, stringifyJsonValue({ version: 1 })],
    );

    if (Number(marker.rowCount || 0) === 0) {
      await client.query("COMMIT");
      return;
    }

    for (const group of SEED_GROUPS) {
      await client.query(
        `INSERT INTO community_groups (
            id,
            community_id,
            name,
            description,
            category,
            member_count,
            is_official,
            visibility,
            last_message_at,
            pinned_message_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, NULL)
          ON CONFLICT (id) DO NOTHING`,
        [
          group.id,
          group.communityId,
          group.name,
          group.description || null,
          group.category,
          group.memberCount,
          Boolean(group.isOfficial),
          normalizeVisibility(group.visibility),
        ],
      );
    }

    for (const messages of Object.values(SEED_MESSAGES)) {
      for (const message of messages) {
        await client.query(
          `INSERT INTO community_messages (
              id,
              group_id,
              sender_id,
              sender_name,
              sender_role,
              type,
              body,
              attachment_url,
              created_at,
              edited_at,
              reply_to_message_id,
              reply_to_preview,
              mentions,
              deleted_for_everyone_at,
              deleted_for_everyone_by,
              deleted_for_everyone_by_id,
              is_pinned,
              client_request_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11, $12, NULL, NULL, NULL, $13, NULL)
            ON CONFLICT (id) DO NOTHING`,
          [
            message.id,
            message.groupId,
            message.senderId,
            message.senderName,
            message.senderRole,
            message.type,
            message.body || null,
            message.attachmentUrl || null,
            message.createdAt,
            message.replyToMessageId || null,
            message.replyToPreview ? stringifyJsonValue(message.replyToPreview) : null,
            message.mentions ? stringifyJsonValue(message.mentions) : null,
            Boolean(message.isPinned),
          ],
        );

        await client.query(
          `INSERT INTO community_message_events (
              message_id,
              group_id,
              actor_user_id,
              actor_display_name,
              event_type,
              payload,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            message.id,
            message.groupId,
            message.senderId,
            message.senderName,
            message.type === "announcement" ? "announcement" : "created",
            stringifyJsonValue({ seeded: true, type: message.type }),
            message.createdAt,
          ],
        );
      }
    }

    for (const session of SEED_LIVE_SESSIONS) {
      await client.query(
        `INSERT INTO community_live_sessions (
            id,
            group_id,
            title,
            host_name,
            starts_at,
            ends_at,
            status,
            join_url,
            recording_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE
            SET group_id = EXCLUDED.group_id,
                title = EXCLUDED.title,
                host_name = EXCLUDED.host_name,
                starts_at = EXCLUDED.starts_at,
                ends_at = EXCLUDED.ends_at,
                status = EXCLUDED.status,
                join_url = EXCLUDED.join_url,
                recording_url = EXCLUDED.recording_url`,
        [
          session.id,
          session.groupId || null,
          session.title,
          session.hostName,
          session.startsAt,
          session.endsAt || null,
          session.status,
          session.joinUrl || null,
          session.recordingUrl || null,
        ],
      );
    }

    await client.query(
      `WITH latest AS (
          SELECT DISTINCT ON (group_id) group_id, created_at
          FROM community_messages
          ORDER BY group_id, created_at DESC, id DESC
        ),
        pinned AS (
          SELECT DISTINCT ON (group_id) group_id, id
          FROM community_messages
          WHERE is_pinned = TRUE
          ORDER BY group_id, created_at DESC, id DESC
        )
        UPDATE community_groups g
           SET last_message_at = latest.created_at,
               pinned_message_id = pinned.id
          FROM latest
          LEFT JOIN pinned ON pinned.group_id = latest.group_id
         WHERE g.id = latest.group_id`,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function resetCommunityStore(): Promise<void> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `TRUNCATE
          community_appeals,
          community_moderation_actions,
          community_reports,
          community_group_invitations,
          community_message_attachments,
          community_message_events,
          community_group_read_state,
          community_typing_state,
          community_group_members,
          community_messages,
          community_live_sessions,
          community_groups,
          community_seed_state
        RESTART IDENTITY CASCADE`,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await ensureCommunitySeeded();
}

export async function listCommunityGroups(viewer?: CommunityViewer): Promise<CommunityOverview> {
  await ensureCommunitySeeded();
  await normalizeExpiredMembershipStates(defaultExecutor);

  const rows = await fetchGroupRows(defaultExecutor, viewer);
  const accessibleRows = rows.filter((row) => getGroupAccessCode(row, viewer, false) === null);
  const groups = await buildGroupViews(defaultExecutor, accessibleRows, viewer);
  const liveSessions = await loadLiveSessions(defaultExecutor, accessibleRows.map((row) => row.id));

  return {
    community: copyCommunity(),
    groups,
    liveSessions,
  };
}

export async function getCommunityGroupDetail(
  groupId: string,
  viewer?: CommunityViewer,
  options?: CommunityDetailOptions,
): Promise<CommunityResult<CommunityDetail>> {
  await ensureCommunitySeeded();

  const access = await requireGroupAccess(defaultExecutor, groupId, viewer, false);
  if (!access.ok) {
    return access;
  }

  const group = await readGroupView(defaultExecutor, groupId, viewer);
  if (!group) {
    return { ok: false, code: "community_group_not_found" };
  }

  const [messagePage, liveSessions, readState] = await Promise.all([
    loadMessagesPageForGroup(defaultExecutor, groupId, options, viewer?.id),
    loadLiveSessions(defaultExecutor, [groupId]),
    loadReadStateForGroup(defaultExecutor, groupId, viewer, group.unreadCount ?? 0),
  ]);

  return {
    ok: true,
    value: {
      community: copyCommunity(),
      group,
      messages: messagePage.messages,
      liveSession: liveSessions.find((session) => session.groupId === groupId) || null,
      page: messagePage.page,
      readState,
      currentMembership: buildCommunityMembershipSummary(access.value, viewer),
      actorPermissions: resolveCommunityGroupPermissions(access.value, viewer),
    },
  };
}

export async function getCommunityGroupMessagesPage(
  groupId: string,
  viewer?: CommunityViewer,
  options?: CommunityDetailOptions,
): Promise<CommunityResult<CommunityMessagesPage>> {
  await ensureCommunitySeeded();

  const access = await requireGroupAccess(defaultExecutor, groupId, viewer, false);
  if (!access.ok) {
    return access;
  }

  const group = await readGroupView(defaultExecutor, groupId, viewer);
  if (!group) {
    return { ok: false, code: "community_group_not_found" };
  }

  try {
    const [messagePage, readState, latestSequence] = await Promise.all([
      listCommunityMessagesPage(defaultExecutor, groupId, options, viewer?.id),
      loadReadStateForGroup(defaultExecutor, groupId, viewer, group.unreadCount ?? 0),
      getLatestCommunityRealtimeSequence(groupId),
    ]);

    return {
      ok: true,
      value: {
        groupId,
        messages: messagePage.messages,
        pageInfo: messagePage.pageInfo,
        latestSequence,
        readState: toNullableReadState(readState),
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "community_invalid_cursor") {
      return { ok: false, code: "community_invalid_cursor" };
    }

    throw error;
  }
}

export async function addCommunityMessage(
  groupId: string,
  message: CommunityMessageInput,
  options?: { viewer?: CommunityViewer },
): Promise<CommunityResult<CommunityMessage>> {
  await ensureCommunitySeeded();

  const viewer = options?.viewer;
  if (!viewer?.id && message.senderRole !== "system") {
    return { ok: false, code: "community_group_auth_required" };
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const access = await requireGroupWriteAccess(client, groupId, viewer, message.senderRole !== "system");
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorId = viewer?.id || message.senderId;
    if (message.clientRequestId && actorId) {
      const existing = await client.query(
        `SELECT
            id,
            group_id,
            sender_id,
            sender_name,
            sender_role,
            type,
            body,
            attachment_url,
            created_at,
            edited_at,
            reply_to_message_id,
            reply_to_preview,
            mentions,
            deleted_for_everyone_at,
            deleted_for_everyone_by,
            is_pinned,
            client_request_id
          FROM community_messages
          WHERE group_id = $1
            AND sender_id = $2
            AND client_request_id = $3
          ORDER BY created_at DESC, id DESC
          LIMIT 1`,
        [groupId, actorId, message.clientRequestId],
      );

      if (Number(existing.rowCount || 0) > 0) {
        const replayed = (existing.rows as MessageRow[])[0];
        emitCommunityServiceTelemetry({
          event: "community.idempotent_replay",
          level: "info",
          data: {
            groupId,
            messageId: replayed.id,
            actorId,
            actorRole: viewer?.role || message.senderRole,
          },
        });
        await client.query("COMMIT");
        return { ok: true, value: await hydrateCommunityMessage(client, replayed, viewer?.id || actorId) };
      }
    }

    const mentions = await resolveCommunityMessageMentionsForGroup(client, groupId, message.body);

    const inserted = await client.query(
      `INSERT INTO community_messages (
          id,
          group_id,
          sender_id,
          sender_name,
          sender_role,
          type,
          body,
          attachment_url,
          created_at,
          edited_at,
          reply_to_message_id,
          reply_to_preview,
          mentions,
          deleted_for_everyone_at,
          deleted_for_everyone_by,
          deleted_for_everyone_by_id,
          is_pinned,
          client_request_id,
          is_forwarded,
          forward_source_message_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11, $12, NULL, NULL, NULL, $13, $14, $15, $16)
        RETURNING
          id,
          group_id,
          sender_id,
          sender_name,
          sender_role,
          type,
          body,
          attachment_url,
          created_at,
          edited_at,
          reply_to_message_id,
          reply_to_preview,
          mentions,
          deleted_for_everyone_at,
          deleted_for_everyone_by,
          is_pinned,
          client_request_id,
          is_forwarded,
          forward_source_message_id`,
      [
        message.id,
        groupId,
        message.senderId,
        message.senderName,
        message.senderRole,
        message.type,
        message.body || null,
        message.attachmentUrl || null,
        message.createdAt,
        message.replyToMessageId || null,
        message.replyToPreview ? stringifyJsonValue(message.replyToPreview) : null,
        mentions ? stringifyJsonValue(mentions) : null,
        Boolean(message.isPinned),
        message.clientRequestId || null,
        Boolean(message.forwardSourceMessageId),
        message.forwardSourceMessageId || null,
      ],
    );

    await client.query(
      `UPDATE community_groups
          SET last_message_at = $2,
              pinned_message_id = CASE WHEN $3 THEN $4 ELSE pinned_message_id END,
              updated_at = now()
        WHERE id = $1`,
      [groupId, message.createdAt, Boolean(message.isPinned), message.id],
    );

    let clearedTypingState = false;
    if (actorId) {
      const typingDelete = await client.query(
        `DELETE FROM community_typing_state WHERE group_id = $1 AND user_id = $2 RETURNING user_id`,
        [groupId, actorId],
      );
      clearedTypingState = Number(typingDelete.rowCount || 0) > 0;
    }

    const eventRow = await insertMessageEvent(client, {
      messageId: message.id,
      groupId,
      actorUserId: actorId,
      actorDisplayName: message.senderName,
      eventType: message.type === "announcement" ? "announcement" : "created",
      payload: {
        clientRequestId: message.clientRequestId || null,
        type: message.type,
        replyToMessageId: message.replyToMessageId || null,
      },
    });

    await client.query("COMMIT");

    const persistedMessage = mapMessageRow((inserted.rows as MessageRow[])[0]);
    if (actorId && clearedTypingState) {
      emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
        eventId: randomUUID(),
        eventType: "community.typing.stopped",
        occurredAt: new Date().toISOString(),
        groupId,
        actorId,
        messageId: null,
        sequence: null,
        payload: {
          userId: actorId,
          userName: message.senderName,
        },
      }));
    }

    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: eventRow.id,
      eventType: "community.message.created",
      occurredAt: toIsoString(eventRow.created_at),
      groupId,
      actorId,
      messageId: persistedMessage.id,
      sequence: encodeCommunityRealtimeSequence(groupId, toIsoString(eventRow.created_at), eventRow.id),
      payload: {
        message: persistedMessage,
        clientRequestId: message.clientRequestId || null,
      },
    }));

    return { ok: true, value: persistedMessage };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function forwardCommunityMessage(
  destinationGroupId: string,
  sourceMessageId: string,
  clientRequestId: string,
  actor: CommunityActor,
): Promise<CommunityResult<CommunityMessage>> {
  await ensureCommunitySeeded();
  const client = await getClient();
  try {
    const sourceResult = await client.query(
      `SELECT id, group_id, type, sender_role, body, attachment_url, deleted_for_everyone_at
         FROM community_messages
        WHERE id = $1
        LIMIT 1`,
      [sourceMessageId],
    );
    if (
      Number(sourceResult.rowCount || 0) === 0
      || sourceResult.rows[0].deleted_for_everyone_at
      || sourceResult.rows[0].sender_role === "system"
      || sourceResult.rows[0].type === "announcement"
      || sourceResult.rows[0].type === "session_invite"
    ) {
      return { ok: false, code: "community_forward_source_invalid" };
    }

    const sourceGroupAccess = await requireGroupAccess(client, sourceResult.rows[0].group_id, actor, true);
    if (!sourceGroupAccess.ok) {
      return { ok: false, code: "community_forward_source_invalid" };
    }

    const source = sourceResult.rows[0];
    const result = await addCommunityMessage(destinationGroupId, {
      id: randomUUID(),
      groupId: destinationGroupId,
      senderId: actor.id,
      senderName: actor.displayName,
      senderRole: actor.role === "admin" || actor.role === "moderator" || actor.role === "superadmin" ? "admin" : "user",
      type: source.type,
      body: source.body || "",
      attachmentUrl: source.attachment_url || undefined,
      createdAt: new Date().toISOString(),
      clientRequestId,
      replyToMessageId: undefined,
      replyToPreview: undefined,
      isForwarded: true,
      forwardSourceMessageId: source.id,
    }, { viewer: { id: actor.id, role: actor.role } });
    return result;
  } finally {
    client.release();
  }
}

export async function editCommunityMessage(
  groupId: string,
  messageId: string,
  body: string,
  actor: CommunityActor,
): Promise<CommunityResult<{ message: CommunityMessage; group: CommunityGroupView }>> {
  await ensureCommunitySeeded();

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const currentMessageResult = await client.query(
      `SELECT
          id,
          group_id,
          sender_id,
          sender_name,
          sender_role,
          type,
          body,
          attachment_url,
          created_at,
          edited_at,
          reply_to_message_id,
          reply_to_preview,
          mentions,
          deleted_for_everyone_at,
          deleted_for_everyone_by,
          is_pinned,
          client_request_id
        FROM community_messages
        WHERE group_id = $1 AND id = $2
        LIMIT 1`,
      [groupId, messageId],
    );

    if (Number(currentMessageResult.rowCount || 0) === 0) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_message_not_found" };
    }

    const currentMessage = (currentMessageResult.rows as MessageRow[])[0];
    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    const canModerateMessage = actorPermissions.includes("community.messages.moderate");
    const moderatedByElevatedActor = canModerateMessage && currentMessage.sender_id !== actor.id;
    if (currentMessage.deleted_for_everyone_at) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_message_deleted" };
    }

    if (!canModerateMessage && currentMessage.sender_id !== actor.id) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_message_forbidden" };
    }

    if (!canModerateMessage && currentMessage.sender_id === actor.id) {
      const createdAtMs = Date.parse(toIsoString(currentMessage.created_at));
      if (Number.isFinite(createdAtMs) && Date.now() - createdAtMs > COMMUNITY_MESSAGE_EDIT_WINDOW_MS) {
        await client.query("ROLLBACK");
        return { ok: false, code: "community_message_edit_window_expired" };
      }
    }

    const mentions = await resolveCommunityMessageMentionsForGroup(client, groupId, body);

    const updatedResult = await client.query(
      `UPDATE community_messages
          SET body = $3,
              mentions = $4,
              edited_at = now()
        WHERE group_id = $1 AND id = $2
        RETURNING
          id,
          group_id,
          sender_id,
          sender_name,
          sender_role,
          type,
          body,
          attachment_url,
          created_at,
          edited_at,
          reply_to_message_id,
          reply_to_preview,
            mentions,
          deleted_for_everyone_at,
          deleted_for_everyone_by,
          is_pinned,
          client_request_id`,
          [groupId, messageId, body, mentions ? stringifyJsonValue(mentions) : null],
    );

    const eventRow = await insertMessageEvent(client, {
      messageId,
      groupId,
      actorUserId: actor.id,
      actorDisplayName: actor.displayName,
      eventType: "edited",
      payload: {
        previousBody: currentMessage.body || null,
        body,
      },
    });

    if (moderatedByElevatedActor) {
      emitCommunityServiceTelemetry({
        event: "community.message_moderated",
        level: "warn",
        data: {
          groupId,
          messageId,
          actorId: actor.id,
          actorRole: actor.role,
          moderationAction: "edit",
        },
      });
    }

    await client.query("COMMIT");

    const persistedMessage = await hydrateCommunityMessage(client, (updatedResult.rows as MessageRow[])[0], actor.id);

    const group = await readGroupView(defaultExecutor, groupId, actor);
    if (!group) {
      return { ok: false, code: "community_group_not_found" };
    }

    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: eventRow.id,
      eventType: "community.message.updated",
      occurredAt: toIsoString(eventRow.created_at),
      groupId,
      actorId: actor.id,
      messageId: persistedMessage.id,
      sequence: encodeCommunityRealtimeSequence(groupId, toIsoString(eventRow.created_at), eventRow.id),
      payload: {
        message: persistedMessage,
        previousBody: currentMessage.body || null,
      },
    }));

    return {
      ok: true,
      value: {
        message: persistedMessage,
        group,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setCommunityGroupTyping(
  groupId: string,
  userName: string,
  isTyping: boolean,
  viewer: CommunityViewer,
): Promise<CommunityResult<CommunityGroupView>> {
  await ensureCommunitySeeded();

  const access = await requireGroupWriteAccess(defaultExecutor, groupId, viewer, true);
  if (!access.ok) {
    return access;
  }

  if (isTyping) {
    await query(
      `INSERT INTO community_typing_state (group_id, user_id, user_name, expires_at, updated_at)
       VALUES ($1, $2, $3, now() + interval '5 seconds', now())
       ON CONFLICT (group_id, user_id)
       DO UPDATE SET user_name = EXCLUDED.user_name, expires_at = EXCLUDED.expires_at, updated_at = now()`,
      [groupId, viewer.id, userName],
    );
  } else {
    await query(`DELETE FROM community_typing_state WHERE group_id = $1 AND user_id = $2`, [groupId, viewer.id]);
  }

  const group = await readGroupView(defaultExecutor, groupId, viewer);
  if (!group) {
    return { ok: false, code: "community_group_not_found" };
  }

  emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
    eventId: randomUUID(),
    eventType: isTyping ? "community.typing.started" : "community.typing.stopped",
    occurredAt: new Date().toISOString(),
    groupId,
    actorId: viewer.id,
    messageId: null,
    sequence: null,
    payload: {
      userId: viewer.id,
      userName,
      typingUsers: group.typingUsers,
    },
  }));

  return { ok: true, value: group };
}

export async function deleteCommunityMessageForEveryone(
  groupId: string,
  messageId: string,
  actor: CommunityActor,
): Promise<CommunityResult<{ message: CommunityMessage; group: CommunityGroupView }>> {
  await ensureCommunitySeeded();

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const currentMessageResult = await client.query(
      `SELECT
          id,
          group_id,
          sender_id,
          sender_name,
          sender_role,
          type,
          body,
          attachment_url,
          created_at,
          edited_at,
          reply_to_message_id,
          reply_to_preview,
          mentions,
          deleted_for_everyone_at,
          deleted_for_everyone_by,
          is_pinned,
          client_request_id
        FROM community_messages
        WHERE group_id = $1 AND id = $2
        LIMIT 1`,
      [groupId, messageId],
    );

    if (Number(currentMessageResult.rowCount || 0) === 0) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_message_not_found" };
    }

    const currentMessage = (currentMessageResult.rows as MessageRow[])[0];
    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    const canModerateMessage = actorPermissions.includes("community.messages.moderate");
    const moderatedByElevatedActor = canModerateMessage && currentMessage.sender_id !== actor.id;
    if (!canModerateMessage && currentMessage.sender_id !== actor.id) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_message_forbidden" };
    }

    let nextMessage = currentMessage;
    let eventRow: { id: string; created_at: string | Date; event_type: string } | null = null;
    if (!currentMessage.deleted_for_everyone_at) {
      const updatedResult = await client.query(
        `UPDATE community_messages
            SET deleted_for_everyone_at = now(),
                deleted_for_everyone_by = $3,
                deleted_for_everyone_by_id = $4
          WHERE group_id = $1 AND id = $2
          RETURNING
            id,
            group_id,
            sender_id,
            sender_name,
            sender_role,
            type,
            body,
            attachment_url,
            created_at,
            edited_at,
            reply_to_message_id,
            reply_to_preview,
            mentions,
            deleted_for_everyone_at,
            deleted_for_everyone_by,
            is_pinned,
            client_request_id`,
        [groupId, messageId, actor.displayName, actor.id],
      );

      nextMessage = (updatedResult.rows as MessageRow[])[0];
      eventRow = await insertMessageEvent(client, {
        messageId,
        groupId,
        actorUserId: actor.id,
        actorDisplayName: actor.displayName,
        eventType: "deleted_for_everyone",
        payload: {
          deletedForEveryoneBy: actor.displayName,
          previousBody: currentMessage.body || null,
        },
      });

      if (moderatedByElevatedActor) {
        emitCommunityServiceTelemetry({
          event: "community.message_moderated",
          level: "warn",
          data: {
            groupId,
            messageId,
            actorId: actor.id,
            actorRole: actor.role,
            moderationAction: "delete_for_everyone",
          },
        });
      }
    }

    await client.query("COMMIT");

    const persistedMessage = await hydrateCommunityMessage(defaultExecutor, nextMessage, actor.id);

    const group = await readGroupView(defaultExecutor, groupId, actor);
    if (!group) {
      return { ok: false, code: "community_group_not_found" };
    }

    if (eventRow) {
      emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
        eventId: eventRow.id,
        eventType: "community.message.deleted",
        occurredAt: toIsoString(eventRow.created_at),
        groupId,
        actorId: actor.id,
        messageId: persistedMessage.id,
        sequence: encodeCommunityRealtimeSequence(groupId, toIsoString(eventRow.created_at), eventRow.id),
        payload: {
          message: persistedMessage,
          previousBody: currentMessage.body || null,
          deletedForEveryoneBy: actor.displayName,
        },
      }));
    }

    return {
      ok: true,
      value: {
        message: persistedMessage,
        group,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function toggleCommunityMessageReaction(
  groupId: string,
  messageId: string,
  emoji: string,
  actor: CommunityActor,
): Promise<CommunityResult<{ message: CommunityMessage; group: CommunityGroupView }>> {
  await ensureCommunitySeeded();

  const normalizedEmoji = emoji.trim();
  if (!normalizedEmoji) {
    return { ok: false, code: "community_message_not_found" };
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const currentMessageResult = await client.query(
      `SELECT
          id,
          group_id,
          sender_id,
          sender_name,
          sender_role,
          type,
          body,
          attachment_url,
          created_at,
          edited_at,
          reply_to_message_id,
          reply_to_preview,
          mentions,
          deleted_for_everyone_at,
          deleted_for_everyone_by,
          is_pinned,
          client_request_id
        FROM community_messages
        WHERE group_id = $1 AND id = $2
        LIMIT 1`,
      [groupId, messageId],
    );

    if (Number(currentMessageResult.rowCount || 0) === 0) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_message_not_found" };
    }

    const currentMessage = (currentMessageResult.rows as MessageRow[])[0];
    if (currentMessage.deleted_for_everyone_at) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_message_deleted" };
    }

    const existingReaction = await client.query<{ message_id: string }>(
      `SELECT message_id
         FROM community_message_reactions
        WHERE message_id = $1 AND user_id = $2 AND emoji = $3
        LIMIT 1`,
      [messageId, actor.id, normalizedEmoji],
    );

    let reactionActive = false;
    if (Number(existingReaction.rowCount || 0) > 0) {
      await client.query(
        `DELETE FROM community_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
        [messageId, actor.id, normalizedEmoji],
      );
    } else {
      await client.query(
        `INSERT INTO community_message_reactions (message_id, group_id, user_id, emoji, created_at)
         VALUES ($1, $2, $3, $4, now())`,
        [messageId, groupId, actor.id, normalizedEmoji],
      );
      reactionActive = true;
    }

    const eventRow = await insertMessageEvent(client, {
      messageId,
      groupId,
      actorUserId: actor.id,
      actorDisplayName: actor.displayName,
      eventType: reactionActive ? "reaction_added" : "reaction_removed",
      payload: {
        emoji: normalizedEmoji,
      },
    });

    const persistedMessage = await hydrateCommunityMessage(client, currentMessage, actor.id);
    await client.query("COMMIT");

    const group = await readGroupView(defaultExecutor, groupId, actor);
    if (!group) {
      return { ok: false, code: "community_group_not_found" };
    }

    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: eventRow.id,
      eventType: "community.message.updated",
      occurredAt: toIsoString(eventRow.created_at),
      groupId,
      actorId: actor.id,
      messageId: persistedMessage.id,
      sequence: encodeCommunityRealtimeSequence(groupId, toIsoString(eventRow.created_at), eventRow.id),
      payload: {
        message: persistedMessage,
        reaction: {
          emoji: normalizedEmoji,
          active: reactionActive,
        },
      },
    }));

    return {
      ok: true,
      value: {
        message: persistedMessage,
        group,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setCommunityMessageStarredState(
  groupId: string,
  messageId: string,
  starred: boolean,
  actor: CommunityActor,
): Promise<CommunityResult<{ message: CommunityMessage; group: CommunityGroupView }>> {
  await ensureCommunitySeeded();

  const client = await getClient();
  try {
    await client.query("BEGIN");
    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const currentMessageResult = await client.query<MessageRow>(
      `SELECT id, group_id, sender_id, sender_name, sender_role, type, body, attachment_url,
              created_at, edited_at, reply_to_message_id, reply_to_preview, mentions,
              deleted_for_everyone_at, deleted_for_everyone_by, is_pinned, client_request_id,
              is_forwarded, forward_source_message_id
         FROM community_messages
        WHERE group_id = $1 AND id = $2
        LIMIT 1`,
      [groupId, messageId],
    );
    const currentMessage = currentMessageResult.rows[0];
    if (!currentMessage) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_message_not_found" };
    }
    if (currentMessage.deleted_for_everyone_at) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_message_deleted" };
    }

    if (starred) {
      await client.query(
        `INSERT INTO community_message_stars (message_id, group_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, message_id) DO NOTHING`,
        [messageId, groupId, actor.id],
      );
    } else {
      await client.query(
        `DELETE FROM community_message_stars WHERE user_id = $1 AND message_id = $2`,
        [actor.id, messageId],
      );
    }

    const persistedMessage = await hydrateCommunityMessage(client, currentMessage, actor.id);
    await client.query("COMMIT");
    const group = await readGroupView(defaultExecutor, groupId, actor);
    if (!group) {
      return { ok: false, code: "community_group_not_found" };
    }

    return { ok: true, value: { message: persistedMessage, group } };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listCommunityStarredMessages(
  actor: CommunityActor,
  options?: { limit?: number; beforeCursor?: string },
): Promise<CommunityResult<CommunityMessagesPage>> {
  await ensureCommunitySeeded();
  const limit = Math.min(Math.max(Math.floor(options?.limit || 30), 1), 80);
  const beforeCursor = decodeCommunityMessageCursor(options?.beforeCursor);
  if (options?.beforeCursor && (!beforeCursor || beforeCursor.groupId !== "starred")) {
    return { ok: false, code: "community_invalid_cursor" };
  }
  const beforeClause = beforeCursor ? " AND (stars.created_at, stars.message_id) < ($3, $4)" : "";
  const limitParam = beforeCursor ? 5 : 3;
  const params: unknown[] = [actor.id, actor.role];
  if (beforeCursor) params.push(beforeCursor.createdAt, beforeCursor.id);
  params.push(limit + 1);
  const result = await query<MessageRow>(
    `SELECT m.id, m.group_id, m.sender_id, m.sender_name, m.sender_role, m.type, m.body,
            m.attachment_url, m.created_at, m.edited_at, m.reply_to_message_id,
            m.reply_to_preview, m.mentions, m.deleted_for_everyone_at, m.deleted_for_everyone_by,
            m.is_pinned, m.client_request_id, m.is_forwarded, m.forward_source_message_id,
            stars.created_at AS starred_created_at
       FROM community_message_stars stars
       JOIN community_messages m ON m.id = stars.message_id AND m.group_id = stars.group_id
       JOIN community_groups g ON g.id = m.group_id
      WHERE stars.user_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM community_message_hidden_for_user hidden
           WHERE hidden.message_id = m.id AND hidden.user_id = $1
        )
        AND (g.visibility = 'public' OR $2 IN ('admin', 'superadmin') OR EXISTS (
          SELECT 1 FROM community_group_members member
           WHERE member.group_id = g.id AND member.user_id = $1 AND member.status = 'active'
        ))
        ${beforeClause}
      ORDER BY stars.created_at DESC, stars.message_id DESC
      LIMIT $${limitParam}`,
    params,
  );
  const hasMoreBefore = result.rows.length > limit;
  const rows = result.rows.slice(0, limit);
  const messages = await hydrateCommunityMessages(defaultExecutor, rows, actor.id);
  const oldest = rows.at(-1);
  return {
    ok: true,
    value: {
      groupId: "starred",
      messages,
      pageInfo: {
        hasMoreBefore,
        startCursor: hasMoreBefore && oldest?.starred_created_at
          ? encodeCommunityMessageCursor("starred", toIsoString(oldest.starred_created_at), oldest.id)
          : null,
        endCursor: null,
      },
      latestSequence: null,
      readState: { unreadCount: 0, lastReadMessageId: null, lastReadAt: null },
    },
  };
}

const selectCommunityMessageForPinStateSql = `SELECT
    id,
    group_id,
    sender_id,
    sender_name,
    sender_role,
    type,
    body,
    attachment_url,
    created_at,
    edited_at,
    reply_to_message_id,
    reply_to_preview,
    mentions,
    deleted_for_everyone_at,
    deleted_for_everyone_by,
    is_pinned,
    client_request_id
  FROM community_messages
  WHERE group_id = $1 AND id = $2
  LIMIT 1`;

type CommunityMessageEventRow = Awaited<ReturnType<typeof insertMessageEvent>>;

async function readCommunityMessageForPinState(
  executor: QueryExecutor,
  groupId: string,
  messageId: string,
): Promise<CommunityResult<MessageRow>> {
  const currentMessageResult = await executor.query<MessageRow>(selectCommunityMessageForPinStateSql, [groupId, messageId]);

  if (Number(currentMessageResult.rowCount || 0) === 0) {
    return { ok: false, code: "community_message_not_found" };
  }

  const currentMessage = currentMessageResult.rows[0];
  if (currentMessage.deleted_for_everyone_at) {
    return { ok: false, code: "community_message_deleted" };
  }

  return {
    ok: true,
    value: currentMessage,
  };
}

function resolvePinnedMessageIdAfterChange(
  previousPinnedMessageId: string | null,
  messageId: string,
  pinned: boolean,
): string | null {
  if (pinned) {
    return messageId;
  }

  if (previousPinnedMessageId === messageId) {
    return null;
  }

  return previousPinnedMessageId;
}

async function applyPinnedStateChange(
  executor: QueryExecutor,
  groupId: string,
  messageId: string,
  pinned: boolean,
  actor: CommunityActor,
  currentMessage: MessageRow,
  previousPinnedMessageId: string | null,
): Promise<{ eventRow: CommunityMessageEventRow | null; pinnedMessageId: string | null }> {
  const pinnedMessageId = resolvePinnedMessageIdAfterChange(previousPinnedMessageId, messageId, pinned);
  const isCurrentMessagePinned = Boolean(currentMessage.is_pinned);
  const noStateChange = pinned
    ? isCurrentMessagePinned && previousPinnedMessageId === messageId
    : !isCurrentMessagePinned && previousPinnedMessageId !== messageId;

  if (noStateChange) {
    return {
      eventRow: null,
      pinnedMessageId,
    };
  }

  if (pinned) {
    await executor.query(
      `UPDATE community_messages
          SET is_pinned = CASE WHEN id = $2 THEN TRUE ELSE FALSE END
        WHERE group_id = $1
          AND (is_pinned = TRUE OR id = $2)`,
      [groupId, messageId],
    );
    await executor.query(
      `UPDATE community_groups
          SET pinned_message_id = $2,
              updated_at = now()
        WHERE id = $1`,
      [groupId, messageId],
    );

    return {
      eventRow: await insertMessageEvent(executor, {
        messageId,
        groupId,
        actorUserId: actor.id,
        actorDisplayName: actor.displayName,
        eventType: "pinned",
        payload: {
          pinned: true,
          previousPinnedMessageId,
        },
      }),
      pinnedMessageId,
    };
  }

  await executor.query(
    `UPDATE community_messages
        SET is_pinned = FALSE
      WHERE group_id = $1 AND id = $2`,
    [groupId, messageId],
  );
  await executor.query(
    `UPDATE community_groups
        SET pinned_message_id = CASE WHEN pinned_message_id = $2 THEN NULL ELSE pinned_message_id END,
            updated_at = now()
      WHERE id = $1`,
    [groupId, messageId],
  );

  return {
    eventRow: await insertMessageEvent(executor, {
      messageId,
      groupId,
      actorUserId: actor.id,
      actorDisplayName: actor.displayName,
      eventType: "unpinned",
      payload: {
        pinned: false,
        previousPinnedMessageId,
      },
    }),
    pinnedMessageId,
  };
}

export async function setCommunityMessagePinnedState(
  groupId: string,
  messageId: string,
  pinned: boolean,
  actor: CommunityActor,
): Promise<CommunityResult<{ message: CommunityMessage; group: CommunityGroupView }>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    if (!actorPermissions.includes("community.messages.moderate")) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const currentMessage = await readCommunityMessageForPinState(client, groupId, messageId);
    if (!currentMessage.ok) {
      await client.query("ROLLBACK");
      return currentMessage;
    }

    const previousPinnedMessageId = access.value.pinned_message_id || null;
    const beforeState = {
      pinnedMessageId: previousPinnedMessageId,
      messageId,
      isPinned: Boolean(currentMessage.value.is_pinned),
    };

    const { eventRow, pinnedMessageId } = await applyPinnedStateChange(
      client,
      groupId,
      messageId,
      pinned,
      actor,
      currentMessage.value,
      previousPinnedMessageId,
    );

    if (eventRow) {
      const auditEvent = createAdminAuditEvent({
        eventType: pinned ? "community.message_pinned" : "community.message_unpinned",
        actorId: actor.id,
        entityType: "community_message",
        entityId: `${groupId}:${messageId}`,
        before: beforeState,
        after: {
          pinnedMessageId,
          messageId,
          isPinned: pinned,
        },
      });
      await insertAdminAuditEventInTransaction(client, auditEvent);
    }

    const refreshedMessageResult = await client.query<MessageRow>(selectCommunityMessageForPinStateSql, [groupId, messageId]);

    await client.query("COMMIT");

    const persistedMessage = await hydrateCommunityMessage(client, refreshedMessageResult.rows[0], actor.id);
    const group = await readGroupView(defaultExecutor, groupId, actor);
    if (!group) {
      return { ok: false, code: "community_group_not_found" };
    }

    if (eventRow) {
      emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
        eventId: eventRow.id,
        eventType: "community.message.updated",
        occurredAt: toIsoString(eventRow.created_at),
        groupId,
        actorId: actor.id,
        messageId: persistedMessage.id,
        sequence: encodeCommunityRealtimeSequence(groupId, toIsoString(eventRow.created_at), eventRow.id),
        payload: {
          message: persistedMessage,
          pinState: {
            pinned,
            previousPinnedMessageId,
            pinnedMessageId: pinned ? persistedMessage.id : null,
          },
        },
      }));
    }

    return {
      ok: true,
      value: {
        message: persistedMessage,
        group,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteCommunityMessageForSelf(
  groupId: string,
  messageId: string,
  actor: CommunityActor,
): Promise<CommunityResult<{ messageId: string; deletedForMeAt: string; group: CommunityGroupView }>> {
  await ensureCommunitySeeded();

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const currentMessageResult = await client.query<{ id: string }>(
      `SELECT id
         FROM community_messages
        WHERE group_id = $1 AND id = $2
        LIMIT 1`,
      [groupId, messageId],
    );

    if (Number(currentMessageResult.rowCount || 0) === 0) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_message_not_found" };
    }

    const hiddenResult = await client.query<{ deleted_at: string | Date }>(
      `INSERT INTO community_message_hidden_for_user (message_id, group_id, user_id, deleted_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (message_id, user_id)
       DO UPDATE SET deleted_at = EXCLUDED.deleted_at
       RETURNING deleted_at`,
      [messageId, groupId, actor.id],
    );

    await insertMessageEvent(client, {
      messageId,
      groupId,
      actorUserId: actor.id,
      actorDisplayName: actor.displayName,
      eventType: "deleted_for_self",
      payload: {
        userId: actor.id,
      },
    });

    await client.query("COMMIT");

    const group = await readGroupView(defaultExecutor, groupId, actor);
    if (!group) {
      return { ok: false, code: "community_group_not_found" };
    }

    return {
      ok: true,
      value: {
        messageId,
        deletedForMeAt: toIsoString(hiddenResult.rows[0]?.deleted_at || new Date().toISOString()),
        group,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markCommunityGroupRead(groupId: string, viewer: CommunityViewer, messageId?: string): Promise<CommunityResult<CommunityReadUpdateResult>> {
  await ensureCommunitySeeded();

  const access = await requireGroupPresenceAccess(defaultExecutor, groupId, viewer, true);
  if (!access.ok) {
    return access;
  }

  const latestMessageResult = await query(
    `SELECT id, created_at, sender_id
      FROM community_messages
      WHERE group_id = $1
        AND ($2::text IS NULL OR id = $2)
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [groupId, messageId || null],
  );
  if (messageId && Number(latestMessageResult.rowCount || 0) === 0) {
    return { ok: false, code: "community_read_message_invalid" };
  }
  const latestMessage = latestMessageResult.rows[0] as { id: string; created_at: string | Date; sender_id: string } | undefined;
  const lastReadAt = latestMessage ? toIsoString(latestMessage.created_at) : new Date().toISOString();

  await query(
    `INSERT INTO community_group_read_state (group_id, user_id, last_read_message_id, last_read_at, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (group_id, user_id)
     DO UPDATE SET
       last_read_message_id = EXCLUDED.last_read_message_id,
       last_read_at = EXCLUDED.last_read_at,
       updated_at = now()`,
    [groupId, viewer.id, latestMessage?.id || null, lastReadAt],
  );

  const group = await readGroupView(defaultExecutor, groupId, viewer);
  if (!group) {
    return { ok: false, code: "community_group_not_found" };
  }

  emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
    eventId: randomUUID(),
    eventType: "community.read_state.updated",
    occurredAt: lastReadAt,
    groupId,
    actorId: viewer.id,
    messageId: latestMessage?.id || null,
    sequence: null,
    payload: {
      readState: {
        unreadCount: group.unreadCount ?? 0,
        lastReadMessageId: latestMessage?.id || null,
        lastReadAt,
      },
    },
  }));

  if (latestMessage) {
    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: randomUUID(),
      eventType: "community.receipt.read",
      occurredAt: lastReadAt,
      groupId,
      actorId: viewer.id,
      messageId: latestMessage.id,
      sequence: null,
      payload: {
        readerUserId: viewer.id,
        messageId: latestMessage.id,
        senderUserId: latestMessage.sender_id,
      },
    }));
  }

  return {
    ok: true,
    value: {
      group,
      readState: {
        unreadCount: group.unreadCount ?? 0,
        lastReadMessageId: latestMessage?.id || undefined,
        lastReadAt,
      },
    },
  };
}

export async function createCommunityGroup(
  group: CommunityGroupCreateInput,
  viewer?: CommunityViewer,
): Promise<CommunityGroupView> {
  await ensureCommunitySeeded();

  const visibility = normalizeVisibility(group.visibility);
  const creatorId = viewer?.id?.trim();
  const memberIds = uniqueTrimmedStrings(group.memberIds);
  const uniqueMembers = new Set(memberIds);
  if (creatorId) {
    uniqueMembers.add(creatorId);
  }

  const persistedMemberCount = Math.max(Number(group.memberCount || 0), uniqueMembers.size);

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO community_groups (
          id,
          community_id,
          name,
          description,
          category,
          member_count,
          is_official,
          visibility,
          created_by,
          created_at,
          updated_at,
          last_message_at,
          pinned_message_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now(), NULL, NULL)`,
      [
        group.id,
        group.communityId,
        group.name,
        group.description || null,
        group.category,
        persistedMemberCount,
        Boolean(group.isOfficial),
        visibility,
        creatorId || null,
      ],
    );

    if (creatorId) {
      await insertMembership(client, { groupId: group.id, userId: creatorId, role: "owner", addedBy: creatorId });
    }

    for (const memberId of memberIds) {
      if (memberId === creatorId) continue;
      await insertMembership(client, { groupId: group.id, userId: memberId, role: "member", addedBy: creatorId });
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const view = await readGroupView(defaultExecutor, group.id, viewer);
  if (view) {
    return view;
  }

  return {
    id: group.id,
    communityId: group.communityId,
    name: group.name,
    description: group.description,
    category: group.category,
    memberCount: persistedMemberCount,
    unreadCount: 0,
    isOfficial: Boolean(group.isOfficial),
    visibility,
  };
}

function buildCommunityGroupUpdateColumns(patch: CommunityGroupUpdateInput): { updates: string[]; values: unknown[] } {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (typeof patch.name === "string") {
    values.push(patch.name);
    updates.push(`name = $${values.length + 1}`);
  }
  if (typeof patch.description === "string" || patch.description === undefined) {
    values.push(patch.description || null);
    updates.push(`description = $${values.length + 1}`);
  }
  if (patch.category) {
    values.push(patch.category);
    updates.push(`category = $${values.length + 1}`);
  }
  if (typeof patch.isOfficial === "boolean") {
    values.push(patch.isOfficial);
    updates.push(`is_official = $${values.length + 1}`);
  }
  if (patch.visibility !== undefined) {
    values.push(normalizeVisibility(patch.visibility));
    updates.push(`visibility = $${values.length + 1}`);
  }

  return { updates, values };
}

async function addCommunityGroupMembers(
  executor: QueryExecutor,
  groupId: string,
  memberIds: string[],
  addedBy?: string,
): Promise<number> {
  let insertedCount = 0;

  for (const memberId of memberIds) {
    const inserted = await insertMembership(executor, {
      groupId,
      userId: memberId,
      role: "member",
      addedBy,
    });

    if (inserted) {
      insertedCount += 1;
    }
  }

  return insertedCount;
}

export async function updateCommunityGroup(
  groupId: string,
  patch: CommunityGroupUpdateInput,
  viewer?: CommunityViewer,
): Promise<CommunityGroupView | null> {
  await ensureCommunitySeeded();

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const access = await requireGroupAccess(client, groupId, viewer, false);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return null;
    }

    const { updates, values } = buildCommunityGroupUpdateColumns(patch);

    if (updates.length > 0) {
      await client.query(
        `UPDATE community_groups
            SET ${updates.join(", ")},
                updated_at = now()
          WHERE id = $1`,
        [groupId, ...values],
      );
    }

    const memberIds = uniqueTrimmedStrings(patch.memberIds);
    if (memberIds.length > 0) {
      const insertedCount = await addCommunityGroupMembers(client, groupId, memberIds, viewer?.id);

      if (insertedCount > 0) {
        await client.query(
          `UPDATE community_groups
              SET member_count = member_count + $2,
                  updated_at = now()
            WHERE id = $1`,
          [groupId, insertedCount],
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return readGroupView(defaultExecutor, groupId, viewer);
}

export async function listCommunityGroupMembers(
  groupId: string,
  viewer: CommunityViewer,
): Promise<CommunityResult<CommunityGroupMembersOverview>> {
  await ensureCommunitySeeded();
  await expirePendingInvitations(defaultExecutor, groupId);

  const access = await requireGroupAccess(defaultExecutor, groupId, viewer, true);
  if (!access.ok) {
    return access;
  }

  const actorPermissions = resolveCommunityGroupPermissions(access.value, viewer);
  if (!actorPermissions.includes("community.members.view")) {
    return { ok: false, code: "community_group_forbidden" };
  }

  const group = await readGroupView(defaultExecutor, groupId, viewer);
  if (!group) {
    return { ok: false, code: "community_group_not_found" };
  }

  const membersByStatus = createEmptyMembershipBuckets();
  const rows = await listMembershipRows(defaultExecutor, groupId);
  for (const row of rows) {
    const membership = mapMembershipRow(row);
    membersByStatus[membership.status].push(membership);
  }

  return {
    ok: true,
    value: {
      group,
      memberCount: Number(access.value.member_count || 0),
      memberLimit: Number(access.value.member_limit || 0),
      currentMembership: buildCommunityMembershipSummary(access.value, viewer),
      actorPermissions,
      membersByStatus,
    },
  };
}

export async function requestCommunityGroupMembership(
  groupId: string,
  viewer: CommunityViewer,
): Promise<CommunityResult<CommunityMembershipUpdateResult>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  if (!viewer.id) {
    return { ok: false, code: "community_group_auth_required" };
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await expirePendingInvitations(client, groupId, viewer.id);

    const row = await fetchSingleGroupRow(client, groupId, viewer);
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_not_found" };
    }

    const previousMembership = await loadMembershipRow(client, groupId, viewer.id);
    const previousStatus = getEffectiveMembershipStatus(row);
    if (previousStatus === "banned" || previousStatus === "suspended") {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    if (row.visibility === "invite_only") {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const nextStatus: CommunityGroupMemberStatus = row.visibility === "public" ? "active" : "pending";
    if (nextStatus === "active"
      && !countsTowardMemberLimit(previousStatus)
      && !await ensureGroupHasCapacity(client, groupId)) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_member_limit_reached" };
    }

    await client.query(
      `INSERT INTO community_group_members (
          group_id,
          user_id,
          role,
          status,
          joined_at,
          requested_at,
          updated_at,
          status_updated_by,
          status_reason,
          muted_until,
          suspended_until,
          removed_at,
          left_at,
          banned_at,
          rejected_at
        )
       VALUES (
          $1,
          $2,
          'member',
          $3,
          CASE WHEN $3 = 'active' THEN now() ELSE NULL END,
          CASE WHEN $3 = 'pending' THEN now() ELSE NULL END,
          now(),
          $2,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL
        )
       ON CONFLICT (group_id, user_id) DO UPDATE
         SET status = EXCLUDED.status,
             requested_at = CASE WHEN EXCLUDED.status = 'pending' THEN now() ELSE community_group_members.requested_at END,
             joined_at = CASE WHEN EXCLUDED.status = 'active' THEN COALESCE(community_group_members.joined_at, now()) ELSE community_group_members.joined_at END,
             updated_at = now(),
             status_updated_by = EXCLUDED.status_updated_by,
             status_reason = NULL,
             muted_until = NULL,
             suspended_until = NULL,
             removed_at = NULL,
             left_at = NULL,
             rejected_at = NULL`,
      [groupId, viewer.id, nextStatus],
    );

    const nextMembership = await loadMembershipRow(client, groupId, viewer.id);
    await recordCommunityModerationAction(client, {
      groupId,
      actor: {
        id: viewer.id,
        role: viewer.role || "accredited",
        displayName: viewer.id,
      },
      entityType: "community_group_membership",
      entityId: `${groupId}:${viewer.id}`,
      targetId: viewer.id,
      actionType: "membership_requested",
      reason: nextStatus === "active" ? "تم الانضمام إلى المجموعة" : "تم إرسال طلب انضمام إلى المجموعة",
      beforeState: buildMembershipAuditSnapshot(previousMembership),
      afterState: buildMembershipAuditSnapshot(nextMembership),
    });

    await adjustGroupMemberCount(client, groupId, getMembershipCountDelta(previousStatus, nextStatus));
    await client.query("COMMIT");

    const [rawGroupRow, refreshedRow] = await Promise.all([
      fetchSingleGroupRow(defaultExecutor, groupId, viewer),
      fetchSingleGroupRow(defaultExecutor, groupId, viewer),
    ]);
    const group = rawGroupRow ? await buildGroupViewFromRow(defaultExecutor, rawGroupRow, viewer) : null;
    if (!group || !refreshedRow) {
      return { ok: false, code: "community_group_not_found" };
    }

    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: randomUUID(),
      eventType: nextStatus === "pending" ? "community.membership.requested" : "community.membership.updated",
      occurredAt: new Date().toISOString(),
      groupId,
      actorId: viewer.id,
      messageId: null,
      sequence: null,
      payload: {
        userId: viewer.id,
        status: nextStatus,
      },
    }));

    return {
      ok: true,
      value: {
        group,
        currentMembership: buildCommunityMembershipSummary(refreshedRow, viewer),
        actorPermissions: resolveCommunityGroupPermissions(refreshedRow, viewer),
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reviewCommunityGroupMembership(
  groupId: string,
  userId: string,
  decision: "approve" | "reject",
  actor: CommunityActor,
  reason?: string,
): Promise<CommunityResult<CommunityMembershipUpdateResult>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await expirePendingInvitations(client, groupId, userId);

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    if (!actorPermissions.includes("community.members.approve")) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const currentMembership = await loadMembershipRow(client, groupId, userId);
    if (!currentMembership) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_membership_not_found" };
    }

    const previousStatus = getEffectiveMembershipStatusFromMembershipRow(currentMembership);
    const nextStatus: CommunityGroupMemberStatus = decision === "approve" ? "active" : "rejected";

    if (nextStatus === "active"
      && !countsTowardMemberLimit(previousStatus)
      && !await ensureGroupHasCapacity(client, groupId)) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_member_limit_reached" };
    }

    await client.query(
      `UPDATE community_group_members
          SET status = $3,
              joined_at = CASE WHEN $3 = 'active' THEN COALESCE(joined_at, now()) ELSE joined_at END,
              rejected_at = CASE WHEN $3 = 'rejected' THEN now() ELSE rejected_at END,
              updated_at = now(),
              status_updated_by = $4,
              status_reason = $5,
              muted_until = NULL,
              suspended_until = NULL,
              removed_at = NULL,
              left_at = NULL
        WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId, nextStatus, actor.id, reason || null],
    );

    const nextMembership = await loadMembershipRow(client, groupId, userId);
    await recordCommunityModerationAction(client, {
      groupId,
      actor,
      entityType: "community_group_membership",
      entityId: `${groupId}:${userId}`,
      targetId: userId,
      actionType: decision === "approve" ? "membership_approved" : "membership_rejected",
      reason: reason || (decision === "approve" ? "تم اعتماد طلب الانضمام" : "تم رفض طلب الانضمام"),
      beforeState: buildMembershipAuditSnapshot(currentMembership),
      afterState: buildMembershipAuditSnapshot(nextMembership),
    });

    await adjustGroupMemberCount(client, groupId, getMembershipCountDelta(previousStatus, nextStatus));
    await client.query("COMMIT");

    const [group, refreshedRow, refreshedActorRow] = await Promise.all([
      readGroupView(defaultExecutor, groupId, actor),
      fetchSingleGroupRow(defaultExecutor, groupId, { id: userId, role: actor.role }),
      fetchSingleGroupRow(defaultExecutor, groupId, actor),
    ]);
    if (!group || !refreshedActorRow) {
      return { ok: false, code: "community_group_not_found" };
    }

    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: randomUUID(),
      eventType: "community.membership.updated",
      occurredAt: new Date().toISOString(),
      groupId,
      actorId: actor.id,
      messageId: null,
      sequence: null,
      payload: {
        userId,
        status: nextStatus,
        reason: reason || null,
      },
    }));

    return {
      ok: true,
      value: {
        group,
        currentMembership: refreshedRow ? buildCommunityMembershipSummary(refreshedRow, { id: userId }) : null,
        actorPermissions: resolveCommunityGroupPermissions(refreshedActorRow, actor),
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function inviteCommunityGroupMember(
  groupId: string,
  invitedUserId: string,
  actor: CommunityActor,
  options?: { note?: string; expiresInDays?: number },
): Promise<CommunityResult<CommunityGroupMembersOverview>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const normalizedInvitedUserId = invitedUserId.trim();
  const invitationReason = options?.note?.trim() || "تم إرسال دعوة للانضمام";
  const expiresInDays = Math.min(Math.max(Number(options?.expiresInDays || 7), 1), 30);
  const expiresAt = new Date(Date.now() + (expiresInDays * 24 * 60 * 60 * 1000)).toISOString();

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await expirePendingInvitations(client, groupId, normalizedInvitedUserId);

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    if (!actorPermissions.includes("community.members.invite")) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const previousMembership = await loadMembershipRow(client, groupId, normalizedInvitedUserId);
    const previousStatus = previousMembership ? getEffectiveMembershipStatusFromMembershipRow(previousMembership) : null;
    if (
      previousStatus === "active"
      || previousStatus === "muted"
      || previousStatus === "pending"
      || previousStatus === "banned"
      || previousStatus === "suspended"
    ) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const previousInvitation = await loadPendingInvitationRow(client, groupId, normalizedInvitedUserId, { forUpdate: true });
    if (previousInvitation) {
      await client.query(
        `UPDATE community_group_invitations
            SET note = $2,
                expires_at = $3::timestamptz,
                invited_by_user_id = $4
          WHERE id = $1`,
        [previousInvitation.id, options?.note?.trim() || null, expiresAt, actor.id],
      );
    } else {
      await client.query(
        `INSERT INTO community_group_invitations (
            id,
            group_id,
            invited_user_id,
            invited_by_user_id,
            status,
            note,
            expires_at,
            created_at
          )
          VALUES ($1, $2, $3, $4, 'pending', $5, $6::timestamptz, now())`,
        [`community_invitation_${randomUUID()}`, groupId, normalizedInvitedUserId, actor.id, options?.note?.trim() || null, expiresAt],
      );
    }

    await client.query(
      `INSERT INTO community_group_members (
          group_id,
          user_id,
          role,
          status,
          joined_at,
          requested_at,
          invited_at,
          added_by,
          updated_at,
          status_reason,
          status_updated_by,
          muted_until,
          suspended_until,
          removed_at,
          left_at,
          banned_at,
          rejected_at
        )
        VALUES (
          $1,
          $2,
          'member',
          'invited',
          NULL,
          NULL,
          now(),
          $3,
          now(),
          $4,
          $3,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL
        )
        ON CONFLICT (group_id, user_id) DO UPDATE
          SET status = 'invited',
              joined_at = NULL,
              requested_at = NULL,
              invited_at = now(),
              added_by = EXCLUDED.added_by,
              updated_at = now(),
              status_reason = EXCLUDED.status_reason,
              status_updated_by = EXCLUDED.status_updated_by,
              muted_until = NULL,
              suspended_until = NULL,
              removed_at = NULL,
              left_at = NULL,
              banned_at = NULL,
              rejected_at = NULL`,
      [groupId, normalizedInvitedUserId, actor.id, options?.note?.trim() || null],
    );

    const nextMembership = await loadMembershipRow(client, groupId, normalizedInvitedUserId);
    const nextInvitation = await loadPendingInvitationRow(client, groupId, normalizedInvitedUserId);

    await recordCommunityModerationAction(client, {
      groupId,
      actor,
      entityType: "community_group_invitation",
      entityId: `${groupId}:${normalizedInvitedUserId}`,
      targetId: normalizedInvitedUserId,
      actionType: "invitation_created",
      reason: invitationReason,
      beforeState: {
        invitation: buildInvitationAuditSnapshot(previousInvitation),
        membership: buildMembershipAuditSnapshot(previousMembership),
      },
      afterState: {
        invitation: buildInvitationAuditSnapshot(nextInvitation),
        membership: buildMembershipAuditSnapshot(nextMembership),
      },
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listCommunityGroupMembers(groupId, actor);
}

export async function acceptCommunityGroupInvitation(
  groupId: string,
  viewer: CommunityViewer,
): Promise<CommunityResult<CommunityMembershipUpdateResult>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  if (!viewer.id) {
    return { ok: false, code: "community_group_auth_required" };
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await expirePendingInvitations(client, groupId, viewer.id);

    const row = await fetchSingleGroupRow(client, groupId, viewer);
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_not_found" };
    }

    const previousMembership = await loadMembershipRow(client, groupId, viewer.id);
    const previousStatus = previousMembership ? getEffectiveMembershipStatusFromMembershipRow(previousMembership) : getEffectiveMembershipStatus(row);
    if (previousStatus !== "invited") {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_membership_not_found" };
    }

    const invitation = await loadPendingInvitationRow(client, groupId, viewer.id, { forUpdate: true });
    if (!invitation) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_membership_not_found" };
    }

    if (!await ensureGroupHasCapacity(client, groupId)) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_member_limit_reached" };
    }

    await client.query(
      `UPDATE community_group_invitations
          SET status = 'accepted',
              accepted_at = now()
        WHERE id = $1`,
      [invitation.id],
    );

    await client.query(
      `UPDATE community_group_members
          SET status = 'active',
              joined_at = COALESCE(joined_at, now()),
              updated_at = now(),
              status_updated_by = $3,
              status_reason = NULL,
              muted_until = NULL,
              suspended_until = NULL,
              removed_at = NULL,
              left_at = NULL,
              banned_at = NULL,
              rejected_at = NULL
        WHERE group_id = $1 AND user_id = $2`,
      [groupId, viewer.id, viewer.id],
    );

    const nextMembership = await loadMembershipRow(client, groupId, viewer.id);
    await recordCommunityModerationAction(client, {
      groupId,
      actor: {
        id: viewer.id,
        role: viewer.role || "accredited",
        displayName: viewer.id,
      },
      entityType: "community_group_invitation",
      entityId: `${groupId}:${viewer.id}`,
      targetId: viewer.id,
      actionType: "invitation_accepted",
      reason: "تم قبول دعوة الانضمام",
      beforeState: {
        invitation: buildInvitationAuditSnapshot(invitation),
        membership: buildMembershipAuditSnapshot(previousMembership),
      },
      afterState: {
        invitation: {
          ...buildInvitationAuditSnapshot(invitation),
          status: "accepted",
          acceptedAt: new Date().toISOString(),
        },
        membership: buildMembershipAuditSnapshot(nextMembership),
      },
    });

    await adjustGroupMemberCount(client, groupId, getMembershipCountDelta(previousStatus, "active"));
    await client.query("COMMIT");

    const rawGroupRow = await fetchSingleGroupRow(defaultExecutor, groupId, viewer);
    const refreshedRow = await fetchSingleGroupRow(defaultExecutor, groupId, viewer);
    const group = rawGroupRow ? await buildGroupViewFromRow(defaultExecutor, rawGroupRow, viewer) : null;
    if (!group || !refreshedRow) {
      return { ok: false, code: "community_group_not_found" };
    }

    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: randomUUID(),
      eventType: "community.membership.updated",
      occurredAt: new Date().toISOString(),
      groupId,
      actorId: viewer.id,
      messageId: null,
      sequence: null,
      payload: {
        userId: viewer.id,
        status: "active",
      },
    }));

    return {
      ok: true,
      value: {
        group,
        currentMembership: buildCommunityMembershipSummary(refreshedRow, viewer),
        actorPermissions: resolveCommunityGroupPermissions(refreshedRow, viewer),
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeCommunityGroupInvitation(
  groupId: string,
  invitedUserId: string,
  actor: CommunityActor,
  reason?: string,
): Promise<CommunityResult<CommunityGroupMembersOverview>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const normalizedInvitedUserId = invitedUserId.trim();
  const revokeReason = reason?.trim() || "تم سحب دعوة الانضمام";
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await expirePendingInvitations(client, groupId, normalizedInvitedUserId);

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    if (!actorPermissions.includes("community.members.invite")) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const previousInvitation = await loadPendingInvitationRow(client, groupId, normalizedInvitedUserId, { forUpdate: true });
    if (!previousInvitation) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_membership_not_found" };
    }

    const previousMembership = await loadMembershipRow(client, groupId, normalizedInvitedUserId);

    await client.query(
      `UPDATE community_group_invitations
          SET status = 'revoked',
              revoked_at = now(),
              revoked_by_user_id = $2
        WHERE id = $1`,
      [previousInvitation.id, actor.id],
    );

    await client.query(
      `DELETE FROM community_group_members
        WHERE group_id = $1
          AND user_id = $2
          AND status = 'invited'`,
      [groupId, normalizedInvitedUserId],
    );

    await recordCommunityModerationAction(client, {
      groupId,
      actor,
      entityType: "community_group_invitation",
      entityId: `${groupId}:${normalizedInvitedUserId}`,
      targetId: normalizedInvitedUserId,
      actionType: "invitation_revoked",
      reason: revokeReason,
      beforeState: {
        invitation: buildInvitationAuditSnapshot(previousInvitation),
        membership: buildMembershipAuditSnapshot(previousMembership),
      },
      afterState: {
        invitation: {
          ...buildInvitationAuditSnapshot(previousInvitation),
          status: "revoked",
          revokedAt: new Date().toISOString(),
          revokedByUserId: actor.id,
        },
        membership: null,
      },
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listCommunityGroupMembers(groupId, actor);
}

export async function leaveCommunityGroup(
  groupId: string,
  viewer: CommunityViewer,
): Promise<CommunityResult<CommunityMembershipUpdateResult>> {
  await ensureCommunitySeeded();

  if (!viewer.id) {
    return { ok: false, code: "community_group_auth_required" };
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const row = await fetchSingleGroupRow(client, groupId, viewer);
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_not_found" };
    }

    const previousStatus = getEffectiveMembershipStatus(row);
    const currentRole = row.membership_role;
    if (!previousStatus || !isReadableMembershipStatus(previousStatus)) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_membership_not_found" };
    }

    if (currentRole === "owner") {
      const ownerCount = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM community_group_members
          WHERE group_id = $1
            AND role = 'owner'
            AND status IN ('active', 'muted')`,
        [groupId],
      );

      if (Number(ownerCount.rows[0]?.count || 0) <= 1) {
        await client.query("ROLLBACK");
        return { ok: false, code: "community_group_forbidden" };
      }
    }

    await client.query(
      `UPDATE community_group_members
          SET status = 'left',
              left_at = now(),
              updated_at = now(),
              status_updated_by = $3,
              status_reason = NULL,
              muted_until = NULL,
              suspended_until = NULL
        WHERE group_id = $1 AND user_id = $2`,
      [groupId, viewer.id, viewer.id],
    );

    await adjustGroupMemberCount(client, groupId, getMembershipCountDelta(previousStatus, "left"));
    await client.query("COMMIT");

    const rawGroupRow = await fetchSingleGroupRow(defaultExecutor, groupId, viewer);
    const refreshedRow = await fetchSingleGroupRow(defaultExecutor, groupId, viewer);
    const group = rawGroupRow ? await buildGroupViewFromRow(defaultExecutor, rawGroupRow, viewer) : null;
    if (!group || !refreshedRow) {
      return { ok: false, code: "community_group_not_found" };
    }

    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: randomUUID(),
      eventType: "community.membership.updated",
      occurredAt: new Date().toISOString(),
      groupId,
      actorId: viewer.id,
      messageId: null,
      sequence: null,
      payload: {
        userId: viewer.id,
        status: "left",
      },
    }));

    return {
      ok: true,
      value: {
        group,
        currentMembership: buildCommunityMembershipSummary(refreshedRow, viewer),
        actorPermissions: resolveCommunityGroupPermissions(refreshedRow, viewer),
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function warnCommunityGroupMember(
  groupId: string,
  userId: string,
  actor: CommunityActor,
  reason: string,
): Promise<CommunityResult<CommunityGroupMembersOverview>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const normalizedUserId = userId.trim();
  const warningReason = reason.trim();
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await normalizeExpiredMembershipStates(client, { groupId });

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    if (!actorPermissions.includes("community.members.warn") || normalizedUserId === actor.id) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const currentMembership = await loadMembershipRow(client, groupId, normalizedUserId);
    if (!currentMembership) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_membership_not_found" };
    }

    const currentStatus = getEffectiveMembershipStatusFromMembershipRow(currentMembership);
    if (currentStatus !== "active" && currentStatus !== "muted") {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    await recordCommunityModerationAction(client, {
      groupId,
      actor,
      entityType: "community_group_membership",
      entityId: `${groupId}:${normalizedUserId}`,
      targetId: normalizedUserId,
      actionType: "member_warned",
      reason: warningReason,
      beforeState: buildMembershipAuditSnapshot(currentMembership),
      afterState: buildMembershipAuditSnapshot(currentMembership),
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listCommunityGroupMembers(groupId, actor);
}

export async function muteCommunityGroupMember(
  groupId: string,
  userId: string,
  actor: CommunityActor,
  reason: string,
  options?: { durationHours?: number },
): Promise<CommunityResult<CommunityGroupMembersOverview>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const normalizedUserId = userId.trim();
  const muteReason = reason.trim();
  const mutedUntil = new Date(
    Date.now() + (clampCommunityMuteDurationHours(options?.durationHours) * 60 * 60 * 1000),
  ).toISOString();

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await normalizeExpiredMembershipStates(client, { groupId });

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    if (!actorPermissions.includes("community.members.mute") || normalizedUserId === actor.id) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const currentMembership = await loadMembershipRow(client, groupId, normalizedUserId);
    if (!currentMembership) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_membership_not_found" };
    }

    const previousStatus = getEffectiveMembershipStatusFromMembershipRow(currentMembership);
    if (previousStatus !== "active" && previousStatus !== "muted") {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    await client.query(
      `UPDATE community_group_members
          SET status = 'muted',
              updated_at = now(),
              status_updated_by = $3,
              status_reason = $4,
              muted_until = $5::timestamptz,
              suspended_until = NULL,
              removed_at = NULL,
              left_at = NULL
        WHERE group_id = $1 AND user_id = $2`,
      [groupId, normalizedUserId, actor.id, muteReason, mutedUntil],
    );

    const nextMembership = await loadMembershipRow(client, groupId, normalizedUserId);
    await recordCommunityModerationAction(client, {
      groupId,
      actor,
      entityType: "community_group_membership",
      entityId: `${groupId}:${normalizedUserId}`,
      targetId: normalizedUserId,
      actionType: "member_muted",
      reason: muteReason,
      beforeState: buildMembershipAuditSnapshot(currentMembership),
      afterState: buildMembershipAuditSnapshot(nextMembership),
    });

    await adjustGroupMemberCount(client, groupId, getMembershipCountDelta(previousStatus, "muted"));
    await client.query("COMMIT");

    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: randomUUID(),
      eventType: "community.membership.updated",
      occurredAt: new Date().toISOString(),
      groupId,
      actorId: actor.id,
      messageId: null,
      sequence: null,
      payload: {
        userId: normalizedUserId,
        status: "muted",
        reason: muteReason,
        mutedUntil,
      },
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listCommunityGroupMembers(groupId, actor);
}

export async function unmuteCommunityGroupMember(
  groupId: string,
  userId: string,
  actor: CommunityActor,
  reason: string,
): Promise<CommunityResult<CommunityGroupMembersOverview>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const normalizedUserId = userId.trim();
  const unmuteReason = reason.trim();
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await normalizeExpiredMembershipStates(client, { groupId });

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    if (!actorPermissions.includes("community.members.mute") || normalizedUserId === actor.id) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const currentMembership = await loadMembershipRow(client, groupId, normalizedUserId);
    if (!currentMembership) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_membership_not_found" };
    }

    const previousStatus = getEffectiveMembershipStatusFromMembershipRow(currentMembership);
    if (previousStatus !== "muted") {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    await client.query(
      `UPDATE community_group_members
          SET status = 'active',
              joined_at = COALESCE(joined_at, now()),
              updated_at = now(),
              status_updated_by = $3,
              status_reason = NULL,
              muted_until = NULL,
              suspended_until = NULL,
              removed_at = NULL,
              left_at = NULL
        WHERE group_id = $1 AND user_id = $2`,
      [groupId, normalizedUserId, actor.id],
    );

    const nextMembership = await loadMembershipRow(client, groupId, normalizedUserId);
    await recordCommunityModerationAction(client, {
      groupId,
      actor,
      entityType: "community_group_membership",
      entityId: `${groupId}:${normalizedUserId}`,
      targetId: normalizedUserId,
      actionType: "member_unmuted",
      reason: unmuteReason,
      beforeState: buildMembershipAuditSnapshot(currentMembership),
      afterState: buildMembershipAuditSnapshot(nextMembership),
    });

    await adjustGroupMemberCount(client, groupId, getMembershipCountDelta(previousStatus, "active"));
    await client.query("COMMIT");

    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: randomUUID(),
      eventType: "community.membership.updated",
      occurredAt: new Date().toISOString(),
      groupId,
      actorId: actor.id,
      messageId: null,
      sequence: null,
      payload: {
        userId: normalizedUserId,
        status: "active",
        reason: unmuteReason,
      },
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listCommunityGroupMembers(groupId, actor);
}

export async function suspendCommunityGroupMember(
  groupId: string,
  userId: string,
  actor: CommunityActor,
  duration: CommunitySuspensionDuration,
  reason: string,
): Promise<CommunityResult<CommunityGroupMembersOverview>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const normalizedUserId = userId.trim();
  const suspensionReason = reason.trim();
  const suspensionWindow = resolveCommunitySuspensionWindow(duration);
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await normalizeExpiredMembershipStates(client, { groupId });

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    if (!actorPermissions.includes("community.members.suspend") || normalizedUserId === actor.id) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const currentMembership = await loadMembershipRow(client, groupId, normalizedUserId);
    if (!currentMembership) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_membership_not_found" };
    }

    const previousStatus = getEffectiveMembershipStatusFromMembershipRow(currentMembership);
    if (previousStatus !== "active" && previousStatus !== "muted") {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    await client.query(
      `UPDATE community_group_members
          SET status = 'suspended',
              updated_at = now(),
              status_updated_by = $3,
              status_reason = $4,
              muted_until = NULL,
              suspended_until = $5::timestamptz,
              removed_at = NULL,
              left_at = NULL
        WHERE group_id = $1 AND user_id = $2`,
      [groupId, normalizedUserId, actor.id, suspensionReason, suspensionWindow.suspendedUntil],
    );

    const nextMembership = await loadMembershipRow(client, groupId, normalizedUserId);
    await recordCommunityModerationAction(client, {
      groupId,
      actor,
      entityType: "community_group_membership",
      entityId: `${groupId}:${normalizedUserId}`,
      targetId: normalizedUserId,
      actionType: "member_suspended",
      reason: suspensionReason,
      duration: suspensionWindow.duration,
      beforeState: buildMembershipAuditSnapshot(currentMembership),
      afterState: buildMembershipAuditSnapshot(nextMembership),
    });

    await adjustGroupMemberCount(client, groupId, getMembershipCountDelta(previousStatus, "suspended"));
    await client.query("COMMIT");

    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: randomUUID(),
      eventType: "community.member.suspended",
      occurredAt: new Date().toISOString(),
      groupId,
      actorId: actor.id,
      messageId: null,
      sequence: null,
      payload: {
        userId: normalizedUserId,
        status: "suspended",
        reason: suspensionReason,
        duration: suspensionWindow.duration,
        suspendedUntil: suspensionWindow.suspendedUntil,
      },
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listCommunityGroupMembers(groupId, actor);
}

export async function reinstateCommunityGroupMember(
  groupId: string,
  userId: string,
  actor: CommunityActor,
  reason: string,
): Promise<CommunityResult<CommunityGroupMembersOverview>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const normalizedUserId = userId.trim();
  const reinstateReason = reason.trim();
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await normalizeExpiredMembershipStates(client, { groupId });

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    if (!actorPermissions.includes("community.members.suspend") || normalizedUserId === actor.id) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const currentMembership = await loadMembershipRow(client, groupId, normalizedUserId);
    if (!currentMembership) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_membership_not_found" };
    }

    const previousStatus = getEffectiveMembershipStatusFromMembershipRow(currentMembership);
    if (previousStatus !== "suspended") {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    await client.query(
      `UPDATE community_group_members
          SET status = 'active',
              joined_at = COALESCE(joined_at, now()),
              updated_at = now(),
              status_updated_by = $3,
              status_reason = NULL,
              muted_until = NULL,
              suspended_until = NULL,
              removed_at = NULL,
              left_at = NULL
        WHERE group_id = $1 AND user_id = $2`,
      [groupId, normalizedUserId, actor.id],
    );

    const nextMembership = await loadMembershipRow(client, groupId, normalizedUserId);
    await recordCommunityModerationAction(client, {
      groupId,
      actor,
      entityType: "community_group_membership",
      entityId: `${groupId}:${normalizedUserId}`,
      targetId: normalizedUserId,
      actionType: "member_reinstated",
      reason: reinstateReason,
      beforeState: buildMembershipAuditSnapshot(currentMembership),
      afterState: buildMembershipAuditSnapshot(nextMembership),
    });

    await adjustGroupMemberCount(client, groupId, getMembershipCountDelta(previousStatus, "active"));
    await client.query("COMMIT");

    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: randomUUID(),
      eventType: "community.membership.updated",
      occurredAt: new Date().toISOString(),
      groupId,
      actorId: actor.id,
      messageId: null,
      sequence: null,
      payload: {
        userId: normalizedUserId,
        status: "active",
        reason: reinstateReason,
      },
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listCommunityGroupMembers(groupId, actor);
}

export async function banCommunityGroupMember(
  groupId: string,
  userId: string,
  actor: CommunityActor,
  reason: string,
): Promise<CommunityResult<CommunityGroupMembersOverview>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const normalizedUserId = userId.trim();
  const banReason = reason.trim();
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await normalizeExpiredMembershipStates(client, { groupId });

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    if (!actorPermissions.includes("community.members.ban") || normalizedUserId === actor.id) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const previousMembership = await loadMembershipRow(client, groupId, normalizedUserId);
    const previousStatus = previousMembership ? getEffectiveMembershipStatusFromMembershipRow(previousMembership) : null;
    if (previousStatus === "banned") {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const previousInvitation = await loadPendingInvitationRow(client, groupId, normalizedUserId, { forUpdate: true });
    if (previousInvitation) {
      await client.query(
        `UPDATE community_group_invitations
            SET status = 'revoked',
                revoked_at = now(),
                revoked_by_user_id = $2
          WHERE id = $1`,
        [previousInvitation.id, actor.id],
      );
    }

    if (previousMembership) {
      await client.query(
        `UPDATE community_group_members
            SET status = 'banned',
                updated_at = now(),
                status_updated_by = $3,
                status_reason = $4,
                muted_until = NULL,
                suspended_until = NULL,
                removed_at = NULL,
                left_at = NULL,
                banned_at = COALESCE(banned_at, now()),
                rejected_at = NULL
          WHERE group_id = $1 AND user_id = $2`,
        [groupId, normalizedUserId, actor.id, banReason],
      );
    } else {
      await client.query(
        `INSERT INTO community_group_members (
            group_id,
            user_id,
            role,
            status,
            joined_at,
            requested_at,
            invited_at,
            added_by,
            updated_at,
            status_reason,
            status_updated_by,
            muted_until,
            suspended_until,
            removed_at,
            left_at,
            banned_at,
            rejected_at
          )
          VALUES (
            $1,
            $2,
            'member',
            'banned',
            NULL,
            NULL,
            NULL,
            $3,
            now(),
            $4,
            $3,
            NULL,
            NULL,
            NULL,
            NULL,
            now(),
            NULL
          )`,
        [groupId, normalizedUserId, actor.id, banReason],
      );
    }

    const nextMembership = await loadMembershipRow(client, groupId, normalizedUserId);
    await recordCommunityModerationAction(client, {
      groupId,
      actor,
      entityType: "community_group_membership",
      entityId: `${groupId}:${normalizedUserId}`,
      targetId: normalizedUserId,
      actionType: "member_banned",
      reason: banReason,
      duration: "permanent",
      beforeState: buildMembershipAuditSnapshot(previousMembership),
      afterState: buildMembershipAuditSnapshot(nextMembership),
    });

    await adjustGroupMemberCount(client, groupId, getMembershipCountDelta(previousStatus, "banned"));
    await client.query("COMMIT");

    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: randomUUID(),
      eventType: "community.member.banned",
      occurredAt: new Date().toISOString(),
      groupId,
      actorId: actor.id,
      messageId: null,
      sequence: null,
      payload: {
        userId: normalizedUserId,
        status: "banned",
        reason: banReason,
      },
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listCommunityGroupMembers(groupId, actor);
}

export async function listCommunityGroupReports(
  groupId: string,
  viewer?: CommunityViewer,
): Promise<CommunityResult<CommunityReportsOverview>> {
  await ensureCommunitySeeded();
  await normalizeExpiredMembershipStates(defaultExecutor, { groupId, userId: viewer?.id });

  const access = await requireGroupAccess(defaultExecutor, groupId, viewer, true);
  if (!access.ok) {
    return access;
  }

  const actorPermissions = resolveCommunityGroupPermissions(access.value, viewer);
  const reportRows = await loadReportRows(
    defaultExecutor,
    groupId,
    actorPermissions.includes("community.reports.review") ? undefined : { reporterUserId: viewer?.id },
  );
  const linkedModerationActionIds = await loadReportLinkedActionIds(defaultExecutor, reportRows.map((row) => row.id));

  return {
    ok: true,
    value: {
      groupId,
      currentMembership: buildCommunityMembershipSummary(access.value, viewer),
      actorPermissions,
      reports: reportRows.map((row) => mapReportRow(row, linkedModerationActionIds.get(row.id) ?? [])),
    },
  };
}

export async function createCommunityReport(
  groupId: string,
  actor: CommunityActor,
  input: {
    targetType: CommunityReportTargetType;
    targetId: string;
    reasonCategory: CommunityReportReasonCategory;
    description?: string;
  },
): Promise<CommunityResult<CommunityReport>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const normalizedTargetId = input.targetId.trim();
  const description = input.description?.trim() || null;
  const createdAt = new Date().toISOString();
  const reportId = `community_report_${randomUUID()}`;
  const client = await getClient();

  try {
    await client.query("BEGIN");
    await normalizeExpiredMembershipStates(client, { groupId, userId: actor.id });

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const targetValid = await validateCommunityReportTarget(client, groupId, input.targetType, normalizedTargetId);
    if (!targetValid) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_report_invalid_target" };
    }

    const auditEvent = createAdminAuditEvent({
      eventType: "community.report_created",
      actorId: actor.id,
      entityType: "community_report",
      entityId: reportId,
      before: null,
      after: {
        id: reportId,
        reporterId: actor.id,
        groupId,
        targetType: input.targetType,
        targetId: normalizedTargetId,
        reasonCategory: input.reasonCategory,
        description,
        status: "open",
        assignedReviewerId: null,
        resolution: null,
        linkedModerationActionIds: [],
        appealStatus: null,
        createdAt,
        updatedAt: createdAt,
      },
      reason: description ?? input.reasonCategory,
    });
    await insertAdminAuditEventInTransaction(client, auditEvent);

    await client.query(
      `INSERT INTO community_reports (
          id,
          group_id,
          reporter_user_id,
          target_type,
          target_id,
          reason_category,
          description,
          status,
          assigned_reviewer_id,
          resolution,
          appeal_status,
          audit_event_id,
          created_at,
          updated_at,
          resolved_at,
          resolved_by_user_id
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          'open',
          NULL,
          NULL,
          NULL,
          $8,
          $9::timestamptz,
          $9::timestamptz,
          NULL,
          NULL
        )`,
      [
        reportId,
        groupId,
        actor.id,
        input.targetType,
        normalizedTargetId,
        input.reasonCategory,
        description,
        auditEvent.id,
        createdAt,
      ],
    );

    const reportRow = await loadReportRow(client, groupId, reportId);
    await client.query("COMMIT");

    if (!reportRow) {
      return { ok: false, code: "community_report_not_found" };
    }

    const report = mapReportRow(reportRow, []);
    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: randomUUID(),
      eventType: "community.report.created",
      occurredAt: new Date().toISOString(),
      groupId,
      actorId: actor.id,
      messageId: null,
      sequence: null,
      payload: {
        report,
      },
    }));

    return {
      ok: true,
      value: report,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isConstraintViolation(error, "idx_community_reports_open_dedup")) {
      return { ok: false, code: "community_report_duplicate" };
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function reviewCommunityGroupReport(
  groupId: string,
  reportId: string,
  actor: CommunityActor,
  input: {
    status: CommunityReportStatus;
    resolution?: string;
    linkedModerationActionIds?: string[];
  },
): Promise<CommunityResult<CommunityReport>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const normalizedReportId = reportId.trim();
  const resolution = input.resolution?.trim() || null;
  const linkedActionIds = Array.from(new Set((input.linkedModerationActionIds || []).map((value) => value.trim()).filter(Boolean)));
  const reviewedAt = new Date().toISOString();
  const client = await getClient();

  try {
    await client.query("BEGIN");
    await normalizeExpiredMembershipStates(client, { groupId });

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    if (!actorPermissions.includes("community.reports.review")) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const reportRow = await loadReportRow(client, groupId, normalizedReportId, { forUpdate: true });
    if (!reportRow) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_report_not_found" };
    }

    if ((input.status === "actioned" || input.status === "dismissed" || input.status === "resolved") && !resolution) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    if (linkedActionIds.length > 0) {
      const linkedActionsResult = await client.query<{ id: string }>(
        `SELECT id
           FROM community_moderation_actions
          WHERE group_id = $1 AND id = ANY($2::text[])`,
        [groupId, linkedActionIds],
      );
      if (linkedActionsResult.rows.length !== linkedActionIds.length) {
        await client.query("ROLLBACK");
        return { ok: false, code: "community_moderation_action_not_found" };
      }

      await client.query(
        `UPDATE community_moderation_actions
            SET report_id = $1
          WHERE group_id = $2
            AND id = ANY($3::text[])`,
        [normalizedReportId, groupId, linkedActionIds],
      );
    }

    const beforeLinkedActionIds = await loadReportLinkedActionIds(client, [normalizedReportId]);
    const beforeSnapshot = buildReportAuditSnapshot(reportRow, beforeLinkedActionIds.get(normalizedReportId) ?? []);

    await client.query(
      `UPDATE community_reports
          SET status = $3,
              assigned_reviewer_id = $4,
              resolution = $5,
              updated_at = $6::timestamptz,
              resolved_at = CASE
                WHEN $3 IN ('actioned', 'dismissed', 'resolved') THEN $6::timestamptz
                ELSE NULL
              END,
              resolved_by_user_id = CASE
                WHEN $3 IN ('actioned', 'dismissed', 'resolved') THEN $4
                ELSE NULL
              END
        WHERE group_id = $1 AND id = $2`,
      [groupId, normalizedReportId, input.status, actor.id, resolution, reviewedAt],
    );

    const nextReportRow = await loadReportRow(client, groupId, normalizedReportId);
    const afterLinkedActionIds = await loadReportLinkedActionIds(client, [normalizedReportId]);
    if (!nextReportRow) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_report_not_found" };
    }

    const auditEvent = createAdminAuditEvent({
      eventType: "community.report_updated",
      actorId: actor.id,
      entityType: "community_report",
      entityId: normalizedReportId,
      before: beforeSnapshot,
      after: buildReportAuditSnapshot(nextReportRow, afterLinkedActionIds.get(normalizedReportId) ?? []),
      reason: resolution ?? input.status,
    });
    await insertAdminAuditEventInTransaction(client, auditEvent);

    await client.query(
      `UPDATE community_reports
          SET audit_event_id = $3
        WHERE group_id = $1 AND id = $2`,
      [groupId, normalizedReportId, auditEvent.id],
    );

    await client.query("COMMIT");

    const report = mapReportRow(nextReportRow, afterLinkedActionIds.get(normalizedReportId) ?? []);
    emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
      eventId: randomUUID(),
      eventType: "community.report.updated",
      occurredAt: new Date().toISOString(),
      groupId,
      actorId: actor.id,
      messageId: null,
      sequence: null,
      payload: {
        report,
      },
    }));

    if (input.status === "actioned" && linkedActionIds.length > 0) {
      emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
        eventId: randomUUID(),
        eventType: "community.moderation.actioned",
        occurredAt: new Date().toISOString(),
        groupId,
        actorId: actor.id,
        messageId: null,
        sequence: null,
        payload: {
          reportId: normalizedReportId,
          linkedModerationActionIds: linkedActionIds,
        },
      }));
    }

    return {
      ok: true,
      value: report,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listCommunityGroupAppeals(
  groupId: string,
  viewer?: CommunityViewer,
): Promise<CommunityResult<CommunityAppealsOverview>> {
  await ensureCommunitySeeded();
  await normalizeExpiredMembershipStates(defaultExecutor, { groupId, userId: viewer?.id });

  const access = await requireGroupAccess(defaultExecutor, groupId, viewer, true);
  if (!access.ok) {
    return access;
  }

  const actorPermissions = resolveCommunityGroupPermissions(access.value, viewer);
  const appealRows = await loadAppealRows(
    defaultExecutor,
    groupId,
    actorPermissions.includes("community.appeals.resolve") ? undefined : { appellantUserId: viewer?.id },
  );

  return {
    ok: true,
    value: {
      groupId,
      currentMembership: buildCommunityMembershipSummary(access.value, viewer),
      actorPermissions,
      appeals: appealRows.map((row) => mapAppealRow(row)),
    },
  };
}

export async function createCommunityGroupAppeal(
  groupId: string,
  actor: CommunityActor,
  input: {
    moderationActionId: string;
    reason: string;
  },
): Promise<CommunityResult<CommunityAppeal>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const moderationActionId = input.moderationActionId.trim();
  const appealReason = input.reason.trim();
  const createdAt = new Date().toISOString();
  const appealId = `community_appeal_${randomUUID()}`;
  const client = await getClient();

  try {
    await client.query("BEGIN");
    await normalizeExpiredMembershipStates(client, { groupId, userId: actor.id });

    const groupExists = await communityGroupExists(client, groupId);
    if (!groupExists) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_not_found" };
    }

    const moderationAction = await loadModerationActionRow(client, groupId, moderationActionId, { forUpdate: true });
    if (!moderationAction) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_moderation_action_not_found" };
    }

    if (
      moderationAction.target_type !== "member"
      || moderationAction.target_id !== actor.id
      || !isAppealableModerationActionType(moderationAction.action_type)
    ) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const auditEvent = createAdminAuditEvent({
      eventType: "community.appeal_created",
      actorId: actor.id,
      entityType: "community_appeal",
      entityId: appealId,
      before: null,
      after: {
        id: appealId,
        groupId,
        moderationActionId,
        auditEventId: null,
        appellantId: actor.id,
        reason: appealReason,
        status: "open",
        resolutionOutcome: null,
        resolutionReason: null,
        resolvedByUserId: null,
        createdAt,
        updatedAt: createdAt,
        resolvedAt: null,
      },
      reason: appealReason,
    });
    await insertAdminAuditEventInTransaction(client, auditEvent);

    await client.query(
      `INSERT INTO community_appeals (
          id,
          group_id,
          moderation_action_id,
          audit_event_id,
          appellant_user_id,
          reason,
          status,
          resolution_outcome,
          resolution_reason,
          resolved_by_user_id,
          created_at,
          updated_at,
          resolved_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'open',
          NULL,
          NULL,
          NULL,
          $7::timestamptz,
          $7::timestamptz,
          NULL
        )`,
      [appealId, groupId, moderationActionId, auditEvent.id, actor.id, appealReason, createdAt],
    );

    let linkedReport: CommunityReport | null = null;
    if (moderationAction.report_id) {
      await client.query(
        `UPDATE community_reports
            SET status = 'appealed',
                appeal_status = 'open',
                updated_at = now(),
                resolved_at = NULL,
                resolved_by_user_id = NULL
          WHERE group_id = $1 AND id = $2`,
        [groupId, moderationAction.report_id],
      );

      const reportRow = await loadReportRow(client, groupId, moderationAction.report_id);
      if (reportRow) {
        const linkedActionIds = await loadReportLinkedActionIds(client, [reportRow.id]);
        linkedReport = mapReportRow(reportRow, linkedActionIds.get(reportRow.id) ?? []);
      }
    }

    const appealRow = await loadAppealRow(client, groupId, appealId);
    await client.query("COMMIT");

    if (!appealRow) {
      return { ok: false, code: "community_appeal_not_found" };
    }

    if (linkedReport) {
      emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
        eventId: randomUUID(),
        eventType: "community.report.updated",
        occurredAt: new Date().toISOString(),
        groupId,
        actorId: actor.id,
        messageId: null,
        sequence: null,
        payload: {
          report: linkedReport,
        },
      }));
    }

    return {
      ok: true,
      value: mapAppealRow(appealRow),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isConstraintViolation(error, "idx_community_appeals_open_unique")) {
      return { ok: false, code: "community_appeal_duplicate" };
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function resolveCommunityGroupAppeal(
  groupId: string,
  appealId: string,
  actor: CommunityActor,
  input: {
    outcome: CommunityAppealOutcome;
    resolutionReason: string;
  },
): Promise<CommunityResult<CommunityAppeal>> {
  await ensureCommunitySeeded();
  await ensureAdminAuthorityTables();

  const normalizedAppealId = appealId.trim();
  const resolutionReason = input.resolutionReason.trim();
  const resolvedAt = new Date().toISOString();
  const client = await getClient();

  try {
    await client.query("BEGIN");
    await normalizeExpiredMembershipStates(client, { groupId });

    const access = await requireGroupAccess(client, groupId, actor, true);
    if (!access.ok) {
      await client.query("ROLLBACK");
      return access;
    }

    const actorPermissions = resolveCommunityGroupPermissions(access.value, actor);
    if (!actorPermissions.includes("community.appeals.resolve")) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_group_forbidden" };
    }

    const appealRow = await loadAppealRow(client, groupId, normalizedAppealId, { forUpdate: true });
    if (!appealRow) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_appeal_not_found" };
    }

    const moderationAction = await loadModerationActionRow(client, groupId, appealRow.moderation_action_id, { forUpdate: true });
    if (!moderationAction) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_moderation_action_not_found" };
    }

    const beforeAppealSnapshot = buildAppealAuditSnapshot(appealRow);
    const { previousStatus, nextStatus } = await applyAppealOutcomeToMembership(
      client,
      groupId,
      moderationAction,
      appealRow.appellant_user_id,
      actor.id,
      input.outcome,
    );

    await client.query(
      `UPDATE community_appeals
          SET status = 'resolved',
              resolution_outcome = $3,
              resolution_reason = $4,
              resolved_by_user_id = $5,
              updated_at = $6::timestamptz,
              resolved_at = $6::timestamptz
        WHERE group_id = $1 AND id = $2`,
      [groupId, normalizedAppealId, input.outcome, resolutionReason, actor.id, resolvedAt],
    );

    const nextAppealRow = await loadAppealRow(client, groupId, normalizedAppealId);
    if (!nextAppealRow) {
      await client.query("ROLLBACK");
      return { ok: false, code: "community_appeal_not_found" };
    }

    await recordCommunityModerationAction(client, {
      groupId,
      actor,
      entityType: "community_appeal",
      entityId: normalizedAppealId,
      targetId: appealRow.appellant_user_id,
      targetType: "member",
      actionType: "appeal_resolved",
      reason: resolutionReason,
      reportId: moderationAction.report_id,
      beforeState: beforeAppealSnapshot,
      afterState: buildAppealAuditSnapshot(nextAppealRow),
    });

    const linkedReport = await syncReportAfterAppealResolution(
      client,
      groupId,
      moderationAction,
      actor.id,
      resolutionReason,
      resolvedAt,
    );

    await client.query("COMMIT");

    if (previousStatus !== nextStatus && nextStatus) {
      emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
        eventId: randomUUID(),
        eventType: "community.membership.updated",
        occurredAt: new Date().toISOString(),
        groupId,
        actorId: actor.id,
        messageId: null,
        sequence: null,
        payload: {
          userId: appealRow.appellant_user_id,
          status: nextStatus,
          reason: resolutionReason,
          appealOutcome: input.outcome,
        },
      }));
    }

    if (linkedReport) {
      emitCommunityServiceRealtime(buildCommunityRealtimeEvent({
        eventId: randomUUID(),
        eventType: "community.report.updated",
        occurredAt: new Date().toISOString(),
        groupId,
        actorId: actor.id,
        messageId: null,
        sequence: null,
        payload: {
          report: linkedReport,
        },
      }));
    }

    return {
      ok: true,
      value: mapAppealRow(nextAppealRow),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}