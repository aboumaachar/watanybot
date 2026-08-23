import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile, writeFile, copyFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { query } from "../lib/db.js";
import { signAccessToken } from "../auth/auth-middleware.js";
import { ensureAdminAuthorityTables } from "../admin-authority/adminAuthorityStore.js";

let appPromise: Promise<typeof import("../server").default> | null = null;
const flagsPath = path.resolve(process.cwd(), "data", "feature_flags.json");
const backupPath = `${flagsPath}.wave1-canary-backup`;
const canaryId = `APEX-WAVE1-FEATURE-CONTROL-CANARY-${new Date().toISOString().replace(/[^0-9]/g, "")}-${Math.random().toString(36).slice(2, 10)}`;
const canaryKey = `${canaryId}.enabled`;
let originalFlags: string | null = null;
let originalFlagsExisted = false;

async function getApp() {
  process.env.JWT_SECRET ||= "test-jwt-secret-for-wave1-canary-0123456789";
  process.env.DISABLE_PLUGIN_DB ||= "true";
  process.env.DISABLE_KB_NODES ||= "true";
  process.env.DISABLE_CHAT_PERSIST ||= "true";
  appPromise ||= import("../server").then((mod) => mod.default);
  return appPromise;
}

function authHeader(role: "admin" | "superadmin") {
  return {
    authorization: `Bearer ${signAccessToken({
      sub: `${canaryId}-${role}`,
      role,
      email: `${role}@wave1-canary.test`,
    })}`,
  };
}

beforeAll(async () => {
  originalFlagsExisted = existsSync(flagsPath);
  originalFlags = originalFlagsExisted ? await readFile(flagsPath, "utf8") : null;
  if (originalFlagsExisted) await copyFile(flagsPath, backupPath);
  await ensureAdminAuthorityTables();
  await query("DELETE FROM admin_audit_events WHERE actor_id LIKE $1", [`${canaryId}-%`]);
  await getApp();
}, 60000);

afterAll(async () => {
  await query("DELETE FROM admin_audit_events WHERE actor_id LIKE $1", [`${canaryId}-%`]);
  if (originalFlagsExisted && originalFlags !== null) {
    await writeFile(flagsPath, originalFlags, "utf8");
  } else {
    try {
      await unlink(flagsPath);
    } catch {
      // The file may not have existed before the canary.
    }
  }
  try {
    await unlink(backupPath);
  } catch {
    // The backup is test residue only.
  }
  if (appPromise !== null) {
    const app = await appPromise;
    await app.close();
  }
}, 60000);

describe("Superadmin Wave-1 feature-control audit canary", () => {
  it("proves reversible mutation, immutable audit, negative auth, and zero residue", async () => {
    const app = await getApp();
    const beforeResponse = await app.inject({ method: "GET", url: "/api/admin/features" });
    expect(beforeResponse.statusCode).toBe(200);
    const before = await beforeResponse.json() as { flags: Record<string, boolean> };
    expect(before.flags[canaryKey]).toBeUndefined();

    const deniedResponse = await app.inject({
      method: "PUT",
      url: "/api/admin/features",
      headers: authHeader("admin"),
      payload: { ...before.flags, [canaryKey]: true },
    });
    expect(deniedResponse.statusCode).toBe(403);

    const updateResponse = await app.inject({
      method: "PUT",
      url: "/api/admin/features",
      headers: authHeader("superadmin"),
      payload: { ...before.flags, [canaryKey]: true },
    });
    expect(updateResponse.statusCode).toBe(200);

    const afterResponse = await app.inject({ method: "GET", url: "/api/admin/features" });
    const after = await afterResponse.json() as { flags: Record<string, boolean> };
    expect(after.flags[canaryKey]).toBe(true);

    const auditRows = await query<{
      id: string;
      actor_id: string;
      entity_type: string;
      entity_id: string;
      before_state: Record<string, unknown>;
      after_state: { flags: Record<string, boolean>; actorRole: string; domain: string; action: string; correlationId: string; sourceInterface: string };
      immutable_hash: string;
      request_id: string;
    }>(
      "SELECT id, actor_id, entity_type, entity_id, before_state, after_state, immutable_hash, request_id FROM admin_audit_events WHERE actor_id = $1",
      [`${canaryId}-superadmin`],
    );
    expect(auditRows.rows).toHaveLength(1);
    const audit = auditRows.rows[0];
    expect(audit.actor_id).toBe(`${canaryId}-superadmin`);
    expect(audit.entity_type).toBe("feature_controls");
    expect(audit.entity_id).toBe("global");
    expect(audit.before_state).toEqual(before.flags);
    expect(audit.after_state.flags[canaryKey]).toBe(true);
    expect(audit.after_state.actorRole).toBe("superadmin");
    expect(audit.after_state.domain).toBe("cms");
    expect(audit.after_state.action).toBe("update");
    expect(audit.after_state.correlationId).toBeTruthy();
    expect(audit.request_id).toBe(audit.after_state.correlationId);
    expect(audit.after_state.sourceInterface).toBe("web-admin.superadmin.feature-controls");
    expect(audit.immutable_hash).toMatch(/^[a-f0-9]{64}$/);

    await writeFile(flagsPath, JSON.stringify(before.flags, null, 2), "utf8");
    const restoredResponse = await app.inject({ method: "GET", url: "/api/admin/features" });
    const restored = await restoredResponse.json() as { flags: Record<string, boolean> };
    expect(restored.flags[canaryKey]).toBeUndefined();

    await query("DELETE FROM admin_audit_events WHERE actor_id LIKE $1", [`${canaryId}-%`]);
    const residue = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_audit_events WHERE actor_id LIKE $1", [`${canaryId}-%`]);
    expect(Number(residue.rows[0]?.count || 0)).toBe(0);
  });
});
