import { test, expect } from "@playwright/test";

// Contract owned by the approved email-first login page, not the retired
// motany-login-redesign transition. Each scenario uses real touch emulation.
const WEB = process.env.PLAYWRIGHT_WEB_USER_URL || "http://127.0.0.1:5174";
const VIEWPORTS = [
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`approved login contract ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    test("email, phone, provider, register and guest transitions", async ({ page }) => {
      const pageErrors: string[] = [];
      const requestFailures: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => {
        requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`);
      });

      const response = await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("main.approved-login-page")).toBeVisible();
      await expect(page.locator("form.approved-login-form")).toBeVisible();
      await expect(page.locator("#email")).toBeVisible();
      await expect(page.locator("#password")).toBeVisible();
      await expect(page.getByRole("button", { name: "تسجيل الدخول", exact: true })).toBeVisible();
      await expect(page.locator(".auth-provider")).toBeVisible();
      await expect(page.locator(".auth-provider")).toContainText(/Google/i);
      await expect(page.getByRole("link", { name: "إنشاء حساب جديد" })).toBeVisible();

      const media = await page.evaluate(() => ({
        touch: navigator.maxTouchPoints,
        coarse: matchMedia("(pointer: coarse)").matches,
        anyCoarse: matchMedia("(any-pointer: coarse)").matches,
        hoverNone: matchMedia("(hover: none)").matches,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(media.touch).toBeGreaterThan(0);
      expect(media.coarse).toBe(true);
      expect(media.anyCoarse).toBe(true);
      expect(media.hoverNone).toBe(true);
      expect(media.overflow).toBeLessThanOrEqual(1);

      await page.getByRole("button", { name: "الدخول لمرة واحدة" }).click();
      await expect(page.locator("#phone")).toBeVisible();
      await expect(page.getByRole("button", { name: "إرسال رمز التحقق" })).toBeVisible();
      await page.getByRole("button", { name: "العودة إلى الدخول بالبريد الإلكتروني" }).click();
      await expect(page.locator("#email")).toBeVisible();
      await expect(page.locator("#password")).toBeVisible();

      await page.getByRole("link", { name: "إنشاء حساب جديد" }).click();
      await expect(page).toHaveURL(/\/register$/);
      await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "المتابعة كزائر" }).click();
      await expect(page).toHaveURL(/\/home$/);

      const finalOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(finalOverflow).toBeLessThanOrEqual(1);
      expect(pageErrors).toEqual([]);
      const unexpectedRequestFailures = requestFailures.filter((entry) => {
        const isGoogle = /accounts\.google\.com/i.test(entry) || (/ssl\.gstatic\.com\/_\/gsi\//i.test(entry) && /ERR_ABORTED/i.test(entry));
        const isAbortedFetch = /\/api\/notifications|fonts\.gstatic\.com|\/watany\/brand\/logo\.png/i.test(entry)
          && /ERR_ABORTED/i.test(entry);
        return !(isGoogle || isAbortedFetch);
      });
      expect(unexpectedRequestFailures).toEqual([]);
    });
  });
}
