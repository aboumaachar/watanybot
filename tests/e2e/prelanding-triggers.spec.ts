import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";

const WEB = process.env.WEB_URL || "http://127.0.0.1:5174";
const PROOF_PATH = process.env.APEX_BROWSER_PROOF_PATH || "";

type PendingEvidence = {
  href: string;
  label: string;
  startedAt: number;
} | null;

type ProceededEventEvidence = {
  route?: string;
  beforeRoute?: string;
  afterRoute?: string;
  navigationConfirmed?: boolean;
};

declare global {
  interface Window {
    __apexPendingAssignments?: PendingEvidence[];
    __apexProceededEvents?: ProceededEventEvidence[];
    __apexSalaryClickCount?: number;
    __apexPopstateCount?: number;
  }
}

test.describe("Prelanding navigation contract", () => {
  test("real salary link click proves pending and route transition contract", async ({
    page,
  }) => {
    const fatalConsole: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];

    await page.addInitScript(() => {
      window.__apexPendingAssignments = [];
      window.__apexProceededEvents = [];
      window.__apexSalaryClickCount = 0;
      window.__apexPopstateCount = 0;

      let pendingBacking:
        | {
            href: string;
            label: string;
            startedAt: number;
          }
        | undefined;

      Object.defineProperty(
        window,
        "__watanyPreLandingPendingNavigation",
        {
          configurable: true,
          enumerable: true,
          get() {
            return pendingBacking;
          },
          set(value) {
            pendingBacking = value;
            window.__apexPendingAssignments?.push(
              value
                ? {
                    href: String(value.href || ""),
                    label: String(value.label || ""),
                    startedAt: Number(value.startedAt || 0),
                  }
                : null,
            );
          },
        },
      );

      window.addEventListener(
        "watany:prelanding:proceeded",
        (event) => {
          const detail =
            (event as CustomEvent<ProceededEventEvidence>).detail || {};
          window.__apexProceededEvents?.push({
            route: detail.route,
            beforeRoute: detail.beforeRoute,
            afterRoute: detail.afterRoute,
            navigationConfirmed: detail.navigationConfirmed,
          });
        },
      );

      window.addEventListener("popstate", () => {
        window.__apexPopstateCount =
          (window.__apexPopstateCount || 0) + 1;
      });

      document.addEventListener(
        "click",
        (event) => {
          const target =
            event.target instanceof Element
              ? event.target
              : null;
          const anchor =
            target?.closest<HTMLAnchorElement>("a[href]") || null;
          if (!anchor) {
            return;
          }
          const url = new URL(anchor.href, window.location.origin);
          if (url.pathname === "/salary") {
            window.__apexSalaryClickCount =
              (window.__apexSalaryClickCount || 0) + 1;
          }
        },
        true,
      );
    });

    page.on("console", (message) => {
      if (message.type() === "error") {
        fatalConsole.push(message.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("requestfailed", (request) => {
      failedRequests.push(
        `${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`,
      );
    });

    await page.goto(`${WEB}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();

    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(
              window.__watanyPreLandingDeferredNavigationRuntimeInstalled,
            ),
          ),
        {
          message:
            "deferred navigation runtime installation marker must be true",
          timeout: 10000,
        },
      )
      .toBe(true);

    const salaryLink = page.locator('a[href="/salary"]').first();
    await expect(salaryLink).toBeVisible();

    const beforeUrl = page.url();
    expect(new URL(beforeUrl).pathname).toBe("/");

    const readyProof = {
      status: "READY_FOR_REAL_CLICK",
      beforeUrl,
      salaryLinkHref: await salaryLink.getAttribute("href"),
      salaryLinkVisible: await salaryLink.isVisible(),
      runtimeInstalled: await page.evaluate(() =>
        Boolean(
          window.__watanyPreLandingDeferredNavigationRuntimeInstalled,
        ),
      ),
      rootVisible: await page.locator("#root").isVisible(),
      mainVisible: await page.locator("main").isVisible(),
    };

    if (PROOF_PATH) {
      writeFileSync(
        PROOF_PATH,
        JSON.stringify(readyProof, null, 2),
        "utf8",
      );
    }

    await Promise.all([
      page.waitForURL(/\/salary(?:[?#].*)?$/, {
        timeout: 10000,
      }),
      salaryLink.click(),
    ]);

    await expect(page.locator("#root")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();

    const afterUrl = page.url();

    const observed = await page.evaluate(() => {
      const root = document.querySelector("#root");
      const main = document.querySelector("main");
      const heading = document.querySelector(
        "main h1, main h2, main [role=heading], #root h1, #root h2, #root [role=heading]",
      );
      const interactiveCount = document.querySelectorAll(
        "main a[href], main button, main input, main select, main textarea, main [role=button]",
      ).length;
      const visibleText = (main?.textContent || root?.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      const normalizedText = visibleText.toLowerCase();
      const routeSpecificText =
        normalizedText.includes("salary") ||
        normalizedText.includes("\u0627\u0644\u0645\u0639\u0627\u0634");
      const pendingAssignments =
        window.__apexPendingAssignments || [];
      const sawSalaryPending = pendingAssignments.some(
        (entry) => entry?.href === "/salary",
      );
      const sawPendingClear =
        pendingAssignments.length > 0 &&
        pendingAssignments[pendingAssignments.length - 1] === null;

      return {
        pathname: window.location.pathname,
        rootPresent: Boolean(root),
        mainPresent: Boolean(main),
        headingPresent: Boolean(heading),
        interactiveCount,
        mainOrRootTextLength: visibleText.length,
        routeSpecificText,
        dialogPresent: Boolean(
          document.querySelector(".watany-prelanding-guide__dialog"),
        ),
        pendingGlobalPresent: Boolean(
          window.__watanyPreLandingPendingNavigation,
        ),
        pendingCurrentRouteAttribute:
          document.documentElement.getAttribute(
            "data-watany-prelanding-current-route",
          ),
        pendingHrefAttribute:
          document.documentElement.getAttribute(
            "data-watany-prelanding-pending-href",
          ),
        pendingAssignments,
        sawSalaryPending,
        sawPendingClear,
        salaryClickCount: window.__apexSalaryClickCount || 0,
        popstateCount: window.__apexPopstateCount || 0,
        proceededEvents: window.__apexProceededEvents || [],
      };
    });

    const materialRequestFailures = failedRequests.filter(
      (entry) =>
        !entry.includes("favicon") &&
        !entry.includes("ERR_ABORTED"),
    );

    const observedProof = {
      status: "OBSERVED_AFTER_REAL_CLICK",
      beforeUrl,
      afterUrl,
      transitionObserved: beforeUrl !== afterUrl,
      destination: observed,
      fatalConsole,
      pageErrors,
      failedRequests: materialRequestFailures,
    };

    if (PROOF_PATH) {
      writeFileSync(
        PROOF_PATH,
        JSON.stringify(observedProof, null, 2),
        "utf8",
      );
    }

    expect(afterUrl).not.toBe(beforeUrl);
    expect(new URL(afterUrl).pathname).toBe("/salary");
    expect(observed.pathname).toBe("/salary");
    expect(observed.rootPresent).toBe(true);
    expect(observed.mainPresent).toBe(true);
    expect(observed.headingPresent).toBe(true);
    expect(observed.mainOrRootTextLength).toBeGreaterThan(20);
    expect(observed.routeSpecificText).toBe(true);
    expect(observed.dialogPresent).toBe(false);
    expect(observed.pendingGlobalPresent).toBe(false);
    expect(observed.pendingCurrentRouteAttribute).toBeNull();
    expect(observed.pendingHrefAttribute).toBeNull();
    expect(observed.sawSalaryPending).toBe(true);
    expect(observed.sawPendingClear).toBe(true);
    expect(observed.salaryClickCount).toBe(1);

    expect(pageErrors).toEqual([]);
    expect(fatalConsole).toEqual([]);
    expect(materialRequestFailures).toEqual([]);

    const finalProof = {
      status: "PASS",
      beforeUrl,
      afterUrl,
      transitionObserved: beforeUrl !== afterUrl,
      destination: observed,
      fatalConsole,
      pageErrors,
      failedRequests: materialRequestFailures,
    };

    if (PROOF_PATH) {
      writeFileSync(
        PROOF_PATH,
        JSON.stringify(finalProof, null, 2),
        "utf8",
      );
    }

    console.log(
      `APEX_V4843_BROWSER_PROOF_JSON=${JSON.stringify(finalProof)}`,
    );
  });
});