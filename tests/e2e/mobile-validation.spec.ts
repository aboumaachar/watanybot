import { test, expect, type Page } from "@playwright/test";

const WEB = process.env.PLAYWRIGHT_WEB_USER_URL || "http://127.0.0.1:5174";
const DEVICE_MATRIX = [
  { name: "iphone-se", width: 375, height: 667, touch: true },
  { name: "iphone-12", width: 390, height: 844, touch: true },
  { name: "galaxy-s21", width: 360, height: 800, touch: true },
  { name: "ipad-mini", width: 768, height: 1024, touch: true },
  { name: "desktop", width: 1280, height: 800, touch: false },
] as const;

const ROUTES = [
  { path: "/", marker: "landing" },
  { path: "/services", marker: "recovery-unavailable" },
  { path: "/faq", marker: "faq-search" },
  { path: "/salary", marker: "salary-content" },
  { path: "/school-grants", marker: "grant-content" },
] as const;

async function assertShellAndContent(page: Page, marker: (typeof ROUTES)[number]["marker"], touch: boolean) {
  await expect(page.locator("main.watany-recovery-main")).toBeVisible();
  await expect(page.locator("header.watany-recovery-topbar")).toHaveCount(1);
  const nav = page.locator("nav.watany-recovery-bottom");
  await expect(nav).toBeVisible();
  const navLinks = nav.locator("a[href]");
  await expect(navLinks).toHaveCount(4);
  for (const href of ["/home", "/profile", "/login", "/community"]) {
    await expect(nav.locator(`a[href="${href}"]`)).toBeVisible();
  }

  const metrics = await page.evaluate(() => {
    const navigation = document.querySelector("nav.watany-recovery-bottom");
    const rect = navigation?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      navHeight: rect?.height ?? 0,
      navWidth: rect?.width ?? 0,
      touchPoints: navigator.maxTouchPoints,
      pointerCoarse: matchMedia("(pointer: coarse)").matches,
      anyPointerCoarse: matchMedia("(any-pointer: coarse)").matches,
      hoverNone: matchMedia("(hover: none)").matches,
    };
  });
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  expect(metrics.navHeight).toBeGreaterThan(40);
  expect(metrics.navWidth).toBeGreaterThan(240);
  if (touch) {
    expect(metrics.touchPoints).toBeGreaterThan(0);
    expect(metrics.pointerCoarse).toBe(true);
    expect(metrics.anyPointerCoarse).toBe(true);
    expect(metrics.hoverNone).toBe(true);
  }

  switch (marker) {
    case "landing":
      await expect(page.getByRole("heading", { name: /أهلاً بك في موطني/ })).toBeVisible();
      await expect(page.locator("main.watany-recovery-main")).toContainText("تسجيل الدخول");
      break;
    case "recovery-unavailable":
      // The current /services route is explicitly in recovery mode. Do not
      // report service-catalog functionality as accepted when unavailable.
      await expect(page.getByRole("heading", { name: /هذه الميزة خارج النسخة النظيفة/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /العودة إلى الخدمات الأساس/ })).toBeVisible();
      break;
    case "faq-search":
      await expect(page.getByPlaceholder("ابحث في الأسئلة الشائعة")).toBeVisible();
      break;
    case "salary-content":
      await expect(page.locator("main.watany-recovery-main")).toContainText(/معاش/);
      break;
    case "grant-content":
      await expect(page.locator("main.watany-recovery-main").getByText("القرار الوزاري", { exact: true })).toBeVisible();
      await expect(page.locator("main.watany-recovery-main").getByText("طلب مساعدة", { exact: true })).toBeVisible();
      break;
  }
}

for (const device of DEVICE_MATRIX) {
  test.describe(`recovery shell ${device.name}`, () => {
    test.use({
      viewport: { width: device.width, height: device.height },
      hasTouch: device.touch,
      isMobile: device.touch,
      deviceScaleFactor: 2,
    });

    for (const route of ROUTES) {
      test(`${route.path} renders approved recovery navigation at ${device.width}x${device.height}`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        test.setTimeout(60_000);
        const response = await page.goto(new URL(route.path, WEB).toString(), {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        expect(response?.status()).toBe(200);
        await assertShellAndContent(page, route.marker, device.touch);
        expect(errors).toEqual([]);
      });
    }
  });
}
