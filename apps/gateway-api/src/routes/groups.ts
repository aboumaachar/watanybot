import type { FastifyPluginAsync } from "fastify";

/* ── Types ─────────────────────────────────────────────────── */
interface GroupMember {
  id: string;
  name: string;
  avatar?: string;
  role: "admin" | "moderator" | "member";
  joinedAt: number;
  isMuted?: boolean;
  mutedUntil?: number;
  status: "active" | "warned" | "suspended" | "banned";
  warningCount: number;
  suspendedUntil?: number;
  lastViolation?: { reason: string; date: number };
}

interface GroupReply {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: number;
  attachments?: GroupAttachment[];
  seenBy?: string[];
  isPinned?: boolean;
}

interface GroupAttachment {
  id: string;
  type: "image" | "file" | "audio" | "video";
  url: string;
  name: string;
  size?: number;
  duration?: number;
}

interface GroupPost {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: number;
  reactions: Record<string, number>;
  replies: GroupReply[];
  attachments?: GroupAttachment[];
  seenBy?: string[];
  isPinned?: boolean;
  deletedForEveryoneAt?: number;
  deletedByName?: string;
  forwardedFrom?: {
    groupId: string;
    groupName: string;
    postId: string;
    authorName: string;
  };
}

interface Group {
  id: string;
  name: string;
  icon: string;
  description: string;
  members: GroupMember[];
  posts: GroupPost[];
  createdAt: number;
  unreadCount?: number;
  pinnedPostIds?: string[];
  typingUsers?: string[];
  settings?: { muted: boolean; notification: "all" | "mentions" | "none" };
}

/* ── In-memory store with seed data ───────────────────────── */
const groupsStore: Group[] = [
  {
    id: "group_1",
    name: "المحاربون القدامى",
    icon: "ph-fill ph-users",
    description: "مجموعة تعاون ودعم بين المحاربين القدامى",
    createdAt: Date.now() - 90 * 86400000,
    unreadCount: 3,
    pinnedPostIds: [],
    members: [
      { id: "user_1", name: "أحمد علي", role: "admin", joinedAt: Date.now() - 90 * 86400000, status: "active", warningCount: 0 },
      { id: "user_2", name: "محمد سالم", role: "moderator", joinedAt: Date.now() - 60 * 86400000, status: "active", warningCount: 0 },
      { id: "user_3", name: "علي حسن", role: "member", joinedAt: Date.now() - 30 * 86400000, status: "active", warningCount: 0 },
    ],
    posts: [
      {
        id: "post_1",
        authorId: "user_1",
        authorName: "أحمد علي",
        content: "مرحباً بالجميع! تم إنشاء هذه المجموعة لتبادل الخبرات والتجارب بين المتقاعدين العسكريين.",
        createdAt: Date.now() - 5 * 86400000,
        reactions: { "❤️": 8, "👍": 12, "👏": 5 },
        replies: [
          { id: "reply_1", authorId: "user_2", authorName: "محمد سالم", content: "فكرة رائعة! أتطلع للتواصل مع الجميع.", createdAt: Date.now() - 4 * 86400000 },
          { id: "reply_2", authorId: "user_3", authorName: "علي حسن", content: "شكراً على المبادرة. هذا سيكون مفيداً جداً.", createdAt: Date.now() - 3 * 86400000 },
        ],
      },
      {
        id: "post_2",
        authorId: "user_2",
        authorName: "محمد سالم",
        content: "من لديه معلومات عن برامج المساعدة الاجتماعية الجديدة؟ أود التعرف على التفاصيل الكاملة.",
        createdAt: Date.now() - 2 * 86400000,
        reactions: { "👍": 6, "💡": 4 },
        replies: [
          { id: "reply_3", authorId: "user_1", authorName: "أحمد علي", content: "يمكنك الاطلاع على القسم الخاص في التطبيق. سأرسل لك الرابط.", createdAt: Date.now() - 86400000 },
        ],
      },
      {
        id: "post_3",
        authorId: "user_3",
        authorName: "علي حسن",
        content: "اليوم اكتملت 20 سنة خدمة! شكراً لدعمكم جميعاً في هذه الرحلة الرائعة.",
        createdAt: Date.now() - 6 * 3600000,
        reactions: { "🎉": 15, "❤️": 20, "👏": 18 },
        replies: [
          { id: "reply_4", authorId: "user_1", authorName: "أحمد علي", content: "مبروك يا علي! تستحق كل خير.", createdAt: Date.now() - 4 * 3600000 },
          { id: "reply_5", authorId: "user_2", authorName: "محمد سالم", content: "تهانينا! ألف مبروك.", createdAt: Date.now() - 3 * 3600000 },
        ],
      },
    ],
  },
  {
    id: "group_2",
    name: "فرص العمل والتوظيف",
    icon: "ph-fill ph-briefcase",
    description: "مشاركة فرص العمل والتطوير الوظيفي للمتقاعدين",
    createdAt: Date.now() - 60 * 86400000,
    unreadCount: 1,
    pinnedPostIds: [],
    members: [
      { id: "user_4", name: "فاطمة أحمد", role: "admin", joinedAt: Date.now() - 60 * 86400000, status: "active", warningCount: 0 },
      { id: "user_5", name: "سارة محمود", role: "moderator", joinedAt: Date.now() - 40 * 86400000, status: "active", warningCount: 0 },
    ],
    posts: [
      {
        id: "post_4",
        authorId: "user_4",
        authorName: "فاطمة أحمد",
        content: "📢 فرصة عمل جديدة: شركة استشارات تبحث عن مدير مشاريع بخبرة 15+ سنة. المزايا ممتازة! من المهتم؟",
        createdAt: Date.now() - 86400000,
        reactions: { "👍": 8, "😊": 5 },
        replies: [],
      },
    ],
  },
  {
    id: "group_3",
    name: "النقاشات القانونية",
    icon: "ph-fill ph-scales",
    description: "مناقشة القضايا والاستفسارات القانونية",
    createdAt: Date.now() - 45 * 86400000,
    pinnedPostIds: [],
    members: [
      { id: "user_5", name: "د. محمود سليم", role: "admin", joinedAt: Date.now() - 45 * 86400000, status: "active", warningCount: 0 },
      { id: "user_6", name: "أ. نور الدين", role: "moderator", joinedAt: Date.now() - 30 * 86400000, status: "active", warningCount: 0 },
    ],
    posts: [
      {
        id: "post_5",
        authorId: "user_5",
        authorName: "د. محمود سليم",
        content: "سؤال: ما هي حقوق ذوي العسكري المتوفى؟ هل هناك فروقات حسب الرتبة؟",
        createdAt: Date.now() - 12 * 3600000,
        reactions: { "💡": 3, "👍": 2 },
        replies: [],
      },
    ],
  },
];

