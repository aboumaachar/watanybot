import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type RefObject, type SetStateAction, type SyntheticEvent } from "react";
import { ArrowLeft24Regular, ChevronDown24Regular, Dismiss24Regular, Megaphone24Regular, People24Regular, Search24Regular } from "../theme/watany-v4/legacyIconBridge";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ReliableWebSocketClient, type ReliableWebSocketState } from "@watany/shared/reliable-websocket";

import { api } from "../lib/api";
import { getDefaultApiWebSocketUrl } from "../lib/api-base";
import { getAccessToken, subscribeAuthStateChange } from "../lib/auth";
import { useApp } from "../store/app";
import type {
  Community,
  CommunityGroup,
  CommunityGroupDetail,
  CommunityGroupMembersOverview,
  CommunityGroupMemberStatus,
  CommunityGroupPermission,
  CommunityMembershipUpdate,
  CommunityMessage,
  CommunityMessagesPage,
  CommunityReadUpdate,
  CommunityRealtimeEvent,
  LiveSession,
} from "../types/domain";

type GroupDiscoveryFilter = "all" | "live" | "unread" | "official";

const GROUP_CATEGORY_OPTIONS: Array<{ value: CommunityGroup["category"]; label: string }> = [
  { value: "salary", label: "راتب وتعويضات" },
  { value: "healthcare", label: "طبابة وتحويلات" },
  { value: "grants", label: "المساعدات المدرسية" },
  { value: "laws", label: "قوانين وحقوق" },
  { value: "recruitment", label: "تطويع وإعلانات" },
  { value: "support", label: "دعم فني" },
  { value: "general", label: "عام" },
];

const GROUP_DISCOVERY_FILTERS: Array<{ id: GroupDiscoveryFilter; label: string }> = [
  { id: "all", label: "الكل" },
  { id: "live", label: "مباشر" },
  { id: "unread", label: "غير المقروء" },
  { id: "official", label: "رسمي" },
];

const COMMUNITY_THREAD_PAGE_SIZE = 30;
const COMMUNITY_THREAD_SEARCH_RESULT_LIMIT = 80;
const COMMUNITY_LIST_STATE_STORAGE_KEY = "watany-community-list-state";
const COMMUNITY_REALTIME_POLL_INTERVAL_MS = 5_000;
const COMMUNITY_QUICK_REACTIONS = ["👍", "❤️", "🙏", "✅"] as const;

type LocalMessageStatus = "sending" | "sent" | "failed" | "retrying";
type PendingAttachmentMessageType = Extract<CommunityMessage["type"], "attachment" | "voice">;

type ThreadMessage = CommunityMessage & {
  clientRequestId?: string;
  localStatus?: LocalMessageStatus;
  isOptimistic?: boolean;
};

type PendingThreadAttachment = {
  file: File;
  messageType: PendingAttachmentMessageType;
};

type ProtectedCommunityAttachmentAsset = {
  objectUrl: string;
  contentType: string;
  fileName?: string;
};

type MentionSuggestion = {
  userId: string;
  displayName: string;
  token: string;
};

type OptimisticThreadMessageParams = {
  groupId: string;
  body: string;
  clientRequestId: string;
  currentUserId: string;
  currentUserName: string;
  senderRole: ThreadMessage["senderRole"];
  replyToPreview?: ThreadMessage["replyToPreview"];
  replyToMessageId?: string;
};

type ThreadDetail = Omit<CommunityGroupDetail, "messages" | "page" | "readState"> & {
  messages: ThreadMessage[];
  pageInfo: CommunityMessagesPage["pageInfo"];
  latestSequence: CommunityMessagesPage["latestSequence"];
  readState: CommunityMessagesPage["readState"];
};

type ThreadRealtimeEvent = CommunityRealtimeEvent<Record<string, unknown>>;

type PersistedCommunityListState = {
  groupQuery: string;
  groupFilter: GroupDiscoveryFilter;
  scrollY: number;
};

type LoadedThreadContext = {
  data: ThreadDetail;
  currentUserName: string;
  setCommunity: Dispatch<SetStateAction<Community | null>>;
  setThread: Dispatch<SetStateAction<ThreadDetail | null>>;
  setTypingUsers: Dispatch<SetStateAction<string[]>>;
  setGroups: Dispatch<SetStateAction<CommunityGroup[]>>;
};

type OverviewScreenProps = Readonly<{
  community: Community | null;
  orderedGroups: CommunityGroup[];
  liveNowCount: number;
  unreadGroupCount: number;
  officialGroupCount: number;
  highlightedSession: LiveSession | null;
  groupQuery: string;
  setGroupQuery: (nextValue: string) => void;
  groupFilter: GroupDiscoveryFilter;
  setGroupFilter: (nextValue: GroupDiscoveryFilter) => void;
  filteredGroups: CommunityGroup[];
  liveGroupIds: Set<string>;
  loadingOverview: boolean;
  isAuthed: boolean;
  isAdmin: boolean;
  newGroupName: string;
  newGroupDescription: string;
  newGroupCategory: CommunityGroup["category"];
  setNewGroupName: (nextValue: string) => void;
  setNewGroupDescription: (nextValue: string) => void;
  setNewGroupCategory: (nextValue: CommunityGroup["category"]) => void;
  creatingGroup: boolean;
  onCreateGroup: (event: SyntheticEvent<HTMLFormElement>) => void;
  requestingMembershipGroupId: string | null;
  onRequestMembership: (groupId: string) => void;
  onAcceptInvitation: (groupId: string) => void;
  error: string;
  onOpenGroup: (groupId: string) => void;
  onOpenHighlightedSession: (groupId?: string | null) => void;
}>;

type ThreadScreenProps = Readonly<{
  thread: ThreadDetail | null;
  displayedMessages: ThreadMessage[];
  apiBaseUrl: string;
  activeLiveSession: LiveSession | null;
  pinnedMessage: CommunityMessage | null;
  loadingThread: boolean;
  loadingOlderMessages: boolean;
  loadingOlderError: string;
  canLoadOlderMessages: boolean;
  firstUnreadMessageId: string | null;
  threadSearchQuery: string;
  threadSearchError: string;
  searchingThreadMessages: boolean;
  onThreadSearchQueryChange: (nextValue: string) => void;
  visibleTypingUsers: string[];
  editingMessage: CommunityMessage | null;
  replyingToMessage: CommunityMessage | null;
  composer: string;
  pendingAttachment: PendingThreadAttachment | null;
  mentionSuggestions: MentionSuggestion[];
  setComposer: (nextValue: string) => void;
  onInsertMention: (token: string) => void;
  onPickAttachment: () => void;
  onPickVoiceAttachment: () => void;
  onClearAttachment: () => void;
  pulseTyping: (nextValue: string) => void;
  sending: boolean;
  canWriteToThread: boolean;
  membershipActionPending: boolean;
  onRequestMembership: () => void;
  onAcceptInvitation: () => void;
  onLeaveGroup: () => void;
  membersOverview: CommunityGroupMembersOverview | null;
  loadingMembersOverview: boolean;
  memberReviewUserId: string | null;
  inviteUserId: string;
  setInviteUserId: (nextValue: string) => void;
  inviteNote: string;
  setInviteNote: (nextValue: string) => void;
  invitingMember: boolean;
  invitationActionUserId: string | null;
  onInviteMember: (event: SyntheticEvent<HTMLFormElement>) => void;
  onApproveMember: (userId: string) => void;
  onRejectMember: (userId: string) => void;
  onRevokeInvitation: (userId: string) => void;
  onSendMessage: (event: SyntheticEvent<HTMLFormElement>) => void;
  onLoadOlderMessages: () => void;
  onStartEditMessage: (messageId: string) => void;
  onDeleteForEveryone: (messageId: string) => void;
  onDeleteForSelf: (messageId: string) => void;
  onTogglePinnedState: (messageId: string, nextPinned: boolean) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onReplyToMessage: (messageId: string | null) => void;
  onRetryMessage: (messageId: string) => void;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  canDeleteMessage: (message: CommunityMessage) => boolean;
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  editGroupName: string;
  editGroupDescription: string;
  setEditGroupName: (nextValue: string) => void;
  setEditGroupDescription: (nextValue: string) => void;
  savingGroup: boolean;
  onSaveGroup: (event: SyntheticEvent<HTMLFormElement>) => void;
  announcementBody: string;
  setAnnouncementBody: (nextValue: string) => void;
  postingAnnouncement: boolean;
  onPostAnnouncement: (event: SyntheticEvent<HTMLFormElement>) => void;
  error: string;
  onGoBack: () => void;
  messagesRef: RefObject<HTMLDivElement>;
}>;

function formatThreadTime(value?: string): string {
  if (!value) return "الآن";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "الآن";

  return new Intl.DateTimeFormat("ar-LB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatListTime(value?: string): string {
  if (!value) return "الآن";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "الآن";

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return formatThreadTime(value);
  }

  return new Intl.DateTimeFormat("ar-LB", { month: "short", day: "numeric" }).format(date);
}

function categoryLabel(category?: CommunityGroup["category"]): string {
  return GROUP_CATEGORY_OPTIONS.find((option) => option.value === category)?.label || "عام";
}

function visibilityLabel(visibility?: CommunityGroup["visibility"]): string {
  if (visibility === "private") {
    return "خاص ظاهر";
  }

  if (visibility === "invite_only") {
    return "بدعوة فقط";
  }

  return "عام";
}

function membershipStatusLabel(status?: CommunityGroupMemberStatus | null): string {
  switch (status) {
    case "pending":
      return "قيد المراجعة";
    case "active":
      return "عضو نشط";
    case "invited":
      return "دعوة معلقة";
    case "muted":
      return "مكتوم";
    case "suspended":
      return "معلّق";
    case "removed":
      return "تمت إزالته";
    case "left":
      return "غادر المجموعة";
    case "banned":
      return "محظور";
    case "rejected":
      return "مرفوض";
    default:
      return "غير منضم";
  }
}

function canRequestMembershipForStatus(status?: CommunityGroupMemberStatus | null): boolean {
  if (!status) {
    return true;
  }

  return status === "left" || status === "removed" || status === "rejected";
}

function hasGroupPermission(
  permissions: CommunityGroupPermission[] | undefined,
  permission: CommunityGroupPermission,
): boolean {
  return (permissions || []).includes(permission);
}

function canReadGroup(group: CommunityGroup): boolean {
  return hasGroupPermission(group.actorPermissions, "community.group.read");
}

function canWriteGroup(group?: CommunityGroup | null): boolean {
  if (!group) {
    return false;
  }

  return hasGroupPermission(group.actorPermissions, "community.group.write");
}

function messageTypeLabel(message: CommunityMessage): string | null {
  if (message.type === "announcement") return "إعلان";
  if (message.type === "session_invite") return "جلسة مباشرة";
  return null;
}

function normalizeCommunityQuery(value: string): string {
  return value.trim().toLocaleLowerCase("ar-LB");
}

function buildCommunityMentionToken(value: string): string {
  return value.trim().replace(/^@+/, "").replace(/\s+/g, "_");
}

function extractTrailingMentionQuery(value: string): string | null {
  const match = /(?:^|\s)@([^\s@]*)$/.exec(value);
  if (!match) {
    return null;
  }

  return match[1] ?? "";
}

function replaceTrailingMentionQuery(value: string, token: string): string {
  return value.replace(/(?:^|\s)@[^\s@]*$/, (match) => {
    const prefix = match.startsWith(" ") ? " " : "";
    return `${prefix}@${token} `;
  });
}

function fallbackAttachmentLabel(message: Pick<CommunityMessage, "type">): string {
  return message.type === "voice" ? "رسالة صوتية محمية" : "مرفق محمي";
}

function resolveCopyableCommunityMessageText(
  message: Pick<CommunityMessage, "attachmentUrl" | "body" | "deletedForEveryoneAt" | "type">,
): string | null {
  if (message.deletedForEveryoneAt) {
    return null;
  }

  if (typeof message.body === "string" && message.body.trim()) {
    return message.body;
  }

  if (message.attachmentUrl) {
    return fallbackAttachmentLabel(message);
  }

  return null;
}

