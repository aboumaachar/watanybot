export type HybridRouteMode = "conversation" | "service" | "lookup";

export type WatanyModule =
  | "assistant"
  | "community"
  | "community_group"
  | "salary"
  | "procedure"
  | "payment"
  | "recruitment"
  | "phonebook"
  | "documents"
  | "laws"
  | "support";

export type HybridIntent =
  | "calculate_salary"
  | "ask_payment"
  | "ask_recruitment"
  | "phone_lookup"
  | "procedure_help"
  | "legal_lookup"
  | "community_discussion"
  | "join_live_session"
  | "support_request"
  | "general_assistant";

export type ConversationContext = {
  conversationId: string;
  originalQuestion?: string;
  originalIntent?: string;
  originalModule?: string;
  activeIntent?: HybridIntent;
  activeDestination?: WatanyModule;
  lastAnswer?: string;
  lastSuggestedActions?: string[];
  pendingClarification?: boolean;
  awaitingTopicDecision?: boolean;
  activeAnnouncementId?: string;
  userRole?: "public" | "user" | "admin" | "superadmin";
  source?: "assistant" | "community" | "service" | "lookup";
  updatedAt: string;
};

export type CTAAction = {
  id: string;
  label: string;
  type:
    | "navigate"
    | "reply"
    | "open_service_flow"
    | "open_modal"
    | "call"
    | "download"
    | "share"
    | "join_session";
  target?: string;
  payload?: Record<string, unknown>;
};

export type HybridRouteInput = {
  rawText: string;
  normalizedText: string;
  userId?: string;
  sessionId?: string;
  currentModule?: WatanyModule;
  previousIntent?: string;
  conversationContext?: ConversationContext;
};

export type HybridRouteDecision = {
  mode: HybridRouteMode;
  destination: WatanyModule;
  confidence: number;
  reason: string;
  suggestedActions: CTAAction[];
  shouldOpenFlow: boolean;
  shouldAnswerInline: boolean;
  contextPatch?: Partial<ConversationContext>;
  hybridIntent?: HybridIntent;
};

export type WatanyAssistantResponse = {
  text: string;
  module?: string;
  mode?: HybridRouteMode;
  ctas?: CTAAction[];
  routeDecision?: HybridRouteDecision;
  context?: ConversationContext;
};

export type Community = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: string;
};

export type CommunityGroupCategory =
  | "salary"
  | "healthcare"
  | "grants"
  | "laws"
  | "recruitment"
  | "support"
  | "general";

export type CommunityGroupVisibility = "public" | "private" | "invite_only";

export type CommunityGroupMemberRole = "member" | "moderator" | "owner";

export type CommunityGroupMemberStatus =
  | "pending"
  | "active"
  | "invited"
  | "muted"
  | "suspended"
  | "removed"
  | "left"
  | "banned"
  | "rejected";

export type CommunityGroupPermission =
  | "community.group.read"
  | "community.group.write"
  | "community.group.manage"
  | "community.members.view"
  | "community.members.invite"
  | "community.members.approve"
  | "community.members.remove"
  | "community.roles.assign_moderator"
  | "community.announcements.publish"
  | "community.reports.review"
  | "community.messages.moderate"
  | "community.members.warn"
  | "community.members.mute"
  | "community.members.suspend"
  | "community.members.ban"
  | "community.appeals.resolve";

export type CommunityGroupMembershipSummary = {
  status: CommunityGroupMemberStatus | null;
  role: CommunityGroupMemberRole | null;
  permissions: CommunityGroupPermission[];
  mutedUntil?: string;
  suspendedUntil?: string;
  bannedAt?: string;
};

export type CommunityGroupMembership = {
  id: string;
  groupId: string;
  userId: string;
  displayName: string;
  role: CommunityGroupMemberRole;
  status: CommunityGroupMemberStatus;
  permissions: CommunityGroupPermission[];
  requestedAt?: string;
  invitedAt?: string;
  invitedByUserId?: string;
  joinedAt?: string;
  mutedUntil?: string;
  suspendedUntil?: string;
  bannedAt?: string;
  reason?: string;
};

export type CommunityGroupMembersOverview = {
  group: CommunityGroup;
  memberCount: number;
  memberLimit: number;
  currentMembership: CommunityGroupMembershipSummary | null;
  actorPermissions: CommunityGroupPermission[];
  membersByStatus: Record<CommunityGroupMemberStatus, CommunityGroupMembership[]>;
};

export type CommunityMembershipUpdate = {
  group: CommunityGroup;
  currentMembership: CommunityGroupMembershipSummary | null;
  actorPermissions: CommunityGroupPermission[];
};

export type CommunitySuspensionDuration = "24h" | "7d" | "30d";

export type CommunityMessageMention = {
  userId: string;
  displayName: string;
  token: string;
};

export type CommunityMessageReaction = {
  emoji: string;
  count: number;
  reactedByMe?: boolean;
};

export type CommunityReportTargetType = "message" | "member" | "group" | "moderation_action";

export type CommunityReportReasonCategory =
  | "harassment"
  | "threats"
  | "spam"
  | "impersonation"
  | "fraud"
  | "hate_or_discriminatory_abuse"
  | "privacy_violation"
  | "inappropriate_content"
  | "misinformation_requiring_review"
  | "other";

export type CommunityReportStatus =
  | "open"
  | "under_review"
  | "actioned"
  | "dismissed"
  | "appealed"
  | "resolved";

export type CommunityAppealStatus = "open" | "under_review" | "resolved";

export type CommunityAppealOutcome = "upheld" | "modified" | "reversed";

