import { test, expect, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

type Pool = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
};

const gatewayRequire = createRequire(`${process.cwd()}/apps/gateway-api/package.json`);
const Pool = gatewayRequire("pg").Pool as new (options: { connectionString: string; max: number }) => Pool;
const bcrypt = gatewayRequire("bcryptjs") as { hash(value: string, rounds: number): Promise<string> };

const apiUrl = process.env.PLAYWRIGHT_API_URL || "http://127.0.0.1:4001";
const payloadUrl = process.env.PLAYWRIGHT_PAYLOAD_URL || "http://127.0.0.1:4101";
const sourceUrl = process.env.PLAYWRIGHT_SOURCE_URL || "http://127.0.0.1:4121";
const adminUrl = process.env.PLAYWRIGHT_WEB_ADMIN_URL || "http://127.0.0.1:5175";
const userUrl = process.env.PLAYWRIGHT_WEB_USER_URL || "http://127.0.0.1:5174";

type Fixture = { id: string; email: string; password: string; pool: Pool; payloadPool: Pool };
let fixture: Fixture | null = null;
let token = "";
let assertion = "";
let procedureId = "";
let procedureCode = "";

function envValue(text: string, key: string): string {
  const line = text.split(/\r?\n/u).find((candidate) => candidate.match(new RegExp(`^\\s*${key}\\s*=`)));
  if (!line) throw new Error(`UD3_${key}_MISSING`);
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/gu, "");
}

function assertDisposableDatabaseUrl(value: string): URL {
  const parsed = new URL(value);
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) || !/(test|apex_v119|ud3)/iu.test(decodeURIComponent(parsed.pathname))) {
    throw new Error("UD3_E2E_REQUIRES_LOOPBACK_DISPOSABLE_DATABASE");
  }
  return parsed;
}

async function createFixture(): Promise<Fixture> {
  const configuredDatabaseUrl = process.env.APEX_V119_TEST_DATABASE_URL || process.env.DATABASE_URL;
  const databaseUrl = configuredDatabaseUrl || envValue(await readFile("apps/gateway-api/.env", "utf8"), "DATABASE_URL");
  assertDisposableDatabaseUrl(databaseUrl);
  const configuredPayloadDatabaseUrl = process.env.APEX_V119_PAYLOAD_DATABASE_URL || process.env.PAYLOAD_DATABASE_URL;
  const payloadDatabaseUrl = configuredPayloadDatabaseUrl || databaseUrl;
  assertDisposableDatabaseUrl(payloadDatabaseUrl);
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const payloadPool = new Pool({ connectionString: payloadDatabaseUrl, max: 1 });
  const email = `ud3-${randomUUID()}@acceptance.invalid`;
  const password = randomBytes(32).toString("base64url");
  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (email, name, password_hash, role, status)
     VALUES ($1, $2, $3, 'superadmin', 'active') RETURNING id`,
    [email, "UD3 Editorial Baseline", hash],
  );
  return { id: result.rows[0].id, email, password, pool, payloadPool };
}

async function cleanupFixture(): Promise<void> {
  if (!fixture) return;
  try {
    if (procedureId && assertion) {
      const response = await fetch(`${payloadUrl}/api/procedures/${encodeURIComponent(procedureId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${assertion}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok && response.status !== 404) throw new Error("UD3_SYNTHETIC_DELETE_FAILED");
    }
    await fixture.payloadPool.query("DELETE FROM payload_cms.gateway_admins WHERE gateway_user_id = $1", [fixture.id]);
    await fixture.pool.query("DELETE FROM users WHERE id = $1", [fixture.id]);
  } finally {
    await fixture.payloadPool.end();
    await fixture.pool.end();
    fixture = null;
  }
}