async function copyCommunityMessageText(value: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function isProtectedAudioAsset(message: Pick<CommunityMessage, "type">, contentType?: string): boolean {
  return message.type === "voice" || Boolean(contentType?.startsWith("audio/"));
}

function isProtectedImageAsset(contentType?: string): boolean {
  return Boolean(contentType?.startsWith("image/"));
}

function buildReplyPreview(message: CommunityMessage): NonNullable<CommunityMessage["replyToPreview"]> {
  const fallbackBody = message.attachmentUrl ? fallbackAttachmentLabel(message) : "رسالة بدون نص";
  let previewBody = message.body || fallbackBody;
  if (message.deletedForEveryoneAt) {
    previewBody = "رسالة محذوفة للجميع";
  }

  return {
    id: message.id,
    senderName: message.senderName,
    body: previewBody,
  };
}

function makeCommunityClientRequestId(prefix: string): string {
  const generated = globalThis.crypto?.randomUUID?.();
  if (generated) {
    return `${prefix}-${generated}`;
  }

  return `${prefix}-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function toThreadMessage(message: CommunityMessage, localStatus?: LocalMessageStatus): ThreadMessage {
  return {
    ...message,
    localStatus,
  };
}

function mapCommunityMessagesToThread(messages: ReadonlyArray<CommunityMessage>): ThreadMessage[] {
  return messages.map((message) => toThreadMessage(message));
}

function getNewestThreadMessageId(messages: ReadonlyArray<CommunityMessage>): string | null {
  return messages.at(-1)?.id ?? null;
}

function toThreadDetail(detail: CommunityGroupDetail, messagePage: CommunityMessagesPage): ThreadDetail {
  const pinnedMessageId = detail.group.pinnedMessageId ?? null;

  return {
    ...detail,
    messages: syncPinnedThreadMessages(mapCommunityMessagesToThread(messagePage.messages), pinnedMessageId),
    pageInfo: messagePage.pageInfo,
    latestSequence: messagePage.latestSequence,
    readState: messagePage.readState,
  };
}

function buildThreadMessagePreview(message: CommunityMessage): string {
  if (message.deletedForEveryoneAt) return "تم حذف هذه الرسالة للجميع";
  if (typeof message.body === "string" && message.body.trim()) return message.body;
  if (message.type === "announcement") return "إعلان جديد";
  if (message.type === "session_invite") return "دعوة إلى جلسة مباشرة";
  if (message.type === "voice") return "رسالة صوتية محمية";
  if (message.type === "attachment") return "مرفق محمي";
  if (message.type === "procedure_card") return "بطاقة إجراء";
  return "رسالة جديدة";
}

function syncThreadGroupFromMessages(
  group: CommunityGroup,
  messages: ThreadMessage[],
  overrides?: Partial<CommunityGroup>,
): CommunityGroup {
  const latestMessage = messages.at(-1);
  const pinnedMessage = messages.slice().reverse().find((message) => message.isPinned || message.type === "announcement");
  const hasPinnedMessageOverride = Boolean(overrides && Object.prototype.hasOwnProperty.call(overrides, "pinnedMessageId"));
  const nextPinnedMessageId = hasPinnedMessageOverride
    ? overrides?.pinnedMessageId ?? undefined
    : pinnedMessage?.id ?? group.pinnedMessageId;

  return {
    ...group,
    ...overrides,
    lastMessageAt: overrides?.lastMessageAt ?? latestMessage?.createdAt ?? group.lastMessageAt,
    lastMessagePreview: overrides?.lastMessagePreview ?? (latestMessage ? buildThreadMessagePreview(latestMessage) : group.lastMessagePreview),
    pinnedMessageId: nextPinnedMessageId,
  };
}

function syncPinnedThreadMessages(messages: ThreadMessage[], pinnedMessageId: string | null): ThreadMessage[] {
  let changed = false;

  const nextMessages = messages.map((message) => {
    const nextPinnedState = pinnedMessageId !== null && message.id === pinnedMessageId;
    if (Boolean(message.isPinned) === nextPinnedState) {
      return message;
    }

    changed = true;
    return {
      ...message,
      isPinned: nextPinnedState,
    };
  });

  return changed ? nextMessages : messages;
}

function mergeLatestMessagesPageIntoThread(detail: ThreadDetail, messagePage: CommunityMessagesPage): ThreadDetail {
  const mergedMessages = syncPinnedThreadMessages(mergeThreadMessages([
    ...detail.messages,
    ...mapCommunityMessagesToThread(messagePage.messages),
  ]), detail.group.pinnedMessageId ?? null);

  return {
    ...detail,
    latestSequence: messagePage.latestSequence,
    messages: mergedMessages,
    readState: messagePage.readState,
    group: syncThreadGroupFromMessages(detail.group, mergedMessages, {
      unreadCount: messagePage.readState.unreadCount,
    }),
  };
}

function parseComparableTimestamp(value?: string): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortThreadMessages(messages: ThreadMessage[]): ThreadMessage[] {
  return messages.slice().sort((left, right) => {
    const diff = parseComparableTimestamp(left.createdAt) - parseComparableTimestamp(right.createdAt);
    if (diff !== 0) {
      return diff;
    }

    return left.id.localeCompare(right.id, "en");
  });
}

function mergeThreadMessages(messages: ThreadMessage[]): ThreadMessage[] {
  const merged: ThreadMessage[] = [];
  const keyToIndex = new Map<string, number>();

  for (const message of sortThreadMessages(messages)) {
    const keys = [message.id];
    if (message.clientRequestId) {
      keys.push(`client:${message.clientRequestId}`);
    }

    const existingIndex = keys.map((key) => keyToIndex.get(key)).find((value): value is number => value !== undefined);
    if (existingIndex !== undefined) {
      const current = merged[existingIndex];
      merged[existingIndex] = {
        ...current,
        ...message,
        localStatus: message.localStatus ?? current.localStatus,
        isOptimistic: message.isOptimistic ?? false,
      };
      for (const key of keys) {
        keyToIndex.set(key, existingIndex);
      }
      continue;
    }

    const nextIndex = merged.length;
    merged.push(message);
    for (const key of keys) {
      keyToIndex.set(key, nextIndex);
    }
  }

  return merged;
}

function createOptimisticThreadMessage(params: OptimisticThreadMessageParams): ThreadMessage {
  return {
    id: `optimistic-${params.clientRequestId}`,
    groupId: params.groupId,
    senderId: params.currentUserId,
    senderName: params.currentUserName,
    senderRole: params.senderRole,
    type: "text",
    body: params.body,
    createdAt: new Date().toISOString(),
    replyToPreview: params.replyToPreview,
    replyToMessageId: params.replyToMessageId,
    clientRequestId: params.clientRequestId,
    localStatus: "sending",
    isOptimistic: true,
  };
}

function reconcileThreadMessage(
  messages: ThreadMessage[],
  clientRequestId: string,
  nextMessage: CommunityMessage,
): ThreadMessage[] {
  const serverMessage = toThreadMessage(nextMessage, "sent");
  const replaced = messages.map((message) => (
    message.clientRequestId === clientRequestId || message.id === `optimistic-${clientRequestId}`
      ? { ...serverMessage, clientRequestId, isOptimistic: false }
      : message
  ));

  return mergeThreadMessages([...replaced, { ...serverMessage, clientRequestId, isOptimistic: false }]);
}

function mergeServerThreadMessage(messages: ThreadMessage[], nextMessage: CommunityMessage): ThreadMessage[] {
  return mergeThreadMessages([...messages, toThreadMessage(nextMessage)]);
}

function updateThreadMessageStatus(
  messages: ThreadMessage[],
  clientRequestId: string,
  localStatus: LocalMessageStatus,
): ThreadMessage[] {
  return messages.map((message) => (
    message.clientRequestId === clientRequestId || message.id === `optimistic-${clientRequestId}`
      ? { ...message, localStatus, isOptimistic: localStatus !== "sent" }
      : message
  ));
}

function messageStatusLabel(status?: LocalMessageStatus): string | null {
  if (status === "sending") return "جارٍ الإرسال";
  if (status === "retrying") return "جارٍ إعادة المحاولة";
  if (status === "failed") return "فشل الإرسال";
  if (status === "sent") return "تم الإرسال";
  return null;
}

function formatThreadDateLabel(value?: string): string {
  if (!value) {
    return "اليوم";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "اليوم";
  }

  return new Intl.DateTimeFormat("ar-LB", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function isSameThreadDay(left?: string, right?: string): boolean {
  if (!left || !right) {
    return false;
  }

  const leftDate = new Date(left);
  const rightDate = new Date(right);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) {
    return false;
  }

  return leftDate.toDateString() === rightDate.toDateString();
}

function isNearThreadBottom(container: HTMLDivElement): boolean {
  return container.scrollHeight - container.scrollTop - container.clientHeight <= 56;
}

function loadPersistedCommunityListState(): PersistedCommunityListState | null {
  try {
    const raw = sessionStorage.getItem(COMMUNITY_LIST_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedCommunityListState>;
    if (typeof parsed.groupQuery !== "string" || typeof parsed.groupFilter !== "string") {
      return null;
    }

    if (!GROUP_DISCOVERY_FILTERS.some((filter) => filter.id === parsed.groupFilter)) {
      return null;
    }

    return {
      groupQuery: parsed.groupQuery,
      groupFilter: parsed.groupFilter,
      scrollY: typeof parsed.scrollY === "number" ? parsed.scrollY : 0,
    };
  } catch {
    return null;
  }
}

function persistCommunityListState(nextState: PersistedCommunityListState): void {
  try {
    sessionStorage.setItem(COMMUNITY_LIST_STATE_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // ignore transient session storage failures
  }
}

function applyLoadedThread(
  { data, currentUserName, setCommunity, setThread, setTypingUsers, setGroups }: LoadedThreadContext,
): void {
  setCommunity(data.community);
  setThread(data);
  setTypingUsers((data.group.typingUsers || []).filter((name) => name !== currentUserName));
  setGroups((prev) => prev.map((group) => (group.id === data.group.id ? { ...data.group } : group)));
}

function applySentMessageToThread(
  prev: ThreadDetail | null,
  message: CommunityMessage,
  currentUserName: string,
): ThreadDetail | null {
  if (!prev) return prev;
  return {
    ...prev,
    messages: mergeServerThreadMessage(prev.messages, message),
    group: {
      ...prev.group,
      lastMessageAt: message.createdAt,
      lastMessagePreview: buildThreadMessagePreview(message),
      unreadCount: 0,
      typingUsers: (prev.group.typingUsers || []).filter((name) => name !== currentUserName),
    },
  };
}

function applyAnnouncementToThread(prev: ThreadDetail | null, message: CommunityMessage): ThreadDetail | null {
  if (!prev) return prev;
  return {
    ...prev,
    messages: mergeServerThreadMessage(prev.messages, message),
    group: {
      ...prev.group,
      pinnedMessageId: message.id,
      lastMessageAt: message.createdAt,
      lastMessagePreview: message.body,
    },
  };
}

function updateThreadGroupsAfterSend(
  groups: CommunityGroup[],
  targetGroupId: string,
  message: CommunityMessage,
  currentUserName: string,
): CommunityGroup[] {
  return groups.map((group) => {
    if (group.id !== targetGroupId) return group;

    return {
      ...group,
      lastMessageAt: message.createdAt,
      lastMessagePreview: buildThreadMessagePreview(message),
      unreadCount: 0,
      typingUsers: (group.typingUsers || []).filter((name) => name !== currentUserName),
    };
  });
}

function updateThreadGroupsAfterGroupSave(groups: CommunityGroup[], updated: CommunityGroup): CommunityGroup[] {
  return groups.map((group) => (group.id === updated.id ? { ...group, ...updated } : group));
}

function updateThreadGroupsAfterAnnouncement(
  groups: CommunityGroup[],
  targetGroupId: string,
  message: CommunityMessage,
): CommunityGroup[] {
  return groups.map((group) => {
    if (group.id !== targetGroupId) return group;

    return {
      ...group,
      pinnedMessageId: message.id,
      lastMessageAt: message.createdAt,
      lastMessagePreview: message.body,
    };
  });
}

function updateThreadGroupsUnreadCount(
  groups: CommunityGroup[],
  targetGroupId: string,
  unreadCount: number,
): CommunityGroup[] {
  return groups.map((group) => (
    group.id === targetGroupId ? { ...group, unreadCount } : group
  ));
}

function updateThreadDetailReadState(detail: ThreadDetail, readState: CommunityReadUpdate): ThreadDetail {
  return {
    ...detail,
    group: {
      ...detail.group,
      unreadCount: readState.unreadCount,
    },
    readState: {
      unreadCount: readState.unreadCount,
      lastReadMessageId: readState.lastReadMessageId ?? null,
      lastReadAt: readState.lastReadAt ?? null,
    },
  };
}

function applyMembershipUpdateToGroup(group: CommunityGroup, update: CommunityMembershipUpdate): CommunityGroup {
  if (group.id !== update.group.id) {
    return group;
  }

  return {
    ...group,
    ...update.group,
    currentMembership: update.currentMembership,
    actorPermissions: update.actorPermissions,
  };
}

function applyMembershipUpdateToThread(
  detail: ThreadDetail | null,
  update: CommunityMembershipUpdate,
): ThreadDetail | null {
  if (detail?.group?.id !== update.group.id) {
    return detail;
  }

  return {
    ...detail,
    group: {
      ...detail.group,
      ...update.group,
      currentMembership: update.currentMembership,
      actorPermissions: update.actorPermissions,
    },
    currentMembership: update.currentMembership,
    actorPermissions: update.actorPermissions,
  };
}

function applyMembersOverviewToGroup(
  group: CommunityGroup,
  overview: CommunityGroupMembersOverview,
): CommunityGroup {
  if (group.id !== overview.group.id) {
    return group;
  }

  return {
    ...group,
    ...overview.group,
    currentMembership: overview.currentMembership,
    actorPermissions: overview.actorPermissions,
  };
}

function applyMembersOverviewToThread(
  detail: ThreadDetail | null,
  overview: CommunityGroupMembersOverview,
): ThreadDetail | null {
  if (detail?.group?.id !== overview.group.id) {
    return detail;
  }

  return {
    ...detail,
    group: {
      ...detail.group,
      ...overview.group,
      currentMembership: overview.currentMembership,
      actorPermissions: overview.actorPermissions,
    },
    currentMembership: overview.currentMembership,
    actorPermissions: overview.actorPermissions,
  };
}

function CommunityGroupListItem({
  group,
  liveGroupIds,
  isAuthed,
  requestingMembershipGroupId,
  onOpen,
  onRequestMembership,
  onAcceptInvitation,
}: Readonly<{
  group: CommunityGroup;
  liveGroupIds: Set<string>;
  isAuthed: boolean;
  requestingMembershipGroupId: string | null;
  onOpen: (groupId: string) => void;
  onRequestMembership: (groupId: string) => void;
  onAcceptInvitation: (groupId: string) => void;
}>) {
  const membershipStatus = group.currentMembership?.status;
  const canOpen = canReadGroup(group);
  const membershipActionPending = requestingMembershipGroupId === group.id;
  const canRequestMembership = isAuthed
    && canRequestMembershipForStatus(membershipStatus)
    && (group.visibility === "public" || group.visibility === "private");
  const canAcceptInvitation = isAuthed && membershipStatus === "invited";
  let membershipActionLabel = "طلب الانضمام";
  if (group.visibility === "public") {
    membershipActionLabel = "انضم للمشاركة";
  }
  if (membershipActionPending) {
    membershipActionLabel = "جارٍ إرسال الطلب...";
  }
  let invitationActionLabel = "قبول الدعوة";
  if (membershipActionPending) {
    invitationActionLabel = "جارٍ قبول الدعوة...";
  }

  return (
    <li>
      <div className="community-group-row-wrap">
        <button className="community-group-row" type="button" onClick={() => onOpen(group.id)} disabled={!canOpen}>
          <span className="community-group-row__avatar">
            {group.isOfficial ? <Megaphone24Regular aria-hidden /> : <People24Regular aria-hidden />}
          </span>
          <span className="community-group-row__content">
            <span className="community-group-row__topline">
              <span className="community-group-row__name" dir="auto">{group.name}</span>
              <span className="community-group-row__time">{formatListTime(group.lastMessageAt)}</span>
            </span>
            <span className="community-group-row__meta">
              {group.isOfficial ? <span className="community-group-row__tag">رسمي</span> : null}
              {liveGroupIds.has(group.id) ? <span className="community-group-row__tag">مباشر</span> : null}
              <span className="community-group-row__tag">{categoryLabel(group.category)}</span>
              <span className="community-group-row__tag">{visibilityLabel(group.visibility)}</span>
              {membershipStatus ? <span className="community-group-row__tag community-group-row__tag--membership">{membershipStatusLabel(membershipStatus)}</span> : null}
            </span>
            <span className="community-group-row__snippet" dir="auto">{group.lastMessagePreview || group.description || "افتح المجموعة لعرض آخر الرسائل."}</span>
          </span>
          {group.unreadCount ? <span className="community-group-row__badge">{group.unreadCount}</span> : null}
        </button>

        {canRequestMembership ? (
          <button
            type="button"
            className="community-group-row__action"
            onClick={() => onRequestMembership(group.id)}
            disabled={membershipActionPending}
          >
            {membershipActionLabel}
          </button>
        ) : null}

        {canAcceptInvitation ? (
          <button
            type="button"
            className="community-group-row__action"
            onClick={() => onAcceptInvitation(group.id)}
            disabled={membershipActionPending}
          >
            {invitationActionLabel}
          </button>
        ) : null}

        {!canRequestMembership && !canAcceptInvitation && !canOpen && group.visibility === "invite_only" ? (
          <span className="community-group-row__note">هذه المجموعة تفتح عبر دعوة صالحة فقط.</span>
        ) : null}
      </div>
    </li>
  );
}

function CommunityProtectedAttachmentView({
  message,
  apiBaseUrl,
}: Readonly<{
  message: ThreadMessage;
  apiBaseUrl: string;
}>) {
  const attachmentUrl = message.attachmentUrl;
  const [asset, setAsset] = useState<ProtectedCommunityAttachmentAsset | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">(
    attachmentUrl ? "loading" : "idle",
  );

  useEffect(() => {
    if (!attachmentUrl) {
      setAsset(null);
      setLoadState("idle");
      return;
    }

    let disposed = false;
    let objectUrl: string | null = null;
    setLoadState("loading");

    void api.fetchCommunityAttachmentAsset(attachmentUrl, apiBaseUrl)
      .then(({ blob, contentType, fileName }) => {
        if (disposed) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setAsset({ objectUrl, contentType, fileName });
        setLoadState("ready");
      })
      .catch(() => {
        if (disposed) {
          return;
        }

        setAsset(null);
        setLoadState("error");
      });

    return () => {
      disposed = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [apiBaseUrl, attachmentUrl]);

  if (!attachmentUrl) {
    return null;
  }

  const displayName = asset?.fileName || fallbackAttachmentLabel(message);
  const showAudio = Boolean(asset && isProtectedAudioAsset(message, asset.contentType));
  const showImage = Boolean(asset && isProtectedImageAsset(asset.contentType));
  const showDownloadActions = Boolean(asset) && showAudio === false;

  return (
    <div className="community-thread-attachment">
      <div className="community-thread-attachment__meta">
        <strong>{fallbackAttachmentLabel(message)}</strong>
        <span dir="auto">{displayName}</span>
      </div>
      {loadState === "loading" ? <span className="community-thread-attachment__status">جارٍ تحميل المحتوى المحمي...</span> : null}
      {loadState === "error" ? <span className="community-thread-attachment__status community-thread-attachment__status--error">تعذّر تحميل المرفق المحمي حالياً.</span> : null}
      {showImage && asset ? <img className="community-thread-attachment__image" src={asset.objectUrl} alt={displayName} /> : null}
      {showAudio && asset ? (
        <audio className="community-thread-attachment__audio" controls preload="metadata" src={asset.objectUrl}>
          <track kind="captions" srcLang="ar" label="Arabic captions" />
        </audio>
      ) : null}
      {showDownloadActions && asset ? (
        <div className="community-thread-attachment__actions">
          <a href={asset.objectUrl} target="_blank" rel="noreferrer">فتح المرفق</a>
          <a href={asset.objectUrl} download={displayName}>تنزيل نسخة</a>
        </div>
      ) : null}
    </div>
  );
}

function CommunityMessageItem({ // NOSONAR
  message,
  apiBaseUrl,
  currentUserId,
  currentUserName,
  isAdmin: _isAdmin,
  onReply,
  onRetry,
  onStartEdit,
  onDeleteForEveryone,
  onDeleteForSelf,
  onTogglePinnedState,
  onToggleReaction,
  editingMessageId,
  canDeleteMessage,
  canModerateMessages,
}: Readonly<{
  message: ThreadMessage;
  apiBaseUrl: string;
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  onReply: (messageId: string) => void;
  onRetry: (messageId: string) => void;
  onStartEdit: (messageId: string) => void;
  onDeleteForEveryone: (messageId: string) => void;
  onDeleteForSelf: (messageId: string) => void;
  onTogglePinnedState: (messageId: string, nextPinned: boolean) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  editingMessageId: string | null;
  canDeleteMessage: (message: CommunityMessage) => boolean;
  canModerateMessages: boolean;
}>) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const mine = message.senderId === currentUserId || message.senderName === currentUserName;
  const badge = messageTypeLabel(message);
  const deletedForEveryone = Boolean(message.deletedForEveryoneAt);
  const replyBody = message.replyToPreview?.body || "رسالة بدون نص";
  const fallbackBody = message.attachmentUrl ? fallbackAttachmentLabel(message) : "رسالة بدون نص";
  let messageBody = message.body || fallbackBody;
  if (deletedForEveryone) {
    messageBody = "تم حذف هذه الرسالة للجميع";
  }
  const isAnnouncement = message.type === "announcement" || message.type === "session_invite";
  const deliveryStatus = message.localStatus && message.localStatus !== "sent"
    ? messageStatusLabel(message.localStatus)
    : null;
  const canRetry = mine && message.localStatus === "failed" && Boolean(message.clientRequestId);
  const canReply = !message.isOptimistic;
  const canDeleteServerMessage = !message.isOptimistic && canDeleteMessage(message);
  const canDeleteOnlyForMe = !message.isOptimistic;
  const canEditMessage = mine
    && !message.isOptimistic
    && !deletedForEveryone
    && !message.attachmentUrl
    && message.type === "text";
  const shouldRenderBody = deletedForEveryone || Boolean(message.body) || !message.attachmentUrl;
  const showReplyPreview = deletedForEveryone ? false : Boolean(message.replyToPreview);
  const showProtectedAttachment = deletedForEveryone === false;
  const isEditing = editingMessageId === message.id;
  const isPinned = message.isPinned === true;
  const canTogglePinnedState = canModerateMessages
    && !message.isOptimistic
    && !deletedForEveryone
    && message.type !== "announcement"
    && message.type !== "session_invite";
  const copyableText = resolveCopyableCommunityMessageText(message);
  const canCopyMessage = Boolean(copyableText);
  let copyButtonLabel = "نسخ";
  if (copyState === "copied") {
    copyButtonLabel = "تم النسخ";
  } else if (copyState === "error") {
    copyButtonLabel = "تعذّر النسخ";
  }
  const reactionChoices = Array.from(new Set([
    ...(message.reactions?.map((reaction) => reaction.emoji) || []),
    ...COMMUNITY_QUICK_REACTIONS,
  ]));

  useEffect(() => {
    setCopyState("idle");
  }, [message.id, message.body, message.deletedForEveryoneAt]);

  async function handleCopyMessage() {
    if (!copyableText) {
      return;
    }

    const copied = await copyCommunityMessageText(copyableText);
    setCopyState(copied ? "copied" : "error");
  }

  return (
    <article
      className={`community-thread-message ${mine ? "community-thread-message--mine" : "community-thread-message--other"}${isAnnouncement ? " community-thread-message--announcement" : ""}${message.localStatus === "failed" ? " community-thread-message--failed" : ""}${message.isOptimistic && message.localStatus !== "failed" ? " community-thread-message--optimistic" : ""}`}
      data-message-id={message.id}
    >
      <div className="community-thread-message__sender">
        <strong dir="auto">{mine ? "أنت" : message.senderName}</strong>
        {badge ? <span className="community-thread-message__badge">{badge}</span> : null}
      </div>
      {showReplyPreview && message.replyToPreview ? (
        <div className="community-thread-message__reply">
          <span className="community-thread-message__reply-author">رد على <bdi dir="auto">{message.replyToPreview.senderName}</bdi></span>
          <span className="community-thread-message__reply-text" dir="auto">{replyBody}</span>
        </div>
      ) : null}
      {shouldRenderBody ? <p className={`community-thread-message__body${deletedForEveryone ? " community-thread-message__deleted" : ""}`} dir="auto">{messageBody}</p> : null}
      {message.mentions?.length ? (
        <div className="community-thread-message__mentions" aria-label="الإشارات المحلولة داخل الرسالة">
          {message.mentions.map((mention) => (
            <span key={`${message.id}:${mention.userId}`} className="community-thread-message__mention-pill" dir="auto">
              @{mention.displayName}
            </span>
          ))}
        </div>
      ) : null}
      {showProtectedAttachment ? <CommunityProtectedAttachmentView message={message} apiBaseUrl={apiBaseUrl} /> : null}
      {deletedForEveryone ? null : (
        <div className="community-thread-message__reactions" aria-label="تفاعلات الرسالة">
          {reactionChoices.map((emoji) => {
            const reaction = message.reactions?.find((entry) => entry.emoji === emoji);
            return (
              <button
                key={`${message.id}:${emoji}`}
                type="button"
                className={`community-thread-message__reaction${reaction?.reactedByMe ? " community-thread-message__reaction--active" : ""}`}
                onClick={() => onToggleReaction(message.id, emoji)}
              >
                <span aria-hidden="true">{emoji}</span>
                {reaction?.count ? <span>{reaction.count}</span> : null}
              </button>
            );
          })}
        </div>
      )}
      <div className="community-thread-message__meta">
        <span>{formatThreadTime(message.createdAt)}</span>
        {message.editedAt ? <span>معدلة</span> : null}
        <span>{message.senderRole === "admin" || message.senderRole === "system" ? "رسمي" : "عضو"}</span>
      </div>
      {deletedForEveryone ? (
        <div className="community-thread-message__status">تم حذفها للجميع بواسطة <bdi dir="auto">{message.deletedForEveryoneBy || "أنت"}</bdi></div>
      ) : (
        <div className="community-thread-message__actions">
          {canReply ? <button type="button" onClick={() => onReply(message.id)}>رد</button> : null}
          {canCopyMessage ? <button type="button" onClick={() => void handleCopyMessage()}>{copyButtonLabel}</button> : null}
          {canRetry ? <button type="button" className="community-thread-message__retry" onClick={() => onRetry(message.id)}>إعادة الإرسال</button> : null}
          {canEditMessage ? <button type="button" onClick={() => onStartEdit(message.id)}>{isEditing ? "قيد التعديل" : "تعديل"}</button> : null}
          {canTogglePinnedState ? <button type="button" onClick={() => onTogglePinnedState(message.id, !isPinned)}>{isPinned ? "إلغاء التثبيت" : "تثبيت"}</button> : null}
          {canDeleteOnlyForMe ? <button type="button" onClick={() => onDeleteForSelf(message.id)}>حذف لدي</button> : null}
          {canDeleteServerMessage ? <button type="button" onClick={() => onDeleteForEveryone(message.id)}>حذف للجميع</button> : null}
        </div>
      )}
      {deliveryStatus ? (
        <div className={`community-thread-message__status${message.localStatus === "failed" ? " community-thread-message__status--error" : ""}`}>{deliveryStatus}</div>
      ) : null}
    </article>
  );
}

function CommunityOverviewScreen({
  community: _community,
  orderedGroups,
  liveNowCount: _liveNowCount,
  unreadGroupCount: _unreadGroupCount,
  officialGroupCount: _officialGroupCount,
  highlightedSession,
  groupQuery,
  setGroupQuery,
  groupFilter,
  setGroupFilter,
  filteredGroups,
  liveGroupIds,
  loadingOverview,
  isAuthed,
  isAdmin,
  newGroupName,
  newGroupDescription,
  newGroupCategory,
  setNewGroupName,
  setNewGroupDescription,
  setNewGroupCategory,
  creatingGroup,
  onCreateGroup,
  requestingMembershipGroupId,
  onRequestMembership,
  onAcceptInvitation,
  error,
  onOpenGroup,
  onOpenHighlightedSession,
}: OverviewScreenProps) {
  return (
    <div className="hybrid-screen community-thread-screen">
      {highlightedSession ? (
        <section className="community-focus-card">
          <div className="community-focus-card__copy">
            <span className="community-pinned-card__tag">{highlightedSession.status === "live" ? "مباشر الآن" : "جلسة مجدولة"}</span>
            <h2>{highlightedSession.title}</h2>
            <p>المضيف: {highlightedSession.hostName}. افتح المجموعة المرتبطة للدخول إلى الجلسة ضمن نفس سياق الرسائل.</p>
          </div>
          <button type="button" className="community-pinned-card__action" onClick={() => onOpenHighlightedSession(highlightedSession.groupId)}>
            ادخل الجلسة
          </button>
        </section>
      ) : null}

      <section className="community-discovery-panel" aria-label="البحث ومرشحات المجموعات">
        <label className="community-search-field">
          <Search24Regular aria-hidden="true" />
          <input
            type="search"
            value={groupQuery}
            onChange={(event) => setGroupQuery(event.target.value)}
            placeholder="ابحث باسم المجموعة أو آخر رسالة"
            aria-label="ابحث داخل المجموعات"
          />
        </label>
        <div className="community-filter-row" role="tablist" aria-label="مرشحات المجموعات">
          {GROUP_DISCOVERY_FILTERS.map((filter) => (
            <button
              key={filter.id}
              data-feature-key={filter.id}
              type="button"
              role="tab"
              aria-selected={groupFilter === filter.id}
              className={`community-filter-chip${groupFilter === filter.id ? " community-filter-chip--active" : ""}`}
              onClick={() => setGroupFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="hybrid-section">
        <div className="hybrid-section__header">
          <div>
            <span className="hybrid-section__eyebrow">المجموعات</span>
            <h2 className="hybrid-section__title">اختر مجموعة</h2>
          </div>
          <span className="hybrid-section__meta">{filteredGroups.length} من {orderedGroups.length}</span>
        </div>

        <ul className="community-group-list">
          {filteredGroups.map((group) => (
            <CommunityGroupListItem
              key={group.id}
              group={group}
              liveGroupIds={liveGroupIds}
              isAuthed={isAuthed}
              requestingMembershipGroupId={requestingMembershipGroupId}
              onOpen={onOpenGroup}
              onRequestMembership={onRequestMembership}
              onAcceptInvitation={onAcceptInvitation}
            />
          ))}
          {!loadingOverview && orderedGroups.length === 0 ? (
            <div className="hybrid-empty-state">
              <h3>لا توجد مجموعات بعد.</h3>
              <p>ستظهر هنا أحدث مجموعات المجتمع عند توفرها.</p>
            </div>
          ) : null}
          {!loadingOverview && orderedGroups.length > 0 && filteredGroups.length === 0 ? (
            <div className="hybrid-empty-state">
              <h3>لا توجد نتائج مطابقة.</h3>
              <p>جرّب مسح البحث أو تبديل المرشح للوصول إلى المجموعة الصحيحة بسرعة.</p>
            </div>
          ) : null}
        </ul>
      </section>

      {isAdmin ? (
        <details className="community-admin-disclosure">
          <summary>
            <div className="community-admin-disclosure__copy">
              <span className="community-headline__eyebrow">أدوات الإدارة</span>
              <strong className="community-admin-disclosure__title">إنشاء مجموعة جديدة</strong>
              <span className="community-admin-disclosure__hint">الاسم، التصنيف، ثم النشر. القسم الإداري يبقى مخفياً حتى لا يزاحم التصفح اليومي للمجموعات.</span>
            </div>
            <ChevronDown24Regular aria-hidden="true" className="community-admin-disclosure__chevron" />
          </summary>

          <section className="community-admin-panel community-admin-panel--embedded">
            <ol className="community-admin-task-steps" aria-label="خطوات إنشاء المجموعة">
              <li>1. اختر اسماً واضحاً</li>
              <li>2. حدّد التصنيف</li>
              <li>3. انشر المجموعة</li>
            </ol>

            <section className="community-admin-section">
              <div className="community-admin-section__header">
                <strong>هوية المجموعة</strong>
                <span>هذا النموذج مخصص لتعريف المجموعة الجديدة ووضعها في التصنيف الصحيح داخل المجتمع.</span>
              </div>

              <form className="community-admin-form" onSubmit={onCreateGroup}>
                <input type="text" value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="اسم المجموعة" />
                <select value={newGroupCategory} onChange={(event) => setNewGroupCategory(event.target.value as CommunityGroup["category"])}>
                  {GROUP_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <textarea value={newGroupDescription} onChange={(event) => setNewGroupDescription(event.target.value)} placeholder="وصف مختصر للمجموعة" rows={3} />
                <button type="submit" disabled={!newGroupName.trim() || creatingGroup}>{creatingGroup ? "جارٍ الإنشاء..." : "إنشاء المجموعة"}</button>
              </form>
            </section>
          </section>
        </details>
      ) : null}

      {error ? <div className="chat-error-banner"><span>{error}</span></div> : null}
    </div>
  );
}

function CommunityThreadComposer({
  editingMessage,
  replyingToMessage,
  composer,
  pendingAttachment,
  mentionSuggestions,
  sending,
  onComposerChange,
  onInsertMention,
  onPickAttachment,
  onPickVoiceAttachment,
  onClearAttachment,
  onCancelEdit,
  onCancelReply,
  onSendMessage,
  pulseTyping,
}: Readonly<{
  editingMessage: CommunityMessage | null;
  replyingToMessage: CommunityMessage | null;
  composer: string;
  pendingAttachment: PendingThreadAttachment | null;
  mentionSuggestions: MentionSuggestion[];
  sending: boolean;
  onComposerChange: (nextValue: string) => void;
  onInsertMention: (token: string) => void;
  onPickAttachment: () => void;
  onPickVoiceAttachment: () => void;
  onClearAttachment: () => void;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  onSendMessage: (event: SyntheticEvent<HTMLFormElement>) => void;
  pulseTyping: (nextValue: string) => void;
}>) {
  const canSubmit = Boolean(composer.trim() || pendingAttachment);
  let submitLabel = editingMessage ? "حفظ التعديل" : "إرسال";
  if (sending) {
    submitLabel = editingMessage ? "جارٍ حفظ التعديل..." : "جارٍ الإرسال...";
  }

  return (
    <form className="community-thread-composer" data-chat-composer onSubmit={onSendMessage}>
      <div className="community-thread-composer__stack">
        {editingMessage ? (
          <div className="community-thread-reply-target community-thread-reply-target--editing">
            <div className="community-thread-reply-target__meta">
              <strong>تعديل رسالة</strong>
              <span dir="auto">{editingMessage.body || "رسالة بدون نص"}</span>
            </div>
            <button type="button" onClick={onCancelEdit} aria-label="إلغاء التعديل">
              <Dismiss24Regular aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {replyingToMessage ? (
          <div className="community-thread-reply-target">
            <div className="community-thread-reply-target__meta">
              <strong>الرد على <bdi dir="auto">{replyingToMessage.senderName}</bdi></strong>
              <span dir="auto">{replyingToMessage.deletedForEveryoneAt ? "رسالة محذوفة للجميع" : replyingToMessage.body || "رسالة بدون نص"}</span>
            </div>
            <button type="button" onClick={onCancelReply} aria-label="إلغاء الرد">
              <Dismiss24Regular aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="community-thread-composer__tools" aria-label="أدوات الرسائل المتقدمة">
          <button type="button" className="community-thread-composer__tool" onClick={onPickAttachment} disabled={Boolean(editingMessage)}>إرفاق ملف</button>
          <button type="button" className="community-thread-composer__tool community-thread-composer__tool--voice" onClick={onPickVoiceAttachment} disabled={Boolean(editingMessage)}>مذكرة صوتية</button>
        </div>
        {pendingAttachment ? (
          <div className="community-thread-attachment-draft">
            <div className="community-thread-attachment-draft__copy">
              <strong>{pendingAttachment.messageType === "voice" ? "صوتية جاهزة للإرسال" : "مرفق جاهز للإرسال"}</strong>
              <span dir="auto">{pendingAttachment.file.name}</span>
            </div>
            <button type="button" onClick={onClearAttachment} aria-label="إزالة المرفق المحدد">
              <Dismiss24Regular aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {mentionSuggestions.length > 0 ? (
          <div className="community-thread-mention-list" aria-label="اقتراحات الإشارة">
            {mentionSuggestions.map((suggestion) => (
              <button key={suggestion.userId} type="button" className="community-thread-mention-list__button" onClick={() => onInsertMention(suggestion.token)}>
                <span>@{suggestion.token}</span>
                <small dir="auto">{suggestion.displayName}</small>
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          aria-label="اكتب رسالتك للمجموعة"
          dir="auto"
          enterKeyHint="send"
          value={composer}
          onChange={(event) => {
            const nextValue = event.target.value;
            onComposerChange(nextValue);
            pulseTyping(nextValue);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="اكتب رسالتك للمجموعة..."
          rows={2}
        />
      </div>
      <button type="submit" disabled={!canSubmit || sending}>{submitLabel}</button>
    </form>
  );
}

function CommunityThreadScreen({ // NOSONAR
  thread,
  displayedMessages,
  apiBaseUrl,
  activeLiveSession,
  pinnedMessage,
  loadingThread,
  loadingOlderMessages,
  loadingOlderError,
  canLoadOlderMessages,
  firstUnreadMessageId,
  threadSearchQuery,
  threadSearchError,
  searchingThreadMessages,
  onThreadSearchQueryChange,
  visibleTypingUsers,
  editingMessage,
  replyingToMessage,
  composer,
  pendingAttachment,
  mentionSuggestions,
  setComposer,
  onInsertMention,
  onPickAttachment,
  onPickVoiceAttachment,
  onClearAttachment,
  pulseTyping,
  sending,
  canWriteToThread,
  membershipActionPending,
  onRequestMembership,
  onAcceptInvitation,
  onLeaveGroup,
  membersOverview,
  loadingMembersOverview,
  memberReviewUserId,
  inviteUserId,
  setInviteUserId,
  inviteNote,
  setInviteNote,
  invitingMember,
  invitationActionUserId,
  onInviteMember,
  onApproveMember,
  onRejectMember,
  onRevokeInvitation,
  onSendMessage,
  onLoadOlderMessages,
  onStartEditMessage,
  onDeleteForEveryone,
  onDeleteForSelf,
  onTogglePinnedState,
  onToggleReaction,
  onReplyToMessage,
  onRetryMessage,
  onCancelEdit,
  onCancelReply,
  canDeleteMessage,
  currentUserId,
  currentUserName,
  isAdmin,
  editGroupName,
  editGroupDescription,
  setEditGroupName,
  setEditGroupDescription,
  savingGroup,
  onSaveGroup,
  announcementBody,
  setAnnouncementBody,
  postingAnnouncement,
  onPostAnnouncement,
  error,
  onGoBack,
  messagesRef,
}: ThreadScreenProps) {
  const baseThreadMessages = thread?.messages || [];
  const threadMessages = displayedMessages;
  const showLoadOlderControl = Boolean(thread && (canLoadOlderMessages || loadingOlderMessages || loadingOlderError));
  const membershipStatus = thread?.currentMembership?.status ?? null;
  const canManageMembers = hasGroupPermission(thread?.actorPermissions, "community.members.view");
  const canManageGroup = hasGroupPermission(thread?.actorPermissions, "community.group.manage");
  const canPublishAnnouncement = hasGroupPermission(thread?.actorPermissions, "community.announcements.publish");
  const canInviteMembers = hasGroupPermission(thread?.actorPermissions, "community.members.invite");
  const canModerateMessages = hasGroupPermission(thread?.actorPermissions, "community.messages.moderate");
  const pendingMembers = membersOverview?.membersByStatus.pending || [];
  const invitedMembers = membersOverview?.membersByStatus.invited || [];
  const canRequestMembership = Boolean(
    thread
      && canRequestMembershipForStatus(membershipStatus)
      && thread.group.visibility !== "invite_only",
  );
  const canAcceptInvitation = membershipStatus === "invited";
  const canLeaveGroup = membershipStatus === "active" || membershipStatus === "muted";
  let membershipRequestLabel = "طلب الانضمام";
  if (thread?.group.visibility === "public") {
    membershipRequestLabel = "انضم للمشاركة";
  }
  if (membershipActionPending) {
    membershipRequestLabel = "جارٍ إرسال الطلب...";
  }
  const membershipStatusSummaries = membersOverview ? (
    (["active", "pending", "invited", "muted", "suspended", "rejected", "left", "removed", "banned"] as CommunityGroupMemberStatus[])
      .map((status) => ({
        status,
        count: membersOverview.membersByStatus[status].length,
      }))
      .filter((entry) => entry.count > 0)
  ) : [];

  return (
    <div className="hybrid-screen community-thread-screen community-thread-screen--thread" data-chat-root data-chat-shell>
      <section className="community-thread-header-card community-thread-header-card--compact">
        <button className="community-thread-back" type="button" aria-label="العودة إلى المجموعات" onClick={onGoBack}>
          <ArrowLeft24Regular aria-hidden="true" />
        </button>
        <div className="community-thread-header-info">
          <strong className="community-thread-header-name" dir="auto">{thread?.group.name || "المجموعة"}</strong>
          <span className="community-thread-header-meta" dir="rtl">
            <span>{thread?.group.memberCount || 0} عضواً</span>
            <span aria-hidden="true">·</span>
            <span>{categoryLabel(thread?.group.category)}</span>
          </span>
        </div>
      </section>

      <section className="community-thread-search-panel" aria-label="البحث داخل المحادثة">
        <label className="community-search-field community-search-field--thread">
          <Search24Regular aria-hidden="true" />
          <input
            type="search"
            value={threadSearchQuery}
            onChange={(event) => onThreadSearchQueryChange(event.target.value)}
            placeholder="ابحث داخل هذه المحادثة"
            aria-label="ابحث داخل هذه المحادثة"
          />
        </label>
        <div className="community-thread-search-panel__meta">
          <span>{threadSearchQuery.trim() ? `${threadMessages.length} نتيجة` : `${baseThreadMessages.length} رسالة في العرض الحالي`}</span>
          {searchingThreadMessages ? <span>جارٍ البحث...</span> : null}
        </div>
        {threadSearchError ? <p className="community-thread-history__error">{threadSearchError}</p> : null}
      </section>

      {thread ? (
        <section className="community-membership-banner">
          <div className="community-membership-banner__copy">
            <span className="community-headline__eyebrow">حالة العضوية</span>
            <strong dir="auto">{thread.currentMembership ? membershipStatusLabel(thread.currentMembership.status) : visibilityLabel(thread.group.visibility)}</strong>
            <span className="community-membership-banner__message">
              {membershipStatus === "pending" ? "تم إرسال الطلب وهو الآن بانتظار موافقة الإدارة." : null}
              {membershipStatus === "invited" ? "لديك دعوة معلقة. قبول الدعوة يفعّل القراءة والمشاركة داخل المجموعة." : null}
              {membershipStatus === "muted" ? "يمكنك القراءة حالياً لكن الإرسال موقوف إلى أن تُرفع الحالة." : null}
              {membershipStatus === "left" ? "غادرت هذه المجموعة ويمكنك طلب الانضمام مجدداً إذا كانت السياسة تسمح بذلك." : null}
              {membershipStatus === "rejected" ? "تم رفض الطلب الحالي. يمكنك المحاولة لاحقاً إذا فُتح الانضمام مجدداً." : null}
              {!thread.currentMembership && thread.group.visibility === "public" ? "القراءة متاحة، لكن الإرسال يتطلب الانضمام أولاً." : null}
              {!thread.currentMembership && thread.group.visibility === "private" ? "هذه مجموعة خاصة ظاهرة. اطلب الانضمام للوصول الكامل والمشاركة." : null}
              {!thread.currentMembership && thread.group.visibility === "invite_only" ? "الدخول إلى هذه المجموعة يتم عبر دعوة صالحة من الإدارة." : null}
            </span>
          </div>
          <div className="community-membership-banner__actions">
            {canAcceptInvitation ? (
              <button type="button" className="community-membership-banner__button" onClick={onAcceptInvitation} disabled={membershipActionPending}>
                {membershipActionPending ? "جارٍ قبول الدعوة..." : "قبول الدعوة"}
              </button>
            ) : null}
            {canRequestMembership ? (
              <button type="button" className="community-membership-banner__button" onClick={onRequestMembership} disabled={membershipActionPending}>
                {membershipRequestLabel}
              </button>
            ) : null}
            {canLeaveGroup ? (
              <button type="button" className="community-membership-banner__button community-membership-banner__button--ghost" onClick={onLeaveGroup} disabled={membershipActionPending}>
                {membershipActionPending ? "جارٍ التحديث..." : "مغادرة المجموعة"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeLiveSession ? (
        <section className="community-live-card community-live-card--thread">
          <span className="community-live-card__status">{activeLiveSession.status === "live" ? "مباشر الآن" : "جلسة مجدولة"}</span>
          <strong>{activeLiveSession.title}</strong>
          <span>المضيف: {activeLiveSession.hostName}</span>
          <button type="button" className="community-thread-join" onClick={() => activeLiveSession.joinUrl ? globalThis.open(activeLiveSession.joinUrl, "_blank", "noopener,noreferrer") : undefined}>
            انضم للجلسة
          </button>
        </section>
      ) : null}

      {canManageMembers ? (
        <details className="community-admin-disclosure">
          <summary>
            <div className="community-admin-disclosure__copy">
              <span className="community-headline__eyebrow">إدارة العضوية</span>
              <strong className="community-admin-disclosure__title">طلبات الانضمام وقائمة الأعضاء</strong>
              <span className="community-admin-disclosure__hint">اعرض الحالات الحالية واعتمد الطلبات المعلقة من نفس مسار المحادثة.</span>
            </div>
            <ChevronDown24Regular aria-hidden="true" className="community-admin-disclosure__chevron" />
          </summary>

          <section className="community-admin-panel community-admin-panel--embedded">
            <section className="community-admin-section">
              <div className="community-admin-section__header">
                <strong>ملخص العضوية</strong>
                <span>{membersOverview ? `${membersOverview.memberCount} من أصل ${membersOverview.memberLimit} عضو مسموح.` : "جارٍ تحميل حالات العضوية الحالية."}</span>
              </div>

              {membershipStatusSummaries.length > 0 ? (
                <div className="community-membership-stats" aria-label="إحصاءات العضوية">
                  {membershipStatusSummaries.map((entry) => (
                    <div key={entry.status} className="community-membership-stats__card">
                      <strong>{entry.count}</strong>
                      <span>{membershipStatusLabel(entry.status)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {canInviteMembers ? (
                <form className="community-admin-form" onSubmit={onInviteMember}>
                  <input type="text" value={inviteUserId} onChange={(event) => setInviteUserId(event.target.value)} placeholder="معرّف المستخدم المراد دعوته" />
                  <textarea value={inviteNote} onChange={(event) => setInviteNote(event.target.value)} placeholder="ملاحظة داخلية اختيارية مع الدعوة" rows={2} />
                  <button type="submit" disabled={!inviteUserId.trim() || invitingMember}>{invitingMember ? "جارٍ إرسال الدعوة..." : "إرسال دعوة"}</button>
                </form>
              ) : null}

              {loadingMembersOverview ? <p className="community-members-list__hint">جارٍ تحميل الأعضاء...</p> : null}

              {!loadingMembersOverview && pendingMembers.length === 0 ? (
                <p className="community-members-list__hint">لا توجد طلبات انضمام معلقة حالياً.</p>
              ) : null}

              {pendingMembers.length > 0 ? (
                <ul className="community-members-list" aria-label="طلبات الانضمام المعلقة">
                  {pendingMembers.map((member) => (
                    <li key={member.userId} className="community-members-list__item">
                      <div className="community-members-list__copy">
                        <strong dir="auto">{member.displayName}</strong>
                        <span>{membershipStatusLabel(member.status)}</span>
                      </div>
                      <div className="community-members-list__actions">
                        <button type="button" onClick={() => onApproveMember(member.userId)} disabled={memberReviewUserId === member.userId}>قبول</button>
                        <button type="button" className="community-members-list__button--ghost" onClick={() => onRejectMember(member.userId)} disabled={memberReviewUserId === member.userId}>رفض</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              {!loadingMembersOverview && invitedMembers.length === 0 ? (
                <p className="community-members-list__hint">لا توجد دعوات معلقة حالياً.</p>
              ) : null}

              {invitedMembers.length > 0 ? (
                <ul className="community-members-list" aria-label="الدعوات المعلقة">
                  {invitedMembers.map((member) => (
                    <li key={member.userId} className="community-members-list__item">
                      <div className="community-members-list__copy">
                        <strong dir="auto">{member.displayName}</strong>
                        <span>{member.reason || membershipStatusLabel(member.status)}</span>
                      </div>
                      <div className="community-members-list__actions">
                        <button
                          type="button"
                          className="community-members-list__button--ghost"
                          onClick={() => onRevokeInvitation(member.userId)}
                          disabled={invitationActionUserId === member.userId}
                        >
                          {invitationActionUserId === member.userId ? "جارٍ السحب..." : "سحب الدعوة"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </section>
        </details>
      ) : null}

      {canManageGroup || canPublishAnnouncement ? (
        <details className="community-admin-disclosure">
          <summary>
            <div className="community-admin-disclosure__copy">
              <span className="community-headline__eyebrow">إدارة المجموعة</span>
              <strong className="community-admin-disclosure__title">تعديل المعلومات ونشر إعلان</strong>
              <span className="community-admin-disclosure__hint">حدّث هوية المجموعة أو انشر إعلاناً مثبتاً. افتح هذا القسم فقط عند الحاجة حتى تبقى الرسائل هي العنصر الأساسي في الصفحة.</span>
            </div>
            <ChevronDown24Regular aria-hidden="true" className="community-admin-disclosure__chevron" />
          </summary>

          <section className="community-admin-panel community-admin-panel--thread community-admin-panel--embedded">
            <ul className="community-admin-task-steps" aria-label="مهام إدارة المجموعة">
              <li>حدّث الاسم والوصف</li>
              <li>انشر إعلاناً مثبتاً</li>
            </ul>

            <section className="community-admin-section">
              <div className="community-admin-section__header">
                <strong>بيانات المجموعة</strong>
                <span>استخدم هذا الجزء فقط عندما تحتاج إلى تصحيح الاسم أو الوصف الظاهري للأعضاء.</span>
              </div>

              <form className="community-admin-form" onSubmit={onSaveGroup}>
                <input type="text" value={editGroupName} onChange={(event) => setEditGroupName(event.target.value)} placeholder="اسم المجموعة" />
                <textarea value={editGroupDescription} onChange={(event) => setEditGroupDescription(event.target.value)} placeholder="وصف المجموعة" rows={3} />
                <button type="submit" disabled={!editGroupName.trim() || savingGroup || !canManageGroup}>{savingGroup ? "جارٍ الحفظ..." : "حفظ المعلومات"}</button>
              </form>
            </section>

            <section className="community-admin-section community-admin-section--accent">
              <div className="community-admin-section__header">
                <strong>الإعلان المثبت</strong>
                <span>اكتب فقط الرسالة التي تريد إبرازها أعلى المحادثة، دون خلطها مع بيانات تعريف المجموعة.</span>
              </div>

              <form className="community-admin-form" onSubmit={onPostAnnouncement}>
                <textarea value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} placeholder="اكتب إعلاناً مثبتاً للمجموعة" rows={3} />
                <button type="submit" disabled={!announcementBody.trim() || postingAnnouncement || !canPublishAnnouncement}>{postingAnnouncement ? "جارٍ النشر..." : "نشر إعلان"}</button>
              </form>
            </section>
          </section>
        </details>
      ) : null}

      {pinnedMessage ? (
        <section className="community-thread-pinned">
          <span className="community-pinned-card__tag">مثبت</span>
          <strong dir="auto">{pinnedMessage.deletedForEveryoneAt ? "تم حذف هذه الرسالة للجميع" : pinnedMessage.body}</strong>
        </section>
      ) : null}

      <section className="community-thread-messages" aria-busy={loadingThread || loadingOlderMessages} aria-label="رسائل المجموعة" data-chat-messages ref={messagesRef}>
        {showLoadOlderControl ? (
          <div className="community-thread-history" aria-live="polite">
            <button
              className="community-thread-history__button"
              type="button"
              onClick={onLoadOlderMessages}
              disabled={loadingOlderMessages || !canLoadOlderMessages}
            >
              {loadingOlderMessages ? "جارٍ تحميل الرسائل الأقدم..." : "تحميل رسائل أقدم"}
            </button>
            {loadingOlderError ? <p className="community-thread-history__error">{loadingOlderError}</p> : null}
          </div>
        ) : null}

        {loadingThread ? (
          <div className="screen-loader"><div className="screen-loader__spinner" /><span>جارٍ تحميل الرسائل...</span></div>
        ) : null}

        {!loadingThread && threadMessages.length === 0 ? (
          <div className="hybrid-empty-state community-thread-empty">
            <h3>{threadSearchQuery.trim() ? "لا توجد نتائج مطابقة." : "لا توجد رسائل بعد."}</h3>
            <p>{threadSearchQuery.trim() ? "جرّب تغيير عبارة البحث أو امسحها للعودة إلى كامل التسلسل الحالي." : "ابدأ الرسالة الأولى داخل هذه المجموعة وسيظهر التسلسل هنا مباشرة."}</p>
          </div>
        ) : null}

        {threadMessages.map((message, index) => {
          const previousMessage = threadMessages[index - 1];
          const showDateDivider = index === 0 || !isSameThreadDay(previousMessage?.createdAt, message.createdAt);
              const showUnreadDivider = !threadSearchQuery.trim() && firstUnreadMessageId === message.id;

          return (
            <Fragment key={message.id}>
              {showDateDivider ? (
                <div className="community-thread-date-divider" role="separator">
                  <span>{formatThreadDateLabel(message.createdAt)}</span>
                </div>
              ) : null}
              {showUnreadDivider ? (
                <div className="community-thread-read-divider" role="separator">
                  <span>أول الرسائل غير المقروءة</span>
                </div>
              ) : null}
              <CommunityMessageItem
                message={message}
                apiBaseUrl={apiBaseUrl}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                isAdmin={isAdmin}
                onReply={onReplyToMessage}
                onRetry={onRetryMessage}
                onStartEdit={onStartEditMessage}
                onDeleteForEveryone={onDeleteForEveryone}
                onDeleteForSelf={onDeleteForSelf}
                onTogglePinnedState={onTogglePinnedState}
                onToggleReaction={onToggleReaction}
                editingMessageId={editingMessage?.id ?? null}
                canDeleteMessage={canDeleteMessage}
                canModerateMessages={canModerateMessages}
              />
            </Fragment>
          );
        })}
      </section>

      {visibleTypingUsers.length > 0 ? (
        <div className="community-thread-typing" role="status" aria-live="polite">
          <span>{visibleTypingUsers.join("، ")} يكتب...</span>
          <div className="typing-animation"><span></span><span></span><span></span></div>
        </div>
      ) : null}

      {canWriteToThread ? (
        <CommunityThreadComposer
          editingMessage={editingMessage}
          replyingToMessage={replyingToMessage}
          composer={composer}
          pendingAttachment={pendingAttachment}
          mentionSuggestions={mentionSuggestions}
          sending={sending}
          onComposerChange={setComposer}
          onInsertMention={onInsertMention}
          onPickAttachment={onPickAttachment}
          onPickVoiceAttachment={onPickVoiceAttachment}
          onClearAttachment={onClearAttachment}
          onCancelEdit={onCancelEdit}
          onCancelReply={onCancelReply}
          onSendMessage={onSendMessage}
          pulseTyping={pulseTyping}
        />
      ) : null}

      {error ? <div className="chat-error-banner"><span>{error}</span></div> : null}
    </div>
  );
}

export default function CommunityThreadsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { apiBaseUrl, profile, hasRole } = useApp();
  const communityWsUrl = useMemo(() => getDefaultApiWebSocketUrl("/ws/community"), []);
  const currentUserId = profile.id || profile.email || profile.phone || profile.name || "current_user";
  const currentUserName = profile.email?.split("@")[0]?.trim() || profile.name || profile.id || "أنت";
  const initialPersistedListState = useMemo(() => loadPersistedCommunityListState(), []);
  const deepLinkedMessageId = useMemo(() => new URLSearchParams(location.search).get("messageId"), [location.search]);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<ReliableWebSocketClient | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readSyncInFlightRef = useRef(false);
  const threadRef = useRef<ThreadDetail | null>(null);
  const isAdmin = hasRole(["admin", "superadmin"]);
  const listScrollYRef = useRef(initialPersistedListState?.scrollY ?? 0);
  const pendingListScrollRestoreRef = useRef(false);
  const shouldRestoreThreadAnchorRef = useRef(false);
  const pendingOlderAnchorRef = useRef<{ previousHeight: number; previousTop: number } | null>(null);
  const pendingAutoScrollRef = useRef<ScrollBehavior | null>(null);
  const pendingReadSyncMessageIdRef = useRef<string | null>(null);
  const pendingDeepLinkedMessageIdRef = useRef<string | null>(deepLinkedMessageId);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const voiceAttachmentInputRef = useRef<HTMLInputElement | null>(null);

  const [community, setCommunity] = useState<Community | null>(null);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [composer, setComposer] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [loadingOlderError, setLoadingOlderError] = useState("");
  const [sending, setSending] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [error, setError] = useState("");
  const [membershipActionGroupId, setMembershipActionGroupId] = useState<string | null>(null);
  const [membersOverview, setMembersOverview] = useState<CommunityGroupMembersOverview | null>(null);
  const [loadingMembersOverview, setLoadingMembersOverview] = useState(false);
  const [memberReviewUserId, setMemberReviewUserId] = useState<string | null>(null);
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [invitingMember, setInvitingMember] = useState(false);
  const [invitationActionUserId, setInvitationActionUserId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupCategory, setNewGroupCategory] = useState<CommunityGroup["category"]>("general");
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDescription, setEditGroupDescription] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [groupQuery, setGroupQuery] = useState(initialPersistedListState?.groupQuery || "");
  const [groupFilter, setGroupFilter] = useState<GroupDiscoveryFilter>(initialPersistedListState?.groupFilter || "all");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [pendingAttachment, setPendingAttachment] = useState<PendingThreadAttachment | null>(null);
  const [threadSearchQuery, setThreadSearchQuery] = useState("");
  const [threadSearchError, setThreadSearchError] = useState("");
  const [searchingThreadMessages, setSearchingThreadMessages] = useState(false);
  const [searchedThreadMessages, setSearchedThreadMessages] = useState<ThreadMessage[] | null>(null);
  const [communityRealtimeEnabled, setCommunityRealtimeEnabled] = useState(true);
  const [pollingFallbackEnabled, setPollingFallbackEnabled] = useState(true);
  const [threadAccessRevoked, setThreadAccessRevoked] = useState(false);
  const [realtimeState, setRealtimeState] = useState<ReliableWebSocketState>("idle");
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedThreadGroupIdRef = useRef<string | null>(null);

  const listRoutePath = useMemo(() => {
    const state = location.state as { communityListPath?: string } | null;
    if (state?.communityListPath === "/community" || state?.communityListPath === "/groups") {
      return state.communityListPath;
    }

    return location.pathname === "/community" ? "/community" : "/groups";
  }, [location.pathname, location.state]);

  const persistListState = useCallback((scrollY: number) => {
    listScrollYRef.current = scrollY;
    persistCommunityListState({
      groupQuery,
      groupFilter,
      scrollY,
    });
  }, [groupFilter, groupQuery]);

  function stopPollingFallback() {
    if (pollingTimerRef.current === null) {
      return;
    }

    globalThis.clearInterval(pollingTimerRef.current);
    pollingTimerRef.current = null;
  }

  async function refreshLatestThreadMessages(targetGroupId: string) {
    const currentThread = threadRef.current;
    if (currentThread?.group.id !== targetGroupId) {
      return;
    }

    const messagePage = await api.getCommunityGroupMessagesPage(
      targetGroupId,
      { limit: COMMUNITY_THREAD_PAGE_SIZE },
      apiBaseUrl,
    );

    let nextThread: ThreadDetail | null = null;
    setThread((prev) => {
      if (prev?.group.id !== targetGroupId) {
        return prev;
      }

      nextThread = mergeLatestMessagesPageIntoThread(prev, messagePage);
      return nextThread;
    });

    if (nextThread) {
      setGroups((prev) => prev.map((group) => (
        group.id === targetGroupId
          ? syncThreadGroupFromMessages(group, nextThread!.messages, {
            unreadCount: nextThread!.readState.unreadCount,
            typingUsers: nextThread!.group.typingUsers,
          })
          : group
      )));

      pendingReadSyncMessageIdRef.current = messagePage.readState.lastReadMessageId
        ?? getNewestThreadMessageId(messagePage.messages);
    }
  }

  const refreshLatestThreadMessagesRef = useRef(refreshLatestThreadMessages);
  refreshLatestThreadMessagesRef.current = refreshLatestThreadMessages;

  async function syncCurrentGroupReadState(targetGroupId: string) {
    if (!profile.isAuthed || readSyncInFlightRef.current) {
      return;
    }

    const currentThread = threadRef.current;
    const pendingMessageId = pendingReadSyncMessageIdRef.current;
    if (currentThread?.group.id !== targetGroupId || !pendingMessageId) {
      return;
    }

    if (currentThread.readState.unreadCount === 0 && currentThread.readState.lastReadMessageId === pendingMessageId) {
      return;
    }

    readSyncInFlightRef.current = true;
    try {
      const result = await api.markCommunityGroupRead(targetGroupId, apiBaseUrl);
      setThread((prev) => {
        if (prev?.group.id !== targetGroupId) {
          return prev;
        }

        return updateThreadDetailReadState(prev, result);
      });
      setGroups((prev) => updateThreadGroupsUnreadCount(prev, targetGroupId, result.unreadCount));
      pendingReadSyncMessageIdRef.current = result.lastReadMessageId ?? pendingMessageId;
    } catch {
      // best-effort read synchronization after live updates
    } finally {
      readSyncInFlightRef.current = false;
      const latestThread = threadRef.current;
      if (
        latestThread?.group.id === targetGroupId
        && pendingReadSyncMessageIdRef.current
        && latestThread.readState.lastReadMessageId !== pendingReadSyncMessageIdRef.current
      ) {
        void syncCurrentGroupReadState(targetGroupId);
      }
    }
  }

  useEffect(() => {
    threadRef.current = thread;
  }, [thread]);

  useEffect(() => {
    let active = true;

    api.getFeatureFlags(apiBaseUrl)
      .then((payload) => {
        if (!active) {
          return;
        }

        setCommunityRealtimeEnabled(payload.flags["community.realtime.enabled"] !== false);
        setPollingFallbackEnabled(payload.flags["community.realtime.polling_fallback.enabled"] !== false);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setCommunityRealtimeEnabled(true);
        setPollingFallbackEnabled(true);
      });

    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (groupId) {
      return;
    }

    pendingListScrollRestoreRef.current = listScrollYRef.current > 0;
    if (!pendingListScrollRestoreRef.current) {
      return;
    }

    globalThis.requestAnimationFrame(() => {
      globalThis.scrollTo({ top: listScrollYRef.current, behavior: "auto" });
      pendingListScrollRestoreRef.current = false;
    });
  }, [deepLinkedMessageId, groupId]);

  useEffect(() => {
    if (groupId) {
      return;
    }

    const nextScrollY = pendingListScrollRestoreRef.current ? listScrollYRef.current : globalThis.scrollY;
    persistListState(nextScrollY);
  }, [groupFilter, groupId, groupQuery, persistListState]);

  useEffect(() => {
    if (groupId) {
      return;
    }

    const handleScroll = () => {
      if (pendingListScrollRestoreRef.current) {
        return;
      }

      listScrollYRef.current = globalThis.scrollY;
    };

    globalThis.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      globalThis.removeEventListener("scroll", handleScroll);
    };
  }, [deepLinkedMessageId, groupId]);

  useEffect(() => {
    let active = true;
    setLoadingOverview(true);

    api.getCommunityOverview(apiBaseUrl)
      .then((data) => {
        if (!active) return;
        setCommunity(data.community);
        setGroups(data.groups);
        setLiveSessions(data.liveSessions);
      })
      .catch(() => {
        if (!active) return;
        setError("تعذر تحميل المجموعات حالياً.");
      })
      .finally(() => {
        if (active) setLoadingOverview(false);
      });

    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!groupId) {
      setThread(null);
      setLoadingOlderMessages(false);
      setLoadingOlderError("");
      return;
    }

    let active = true;
    setLoadingThread(true);
    setLoadingOlderMessages(false);
    setLoadingOlderError("");
    setThreadAccessRevoked(false);
    pendingReadSyncMessageIdRef.current = null;
    pendingAutoScrollRef.current = "auto";

    Promise.all([
      api.getCommunityGroup(groupId, undefined, apiBaseUrl),
      api.getCommunityGroupMessagesPage(groupId, { limit: COMMUNITY_THREAD_PAGE_SIZE }, apiBaseUrl),
    ])
      .then(([detail, messagePage]) => {
        if (!active) return;
        const nextThread = toThreadDetail(detail, messagePage);
        applyLoadedThread({
          data: nextThread,
          currentUserName,
          setCommunity,
          setThread,
          setTypingUsers,
          setGroups,
        });
        pendingReadSyncMessageIdRef.current = messagePage.readState.lastReadMessageId ?? getNewestThreadMessageId(messagePage.messages);
      })
      .catch(() => {
        if (!active) return;
        setError("تعذر تحميل هذه المجموعة حالياً.");
      })
      .finally(() => {
        if (active) setLoadingThread(false);
      });

    return () => {
      active = false;
    };
  }, [apiBaseUrl, groupId, currentUserName]);

  useLayoutEffect(() => {
    const container = messagesRef.current;
    if (!container) {
      return;
    }

    if (pendingOlderAnchorRef.current) {
      const { previousHeight, previousTop } = pendingOlderAnchorRef.current;
      const nextHeight = container.scrollHeight;
      container.scrollTop = previousTop + (nextHeight - previousHeight);
      pendingOlderAnchorRef.current = null;
      return;
    }

    if (pendingAutoScrollRef.current) {
      container.scrollTo({ top: container.scrollHeight, behavior: pendingAutoScrollRef.current });
      pendingAutoScrollRef.current = null;
    }
  }, [thread?.messages]);

  useEffect(() => {
    pendingDeepLinkedMessageIdRef.current = deepLinkedMessageId;
  }, [deepLinkedMessageId]);

  useLayoutEffect(() => {
    if (!thread || !groupId) {
      return;
    }

    const targetMessageId = pendingDeepLinkedMessageIdRef.current;
    if (!targetMessageId) {
      return;
    }

    const container = messagesRef.current;
    const target = container?.querySelector(`[data-message-id="${targetMessageId}"]`);
    if (!(target instanceof HTMLElement)) {
      return;
    }

    target.scrollIntoView({ block: "center", behavior: "smooth" });
    pendingDeepLinkedMessageIdRef.current = null;
  }, [groupId, thread, thread?.messages]);

  useEffect(() => {
    if (!profile.isAuthed || !groupId || loadingThread || !thread || thread.group.id !== groupId) {
      return;
    }

    if (initializedThreadGroupIdRef.current === groupId) {
      return;
    }

    const newestMessageId = getNewestThreadMessageId(thread.messages);

    if (!thread.readState.lastReadMessageId && pendingReadSyncMessageIdRef.current !== newestMessageId) {
      return;
    }

    initializedThreadGroupIdRef.current = groupId;

    void api.markCommunityGroupRead(groupId, apiBaseUrl)
      .then((result) => {
        setThread((prev) => {
          if (!prev || prev.group.id !== groupId) {
            return prev;
          }

          return {
            ...prev,
            group: {
              ...prev.group,
              unreadCount: result.unreadCount,
            },
            readState: {
              unreadCount: result.unreadCount,
              lastReadMessageId: result.lastReadMessageId ?? null,
              lastReadAt: result.lastReadAt ?? null,
            },
          };
        });

        setGroups((prev) => updateThreadGroupsUnreadCount(prev, groupId, result.unreadCount));
      })
      .catch(() => {
        initializedThreadGroupIdRef.current = null;
      });
  }, [apiBaseUrl, groupId, loadingThread, profile.isAuthed, thread]);

  useEffect(() => {
    setEditingMessageId(null);
    setReplyingToMessageId(null);
    setThreadSearchQuery("");
    setThreadSearchError("");
    setSearchingThreadMessages(false);
    setSearchedThreadMessages(null);
    initializedThreadGroupIdRef.current = null;
    shouldRestoreThreadAnchorRef.current = false;
    pendingOlderAnchorRef.current = null;
    pendingAutoScrollRef.current = null;
    pendingDeepLinkedMessageIdRef.current = deepLinkedMessageId;
  }, [deepLinkedMessageId, groupId]);

  function handleConnectionSequenceUpdate(
    realtimeEvent: ThreadRealtimeEvent,
    currentGroupId: string,
    payload: NonNullable<ThreadRealtimeEvent["payload"]>,
  ) {
    const latestSequence = typeof payload.latestSequence === "string" || payload.latestSequence === null
      ? payload.latestSequence
      : null;

    setThread((prev) => {
      if (!prev || prev.group.id !== currentGroupId) {
        return prev;
      }

      return {
        ...prev,
        latestSequence,
      };
    });

    if (realtimeEvent.eventType === "community.connection.resync_required") {
      void refreshLatestThreadMessages(currentGroupId).catch(() => {
        // best-effort reconnect catch-up via the additive /messages route
      });
    }
  }

  function handleAuthorizationRevokedEvent() {
    setThreadAccessRevoked(true);
    stopPollingFallback();
    setError("لم تعد لديك صلاحية الوصول إلى هذه المجموعة.");
    wsRef.current?.disconnect(4003, "community_authorization_revoked");
  }

  function handleReadStateUpdatedEvent(
    currentGroupId: string,
    payload: NonNullable<ThreadRealtimeEvent["payload"]>,
  ) {
    const nextReadState = payload.readState as CommunityMessagesPage["readState"] | undefined;
    if (!nextReadState) {
      return;
    }

    pendingReadSyncMessageIdRef.current = nextReadState.lastReadMessageId ?? pendingReadSyncMessageIdRef.current;
    setThread((prev) => {
      if (!prev || prev.group.id !== currentGroupId) {
        return prev;
      }

      return {
        ...prev,
        group: {
          ...prev.group,
          unreadCount: nextReadState.unreadCount,
        },
        readState: nextReadState,
      };
    });
    setGroups((prev) => updateThreadGroupsUnreadCount(prev, currentGroupId, nextReadState.unreadCount));
  }

  function handleTypingEvent(
    realtimeEvent: ThreadRealtimeEvent,
    currentGroupId: string,
    payload: NonNullable<ThreadRealtimeEvent["payload"]>,
  ) {
    const payloadTypingUsers = Array.isArray(payload.typingUsers)
      ? payload.typingUsers.filter((value): value is string => typeof value === "string")
      : null;
    const eventUserName = typeof payload.userName === "string" ? payload.userName : null;
    const nextGroupTypingUsers = payloadTypingUsers ?? (() => {
      const currentTypingUsers = threadRef.current?.group.typingUsers || [];
      if (!eventUserName) {
        return currentTypingUsers;
      }

      if (realtimeEvent.eventType === "community.typing.started") {
        return Array.from(new Set([...currentTypingUsers, eventUserName]));
      }

      return currentTypingUsers.filter((name) => name !== eventUserName);
    })();

    setTypingUsers(nextGroupTypingUsers.filter((name) => name !== currentUserName));
    setThread((prev) => {
      if (!prev || prev.group.id !== currentGroupId) {
        return prev;
      }

      return {
        ...prev,
        group: {
          ...prev.group,
          typingUsers: nextGroupTypingUsers,
        },
      };
    });
    setGroups((prev) => prev.map((group) => (
      group.id === currentGroupId ? { ...group, typingUsers: nextGroupTypingUsers } : group
    )));
  }

  function commitRealtimeGroupSnapshot(currentGroupId: string, nextGroupSnapshot: CommunityGroup | null) {
    if (!nextGroupSnapshot) {
      return;
    }

    setGroups((prev) => prev.map((group) => (
      group.id === currentGroupId ? { ...group, ...nextGroupSnapshot } : group
    )));
  }

  function handleMessageCreatedEvent(
    realtimeEvent: ThreadRealtimeEvent,
    currentGroupId: string,
    payload: NonNullable<ThreadRealtimeEvent["payload"]>,
    eventMessage: CommunityMessage,
  ) {
    const eventClientRequestId = typeof payload.clientRequestId === "string" ? payload.clientRequestId : undefined;
    const shouldAutoScroll = eventMessage.senderId === currentUserId
      || (messagesRef.current ? isNearThreadBottom(messagesRef.current) : true);
    let shouldMarkRead = false;
    let nextGroupSnapshot: CommunityGroup | null = null;

    setThread((prev) => {
      if (!prev || prev.group.id !== currentGroupId) {
        return prev;
      }

      const alreadyPresent = prev.messages.some((message) => (
        message.id === eventMessage.id || (eventClientRequestId ? message.clientRequestId === eventClientRequestId : false)
      ));
      const nextMessages = eventClientRequestId
        ? reconcileThreadMessage(prev.messages, eventClientRequestId, eventMessage)
        : mergeThreadMessages([...prev.messages, toThreadMessage(eventMessage)]);
      const nextUnreadCount = alreadyPresent || eventMessage.senderId === currentUserId || shouldAutoScroll
        ? prev.readState.unreadCount
        : prev.readState.unreadCount + 1;

      const resolvedGroup = syncThreadGroupFromMessages(prev.group, nextMessages, {
        unreadCount: nextUnreadCount,
      });
      nextGroupSnapshot = resolvedGroup;

      if (!alreadyPresent && eventMessage.senderId !== currentUserId && shouldAutoScroll) {
        pendingReadSyncMessageIdRef.current = eventMessage.id;
        shouldMarkRead = true;
      }

      return {
        ...prev,
        latestSequence: realtimeEvent.sequence ?? prev.latestSequence,
        messages: nextMessages,
        readState: {
          ...prev.readState,
          unreadCount: nextUnreadCount,
        },
        group: resolvedGroup,
      };
    });

    commitRealtimeGroupSnapshot(currentGroupId, nextGroupSnapshot);

    if (shouldAutoScroll) {
      pendingAutoScrollRef.current = "smooth";
    }

    if (shouldMarkRead) {
      void syncCurrentGroupReadState(currentGroupId);
    }
  }

  function handleMessageUpdatedOrDeletedEvent(
    realtimeEvent: ThreadRealtimeEvent,
    currentGroupId: string,
    payload: NonNullable<ThreadRealtimeEvent["payload"]>,
    eventMessage: CommunityMessage,
  ) {
    const rawPinState = payload.pinState;
    const hasPinnedMessageId = Boolean(rawPinState && typeof rawPinState === "object" && Object.prototype.hasOwnProperty.call(rawPinState, "pinnedMessageId"));
    const pinnedMessageId = hasPinnedMessageId && typeof (rawPinState as { pinnedMessageId?: unknown }).pinnedMessageId === "string"
      ? (rawPinState as { pinnedMessageId: string }).pinnedMessageId
      : null;
    let nextGroupSnapshot: CommunityGroup | null = null;

    setThread((prev) => {
      if (!prev || prev.group.id !== currentGroupId) {
        return prev;
      }

      const nextMessages = hasPinnedMessageId
        ? syncPinnedThreadMessages(mergeThreadMessages([...prev.messages, toThreadMessage(eventMessage)]), pinnedMessageId)
        : mergeThreadMessages([...prev.messages, toThreadMessage(eventMessage)]);
      const resolvedGroup = syncThreadGroupFromMessages(prev.group, nextMessages, {
        unreadCount: prev.readState.unreadCount,
        ...(hasPinnedMessageId ? { pinnedMessageId: pinnedMessageId ?? undefined } : {}),
      });
      nextGroupSnapshot = resolvedGroup;

      return {
        ...prev,
        latestSequence: realtimeEvent.sequence ?? prev.latestSequence,
        messages: nextMessages,
        group: resolvedGroup,
      };
    });

    commitRealtimeGroupSnapshot(currentGroupId, nextGroupSnapshot);
  }

  function handleCommunityRealtimeEvent(realtimeEvent: ThreadRealtimeEvent) {
    if (!groupId || realtimeEvent.groupId !== groupId) {
      return;
    }

    const currentGroupId = groupId;
    const payload = realtimeEvent.payload || {};

    switch (realtimeEvent.eventType) {
      case "community.connection.ready":
      case "community.connection.resync_required":
        handleConnectionSequenceUpdate(realtimeEvent, currentGroupId, payload);
        return;
      case "community.authorization.revoked":
        handleAuthorizationRevokedEvent();
        return;
      case "community.read_state.updated":
        handleReadStateUpdatedEvent(currentGroupId, payload);
        return;
      case "community.typing.started":
      case "community.typing.stopped":
        handleTypingEvent(realtimeEvent, currentGroupId, payload);
        return;
      case "community.message.created": {
        const eventMessage = payload.message as CommunityMessage | undefined;
        if (!eventMessage) {
          return;
        }

        handleMessageCreatedEvent(realtimeEvent, currentGroupId, payload, eventMessage);
        return;
      }
      case "community.message.updated":
      case "community.message.deleted": {
        const eventMessage = payload.message as CommunityMessage | undefined;
        if (!eventMessage) {
          return;
        }

        handleMessageUpdatedOrDeletedEvent(realtimeEvent, currentGroupId, payload, eventMessage);
        return;
      }
      default:
        return;
    }
  }

  const handleCommunityRealtimeEventRef = useRef(handleCommunityRealtimeEvent);
  handleCommunityRealtimeEventRef.current = handleCommunityRealtimeEvent;

  useEffect(() => {
    wsRef.current?.disconnect(1000, "community_thread_replaced");
    wsRef.current = null;
    setRealtimeState("idle");

    const currentThread = threadRef.current;
    if (!groupId || !profile.isAuthed || !currentThread || currentThread.group.id !== groupId || !communityWsUrl || !communityRealtimeEnabled) {
      return;
    }

    if (!getAccessToken()) {
      return;
    }

    const socket = new ReliableWebSocketClient(() => {
      const token = getAccessToken();
      if (!token) {
        return communityWsUrl;
      }

      const url = new URL(communityWsUrl);
      url.searchParams.set("token", token);
      return url.toString();
    }, {
      shouldReconnect: (event) => ![4001, 4003, 4004].includes(event.code),
      onOpen: () => {
        const currentThread = threadRef.current;
        if (!currentThread || currentThread.group.id !== groupId) {
          return;
        }

        socket.sendJSON({
          type: "community.subscribe",
          groupId,
          since: currentThread.latestSequence,
        });
      },
      onMessage: (event) => {
        if (typeof event.data !== "string") {
          return;
        }

        try {
          const payload = JSON.parse(event.data) as ThreadRealtimeEvent | { type?: string; message?: string };
          if (typeof (payload as ThreadRealtimeEvent).eventType === "string") {
            handleCommunityRealtimeEventRef.current(payload as ThreadRealtimeEvent);
            return;
          }

          if ((payload as { type?: string }).type === "community.error" && (payload as { message?: string }).message === "community_realtime_disabled") {
            setCommunityRealtimeEnabled(false);
          }
        } catch {
          // ignore malformed websocket payloads
        }
      },
      onClose: (event) => {
        if (event.code === 4003) {
          setThreadAccessRevoked(true);
          stopPollingFallback();
          setError("لم تعد لديك صلاحية الوصول إلى هذه المجموعة.");
        }

        if (event.code === 4004) {
          setCommunityRealtimeEnabled(false);
        }
      },
      onStateChange: (nextState) => {
        setRealtimeState(nextState);
      },
    });

    wsRef.current = socket;
    socket.connect();

    const unsubscribeAuthState = subscribeAuthStateChange(() => {
      const nextToken = getAccessToken();
      if (!nextToken) {
        socket.disconnect(1000, "community_auth_changed");
        return;
      }

      if (!socket.isOpen()) {
        socket.connect();
      }
    });

    return () => {
      unsubscribeAuthState();
      socket.disconnect(1000, "community_thread_cleanup");
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
    };
  }, [communityRealtimeEnabled, communityWsUrl, groupId, profile.isAuthed, thread?.group.id]);

  useEffect(() => {
    stopPollingFallback();

    const currentThread = threadRef.current;
    if (!groupId || !profile.isAuthed || !currentThread || currentThread.group.id !== groupId || !pollingFallbackEnabled || threadAccessRevoked) {
      return;
    }

    const shouldPoll = !communityRealtimeEnabled || !communityWsUrl || realtimeState === "closed";
    if (!shouldPoll) {
      return;
    }

    void refreshLatestThreadMessagesRef.current(groupId).catch(() => {
      // fall back silently when the transport is unavailable
    });

    pollingTimerRef.current = globalThis.setInterval(() => {
      void refreshLatestThreadMessagesRef.current(groupId).catch(() => {
        // fall back silently when the transport is unavailable
      });
    }, COMMUNITY_REALTIME_POLL_INTERVAL_MS);

    return () => {
      stopPollingFallback();
    };
  }, [communityRealtimeEnabled, communityWsUrl, groupId, pollingFallbackEnabled, profile.isAuthed, realtimeState, thread?.group.id, threadAccessRevoked]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current !== null) {
        globalThis.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setEditGroupName(thread?.group.name || "");
    setEditGroupDescription(thread?.group.description || "");
  }, [thread?.group.description, thread?.group.name]);

  const canManageCurrentMembers = hasGroupPermission(thread?.actorPermissions, "community.members.view");
  const canManageCurrentGroup = hasGroupPermission(thread?.actorPermissions, "community.group.manage");
  const canPublishCurrentAnnouncement = hasGroupPermission(thread?.actorPermissions, "community.announcements.publish");
  const canWriteCurrentThread = canWriteGroup(thread?.group);

  useEffect(() => {
    if (!groupId || !thread || !canManageCurrentMembers) {
      setMembersOverview(null);
      setLoadingMembersOverview(false);
      return;
    }

    let active = true;
    setLoadingMembersOverview(true);

    api.getCommunityGroupMembers(groupId, apiBaseUrl)
      .then((payload) => {
        if (!active) {
          return;
        }

        setMembersOverview(payload);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setMembersOverview(null);
      })
      .finally(() => {
        if (active) {
          setLoadingMembersOverview(false);
        }
      });

    return () => {
      active = false;
    };
  }, [apiBaseUrl, canManageCurrentMembers, groupId, thread]);

  const normalizedThreadSearchQuery = useMemo(() => normalizeCommunityQuery(threadSearchQuery), [threadSearchQuery]);

  useEffect(() => {
    if (!groupId || !normalizedThreadSearchQuery) {
      setThreadSearchError("");
      setSearchingThreadMessages(false);
      setSearchedThreadMessages(null);
      return;
    }

    let active = true;
    const timeoutId = globalThis.setTimeout(() => {
      setSearchingThreadMessages(true);
      api.searchCommunityGroupMessages(groupId, {
        limit: COMMUNITY_THREAD_SEARCH_RESULT_LIMIT,
        query: threadSearchQuery,
      }, apiBaseUrl)
        .then((messagePage) => {
          if (!active) {
            return;
          }

          setSearchedThreadMessages(mapCommunityMessagesToThread(messagePage.messages));
          setThreadSearchError("");
        })
        .catch(() => {
          if (!active) {
            return;
          }

          setSearchedThreadMessages([]);
          setThreadSearchError("تعذر تنفيذ البحث داخل المحادثة حالياً.");
        })
        .finally(() => {
          if (active) {
            setSearchingThreadMessages(false);
          }
        });
    }, 250);

    return () => {
      active = false;
      globalThis.clearTimeout(timeoutId);
    };
  }, [apiBaseUrl, groupId, normalizedThreadSearchQuery, threadSearchQuery]);

  const orderedGroups = useMemo(() => {
    return groups.slice().sort((left, right) => {
      const leftTs = left.lastMessageAt ? Date.parse(left.lastMessageAt) : 0;
      const rightTs = right.lastMessageAt ? Date.parse(right.lastMessageAt) : 0;
      if (rightTs !== leftTs) {
        return rightTs - leftTs;
      }

      return left.name.localeCompare(right.name, "ar-LB");
    });
  }, [groups]);
  const liveGroupIds = useMemo(
    () => new Set(liveSessions.map((session) => session.groupId).filter((groupId): groupId is string => Boolean(groupId))),
    [liveSessions],
  );
  const normalizedGroupQuery = useMemo(() => normalizeCommunityQuery(groupQuery), [groupQuery]);
  const filteredGroups = useMemo(() => {
    return orderedGroups.filter((group) => {
      if (groupFilter === "live" && !liveGroupIds.has(group.id)) return false;
      if (groupFilter === "unread" && !group.unreadCount) return false;
      if (groupFilter === "official" && !group.isOfficial) return false;
      if (!normalizedGroupQuery) return true;

      const searchableText = [
        group.name,
        group.description,
        group.lastMessagePreview,
        categoryLabel(group.category),
      ].filter(Boolean).join(" ").toLocaleLowerCase("ar-LB");

      return searchableText.includes(normalizedGroupQuery);
    });
  }, [groupFilter, liveGroupIds, normalizedGroupQuery, orderedGroups]);
  const unreadGroupCount = useMemo(() => groups.filter((group) => Number(group.unreadCount) > 0).length, [groups]);
  const officialGroupCount = useMemo(() => groups.filter((group) => group.isOfficial).length, [groups]);
  const liveNowCount = useMemo(() => liveSessions.filter((session) => session.status === "live").length, [liveSessions]);

  const pinnedMessage = useMemo(() => {
    if (!thread) {
      return null;
    }

    return thread.messages.slice().reverse().find((message) => {
      if (message.isPinned === true) {
        return true;
      }

      return message.type === "announcement";
    }) ?? null;
  }, [thread]);

  const activeLiveSession = thread?.liveSession ?? (groupId
    ? liveSessions.find((session) => session.groupId === groupId) ?? null
    : null);
  const editingMessage = useMemo(() => {
    if (!thread || !editingMessageId) {
      return null;
    }

    return thread.messages.find((message) => message.id === editingMessageId) ?? null;
  }, [editingMessageId, thread]);
  const replyingToMessage = useMemo(() => {
    if (!thread) {
      return null;
    }

    return thread.messages.find((message) => message.id === replyingToMessageId) ?? null;
  }, [replyingToMessageId, thread]);
  const displayedMessages = useMemo(
    () => searchedThreadMessages ?? thread?.messages ?? [],
    [searchedThreadMessages, thread?.messages],
  );
  const mentionSuggestions = useMemo(() => {
    if (!membersOverview) {
      return [] as MentionSuggestion[];
    }

    const mentionQuery = extractTrailingMentionQuery(composer);
    if (mentionQuery === null) {
      return [] as MentionSuggestion[];
    }

    const normalizedMentionQuery = normalizeCommunityQuery(mentionQuery);
    const seenUserIds = new Set<string>();
    const sourceMembers = [
      ...membersOverview.membersByStatus.active,
      ...membersOverview.membersByStatus.muted,
    ];

    return sourceMembers
      .filter((member) => {
        if (seenUserIds.has(member.userId) || member.userId === currentUserId) {
          return false;
        }

        seenUserIds.add(member.userId);
        const displayName = member.displayName.trim();
        const token = buildCommunityMentionToken(displayName || member.userId);
        if (!token) {
          return false;
        }

        if (!normalizedMentionQuery) {
          return true;
        }

        const normalizedDisplayName = normalizeCommunityQuery(displayName);
        const normalizedToken = normalizeCommunityQuery(token);
        return normalizedDisplayName.includes(normalizedMentionQuery) || normalizedToken.includes(normalizedMentionQuery);
      })
      .map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
        token: buildCommunityMentionToken(member.displayName || member.userId),
      }))
      .slice(0, 6);
  }, [composer, currentUserId, membersOverview]);

  const canLoadOlderMessages = Boolean(thread?.pageInfo.hasMoreBefore && !loadingOlderMessages);
  const firstUnreadMessageId = thread?.readState.lastReadMessageId
    ? thread.messages.find((message, index, messages) => {
        const previousMessage = messages[index - 1];
        return previousMessage?.id === thread.readState.lastReadMessageId;
      })?.id ?? null
    : null;

  const visibleTypingUsers = useMemo(() => {
    return typingUsers.filter((name) => name !== currentUserName);
  }, [currentUserName, typingUsers]);

  function canDeleteMessage(message: CommunityMessage): boolean {
    return message.senderId === currentUserId || hasGroupPermission(thread?.actorPermissions, "community.messages.moderate");
  }

  function updateMessageCollections(
    transformer: (messages: ThreadMessage[]) => ThreadMessage[],
    options?: { pinnedMessageId?: string | null },
  ) {
    const applyTransformer = (messages: ThreadMessage[]) => {
      const nextMessages = transformer(messages);
      if (!options || !("pinnedMessageId" in options)) {
        return nextMessages;
      }

      return syncPinnedThreadMessages(nextMessages, options.pinnedMessageId ?? null);
    };

    setThread((prev) => prev ? {
      ...prev,
      messages: applyTransformer(prev.messages),
    } : prev);
    setSearchedThreadMessages((prev) => (prev ? applyTransformer(prev) : prev));
  }

  function syncGroupSnapshot(nextGroup: CommunityGroup, options?: { pinnedMessageId?: string | null }) {
    setThread((prev) => prev?.group.id === nextGroup.id ? {
      ...prev,
      group: syncThreadGroupFromMessages(prev.group, prev.messages, {
        ...prev.group,
        ...nextGroup,
        ...(options && "pinnedMessageId" in options ? { pinnedMessageId: options.pinnedMessageId ?? undefined } : {}),
      }),
    } : prev);
    setGroups((prev) => prev.map((group) => group.id === nextGroup.id
      ? syncThreadGroupFromMessages(group, [], {
        ...group,
        ...nextGroup,
        ...(options && "pinnedMessageId" in options ? { pinnedMessageId: options.pinnedMessageId ?? undefined } : {}),
      })
      : group));
  }

  async function syncTypingState(isTyping: boolean) {
    if (!groupId || !canWriteCurrentThread) return;

    try {
      const result = await api.setCommunityGroupTyping(groupId, {
        userName: currentUserName,
        isTyping,
      }, apiBaseUrl);
      const nextTypingUsers = result.typingUsers.filter((name) => name !== currentUserName);
      setTypingUsers(nextTypingUsers);
      setThread((prev) => prev ? {
        ...prev,
        group: {
          ...prev.group,
          typingUsers: result.typingUsers,
        },
      } : prev);
      setGroups((prev) => prev.map((group) => (
        group.id === groupId ? { ...group, typingUsers: result.typingUsers } : group
      )));
    } catch {
      // typing state is best-effort in the shell
    }
  }

  function pulseTyping(nextValue: string) {
    if (typingTimeoutRef.current !== null) {
      globalThis.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (!nextValue.trim()) {
      void syncTypingState(false);
      return;
    }

    void syncTypingState(true);
    typingTimeoutRef.current = globalThis.setTimeout(() => {
      void syncTypingState(false);
    }, 1500);
  }

  function resetAttachmentPickers() {
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
    if (voiceAttachmentInputRef.current) {
      voiceAttachmentInputRef.current.value = "";
    }
  }

  function clearPendingAttachment() {
    setPendingAttachment(null);
    resetAttachmentPickers();
  }

  function openAttachmentPicker(messageType: PendingAttachmentMessageType) {
    if (messageType === "voice") {
      voiceAttachmentInputRef.current?.click();
      return;
    }

    attachmentInputRef.current?.click();
  }

  function handleAttachmentSelection(messageType: PendingAttachmentMessageType, event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] || null;
    if (!nextFile) {
      return;
    }

    setPendingAttachment({
      file: nextFile,
      messageType,
    });
  }

  async function loadOlderMessages() {
    if (!groupId || !thread?.pageInfo.startCursor || loadingOlderMessages) {
      return;
    }

    const container = messagesRef.current;
    if (container) {
      pendingOlderAnchorRef.current = {
        previousHeight: container.scrollHeight,
        previousTop: container.scrollTop,
      };
    }

    setLoadingOlderMessages(true);
    setLoadingOlderError("");

    try {
      const detail = await api.getCommunityGroupMessagesPage(groupId, {
        before: thread.pageInfo.startCursor,
        limit: COMMUNITY_THREAD_PAGE_SIZE,
      }, apiBaseUrl);

      setThread((prev) => {
        if (!prev || prev.group.id !== groupId) {
          return prev;
        }

        return {
          ...prev,
          pageInfo: detail.pageInfo,
          latestSequence: detail.latestSequence,
          readState: detail.readState,
          messages: mergeThreadMessages([
            ...mapCommunityMessagesToThread(detail.messages),
            ...prev.messages,
          ]),
        };
      });
    } catch {
      pendingOlderAnchorRef.current = null;
      setLoadingOlderError("تعذر تحميل الرسائل الأقدم حالياً.");
    } finally {
      setLoadingOlderMessages(false);
    }
  }

  async function submitCommunityMessage(clientRequestId: string, body: string, replyTarget: CommunityMessage | null, isRetry = false) {
    if (!groupId) {
      return;
    }

    const message = await api.sendCommunityMessage(groupId, {
      body,
      clientRequestId,
      replyToMessageId: replyTarget?.id,
      senderId: currentUserId,
      senderName: currentUserName,
      replyToPreview: replyTarget ? buildReplyPreview(replyTarget) : undefined,
    }, apiBaseUrl);

    pendingAutoScrollRef.current = "smooth";
    setThread((prev) => {
      if (!prev) return prev;

      const nextMessages = reconcileThreadMessage(prev.messages, clientRequestId, message);
      const nextDetail = applySentMessageToThread({ ...prev, messages: nextMessages }, message, currentUserName);
      if (!nextDetail) {
        return prev;
      }

      return {
        ...nextDetail,
        messages: nextMessages,
      };
    });

    setGroups((prev) => updateThreadGroupsAfterSend(prev, groupId, message, currentUserName));
    if (!isRetry) {
      setComposer("");
      setReplyingToMessageId(null);
      setTypingUsers([]);
      void syncTypingState(false);
    }
  }

  async function submitCommunityAttachment(
    attachment: PendingThreadAttachment,
    body: string,
    replyTarget: CommunityMessage | null,
  ) {
    if (!groupId) {
      return;
    }

    const result = await api.uploadCommunityAttachment(groupId, {
      file: attachment.file,
      body,
      type: attachment.messageType,
      replyToMessageId: replyTarget?.id,
      replyToPreview: replyTarget ? buildReplyPreview(replyTarget) : undefined,
    }, apiBaseUrl);

    pendingAutoScrollRef.current = "smooth";
    setThread((prev) => applySentMessageToThread(prev, result.message, currentUserName));
    setGroups((prev) => updateThreadGroupsAfterSend(prev, groupId, result.message, currentUserName));
    setComposer("");
    setReplyingToMessageId(null);
    setTypingUsers([]);
    clearPendingAttachment();
    void syncTypingState(false);
  }

  function handleInsertMention(token: string) {
    setComposer((prev) => {
      if (extractTrailingMentionQuery(prev) === null) {
        return `${prev.trimEnd()} @${token} `.trimStart();
      }

      return replaceTrailingMentionQuery(prev, token);
    });
  }

  function handleStartEditMessage(messageId: string) {
    const target = thread?.messages.find((message) => message.id === messageId);
    const canEditTarget = target?.senderId === currentUserId
      && !target.deletedForEveryoneAt
      && !target.attachmentUrl
      && target.type === "text";
    if (!canEditTarget || !target) {
      return;
    }

    clearPendingAttachment();
    setError("");
    setReplyingToMessageId(null);
    setEditingMessageId(messageId);
    setComposer(target.body || "");
  }

  function handleCancelEdit() {
    setEditingMessageId(null);
    setComposer("");
  }

  async function submitEditedCommunityMessage(targetEditMessageId: string, body: string) {
    if (!groupId) {
      return;
    }

    const result = await api.editCommunityMessage(groupId, targetEditMessageId, body, apiBaseUrl);
    syncGroupSnapshot(result.group);
    updateMessageCollections((messages) => mergeServerThreadMessage(messages, result.message));
    setComposer("");
    setEditingMessageId(null);
  }

  function handleEditedCommunityMessageFailure(caughtError: unknown) {
    const errorWithStatus = caughtError as Error & { status?: number; code?: string };
    if (errorWithStatus.code === "community_message_edit_window_expired" || errorWithStatus.status === 409) {
      setError("انتهت مهلة تعديل هذه الرسالة. أرسل رسالة جديدة إذا لزم.");
      return;
    }

    setError("تعذر حفظ التعديل حالياً.");
  }

  function appendOptimisticCommunityMessage(body: string): string {
    if (!groupId) {
      return "";
    }

    const clientRequestId = makeCommunityClientRequestId("community-message");
    const optimisticMessage = createOptimisticThreadMessage({
      groupId,
      body,
      clientRequestId,
      currentUserId,
      currentUserName,
      senderRole: isAdmin ? "admin" : "user",
      replyToPreview: replyingToMessage ? buildReplyPreview(replyingToMessage) : undefined,
      replyToMessageId: replyingToMessage?.id,
    });

    pendingAutoScrollRef.current = "smooth";
    setThread((prev) => prev ? {
      ...prev,
      messages: mergeThreadMessages([...prev.messages, optimisticMessage]),
    } : prev);

    return clientRequestId;
  }

  function markLatestOptimisticCommunityMessageFailed() {
    const failedClientRequestId = thread?.messages.at(-1)?.clientRequestId;
    if (!failedClientRequestId) {
      return;
    }

    setThread((prev) => prev ? {
      ...prev,
      messages: updateThreadMessageStatus(prev.messages, failedClientRequestId, "failed"),
    } : prev);
  }

  async function submitFreshCommunityMessage(body: string, attachment: PendingThreadAttachment | null) {
    if (attachment) {
      await submitCommunityAttachment(attachment, body, replyingToMessage);
      return;
    }

    const clientRequestId = appendOptimisticCommunityMessage(body);
    await submitCommunityMessage(clientRequestId, body, replyingToMessage);
  }

  const handleSendMessage = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      const body = composer.trim();
      const attachment = pendingAttachment;
      const targetEditMessageId = editingMessageId;
      if (!groupId || sending || !canWriteCurrentThread || (!body && !attachment)) return;

      setSending(true);
      setError("");

      try {
        if (targetEditMessageId) {
          await submitEditedCommunityMessage(targetEditMessageId, body);
          return;
        }

        await submitFreshCommunityMessage(body, attachment);
      } catch (caughtError) {
        if (targetEditMessageId) {
          handleEditedCommunityMessageFailure(caughtError);
          return;
        }

        if (!attachment) {
          markLatestOptimisticCommunityMessageFailed();
        }
        setError(attachment ? "تعذر رفع المرفق المحمي حالياً." : "تعذر إرسال الرسالة حالياً.");
      } finally {
        setSending(false);
      }
    })();
  };

  async function handleRetryMessage(messageId: string) {
    if (!groupId || sending) {
      return;
    }

    const failedMessage = thread?.messages.find((message) => message.id === messageId);
    if (!failedMessage?.clientRequestId || !failedMessage.body) {
      return;
    }

    setError("");
    setThread((prev) => prev ? {
      ...prev,
      messages: updateThreadMessageStatus(prev.messages, failedMessage.clientRequestId!, "retrying"),
    } : prev);

    try {
      await submitCommunityMessage(
        failedMessage.clientRequestId,
        failedMessage.body,
        failedMessage.replyToPreview ? failedMessage : null,
        true,
      );
    } catch {
      setThread((prev) => prev ? {
        ...prev,
        messages: updateThreadMessageStatus(prev.messages, failedMessage.clientRequestId!, "failed"),
      } : prev);
      setError("تعذر إعادة إرسال الرسالة حالياً.");
    }
  }

  async function handleDeleteForEveryone(messageId: string) {
    if (!groupId) return;

    try {
      const result = await api.deleteCommunityMessageForEveryone(groupId, messageId, currentUserName, apiBaseUrl);
      syncGroupSnapshot(result.group);
      updateMessageCollections((messages) => mergeServerThreadMessage(messages, result.message));
      if (replyingToMessageId === messageId) {
        setReplyingToMessageId(null);
      }
      if (editingMessageId === messageId) {
        handleCancelEdit();
      }
    } catch {
      setError("تعذر حذف الرسالة للجميع حالياً.");
    }
  }

  async function handleDeleteForSelf(messageId: string) {
    if (!groupId) {
      return;
    }

    try {
      const result = await api.deleteCommunityMessageForSelf(groupId, messageId, apiBaseUrl);
      syncGroupSnapshot(result.group);
      updateMessageCollections((messages) => messages.filter((message) => message.id !== result.messageId));
      if (replyingToMessageId === messageId) {
        setReplyingToMessageId(null);
      }
      if (editingMessageId === messageId) {
        handleCancelEdit();
      }
    } catch {
      setError("تعذر حذف الرسالة من عرضك الحالي.");
    }
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    if (!groupId) {
      return;
    }

    try {
      const result = await api.toggleCommunityMessageReaction(groupId, messageId, emoji, apiBaseUrl);
      syncGroupSnapshot(result.group);
      updateMessageCollections((messages) => mergeServerThreadMessage(messages, result.message));
    } catch {
      setError("تعذر تحديث التفاعل حالياً.");
    }
  }

  async function handleTogglePinnedState(messageId: string, nextPinned: boolean) {
    if (!groupId) {
      return;
    }

    try {
      const result = nextPinned
        ? await api.pinCommunityMessage(groupId, messageId, apiBaseUrl)
        : await api.unpinCommunityMessage(groupId, messageId, apiBaseUrl);
      const pinnedMessageId = result.group.pinnedMessageId ?? null;
      syncGroupSnapshot(result.group, { pinnedMessageId });
      updateMessageCollections(
        (messages) => mergeServerThreadMessage(messages, result.message),
        { pinnedMessageId },
      );
    } catch {
      setError(nextPinned ? "تعذر تثبيت الرسالة حالياً." : "تعذر إلغاء تثبيت الرسالة حالياً.");
    }
  }

  async function refreshMembersOverview(targetGroupId: string) {
    if (!hasGroupPermission(threadRef.current?.actorPermissions, "community.members.view")) {
      return;
    }

    const payload = await api.getCommunityGroupMembers(targetGroupId, apiBaseUrl);
    setMembersOverview(payload);
  }

  async function handleRequestMembership(nextGroupId: string) {
    if (membershipActionGroupId) {
      return;
    }

    setMembershipActionGroupId(nextGroupId);
    setError("");

    try {
      const update = await api.requestCommunityGroupMembership(nextGroupId, apiBaseUrl);
      setGroups((prev) => prev.map((group) => applyMembershipUpdateToGroup(group, update)));
      setThread((prev) => applyMembershipUpdateToThread(prev, update));
    } catch {
      setError("تعذر تحديث حالة الانضمام حالياً.");
    } finally {
      setMembershipActionGroupId(null);
    }
  }

  async function handleAcceptInvitation(nextGroupId: string) {
    if (membershipActionGroupId) {
      return;
    }

    setMembershipActionGroupId(nextGroupId);
    setError("");

    try {
      const update = await api.acceptCommunityGroupInvitation(nextGroupId, apiBaseUrl);
      setGroups((prev) => prev.map((group) => applyMembershipUpdateToGroup(group, update)));
      setThread((prev) => applyMembershipUpdateToThread(prev, update));

      if (groupId !== nextGroupId) {
        persistListState(globalThis.scrollY);
        navigate(`/groups/${nextGroupId}`, {
          state: {
            communityListPath: listRoutePath,
          },
        });
      }
    } catch {
      setError("تعذر قبول الدعوة حالياً.");
    } finally {
      setMembershipActionGroupId(null);
    }
  }

  async function handleLeaveGroup() {
    if (!groupId || membershipActionGroupId) {
      return;
    }

    setMembershipActionGroupId(groupId);
    setError("");

    try {
      const update = await api.leaveCommunityGroup(groupId, apiBaseUrl);
      setGroups((prev) => prev.map((group) => applyMembershipUpdateToGroup(group, update)));
      setThread((prev) => applyMembershipUpdateToThread(prev, update));
      setMembersOverview(null);

      if (!canReadGroup({
        ...update.group,
        currentMembership: update.currentMembership,
        actorPermissions: update.actorPermissions,
      })) {
        setTypingUsers([]);
        setThread(null);
        navigate(listRoutePath);
      }
    } catch {
      setError("تعذر مغادرة المجموعة حالياً.");
    } finally {
      setMembershipActionGroupId(null);
    }
  }

  async function handleApproveMember(userId: string) {
    if (!groupId || memberReviewUserId) {
      return;
    }

    setMemberReviewUserId(userId);
    setError("");

    try {
      const update = await api.approveCommunityGroupMembership(groupId, userId, { reason: "تمت الموافقة من لوحة المجتمع" }, apiBaseUrl);
      setGroups((prev) => prev.map((group) => applyMembershipUpdateToGroup(group, update)));
      setThread((prev) => applyMembershipUpdateToThread(prev, update));
      await refreshMembersOverview(groupId);
    } catch {
      setError("تعذر اعتماد طلب الانضمام حالياً.");
    } finally {
      setMemberReviewUserId(null);
    }
  }

  async function handleRejectMember(userId: string) {
    if (!groupId || memberReviewUserId) {
      return;
    }

    setMemberReviewUserId(userId);
    setError("");

    try {
      const update = await api.rejectCommunityGroupMembership(groupId, userId, { reason: "لم تتم الموافقة على الطلب" }, apiBaseUrl);
      setGroups((prev) => prev.map((group) => applyMembershipUpdateToGroup(group, update)));
      setThread((prev) => applyMembershipUpdateToThread(prev, update));
      await refreshMembersOverview(groupId);
    } catch {
      setError("تعذر رفض الطلب حالياً.");
    } finally {
      setMemberReviewUserId(null);
    }
  }

  async function handleInviteMember(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupId || !inviteUserId.trim() || invitingMember) {
      return;
    }

    setInvitingMember(true);
    setError("");

    try {
      const overview = await api.inviteCommunityGroupMember(groupId, {
        invitedUserId: inviteUserId.trim(),
        note: inviteNote.trim() || undefined,
      }, apiBaseUrl);

      setMembersOverview(overview);
      setGroups((prev) => prev.map((group) => applyMembersOverviewToGroup(group, overview)));
      setThread((prev) => applyMembersOverviewToThread(prev, overview));
      setInviteUserId("");
      setInviteNote("");
    } catch {
      setError("تعذر إرسال الدعوة حالياً.");
    } finally {
      setInvitingMember(false);
    }
  }

  async function handleRevokeInvitation(userId: string) {
    if (!groupId || invitationActionUserId) {
      return;
    }

    setInvitationActionUserId(userId);
    setError("");

    try {
      const overview = await api.revokeCommunityGroupInvitation(groupId, userId, {
        reason: "تم سحب الدعوة من لوحة إدارة المجموعة",
      }, apiBaseUrl);

      setMembersOverview(overview);
      setGroups((prev) => prev.map((group) => applyMembersOverviewToGroup(group, overview)));
      setThread((prev) => applyMembersOverviewToThread(prev, overview));
    } catch {
      setError("تعذر سحب الدعوة حالياً.");
    } finally {
      setInvitationActionUserId(null);
    }
  }

  const handleCreateGroup = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      if (!isAdmin || !newGroupName.trim() || creatingGroup) return;

      setCreatingGroup(true);
      setError("");

      try {
        const group = await api.createCommunityGroup({
          name: newGroupName.trim(),
          description: newGroupDescription.trim() || undefined,
          category: newGroupCategory,
          isOfficial: true,
        }, apiBaseUrl);

        setGroups((prev) => [group, ...prev]);
        setNewGroupName("");
        setNewGroupDescription("");
        setNewGroupCategory("general");
        navigate(`/groups/${group.id}`);
      } catch {
        setError("تعذر إنشاء المجموعة حالياً.");
      } finally {
        setCreatingGroup(false);
      }
    })();
  };

  const handleSaveGroup = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      if (!canManageCurrentGroup || !groupId || !editGroupName.trim() || savingGroup) return;

      setSavingGroup(true);
      setError("");

      try {
        const updated = await api.updateCommunityGroup(groupId, {
          name: editGroupName.trim(),
          description: editGroupDescription.trim() || undefined,
        }, apiBaseUrl);

        setThread((prev) => prev ? { ...prev, group: { ...prev.group, ...updated } } : prev);
        setGroups((prev) => updateThreadGroupsAfterGroupSave(prev, updated));
      } catch {
        setError("تعذر حفظ بيانات المجموعة حالياً.");
      } finally {
        setSavingGroup(false);
      }
    })();
  };

  const handlePostAnnouncement = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      if (!canPublishCurrentAnnouncement || !groupId || !announcementBody.trim() || postingAnnouncement) return;

      setPostingAnnouncement(true);
      setError("");

      try {
        const clientRequestId = makeCommunityClientRequestId("community-announcement");
        const message = await api.postCommunityAnnouncement(groupId, {
          body: announcementBody.trim(),
          clientRequestId,
          senderName: currentUserName,
        }, apiBaseUrl);

        setThread((prev) => applyAnnouncementToThread(prev, message));

        setGroups((prev) => updateThreadGroupsAfterAnnouncement(prev, groupId, message));
        setAnnouncementBody("");
      } catch {
        setError("تعذر نشر الإعلان حالياً.");
      } finally {
        setPostingAnnouncement(false);
      }
    })();
  };

  const attachmentInputs = (
    <>
      <input
        ref={attachmentInputRef}
        className="community-thread-composer__file-input"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
        onChange={(event) => handleAttachmentSelection("attachment", event)}
      />
      <input
        ref={voiceAttachmentInputRef}
        className="community-thread-composer__file-input"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        accept="audio/*"
        onChange={(event) => handleAttachmentSelection("voice", event)}
      />
    </>
  );

  if (!groupId) {
    const highlightedSession = liveSessions[0] || null;
    return (
      <>
        {attachmentInputs}
        <CommunityOverviewScreen
          community={community}
          orderedGroups={orderedGroups}
          liveNowCount={liveNowCount}
          unreadGroupCount={unreadGroupCount}
          officialGroupCount={officialGroupCount}
          highlightedSession={highlightedSession}
          groupQuery={groupQuery}
          setGroupQuery={setGroupQuery}
          groupFilter={groupFilter}
          setGroupFilter={setGroupFilter}
          filteredGroups={filteredGroups}
          liveGroupIds={liveGroupIds}
          loadingOverview={loadingOverview}
          isAuthed={profile.isAuthed}
          isAdmin={isAdmin}
          newGroupName={newGroupName}
          newGroupDescription={newGroupDescription}
          newGroupCategory={newGroupCategory}
          setNewGroupName={setNewGroupName}
          setNewGroupDescription={setNewGroupDescription}
          setNewGroupCategory={setNewGroupCategory}
          creatingGroup={creatingGroup}
          onCreateGroup={handleCreateGroup}
          requestingMembershipGroupId={membershipActionGroupId}
          onRequestMembership={(nextGroupId) => void handleRequestMembership(nextGroupId)}
          onAcceptInvitation={(nextGroupId) => void handleAcceptInvitation(nextGroupId)}
          error={error}
          onOpenGroup={(nextGroupId) => {
            persistListState(globalThis.scrollY);
            navigate(`/groups/${nextGroupId}`, {
              state: {
                communityListPath: listRoutePath,
              },
            });
          }}
          onOpenHighlightedSession={(nextGroupId) => {
            if (!nextGroupId) {
              navigate(listRoutePath);
              return;
            }

            persistListState(globalThis.scrollY);
            navigate(`/groups/${nextGroupId}`, {
              state: {
                communityListPath: listRoutePath,
              },
            });
          }}
        />
      </>
    );
}

  return (
    <>
      {attachmentInputs}
      <CommunityThreadScreen
        thread={thread}
        displayedMessages={displayedMessages}
        apiBaseUrl={apiBaseUrl}
        activeLiveSession={activeLiveSession}
        pinnedMessage={pinnedMessage}
        loadingThread={loadingThread}
        loadingOlderMessages={loadingOlderMessages}
        loadingOlderError={loadingOlderError}
        canLoadOlderMessages={canLoadOlderMessages}
        firstUnreadMessageId={firstUnreadMessageId}
        threadSearchQuery={threadSearchQuery}
        threadSearchError={threadSearchError}
        searchingThreadMessages={searchingThreadMessages}
        onThreadSearchQueryChange={setThreadSearchQuery}
        visibleTypingUsers={visibleTypingUsers}
        editingMessage={editingMessage}
        replyingToMessage={replyingToMessage}
        composer={composer}
        pendingAttachment={pendingAttachment}
        mentionSuggestions={mentionSuggestions}
        setComposer={setComposer}
        onInsertMention={handleInsertMention}
        onPickAttachment={() => openAttachmentPicker("attachment")}
        onPickVoiceAttachment={() => openAttachmentPicker("voice")}
        onClearAttachment={clearPendingAttachment}
        pulseTyping={pulseTyping}
        sending={sending}
        canWriteToThread={canWriteCurrentThread}
        membershipActionPending={membershipActionGroupId === groupId}
        onRequestMembership={() => groupId ? void handleRequestMembership(groupId) : undefined}
        onAcceptInvitation={() => groupId ? void handleAcceptInvitation(groupId) : undefined}
        onLeaveGroup={() => void handleLeaveGroup()}
        membersOverview={membersOverview}
        loadingMembersOverview={loadingMembersOverview}
        memberReviewUserId={memberReviewUserId}
        inviteUserId={inviteUserId}
        setInviteUserId={setInviteUserId}
        inviteNote={inviteNote}
        setInviteNote={setInviteNote}
        invitingMember={invitingMember}
        invitationActionUserId={invitationActionUserId}
        onInviteMember={(event) => void handleInviteMember(event)}
        onApproveMember={(userId) => void handleApproveMember(userId)}
        onRejectMember={(userId) => void handleRejectMember(userId)}
        onRevokeInvitation={(userId) => void handleRevokeInvitation(userId)}
        onSendMessage={handleSendMessage}
        onLoadOlderMessages={() => void loadOlderMessages()}
        onStartEditMessage={handleStartEditMessage}
        onDeleteForEveryone={(messageId) => void handleDeleteForEveryone(messageId)}
        onDeleteForSelf={(messageId) => void handleDeleteForSelf(messageId)}
        onTogglePinnedState={(messageId, nextPinned) => void handleTogglePinnedState(messageId, nextPinned)}
        onToggleReaction={(messageId, emoji) => void handleToggleReaction(messageId, emoji)}
        onReplyToMessage={(messageId) => {
          setEditingMessageId(null);
          setReplyingToMessageId(messageId);
        }}
        onRetryMessage={(messageId) => void handleRetryMessage(messageId)}
        onCancelEdit={handleCancelEdit}
        onCancelReply={() => setReplyingToMessageId(null)}
        canDeleteMessage={canDeleteMessage}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        isAdmin={isAdmin}
        editGroupName={editGroupName}
        editGroupDescription={editGroupDescription}
        setEditGroupName={setEditGroupName}
        setEditGroupDescription={setEditGroupDescription}
        savingGroup={savingGroup}
        onSaveGroup={handleSaveGroup}
        announcementBody={announcementBody}
        setAnnouncementBody={setAnnouncementBody}
        postingAnnouncement={postingAnnouncement}
        onPostAnnouncement={handlePostAnnouncement}
        error={error}
        onGoBack={() => {
          persistListState(listScrollYRef.current);
          navigate(listRoutePath);
        }}
        messagesRef={messagesRef}
      />
    </>
  );

}






