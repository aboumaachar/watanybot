import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  query: vi.fn(),
  ensureAdminAuthorityTables: vi.fn(),
  createAdminAuthorityId: vi.fn(() => "audit_test"),
}));

vi.mock("../lib/db.js", () => ({ query: harness.query }));
vi.mock("../admin-authority/adminAuthorityStore.js", () => ({
  ensureAdminAuthorityTables: harness.ensureAdminAuthorityTables,
  createAdminAuthorityId: harness.createAdminAuthorityId,
}));

import {
  ADMIN_AUDIT_ANONYMOUS_ACTOR,
  appendAdminAuditEvent,
  createAdminAuditEvent,
} from "../admin-authority/adminAuthorityAudit.js";

const SECURITY_EVENTS = [
  ["ADMIN_LOGIN_SUCCESS", "admin-1"],
  ["ADMIN_LOGIN_FAILURE", ADMIN_AUDIT_ANONYMOUS_ACTOR],
  ["ADMIN_LOGOUT", "admin-1"],
  ["ADMIN_SESSION_REVOKE", "admin-1"],
  ["ADMIN_USER_SUSPEND", "admin-1"],
  ["ADMIN_USER_REACTIVATE", "admin-1"],
  ["ADMIN_ROLE_CHANGE", "admin-1"],
] as const;

beforeEach(() => {
  harness.ensureAdminAuthorityTables.mockClear();
  harness.query.mockClear();
  harness.ensureAdminAuthorityTables.mockResolvedValue(undefined);
  harness.query.mockResolvedValue({
    rows: [{ created_at: "2026-09-02T00:00:00.000Z" }],
    rowCount: 1,
  });
});

describe("canonical administrator security audit", () => {
  it.each(SECURITY_EVENTS)("writes %s to admin_audit_events", async (eventType, actorId) => {
    const event = createAdminAuditEvent({
      eventType,
      actorId,
      entityType: "security",
      entityId: "entity-1",
      before: { state: "before" },
      after: { state: "after" },
      reason: "focused-test",
      ip: "127.0.0.1",
      userAgent: "focused-test-agent",
    });

    await appendAdminAuditEvent(event);

    expect(harness.ensureAdminAuthorityTables).toHaveBeenCalledOnce();
    expect(harness.query).toHaveBeenCalledOnce();
    const [sql, params] = harness.query.mock.calls[harness.query.mock.calls.length - 1] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO admin_audit_events");
    expect(params[1]).toBe(eventType);
    expect(params[2]).toBe(actorId);
    expect(JSON.stringify(params)).not.toMatch(/password|jwt|refresh.?token|cookie|secret|hash/i);
    expect(event.immutableHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses the textual anonymous actor without fabricating a UUID", async () => {
    const event = createAdminAuditEvent({
      eventType: "ADMIN_LOGIN_FAILURE",
      actorId: ADMIN_AUDIT_ANONYMOUS_ACTOR,
      entityType: "authentication",
      reason: "invalid_credentials",
    });

    await appendAdminAuditEvent(event);

    const params = harness.query.mock.calls[harness.query.mock.calls.length - 1]?.[1] as unknown[];
    expect(params[2]).toBe("anonymous");
    expect(params[2]).not.toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
  });
});