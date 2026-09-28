import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/db.js", () => ({
  query: vi.fn(),
  getClient: vi.fn(),
}));
vi.mock("../lib/feature-flags.js", () => ({
  getFeatureFlagsPayload: vi.fn(async () => ({ flags: {}, lastUpdatedAt: null })),
}));
vi.mock("../ws/features-ws.js", () => ({
  broadcastFeatureFlagsUpdate: vi.fn(async () => undefined),
}));
vi.mock("../network/network-store.js", () => ({
  getNetworkMembership: vi.fn(),
  saveDraftNetworkMembership: vi.fn(),
  submitNetworkMembership: vi.fn(),
  approveNetworkMembership: vi.fn(),
}));

import { getClient, query } from "../lib/db.js";
import {
  approveNetworkMembership,
  getNetworkMembership,
  saveDraftNetworkMembership,
  submitNetworkMembership,
} from "../network/network-store.js";
import { adminUsersManagementRoutes } from "../routes/admin-users-management.js";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const queryMock = vi.mocked(query);
const getClientMock = vi.mocked(getClient);
const getNetworkMembershipMock = vi.mocked(getNetworkMembership);
const saveDraftNetworkMembershipMock = vi.mocked(saveDraftNetworkMembership);
const submitNetworkMembershipMock = vi.mocked(submitNetworkMembership);
const approveNetworkMembershipMock = vi.mocked(approveNetworkMembership);

async function buildApp() {
  const app = Fastify();
  app.decorateRequest("user", undefined);
  app.addHook("onRequest", async (request) => {
    request.user = { id: actorId, email: "admin@example.com", role: "superadmin" };
  });
  await app.register(adminUsersManagementRoutes);
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockResolvedValue({ rows: [], rowCount: 0 } as any);
  getNetworkMembershipMock.mockResolvedValue(null);
});

describe("user management profile v3", () => {
  it("persists a validated profile avatar URL and audits the change", async () => {
    const avatarUrl = "/runtime/uploads/1790589000000-abcdefabcdefabcdefabcdef.png";
    const clientQuery = vi.fn(async (text: string, params?: unknown[]) => {
      if (text.includes("FROM users WHERE id = $1 FOR UPDATE")) {
        return { rows: [{ id: targetId, email: "user@example.com", name: "User", phone: "+96170000000", role: "public", rank: null, military_id: null, region: null, avatar_url: null }], rowCount: 1 };
      }
      if (text.includes("SELECT id FROM users") && text.includes("id <> $1")) return { rows: [], rowCount: 0 };
      if (text.includes("UPDATE users") && text.includes("avatar_url")) {
        return { rows: [{ id: targetId, email: "user@example.com", name: "User", role: "public", status: "active", avatar_url: params?.[6] }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    getClientMock.mockResolvedValue({ query: clientQuery, release: vi.fn() } as any);
    const app = await buildApp();
    const response = await app.inject({
      method: "PUT",
      url: `/api/admin/users/${targetId}/profile`,
      payload: { name: "User", email: "user@example.com", phone: "+96170000000", avatarUrl },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ user: { avatar_url: avatarUrl } });
    const updateCall = clientQuery.mock.calls.find(([sql]) => String(sql).includes("UPDATE users"));
    expect(updateCall?.[1]?.[6]).toBe(avatarUrl);
    const auditCall = clientQuery.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO audit_log"));
    expect(auditCall?.[1]?.[1]).toBe("user.profile_update");
    await app.close();
  });

  it("rejects an unsafe avatar URL", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "PUT",
      url: `/api/admin/users/${targetId}/profile`,
      payload: { name: "User", email: "user@example.com", avatarUrl: "javascript:alert(1)" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "USER_PROFILE_VALIDATION_FAILED" });
    expect(getClientMock).not.toHaveBeenCalled();
    await app.close();
  });

  it("saves and approves the user's canonical network membership", async () => {
    const draft = {
      id: "network-1",
      userId: targetId,
      displayName: "User",
      address: { governorateId: "mount-lebanon", cazaId: "keserwan", villageId: "jounieh" },
      visibilityLevel: "VISIBLE_CAZA_ONLY",
      familyTier: "VERIFIED_FAMILY_MEMBER",
      points: 15,
      isVerifiedUser: true,
      approvalStatus: "PENDING",
      isActive: true,
      createdAt: "2026-09-28T10:00:00.000Z",
      updatedAt: "2026-09-28T10:00:00.000Z",
    } as any;
    const approved = { ...draft, approvalStatus: "APPROVED" } as any;
    queryMock.mockImplementation(async (text: string) => {
      if (text.includes("SELECT id, COALESCE")) return { rows: [{ id: targetId, name: "User" }], rowCount: 1 } as any;
      return { rows: [], rowCount: 1 } as any;
    });
    saveDraftNetworkMembershipMock.mockResolvedValue(draft);
    approveNetworkMembershipMock.mockResolvedValue(approved);
    submitNetworkMembershipMock.mockResolvedValue(null);
    const app = await buildApp();
    const response = await app.inject({
      method: "PUT",
      url: `/api/admin/users/${targetId}/network`,
      payload: {
        address: draft.address,
        visibilityLevel: draft.visibilityLevel,
        familyTier: draft.familyTier,
        points: 15,
        isVerifiedUser: true,
        approvalAction: "approve",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ networkProfile: { userId: targetId, approvalStatus: "APPROVED" } });
    expect(saveDraftNetworkMembershipMock).toHaveBeenCalledWith(expect.objectContaining({ userId: targetId, address: draft.address }));
    expect(approveNetworkMembershipMock).toHaveBeenCalledWith(targetId);
    const auditCall = queryMock.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO audit_log"));
    expect(auditCall?.[1]?.[1]).toBe("user.network_update");
    await app.close();
  });

  it("updates independent taxi, seller, and employer service privileges with audit evidence", async () => {
    const clientQuery = vi.fn(async (text: string) => {
      if (text.includes("SELECT id FROM users WHERE id = $1 FOR UPDATE")) return { rows: [{ id: targetId }], rowCount: 1 };
      if (text.includes("SELECT privilege, enabled FROM user_service_privileges")) return { rows: [], rowCount: 0 };
      if (text.includes("SELECT privilege, enabled, created_at, updated_at")) {
        return {
          rows: [
            { privilege: "taxi_driver", enabled: true },
            { privilege: "seller", enabled: true },
            { privilege: "employer", enabled: false },
          ],
          rowCount: 3,
        };
      }
      return { rows: [], rowCount: 1 };
    });
    getClientMock.mockResolvedValue({ query: clientQuery, release: vi.fn() } as any);
    const app = await buildApp();
    const response = await app.inject({
      method: "PUT",
      url: `/api/admin/users/${targetId}/privileges`,
      payload: { privileges: { taxi_driver: true, seller: true, employer: false } },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      servicePrivileges: [
        { privilege: "taxi_driver", enabled: true },
        { privilege: "seller", enabled: true },
        { privilege: "employer", enabled: false },
      ],
    });
    const upserts = clientQuery.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO user_service_privileges"));
    expect(upserts).toHaveLength(3);
    const auditCall = clientQuery.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO audit_log"));
    expect(auditCall?.[1]?.[1]).toBe("user.service_privileges_update");
    await app.close();
  });
});
