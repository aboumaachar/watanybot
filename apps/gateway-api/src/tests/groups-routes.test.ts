import Fastify from "fastify";
import { beforeEach, describe, expect, it } from "vitest";

import { groupsRoutes, resetGroupsStore } from "../routes/groups";

describe("groups routes", () => {
  beforeEach(() => {
    resetGroupsStore();
  });

  it("marks group posts and replies as read for the current user", async () => {
    const app = Fastify();
    app.register(groupsRoutes);
    await app.ready();

    const response = await app.inject({ method: "POST", url: "/api/groups/group_1/read" });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { ok: true; group: { unreadCount: number; posts: Array<{ seenBy?: string[]; replies: Array<{ seenBy?: string[] }> }> } };
    expect(payload.ok).toBe(true);
    expect(payload.group.unreadCount).toBe(0);
    expect(payload.group.posts.every((post) => post.seenBy?.includes("current_user"))).toBe(true);
    expect(payload.group.posts.every((post) => post.replies.every((reply) => reply.seenBy?.includes("current_user")))).toBe(true);

    await app.close();
  });

  it("tracks typing users explicitly instead of relying on local-only state", async () => {
    const app = Fastify();
    app.register(groupsRoutes);
    await app.ready();

    const start = await app.inject({
      method: "POST",
      url: "/api/groups/group_1/typing",
      payload: { isTyping: true, userName: "رامي" },
    });
    expect(start.statusCode).toBe(200);
    expect(start.json()).toEqual({ ok: true, typingUsers: ["رامي"] });

    const stop = await app.inject({
      method: "POST",
      url: "/api/groups/group_1/typing",
      payload: { isTyping: false, userName: "رامي" },
    });
    expect(stop.statusCode).toBe(200);
    expect(stop.json()).toEqual({ ok: true, typingUsers: [] });

    await app.close();
  });

  it("marks a post deleted for everyone without dropping the thread", async () => {
    const app = Fastify();
    app.register(groupsRoutes);
    await app.ready();

    const deletion = await app.inject({
      method: "POST",
      url: "/api/groups/group_1/posts/post_1/delete-for-everyone",
      payload: { deletedByName: "أنت" },
    });

    expect(deletion.statusCode).toBe(200);
    expect(deletion.json()).toEqual(expect.objectContaining({
      id: "post_1",
      content: "تم حذف هذه الرسالة للجميع.",
      deletedByName: "أنت",
    }));

    const groupResponse = await app.inject({ method: "GET", url: "/api/groups/group_1" });
    expect(groupResponse.statusCode).toBe(200);
    const groupPayload = groupResponse.json() as { group: { posts: Array<{ id: string; content: string; deletedForEveryoneAt?: number }> } };
    expect(groupPayload.group.posts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "post_1",
        content: "تم حذف هذه الرسالة للجميع.",
      }),
    ]));
    expect(groupPayload.group.posts.find((post) => post.id === "post_1")?.deletedForEveryoneAt).toBeTypeOf("number");

    await app.close();
  });
});