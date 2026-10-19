import { test, expect } from "@playwright/test";

const WEB_USER_URL = process.env.PLAYWRIGHT_WEB_USER_URL || "http://localhost:5174";
const SHELL_TOPBAR_SELECTOR = ".watany-mobile-shell__topbar, [data-wmo-shell-top-nav='true'], .screen-header, .top-menu, [aria-label='الشريط العلوي']";
const SHELL_NAV_SELECTOR = ".tab-bar, .bottom-tab-bar, .bottom-tab-rail, [data-testid='bottom-tab-bar'], [data-testid='bottom-tab-rail'], [data-wmo-shell-dock='true'], .nav-bottom-tab-rail, [aria-label='الوصول السريع'], [aria-label='التنقل الرئيسي']";

const DEVICE_MATRIX = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-12", width: 390, height: 844 },
  { name: "galaxy-s21", width: 360, height: 800 },
  { name: "ipad-mini", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

const ROUTES = [
  { path: "/", readySelector: "section[aria-label='WatanyBot services']", extraSelector: "a[href='/salary']" },
  { path: "/services", readySelector: "section[aria-label='WatanyBot services']", extraSelector: "a[href='/salary']" },
  { path: "/faq", readySelector: "[aria-label='البحث داخل الأسئلة']", extraSelector: "input[placeholder='ابحث في الأسئلة الشائعة']" },
  { path: "/salary", readySelector: "h3:has-text('حاسبة المعاش')", extraSelector: "button:has-text('ابدأ الاحتساب')" },
  { path: "/school-grants", readySelector: "[aria-label='اختصارات المنح المدرسية']", extraSelector: "button:has-text('الحاسبة')" },
] as const;

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
}

async function assertCoreShell(page: import("@playwright/test").Page) {
  await expect(page.locator(".app-shell")).toBeVisible();
  const nav = page.getByRole("navigation").or(page.locator(SHELL_NAV_SELECTOR)).first();
  await expect(nav).toBeVisible();
  await expect(page.getByRole("region", { name: /الشريط العلوي|top/i }).or(page.locator(SHELL_TOPBAR_SELECTOR)).first()).toBeVisible();

  const tabBarBox = await nav.boundingBox();
  expect(tabBarBox).not.toBeNull();
  expect(tabBarBox!.height).toBeGreaterThan(40);
}

for (const device of DEVICE_MATRIX) {
  test.describe(`mobile validation ${device.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height });
    });

    for (const route of ROUTES) {
      test(`${route.path} keeps shell visible at ${device.width}x${device.height}`, async ({ page }) => {
        await page.goto(new URL(route.path, WEB_USER_URL).toString(), { waitUntil: "domcontentloaded" });

        await assertCoreShell(page);
        await expect(page.locator(route.readySelector).first()).toBeVisible();
        await expect(page.locator(route.extraSelector).first()).toBeVisible();
        await assertNoHorizontalOverflow(page);

        if (route.path === "/" || route.path === "/services") {
          const servicesRegion = await page.locator("section[aria-label='WatanyBot services']").first().boundingBox();
          expect(servicesRegion).not.toBeNull();
          expect(servicesRegion!.width).toBeGreaterThan(240);
        }
      });
    }
  });
}