/* ── Helpers ───────────────────────────────────────────────── */
let idCounter = 1000;
function gid(prefix: string) {
  return `${prefix}_${(++idCounter).toString(36)}_${Date.now().toString(36)}`;
}

function findGroup(id: string) {
  return groupsStore.find((g) => g.id === id);
}

function findPost(group: Group, postId: string) {
  return group.posts.find((p) => p.id === postId);
}

function findMember(group: Group, memberId: string) {
  return group.members.find((m) => m.id === memberId);
}

function ensureSeenBy<T extends { seenBy?: string[] }>(item: T, userId: string): T {
  const seenBy = item.seenBy || [];
  if (seenBy.includes(userId)) return item;
  return {
    ...item,
    seenBy: [...seenBy, userId],
  };
}

function markGroupMessagesRead(group: Group, userId: string): Group {
  return {
    ...group,
    unreadCount: 0,
    posts: group.posts.map((post) => ({
      ...ensureSeenBy(post, userId),
      replies: post.replies.map((reply) => ensureSeenBy(reply, userId)),
    })),
  };
}

function markPostDeletedForEveryone(post: GroupPost, deletedByName: string): GroupPost {
  return {
    ...post,
    content: "تم حذف هذه الرسالة للجميع.",
    attachments: undefined,
    reactions: {},
    isPinned: false,
    deletedForEveryoneAt: Date.now(),
    deletedByName,
    forwardedFrom: undefined,
  };
}

