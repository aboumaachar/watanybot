import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { closePool } from "../lib/db.js";

process.env.NODE_ENV = "test";
process.env.DISABLE_PLUGIN_DB = "true";
process.env.USE_PYTHON_API = "false";
process.env.USE_KB_STUB = "true";

const canonicalNetworkPrefix = "/api/network";
const canaryUserId = `apex-c7-network-${Date.now()}`;
let app: FastifyInstance;
let temporaryRoot = "";
let originalCwd = "";

function temporaryStorePath(): string {
  return path.join(temporaryRoot, "apps", "gateway-api", "data", "network", "network-store.json");
}

async function request(route: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; body: any }> {
  const response = await app.inject({
    method: init.method || "GET",
    url: route,
    payload: init.body,
  });
  return { status: response.statusCode, body: response.json() };
}

async function removeCanary(): Promise<void> {
  const storePath = temporaryStorePath();
  if (!existsSync(storePath)) return;
  const store = JSON.parse(await readFile(storePath, "utf8")) as { profiles?: Array<{ userId?: string }> };
  const profiles = Array.isArray(store.profiles) ? store.profiles.filter((profile) => profile.userId !== canaryUserId) : [];
  await writeFile(storePath, `${JSON.stringify({ profiles }, null, 2)}\n`, "utf8");
}

describe("C7 Network admin-owner runtime", () => {
  beforeAll(async () => {
    originalCwd = process.cwd();
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "watany-c7-network-"));
    const server = await import("../server.js");
    app = server.app;
    await app.ready();
    process.chdir(temporaryRoot);
  }, 60000);

  afterAll(async () => {
    try {
      await removeCanary();
      const cleaned = await request(`${canonicalNetworkPrefix}/membership?userId=${encodeURIComponent(canaryUserId)}`);
      if (cleaned.body.profile !== null) throw new Error("NETWORK_TEST_CANARY_RESIDUE");
    } finally {
      process.chdir(originalCwd);
      await app.close();
      await closePool();
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }, 60000);

  it("exercises the canonical Network route/store chain and cleans its exact canary", async () => {
    const settings = await request(`${canonicalNetworkPrefix}/settings`);
    expect(settings.status).toBe(200);
    expect(settings.body.ok).toBe(true);
    expect(settings.body.settings.featureEnabled).toBe(true);

    const initialMap = await request(`${canonicalNetworkPrefix}/map`);
    expect(initialMap.status).toBe(200);
    expect(initialMap.body.profiles).toEqual([]);

    const missingUserId = await request(`${canonicalNetworkPrefix}/membership`);
    expect(missingUserId.status).toBe(400);

    const saved = await request(`${canonicalNetworkPrefix}/membership`, {
      method: "PUT",
      body: {
        userId: canaryUserId,
        displayName: "عضو اختبار شبكة موطني",
        visibilityLevel: "VISIBLE_CAZA_ONLY",
        familyTier: "BASIC_FAMILY_MEMBER",
        points: 7,
        address: { governorateId: "beirut", cazaId: "matn", municipalityId: "jdeideh", villageId: "jdaideh" },
        isVerifiedUser: false,
      },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.profile.userId).toBe(canaryUserId);
    expect(saved.body.profile.approvalStatus).toBe("PENDING");

    const readBack = await request(`${canonicalNetworkPrefix}/membership?userId=${encodeURIComponent(canaryUserId)}`);
    expect(readBack.status).toBe(200);
    expect(readBack.body.profile.id).toBe(saved.body.profile.id);

    const submitted = await request(`${canonicalNetworkPrefix}/membership/submit`, { method: "POST", body: { userId: canaryUserId } });
    expect(submitted.status).toBe(200);
    expect(submitted.body.profile.approvalStatus).toBe("PENDING");

    const approved = await request(`${canonicalNetworkPrefix}/membership/approve`, { method: "POST", body: { userId: canaryUserId } });
    expect(approved.status).toBe(200);
    expect(approved.body.profile.approvalStatus).toBe("APPROVED");

    const map = await request(`${canonicalNetworkPrefix}/map`);
    expect(map.body.profiles.map((profile: { userId: string }) => profile.userId)).toContain(canaryUserId);

    const search = await request(`${canonicalNetworkPrefix}/search?cazaId=matn`);
    expect(search.status).toBe(200);
    expect(search.body.profiles.map((profile: { userId: string }) => profile.userId)).toContain(canaryUserId);

    await removeCanary();
    const afterCleanup = await request(`${canonicalNetworkPrefix}/membership?userId=${encodeURIComponent(canaryUserId)}`);
    expect(afterCleanup.status).toBe(200);
    expect(afterCleanup.body.profile).toBeNull();
    const cleanedMap = await request(`${canonicalNetworkPrefix}/map`);
    expect(cleanedMap.body.profiles.map((profile: { userId: string }) => profile.userId)).not.toContain(canaryUserId);
  });
});