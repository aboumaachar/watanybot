import { test, expect } from "@playwright/test";

const WEB = process.env.PLAYWRIGHT_WEB_USER_URL || "http://127.0.0.1:5174";
const VIEWPORTS = [
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`login contract ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("landing, transition, auth CTAs, and register navigation are stable", async ({ page }) => {
      const consoleErrors: string[] = [];
      const requestFailures: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });
      page.on("requestfailed", (req) => {
        requestFailures.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || "unknown"}`);
      });

      await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" });

      // Landing contract
      await expect(page.locator(".motany-login-redesign")).toHaveCount(1);
      const landingGoogle = page.locator(".motany-login-google").first();
      await expect(landingGoogle).toBeVisible();

      const noOverflowLanding = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth <= root.clientWidth + 1;
      });
      expect(noOverflowLanding).toBe(true);

      // Transition to original login UI.
      await page.locator(".motany-login-primary,.motany-login-input-shell").first().evaluate((el) => {
        (el as HTMLButtonElement).click();
      });
      await expect(page.locator("#phone")).toBeVisible();
      await expect(page.locator("button:has-text('إرسال رمز التحقق')")).toBeVisible();

      // Google auth option exists on the original login surface as well.
      await expect(page.locator(".auth-provider")).toBeVisible();
      await expect(page.locator(".auth-provider").first()).toContainText(/Google/i);

      // Email path exists.
      await page.locator("button:has-text('البريد')").first().evaluate((el) => {
        (el as HTMLButtonElement).click();
      });
      await expect(page.locator("#email")).toBeVisible();
      await expect(page.locator("#password")).toBeVisible();

      // Register navigation from landing works.
      await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" });
      await page.locator(".motany-login-register-link").evaluate((el) => {
        (el as HTMLButtonElement).click();
      });
      await expect(page).toHaveURL(/\/register$/);

      const noOverflowFinal = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth <= root.clientWidth + 1;
      });
      expect(noOverflowFinal).toBe(true);

      const unexpectedConsoleErrors = consoleErrors.filter((entry) => {
        return !/accounts\.google\.com|Failed to load resource/i.test(entry);
      });

      const unexpectedRequestFailures = requestFailures.filter((entry) => {
        const isGoogle = /accounts\.google\.com/i.test(entry);
        const isAbortedNotification = /\/api\/notifications/i.test(entry) && /ERR_ABORTED/i.test(entry);
        const isAbortedFont = /fonts\.gstatic\.com/i.test(entry) && /ERR_ABORTED/i.test(entry);
        const isAbortedBrandLogo = /\/watany\/brand\/logo\.png/i.test(entry) && /ERR_ABORTED/i.test(entry);
        return !(isGoogle || isAbortedNotification || isAbortedFont || isAbortedBrandLogo);
      });

      expect(unexpectedConsoleErrors).toEqual([]);
      expect(unexpectedRequestFailures).toEqual([]);
    });
  });
}