async function login(page: Page): Promise<void> {
  if (!fixture) throw new Error("UD3_FIXTURE_MISSING");
  await page.addInitScript((origin) => localStorage.setItem("admin_api_url", origin), apiUrl);
  await page.goto(`${adminUrl}/superadmin/`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#login-email")).toBeVisible();
  await page.locator("#login-email").fill(fixture.email);
  await page.locator("#login-password").fill(fixture.password);
  const responsePromise = page.waitForResponse((response) => response.url() === `${apiUrl}/api/auth/login` && response.request().method() === "POST");
  await page.locator("form button[type=submit]").click();
  expect((await responsePromise).status()).toBe(200);
  await expect(page.locator(".admin-app")).toBeVisible();
  token = await page.evaluate(() => localStorage.getItem("admin_token") || "");
  expect(token).not.toBe("");
}

test.describe.configure({ mode: "serial", timeout: 90_000 });
test.describe("UD-3 editorial baseline", () => {
  test.beforeAll(async () => { fixture = await createFixture(); });
  test.afterAll(async () => { await cleanupFixture(); });

  test("proves authenticated editorial baseline and reversible synthetic procedure", async ({ page, request }) => {
    await login(page);
    console.log("UD3_BASELINE_GATEWAY_LOGIN=PASS");
    console.log("UD3_BASELINE_SUPERADMIN=PASS");

    await expect(page.getByRole("button", { name: "Content Studio", exact: true })).toBeVisible();
    console.log("UD3_BASELINE_CONTENT_STUDIO=PASS");
    const ssoResponse = await request.post(`${apiUrl}/api/admin/payload-sso`, { headers: { Authorization: `Bearer ${token}` } });
    expect(ssoResponse.status()).toBe(200);
    assertion = ((await ssoResponse.json()) as { assertion: string }).assertion;
    expect(assertion).not.toBe("");
    console.log("UD3_BASELINE_PAYLOAD_SSO=PASS");

    const payloadNavigation = page.waitForURL((url) => url.origin === payloadUrl && url.pathname.startsWith("/admin"));
    await page.getByRole("button", { name: "Content Studio", exact: true }).click();
    await payloadNavigation;
    const payloadResponse = await page.waitForResponse((response) => response.url().startsWith(`${payloadUrl}/admin`)).catch(() => null);
    expect(payloadResponse === null || payloadResponse.status() < 400).toBeTruthy();
    await expect(page.locator("body")).toContainText(/Procedures|procedure/i);
    console.log("UD3_BASELINE_PROCEDURES_COLLECTION=PASS");

    procedureCode = `proc-ud3${randomBytes(4).toString("hex")}`;
    const draft = await fetch(`${payloadUrl}/api/procedures?locale=ar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${assertion}` },
      body: JSON.stringify({ procedureCode, canonicalId: procedureCode, slug: `ud3-${randomUUID()}`, title: "إجراء اختبار التحرير UD3", summary: "إجراء اختباري قابل للتنفيذ لإثبات دورة التحرير والنشر", eligibility: [{ item: "مستخدم اختبار مخول" }], steps: [{ item: "Complete the synthetic editorial check" }], category: "acceptance", sourceAuthority: "procedures", publicationState: "DRAFT", workflowStatus: "DRAFT", _status: "draft" }),
    });
    expect(draft.status).toBe(201);
    procedureId = String((((await draft.json()) as { doc?: { id?: string | number }; id?: string | number }).doc?.id ?? ""));
    expect(procedureId).not.toBe("");
    console.log("UD3_BASELINE_PROCEDURE_DRAFT=PASS");

    const english = await fetch(`${payloadUrl}/api/procedures/${encodeURIComponent(procedureId)}?locale=en`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${assertion}` },
      body: JSON.stringify({ title: "UD3 English draft", summary: "UD3 baseline EN" }),
    });
    expect(english.status).toBe(200);
    console.log("UD3_BASELINE_PROCEDURE_LOCALIZATION=PASS");

    const versions = await fetch(`${payloadUrl}/api/procedures/versions?where%5Bparent%5D%5Bequals%5D=${encodeURIComponent(procedureId)}`, { headers: { Authorization: `Bearer ${assertion}` } });
    expect(versions.ok).toBeTruthy();
    expect(((await versions.json()) as { docs?: unknown[] }).docs?.length || 0).toBeGreaterThan(0);
    console.log("UD3_BASELINE_PROCEDURE_VERSION=PASS");

    for (const locale of ["ar", "en"] as const) {
      const publish = await fetch(`${payloadUrl}/api/procedures/${encodeURIComponent(procedureId)}?locale=${locale}&draft=false`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${assertion}` },
        body: JSON.stringify({ publicationState: "PUBLISHED", workflowStatus: "PUBLISHED", _status: "published" }),
      });
      expect(publish.status).toBe(200);
    }
    const publishedRecord = await fetch(`${payloadUrl}/api/procedures/${encodeURIComponent(procedureId)}?locale=ar`, {
      headers: { Authorization: `Bearer ${assertion}` },
    });
    expect(publishedRecord.status).toBe(200);
    const publishedBody = await publishedRecord.json() as { doc?: Record<string, unknown> } & Record<string, unknown>;
    const publishedDoc = publishedBody.doc || publishedBody;
    console.log(`PAYLOAD_SYNTHETIC_PROCEDURE_ID=${procedureCode}`);
    console.log(`PAYLOAD_SYNTHETIC_DOCUMENT_ID=${String(publishedDoc.id || procedureId)}`);
    console.log(`PAYLOAD_SYNTHETIC_STATUS=${String(publishedDoc._status || "")}`);
    console.log(`PAYLOAD_SYNTHETIC_PROCEDURE_CODE=${String(publishedDoc.procedureCode || "")}`);
    console.log(`PAYLOAD_SYNTHETIC_CANONICAL_ID=${String(publishedDoc.canonicalId || "")}`);
    console.log(`PAYLOAD_SYNTHETIC_STEPS_COUNT=${Array.isArray(publishedDoc.steps) ? publishedDoc.steps.length : 0}`);
    expect(publishedDoc._status).toBe("published");
    expect(publishedDoc.procedureCode).toBe(procedureCode);
    console.log("UD3_BASELINE_PROCEDURE_PUBLISH=PASS");

    const sourceRead = await fetch(`${sourceUrl}/api/procedures?limit=100&page=1&depth=1`, {
      headers: { Authorization: `Bearer ${process.env.UD3_SOURCE_API_TOKEN || assertion}` },
    });
    expect(sourceRead.status).toBe(200);
    const sourcePage = await sourceRead.json() as { docs?: Array<Record<string, unknown>> };
    const sourceRecord = (sourcePage.docs || []).find((record) => String(record.procedureCode || record.canonicalId || "") === procedureCode);
    console.log(`SYNC_SOURCE_SYNTHETIC_RECORD_PRESENT=${sourceRecord ? "YES" : "NO"}`);
    if (sourceRecord) {
      console.log(`SYNC_SOURCE_STATUS=${String(sourceRecord._status || "")}`);
      console.log(`SYNC_SOURCE_CANONICAL_ID=${String(sourceRecord.canonicalId || "")}`);
      console.log(`SYNC_SOURCE_TITLE_AR=${String(sourceRecord.titleAr || "")}`);
      console.log(`SYNC_SOURCE_TITLE_EN=${String(sourceRecord.titleEn || "")}`);
      console.log(`SYNC_SOURCE_TITLE_RAW=${JSON.stringify(sourceRecord.title)}`);
      console.log(`SYNC_SOURCE_STEPS_COUNT=${Array.isArray(sourceRecord.steps) ? sourceRecord.steps.length : 0}`);
      console.log(`SYNC_SOURCE_STEPS=${JSON.stringify(sourceRecord.steps)}`);
      console.log(`SYNC_SOURCE_SUMMARY_AR=${String(sourceRecord.summaryAr || "")}`);
    }
    expect(sourceRecord).toBeTruthy();

    const sync = await request.post(`${apiUrl}/api/admin/cms/payload-sync/sync`, { headers: { Authorization: `Bearer ${token}` } });
    expect(sync.status()).toBe(200);
    console.log("UD3_BASELINE_GATEWAY_SYNC=PASS");
    const syncStatus = await request.get(`${apiUrl}/api/admin/cms/payload-sync/status`, { headers: { Authorization: `Bearer ${token}` } });
    expect(syncStatus.status()).toBe(200);
    const syncStatusBody = await syncStatus.json() as { active?: { counts?: { proceduresFetched?: number; proceduresPublished?: number }; contentHash?: string }; lastRun?: { counts?: { proceduresFetched?: number; proceduresPublished?: number }; contentHash?: string; state?: string } };
    console.log(`SYNC_RESULT_NATIVE_STATUS=${String(syncStatusBody.lastRun?.state || "")}`);
    console.log(`SYNC_SOURCE_RECORD_COUNT=${String(syncStatusBody.lastRun?.counts?.proceduresFetched ?? "")}`);
    console.log(`SYNC_NORMALIZED_RECORD_COUNT=${String(syncStatusBody.lastRun?.counts?.proceduresPublished ?? "")}`);
    console.log(`SYNC_ACTIVE_HASH=${String(syncStatusBody.active?.contentHash || "")}`);
    const publicRead = await request.get(`${apiUrl}/api/v2/procedures/${encodeURIComponent(procedureCode)}`);
    if (publicRead.status() !== 200) console.log(`PUBLIC_READ_BODY=${JSON.stringify(await publicRead.json())}`);
    expect(publicRead.status()).toBe(200);
    const publicProcedure = (await publicRead.json() as { procedure?: { id?: string; title_ar?: string; title_en?: string } }).procedure;
    expect(publicProcedure?.id).toBe(procedureCode);
    expect(publicProcedure?.title_ar).toContain("إجراء اختبار التحرير UD3");
    expect(publicProcedure?.title_en).toContain("UD3 English");
    console.log("UD3_BASELINE_PUBLIC_GATEWAY_READ=PASS");
    await page.goto(`${userUrl}/procedures`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-watany-procedures-page="true"]')).toBeVisible();
    console.log("UD3_BASELINE_WEB_USER_READ=PASS");
  });
});