import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerAuthHook, signAccessToken } from "../auth/auth-middleware";
import { resetCommunityStore } from "../community/service";
import { runMigrations } from "../db/migrate";
import { query } from "../lib/db";
import { communityRoutes } from "../routes/community";
import { acquireCommunityDbTestLock } from "./community-db-test-lock";

const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const C = "10000000-0000-4000-8000-000000000003";
const ids = [A, B, C];
let releaseLock: null | (() => Promise<void>) = null;

function token(id: string, email: string) {
  return signAccessToken({ sub: id, role: "accredited", email });
}
function buildApp() {
  const server = Fastify({ logger: false });
  registerAuthHook(server);
  server.register(multipart);
  server.register(communityRoutes);
  return server;
}
beforeAll(async () => {
  const release = await acquireCommunityDbTestLock();
  try {
    await runMigrations();
    for (const [id, email, name] of [
      [A, "direct.a@watany.test", "Direct A"],
      [B, "direct.b@watany.test", "Direct B"],
      [C, "direct.c@watany.test", "Direct C"],
    ]) {
      await query(
        `INSERT INTO users (id,email,password_hash,name,role,status) VALUES ($1,$2,'test-only',$3,'accredited','active')
         ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,status='active'`,
        [id, email, name],
      );
    }
  } finally { await release(); }
});

beforeEach(async () => {
  releaseLock = await acquireCommunityDbTestLock();
  await resetCommunityStore();
});
afterEach(async () => {
  if (releaseLock) { await releaseLock(); releaseLock = null; }
});
afterAll(async () => {
  await query("DELETE FROM users WHERE id::text = ANY($1::text[])", [ids]);
});
describe("community direct conversations", () => {
  it("creates one private two-user thread and keeps it out of group discovery", async () => {
    const server = buildApp();
    await server.ready();
    const a = { authorization: `Bearer ${token(A, "direct.a@watany.test")}` };
    const b = { authorization: `Bearer ${token(B, "direct.b@watany.test")}` };
    const c = { authorization: `Bearer ${token(C, "direct.c@watany.test")}` };

    const contacts = await server.inject({ method: "GET", url: "/api/community/direct/contacts?q=Direct", headers: a });
    expect(contacts.statusCode).toBe(200);
    expect(contacts.json().contacts.map((item: { id: string }) => item.id)).toContain(B);
    expect(contacts.json().contacts.map((item: { id: string }) => item.id)).not.toContain(A);

    const first = await server.inject({ method: "POST", url: "/api/community/direct", headers: a, payload: { recipientUserId: B } });
    expect(first.statusCode).toBe(200);
    const groupId = first.json().groupId as string;
    expect(groupId).toMatch(/^community_direct_/u);

    const replay = await server.inject({ method: "POST", url: "/api/community/direct", headers: a, payload: { recipientUserId: B } });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().groupId).toBe(groupId);
    const groups = await server.inject({ method: "GET", url: "/api/community/groups", headers: a });
    expect(groups.statusCode).toBe(200);
    expect(groups.json().groups.map((item: { id: string }) => item.id)).not.toContain(groupId);

    const outsider = await server.inject({ method: "GET", url: `/api/community/groups/${groupId}`, headers: c });
    expect(outsider.statusCode).toBe(403);

    const sent = await server.inject({
      method: "POST", url: `/api/community/groups/${groupId}/messages`, headers: a,
      payload: { body: "رسالة مباشرة تجريبية", clientRequestId: "direct-proof-1" },
    });
    expect(sent.statusCode).toBe(200);

    const receiver = await server.inject({ method: "GET", url: `/api/community/groups/${groupId}`, headers: b });
    expect(receiver.statusCode).toBe(200);
    expect(receiver.json().messages.some((item: { body?: string }) => item.body === "رسالة مباشرة تجريبية")).toBe(true);

    const read = await server.inject({ method: "POST", url: `/api/community/groups/${groupId}/read`, headers: b, payload: { messageId: sent.json().id } });
    expect(read.statusCode).toBe(200);
    expect(read.json().unreadCount).toBe(0);

    await server.close();
    const restarted = buildApp();
    await restarted.ready();
    const persisted = await restarted.inject({ method: "GET", url: `/api/community/groups/${groupId}`, headers: b });
    expect(persisted.statusCode).toBe(200);
    expect(persisted.json().messages.some((item: { body?: string }) => item.body === "رسالة مباشرة تجريبية")).toBe(true);

    const bThreads = await restarted.inject({ method: "GET", url: "/api/community/direct", headers: b });
    expect(bThreads.statusCode).toBe(200);
    expect(bThreads.json().threads.some((item: { groupId: string; peer: { id: string } }) => item.groupId === groupId && item.peer.id === A)).toBe(true);

    await expect(query(
      `INSERT INTO community_group_members (group_id,user_id,role,status,joined_at,added_by)
       VALUES ($1,$2,'member','active',now(),$2)`,
      [groupId, C],
    )).rejects.toMatchObject({ code: "23514" });
    await restarted.close();
  });
});