export function resetGroupsStore(): void {
  groupsStore.splice(0, groupsStore.length,
    {
      id: "group_1",
      name: "المحاربون القدامى",
      icon: "ph-fill ph-users",
      description: "مجموعة تعاون ودعم بين المحاربين القدامى",
      createdAt: Date.now() - 90 * 86400000,
      unreadCount: 3,
      pinnedPostIds: [],
      typingUsers: [],
      members: [
        { id: "user_1", name: "أحمد علي", role: "admin", joinedAt: Date.now() - 90 * 86400000, status: "active", warningCount: 0 },
        { id: "user_2", name: "محمد سالم", role: "moderator", joinedAt: Date.now() - 60 * 86400000, status: "active", warningCount: 0 },
        { id: "user_3", name: "علي حسن", role: "member", joinedAt: Date.now() - 30 * 86400000, status: "active", warningCount: 0 },
      ],
      posts: [
        {
          id: "post_1",
          authorId: "user_1",
          authorName: "أحمد علي",
          content: "مرحباً بالجميع! تم إنشاء هذه المجموعة لتبادل الخبرات والتجارب بين المتقاعدين العسكريين.",
          createdAt: Date.now() - 5 * 86400000,
          reactions: { "❤️": 8, "👍": 12, "👏": 5 },
          seenBy: ["user_1"],
          replies: [
            { id: "reply_1", authorId: "user_2", authorName: "محمد سالم", content: "فكرة رائعة! أتطلع للتواصل مع الجميع.", createdAt: Date.now() - 4 * 86400000, seenBy: ["user_2"] },
            { id: "reply_2", authorId: "user_3", authorName: "علي حسن", content: "شكراً على المبادرة. هذا سيكون مفيداً جداً.", createdAt: Date.now() - 3 * 86400000, seenBy: ["user_3"] },
          ],
        },
        {
          id: "post_2",
          authorId: "user_2",
          authorName: "محمد سالم",
          content: "من لديه معلومات عن برامج المساعدة الاجتماعية الجديدة؟ أود التعرف على التفاصيل الكاملة.",
          createdAt: Date.now() - 2 * 86400000,
          reactions: { "👍": 6, "💡": 4 },
          seenBy: ["user_2"],
          replies: [
            { id: "reply_3", authorId: "user_1", authorName: "أحمد علي", content: "يمكنك الاطلاع على القسم الخاص في التطبيق. سأرسل لك الرابط.", createdAt: Date.now() - 86400000, seenBy: ["user_1"] },
          ],
        },
        {
          id: "post_3",
          authorId: "user_3",
          authorName: "علي حسن",
          content: "اليوم اكتملت 20 سنة خدمة! شكراً لدعمكم جميعاً في هذه الرحلة الرائعة.",
          createdAt: Date.now() - 6 * 3600000,
          reactions: { "🎉": 15, "❤️": 20, "👏": 18 },
          seenBy: ["user_3"],
          replies: [
            { id: "reply_4", authorId: "user_1", authorName: "أحمد علي", content: "مبروك يا علي! تستحق كل خير.", createdAt: Date.now() - 4 * 3600000, seenBy: ["user_1"] },
            { id: "reply_5", authorId: "user_2", authorName: "محمد سالم", content: "تهانينا! ألف مبروك.", createdAt: Date.now() - 3 * 3600000, seenBy: ["user_2"] },
          ],
        },
      ],
    },
    {
      id: "group_2",
      name: "فرص العمل والتوظيف",
      icon: "ph-fill ph-briefcase",
      description: "مشاركة فرص العمل والتطوير الوظيفي للمتقاعدين",
      createdAt: Date.now() - 60 * 86400000,
      unreadCount: 1,
      pinnedPostIds: [],
      typingUsers: [],
      members: [
        { id: "user_4", name: "فاطمة أحمد", role: "admin", joinedAt: Date.now() - 60 * 86400000, status: "active", warningCount: 0 },
        { id: "user_5", name: "سارة محمود", role: "moderator", joinedAt: Date.now() - 40 * 86400000, status: "active", warningCount: 0 },
      ],
      posts: [
        {
          id: "post_4",
          authorId: "user_4",
          authorName: "فاطمة أحمد",
          content: "📢 فرصة عمل جديدة: شركة استشارات تبحث عن مدير مشاريع بخبرة 15+ سنة. المزايا ممتازة! من المهتم؟",
          createdAt: Date.now() - 86400000,
          reactions: { "👍": 8, "😊": 5 },
          seenBy: ["user_4"],
          replies: [],
        },
      ],
    },
    {
      id: "group_3",
      name: "النقاشات القانونية",
      icon: "ph-fill ph-scales",
      description: "مناقشة القضايا والاستفسارات القانونية",
      createdAt: Date.now() - 45 * 86400000,
      pinnedPostIds: [],
      typingUsers: [],
      members: [
        { id: "user_5", name: "د. محمود سليم", role: "admin", joinedAt: Date.now() - 45 * 86400000, status: "active", warningCount: 0 },
        { id: "user_6", name: "أ. نور الدين", role: "moderator", joinedAt: Date.now() - 30 * 86400000, status: "active", warningCount: 0 },
      ],
      posts: [
        {
          id: "post_5",
          authorId: "user_5",
          authorName: "د. محمود سليم",
          content: "سؤال: ما هي حقوق ذوي العسكري المتوفى؟ هل هناك فروقات حسب الرتبة؟",
          createdAt: Date.now() - 12 * 3600000,
          reactions: { "💡": 3, "👍": 2 },
          seenBy: ["user_5"],
          replies: [],
        },
      ],
    },
  );
}

