import { expect, test, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const apiUrl = process.env.PLAYWRIGHT_API_URL || "http://127.0.0.1:4001";
const adminUrl = process.env.PLAYWRIGHT_WEB_ADMIN_URL || "http://127.0.0.1:5175";
const modules = ["/superadmin/admin/procedures", "/superadmin/kb", "/superadmin/admin/documents", "/superadmin/news", "/superadmin/jobs", "/superadmin/market", "/superadmin/salary", "/superadmin/school-grants", "/superadmin/crm", "/superadmin/erm", "/superadmin/ads", "/superadmin/system/health", "/superadmin/system/integrations", "/superadmin/audit", "/superadmin/features", "/superadmin/analytics", "/superadmin/diagnostics"];
const runId = `ud3-dashboard-${randomUUID()}`;
let pool: Pool | null = null;
let userId = "";
let email = "";
let password = "";

function envFileValue(text: string, key: string): string {
  const line = text.split(/\r?\n/u).find((candidate) => candidate.match(new RegExp(`^\\s*${key}\\s*=`)));
  if (!line) throw new Error(`${key}_NOT_FOUND`);
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/gu, "");
}

  function assertDisposableDatabaseUrl(value: string): string {
    const parsed = new URL(value);
    if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) || !/(test|apex_v119|ud3|dashboard)/iu.test(decodeURIComponent(parsed.pathname))) throw new Error("UNIVERSAL_DASHBOARD_REQUIRES_DISPOSABLE_DATABASE");
    return value;
  }

async function login(page: Page): Promise<void> {
  await page.addInitScript((origin) => localStorage.setItem("admin_api_url", origin), apiUrl);
  await page.goto(`${adminUrl}/superadmin/cms`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#login-email")).toBeVisible();
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL((url) => url.pathname.includes("/superadmin"));
  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
}

async function assertCleanPage(page: Page, allowExpectedUnavailable = false): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !(allowExpectedUnavailable && message.text().includes("503 (Service Unavailable)"))) errors.push(message.text()); });
  await expect(page.locator("body")).not.toContainText(/Something went wrong|Internal Server Error|Cannot read properties|Loading\.\.\./u);
  expect(errors).toEqual([]);
}

 test.beforeAll(async () => {
  const envText = await readFile("apps/gateway-api/.env", "utf8");
    const databaseUrl = assertDisposableDatabaseUrl(process.env.APEX_V119_TEST_DATABASE_URL || envFileValue(envText, "DATABASE_URL"));
    pool = new Pool({ connectionString: databaseUrl, max: 1 });
  email = `${runId}@acceptance.invalid`;
  password = randomBytes(32).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query<{ id: string }>("INSERT INTO users (email, username, full_name, name, password_hash, role, status) VALUES ($1, $2, $3, $3, $4, 'superadmin', 'active') RETURNING id", [email, runId, "Universal dashboard acceptance", passwordHash]);
  userId = result.rows[0]?.id || "";
  expect(userId).not.toBe("");
});

test.afterAll(async () => { if (pool) { if (userId) { await pool.query("DELETE FROM users WHERE id = $1", [userId]); } await pool.end(); pool = null; } });

test("renders every dashboard module with truthful states and safe mutations", async ({ page }) => {
  await login(page);
  for (const route of modules) {
    const response = await page.goto(`${adminUrl}${route}`, { waitUntil: "domcontentloaded" });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("main, .admin-content, body").first()).toBeVisible();
    await assertCleanPage(page, route === "/superadmin/crm");
  }

  await page.goto(`${adminUrl}/superadmin/erm`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Departments, employees, projects, and vendors have no current owner", { exact: false })).toBeVisible();

  await page.goto(`${adminUrl}/superadmin/features`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("No installation or arbitrary code execution is exposed", { exact: false })).toBeVisible();
  await expect(page.getByText(/features enabled/u)).toBeVisible();

  await page.goto(`${adminUrl}/superadmin/ads`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Placement name").fill(runId);
  await page.getByLabel("Route pattern").fill("/acceptance");
  await page.getByLabel("Creative").fill("Acceptance house creative");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(runId, { exact: true })).toBeVisible();
  const placementRow = page.locator("tr", { hasText: runId });
  await placementRow.getByRole("button", { name: "Disable" }).click();
  await expect(placementRow).toContainText("Disabled");

  await page.goto(`${adminUrl}/superadmin/crm`, { waitUntil: "domcontentloaded" });
  const canaryButton = page.getByRole("button", { name: "Create synthetic canary" });
  if (await canaryButton.count()) {
    await page.getByLabel("Canary namespace").selectOption("PHASE8");
    await canaryButton.click();
    await expect(page.getByText(/Created synthetic PHASE8 canary/u)).toBeVisible();
    const canaryRow = page.locator("tr", { hasText: "APEX-P8-FINAL-CANARY-" }).last();
    await canaryRow.click();
    await expect(page.getByRole("button", { name: "Update canary" })).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Delete canary" }).click();
  } else {
    await expect(page.locator("body")).toContainText(/ERPNext|erpnext|unavailable/iu);
  }
});
