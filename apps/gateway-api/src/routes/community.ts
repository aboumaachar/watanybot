import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import type {
  CommunityAppealOutcome,
  CommunityGroup,
  CommunityMessage,
  CommunityReportReasonCategory,
  CommunityReportStatus,
  CommunityReportTargetType,
  CommunitySuspensionDuration,
} from "@watany/types";

import {
  addCommunityMessage,
  acceptCommunityGroupInvitation,
  validateCommunityGroupAccess,
  validateCommunityGroupWriteAccess,
  banCommunityGroupMember,
  createCommunityGroupAppeal,
  createCommunityReport,
  createCommunityGroup,
  deleteCommunityMessageForSelf,
  deleteCommunityMessageForEveryone,
  editCommunityMessage,
  forwardCommunityMessage,
  getCommunityGroupDetail,
  getCommunityGroupMessagesPage,
  inviteCommunityGroupMember,
  listCommunityGroupAppeals,
  leaveCommunityGroup,
  listCommunityGroupMembers,
  listCommunityGroups,
  listCommunityGroupReports,
  listCommunityStarredMessages,
  markCommunityGroupRead,
  muteCommunityGroupMember,
  reinstateCommunityGroupMember,
  requestCommunityGroupMembership,
  resetCommunityStore,
  resolveCommunityGroupAppeal,
  revokeCommunityGroupInvitation,
  reviewCommunityGroupReport,
  reviewCommunityGroupMembership,
  setCommunityMessagePinnedState,
  setCommunityMessageStarredState,
  setCommunityGroupTyping,
  setCommunityServiceTelemetryEmitter,
  suspendCommunityGroupMember,
  toggleCommunityMessageReaction,
  unmuteCommunityGroupMember,
  updateCommunityGroup,
  warnCommunityGroupMember,
} from "../community/service.js";
import {
  buildCommunityAttachmentContentUrl,
  ensureCommunityAttachmentStorage,
  storeCommunityAttachmentUpload,
} from "../community/attachment-security.js";
import { query } from "../lib/db.js";
import { isFeatureFlagEnabled } from "../lib/feature-flags.js";
import { enqueueManagedCommunityNotification } from "../lib/notification-authority.js";
import type { PluginDb } from "../types/domain";

type CommunityFeatureFlag =
  | "community.enabled"
  | "community.attachments.enabled"
  | "community.entry.enabled"
  | "community.threads.enabled"
  | "community.writes.enabled"
  | "community.announcements.enabled"
  | "community.membership.enabled"
  | "community.join_requests.enabled"
  | "community.invitations.enabled"
  | "community.member_management.enabled"
  | "community.moderation.enabled"
  | "community.reporting.enabled"
  | "community.appeals.enabled";

type CommunityTelemetryLevel = "info" | "warn" | "error";
type FeatureFlagResolver = (flagId: string, defaultValue?: boolean) => Promise<boolean>;
type CommunityRequest = { user?: { id: string; role: string; email: string } };
type CommunityReply = { code: (statusCode: number) => { send: (body: unknown) => unknown } };
type CommunityTelemetryContext = {
  action: string;
  actorId?: string;
  actorRole?: string;
  errorCode?: string;
  flag?: string;
  groupCount?: number;
  groupId?: string;
  isTyping?: boolean;
  messageId?: string;
  statusCode?: number;
  targetUserId?: string;
  unreadCount?: number;
  visibility?: string;
};

type CommunityAttachmentMessageType = "attachment" | "voice";

type CommunityAttachmentRow = {
  id: string;
  group_id: string;
  message_id: string | null;
  uploaded_by_user_id: string;
  original_name: string;
  mime_type: string;
  bytes: string | number;
  sha256: string;
  storage_key: string;
  scan_status: string;
  message_deleted_for_everyone: boolean;
  scan_provider: string | null;
  duration_ms: string | number | null;
  scanned_at: string | Date | null;
  created_at: string | Date;
  position: number;
};

type CommunityAttachmentView = {
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

const PRODUCTION_ENV_KEYS = ["NODE_ENV", "APP_ENV", "ENVIRONMENT", "VERCEL_ENV"] as const;

export type CommunityTelemetryRecord = {
  event: string;
  level: CommunityTelemetryLevel;
  data: Record<string, unknown>;
};

export interface CommunityRoutesOptions {
  makeId?: (prefix: string) => string;
  getFeatureFlag?: FeatureFlagResolver;
  onTelemetry?: (record: CommunityTelemetryRecord) => void;
}

function defaultId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseReplyPreview(value: unknown): CommunityMessage["replyToPreview"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || typeof candidate.senderName !== "string" || typeof candidate.body !== "string") {
    return undefined;
  }

  return {
    id: candidate.id,
    senderName: candidate.senderName,
    body: candidate.body,
  };
}

type CommunityReplyTargetRow = {
  id: string;
  sender_name: string;
  body: string | null;
  attachment_url: string | null;
  type: CommunityMessage["type"];
  deleted_for_everyone_at: string | Date | null;
};

function fallbackReplyTargetBody(target: Pick<CommunityReplyTargetRow, "attachment_url" | "type">): string {
  if (target.type === "voice" && target.attachment_url) {
    return "رسالة صوتية محمية";
  }

  if (target.attachment_url) {
    return "مرفق محمي";
  }

  return "رسالة بدون نص";
}

function buildReplyTargetPreview(target: CommunityReplyTargetRow): CommunityMessage["replyToPreview"] {
  if (target.deleted_for_everyone_at) {
    return {
      id: target.id,
      senderName: target.sender_name,
      body: "رسالة محذوفة للجميع",
    };
  }

  const trimmedBody = typeof target.body === "string" ? target.body.trim() : "";
  return {
    id: target.id,
    senderName: target.sender_name,
    body: trimmedBody || fallbackReplyTargetBody(target),
  };
}

async function resolveCommunityReplyPreview(input: {
  groupId: string;
  replyToMessageId?: string;
  viewerId: string;
}): Promise<
  | { ok: true; value: CommunityMessage["replyToPreview"] | undefined }
  | { ok: false; code: "community_message_not_found" }
> {
  if (!input.replyToMessageId) {
    return { ok: true, value: undefined };
  }

  const result = await query<CommunityReplyTargetRow>(
    `SELECT
        m.id,
        m.sender_name,
        m.body,
        m.attachment_url,
        m.type,
        m.deleted_for_everyone_at
      FROM community_messages m
      WHERE m.id = $1
        AND m.group_id = $2
        AND NOT EXISTS (
          SELECT 1
          FROM community_message_hidden_for_user hidden
          WHERE hidden.message_id = m.id
            AND hidden.user_id = $3
        )
      LIMIT 1`,
    [input.replyToMessageId, input.groupId, input.viewerId],
  );
  const replyTarget = result.rows[0];
  if (!replyTarget) {
    return { ok: false, code: "community_message_not_found" };
  }

  return {
    ok: true,
    value: buildReplyTargetPreview(replyTarget),
  };
}