/** Ensure the current user is added as member when they first access a group */
function ensureCurrentUser(group: Group, userId: string, userName: string) {
  if (!group.members.find((m) => m.id === userId)) {
    group.members.push({
      id: userId,
      name: userName,
      role: "member",
      joinedAt: Date.now(),
      status: "active",
      warningCount: 0,
    });
  }
}

/* ── Routes ────────────────────────────────────────────────── */
export interface GroupsRoutesOptions {
  makeId?: (prefix: string) => string;
}

export const groupsRoutes: FastifyPluginAsync<GroupsRoutesOptions> = async (app, _opts) => {
  const mid = _opts?.makeId ?? gid;

  /* ── LIST groups ─────────────────────────────────────────── */
  app.get("/api/groups", async (req) => {
    const userId = (req as any).userId || "current_user";
    const userName = (req as any).userName || "أنت";

    // Auto-join user to all groups (demo behavior)
    for (const g of groupsStore) ensureCurrentUser(g, userId, userName);

    const items = groupsStore.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      description: g.description,
      memberCount: g.members.length,
      postCount: g.posts.length,
      unreadCount: g.unreadCount || 0,
      createdAt: g.createdAt,
    }));
    return { groups: items };
  });

  /* ── GET single group ────────────────────────────────────── */
  app.get<{ Params: { id: string } }>("/api/groups/:id", async (req, reply) => {
    const group = findGroup(req.params.id);
    if (!group) { reply.code(404); return { error: "group not found" }; }

    const userId = (req as any).userId || "current_user";
    const userName = (req as any).userName || "أنت";
    ensureCurrentUser(group, userId, userName);
    return { group };
  });

  app.post<{ Params: { id: string } }>("/api/groups/:id/read", async (req, reply) => {
    const group = findGroup(req.params.id);
    if (!group) { reply.code(404); return { error: "group not found" }; }

    const userId = (req as any).userId || "current_user";
    const idx = groupsStore.findIndex((item) => item.id === group.id);
    groupsStore[idx] = markGroupMessagesRead(group, userId);

    return { ok: true, group: groupsStore[idx] };
  });

  app.post<{
    Params: { id: string };
    Body: { isTyping?: boolean; userId?: string; userName?: string };
  }>("/api/groups/:id/typing", async (req, reply) => {
    const group = findGroup(req.params.id);
    if (!group) { reply.code(404); return { error: "group not found" }; }

    const userName = req.body?.userName || (req as any).userName || "أنت";
    const isTyping = req.body?.isTyping !== false;
    const currentTypingUsers = new Set(group.typingUsers || []);

    if (isTyping) {
      currentTypingUsers.add(userName);
    } else {
      currentTypingUsers.delete(userName);
    }

    group.typingUsers = Array.from(currentTypingUsers);
    return { ok: true, typingUsers: group.typingUsers };
  });

  /* ── CREATE post ─────────────────────────────────────────── */
  app.post<{ Params: { id: string }; Body: { content: string; authorId?: string; authorName?: string } }>(
    "/api/groups/:id/posts",
    async (req, reply) => {
      const group = findGroup(req.params.id);
      if (!group) { reply.code(404); return { error: "group not found" }; }
      const content = String(req.body?.content || "").trim();
      if (!content) { reply.code(400); return { error: "content required" }; }

      const post: GroupPost = {
        id: mid("post"),
        authorId: req.body?.authorId || (req as any).userId || "current_user",
        authorName: req.body?.authorName || (req as any).userName || "أنت",
        content,
        createdAt: Date.now(),
        reactions: {},
        seenBy: [req.body?.authorId || (req as any).userId || "current_user"],
        replies: [],
      };
      group.posts.unshift(post);
      group.typingUsers = (group.typingUsers || []).filter((name) => name !== post.authorName);
      return post;
    },
  );

  /* ── DELETE post ─────────────────────────────────────────── */
  app.delete<{ Params: { id: string; postId: string } }>(
    "/api/groups/:id/posts/:postId",
    async (req, reply) => {
      const group = findGroup(req.params.id);
      if (!group) { reply.code(404); return { error: "group not found" }; }
      const idx = group.posts.findIndex((p) => p.id === req.params.postId);
      if (idx === -1) { reply.code(404); return { error: "post not found" }; }
      group.posts.splice(idx, 1);
      return { ok: true };
    },
  );

  /* ── CREATE reply ────────────────────────────────────────── */
  app.post<{ Params: { id: string; postId: string }; Body: { content: string; authorId?: string; authorName?: string } }>(
    "/api/groups/:id/posts/:postId/replies",
    async (req, reply) => {
      const group = findGroup(req.params.id);
      if (!group) { reply.code(404); return { error: "group not found" }; }
      const post = findPost(group, req.params.postId);
      if (!post) { reply.code(404); return { error: "post not found" }; }
      const content = String(req.body?.content || "").trim();
      if (!content) { reply.code(400); return { error: "content required" }; }

      const r: GroupReply = {
        id: mid("reply"),
        authorId: req.body?.authorId || (req as any).userId || "current_user",
        authorName: req.body?.authorName || (req as any).userName || "أنت",
        content,
        createdAt: Date.now(),
        seenBy: [req.body?.authorId || "current_user"],
      };
      post.replies.push(r);
      group.typingUsers = (group.typingUsers || []).filter((name) => name !== r.authorName);
      return r;
    },
  );

  app.post<{
    Params: { id: string; postId: string };
    Body: { deletedByName?: string };
  }>("/api/groups/:id/posts/:postId/delete-for-everyone", async (req, reply) => {
    const group = findGroup(req.params.id);
    if (!group) { reply.code(404); return { error: "group not found" }; }
    const idx = group.posts.findIndex((post) => post.id === req.params.postId);
    if (idx === -1) { reply.code(404); return { error: "post not found" }; }

    const deletedByName = req.body?.deletedByName || (req as any).userName || "أنت";
    group.posts[idx] = markPostDeletedForEveryone(group.posts[idx], deletedByName);

    if (group.pinnedPostIds?.includes(req.params.postId)) {
      group.pinnedPostIds = group.pinnedPostIds.filter((postId) => postId !== req.params.postId);
    }

    return group.posts[idx];
  });

  /* ── TOGGLE reaction ─────────────────────────────────────── */
  app.post<{ Params: { id: string; postId: string }; Body: { emoji: string } }>(
    "/api/groups/:id/posts/:postId/reactions",
    async (req, reply) => {
      const group = findGroup(req.params.id);
      if (!group) { reply.code(404); return { error: "group not found" }; }
      const post = findPost(group, req.params.postId);
      if (!post) { reply.code(404); return { error: "post not found" }; }
      const emoji = String(req.body?.emoji || "").trim();
      if (!emoji) { reply.code(400); return { error: "emoji required" }; }

      post.reactions[emoji] = (post.reactions[emoji] || 0) + 1;
      return { reactions: post.reactions };
    },
  );

  /* ── TOGGLE pin ──────────────────────────────────────────── */
  app.post<{ Params: { id: string; postId: string } }>(
    "/api/groups/:id/posts/:postId/pin",
    async (req, reply) => {
      const group = findGroup(req.params.id);
      if (!group) { reply.code(404); return { error: "group not found" }; }
      if (!findPost(group, req.params.postId)) { reply.code(404); return { error: "post not found" }; }

      if (!group.pinnedPostIds) group.pinnedPostIds = [];
      const idx = group.pinnedPostIds.indexOf(req.params.postId);
      if (idx >= 0) group.pinnedPostIds.splice(idx, 1);
      else group.pinnedPostIds.push(req.params.postId);

      return { pinnedPostIds: group.pinnedPostIds };
    },
  );

  /* ── FORWARD post ────────────────────────────────────────── */
  app.post<{ Params: { id: string; postId: string }; Body: { targetGroupId: string } }>(
    "/api/groups/:id/posts/:postId/forward",
    async (req, reply) => {
      const sourceGroup = findGroup(req.params.id);
      if (!sourceGroup) { reply.code(404); return { error: "source group not found" }; }
      const sourcePost = findPost(sourceGroup, req.params.postId);
      if (!sourcePost) { reply.code(404); return { error: "post not found" }; }
      const targetGroup = findGroup(req.body?.targetGroupId);
      if (!targetGroup) { reply.code(404); return { error: "target group not found" }; }

      const newPost: GroupPost = {
        ...sourcePost,
        id: mid("post"),
        createdAt: Date.now(),
        reactions: {},
        replies: [],
        forwardedFrom: {
          groupId: sourceGroup.id,
          groupName: sourceGroup.name,
          postId: sourcePost.id,
          authorName: sourcePost.authorName,
        },
      };
      targetGroup.posts.unshift(newPost);
      return newPost;
    },
  );

  /* ── UPDATE group settings ───────────────────────────────── */
  app.patch<{ Params: { id: string }; Body: { name?: string; description?: string } }>(
    "/api/groups/:id",
    async (req, reply) => {
      const group = findGroup(req.params.id);
      if (!group) { reply.code(404); return { error: "group not found" }; }
      if (req.body?.name) group.name = req.body.name;
      if (req.body?.description) group.description = req.body.description;
      return { group };
    },
  );

  /* ── UPDATE member (role, mute, warn, ban, suspend) ──────── */
  app.patch<{
    Params: { id: string; memberId: string };
    Body: { role?: string; isMuted?: boolean; muteHours?: number; action?: "warn" | "ban" | "suspend" | "remove"; reason?: string; suspendHours?: number };
  }>(
    "/api/groups/:id/members/:memberId",
    async (req, reply) => {
      const group = findGroup(req.params.id);
      if (!group) { reply.code(404); return { error: "group not found" }; }
      const member = findMember(group, req.params.memberId);
      if (!member) { reply.code(404); return { error: "member not found" }; }

      const body = req.body || {};

      if (body.role && ["admin", "moderator", "member"].includes(body.role)) {
        member.role = body.role as GroupMember["role"];
      }

      if (body.isMuted !== undefined) {
        member.isMuted = body.isMuted;
        member.mutedUntil = body.isMuted && body.muteHours ? Date.now() + body.muteHours * 3600000 : undefined;
      }

      if (body.action === "warn") {
        member.warningCount = (member.warningCount || 0) + 1;
        member.lastViolation = { reason: body.reason || "", date: Date.now() };
        if (member.warningCount >= 4) member.status = "banned";
        else if (member.warningCount >= 2) {
          member.status = "suspended";
          member.suspendedUntil = Date.now() + 24 * 3600000;
        }
      }

      if (body.action === "ban") {
        member.status = "banned";
        member.warningCount = 4;
        member.lastViolation = { reason: body.reason || "", date: Date.now() };
      }

      if (body.action === "suspend") {
        member.status = "suspended";
        member.suspendedUntil = Date.now() + (body.suspendHours || 24) * 3600000;
        member.lastViolation = { reason: body.reason || "", date: Date.now() };
      }

      if (body.action === "remove") {
        group.members = group.members.filter((m) => m.id !== req.params.memberId);
        return { ok: true, removed: true };
      }

      return { member };
    },
  );

  /* ── REPORT post ─────────────────────────────────────────── */
  app.post<{ Params: { id: string; postId: string }; Body: { reason: string } }>(
    "/api/groups/:id/posts/:postId/report",
    async (req, reply) => {
      const group = findGroup(req.params.id);
      if (!group) { reply.code(404); return { error: "group not found" }; }
      if (!findPost(group, req.params.postId)) { reply.code(404); return { error: "post not found" }; }
      // In production this would go to a moderation queue
      return { ok: true, message: "تم إرسال البلاغ" };
    },
  );
};
