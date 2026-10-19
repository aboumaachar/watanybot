import { test, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const apiUrl = process.env.PLAYWRIGHT_API_URL || "http://127.0.0.1:4001";
const payloadUrl = process.env.PLAYWRIGHT_PAYLOAD_URL || "http://127.0.0.1:4101";
const adminUrl = process.env.PLAYWRIGHT_WEB_ADMIN_URL || "http://127.0.0.1:5175";
const userUrl = process.env.PLAYWRIGHT_WEB_USER_URL || "http://127.0.0.1:5174";
const webUserProxyTarget = process.env.PLAYWRIGHT_WEB_USER_PROXY_TARGET || apiUrl;
const sourceControlUrl = process.env.UD2_SOURCE_CONTROL_URL || "";
const payloadDownControlUrl = process.env.UD2_PAYLOAD_DOWN_CONTROL_URL || "";
const requestedScenario = process.env.UD2_EXPECTED_STATE || "ACTIVE";
const stateNames = ["NOT_CONFIGURED", "UNREACHABLE", "AUTH_FAILED", "SCHEMA_INVALID", "READY", "SYNC_FAILED", "ACTIVE"] as const;
const scenarioNames = [...stateNames, "INVALID_B_PRESERVATION", "PAYLOAD_DOWN_CONTINUITY"] as const;
type StateName = typeof stateNames[number];
type ScenarioName = typeof scenarioNames[number];

const stateLabels: Record<StateName, string> = {
  NOT_CONFIGURED: "غير مهيأ",
  UNREACHABLE: "غير قابل للوصول",
  AUTH_FAILED: "فشل المصادقة",
  SCHEMA_INVALID: "مخطط غير صالح",
  READY: "جاهز",
  SYNC_FAILED: "فشل المزامنة",
  ACTIVE: "نشط",
};

if (!scenarioNames.includes(requestedScenario as ScenarioName)) {
  throw new Error("UD2_EXPECTED_STATE_UNSUPPORTED");
}

const scenario = requestedScenario as ScenarioName;
const expectedState: StateName = scenario === "INVALID_B_PRESERVATION"
  ? "SCHEMA_INVALID"
  : scenario === "PAYLOAD_DOWN_CONTINUITY"
  ? "ACTIVE"
  : scenario;
const procedureTitle = "إجراء متقاعدي الجيش UD2";

type Fixture = { id: string; email: string; password: string; pool: Pool; payloadPool: Pool };
let fixture: Fixture | null = null;
let payloadSsoAssertion: string | null = null;
let payloadProcedureId: string | null = null;

function envFileValue(text: string, key: string): string {
  const line = text.split(/\r?\n/u).find((candidate) => candidate.match(new RegExp(`^\\s*${key}\\s*=`)));
  if (!line) throw new Error("UD2_DATABASE_URL_NOT_FOUND");
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/gu, "");
}

