import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "../auth/auth-middleware";
import { app } from "../server";
import { registerOfficialSourcesRoutes } from "../routes/official-sources";

const originalKbDataRoot = process.env.KB_DATA_ROOT;
const tempDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "watany-al-wafiyat-"));

describe("al-wafiyat routes", () => {
  beforeAll(async () => {
    process.env.KB_DATA_ROOT = tempDataRoot;
    fs.writeFileSync(path.join(tempDataRoot, "death-notices.jsonl"), "", "utf8");
    registerOfficialSourcesRoutes(app as any);
    await app.ready();
  });

  afterEach(() => {
    fs.writeFileSync(path.join(tempDataRoot, "death-notices.jsonl"), "", "utf8");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    process.env.KB_DATA_ROOT = originalKbDataRoot;
    fs.rmSync(tempDataRoot, { recursive: true, force: true });
    await app.close();
  });

  it("requires admin auth for imports and keeps imported notices private until approval", async () => {
    const unauthorizedImport = await app.inject({
      method: "POST",
      url: "/api/al-wafiyat/import/isf",
      payload: { previewOnly: true },
    });

    expect(unauthorizedImport.statusCode).toBe(401);

    const unauthorizedAdminList = await app.inject({
      method: "GET",
      url: "/api/admin/deaths",
    });

    expect(unauthorizedAdminList.statusCode).toBe(401);

    const adminToken = signAccessToken({
      sub: "00000000-0000-0000-0000-000000000002",
      role: "admin",
      email: "ops@watany.test",
    });

    const isfHtml = `
      <div class="col-lg-4">
        <div class="card mx-3 p-4 shadow-sm border-0 rounded-5 h-100 w-100">
          <div class="card-title fw-bold fs-5 isf-text-primary">وفاة والدة المعاون علي السيد</div>
          <div class="card-body px-0">
            <p>بتاريخ 6 الجاري توفيت السيدة محمودة حسين حدرج والدة المعاون علي السيد رقم 41708 أحد رتباء وحدة شرطة بيروت.</p>
            <span>06/05/2026</span>
          </div>
        </div>
      </div>
    `;

    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(isfHtml, {
      status: 200,
      headers: { "content-type": "text/html" },
    })));
    vi.stubGlobal("fetch", fetchMock);

    const baselineAdminList = await app.inject({
      method: "GET",
      url: "/api/admin/al-wafiyat",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(baselineAdminList.statusCode).toBe(200);
    const baselineAdminTotal = (baselineAdminList.json() as { total: number }).total;

    const baselinePublicAlWafiyat = await app.inject({
      method: "GET",
      url: "/api/al-wafiyat",
    });

    expect(baselinePublicAlWafiyat.statusCode).toBe(200);
    const baselinePublicAlWafiyatTotal = (baselinePublicAlWafiyat.json() as { total: number }).total;

    const baselineLegacyDeaths = await app.inject({
      method: "GET",
      url: "/api/deaths",
    });

    expect(baselineLegacyDeaths.statusCode).toBe(200);
    const baselineLegacyDeathsTotal = (baselineLegacyDeaths.json() as { total: number }).total;

    const previewResponse = await app.inject({
      method: "POST",
      url: "/api/al-wafiyat/import/isf",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        previewOnly: true,
        limit: 1,
      },
    });

    expect(previewResponse.statusCode).toBe(200);
    const previewBody = previewResponse.json() as {
      ok: boolean;
      previewOnly: boolean;
      importedCount: number;
      total: number;
      items: Array<{ title: string; status: string; sourceId: string; noticeDate: string }>;
    };
    expect(previewBody.ok).toBe(true);
    expect(previewBody.previewOnly).toBe(true);
    expect(previewBody.importedCount).toBe(0);
    expect(previewBody.items).toEqual([
      expect.objectContaining({
        title: "وفاة والدة المعاون علي السيد",
        status: "IMPORTED",
        sourceId: "isf",
        noticeDate: "2026-05-06",
      }),
    ]);

    const previewAdminList = await app.inject({
      method: "GET",
      url: "/api/admin/al-wafiyat",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(previewAdminList.statusCode).toBe(200);
    expect((previewAdminList.json() as { total: number }).total).toBe(baselineAdminTotal);

    const importResponse = await app.inject({
      method: "POST",
      url: "/api/al-wafiyat/import/isf",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        limit: 1,
      },
    });

    expect(importResponse.statusCode).toBe(200);
    const importBody = importResponse.json() as {
      ok: boolean;
      importedCount: number;
      items: Array<{ id: string; status: string; sourceProvider: string }>;
    };
    expect(importBody.ok).toBe(true);
    expect(importBody.importedCount).toBe(1);
    expect(importBody.items).toEqual([
      expect.objectContaining({
        status: "PENDING_APPROVAL",
        sourceProvider: "ISF",
      }),
    ]);

    const importedId = importBody.items[0]?.id;
    expect(importedId).toBeTruthy();

    const publicBeforeApproval = await app.inject({
      method: "GET",
      url: "/api/al-wafiyat",
    });

    expect(publicBeforeApproval.statusCode).toBe(200);
    expect((publicBeforeApproval.json() as { total: number }).total).toBe(baselinePublicAlWafiyatTotal);

    const legacyDeathsBeforeApproval = await app.inject({
      method: "GET",
      url: "/api/deaths",
    });

    expect(legacyDeathsBeforeApproval.statusCode).toBe(200);
    expect((legacyDeathsBeforeApproval.json() as { total: number }).total).toBe(baselineLegacyDeathsTotal);

    const approvalResponse = await app.inject({
      method: "POST",
      url: "/api/al-wafiyat/approve",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        id: importedId,
        action: "APPROVE",
      },
    });

    expect(approvalResponse.statusCode).toBe(200);
    const approvalBody = approvalResponse.json() as { ok: boolean; item: { id: string; status: string } };
    expect(approvalBody.ok).toBe(true);
    expect(approvalBody.item).toMatchObject({
      id: importedId,
      status: "APPROVED",
    });

    const publicAfterApproval = await app.inject({
      method: "GET",
      url: "/api/al-wafiyat",
    });

    expect(publicAfterApproval.statusCode).toBe(200);
    const publicBody = publicAfterApproval.json() as {
      total: number;
      items: Array<{ id: string; status: string; sourceProvider: string; title: string }>;
    };
    expect(publicBody.total).toBe(baselinePublicAlWafiyatTotal + 1);
    expect(publicBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: importedId,
        status: "APPROVED",
        sourceProvider: "ISF",
        title: "وفاة والدة المعاون علي السيد",
      }),
    ]));

    const legacyDeathsAfterApproval = await app.inject({
      method: "GET",
      url: "/api/deaths",
    });

    expect(legacyDeathsAfterApproval.statusCode).toBe(200);
    expect((legacyDeathsAfterApproval.json() as { total: number }).total).toBe(baselineLegacyDeathsTotal + 1);
  });

  it("imports general security deaths and keeps the apparatus inside the description", async () => {
    const adminToken = signAccessToken({
      sub: "00000000-0000-0000-0000-000000000002",
      role: "admin",
      email: "ops@watany.test",
    });

    const gsfHtml = `
      <section class="operations">
        <div class="news-row">
          <span class="news-title">٢٠٢٦/٥/١٢</span>
          <div class="news-title">وفاة السيد حسين محمد غدار والد العقيد وائل غدار من ضباط المديرية العامة للأمن العام</div>
          <span class="news-desc content">
            ثانياً: أقيم المأتم بتاريخ 2026/05/11 وأودع الجثمان كوديعة في جبانة الصادق.
            <a href="https://www.general-security.gov.lb/ar/deaths/details/1165/123">إقرأ المزيد</a>
          </span>
        </div>
        <div class="news-row">
          <span class="news-title">2026/03/07</span>
          <div class="news-title">الشهيد المفتش اول يحيى شكر وفي ما يلي نبذة عن حياة الشهيد:</div>
          <span class="news-desc content">
            من مواليد 19/04/1992 النبي شيت.
            <a href="https://www.general-security.gov.lb/ar/deaths/details/1154/123">إقرأ المزيد</a>
          </span>
        </div>
      </section>
    `;

    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(gsfHtml, {
      status: 200,
      headers: { "content-type": "text/html" },
    })));
    vi.stubGlobal("fetch", fetchMock);

    const previewResponse = await app.inject({
      method: "POST",
      url: "/api/al-wafiyat/import/gsf",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        previewOnly: true,
        limit: 2,
      },
    });

    expect(previewResponse.statusCode).toBe(200);
    const previewBody = previewResponse.json() as {
      ok: boolean;
      items: Array<{ title: string; sourceId: string; sourceProvider: string; noticeDate: string }>;
    };
    expect(previewBody.ok).toBe(true);
    expect(previewBody.items).toEqual([
      expect.objectContaining({
        title: "وفاة السيد حسين محمد غدار والد العقيد وائل غدار من ضباط المديرية العامة للأمن العام",
        sourceId: "gsf",
        sourceProvider: "GENERAL_SECURITY",
        noticeDate: "2026-05-12",
      }),
      expect.objectContaining({
        title: "الشهيد المفتش اول يحيى شكر",
        sourceId: "gsf",
        sourceProvider: "GENERAL_SECURITY",
        noticeDate: "2026-03-07",
      }),
    ]);

    const importResponse = await app.inject({
      method: "POST",
      url: "/api/al-wafiyat/import/gsf",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        limit: 1,
      },
    });

    expect(importResponse.statusCode).toBe(200);
    const importBody = importResponse.json() as {
      items: Array<{ id: string }>;
    };
    const importedId = importBody.items[0]?.id;
    expect(importedId).toBeTruthy();

    const approvalResponse = await app.inject({
      method: "POST",
      url: "/api/al-wafiyat/approve",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        id: importedId,
        action: "APPROVE",
      },
    });

    expect(approvalResponse.statusCode).toBe(200);

    const publicResponse = await app.inject({
      method: "GET",
      url: "/api/al-wafiyat?provider=gsf",
    });

    expect(publicResponse.statusCode).toBe(200);
    const publicBody = publicResponse.json() as {
      items: Array<{ sourceProvider: string; sourceProviderAr: string; rawText: string }>;
    };
    expect(publicBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceProvider: "GENERAL_SECURITY",
        sourceProviderAr: "المديرية العامة للأمن العام",
        rawText: expect.stringContaining("المديرية العامة للأمن العام"),
      }),
    ]));

    const publicLatestResponse = await app.inject({
      method: "GET",
      url: "/api/al-wafiyat?limit=1",
    });

    expect(publicLatestResponse.statusCode).toBe(200);
    const publicLatestBody = publicLatestResponse.json() as {
      items: Array<{ title: string; sourceProvider: string }>;
    };
    expect(publicLatestBody.items).toEqual([
      expect.objectContaining({
        title: "وفاة السيد حسين محمد غدار والد العقيد وائل غدار من ضباط المديرية العامة للأمن العام",
        sourceProvider: "GENERAL_SECURITY",
      }),
    ]);
  });
});