function normalizeOptionalCommunityField(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseCommunityAttachmentMessageType(value: unknown): CommunityAttachmentMessageType | null {
  return value === "attachment" || value === "voice" ? value : null;
}

function toIsoStringValue(value: string | Date | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function buildCommunityNotificationRoute(groupId: string, messageId: string): string {
  return `/groups/${encodeURIComponent(groupId)}?messageId=${encodeURIComponent(messageId)}`;
}

export function buildCommunityNotificationId(prefix: string, messageId: string, targetUserId: string): string {
  const rawId = `${prefix}_${messageId}_${targetUserId}`;
  if (rawId.length <= 96) {
    return rawId;
  }

  const digest = createHash("sha256").update(rawId).digest("hex").slice(0, 32);
  return `${prefix}_${digest}`;
}

function buildCommunityReplyNotificationBody(actorDisplayName: string, message: CommunityMessage): string {
  const trimmedBody = typeof message.body === "string" ? message.body.trim() : "";
  if (trimmedBody) {
    return `${actorDisplayName} رد على رسالتك: ${trimmedBody.slice(0, 140)}`;
  }

  if (message.type === "voice") {
    return `${actorDisplayName} رد على رسالتك بمذكرة صوتية محمية.`;
  }

  if (message.type === "attachment") {
    return `${actorDisplayName} رد على رسالتك بمرفق محمي.`;
  }

  return `${actorDisplayName} رد على رسالتك داخل المجموعة.`;
}

function buildCommunityReplyNotificationSafeBody(actorDisplayName: string): string {
  return "لديك رسالة جديدة في مجموعة موطني";
}

function buildCommunityMentionNotificationBody(actorDisplayName: string, message: CommunityMessage): string {
  const trimmedBody = typeof message.body === "string" ? message.body.trim() : "";
  if (trimmedBody) {
    return `${actorDisplayName} ذكرك في رسالة: ${trimmedBody.slice(0, 140)}`;
  }

  if (message.type === "voice") {
    return `${actorDisplayName} ذكرك في مذكرة صوتية محمية داخل المجموعة.`;
  }

  if (message.type === "attachment") {
    return `${actorDisplayName} ذكرك في مرفق محمي داخل المجموعة.`;
  }

  return `${actorDisplayName} ذكرك داخل المجموعة.`;
}

function buildCommunityMentionNotificationSafeBody(actorDisplayName: string): string {
  return "لديك رسالة جديدة في مجموعة موطني";
}

async function enqueueCommunityReplyNotification(input: {
  pluginDb?: PluginDb;
  groupId: string;
  actorId: string;
  actorDisplayName: string;
  replyToMessageId?: string;
  message: CommunityMessage;
}): Promise<void> {
  if (!input.pluginDb || !input.replyToMessageId) {
    return;
  }

  const result = await query<{ sender_id: string; group_name: string | null }>(
    `SELECT m.sender_id, g.name AS group_name
      FROM community_messages m
      JOIN community_groups g ON g.id = m.group_id
      WHERE m.id = $1 AND m.group_id = $2
      LIMIT 1`,
    [input.replyToMessageId, input.groupId],
  );
  const replyTarget = result.rows[0];
  const targetUserId = typeof replyTarget?.sender_id === "string" ? replyTarget.sender_id.trim() : "";
  if (!targetUserId || targetUserId === input.actorId) {
    return;
  }

  const membershipResult = await query<{ status: string }>(
    `SELECT status
      FROM community_group_members
      WHERE group_id = $1 AND user_id = $2
      LIMIT 1`,
    [input.groupId, targetUserId],
  );
  if (membershipResult.rows[0]?.status && membershipResult.rows[0].status !== "active") {
    return;
  }

  const groupName = typeof replyTarget.group_name === "string" && replyTarget.group_name.trim()
    ? replyTarget.group_name.trim()
    : "المجموعة";
  const createdAtTs = Date.parse(input.message.createdAt || "") || Date.now();
  enqueueManagedCommunityNotification({
    pluginDb: input.pluginDb,
    targetUserId,
    groupId: input.groupId,
    notificationId: buildCommunityNotificationId("notif_community_reply", input.message.id, targetUserId),
    title: `رد جديد في ${groupName}`,
    safeBody: buildCommunityReplyNotificationSafeBody(input.actorDisplayName),
    richBody: buildCommunityReplyNotificationBody(input.actorDisplayName, input.message),
    kind: "system",
    refType: "route",
    refId: buildCommunityNotificationRoute(input.groupId, input.message.id),
    createdAtTs,
    channel: "reply",
  });
}

async function enqueueCommunityMentionNotifications(input: {
  pluginDb?: PluginDb;
  groupId: string;
  actorId: string;
  actorDisplayName: string;
  message: CommunityMessage;
}): Promise<void> {
  if (!input.pluginDb || !Array.isArray(input.message.mentions) || input.message.mentions.length === 0) {
    return;
  }

  const result = await query<{ name: string | null }>(
    `SELECT name
      FROM community_groups
      WHERE id = $1
      LIMIT 1`,
    [input.groupId],
  );
  const groupName = typeof result.rows[0]?.name === "string" && result.rows[0].name.trim()
    ? result.rows[0].name.trim()
    : "المجموعة";
  const createdAtTs = Date.parse(input.message.createdAt || "") || Date.now();

  const targetUserIds = Array.from(new Set(
    input.message.mentions
      .map((mention) => mention.userId.trim())
      .filter((userId) => Boolean(userId) && userId !== input.actorId),
  ));

  if (targetUserIds.length === 0) {
    return;
  }

  const membershipResult = await query<{ user_id: string; status: string }>(
    `SELECT user_id, status
      FROM community_group_members
      WHERE group_id = $1 AND user_id = ANY($2::text[])`,
    [input.groupId, targetUserIds],
  );
  const membershipStatuses = new Map(
    membershipResult.rows
      .map((row) => [String(row.user_id || "").trim(), String(row.status || "").trim()] as const)
      .filter(([userId]) => Boolean(userId)),
  );

  for (const targetUserId of targetUserIds) {
    if (membershipStatuses.has(targetUserId) && membershipStatuses.get(targetUserId) !== "active") {
      continue;
    }

    enqueueManagedCommunityNotification({
      pluginDb: input.pluginDb,
      targetUserId,
      groupId: input.groupId,
      notificationId: buildCommunityNotificationId("notif_community_mention", input.message.id, targetUserId),
      title: `ذُكرت في ${groupName}`,
      safeBody: buildCommunityMentionNotificationSafeBody(input.actorDisplayName),
      richBody: buildCommunityMentionNotificationBody(input.actorDisplayName, input.message),
      kind: "system",
      refType: "route",
      refId: buildCommunityNotificationRoute(input.groupId, input.message.id),
      createdAtTs,
      channel: "mention",
    });
  }
}

function mapCommunityAttachmentRow(row: CommunityAttachmentRow): CommunityAttachmentView {
  return {
    id: row.id,
    groupId: row.group_id,
    messageId: row.message_id || undefined,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: Number(row.bytes || 0),
    sha256: row.sha256,
    createdAt: toIsoStringValue(row.created_at) || new Date().toISOString(),
    scannedAt: toIsoStringValue(row.scanned_at),
    scanProvider: row.scan_provider || undefined,
    attachmentUrl: buildCommunityAttachmentContentUrl(row.id),
    durationMs: row.duration_ms == null ? undefined : Number(row.duration_ms),
  };
}

function buildInlineContentDisposition(filename: string): string {
  return `inline; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function authenticatedActorDisplayName(email: string, actorId: string): string {
  const localPart = email.split("@")[0]?.trim();
  return localPart || actorId;
}

function parseCommunityPageLimit(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCommunityBeforeCursor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseRequiredModerationReason(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function parseCommunitySuspensionDuration(value: unknown): CommunitySuspensionDuration | null {
  return value === "24h" || value === "7d" || value === "30d" ? value : null;
}

function parseCommunityReportTargetType(value: unknown): CommunityReportTargetType | null {
  return value === "message" || value === "member" || value === "group" || value === "moderation_action"
    ? value
    : null;
}

function parseCommunityReportReasonCategory(value: unknown): CommunityReportReasonCategory | null {
  return value === "harassment"
    || value === "threats"
    || value === "spam"
    || value === "impersonation"
    || value === "fraud"
    || value === "hate_or_discriminatory_abuse"
    || value === "privacy_violation"
    || value === "inappropriate_content"
    || value === "misinformation_requiring_review"
    || value === "other"
    ? value
    : null;
}

function parseCommunityReportReviewStatus(value: unknown): CommunityReportStatus | null {
  return value === "open"
    || value === "under_review"
    || value === "actioned"
    || value === "dismissed"
    || value === "appealed"
    || value === "resolved"
    ? value
    : null;
}

function parseCommunityAppealOutcome(value: unknown): CommunityAppealOutcome | null {
  return value === "upheld" || value === "modified" || value === "reversed" ? value : null;
}

function sanitizeCommunityTelemetryData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null),
  );
}

function writeCommunityTelemetry(
  app: Parameters<FastifyPluginAsync<CommunityRoutesOptions>>[0],
  event: string,
  level: CommunityTelemetryLevel,
  data: Record<string, unknown>,
): void {
  if (level === "error") {
    app.log.error(data, event);
    return;
  }

  if (level === "warn") {
    app.log.warn(data, event);
    return;
  }

  app.log.info(data, event);
}

function createCommunityTelemetryEmitter(
  app: Parameters<FastifyPluginAsync<CommunityRoutesOptions>>[0],
  onTelemetry?: (record: CommunityTelemetryRecord) => void,
) {
  return (event: string, level: CommunityTelemetryLevel, data: Record<string, unknown>) => {
    const payload = sanitizeCommunityTelemetryData(data);
    writeCommunityTelemetry(app, event, level, payload);
    onTelemetry?.({ event, level, data: payload });
  };
}

function hasProductionIndicators(): boolean {
  return PRODUCTION_ENV_KEYS.some((key) => {
    const raw = process.env[key];
    if (typeof raw !== "string") {
      return false;
    }

    const value = raw.trim().toLowerCase();
    return value === "production" || value === "prod";
  });
}

async function ensureCommunityFeatures(
  reply: CommunityReply,
  emit: ReturnType<typeof createCommunityTelemetryEmitter>,
  getFeatureFlag: FeatureFlagResolver,
  flags: CommunityFeatureFlag[],
  context: CommunityTelemetryContext,
): Promise<boolean> {
  const orderedFlags = ["community.enabled", ...flags].filter(
    (flag, index, values) => values.indexOf(flag) === index,
  ) as CommunityFeatureFlag[];

  for (const flag of orderedFlags) {
    const enabled = await getFeatureFlag(flag, true);
    if (enabled) {
      continue;
    }

    emit("community.feature_flag_rejected", "warn", {
      ...context,
      flag,
      statusCode: 403,
    });
    reply.code(403).send({ error: "community_feature_disabled", flag });
    return false;
  }

  return true;
}

async function withPersistenceTelemetry<T>(
  emit: ReturnType<typeof createCommunityTelemetryEmitter>,
  context: CommunityTelemetryContext,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    emit("community.persistence_failed", "error", {
      ...context,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}

function resolveAuthenticatedActor(
  req: CommunityRequest,
  reply: CommunityReply,
  emit: ReturnType<typeof createCommunityTelemetryEmitter>,
  context: CommunityTelemetryContext,
) {
  const actor = req.user;
  if (!actor) {
    emit("community.auth_failed", "warn", {
      ...context,
      actorRole: "public",
      statusCode: 401,
    });
    reply.code(401).send({ error: "غير مصرح — يرجى تسجيل الدخول" });
    return null;
  }

  return {
    id: actor.id,
    role: actor.role,
    email: actor.email,
    displayName: authenticatedActorDisplayName(actor.email, actor.id),
  };
}

function resolveCommunitySenderRole(role: string): CommunityMessage["senderRole"] {
  if (role === "superadmin") return "superadmin";
  if (role === "admin" || role === "moderator") return "admin";
  return "user";
}

function hasCommunityElevatedRole(role: string): boolean {
  return role === "moderator" || role === "admin" || role === "superadmin";
}

function sendCommunityError(
  reply: CommunityReply,
  code:
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
    | "community_appeal_duplicate",
  emit: ReturnType<typeof createCommunityTelemetryEmitter>,
  context: CommunityTelemetryContext,
) {
  if (code === "community_group_auth_required") {
    emit("community.auth_failed", "warn", {
      ...context,
      actorRole: context.actorRole || "public",
      errorCode: code,
      statusCode: 401,
    });
    return reply.code(401).send({ error: code });
  }
  if (code === "community_group_forbidden" || code === "community_message_forbidden" || code === "community_forward_destination_forbidden") {
    emit("community.authorization_denied", "warn", {
      ...context,
      errorCode: code,
      statusCode: 403,
    });
    return reply.code(403).send({ error: code });
  }
  if (code === "community_invalid_cursor") {
    emit("community.read", "warn", {
      ...context,
      errorCode: code,
      statusCode: 400,
    });
    return reply.code(400).send({ error: code });
  }
  if (code === "community_forward_source_invalid") {
    return reply.code(400).send({ error: code });
  }
  if (code === "community_report_invalid_target") {
    return reply.code(400).send({ error: code });
  }
  if (code === "community_message_deleted") {
    return reply.code(409).send({ error: code });
  }
  if (code === "community_message_edit_window_expired") {
    return reply.code(409).send({ error: code });
  }
  if (code === "community_member_limit_reached" || code === "community_report_duplicate" || code === "community_appeal_duplicate") {
    return reply.code(409).send({ error: code });
  }
  return reply.code(404).send({ error: code });
}

export const communityRoutes: FastifyPluginAsync<CommunityRoutesOptions> = async (app, opts) => {
  const makeId = opts?.makeId ?? defaultId;
  const getFeatureFlag = opts?.getFeatureFlag ?? isFeatureFlagEnabled;
  const emit = createCommunityTelemetryEmitter(app, opts?.onTelemetry);

  setCommunityServiceTelemetryEmitter((event) => {
    emit(event.event, event.level ?? "info", event.data);
  });

  app.addHook("onClose", async () => {
    setCommunityServiceTelemetryEmitter(null);
  });

  app.addHook("onReady", async () => {
    try {
      const [groupsResult, messagesResult, typingResult] = await Promise.all([
        query<{ count: string | number }>("SELECT COUNT(*)::int AS count FROM community_groups"),
        query<{ count: string | number }>("SELECT COUNT(*)::int AS count FROM community_messages"),
        query<{ count: string | number }>("SELECT COUNT(*)::int AS count FROM community_typing_state"),
      ]);

      const groupCount = Number(groupsResult.rows[0]?.count ?? 0);
      const messageCount = Number(messagesResult.rows[0]?.count ?? 0);
      const typingCount = Number(typingResult.rows[0]?.count ?? 0);

      if (groupCount > 0 && messageCount > 0) {
        emit("community.restart_persistence_verified", "info", {
          action: "restart_persistence_verified",
          groupCount,
          messageCount,
          typingCount,
        });
      }
    } catch (error) {
      emit("community.persistence_failed", "error", {
        action: "restart_persistence_verification",
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    app.post("/api/community/debug/reset", async (req, reply) => {
      const baseContext: CommunityTelemetryContext = {
        action: "debug_reset",
        actorId: req.user?.id,
        actorRole: req.user?.role || "public",
      };

      emit("community.debug_reset_attempted", "warn", baseContext);

      if (hasProductionIndicators()) {
        emit("community.authorization_denied", "warn", {
          ...baseContext,
          errorCode: "community_debug_reset_forbidden_in_production",
          statusCode: 403,
        });
        reply.code(403);
        return { error: "community_debug_reset_forbidden_in_production" };
      }

      if (process.env.COMMUNITY_DEBUG_RESET_ENABLED !== "true") {
        reply.code(403);
        return { error: "community_debug_reset_disabled" };
      }

      const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
      if (!actor) {
        return;
      }

      if (actor.role !== "superadmin") {
        emit("community.authorization_denied", "warn", {
          ...baseContext,
          actorId: actor.id,
          actorRole: actor.role,
          errorCode: "community_group_forbidden",
          statusCode: 403,
        });
        reply.code(403);
        return { error: "community_group_forbidden" };
      }

      await withPersistenceTelemetry(emit, {
        ...baseContext,
        actorId: actor.id,
        actorRole: actor.role,
      }, async () => {
        await resetCommunityStore();
      });

      const overview = await withPersistenceTelemetry(emit, {
        ...baseContext,
        actorId: actor.id,
        actorRole: actor.role,
      }, async () => listCommunityGroups({ id: actor.id, role: actor.role }));

      emit("community.debug_reset_completed", "info", {
        ...baseContext,
        actorId: actor.id,
        actorRole: actor.role,
        groupCount: overview.groups.length,
      });

      return overview;
    });
  }

  app.get("/api/community/groups", async (req, reply) => {
    const context: CommunityTelemetryContext = {
      action: "list_groups",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.entry.enabled"], context)) {
      return;
    }

    const overview = await withPersistenceTelemetry(emit, context, async () => {
      return listCommunityGroups(req.user ? { id: req.user.id, role: req.user.role } : undefined);
    });

    emit("community.read", "info", {
      ...context,
      groupCount: overview.groups.length,
    });

    return overview;
  });

  app.get<{ Params: { id: string }; Querystring: { before?: string; limit?: string } }>("/api/community/groups/:id", async (req, reply) => {
    const context: CommunityTelemetryContext = {
      action: "group_detail",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled"], context)) {
      return;
    }

    const detail = await withPersistenceTelemetry(emit, context, async () => getCommunityGroupDetail(
      req.params.id,
      req.user ? { id: req.user.id, role: req.user.role } : undefined,
      {
        beforeMessageId: parseCommunityBeforeCursor(req.query?.before),
        limit: parseCommunityPageLimit(req.query?.limit),
      },
    ));
    if (!detail.ok) {
      return sendCommunityError(reply, detail.code, emit, context);
    }

    emit("community.read", "info", {
      ...context,
      visibility: detail.value.group.visibility,
    });

    return detail.value;
  });

  app.get<{ Params: { id: string }; Querystring: { before?: string; limit?: string; q?: string } }>("/api/community/groups/:id/messages", async (req, reply) => {
    const context: CommunityTelemetryContext = {
      action: "group_messages_page",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled"], context)) {
      return;
    }

    const page = await withPersistenceTelemetry(emit, context, async () => getCommunityGroupMessagesPage(
      req.params.id,
      req.user ? { id: req.user.id, role: req.user.role } : undefined,
      {
        beforeCursor: parseCommunityBeforeCursor(req.query?.before),
        limit: parseCommunityPageLimit(req.query?.limit),
        search: normalizeOptionalCommunityField(req.query?.q),
      },
    ));

    if (!page.ok) {
      return sendCommunityError(reply, page.code, emit, context);
    }

    emit("community.read", "info", context);

    return page.value;
  });

  app.get<{ Params: { id: string }; Querystring: { filter?: string; limit?: string; q?: string } }>("/api/community/groups/:id/search", async (req, reply) => {
    const context: CommunityTelemetryContext = {
      action: "group_messages_search",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled"], context)) {
      return;
    }

    const searchQuery = normalizeOptionalCommunityField(req.query?.q);
    const searchFilter = req.query?.filter || "all";
    if (!["all", "media", "links", "documents", "audio"].includes(searchFilter)) {
      reply.code(400).send({ error: "community_search_filter_invalid" });
      return;
    }
    if (!searchQuery && searchFilter === "all") {
      emit("community.read", "warn", {
        ...context,
        errorCode: "community_search_query_required",
        statusCode: 400,
      });
      reply.code(400).send({ error: "community_search_query_required" });
      return;
    }

    const page = await withPersistenceTelemetry(emit, context, async () => getCommunityGroupMessagesPage(
      req.params.id,
      req.user ? { id: req.user.id, role: req.user.role } : undefined,
      {
        limit: parseCommunityPageLimit(req.query?.limit),
        search: searchQuery,
        filter: searchFilter as "all" | "media" | "links" | "documents" | "audio",
      },
    ));

    if (!page.ok) {
      return sendCommunityError(reply, page.code, emit, context);
    }

    emit("community.read", "info", {
      ...context,
      search: true,
    });

    return page.value;
  });

  app.get<{ Params: { id: string } }>("/api/community/groups/:id/members", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "list_group_members",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.member_management.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => listCommunityGroupMembers(req.params.id, {
      id: actor.id,
      role: actor.role,
    }));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.read", "info", {
      ...context,
      unreadCount: result.value.memberCount,
    });

    return result.value;
  });

  app.post<{ Params: { id: string } }>("/api/community/groups/:id/membership/request", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "request_membership",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.join_requests.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => requestCommunityGroupMembership(req.params.id, {
      id: actor.id,
      role: actor.role,
    }));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{ Params: { id: string } }>("/api/community/groups/:id/membership/leave", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "leave_membership",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => leaveCommunityGroup(req.params.id, {
      id: actor.id,
      role: actor.role,
    }));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string };
    Body: { sourceMessageId?: string; clientRequestId?: string };
  }>("/api/community/groups/:id/forward", async (req, reply) => {
    const sourceMessageId = typeof req.body?.sourceMessageId === "string" ? req.body.sourceMessageId.trim() : "";
    const clientRequestId = typeof req.body?.clientRequestId === "string" ? req.body.clientRequestId.trim() : "";
    if (!sourceMessageId || !clientRequestId) {
      return reply.code(400).send({ error: "community_forward_request_invalid" });
    }

    const baseContext: CommunityTelemetryContext = {
      action: "forward_message",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) return;
    const context = { ...baseContext, actorId: actor.id, actorRole: actor.role };
    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled", "community.writes.enabled"], context)) return;

    const result = await withPersistenceTelemetry(emit, context, async () => forwardCommunityMessage(
      req.params.id,
      sourceMessageId,
      clientRequestId,
      { id: actor.id, role: actor.role, displayName: actor.displayName },
    ));
    if (!result.ok) return sendCommunityError(reply, result.code, emit, context);
    emit("community.write", "info", { ...context, messageId: result.value.id });
    return result.value;
  });

  app.post<{
    Params: { id: string };
    Body: { invitedUserId?: string; note?: string; expiresInDays?: number };
  }>("/api/community/groups/:id/invitations", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "invite_member",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      targetUserId: typeof req.body?.invitedUserId === "string" ? req.body.invitedUserId.trim() : undefined,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const invitedUserId = typeof req.body?.invitedUserId === "string" ? req.body.invitedUserId.trim() : "";
    if (!invitedUserId) {
      return reply.code(400).send({ error: "community_invited_user_required" });
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
      targetUserId: invitedUserId,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.invitations.enabled", "community.member_management.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => inviteCommunityGroupMember(
      req.params.id,
      invitedUserId,
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      {
        note: typeof req.body?.note === "string" ? req.body.note.trim() || undefined : undefined,
        expiresInDays: typeof req.body?.expiresInDays === "number" ? req.body.expiresInDays : undefined,
      },
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{ Params: { id: string } }>("/api/community/groups/:id/invitations/accept", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "accept_invitation",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.invitations.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => acceptCommunityGroupInvitation(req.params.id, {
      id: actor.id,
      role: actor.role,
    }));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; userId: string };
    Body: { reason?: string };
  }>("/api/community/groups/:id/invitations/:userId/revoke", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "revoke_invitation",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      targetUserId: req.params.userId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.invitations.enabled", "community.member_management.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => revokeCommunityGroupInvitation(
      req.params.id,
      req.params.userId,
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      typeof req.body?.reason === "string" ? req.body.reason.trim() || undefined : undefined,
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; userId: string };
    Body: { reason?: string };
  }>("/api/community/groups/:id/members/:userId/approve", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "approve_membership",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      targetUserId: req.params.userId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.member_management.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => reviewCommunityGroupMembership(
      req.params.id,
      req.params.userId,
      "approve",
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      typeof req.body?.reason === "string" ? req.body.reason.trim() || undefined : undefined,
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; userId: string };
    Body: { reason?: string };
  }>("/api/community/groups/:id/members/:userId/reject", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "reject_membership",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      targetUserId: req.params.userId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.member_management.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => reviewCommunityGroupMembership(
      req.params.id,
      req.params.userId,
      "reject",
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      typeof req.body?.reason === "string" ? req.body.reason.trim() || undefined : undefined,
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; userId: string };
    Body: { reason?: string };
  }>("/api/community/groups/:id/members/:userId/warn", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "warn_member",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      targetUserId: req.params.userId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const reason = parseRequiredModerationReason(req.body?.reason);
    if (!reason) {
      return reply.code(400).send({ error: "community_moderation_reason_required" });
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.member_management.enabled", "community.moderation.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => warnCommunityGroupMember(
      req.params.id,
      req.params.userId,
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      reason,
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; userId: string };
    Body: { reason?: string; durationHours?: number };
  }>("/api/community/groups/:id/members/:userId/mute", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "mute_member",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      targetUserId: req.params.userId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const reason = parseRequiredModerationReason(req.body?.reason);
    if (!reason) {
      return reply.code(400).send({ error: "community_moderation_reason_required" });
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.member_management.enabled", "community.moderation.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => muteCommunityGroupMember(
      req.params.id,
      req.params.userId,
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      reason,
      {
        durationHours: typeof req.body?.durationHours === "number" ? req.body.durationHours : undefined,
      },
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; userId: string };
    Body: { reason?: string };
  }>("/api/community/groups/:id/members/:userId/unmute", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "unmute_member",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      targetUserId: req.params.userId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const reason = parseRequiredModerationReason(req.body?.reason);
    if (!reason) {
      return reply.code(400).send({ error: "community_moderation_reason_required" });
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.member_management.enabled", "community.moderation.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => unmuteCommunityGroupMember(
      req.params.id,
      req.params.userId,
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      reason,
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; userId: string };
    Body: { reason?: string; duration?: CommunitySuspensionDuration };
  }>("/api/community/groups/:id/members/:userId/suspend", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "suspend_member",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      targetUserId: req.params.userId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const reason = parseRequiredModerationReason(req.body?.reason);
    if (!reason) {
      return reply.code(400).send({ error: "community_moderation_reason_required" });
    }

    const duration = parseCommunitySuspensionDuration(req.body?.duration);
    if (!duration) {
      return reply.code(400).send({ error: "community_suspension_duration_invalid" });
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.member_management.enabled", "community.moderation.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => suspendCommunityGroupMember(
      req.params.id,
      req.params.userId,
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      duration,
      reason,
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; userId: string };
    Body: { reason?: string };
  }>("/api/community/groups/:id/members/:userId/reinstate", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "reinstate_member",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      targetUserId: req.params.userId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const reason = parseRequiredModerationReason(req.body?.reason);
    if (!reason) {
      return reply.code(400).send({ error: "community_moderation_reason_required" });
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.member_management.enabled", "community.moderation.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => reinstateCommunityGroupMember(
      req.params.id,
      req.params.userId,
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      reason,
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; userId: string };
    Body: { reason?: string };
  }>("/api/community/groups/:id/members/:userId/ban", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "ban_member",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      targetUserId: req.params.userId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const reason = parseRequiredModerationReason(req.body?.reason);
    if (!reason) {
      return reply.code(400).send({ error: "community_moderation_reason_required" });
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.membership.enabled", "community.member_management.enabled", "community.moderation.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => banCommunityGroupMember(
      req.params.id,
      req.params.userId,
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      reason,
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.get<{ Params: { id: string } }>("/api/community/groups/:id/reports", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "list_reports",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.reporting.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => listCommunityGroupReports(req.params.id, {
      id: actor.id,
      role: actor.role,
    }));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.read", "info", context);
    return result.value;
  });

  app.post<{
    Params: { id: string };
    Body: { targetType?: CommunityReportTargetType; targetId?: string; reasonCategory?: CommunityReportReasonCategory; description?: string };
  }>("/api/community/groups/:id/reports", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "create_report",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const targetType = parseCommunityReportTargetType(req.body?.targetType);
    const targetId = typeof req.body?.targetId === "string" ? req.body.targetId.trim() : "";
    const reasonCategory = parseCommunityReportReasonCategory(req.body?.reasonCategory);
    if (!targetType || !targetId || !reasonCategory) {
      return reply.code(400).send({ error: "community_report_payload_invalid" });
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.reporting.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => createCommunityReport(
      req.params.id,
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      {
        targetType,
        targetId,
        reasonCategory,
        description: typeof req.body?.description === "string" ? req.body.description.trim() || undefined : undefined,
      },
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);
    return result.value;
  });

  app.post<{
    Params: { id: string; reportId: string };
    Body: { status?: CommunityReportStatus; resolution?: string; linkedModerationActionIds?: string[] };
  }>("/api/community/groups/:id/reports/:reportId/review", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "review_report",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const status = parseCommunityReportReviewStatus(req.body?.status);
    if (!status || status === "open" || status === "appealed") {
      return reply.code(400).send({ error: "community_report_status_invalid" });
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.reporting.enabled", "community.moderation.enabled"], context)) {
      return;
    }

    const linkedModerationActionIds = Array.isArray(req.body?.linkedModerationActionIds)
      ? req.body.linkedModerationActionIds.filter((value): value is string => typeof value === "string")
      : undefined;

    const result = await withPersistenceTelemetry(emit, context, async () => reviewCommunityGroupReport(
      req.params.id,
      req.params.reportId,
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      {
        status,
        resolution: typeof req.body?.resolution === "string" ? req.body.resolution.trim() || undefined : undefined,
        linkedModerationActionIds,
      },
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);
    return result.value;
  });

  app.get<{ Params: { id: string } }>("/api/community/groups/:id/appeals", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "list_appeals",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.appeals.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => listCommunityGroupAppeals(req.params.id, {
      id: actor.id,
      role: actor.role,
    }));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.read", "info", context);
    return result.value;
  });

  app.post<{
    Params: { id: string };
    Body: { moderationActionId?: string; reason?: string };
  }>("/api/community/groups/:id/appeals", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "create_appeal",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const moderationActionId = typeof req.body?.moderationActionId === "string" ? req.body.moderationActionId.trim() : "";
    const reason = parseRequiredModerationReason(req.body?.reason);
    if (!moderationActionId || !reason) {
      return reply.code(400).send({ error: "community_appeal_payload_invalid" });
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.appeals.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => createCommunityGroupAppeal(
      req.params.id,
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      {
        moderationActionId,
        reason,
      },
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);
    return result.value;
  });

  app.post<{
    Params: { id: string; appealId: string };
    Body: { outcome?: CommunityAppealOutcome; resolutionReason?: string };
  }>("/api/community/groups/:id/appeals/:appealId/resolve", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "resolve_appeal",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const outcome = parseCommunityAppealOutcome(req.body?.outcome);
    const resolutionReason = parseRequiredModerationReason(req.body?.resolutionReason);
    if (!outcome || !resolutionReason) {
      return reply.code(400).send({ error: "community_appeal_resolution_invalid" });
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.appeals.enabled", "community.moderation.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => resolveCommunityGroupAppeal(
      req.params.id,
      req.params.appealId,
      {
        id: actor.id,
        role: actor.role,
        displayName: actor.displayName,
      },
      {
        outcome,
        resolutionReason,
      },
    ));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);
    return result.value;
  });

  app.post<{
    Params: { id: string };
    Body: {
      body?: string;
      clientRequestId?: string;
      senderId?: string;
      senderName?: string;
      type?: CommunityMessage["type"];
      replyToMessageId?: string;
      replyToPreview?: CommunityMessage["replyToPreview"];
    };
  }>("/api/community/groups/:id/messages", async (req, reply) => {
    const body = String(req.body?.body || "").trim();
    if (!body) {
      reply.code(400);
      return { error: "community_message_required" };
    }

    const baseContext: CommunityTelemetryContext = {
      action: "create_message",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled", "community.writes.enabled"], context)) {
      return;
    }

    const replyToMessageId = typeof req.body?.replyToMessageId === "string" ? req.body.replyToMessageId : undefined;
    const replyTarget = await withPersistenceTelemetry(emit, context, async () => resolveCommunityReplyPreview({
      groupId: req.params.id,
      replyToMessageId,
      viewerId: actor.id,
    }));
    if (!replyTarget.ok) {
      return sendCommunityError(reply, replyTarget.code, emit, context);
    }

    const message = await withPersistenceTelemetry(emit, context, async () => addCommunityMessage(req.params.id, {
      id: makeId("community_message"),
      groupId: req.params.id,
      senderId: actor.id,
      senderName: actor.displayName,
      senderRole: resolveCommunitySenderRole(actor.role),
      type: req.body?.type || "text",
      body,
      createdAt: new Date().toISOString(),
      clientRequestId: typeof req.body?.clientRequestId === "string" ? req.body.clientRequestId.trim() || undefined : undefined,
      replyToMessageId,
      replyToPreview: replyTarget.value,
    }, {
      viewer: { id: actor.id, role: actor.role },
    }));

    if (!message.ok) {
      return sendCommunityError(reply, message.code, emit, context);
    }

    await enqueueCommunityReplyNotification({
      pluginDb: app.pluginDb,
      groupId: req.params.id,
      actorId: actor.id,
      actorDisplayName: actor.displayName,
      replyToMessageId: message.value.replyToMessageId,
      message: message.value,
    });
    await enqueueCommunityMentionNotifications({
      pluginDb: app.pluginDb,
      groupId: req.params.id,
      actorId: actor.id,
      actorDisplayName: actor.displayName,
      message: message.value,
    });

    emit("community.write", "info", {
      ...context,
      messageId: message.value.id,
    });

    return message.value;
  });

  app.post<{ Params: { id: string } }>("/api/community/groups/:id/attachments", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "upload_attachment",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled", "community.writes.enabled"], context)) {
      return;
    }

    const attachmentsEnabled = await getFeatureFlag("community.attachments.enabled", false);
    if (!attachmentsEnabled) {
      emit("community.feature_flag_rejected", "warn", {
        ...context,
        flag: "community.attachments.enabled",
        statusCode: 403,
      });
      reply.code(403);
      return { error: "community_feature_disabled", flag: "community.attachments.enabled" };
    }

    const anyRequest = req as { parts?: () => AsyncIterable<any> };
    if (typeof anyRequest.parts !== "function") {
      reply.code(501);
      return { error: "community_attachment_multipart_unavailable" };
    }

    const access = await withPersistenceTelemetry(emit, context, async () => validateCommunityGroupWriteAccess(
      req.params.id,
      { id: actor.id, role: actor.role },
      { requireAuthenticated: true },
    ));
    if (!access.ok) {
      return sendCommunityError(reply, access.code, emit, context);
    }

    const fields: Record<string, string> = {};
    const files: Array<{ buffer: Buffer; filename: string; mimeType: string }> = [];

    for await (const part of anyRequest.parts()) {
      if (part.type === "file") {
        files.push({
          buffer: await part.toBuffer(),
          filename: part.filename || "attachment.bin",
          mimeType: part.mimetype || "application/octet-stream",
        });
        continue;
      }

      if (part.fieldname) {
        fields[part.fieldname] = String(part.value || "");
      }
    }

    if (files.length === 0) {
      reply.code(400);
      return { error: "community_attachment_upload_required" };
    }
    if (files.length > 10) {
      reply.code(400);
      return { error: "community_attachment_max_files_exceeded" };
    }

    const requestedTypeRaw = normalizeOptionalCommunityField(fields.type);
    const requestedType = requestedTypeRaw ? parseCommunityAttachmentMessageType(requestedTypeRaw) : null;
    if (requestedTypeRaw && !requestedType) {
      reply.code(400);
      return { error: "community_attachment_type_invalid" };
    }

    const replyToMessageId = normalizeOptionalCommunityField(fields.replyToMessageId);
    const replyTarget = await withPersistenceTelemetry(emit, context, async () => resolveCommunityReplyPreview({
      groupId: req.params.id,
      replyToMessageId,
      viewerId: actor.id,
    }));
    if (!replyTarget.ok) {
      return sendCommunityError(reply, replyTarget.code, emit, context);
    }

    const attachmentId = makeId("community_attachment");
    const storedAttachment = await storeCommunityAttachmentUpload({
      attachmentId,
      filename: files[0].filename,
      mimeType: files[0].mimeType,
      buffer: files[0].buffer,
      requestedType: requestedType || undefined,
    });
    if (!storedAttachment.ok) {
      emit("community.attachment_rejected", "warn", {
        ...context,
        errorCode: storedAttachment.error,
        statusCode: storedAttachment.statusCode,
        scanStatus: storedAttachment.scan?.status,
        errorCategory: storedAttachment.scan?.errorCategory,
        scanProvider: storedAttachment.scan?.provider,
        scanProviderVersion: storedAttachment.scan?.providerVersion,
        scanSignatureVersion: storedAttachment.scan?.signatureVersion,
        scanDurationMs: storedAttachment.scan?.durationMs,
        threatName: storedAttachment.scan?.threatName,
      });
      reply.code(storedAttachment.statusCode);
      return {
        error: storedAttachment.error,
        ...(storedAttachment.scan?.errorCategory ? { category: storedAttachment.scan.errorCategory } : {}),
      };
    }
    const storedAttachments = [{ id: attachmentId, value: storedAttachment.value }];
    for (const file of files.slice(1)) {
      const nextAttachmentId = makeId("community_attachment");
      const nextStoredAttachment = await storeCommunityAttachmentUpload({
        attachmentId: nextAttachmentId,
        filename: file.filename,
        mimeType: file.mimeType,
        buffer: file.buffer,
        requestedType: requestedType || undefined,
      });
      if (!nextStoredAttachment.ok) {
        await Promise.all(storedAttachments.map((item) => fs.unlink(item.value.storedPath).catch(() => undefined)));
        reply.code(nextStoredAttachment.statusCode);
        return { error: nextStoredAttachment.error };
      }
      storedAttachments.push({ id: nextAttachmentId, value: nextStoredAttachment.value });
    }

    const createdAt = new Date().toISOString();
    let insertedAttachment: CommunityAttachmentRow | null = null;

    try {
      const insertedAttachmentResult = await withPersistenceTelemetry(emit, context, async () => query<CommunityAttachmentRow>(
        `INSERT INTO community_message_attachments (
            id,
            group_id,
            message_id,
            uploaded_by_user_id,
            original_name,
            mime_type,
            bytes,
            sha256,
            storage_key,
            scan_status,
            scan_provider,
            duration_ms,
            scanned_at,
            created_at,
            position
          ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, 'clean', $9, $10, $11, $12, $13)
          RETURNING
            id,
            group_id,
            message_id,
            uploaded_by_user_id,
            original_name,
            mime_type,
            bytes,
            sha256,
            storage_key,
            scan_status,
            scan_provider,
            duration_ms,
            scanned_at,
            created_at,
            position`,
        [
          attachmentId,
          req.params.id,
          actor.id,
          storedAttachment.value.originalName,
          storedAttachment.value.mimeType,
          storedAttachment.value.bytes,
          storedAttachment.value.sha256,
          storedAttachment.value.storageKey,
          storedAttachment.value.scanProvider,
          storedAttachment.value.durationMs ?? null,
          storedAttachment.value.scannedAt,
          createdAt,
          0,
        ],
      ));
      const [nextInsertedAttachment] = insertedAttachmentResult.rows;
      insertedAttachment = nextInsertedAttachment || null;

      for (const [index, item] of storedAttachments.slice(1).entries()) {
        await query(
          `INSERT INTO community_message_attachments (
              id, group_id, message_id, uploaded_by_user_id, original_name, mime_type,
              bytes, sha256, storage_key, scan_status, scan_provider, duration_ms,
              scanned_at, created_at, position
            ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, 'clean', $9, $10, $11, $12, $13)`,
          [item.id, req.params.id, actor.id, item.value.originalName, item.value.mimeType,
            item.value.bytes, item.value.sha256, item.value.storageKey, item.value.scanProvider,
            item.value.durationMs ?? null, item.value.scannedAt, createdAt, index + 1],
        );
      }

      const message = await withPersistenceTelemetry(emit, context, async () => addCommunityMessage(req.params.id, {
        id: makeId("community_message"),
        groupId: req.params.id,
        senderId: actor.id,
        senderName: actor.displayName,
        senderRole: resolveCommunitySenderRole(actor.role),
        type: storedAttachment.value.messageType,
        body: normalizeOptionalCommunityField(fields.body),
        attachmentUrl: storedAttachment.value.contentUrl,
        attachments: storedAttachments.map((item) => ({
          id: item.id,
          url: item.value.contentUrl,
          originalName: item.value.originalName,
          mimeType: item.value.mimeType,
          size: item.value.bytes,
        })),
        createdAt,
        replyToMessageId,
        replyToPreview: replyTarget.value,
      }, {
        viewer: { id: actor.id, role: actor.role },
      }));
      if (!message.ok) {
        await query("DELETE FROM community_message_attachments WHERE id = $1", [attachmentId]);
        await fs.unlink(storedAttachment.value.storedPath).catch(() => undefined);
        return sendCommunityError(reply, message.code, emit, context);
      }

      await enqueueCommunityReplyNotification({
        pluginDb: app.pluginDb,
        groupId: req.params.id,
        actorId: actor.id,
        actorDisplayName: actor.displayName,
        replyToMessageId: message.value.replyToMessageId,
        message: message.value,
      });
      await enqueueCommunityMentionNotifications({
        pluginDb: app.pluginDb,
        groupId: req.params.id,
        actorId: actor.id,
        actorDisplayName: actor.displayName,
        message: message.value,
      });

      const updatedAttachmentResult = await withPersistenceTelemetry(emit, context, async () => query<CommunityAttachmentRow>(
        `UPDATE community_message_attachments
            SET message_id = $2
          WHERE id = ANY($1::text[])
          RETURNING
            id,
            group_id,
            message_id,
            uploaded_by_user_id,
            original_name,
            mime_type,
            bytes,
            sha256,
            storage_key,
            scan_status,
            scan_provider,
            duration_ms,
            scanned_at,
            created_at`,
        [storedAttachments.map((item) => item.id), message.value.id],
      ));

      const attachments = updatedAttachmentResult.rows.map(mapCommunityAttachmentRow);
      const attachment = attachments[0];
      emit("community.attachment_uploaded", "info", {
        ...context,
        messageId: message.value.id,
        attachmentId: attachment.id,
        mimeType: attachment.mimeType,
        bytes: attachments.reduce((total, item) => total + item.size, 0),
        scanStatus: storedAttachment.value.scanStatus,
        scanProvider: storedAttachment.value.scanProvider,
        scanProviderVersion: storedAttachment.value.scanProviderVersion,
        scanSignatureVersion: storedAttachment.value.scanSignatureVersion,
        scanDurationMs: storedAttachment.value.scanDurationMs,
      });

      return {
        ok: true,
        message: message.value,
        attachment,
        attachments,
      };
    } catch (error) {
      if (insertedAttachment) {
        await query("DELETE FROM community_message_attachments WHERE id = ANY($1::text[])", [storedAttachments.map((item) => item.id)]).catch(() => undefined);
      }
      await Promise.all(storedAttachments.map((item) => fs.unlink(item.value.storedPath).catch(() => undefined)));
      throw error;
    }
  });

  app.patch<{
    Params: { id: string; messageId: string };
    Body: { body?: string };
  }>("/api/community/groups/:id/messages/:messageId", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "edit_message",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      messageId: req.params.messageId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const body = String(req.body?.body || "").trim();
    if (!body) {
      reply.code(400);
      return { error: "community_message_required" };
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled", "community.writes.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => editCommunityMessage(req.params.id, req.params.messageId, body, {
      id: actor.id,
      role: actor.role,
      displayName: actor.displayName,
    }));

    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string };
    Body: { userName?: string; isTyping?: boolean };
  }>("/api/community/groups/:id/typing", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "set_typing",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const userName = actor.displayName.trim();
    if (!userName) {
      reply.code(400);
      return { error: "community_typing_user_required" };
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
      isTyping: req.body?.isTyping !== false,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled", "community.writes.enabled"], context)) {
      return;
    }

    const group = await withPersistenceTelemetry(emit, context, async () => setCommunityGroupTyping(
      req.params.id,
      userName,
      req.body?.isTyping !== false,
      { id: actor.id, role: actor.role },
    ));
    if (!group.ok) {
      return sendCommunityError(reply, group.code, emit, context);
    }

    emit("community.write", "info", context);

    return { ok: true, typingUsers: group.value.typingUsers || [] };
  });

  app.post<{ Params: { id: string }; Body: { messageId?: string } }>("/api/community/groups/:id/read", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "mark_read",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled"], context)) {
      return;
    }

    const messageId = typeof req.body?.messageId === "string" ? req.body.messageId.trim() || undefined : undefined;
    const readResult = await withPersistenceTelemetry(emit, context, async () => markCommunityGroupRead(req.params.id, { id: actor.id, role: actor.role }, messageId));
    if (!readResult.ok) {
      return sendCommunityError(reply, readResult.code, emit, context);
    }

    emit("community.read", "info", {
      ...context,
      unreadCount: readResult.value.readState.unreadCount,
    });

    return {
      ok: true,
      unreadCount: readResult.value.readState.unreadCount,
      lastReadMessageId: readResult.value.readState.lastReadMessageId,
      lastReadAt: readResult.value.readState.lastReadAt,
    };
  });

  app.post<{
    Params: { id: string; messageId: string };
    Body: { deletedByName?: string };
  }>("/api/community/groups/:id/messages/:messageId/delete-for-everyone", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "delete_for_everyone",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      messageId: req.params.messageId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled", "community.writes.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => deleteCommunityMessageForEveryone(req.params.id, req.params.messageId, {
      id: actor.id,
      role: actor.role,
      displayName: actor.displayName,
    }));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; messageId: string };
    Body: { emoji?: string };
  }>("/api/community/groups/:id/messages/:messageId/reactions", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "toggle_reaction",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      messageId: req.params.messageId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const emoji = normalizeOptionalCommunityField(req.body?.emoji);
    if (!emoji) {
      reply.code(400);
      return { error: "community_reaction_emoji_required" };
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled", "community.writes.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => toggleCommunityMessageReaction(req.params.id, req.params.messageId, emoji, {
      id: actor.id,
      role: actor.role,
      displayName: actor.displayName,
    }));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; messageId: string };
    Body: { starred?: boolean };
  }>('/api/community/groups/:id/messages/:messageId/star', async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "set_message_starred",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      messageId: req.params.messageId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) return;
    const context = { ...baseContext, actorId: actor.id, actorRole: actor.role };
    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled"], context)) return;
    const result = await withPersistenceTelemetry(emit, context, async () => setCommunityMessageStarredState(
      req.params.id,
      req.params.messageId,
      req.body?.starred !== false,
      { id: actor.id, role: actor.role, displayName: actor.displayName },
    ));
    if (!result.ok) return sendCommunityError(reply, result.code, emit, context);
    emit("community.write", "info", context);
    return result.value;
  });

  app.get<{ Querystring: { before?: string; limit?: string } }>('/api/community/starred-messages', async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "list_starred_messages",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) return;
    const context = { ...baseContext, actorId: actor.id, actorRole: actor.role };
    const parsedLimit = Number.parseInt(req.query?.limit || "", 10);
    const result = await withPersistenceTelemetry(emit, context, async () => listCommunityStarredMessages({
      id: actor.id,
      role: actor.role,
      displayName: actor.displayName,
    }, {
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      beforeCursor: req.query?.before,
    }));
    if (!result.ok) return sendCommunityError(reply, result.code, emit, context);
    return result.value;
  });

  app.post<{
    Params: { id: string; messageId: string };
  }>("/api/community/groups/:id/messages/:messageId/pin", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "pin_message",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      messageId: req.params.messageId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled", "community.writes.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => setCommunityMessagePinnedState(req.params.id, req.params.messageId, true, {
      id: actor.id,
      role: actor.role,
      displayName: actor.displayName,
    }));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; messageId: string };
  }>("/api/community/groups/:id/messages/:messageId/unpin", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "unpin_message",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      messageId: req.params.messageId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled", "community.writes.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => setCommunityMessagePinnedState(req.params.id, req.params.messageId, false, {
      id: actor.id,
      role: actor.role,
      displayName: actor.displayName,
    }));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.post<{
    Params: { id: string; messageId: string };
  }>("/api/community/groups/:id/messages/:messageId/delete-for-self", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "delete_for_self",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
      messageId: req.params.messageId,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.threads.enabled", "community.writes.enabled"], context)) {
      return;
    }

    const result = await withPersistenceTelemetry(emit, context, async () => deleteCommunityMessageForSelf(req.params.id, req.params.messageId, {
      id: actor.id,
      role: actor.role,
      displayName: actor.displayName,
    }));
    if (!result.ok) {
      return sendCommunityError(reply, result.code, emit, context);
    }

    emit("community.write", "info", context);

    return result.value;
  });

  app.get<{ Params: { attachmentId: string } }>("/api/community/attachments/:attachmentId/content", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "download_attachment",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const attachmentResult = await withPersistenceTelemetry(emit, {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    }, async () => query<CommunityAttachmentRow>(
      `SELECT
          attachments.id,
          attachments.group_id,
          attachments.message_id,
          attachments.uploaded_by_user_id,
          attachments.original_name,
          attachments.mime_type,
          attachments.bytes,
          attachments.sha256,
          attachments.storage_key,
          attachments.scan_status,
          EXISTS (
            SELECT 1
            FROM community_messages AS messages
            WHERE messages.deleted_for_everyone_at IS NOT NULL
              AND (
                messages.id = attachments.message_id
                OR messages.attachment_url = CONCAT('/api/community/attachments/', attachments.id, '/content')
              )
          ) AS message_deleted_for_everyone,
          attachments.scan_provider,
          attachments.duration_ms,
          attachments.scanned_at,
          attachments.created_at
        FROM community_message_attachments AS attachments
        LEFT JOIN community_messages AS messages ON messages.id = attachments.message_id
        WHERE attachments.id = $1
        LIMIT 1`,
      [req.params.attachmentId],
    ));

    if (Number(attachmentResult.rowCount || 0) === 0) {
      reply.code(404);
      return { error: "community_attachment_not_found" };
    }

    const [attachmentRow] = attachmentResult.rows;
    if (attachmentRow.scan_status !== "clean") {
      reply.code(404);
      return { error: "community_attachment_not_found" };
    }

    if (!attachmentRow.message_id || attachmentRow.message_deleted_for_everyone) {
      reply.code(404);
      return { error: "community_attachment_not_found" };
    }

    const access = await withPersistenceTelemetry(emit, {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
      groupId: attachmentRow.group_id,
    }, async () => validateCommunityGroupAccess(
      attachmentRow.group_id,
      { id: actor.id, role: actor.role },
      { requireAuthenticated: true },
    ));
    if (!access.ok) {
      return sendCommunityError(reply, access.code, emit, {
        ...baseContext,
        actorId: actor.id,
        actorRole: actor.role,
        groupId: attachmentRow.group_id,
      });
    }

    const storage = await ensureCommunityAttachmentStorage();
    const absolutePath = path.join(storage.cleanDir, attachmentRow.storage_key);

    try {
      const buffer = await fs.readFile(absolutePath);
      emit("community.attachment_downloaded", "info", {
        ...baseContext,
        actorId: actor.id,
        actorRole: actor.role,
        groupId: attachmentRow.group_id,
        attachmentId: attachmentRow.id,
      });
      return reply
        .type(attachmentRow.mime_type)
        .headers({
          "Cache-Control": "no-store",
          "Content-Disposition": buildInlineContentDisposition(attachmentRow.original_name),
          "X-Content-Type-Options": "nosniff",
        })
        .send(buffer);
    } catch {
      reply.code(404);
      return { error: "community_attachment_not_found" };
    }
  });

  app.post<{
    Body: {
      name?: string;
      description?: string;
      category?: CommunityGroup["category"];
      isOfficial?: boolean;
      visibility?: CommunityGroup["visibility"];
      memberIds?: string[];
    };
  }>("/api/community/groups", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "create_group",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
      visibility: typeof req.body?.visibility === "string" ? req.body.visibility : undefined,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.entry.enabled", "community.writes.enabled"], context)) {
      return;
    }

    if (!hasCommunityElevatedRole(actor.role)) {
      emit("community.authorization_denied", "warn", {
        ...context,
        errorCode: "community_group_forbidden",
        statusCode: 403,
      });
      reply.code(403);
      return { error: "community_group_forbidden" };
    }

    const name = String(req.body?.name || "").trim();
    const category = req.body?.category;

    if (!name || !category) {
      reply.code(400);
      return { error: "community_group_name_and_category_required" };
    }

    const group = await withPersistenceTelemetry(emit, context, async () => createCommunityGroup({
      id: makeId("community_group"),
      communityId: "watany-community",
      name,
      description: typeof req.body?.description === "string" ? req.body.description : undefined,
      category,
      memberCount: 0,
      unreadCount: 0,
      isOfficial: Boolean(req.body?.isOfficial),
      visibility: req.body?.visibility,
      memberIds: Array.isArray(req.body?.memberIds) ? req.body.memberIds : undefined,
    }, {
      id: actor.id,
      role: actor.role,
    }));

    emit("community.write", "info", {
      ...context,
      groupId: group.id,
      visibility: group.visibility,
    });

    return group;
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<Pick<CommunityGroup, "name" | "description" | "category" | "isOfficial" | "visibility">> & {
      memberIds?: string[];
    };
  }>("/api/community/groups/:id", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "update_group",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
      visibility: typeof req.body?.visibility === "string" ? req.body.visibility : undefined,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.entry.enabled", "community.writes.enabled"], context)) {
      return;
    }

    if (!hasCommunityElevatedRole(actor.role)) {
      emit("community.authorization_denied", "warn", {
        ...context,
        errorCode: "community_group_forbidden",
        statusCode: 403,
      });
      reply.code(403);
      return { error: "community_group_forbidden" };
    }

    const groupPatch = {
      name: req.body?.name,
      description: req.body?.description,
      category: req.body?.category,
      isOfficial: req.body?.isOfficial,
      visibility: req.body?.visibility,
      memberIds: Array.isArray(req.body?.memberIds) ? req.body.memberIds : undefined,
    };

    const group = await withPersistenceTelemetry(emit, context, async () => updateCommunityGroup(req.params.id, groupPatch, {
      id: actor.id,
      role: actor.role,
    }));
    if (!group) {
      reply.code(404);
      return { error: "community_group_not_found" };
    }

    emit("community.write", "info", {
      ...context,
      visibility: group.visibility,
    });

    return group;
  });

  app.post<{
    Params: { id: string };
    Body: { body?: string; senderName?: string };
  }>("/api/community/groups/:id/announcements", async (req, reply) => {
    const baseContext: CommunityTelemetryContext = {
      action: "create_announcement",
      actorId: req.user?.id,
      actorRole: req.user?.role || "public",
      groupId: req.params.id,
    };
    const actor = resolveAuthenticatedActor(req, reply, emit, baseContext);
    if (!actor) {
      return;
    }

    const context: CommunityTelemetryContext = {
      ...baseContext,
      actorId: actor.id,
      actorRole: actor.role,
    };

    if (!await ensureCommunityFeatures(reply, emit, getFeatureFlag, ["community.entry.enabled", "community.writes.enabled", "community.announcements.enabled"], context)) {
      return;
    }

    if (!hasCommunityElevatedRole(actor.role)) {
      emit("community.authorization_denied", "warn", {
        ...context,
        errorCode: "community_group_forbidden",
        statusCode: 403,
      });
      reply.code(403);
      return { error: "community_group_forbidden" };
    }

    const body = String(req.body?.body || "").trim();
    if (!body) {
      reply.code(400);
      return { error: "community_announcement_required" };
    }

    const message = await withPersistenceTelemetry(emit, context, async () => addCommunityMessage(req.params.id, {
      id: makeId("community_announcement"),
      groupId: req.params.id,
      senderId: actor.id,
      senderName: actor.displayName,
      senderRole: resolveCommunitySenderRole(actor.role),
      type: "announcement",
      body,
      createdAt: new Date().toISOString(),
      isPinned: true,
    }, {
      viewer: { id: actor.id, role: actor.role },
    }));

    if (!message.ok) {
      return sendCommunityError(reply, message.code, emit, context);
    }

    emit("community.write", "info", {
      ...context,
      messageId: message.value.id,
    });

    return message.value;
  });
};