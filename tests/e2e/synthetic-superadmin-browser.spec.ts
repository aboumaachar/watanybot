import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const TEST_DB = "gate2_superadmin_e2e_20261012";
const API = "http://127.0.0.1:4012";
const ADMIN = "http://127.0.0.1:5175";
const SUPERADMIN_GATE = process.env.GATE2_SUPERADMIN_ISOLATED_GATEWAY;

function sqlInIsolatedDatabase(sql: string, expected: RegExp): void {
  // Fail closed on any error. Never select a DB from the environment.
  const child = spawnSync("docker", [
    "exec", "watanybot-postgres", "psql", "-X", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", TEST_DB, "-c", sql,
  ], { encoding: "utf8", timeout: 15_000, shell: false, windowsHide: true });
  const stderr = (child.stderr || "").trim();
  const stdout = child.stdout || "";
  if (child.error || child.signal || child.status !== 0 || stderr || !expected.test(stdout.trim())) {
    throw new Error(`ISOLATED_SQL_FAILURE status=${child.status} signal=${child.signal} stderr=${stderr.slice(0, 260)} stdout=${stdout.slice(0, 260)}`);
  }
}

async function syntheticIdentity(request: APIRequestContext, role: "public" | "superadmin") {
  const code = randomUUID().replace(/-/g, "").slice(0, 18);
  const email = `gate2_${role}_${code}@example.invalid`;
  const password = `SyntheticOnly-${randomUUID()}-A1!`;
  const response = await request.post(`${API}/api/auth/register`, {
    data: { email, username: `gate2_${code}`, fullName: `Synthetic Gate 2 ${role}`, password, rememberMe: true },
  });
  expect(response.status()).toBe(201);
  const data = await response.json();
  expect(data.user.email).toBe(email);
  expect(data.user.role).toBe("public");
  if (role === "superadmin") {
    // The synthetic identity registers normally. Only its isolated DB role is
    // elevated by fixture setup, not an auth bypass or forged administrator JWT.
    sqlInIsolatedDatabase(
      `UPDATE public.users SET role='superadmin' WHERE id='${data.user.id}' AND email='${email}' AND role='public'`,
      /^UPDATE 1$/,
    );
  }
  return { email, password, id: String(data.user.id) };
}

async function isolateAdminBrowser(context: BrowserContext): Promise<void> {
  expect(SUPERADMIN_GATE).toBe(API);
  const check = await context.request.get(`${API}/health`);
  expect(check.status()).toBe(200);
  await context.addInitScript((localOrigin: string) => {
    if (globalThis.location.origin === localOrigin) {
      localStorage.setItem("admin_api_url", localOrigin);
    }
  }, ADMIN);
  await context.route("**/api/**", async (route) => {
    const current = new URL(route.request().url());
    if (current.origin !== ADMIN) {
      await route.continue();
      return;
    }
    const upstream = await route.fetch({
      url: `${API}${current.pathname}${current.search}`,
      timeout: 20_000,
    });
    await route.fulfill({ response: upstream });
  });
}

async function browserAdminLogin(page: Page, email: string, password: string) {
  const response = await page.goto(`${ADMIN}/ops/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Watany Ops" })).toBeVisible();
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  const login = page.waitForResponse((r) => r.url().endsWith("/api/auth/login") && r.request().method() === "POST");
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  const accepted = await login;
  expect(accepted.status()).toBe(200);
  // AdminLoginPage immediately reloads the document after successful login.
  // Read the session from the new page, not an unloaded response body.
  await expect(page.locator(".admin-app")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("main.admin-main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "لوحة الإدارة" })).toBeVisible();
  const accessToken = await page.evaluate(() => localStorage.getItem("admin_token"));
  expect(accessToken).toBeTruthy();
  const profile = await page.evaluate(async (token) => {
    const response = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    return { status: response.status, payload: await response.json() };
  }, accessToken);
  expect(profile.status).toBe(200);
  expect(profile.payload.user.email).toBe(email);
  expect(profile.payload.user.role).toBe("superadmin");
  return String(accessToken);
}

test.describe("Gate 2 real synthetic superadmin browser session", () => {
  test.setTimeout(95_000);

  test("normal superadmin login, dashboard, role enforcement, reload persistence and logout", async ({ page, context, request }) => {
    await isolateAdminBrowser(context);
    const publicIdentity = await syntheticIdentity(request, "public");
    const publicLogin = await request.post(`${API}/api/auth/login`, {
      data: { email: publicIdentity.email, password: publicIdentity.password },
    });
    expect(publicLogin.status()).toBe(200);
    const publicToken = String((await publicLogin.json()).accessToken);
    const publicAdmin = await request.get(`${API}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${publicToken}` } });
    expect(publicAdmin.status()).toBe(403);

    const admin = await syntheticIdentity(request, "superadmin");
    const adminToken = await browserAdminLogin(page, admin.email, admin.password);
    const dashboard = await page.evaluate(async (token) => {
      const response = await fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` } });
      return response.status;
    }, adminToken);
    expect(dashboard).toBe(200);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".admin-app")).toBeVisible({ timeout: 20_000 });
    const preserved = await page.evaluate(() => Boolean(localStorage.getItem("admin_token")));
    expect(preserved).toBe(true);
    const stillAuthorized = await page.evaluate(async (token) =>
      (await fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` } })).status, adminToken);
    expect(stillAuthorized).toBe(200);

    const logout = page.waitForResponse((r) => r.url().endsWith("/api/auth/logout") && r.request().method() === "POST");
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    expect((await logout).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Watany Ops" })).toBeVisible({ timeout: 15_000 });
    expect(await page.evaluate(() => localStorage.getItem("admin_token"))).toBeNull();

    const revoked = await page.evaluate(async (token) =>
      (await fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` } })).status, adminToken);
    expect(revoked).toBe(401);
  });

  test("expired real database session and invalid bearer token are refused", async ({ page, context, request }) => {
    await isolateAdminBrowser(context);
    const admin = await syntheticIdentity(request, "superadmin");
    const accessToken = await browserAdminLogin(page, admin.email, admin.password);
    const malformed = await page.evaluate(async (token) =>
      (await fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}invalid` } })).status, accessToken);
    expect(malformed).toBe(401);

    // Expire only the synthetic session for this isolated user.
    sqlInIsolatedDatabase(
      `UPDATE public.sessions SET expires_at=now()-interval '1 hour' WHERE user_id='${admin.id}' AND expires_at>now()`,
      /^UPDATE [1-9][0-9]*$/,
    );
    const expired = await page.evaluate(async (token) =>
      (await fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` } })).status, accessToken);
    expect(expired).toBe(401);

    const refresh = await page.evaluate(async () => {
      const csrf = document.cookie.split("; ").find((c) => c.startsWith("watany_csrf="))?.split("=")[1] || "";
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "x-csrf-token": decodeURIComponent(csrf) },
        credentials: "include",
      });
      return response.status;
    });
    expect(refresh).toBe(401);
  });
});