export type CommunityReport = {
  id: string;
  reporterId: string;
  groupId: string;
  targetType: CommunityReportTargetType;
  targetId: string;
  reasonCategory: CommunityReportReasonCategory;
  description?: string;
  status: CommunityReportStatus;
  assignedReviewerId?: string;
  resolution?: string;
  linkedModerationActionIds?: string[];
  appealStatus?: CommunityAppealStatus;
  createdAt: string;
  updatedAt?: string;
};

export type CommunityModerationActionTargetType = "group" | "member" | "message" | "report";

export type CommunityModerationActionType =
  | "membership_requested"
  | "membership_approved"
  | "membership_rejected"
  | "invitation_created"
  | "invitation_accepted"
  | "invitation_revoked"
  | "member_warned"
  | "member_muted"
  | "member_unmuted"
  | "member_removed"
  | "member_suspended"
  | "member_reinstated"
  | "member_banned"
  | "content_hidden"
  | "content_removed"
  | "moderator_assigned"
  | "moderator_revoked"
  | "appeal_resolved";

export type CommunityModerationAction = {
  id: string;
  groupId: string;
  actorId: string;
  targetType: CommunityModerationActionTargetType;
  targetId: string;
  actionType: CommunityModerationActionType;
  reason: string;
  duration?: CommunitySuspensionDuration | "permanent";
  reportId?: string;
  appealId?: string;
  previousState?: Record<string, unknown>;
  resultingState?: Record<string, unknown>;
  createdAt: string;
};

export type CommunityAppeal = {
  id: string;
  groupId: string;
  moderationActionId: string;
  auditEventId: string;
  appellantId: string;
  reason: string;
  status: CommunityAppealStatus;
  resolutionOutcome?: CommunityAppealOutcome;
  resolutionReason?: string;
  resolvedByUserId?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
};

export type CommunityGroup = {
  id: string;
  communityId: string;
  name: string;
  description?: string;
  category: CommunityGroupCategory;
  visibility?: CommunityGroupVisibility;
  memberCount: number;
  memberLimit?: number;
  unreadCount?: number;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  pinnedMessageId?: string;
  isOfficial?: boolean;
  typingUsers?: string[];
  currentMembership?: CommunityGroupMembershipSummary | null;
  actorPermissions?: CommunityGroupPermission[];
};

export type CommunityMessage = {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderRole: "user" | "admin" | "superadmin" | "system";
  type:
    | "text"
    | "announcement"
    | "attachment"
    | "voice"
    | "session_invite"
    | "procedure_card"
    | "payment_update";
  body?: string;
  attachmentUrl?: string;
  attachments?: Array<{
    id: string;
    url: string;
    originalName?: string;
    mimeType?: string;
    size?: number;
  }>;
  createdAt: string;
  editedAt?: string;
  isForwarded?: boolean;
  forwardSourceMessageId?: string;
  replyToMessageId?: string;
  replyToPreview?: {
    id: string;
    senderName: string;
    body: string;
  };
  mentions?: CommunityMessageMention[];
  reactions?: CommunityMessageReaction[];
  isStarredByMe?: boolean;
  deletedForEveryoneAt?: string;
  deletedForEveryoneBy?: string;
  deletedForMeAt?: string;
  isPinned?: boolean;
  receiptStatus?: "sent" | "delivered" | "read";
};

export type CommunityMessageCursor = string;

export type LiveSession = {
  id: string;
  groupId?: string;
  title: string;
  hostName: string;
  startsAt: string;
  endsAt?: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
  joinUrl?: string;
  recordingUrl?: string;
};

export type CommunityMessagePage = {
  requestedLimit: number;
  oldestMessageId?: string;
  newestMessageId?: string;
  olderCursor?: string;
  hasOlder: boolean;
};

export type CommunityMessagePageInfo = {
  hasMoreBefore: boolean;
  startCursor: CommunityMessageCursor | null;
  endCursor: CommunityMessageCursor | null;
};

export type CommunityReadState = {
  unreadCount: number;
  lastReadMessageId?: string;
  lastReadAt?: string;
};

export type CommunityRealtimeEventType =
  | "community.message.created"
  | "community.message.updated"
  | "community.message.deleted"
  | "community.receipt.delivered"
  | "community.receipt.read"
  | "community.read_state.updated"
  | "community.typing.started"
  | "community.typing.stopped"
  | "community.membership.requested"
  | "community.membership.updated"
  | "community.member.removed"
  | "community.member.suspended"
  | "community.member.banned"
  | "community.report.created"
  | "community.report.updated"
  | "community.moderation.actioned"
  | "community.connection.ready"
  | "community.connection.resync_required"
  | "community.authorization.revoked";

export type CommunityRealtimeEvent<TPayload = unknown> = {
  eventId: string;
  eventType: CommunityRealtimeEventType;
  occurredAt: string;
  groupId: string;
  actorId: string | null;
  messageId: string | null;
  sequence: string | null;
  payload: TPayload;
};

export type CommunityMessagesPage = {
  groupId: string;
  messages: CommunityMessage[];
  pageInfo: CommunityMessagePageInfo;
  latestSequence: string | null;
  readState: {
    unreadCount: number;
    lastReadMessageId: string | null;
    lastReadAt: string | null;
  };
};

export type CommunityGroupDetail = {
  community: Community;
  group: CommunityGroup;
  messages: CommunityMessage[];
  liveSession: LiveSession | null;
  page: CommunityMessagePage;
  readState: CommunityReadState;
  currentMembership?: CommunityGroupMembershipSummary | null;
  actorPermissions?: CommunityGroupPermission[];
};

export type CommunityReadUpdate = {
  ok: true;
  unreadCount: number;
  lastReadMessageId?: string;
  lastReadAt?: string;
};