async function createFixture(): Promise<Fixture> {
  const envText = await readFile("apps/gateway-api/.env", "utf8");
  const databaseUrl = envFileValue(envText, "DATABASE_URL");
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const payloadPool = new Pool({ connectionString: databaseUrl.replace(/\/[^/?#]+(?=\?|$)/u, "/watanybot_payload"), max: 1 });
  const email = `ud2-${randomUUID()}@acceptance.invalid`;
  const password = randomBytes(32).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (email, username, full_name, name, password_hash, role, status)
     VALUES ($1, $2, $3, $3, $4, 'superadmin', 'active')
     RETURNING id`,
    [email, `ud2_${randomUUID().replace(/-/gu, "")}`, "UD2 Browser Acceptance", passwordHash],
  );
  const id = result.rows[0]?.id;
  if (!id) {
    await pool.end();
    await payloadPool.end();
    throw new Error("UD2_FIXTURE_INSERT_FAILED");
  }
  return { id, email, password, pool, payloadPool };
}

async function cleanupFixture(): Promise<void> {
  if (!fixture) return;
  try {
    if (payloadProcedureId && payloadSsoAssertion) {
      const response = await fetch(`${payloadUrl}/api/procedures/${encodeURIComponent(payloadProcedureId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${payloadSsoAssertion}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok && response.status !== 404) throw new Error("UD2_PAYLOAD_FIXTURE_DELETE_FAILED");
    }
    await fixture.payloadPool.query("DELETE FROM payload_cms.gateway_admins WHERE gateway_user_id IN ($1, $2)", [fixture.id, "ud2-source-service"]);
    await fixture.pool.query("DELETE FROM users WHERE id = $1", [fixture.id]);
  } finally {
    await fixture.pool.end();
    await fixture.payloadPool.end();
    fixture = null;
    payloadProcedureId = null;
    payloadSsoAssertion = null;
  }
}

type BrowserEvidence = {
  requests: Array<{ origin: string; path: string; method: string }>;
  responses: Array<{ origin: string; path: string; method: string; status: number }>;
  requestFailures: string[];
  pageErrors: string[];
  consoleErrors: string[];
};

const browserEvidenceByPage = new WeakMap<Page, BrowserEvidence>();

function sanitizeBrowserMessage(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/giu, "Bearer [REDACTED]")
    .replace(/https?:\/\/[^\s]+/giu, "[URL]");
}

function getBrowserEvidence(page: Page): BrowserEvidence {
  const existing = browserEvidenceByPage.get(page);
  if (existing) return existing;

  const evidence: BrowserEvidence = { requests: [], responses: [], requestFailures: [], pageErrors: [], consoleErrors: [] };
  page.on("request", (request) => {
    const url = new URL(request.url());
    evidence.requests.push({ origin: url.origin, path: url.pathname, method: request.method() });
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    evidence.responses.push({ origin: url.origin, path: url.pathname, method: response.request().method(), status: response.status() });
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    let pageOrigin = "";
    try { pageOrigin = new URL(page.url()).origin; } catch { }
    if (url.pathname === "/g/collect" && url.origin !== pageOrigin) return;
    evidence.requestFailures.push(`${request.method()} ${url.pathname} ${sanitizeBrowserMessage(request.failure()?.errorText || "UNKNOWN")}`);
  });
  page.on("pageerror", (error) => {
    evidence.pageErrors.push(sanitizeBrowserMessage(error.message));
  });
  page.on("console", (message) => {
    if (message.type() === "error") evidence.consoleErrors.push(sanitizeBrowserMessage(message.text()));
  });
  browserEvidenceByPage.set(page, evidence);
  return evidence;
}

function assertBrowserQuality(evidence: BrowserEvidence): void {
  expect(evidence.requestFailures, "browser request failures").toHaveLength(0);
  expect(evidence.pageErrors, "browser page errors").toHaveLength(0);
  expect(evidence.consoleErrors, "browser console errors").toHaveLength(0);
  expect(evidence.responses.filter((response) => response.status >= 500), "browser 5xx responses").toHaveLength(0);
  console.log(`BROWSER_REQUEST_FAILURES=${evidence.requestFailures.length}`);
  console.log(`BROWSER_PAGE_ERRORS=${evidence.pageErrors.length}`);
  console.log(`BROWSER_CONSOLE_ERRORS=${evidence.consoleErrors.length}`);
  console.log(`BROWSER_5XX_RESPONSES=${evidence.responses.filter((response) => response.status >= 500).length}`);
}

async function isolateThirdPartyTelemetry(page: Page): Promise<void> {
  await page.route("**/g/collect**", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
}

async function postControl(url: string, expectedControl: string): Promise<void> {
  if (!url) throw new Error("UD2_CONTROLLER_CONTROL_URL_MISSING");
  const response = await fetch(url, { method: "POST", signal: AbortSignal.timeout(35_000) });
  expect(response.status).toBe(202);
  const body = await response.json() as { control?: string; mode?: string };
  expect(body.control ?? body.mode).toBe(expectedControl);
}

async function setSourceMode(mode: "active" | "schema-invalid"): Promise<void> {
  await postControl(`${sourceControlUrl}/${mode}`, mode);
}

async function stopPayloadForContinuity(): Promise<void> {
  await postControl(payloadDownControlUrl, "PAYLOAD_DOWN_STOPPED");
  console.log("PAYLOAD_DOWN_CONTINUITY_CONTROL=PASS");
}

async function restorePayloadAfterContinuity(): Promise<void> {
  await postControl(process.env.UD2_PAYLOAD_UP_CONTROL_URL || "", "PAYLOAD_UP_READY");
  console.log("PAYLOAD_UP_CLEANUP_CONTROL=PASS");
}

async function loginAdmin(page: Page): Promise<string> {
  getBrowserEvidence(page);
  await page.addInitScript((origin) => {
    localStorage.setItem("admin_api_url", origin);
  }, apiUrl);
  const initial = await page.goto(`${adminUrl}/superadmin/cms`, { waitUntil: "domcontentloaded" });
  expect(initial?.status()).toBe(200);
  await expect(page.locator("#login-email")).toBeVisible();
  if (!fixture) throw new Error("UD2_FIXTURE_NOT_READY");
  const loginResponsePromise = page.waitForResponse((response) => response.url() === `${apiUrl}/api/auth/login` && response.request().method() === "POST");
  const routeChangePromise = page.waitForURL((url) => url.pathname.endsWith("/superadmin/") || url.pathname.endsWith("/superadmin"));
  await page.locator("#login-email").fill(fixture.email);
  await page.locator("#login-password").fill(fixture.password);
  await page.locator("form button[type=submit]").click();
  expect((await loginResponsePromise).status()).toBe(200);
  await routeChangePromise;
  const token = await page.evaluate(() => localStorage.getItem("admin_token"));
  if (!token) throw new Error("UD2_BROWSER_TOKEN_NOT_STORED");
  return token;
}

async function readStatus(request: APIRequestContext, token?: string): Promise<Record<string, any>> {
  const response = await request.get(`${apiUrl}/api/admin/cms/payload-sync/status`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  expect(response.status()).toBe(token ? 200 : 401);
  return token ? await response.json() as Record<string, any> : {};
}

async function triggerSync(request: APIRequestContext, token: string): Promise<number> {
  const response = await request.post(`${apiUrl}/api/admin/cms/payload-sync/sync`, { headers: { Authorization: `Bearer ${token}` } });
  expect([200, 422, 500, 502, 503]).toContain(response.status());
  return response.status();
}

async function assertAuthenticatedMe(request: APIRequestContext, token: string): Promise<void> {
  const response = await request.get(`${apiUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  expect(response.status()).toBe(200);
  const body = await response.json() as { user?: { id?: string; role?: string } };
  expect(body.user?.id).toBe(fixture?.id);
  expect(body.user?.role).toBe("superadmin");
}

async function assertFreshContextDenial(browser: Browser): Promise<void> {
  const context = await browser.newContext();
  try {
    await context.addInitScript((origin) => localStorage.setItem("admin_api_url", origin), apiUrl);
    const page = await context.newPage();
    const response = await page.goto(`${adminUrl}/superadmin/cms`, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator(".cms-payload-sync-state .status-badge")).toHaveCount(0);
  } finally {
    await context.close();
  }
}

async function createPayloadProcedure(request: APIRequestContext, token: string): Promise<void> {
  const assertionResponse = await request.post(`${apiUrl}/api/admin/payload-sso`, { headers: { Authorization: `Bearer ${token}` } });
  expect(assertionResponse.status()).toBe(200);
  const assertionBody = await assertionResponse.json() as { assertion?: string };
  expect(typeof assertionBody.assertion).toBe("string");
  payloadSsoAssertion = assertionBody.assertion || null;
  const createResponse = await fetch(`${payloadUrl}/api/procedures`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${payloadSsoAssertion}` },
    body: JSON.stringify({
      procedureCode: `proc-${randomBytes(4).toString("hex")}`,
      slug: `ud2-${randomUUID()}`,
      title: procedureTitle,
      summary: "إجراء قبول معاملات المتقاعدين",
      category: "pension",
      eligibility: [{ item: "للمتقاعدين العسكريين" }],
      requirements: [{ item: "بطاقة المتقاعد" }],
      steps: [{ item: "تقديم الطلب لدى المرجع المختص" }],
      fees: [{ item: "UD2 acceptance fee" }],
      sourceAuthority: "laf",
      publicationState: "PUBLISHED",
      workflowStatus: "PUBLISHED",
      sourceSystem: "PAYLOAD_CMS",
      _status: "published",
    }),
  });
  expect(createResponse.status).toBe(201);
  const created = await createResponse.json() as { doc?: { id?: string | number }; id?: string | number };
  payloadProcedureId = String(created.doc?.id ?? created.id ?? "");
  expect(payloadProcedureId).not.toBe("");
}

async function assertAdminDashboard(page: Page, state: StateName): Promise<void> {
  const evidence = getBrowserEvidence(page);
  const statusResponsePromise = page.waitForResponse((candidate) => {
    const url = new URL(candidate.url());
    return url.pathname === "/api/admin/cms/payload-sync/status" && candidate.request().method() === "GET";
  });
  await page.goto(`${adminUrl}/superadmin/cms`, { waitUntil: "domcontentloaded" });
  expect((await statusResponsePromise).status()).toBe(200);
  await expect(page.locator(".superadmin-actor")).toBeVisible();
  await expect(page.locator(".cms-payload-sync-state .status-badge")).toHaveText(stateLabels[state]);
  expect(evidence.responses.some((response) => response.path === "/api/admin/cms/payload-sync/status" && response.status === 200)).toBeTruthy();
  assertBrowserQuality(evidence);
  console.log(`STATE_${state}_DASHBOARD_RENDER=PASS`);
  console.log(`STATE_${state}_NETWORK=PASS`);
}

async function assertWebUserAuthority(page: Page, requireTitle: boolean): Promise<void> {
  const evidence = getBrowserEvidence(page);
  await isolateThirdPartyTelemetry(page);
  const catalogResponsePromise = page.waitForResponse((candidate) => {
    const url = new URL(candidate.url());
    return url.pathname === "/api/v2/procedures/catalog" && candidate.request().method() === "GET";
  });
  const response = await page.goto(`${userUrl}/procedures`, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  const catalogResponse = await catalogResponsePromise;
  expect(catalogResponse.status()).toBe(200);
  const catalogBody = await catalogResponse.json() as ProcedureCatalogResponse;
  const catalogContainsTitle = JSON.stringify(catalogBody).includes(procedureTitle);
  const catalogSectionsContainingTitle = (catalogBody.sections || [])
    .filter((section) => JSON.stringify(section).includes(procedureTitle))
    .map((section) => section.id);
  console.log(`WEB_USER_CATALOG_TITLE_SECTIONS=${catalogSectionsContainingTitle.join(",") || "NONE"}`);
  console.log(`WEB_USER_CATALOG_TITLE_PRESENT=${catalogContainsTitle ? "YES" : "NO"}`);
  await expect(page.locator('[data-watany-procedures-page="true"]')).toBeVisible();
  await expect(page.locator('[aria-label="مصادر المعاملات"]')).toBeVisible({ timeout: 15_000 });
  if (requireTitle) {
    const lafSource = page.locator('[role="tab"]').filter({ hasText: "قيادة الجيش" });
    await expect(lafSource).toHaveCount(1);
    await lafSource.click();
    const visibleProcedureTitle = procedureTitle.replace(/\s+UD2$/u, "");
    await expect(page.locator('[data-watany-procedure-card="true"]')).toContainText(visibleProcedureTitle);
  }
  const catalogRequests = evidence.requests.filter((request) => request.path === "/api/v2/procedures/catalog");
  const catalogResponses = evidence.responses.filter((response) => response.path === "/api/v2/procedures/catalog");
  const directPayloadRequests = evidence.requests.filter((request) => request.origin === new URL(payloadUrl).origin);
  const pageOrigin = new URL(page.url()).origin;
  expect(catalogRequests.length).toBeGreaterThan(0);
  expect(catalogResponses.some((item) => item.status === 200)).toBeTruthy();
  expect(catalogRequests.every((item) => item.origin === pageOrigin && item.method === "GET")).toBeTruthy();
  expect(webUserProxyTarget).toBe(apiUrl);
  expect(directPayloadRequests).toHaveLength(0);
  const pageSource = await readFile("apps/web-user/src/pages/ProceduresPage.tsx", "utf8");
  const apiBaseSource = await readFile("apps/web-user/src/lib/api-base.ts", "utf8");
  const viteSource = await readFile("apps/web-user/vite.config.ts", "utf8");
  expect(pageSource).toContain("/api/v2/procedures/catalog");
  expect(apiBaseSource).toContain("Use same-origin as the page so Vite dev server proxy intercepts");
  expect(viteSource).toContain("env.VITE_DEV_PROXY_TARGET");
  assertBrowserQuality(evidence);
  console.log(`WEB_USER_CATALOG_REQUESTS=${catalogRequests.length}`);
  console.log(`WEB_USER_CATALOG_200=${catalogResponses.filter((item) => item.status === 200).length}`);
  console.log(`WEB_USER_DIRECT_PAYLOAD_REQUESTS=${directPayloadRequests.length}`);
  console.log(`STATE_${expectedState}_NETWORK=PASS`);
}

test.describe.configure({ mode: "serial", timeout: 60_000 });
test.describe("UD-2 Layer-B runtime contract", () => {
  test.beforeAll(async () => {
    fixture = await createFixture();
  });

  test.afterAll(async () => {
    await cleanupFixture();
  });

  test("Gateway protected authority and exact state projection", async ({ page, browser, request }) => {
    await readStatus(request);
    const token = await loginAdmin(page);
    await assertAuthenticatedMe(request, token);

    if (scenario === "ACTIVE" || scenario === "INVALID_B_PRESERVATION" || scenario === "PAYLOAD_DOWN_CONTINUITY") {
      await createPayloadProcedure(request, token);
      await triggerSync(request, token);
    } else if (scenario === "UNREACHABLE" || scenario === "AUTH_FAILED" || scenario === "SCHEMA_INVALID" || scenario === "SYNC_FAILED") {
      await triggerSync(request, token);
    }

    if (scenario === "INVALID_B_PRESERVATION") {
      const active = await readStatus(request, token);
      expect(active.state).toBe("ACTIVE");
      const activeRunId = active.active?.runId;
      const activeHash = active.active?.contentHash;
      await setSourceMode("schema-invalid");
      await triggerSync(request, token);
      const failed = await readStatus(request, token);
      expect(failed.state).toBe("SCHEMA_INVALID");
      expect(failed.active?.runId).toBe(activeRunId);
      expect(failed.active?.contentHash).toBe(activeHash);
    }

    const status = await readStatus(request, token);
    expect(stateNames).toContain(status.state);
    expect(status.state).toBe(expectedState);
    expect(status.configured).toBe(scenario !== "NOT_CONFIGURED");
    if (expectedState === "ACTIVE") expect(status.active).not.toBeNull();
    if (scenario !== "INVALID_B_PRESERVATION" && expectedState !== "ACTIVE") expect(status.active).toBeNull();
    console.log(`STATE_${expectedState}_BACKEND=PASS`);
    if (scenario === "PAYLOAD_DOWN_CONTINUITY") await stopPayloadForContinuity();
    await assertAdminDashboard(page, expectedState);
    await assertFreshContextDenial(browser);
  });

  if (scenario === "ACTIVE") {
    test("web-user renders Payload-backed active procedure through Gateway", async ({ page }) => {
      await assertWebUserAuthority(page, true);
    });
  }

  if (scenario === "INVALID_B_PRESERVATION") {
    test("invalid B preserves active A in Gateway and web-user", async ({ page, request }) => {
      const response = await request.get(`${apiUrl}/api/v2/procedures/catalog`);
      expect(response.status()).toBe(200);
      expect(JSON.stringify(await response.json())).toContain(procedureTitle);
      await assertWebUserAuthority(page, true);
    });
  }

  if (scenario === "PAYLOAD_DOWN_CONTINUITY") {
    test("Payload-down continuity keeps Gateway ACTIVE and web-user readable", async ({ page, request }) => {
      try {
        const status = await readStatus(request, await loginAdmin(page));
        expect(status.state).toBe("ACTIVE");
        expect(status.active?.counts?.proceduresPublished).toBeGreaterThan(0);
        console.log("PAYLOAD_DOWN_GATEWAY_ACTIVE=PASS");
        await assertWebUserAuthority(page, true);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator('[data-watany-procedures-page="true"]')).toBeVisible();
        await expect(page.locator('[aria-label="مصادر المعاملات"]')).toBeVisible({ timeout: 15_000 });
        console.log("PAYLOAD_DOWN_WEB_USER_LAST_GOOD=PASS");
      } finally {
        await restorePayloadAfterContinuity();
      }
    });
  }
});
