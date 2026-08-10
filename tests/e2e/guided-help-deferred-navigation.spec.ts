import { test, expect } from "@playwright/test";

const WEB = process.env.PLAYWRIGHT_WEB_USER_URL || "http://127.0.0.1:5174";
const VIEWPORTS = [
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`guided-help deferred navigation ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("retains deferred route, proceeds correctly, and preserves history", async ({ page }) => {
      const consoleErrors: string[] = [];
      const requestFailures: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("requestfailed", (req) => {
        requestFailures.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || "unknown"}`);
      });

      await page.goto(`${WEB}/`, { waitUntil: "domcontentloaded" });

      // Runtime must be installed in browser context.
      const runtimeInstalled = await page.evaluate(() => Boolean((window as any).__watanyPreLandingDeferredNavigationRuntimeInstalled));
      expect(runtimeInstalled).toBe(true);

      const setupGuide = async (route: string) => {
        await page.evaluate((targetRoute) => {
          document.documentElement.setAttribute("data-watany-prelanding-current-route", targetRoute);
          (window as any).__watanyPreLandingPendingNavigation = {
            href: targetRoute,
            startedAt: Date.now(),
            label: "playwright-probe",
          };

          const previous = document.querySelector(".watany-prelanding-guide");
          previous?.remove();

          const guide = document.createElement("div");
          guide.className = "watany-prelanding-guide";

          const dialog = document.createElement("section");
          dialog.className = "watany-prelanding-guide__dialog";
          dialog.setAttribute("data-watany-prelanding-current-route", targetRoute);

          const actions = document.createElement("div");
          actions.className = "watany-prelanding-guide__actions";

          const proceed = document.createElement("button");
          proceed.type = "button";
          proceed.className = "watany-prelanding-guide__proceed";
          proceed.textContent = "متابعة";

          const cancel = document.createElement("button");
          cancel.type = "button";
          cancel.className = "watany-prelanding-guide__cancel";
          cancel.textContent = "إلغاء";

          actions.appendChild(proceed);
          actions.appendChild(cancel);
          dialog.appendChild(actions);
          guide.appendChild(dialog);
          document.body.appendChild(guide);

          (window as any).__ghProbeNavigateEvents = 0;
          const key = "__ghProbeListener";
          const existing = (window as any)[key] as ((event: Event) => void) | undefined;
          if (existing) {
            window.removeEventListener("watany:guided-help-emergency-navigate", existing as EventListener);
          }
          const listener = () => {
            (window as any).__ghProbeNavigateEvents = ((window as any).__ghProbeNavigateEvents || 0) + 1;
          };
          (window as any)[key] = listener;
          window.addEventListener("watany:guided-help-emergency-navigate", listener as EventListener);
        }, route);
      };

      // Cancel path: no navigation.
      await setupGuide("/voting");
      await expect(page.locator(".watany-prelanding-guide__dialog")).toBeVisible();
      await page.locator(".watany-prelanding-guide__cancel").click();
      await page.waitForTimeout(260);
      await expect(page).toHaveURL(/\/$/);

      // Proceed path: single navigation, no loop, and history integrity.
      await setupGuide("/voting");
      await expect(page.locator(".watany-prelanding-guide__dialog")).toBeVisible();
      await page.locator(".watany-prelanding-guide__proceed").click();
      await page.waitForURL("**/voting", { timeout: 10_000 });

      const navEvents = await page.evaluate(() => (window as any).__ghProbeNavigateEvents || 0);
      expect(navEvents).toBeLessThanOrEqual(1);

      // No loop back to root after initial navigation.
      await page.waitForTimeout(400);
      await expect(page).toHaveURL(/\/voting$/);

      await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/$/);
      await page.goForward({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/voting$/);

      const noOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth <= root.clientWidth + 1;
      });
      expect(noOverflow).toBe(true);

      expect(consoleErrors).toEqual([]);
      expect(requestFailures).toEqual([]);
    });
  });
}
