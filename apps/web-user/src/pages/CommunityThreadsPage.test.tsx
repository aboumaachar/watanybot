/** @vitest-environment happy-dom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CommunityThreadsPage from "./CommunityThreadsPage";
import type { Community, CommunityGroup, CommunityGroupDetail, CommunityGroupMembersOverview, CommunityMessage, CommunityMessagesPage } from "../types/domain";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const {
  appState,
  getCommunityOverviewMock,
  getCommunityGroupMock,
  getCommunityGroupMessagesPageMock,
  searchCommunityGroupMessagesMock,
  getCommunityGroupMembersMock,
  requestCommunityGroupMembershipMock,
  getFeatureFlagsMock,
  markCommunityGroupReadMock,
  setCommunityGroupTypingMock,
  sendCommunityMessageMock,
  uploadCommunityAttachmentMock,
  fetchCommunityAttachmentAssetMock,
  createCommunityGroupMock,
  updateCommunityGroupMock,
  postCommunityAnnouncementMock,
  deleteCommunityMessageForEveryoneMock,
  deleteCommunityMessageForSelfMock,
  pinCommunityMessageMock,
  unpinCommunityMessageMock,
  toggleCommunityMessageReactionMock,
  editCommunityMessageMock,
  clipboardWriteTextMock,
  reliableSocketInstances,
  FakeReliableWebSocketClient,
  getAccessTokenMock,
  subscribeAuthStateChangeMock,
} = vi.hoisted(() => {
  type MockReliableSocketInstance = {
    sent: unknown[];
    connect: () => void;
    disconnect: (code?: number, reason?: string) => void;
    emitMessage: (payload: unknown) => void;
    emitClose: (code?: number, reason?: string) => void;
    isOpen: () => boolean;
  };
  const reliableSocketInstances = [] as MockReliableSocketInstance[];

  class FakeReliableWebSocketClient implements MockReliableSocketInstance {
    sent: unknown[] = [];
    private readonly options: Record<string, ((event?: any) => void) | undefined>;
    private state: "idle" | "connecting" | "open" | "closed" = "idle";

    constructor(_urlFactory: string | (() => string), options: Record<string, ((event?: any) => void) | undefined> = {}) {
      this.options = options;
      reliableSocketInstances.push(this);
    }

    connect() {
      this.state = "connecting";
      this.options.onStateChange?.("connecting");
      this.state = "open";
      this.options.onStateChange?.("open");
      this.options.onOpen?.(new Event("open"));
    }

    disconnect(code = 1000, reason = "") {
      this.state = "closed";
      this.options.onStateChange?.("closed");
      this.options.onClose?.({ code, reason });
    }

    send(data: string) {
      this.sent.push(JSON.parse(data));
      return true;
    }

    sendJSON(payload: unknown) {
      this.sent.push(payload);
      return true;
    }

    isOpen() {
      return this.state === "open";
    }

    emitMessage(payload: unknown) {
      this.options.onMessage?.({ data: JSON.stringify(payload) });
    }

    emitClose(code = 1006, reason = "") {
      this.disconnect(code, reason);
    }
  }

  return {
    appState: {
      apiBaseUrl: "http://api.test",
      profile: {
        id: "community-viewer-1",
        name: "الزائر",
        isAuthed: false,
      },
      hasRole: vi.fn(() => false),
    },
    getCommunityOverviewMock: vi.fn(),
    getCommunityGroupMock: vi.fn(),
    getCommunityGroupMessagesPageMock: vi.fn(),
    searchCommunityGroupMessagesMock: vi.fn(),
    getCommunityGroupMembersMock: vi.fn(),
    requestCommunityGroupMembershipMock: vi.fn(),
    getFeatureFlagsMock: vi.fn(),
    markCommunityGroupReadMock: vi.fn(),
    setCommunityGroupTypingMock: vi.fn(),
    sendCommunityMessageMock: vi.fn(),
    uploadCommunityAttachmentMock: vi.fn(),
    fetchCommunityAttachmentAssetMock: vi.fn(),
    createCommunityGroupMock: vi.fn(),
    updateCommunityGroupMock: vi.fn(),
    postCommunityAnnouncementMock: vi.fn(),
    deleteCommunityMessageForEveryoneMock: vi.fn(),
    deleteCommunityMessageForSelfMock: vi.fn(),
    pinCommunityMessageMock: vi.fn(),
    unpinCommunityMessageMock: vi.fn(),
    toggleCommunityMessageReactionMock: vi.fn(),
    editCommunityMessageMock: vi.fn(),
    clipboardWriteTextMock: vi.fn(),
    reliableSocketInstances,
    FakeReliableWebSocketClient,
    getAccessTokenMock: vi.fn(() => "test-access-token"),
    subscribeAuthStateChangeMock: vi.fn(() => () => undefined),
  };
});

vi.mock("../store/app", () => ({
  useApp: () => ({
    apiBaseUrl: appState.apiBaseUrl,
    profile: appState.profile,
    hasRole: appState.hasRole,
  }),
}));

vi.mock("../lib/api", () => ({
  api: {
    getCommunityOverview: getCommunityOverviewMock,
    getCommunityGroup: getCommunityGroupMock,
    getCommunityGroupMessagesPage: getCommunityGroupMessagesPageMock,
    searchCommunityGroupMessages: searchCommunityGroupMessagesMock,
    getCommunityGroupMembers: getCommunityGroupMembersMock,
    requestCommunityGroupMembership: requestCommunityGroupMembershipMock,
    getFeatureFlags: getFeatureFlagsMock,
    markCommunityGroupRead: markCommunityGroupReadMock,
    setCommunityGroupTyping: setCommunityGroupTypingMock,
    sendCommunityMessage: sendCommunityMessageMock,
    uploadCommunityAttachment: uploadCommunityAttachmentMock,
    fetchCommunityAttachmentAsset: fetchCommunityAttachmentAssetMock,
    createCommunityGroup: createCommunityGroupMock,
    updateCommunityGroup: updateCommunityGroupMock,
    postCommunityAnnouncement: postCommunityAnnouncementMock,
    deleteCommunityMessageForEveryone: deleteCommunityMessageForEveryoneMock,
    deleteCommunityMessageForSelf: deleteCommunityMessageForSelfMock,
    pinCommunityMessage: pinCommunityMessageMock,
    unpinCommunityMessage: unpinCommunityMessageMock,
    toggleCommunityMessageReaction: toggleCommunityMessageReactionMock,
    editCommunityMessage: editCommunityMessageMock,
  },
}));

vi.mock("../lib/auth", () => ({
  getAccessToken: getAccessTokenMock,
  subscribeAuthStateChange: subscribeAuthStateChangeMock,
}));

vi.mock("@watany/shared/reliable-websocket", () => ({
  ReliableWebSocketClient: FakeReliableWebSocketClient,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const baseCommunity: Community = {
  id: "watany-community",
  name: "مجتمع موطني",
  description: "مجتمع الدعم العام",
  createdAt: "2026-05-12T18:00:00.000Z",
};

const baseGroup: CommunityGroup = {
  id: "health-room",
  communityId: "watany-community",
  name: "غرفة الصحة",
  description: "متابعة الطبابة والتحويلات",
  category: "healthcare",
  memberCount: 42,
  unreadCount: 1,
  lastMessagePreview: "رسالة المتابعة الأخيرة",
  lastMessageAt: "2026-05-12T19:10:00.000Z",
  typingUsers: [],
};

function createMessage(id: string, createdAt: string, body: string): CommunityMessage {
  return {
    id,
    groupId: "health-room",
    senderId: "member-1",
    senderName: "عضو المجتمع",
    senderRole: "user",
    type: "text",
    body,
    createdAt,
  };
}

function createThreadDetail(overrides?: Partial<CommunityGroupDetail>): CommunityGroupDetail {
  return {
    community: baseCommunity,
    group: baseGroup,
    messages: [],
    liveSession: null,
    page: {
      requestedLimit: 30,
      oldestMessageId: undefined,
      newestMessageId: undefined,
      olderCursor: undefined,
      hasOlder: false,
    },
    readState: {
      unreadCount: 0,
      lastReadMessageId: undefined,
      lastReadAt: undefined,
    },
    ...overrides,
  };
}

function createMessagesPage(
  messages: CommunityMessage[],
  overrides?: Partial<CommunityMessagesPage>,
): CommunityMessagesPage {
  return {
    groupId: "health-room",
    messages,
    pageInfo: {
      hasMoreBefore: false,
      startCursor: null,
      endCursor: null,
    },
    latestSequence: null,
    readState: {
      unreadCount: 0,
      lastReadMessageId: null,
      lastReadAt: null,
    },
    ...overrides,
  };
}

function createWritableThreadDetail(overrides?: Partial<CommunityGroupDetail>): CommunityGroupDetail {
  const permissions = ["community.group.read", "community.group.write"] as const;
  return createThreadDetail({
    group: {
      ...baseGroup,
      currentMembership: {
        status: "active",
        role: "member",
        permissions: [...permissions],
      },
      actorPermissions: [...permissions],
    },
    currentMembership: {
      status: "active",
      role: "member",
      permissions: [...permissions],
    },
    actorPermissions: [...permissions],
    ...overrides,
  });
}

function createManagerThreadDetail(overrides?: Partial<CommunityGroupDetail>): CommunityGroupDetail {
  const permissions = ["community.group.read", "community.group.write", "community.members.view"] as const;
  return createThreadDetail({
    group: {
      ...baseGroup,
      currentMembership: {
        status: "active",
        role: "owner",
        permissions: [...permissions],
      },
      actorPermissions: [...permissions],
    },
    currentMembership: {
      status: "active",
      role: "owner",
      permissions: [...permissions],
    },
    actorPermissions: [...permissions],
    ...overrides,
  });
}

function createModeratedThreadDetail(overrides?: Partial<CommunityGroupDetail>): CommunityGroupDetail {
  const permissions = ["community.group.read", "community.group.write", "community.messages.moderate"] as const;
  return createThreadDetail({
    group: {
      ...baseGroup,
      currentMembership: {
        status: "active",
        role: "owner",
        permissions: [...permissions],
      },
      actorPermissions: [...permissions],
    },
    currentMembership: {
      status: "active",
      role: "owner",
      permissions: [...permissions],
    },
    actorPermissions: [...permissions],
    ...overrides,
  });
}

function createMembersOverview(): CommunityGroupMembersOverview {
  return {
    group: baseGroup,
    memberCount: 2,
    memberLimit: 100,
    currentMembership: {
      status: "active",
      role: "owner",
      permissions: ["community.group.read", "community.group.write", "community.members.view"],
    },
    actorPermissions: ["community.group.read", "community.group.write", "community.members.view"],
    membersByStatus: {
      active: [
        {
          id: "membership-1",
          groupId: "health-room",
          userId: "member-ahmad",
          displayName: "أحمد العضو",
          role: "member",
          status: "active",
          permissions: ["community.group.read", "community.group.write"],
          joinedAt: "2026-05-12T18:00:00.000Z",
        },
      ],
      pending: [],
      invited: [],
      muted: [],
      suspended: [],
      rejected: [],
      left: [],
      removed: [],
      banned: [],
    },
  };
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function getMessageIds(container: HTMLDivElement): string[] {
  return Array.from(container.querySelectorAll("[data-message-id]"))
    .map((element) => element instanceof HTMLElement ? element.dataset.messageId : null)
    .filter((value): value is string => Boolean(value));
}

function getLatestReliableSocket() {
  const socket = reliableSocketInstances.at(-1);
  expect(socket).toBeTruthy();
  return socket!;
}

async function flushEffects(times = 4) {
  await act(async () => {
    for (let index = 0; index < times; index += 1) {
      await Promise.resolve();
    }
  });
}

describe("CommunityThreadsPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getFeatureFlagsMock.mockResolvedValue({ flags: {}, lastUpdatedAt: null });
    getAccessTokenMock.mockReturnValue("test-access-token");
    subscribeAuthStateChangeMock.mockReturnValue(() => undefined);
    getCommunityGroupMembersMock.mockResolvedValue(createMembersOverview());
    requestCommunityGroupMembershipMock.mockResolvedValue({
      group: {
        ...baseGroup,
        currentMembership: {
          status: "pending",
          role: "member",
          permissions: ["community.group.read"],
        },
        actorPermissions: ["community.group.read"],
      },
      currentMembership: {
        status: "pending",
        role: "member",
        permissions: ["community.group.read"],
      },
      actorPermissions: ["community.group.read"],
    });
    markCommunityGroupReadMock.mockResolvedValue({
      ok: true,
      unreadCount: 0,
      lastReadMessageId: null,
      lastReadAt: null,
    });
    setCommunityGroupTypingMock.mockResolvedValue({ ok: true, typingUsers: [] });
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:community-attachment-1"),
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container?.isConnected) {
      container.remove();
    }

    appState.profile = {
      id: "community-viewer-1",
      name: "الزائر",
      isAuthed: false,
    };
    appState.hasRole.mockReset();
    appState.hasRole.mockReturnValue(false);

    getCommunityOverviewMock.mockReset();
    getCommunityGroupMock.mockReset();
    getCommunityGroupMessagesPageMock.mockReset();
    searchCommunityGroupMessagesMock.mockReset();
    getCommunityGroupMembersMock.mockReset();
    requestCommunityGroupMembershipMock.mockReset();
    getFeatureFlagsMock.mockReset();
    markCommunityGroupReadMock.mockReset();
    setCommunityGroupTypingMock.mockReset();
    sendCommunityMessageMock.mockReset();
    uploadCommunityAttachmentMock.mockReset();
    fetchCommunityAttachmentAssetMock.mockReset();
    createCommunityGroupMock.mockReset();
    updateCommunityGroupMock.mockReset();
    postCommunityAnnouncementMock.mockReset();
    deleteCommunityMessageForEveryoneMock.mockReset();
    deleteCommunityMessageForSelfMock.mockReset();
    pinCommunityMessageMock.mockReset();
    unpinCommunityMessageMock.mockReset();
    toggleCommunityMessageReactionMock.mockReset();
    editCommunityMessageMock.mockReset();
    clipboardWriteTextMock.mockReset();
    clipboardWriteTextMock.mockResolvedValue(undefined);
    getAccessTokenMock.mockReset();
    getAccessTokenMock.mockReturnValue("test-access-token");
    subscribeAuthStateChangeMock.mockReset();
    subscribeAuthStateChangeMock.mockReturnValue(() => undefined);
    reliableSocketInstances.splice(0, reliableSocketInstances.length);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteTextMock,
      },
    });

    getFeatureFlagsMock.mockResolvedValue({ flags: {}, lastUpdatedAt: null });
    getCommunityGroupMembersMock.mockResolvedValue(createMembersOverview());
    requestCommunityGroupMembershipMock.mockResolvedValue({
      group: {
        ...baseGroup,
        currentMembership: {
          status: "pending",
          role: "member",
          permissions: ["community.group.read"],
        },
        actorPermissions: ["community.group.read"],
      },
      currentMembership: {
        status: "pending",
        role: "member",
        permissions: ["community.group.read"],
      },
      actorPermissions: ["community.group.read"],
    });
  });

  async function renderThreadPage() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/groups/health-room"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/groups/:groupId" element={<CommunityThreadsPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    await flushEffects();
  }

  it("shows a rejoin CTA for left membership and issues one membership request", async () => {
    appState.profile = {
      id: "community-viewer-1",
      name: "viewer1",
      isAuthed: true,
    };

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createThreadDetail({
      group: {
        ...baseGroup,
        visibility: "public",
        currentMembership: {
          status: "left",
          role: "member",
          permissions: ["community.group.read"],
        },
        actorPermissions: ["community.group.read"],
      },
      currentMembership: {
        status: "left",
        role: "member",
        permissions: ["community.group.read"],
      },
      actorPermissions: ["community.group.read"],
    }));
    getCommunityGroupMessagesPageMock.mockResolvedValue(createMessagesPage([]));

    await renderThreadPage();

    const joinButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("انضم للمشاركة") || button.textContent?.includes("طلب الانضمام"),
    );
    expect(joinButton).toBeTruthy();

    if (!joinButton) {
      return;
    }

    await act(async () => {
      joinButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(6);

    expect(requestCommunityGroupMembershipMock).toHaveBeenCalledTimes(1);
    expect(requestCommunityGroupMembershipMock).toHaveBeenCalledWith("health-room", "http://api.test");
    expect(container.textContent).toContain("قيد المراجعة");

    const leaveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("مغادرة المجموعة"),
    );
    expect(leaveButton).toBeFalsy();
  });

  it("hydrates the thread from the additive messages route and preserves anonymous read state", async () => {
    const message2 = createMessage("health-msg-2", "2026-05-12T19:00:00.000Z", "رسالة ثانية");
    const message3 = createMessage("health-msg-3", "2026-05-12T19:10:00.000Z", "رسالة ثالثة");

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createThreadDetail());
    getCommunityGroupMessagesPageMock.mockResolvedValue(createMessagesPage([message2, message3], {
      pageInfo: {
        hasMoreBefore: true,
        startCursor: "cursor-health-msg-2",
        endCursor: "cursor-health-msg-3",
      },
      readState: {
        unreadCount: 1,
        lastReadMessageId: "health-msg-2",
        lastReadAt: "2026-05-12T19:00:00.000Z",
      },
    }));

    await renderThreadPage();

    expect(getCommunityOverviewMock).toHaveBeenCalledWith("http://api.test");
    expect(getCommunityGroupMock).toHaveBeenCalledWith("health-room", undefined, "http://api.test");
    expect(getCommunityGroupMessagesPageMock).toHaveBeenCalledWith(
      "health-room",
      { limit: 30 },
      "http://api.test",
    );
    expect(markCommunityGroupReadMock).not.toHaveBeenCalled();

    expect(container.textContent).toContain("غرفة الصحة");
    expect(container.textContent).toContain("رسالة ثانية");
    expect(container.textContent).toContain("رسالة ثالثة");
    expect(container.textContent).toContain("أول الرسائل غير المقروءة");

    const loadOlderButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("تحميل رسائل أقدم"));
    expect(loadOlderButton).toBeTruthy();
  });

  it("prepends older pages without duplicates and preserves the scroll anchor", async () => {
    const message1 = createMessage("health-msg-1", "2026-05-12T18:50:00.000Z", "رسالة أولى");
    const message2 = createMessage("health-msg-2", "2026-05-12T19:00:00.000Z", "رسالة ثانية");
    const message3 = createMessage("health-msg-3", "2026-05-12T19:10:00.000Z", "رسالة ثالثة");
    const olderPageDeferred = createDeferred<CommunityMessagesPage>();

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createThreadDetail());
    getCommunityGroupMessagesPageMock
      .mockResolvedValueOnce(createMessagesPage([message2, message3], {
        pageInfo: {
          hasMoreBefore: true,
          startCursor: "cursor-health-msg-2",
          endCursor: "cursor-health-msg-3",
        },
        readState: {
          unreadCount: 0,
          lastReadMessageId: null,
          lastReadAt: null,
        },
      }))
      .mockImplementationOnce(() => olderPageDeferred.promise);

    await renderThreadPage();

    const messagesContainer = container.querySelector("[data-chat-messages]") as HTMLElement | null;
    expect(messagesContainer).not.toBeNull();
    if (!messagesContainer) {
      return;
    }

    let currentScrollHeight = 500;
    Object.defineProperty(messagesContainer, "scrollHeight", {
      configurable: true,
      get: () => currentScrollHeight,
    });
    Object.defineProperty(messagesContainer, "scrollTo", {
      configurable: true,
      value: ({ top }: { top?: number }) => {
        messagesContainer.scrollTop = typeof top === "number" ? top : messagesContainer.scrollTop;
      },
    });

    messagesContainer.scrollTop = 120;

    const loadOlderButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("تحميل رسائل أقدم"));
    expect(loadOlderButton).toBeTruthy();

    await act(async () => {
      loadOlderButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    currentScrollHeight = 740;
    olderPageDeferred.resolve(createMessagesPage([message1, message2], {
      pageInfo: {
        hasMoreBefore: false,
        startCursor: null,
        endCursor: "cursor-health-msg-2",
      },
      readState: {
        unreadCount: 0,
        lastReadMessageId: null,
        lastReadAt: null,
      },
    }));

    await flushEffects(6);

    expect(getCommunityGroupMessagesPageMock).toHaveBeenNthCalledWith(
      2,
      "health-room",
      { before: "cursor-health-msg-2", limit: 30 },
      "http://api.test",
    );
    expect(getMessageIds(container)).toEqual(["health-msg-1", "health-msg-2", "health-msg-3"]);
    expect(messagesContainer.scrollTop).toBe(360);
    expect(container.textContent).not.toContain("جارٍ تحميل الرسائل الأقدم...");
    expect(container.textContent).not.toContain("تحميل رسائل أقدم");
  });

  it("subscribes with the latest sequence and appends realtime messages without a manual refresh", async () => {
    appState.profile = {
      id: "community-viewer-1",
      name: "viewer1",
      isAuthed: true,
    };

    const message2 = createMessage("health-msg-2", "2026-05-12T19:00:00.000Z", "رسالة ثانية");
    const message3 = createMessage("health-msg-3", "2026-05-12T19:10:00.000Z", "رسالة ثالثة");

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createThreadDetail({
      group: {
        ...baseGroup,
        currentMembership: {
          status: "active",
          role: "member",
          permissions: ["community.group.read", "community.group.write"],
        },
        actorPermissions: ["community.group.read", "community.group.write"],
      },
      currentMembership: {
        status: "active",
        role: "member",
        permissions: ["community.group.read", "community.group.write"],
      },
      actorPermissions: ["community.group.read", "community.group.write"],
    }));
    getCommunityGroupMessagesPageMock.mockResolvedValue(createMessagesPage([message2, message3], {
      latestSequence: "seq-health-3",
      pageInfo: {
        hasMoreBefore: false,
        startCursor: null,
        endCursor: "cursor-health-msg-3",
      },
      readState: {
        unreadCount: 0,
        lastReadMessageId: "health-msg-3",
        lastReadAt: "2026-05-12T19:10:00.000Z",
      },
    }));
    markCommunityGroupReadMock.mockResolvedValue({
      ok: true,
      unreadCount: 0,
      lastReadMessageId: "health-msg-3",
      lastReadAt: "2026-05-12T19:10:00.000Z",
    });

    await renderThreadPage();

    const socket = getLatestReliableSocket();
    expect(socket.sent[0]).toEqual({
      type: "community.subscribe",
      groupId: "health-room",
      since: "seq-health-3",
    });

    act(() => {
      socket.emitMessage({
        eventId: "evt-health-live-1",
        eventType: "community.message.created",
        occurredAt: "2026-05-12T19:20:00.000Z",
        groupId: "health-room",
        actorId: "member-2",
        messageId: "health-msg-4",
        sequence: "seq-health-4",
        payload: {
          clientRequestId: null,
          message: createMessage("health-msg-4", "2026-05-12T19:20:00.000Z", "رسالة وصلت عبر البث المباشر"),
        },
      });
    });
    await flushEffects(6);

    expect(container.textContent).toContain("رسالة وصلت عبر البث المباشر");
    expect(getMessageIds(container)).toEqual(["health-msg-2", "health-msg-3", "health-msg-4"]);
  });

  it("refreshes from the additive messages route when the websocket requests a resync", async () => {
    appState.profile = {
      id: "community-viewer-1",
      name: "viewer1",
      isAuthed: true,
    };

    const message2 = createMessage("health-msg-2", "2026-05-12T19:00:00.000Z", "رسالة ثانية");
    const message3 = createMessage("health-msg-3", "2026-05-12T19:10:00.000Z", "رسالة ثالثة");
    const message4 = createMessage("health-msg-4", "2026-05-12T19:20:00.000Z", "رسالة لحاق بعد إعادة الاتصال");

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createThreadDetail());
    getCommunityGroupMessagesPageMock
      .mockResolvedValueOnce(createMessagesPage([message2, message3], {
        latestSequence: "seq-health-3",
        pageInfo: {
          hasMoreBefore: false,
          startCursor: null,
          endCursor: "cursor-health-msg-3",
        },
        readState: {
          unreadCount: 0,
          lastReadMessageId: "health-msg-3",
          lastReadAt: "2026-05-12T19:10:00.000Z",
        },
      }))
      .mockResolvedValue(createMessagesPage([message2, message3, message4], {
        latestSequence: "seq-health-4",
        pageInfo: {
          hasMoreBefore: false,
          startCursor: null,
          endCursor: "cursor-health-msg-4",
        },
        readState: {
          unreadCount: 0,
          lastReadMessageId: "health-msg-4",
          lastReadAt: "2026-05-12T19:20:00.000Z",
        },
      }));
    markCommunityGroupReadMock.mockResolvedValue({
      ok: true,
      unreadCount: 0,
      lastReadMessageId: "health-msg-3",
      lastReadAt: "2026-05-12T19:10:00.000Z",
    });

    await renderThreadPage();

    const socket = getLatestReliableSocket();
    act(() => {
      socket.emitMessage({
        eventId: "evt-health-resync-1",
        eventType: "community.connection.resync_required",
        occurredAt: "2026-05-12T19:21:00.000Z",
        groupId: "health-room",
        actorId: "community-viewer-1",
        messageId: null,
        sequence: "seq-health-4",
        payload: {
          latestSequence: "seq-health-4",
          reason: "missed_events",
          pollingFallbackEnabled: true,
        },
      });
    });
    await flushEffects(8);

    expect(getCommunityGroupMessagesPageMock).toHaveBeenNthCalledWith(
      2,
      "health-room",
      { limit: 30 },
      "http://api.test",
    );
    expect(container.textContent).toContain("رسالة لحاق بعد إعادة الاتصال");
    expect(getMessageIds(container)).toEqual(["health-msg-2", "health-msg-3", "health-msg-4"]);
  });

  it("suppresses duplicates when the realtime echo matches an optimistic client request id", async () => {
    appState.profile = {
      id: "community-viewer-1",
      name: "viewer1",
      isAuthed: true,
    };

    const message2 = createMessage("health-msg-2", "2026-05-12T19:00:00.000Z", "رسالة ثانية");
    const message3 = createMessage("health-msg-3", "2026-05-12T19:10:00.000Z", "رسالة ثالثة");
    const sendDeferred = createDeferred<CommunityMessage>();

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createThreadDetail({
      group: {
        ...baseGroup,
        currentMembership: {
          status: "active",
          role: "member",
          permissions: ["community.group.read", "community.group.write"],
        },
        actorPermissions: ["community.group.read", "community.group.write"],
      },
      currentMembership: {
        status: "active",
        role: "member",
        permissions: ["community.group.read", "community.group.write"],
      },
      actorPermissions: ["community.group.read", "community.group.write"],
    }));
    getCommunityGroupMessagesPageMock.mockResolvedValue(createMessagesPage([message2, message3], {
      latestSequence: "seq-health-3",
      pageInfo: {
        hasMoreBefore: false,
        startCursor: null,
        endCursor: "cursor-health-msg-3",
      },
      readState: {
        unreadCount: 0,
        lastReadMessageId: "health-msg-3",
        lastReadAt: "2026-05-12T19:10:00.000Z",
      },
    }));
    markCommunityGroupReadMock.mockResolvedValue({
      ok: true,
      unreadCount: 0,
      lastReadMessageId: "health-msg-3",
      lastReadAt: "2026-05-12T19:10:00.000Z",
    });
    sendCommunityMessageMock.mockImplementation(() => sendDeferred.promise);

    await renderThreadPage();

    const textarea = container.querySelector("textarea[aria-label='اكتب رسالتك للمجموعة']") as HTMLTextAreaElement | null;
    const composerForm = container.querySelector("form[data-chat-composer]") as HTMLFormElement | null;
    const submitButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("إرسال"));
    expect(textarea).not.toBeNull();
    expect(composerForm).not.toBeNull();
    expect(submitButton).toBeTruthy();
    if (!textarea || !composerForm || !submitButton) {
      return;
    }

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      valueSetter?.call(textarea, "رسالة متفائلة");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      submitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    const optimisticClientRequestId = sendCommunityMessageMock.mock.calls[0]?.[1]?.clientRequestId as string | undefined;
    expect(optimisticClientRequestId).toBeTruthy();

    const socket = getLatestReliableSocket();
    act(() => {
      socket.emitMessage({
        eventId: "evt-health-echo-1",
        eventType: "community.message.created",
        occurredAt: "2026-05-12T19:30:00.000Z",
        groupId: "health-room",
        actorId: "community-viewer-1",
        messageId: "health-msg-optimistic-1",
        sequence: "seq-health-5",
        payload: {
          clientRequestId: optimisticClientRequestId,
          message: {
            id: "health-msg-optimistic-1",
            groupId: "health-room",
            senderId: "community-viewer-1",
            senderName: "viewer1",
            senderRole: "user",
            type: "text",
            body: "رسالة متفائلة",
            createdAt: "2026-05-12T19:30:00.000Z",
          },
        },
      });
    });

    sendDeferred.resolve({
      id: "health-msg-optimistic-1",
      groupId: "health-room",
      senderId: "community-viewer-1",
      senderName: "viewer1",
      senderRole: "user",
      type: "text",
      body: "رسالة متفائلة",
      createdAt: "2026-05-12T19:30:00.000Z",
    });
    await flushEffects(8);

    expect(getMessageIds(container).filter((id) => id === "health-msg-optimistic-1")).toHaveLength(1);
    expect(container.textContent?.match(/رسالة متفائلة/g)?.length).toBe(1);
  });

  it("fetches protected attachment assets for rendered thread messages", async () => {
    const attachmentMessage: CommunityMessage = {
      id: "health-attachment-1",
      groupId: "health-room",
      senderId: "member-1",
      senderName: "عضو المجتمع",
      senderRole: "user",
      type: "attachment",
      body: "مرفق محمي",
      attachmentUrl: "/api/community/attachments/health-attachment-1/asset",
      createdAt: "2026-05-12T19:15:00.000Z",
    };

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createThreadDetail());
    getCommunityGroupMessagesPageMock.mockResolvedValue(createMessagesPage([attachmentMessage]));
    fetchCommunityAttachmentAssetMock.mockResolvedValue({
      blob: new Blob(["image"], { type: "image/png" }),
      contentType: "image/png",
      fileName: "scan-result.png",
    });

    await renderThreadPage();
    await flushEffects(8);

    expect(fetchCommunityAttachmentAssetMock).toHaveBeenCalledWith(
      "/api/community/attachments/health-attachment-1/asset",
      "http://api.test",
    );
    expect(container.textContent).toContain("scan-result.png");
    expect(container.querySelector("img[alt='scan-result.png']")).not.toBeNull();
  });

  it("uploads protected attachments through the attachment route", async () => {
    appState.profile = {
      id: "community-viewer-1",
      name: "viewer1",
      isAuthed: true,
    };

    const uploadedMessage: CommunityMessage = {
      id: "health-attachment-uploaded",
      groupId: "health-room",
      senderId: "community-viewer-1",
      senderName: "viewer1",
      senderRole: "user",
      type: "attachment",
      body: "تم رفع الملف",
      attachmentUrl: "/api/community/attachments/health-attachment-uploaded/asset",
      createdAt: "2026-05-12T19:40:00.000Z",
    };

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createWritableThreadDetail());
    getCommunityGroupMessagesPageMock.mockResolvedValue(createMessagesPage([]));
    uploadCommunityAttachmentMock.mockResolvedValue({
      ok: true,
      message: uploadedMessage,
      attachment: {
        id: "attachment-row-1",
        groupId: "health-room",
        messageId: "health-attachment-uploaded",
        originalName: "scan.png",
        mimeType: "image/png",
        size: 2048,
        sha256: "abc123",
        createdAt: "2026-05-12T19:40:00.000Z",
        attachmentUrl: "/api/community/attachments/health-attachment-uploaded/asset",
      },
    });
    fetchCommunityAttachmentAssetMock.mockResolvedValue({
      blob: new Blob(["image"], { type: "image/png" }),
      contentType: "image/png",
      fileName: "scan.png",
    });

    await renderThreadPage();

    const attachmentInput = container.querySelector("input[type='file'][accept*='.pdf']") as HTMLInputElement | null;
    const submitButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("إرسال"));
    expect(attachmentInput).not.toBeNull();
    expect(submitButton).toBeTruthy();
    if (!attachmentInput || !submitButton) {
      return;
    }

    const file = new File(["image"], "scan.png", { type: "image/png" });
    Object.defineProperty(attachmentInput, "files", {
      configurable: true,
      value: [file],
    });

    await act(async () => {
      attachmentInput.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("scan.png");

    await act(async () => {
      submitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(8);

    expect(uploadCommunityAttachmentMock).toHaveBeenCalledWith(
      "health-room",
      expect.objectContaining({
        file,
        type: "attachment",
      }),
      "http://api.test",
    );
    expect(container.textContent).toContain("تم رفع الملف");
  });

  it("deduplicates uploaded voice messages when the realtime echo arrives with the same server id", async () => {
    appState.profile = {
      id: "community-viewer-1",
      name: "viewer1",
      isAuthed: true,
    };

    const uploadedVoiceMessage: CommunityMessage = {
      id: "health-voice-uploaded",
      groupId: "health-room",
      senderId: "community-viewer-1",
      senderName: "viewer1",
      senderRole: "user",
      type: "voice",
      attachmentUrl: "/api/community/attachments/health-voice-uploaded/asset",
      createdAt: "2026-05-12T19:41:00.000Z",
    };

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createWritableThreadDetail());
    getCommunityGroupMessagesPageMock.mockResolvedValue(createMessagesPage([], {
      latestSequence: "seq-health-0",
    }));
    uploadCommunityAttachmentMock.mockResolvedValue({
      ok: true,
      message: uploadedVoiceMessage,
      attachment: {
        id: "attachment-row-voice-1",
        groupId: "health-room",
        messageId: "health-voice-uploaded",
        originalName: "voice.mp3",
        mimeType: "audio/mpeg",
        size: 2048,
        sha256: "voice123",
        createdAt: "2026-05-12T19:41:00.000Z",
        attachmentUrl: "/api/community/attachments/health-voice-uploaded/asset",
      },
    });
    fetchCommunityAttachmentAssetMock.mockResolvedValue({
      blob: new Blob(["audio"], { type: "audio/mpeg" }),
      contentType: "audio/mpeg",
      fileName: "voice.mp3",
    });

    await renderThreadPage();

    const voiceInput = container.querySelector("input[type='file'][accept='audio/*']") as HTMLInputElement | null;
    const submitButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("إرسال"));
    expect(voiceInput).not.toBeNull();
    expect(submitButton).toBeTruthy();
    if (!voiceInput || !submitButton) {
      return;
    }

    const file = new File(["audio"], "voice.mp3", { type: "audio/mpeg" });
    Object.defineProperty(voiceInput, "files", {
      configurable: true,
      value: [file],
    });

    await act(async () => {
      voiceInput.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      submitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(8);

    const socket = getLatestReliableSocket();
    act(() => {
      socket.emitMessage({
        eventId: "evt-health-voice-echo-1",
        eventType: "community.message.created",
        occurredAt: "2026-05-12T19:41:00.000Z",
        groupId: "health-room",
        actorId: "community-viewer-1",
        messageId: "health-voice-uploaded",
        sequence: "seq-health-1",
        payload: {
          message: uploadedVoiceMessage,
        },
      });
    });
    await flushEffects(8);

    expect(getMessageIds(container).filter((id) => id === "health-voice-uploaded")).toHaveLength(1);
  });

  it("shows mention suggestions and searches within the active thread", async () => {
    appState.profile = {
      id: "community-viewer-1",
      name: "viewer1",
      isAuthed: true,
    };

    const message2 = createMessage("health-msg-2", "2026-05-12T19:00:00.000Z", "رسالة عامة");
    const message3 = createMessage("health-msg-3", "2026-05-12T19:10:00.000Z", "متابعة خاصة");

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createManagerThreadDetail());
    getCommunityGroupMessagesPageMock
      .mockResolvedValueOnce(createMessagesPage([message2, message3]));
    searchCommunityGroupMessagesMock.mockResolvedValueOnce(createMessagesPage([message3]));

    await renderThreadPage();
    await flushEffects(8);

    expect(getCommunityGroupMembersMock).toHaveBeenCalledWith("health-room", "http://api.test");

    const textarea = container.querySelector("textarea[aria-label='اكتب رسالتك للمجموعة']") as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    if (!textarea) {
      return;
    }

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      valueSetter?.call(textarea, "مرحباً @أح");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(4);

    const mentionButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("@أحمد_العضو"));
    expect(mentionButton).toBeTruthy();
    if (!mentionButton) {
      return;
    }

    await act(async () => {
      mentionButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(textarea.value).toContain("@أحمد_العضو ");

    const searchInput = container.querySelector("input[aria-label='ابحث داخل هذه المحادثة']") as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();
    if (!searchInput) {
      return;
    }

    vi.useFakeTimers();
    try {
      await act(async () => {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        valueSetter?.call(searchInput, "متابعة");
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });
      await flushEffects(6);
    } finally {
      vi.useRealTimers();
    }

    expect(searchCommunityGroupMessagesMock).toHaveBeenNthCalledWith(
      1,
      "health-room",
      { limit: 80, query: "متابعة" },
      "http://api.test",
    );
    expect(container.textContent).toContain("1 نتيجة");
    expect(container.textContent).toContain("متابعة خاصة");
  });

  it("edits messages, toggles reactions, and removes them with delete-for-self", async () => {
    appState.profile = {
      id: "community-viewer-1",
      name: "viewer1",
      isAuthed: true,
    };

    const ownMessage: CommunityMessage = {
      id: "health-msg-own-1",
      groupId: "health-room",
      senderId: "community-viewer-1",
      senderName: "viewer1",
      senderRole: "user",
      type: "text",
      body: "النص الأصلي",
      createdAt: "2026-05-12T19:45:00.000Z",
    };
    const editedMessage: CommunityMessage = {
      ...ownMessage,
      body: "النص المعدل",
      editedAt: "2026-05-12T19:46:00.000Z",
    };
    const reactedMessage: CommunityMessage = {
      ...editedMessage,
      reactions: [{ emoji: "👍", count: 1, reactedByMe: true }],
    };

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createWritableThreadDetail());
    getCommunityGroupMessagesPageMock.mockResolvedValue(createMessagesPage([ownMessage]));
    editCommunityMessageMock.mockResolvedValue({ message: editedMessage, group: baseGroup });
    toggleCommunityMessageReactionMock.mockResolvedValue({ message: reactedMessage, group: baseGroup });
    deleteCommunityMessageForSelfMock.mockResolvedValue({
      messageId: ownMessage.id,
      deletedForMeAt: "2026-05-12T19:47:00.000Z",
      group: baseGroup,
    });

    await renderThreadPage();

    const editButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("تعديل"));
    expect(editButton).toBeTruthy();
    if (!editButton) {
      return;
    }

    await act(async () => {
      editButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    const textarea = container.querySelector("textarea[aria-label='اكتب رسالتك للمجموعة']") as HTMLTextAreaElement | null;
    const saveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("حفظ التعديل"));
    expect(textarea).not.toBeNull();
    expect(saveButton).toBeTruthy();
    if (!textarea || !saveButton) {
      return;
    }

    expect(textarea.value).toBe("النص الأصلي");

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      valueSetter?.call(textarea, "النص المعدل");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(6);

    expect(editCommunityMessageMock).toHaveBeenCalledWith(
      "health-room",
      "health-msg-own-1",
      "النص المعدل",
      "http://api.test",
    );
    expect(container.textContent).toContain("النص المعدل");
    expect(container.textContent).toContain("معدلة");

    const reactionButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("👍"));
    expect(reactionButton).toBeTruthy();
    if (!reactionButton) {
      return;
    }

    await act(async () => {
      reactionButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(4);

    expect(toggleCommunityMessageReactionMock).toHaveBeenCalledWith(
      "health-room",
      "health-msg-own-1",
      "👍",
      "http://api.test",
    );
    expect(reactionButton.textContent).toContain("1");

    const deleteForSelfButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("حذف لدي"));
    expect(deleteForSelfButton).toBeTruthy();
    if (!deleteForSelfButton) {
      return;
    }

    await act(async () => {
      deleteForSelfButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(4);

    expect(deleteCommunityMessageForSelfMock).toHaveBeenCalledWith(
      "health-room",
      "health-msg-own-1",
      "http://api.test",
    );
    expect(container.textContent).not.toContain("النص المعدل");
  });

  it("pins and unpins moderated messages from the thread action bar", async () => {
    appState.profile = {
      id: "community-admin-1",
      name: "مشرف المجتمع",
      isAuthed: true,
    };

    const firstMessage: CommunityMessage = {
      id: "health-msg-pin-1",
      groupId: "health-room",
      senderId: "member-1",
      senderName: "عضو أول",
      senderRole: "user",
      type: "text",
      body: "رسالة قابلة للتثبيت",
      createdAt: "2026-05-12T19:40:00.000Z",
    };
    const secondMessage: CommunityMessage = {
      id: "health-msg-pin-2",
      groupId: "health-room",
      senderId: "member-2",
      senderName: "عضو ثانٍ",
      senderRole: "user",
      type: "text",
      body: "رسالة أخرى",
      createdAt: "2026-05-12T19:45:00.000Z",
    };

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createModeratedThreadDetail());
    getCommunityGroupMessagesPageMock.mockResolvedValue(createMessagesPage([firstMessage, secondMessage]));
    pinCommunityMessageMock.mockResolvedValue({
      message: {
        ...firstMessage,
        isPinned: true,
      },
      group: {
        ...baseGroup,
        pinnedMessageId: firstMessage.id,
      },
    });
    unpinCommunityMessageMock.mockResolvedValue({
      message: {
        ...firstMessage,
        isPinned: false,
      },
      group: {
        ...baseGroup,
      },
    });

    await renderThreadPage();

    const pinButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("تثبيت"));
    expect(pinButton).toBeTruthy();
    if (!pinButton) {
      return;
    }

    await act(async () => {
      pinButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(6);

    expect(pinCommunityMessageMock).toHaveBeenCalledWith(
      "health-room",
      "health-msg-pin-1",
      "http://api.test",
    );
    expect(container.querySelector(".community-thread-pinned")?.textContent).toContain("رسالة قابلة للتثبيت");

    const unpinButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("إلغاء التثبيت"));
    expect(unpinButton).toBeTruthy();
    if (!unpinButton) {
      return;
    }

    await act(async () => {
      unpinButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(6);

    expect(unpinCommunityMessageMock).toHaveBeenCalledWith(
      "health-room",
      "health-msg-pin-1",
      "http://api.test",
    );
    expect(container.querySelector(".community-thread-pinned")).toBeNull();
  });

  it("copies visible message text and hides copy for tombstones", async () => {
    appState.profile = {
      id: "community-viewer-1",
      name: "viewer1",
      isAuthed: true,
    };

    const copyableMessage: CommunityMessage = {
      id: "health-msg-copy-1",
      groupId: "health-room",
      senderId: "community-viewer-1",
      senderName: "viewer1",
      senderRole: "user",
      type: "text",
      body: "موعد meeting 123",
      createdAt: "2026-05-12T19:48:00.000Z",
    };
    const tombstoneMessage: CommunityMessage = {
      id: "health-msg-copy-2",
      groupId: "health-room",
      senderId: "member-2",
      senderName: "عضو آخر",
      senderRole: "user",
      type: "text",
      body: "محتوى يجب ألا يُنسخ",
      createdAt: "2026-05-12T19:50:00.000Z",
      deletedForEveryoneAt: "2026-05-12T19:55:00.000Z",
      deletedForEveryoneBy: "مشرف المجتمع",
    };

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createWritableThreadDetail());
    getCommunityGroupMessagesPageMock.mockResolvedValue(createMessagesPage([copyableMessage, tombstoneMessage]));

    await renderThreadPage();

    const copyButtons = Array.from(container.querySelectorAll("button")).filter((button) => button.textContent?.includes("نسخ"));
    expect(copyButtons).toHaveLength(1);

    const copyButton = copyButtons[0];
    await act(async () => {
      copyButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(4);

    expect(clipboardWriteTextMock).toHaveBeenCalledWith("موعد meeting 123");
    expect(copyButton.textContent).toContain("تم النسخ");
    expect(container.textContent).toContain("تم حذف هذه الرسالة للجميع");
  });

  it("falls back to refreshing messages when realtime transport becomes unavailable", async () => {
    appState.profile = {
      id: "community-viewer-1",
      name: "viewer1",
      isAuthed: true,
    };

    const message2 = createMessage("health-msg-2", "2026-05-12T19:00:00.000Z", "رسالة ثانية");
    const message3 = createMessage("health-msg-3", "2026-05-12T19:10:00.000Z", "رسالة ثالثة");
    const message4 = createMessage("health-msg-4", "2026-05-12T19:25:00.000Z", "رسالة عبر مسار الاسترجاع الاحتياطي");

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createThreadDetail());
    getCommunityGroupMessagesPageMock
      .mockResolvedValueOnce(createMessagesPage([message2, message3], {
        latestSequence: "seq-health-3",
        pageInfo: {
          hasMoreBefore: false,
          startCursor: null,
          endCursor: "cursor-health-msg-3",
        },
        readState: {
          unreadCount: 0,
          lastReadMessageId: "health-msg-3",
          lastReadAt: "2026-05-12T19:10:00.000Z",
        },
      }))
      .mockResolvedValue(createMessagesPage([message2, message3, message4], {
        latestSequence: "seq-health-4",
        pageInfo: {
          hasMoreBefore: false,
          startCursor: null,
          endCursor: "cursor-health-msg-4",
        },
        readState: {
          unreadCount: 0,
          lastReadMessageId: "health-msg-4",
          lastReadAt: "2026-05-12T19:25:00.000Z",
        },
      }));
    markCommunityGroupReadMock.mockResolvedValue({
      ok: true,
      unreadCount: 0,
      lastReadMessageId: "health-msg-3",
      lastReadAt: "2026-05-12T19:10:00.000Z",
    });

    await renderThreadPage();

    const socket = getLatestReliableSocket();
    act(() => {
      socket.emitClose(4004, "Community realtime disabled");
    });
    await flushEffects(8);

    expect(getCommunityGroupMessagesPageMock).toHaveBeenNthCalledWith(
      2,
      "health-room",
      { limit: 30 },
      "http://api.test",
    );
    expect(container.textContent).toContain("رسالة عبر مسار الاسترجاع الاحتياطي");
  });

  it("stops fallback refresh and shows revoked access when the realtime channel closes with 4003", async () => {
    appState.profile = {
      id: "community-viewer-1",
      name: "viewer1",
      isAuthed: true,
    };

    const message2 = createMessage("health-msg-2", "2026-05-12T19:00:00.000Z", "رسالة ثانية");
    const message3 = createMessage("health-msg-3", "2026-05-12T19:10:00.000Z", "رسالة ثالثة");

    getCommunityOverviewMock.mockResolvedValue({
      community: baseCommunity,
      groups: [baseGroup],
      liveSessions: [],
    });
    getCommunityGroupMock.mockResolvedValue(createThreadDetail());
    getCommunityGroupMessagesPageMock.mockResolvedValue(createMessagesPage([message2, message3], {
      latestSequence: "seq-health-3",
      pageInfo: {
        hasMoreBefore: false,
        startCursor: null,
        endCursor: "cursor-health-msg-3",
      },
      readState: {
        unreadCount: 0,
        lastReadMessageId: "health-msg-3",
        lastReadAt: "2026-05-12T19:10:00.000Z",
      },
    }));
    markCommunityGroupReadMock.mockResolvedValue({
      ok: true,
      unreadCount: 0,
      lastReadMessageId: "health-msg-3",
      lastReadAt: "2026-05-12T19:10:00.000Z",
    });

    await renderThreadPage();

    const socket = getLatestReliableSocket();
    act(() => {
      socket.emitClose(4003, "community_authorization_revoked");
    });
    await flushEffects(8);

    expect(getCommunityGroupMessagesPageMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("لم تعد لديك صلاحية الوصول إلى هذه المجموعة.");
  });
});