import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signAccessToken } from "../auth/auth-middleware.js";

let appPromise: Promise<typeof import("../server").default> | null = null;

async function getApp() {
  process.env.JWT_SECRET ||= "test-jwt-secret-for-admin-hardening-0123456789";
  process.env.DISABLE_PLUGIN_DB ||= "true";
  process.env.DISABLE_KB_NODES ||= "true";
  process.env.DISABLE_CHAT_PERSIST ||= "true";
  appPromise ||= import("../server").then((mod) => mod.default);
  return appPromise;
}

function authHeaders(role: "accredited" | "moderator") {
  return {
    authorization: `Bearer ${signAccessToken({
      sub: `documents-${role}`,
      role,
      email: `${role}@test.local`,
    })}`,
  };
}

beforeAll(async () => {
  await getApp();
}, 60000);

beforeEach(async () => {
  const app = await getApp();
  await app.inject({ method: "POST", url: "/api/profile/logout" });
}, 30000);

afterAll(async () => {
  if (appPromise !== null) {
    const app = await appPromise;
    await app.close();
  }
}, 30000);

describe("documents metadata regression", () => {
  it("persists extraction metadata across create, update, and list", async () => {
    const app = await getApp();

    const documentName = `metadata-${Date.now()}`;
    const created = await app.inject({
      method: "POST",
      url: "/api/documents",
      headers: authHeaders("accredited"),
      payload: {
        name: documentName,
        kind: "pdf",
        tags: ["kb", "upload"],
        sourceFileName: "veteran-file.pdf",
        mimeType: "application/pdf",
        slug: "veteran-file",
        extractionStatus: "queued",
        chunkCount: 2,
      },
    });

    expect(created.statusCode).toBe(200);
    const createdItem = created.json();
    expect(createdItem).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: documentName,
      kind: "pdf",
      status: "pending",
      updatedAt: expect.any(Number),
      sourceFileName: "veteran-file.pdf",
      mimeType: "application/pdf",
      slug: "veteran-file",
      extractionStatus: "queued",
      chunkCount: 2,
      tags: ["kb", "upload"],
    }));

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/documents/${createdItem.id}`,
      headers: authHeaders("moderator"),
      payload: {
        status: "verified",
        extractionStatus: "ready",
        chunkCount: 7,
      },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toEqual(expect.objectContaining({
      id: createdItem.id,
      name: documentName,
      kind: "pdf",
      status: "verified",
      updatedAt: expect.any(Number),
      sourceFileName: "veteran-file.pdf",
      mimeType: "application/pdf",
      slug: "veteran-file",
      extractionStatus: "ready",
      chunkCount: 7,
      tags: ["kb", "upload"],
    }));

    const listed = await app.inject({ method: "GET", url: "/api/documents", headers: authHeaders("accredited") });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual({
      items: expect.arrayContaining([
        expect.objectContaining({
          id: createdItem.id,
          name: documentName,
          kind: "pdf",
          status: "verified",
          sourceFileName: "veteran-file.pdf",
          mimeType: "application/pdf",
          slug: "veteran-file",
          extractionStatus: "ready",
          chunkCount: 7,
          tags: ["kb", "upload"],
        }),
      ]),
    });
  });

  it("rejects invalid extraction status on create and update", async () => {
    const app = await getApp();

    const invalidCreate = await app.inject({
      method: "POST",
      url: "/api/documents",
      headers: authHeaders("accredited"),
      payload: {
        name: `invalid-create-${Date.now()}`,
        kind: "pdf",
        extractionStatus: "broken",
        tags: [],
      },
    });

    expect(invalidCreate.statusCode).toBe(400);
    expect(invalidCreate.json()).toEqual({ error: "حالة المعالجة غير صالحة" });

    const validCreated = await app.inject({
      method: "POST",
      url: "/api/documents",
      headers: authHeaders("accredited"),
      payload: {
        name: `valid-update-${Date.now()}`,
        kind: "pdf",
        extractionStatus: "queued",
        tags: [],
      },
    });

    expect(validCreated.statusCode).toBe(200);
    const validItem = validCreated.json();

    const invalidUpdate = await app.inject({
      method: "PATCH",
      url: `/api/documents/${validItem.id}`,
      headers: authHeaders("moderator"),
      payload: { extractionStatus: "broken" },
    });

    expect(invalidUpdate.statusCode).toBe(400);
    expect(invalidUpdate.json()).toEqual({ error: "حالة المعالجة غير صالحة" });
  });
});