import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "../auth/auth-middleware";
import { app } from "../server";
import { registerOfficialSourcesRoutes } from "../routes/official-sources";

const originalKbDataRoot = process.env.KB_DATA_ROOT;
const tempDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "watany-official-services-"));

describe("official services routes", () => {
  beforeAll(async () => {
    process.env.KB_DATA_ROOT = tempDataRoot;
    registerOfficialSourcesRoutes(app as any);
    await app.ready();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    process.env.KB_DATA_ROOT = originalKbDataRoot;
    fs.rmSync(tempDataRoot, { recursive: true, force: true });
    await app.close();
  });

  it("lists only the mapped official services and keeps mechanic taxes pending", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/official-services",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; total: number; items: Array<{ id: string; enabled: boolean; mode: string; externalOnly: boolean }> };
    expect(body.ok).toBe(true);
    expect(body.total).toBe(5);
    expect(body.items.map((item) => item.id)).toEqual([
      "isf-medical-allowances",
      "army-lab-results",
      "isf-mechanic-taxes",
      "isf-traffic-tickets",
      "dgcs-ekhraj-kaid",
    ]);
    expect(body.items.find((item) => item.id === "isf-mechanic-taxes")).toMatchObject({
      enabled: false,
      mode: "PENDING_URL_VALIDATION",
      externalOnly: true,
    });
    expect(body.items.every((item) => item.id !== "army-volunteering-conditions")).toBe(true);
    expect(body.items.filter((item) => item.id !== "isf-mechanic-taxes").every((item) => item.externalOnly)).toBe(true);
  });

  it("blocks in-app official-service queries when the service is external-only", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const cases = [
      {
        serviceId: "isf-medical-allowances",
        payload: { name: "أحمد محمود", military_number: "123456" },
      },
      {
        serviceId: "isf-traffic-tickets",
        payload: { plate_number: "112233", code: "1" },
      },
    ] as const;

    for (const entry of cases) {
      const res = await app.inject({
        method: "POST",
        url: `/api/official-services/${entry.serviceId}/query`,
        payload: entry.payload,
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as {
        ok: boolean;
        serviceId: string;
        source: string;
        provider: string;
        sourceUrl: string;
        fallbackUrl: string;
        reason: string;
        error: string;
      };
      expect(body.ok).toBe(false);
      expect(body.serviceId).toBe(entry.serviceId);
      expect(body.source).toBe("official");
      expect(body.provider).toBeTruthy();
      expect(body.sourceUrl).toContain("http");
      expect(body.fallbackUrl).toBe(body.sourceUrl);
      expect(body.reason).toBe("external_only");
      expect(body.error).toBeTruthy();
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows a superadmin to update a service URL and records health status", async () => {
    const accessToken = signAccessToken({
      sub: "00000000-0000-0000-0000-000000000001",
      role: "superadmin",
      email: "official-services-user@example.invalid",
    });

    const patchResponse = await app.inject({
      method: "PATCH",
      url: "/api/admin/official-services/isf-mechanic-taxes",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        sourceUrl: "https://example.com/mechanic-taxes",
        enabled: true,
        fallbackMessageAr: "تم تحديث الرابط الرسمي.",
      },
    });

    expect(patchResponse.statusCode).toBe(200);
    const patchBody = patchResponse.json() as { ok: boolean; item: { sourceUrl: string; enabled: boolean; fallbackMessageAr: string; externalOnly: boolean } };
    expect(patchBody.ok).toBe(true);
    expect(patchBody.item).toMatchObject({
      sourceUrl: "https://example.com/mechanic-taxes",
      enabled: true,
      fallbackMessageAr: "تم تحديث الرابط الرسمي.",
      externalOnly: true,
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const healthResponse = await app.inject({
      method: "GET",
      url: "/api/official-services/isf-mechanic-taxes/health",
    });

    expect(healthResponse.statusCode).toBe(200);
    const healthBody = healthResponse.json() as { ok: boolean; reachable: boolean; statusCode: number | null; lastCheckedAt: string };
    expect(healthBody.ok).toBe(true);
    expect(healthBody.reachable).toBe(false);
    expect(healthBody.statusCode).toBe(404);
    expect(healthBody.lastCheckedAt).toBeTruthy();

    const adminListResponse = await app.inject({
      method: "GET",
      url: "/api/admin/official-services",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(adminListResponse.statusCode).toBe(200);
    const adminListBody = adminListResponse.json() as {
      ok: boolean;
      items: Array<{ id: string; sourceUrl: string; lastStatusCode: number | null; lastHealthOk: boolean | null }>;
    };
    expect(adminListBody.ok).toBe(true);
    expect(adminListBody.items.find((item) => item.id === "isf-mechanic-taxes")).toMatchObject({
      sourceUrl: "https://example.com/mechanic-taxes",
      lastStatusCode: 404,
      lastHealthOk: false,
    });
  });
});
