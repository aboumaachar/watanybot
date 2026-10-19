import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

// Only runs with an explicitly named, isolated schema-only PostgreSQL database
// behind this dedicated loopback gateway. Never use canonical WatanyBot data.
const ISOLATED = process.env.GATE2_AUTH_E2E_ISOLATED_GATEWAY || "";
const WEB = process.env.PLAYWRIGHT_WEB_USER_URL || "http://127.0.0.1:5174";

test("synthetic user registers, fails bad password, logs in and cannot access admin routes", async ({ page, context, request }) => {
  expect(ISOLATED).toBe("http://127.0.0.1:4011");

  const ready = await request.get(`${ISOLATED}/health`);
  expect(ready.status()).toBe(200);

  const userId = randomUUID().replace(/-/g, "").slice(0, 16);
  const email = `gate2_${userId}@example.invalid`;
  const password = `Synthetic-Acceptance-${randomUUID()}-a1!`;
  const registration = await request.post(`${ISOLATED}/api/auth/register`, {
    data: {
      email,
      username: `gate2_${userId}`,
      fullName: "Gate 2 Synthetic Browser Account",
      password,
      rememberMe: false,
    },
  });
  expect(registration.status()).toBe(201);
  const registered = await registration.json();
  expect(registered.user.email).toBe(email);
  expect(registered.user.role).toBe("public");

  // Preserve the full Vite UI but send API calls to the dedicated isolated
  // gateway, so no synthetic credentials or records touch port 4000.
  await context.route("**/api/**", async (route) => {
    const address = new URL(route.request().url());
    if (address.origin !== new URL(WEB).origin) {
      await route.continue();
      return;
    }
    const upstream = await route.fetch({
      url: `${ISOLATED}${address.pathname}${address.search}`,
      timeout: 20_000,
    });
    await route.fulfill({ response: upstream });
  });

  await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("form.approved-login-form")).toBeVisible();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Incorrect-Synthetic-Password!");
  const deniedLogin = page.waitForResponse((r) =>
    r.url().endsWith("/api/auth/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  expect((await deniedLogin).status()).toBe(401);
  await expect(page.locator(".auth-error--global")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await page.locator("#password").fill(password);
  const acceptedLogin = page.waitForResponse((r) =>
    r.url().endsWith("/api/auth/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  const response = await acceptedLogin;
  expect(response.status()).toBe(200);
  const auth = await response.json();
  expect(auth.user.email).toBe(email);
  expect(auth.user.role).toBe("public");
  expect(typeof auth.accessToken).toBe("string");

  await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  await expect(page.locator("nav.watany-recovery-bottom")).toBeVisible();

  const protectedResponse = await page.evaluate(async (token) => {
    const result = await fetch("/api/admin/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    return result.status;
  }, auth.accessToken);
  expect(protectedResponse).toBe(403);

  const tamperedResponse = await page.evaluate(async (token) => {
    const result = await fetch("/api/admin/dashboard", {
      headers: { Authorization: `Bearer ${token}tampered` },
    });
    return result.status;
  }, auth.accessToken);
  expect(tamperedResponse).toBe(401);
});
