import { test, expect, type CDPSession, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type ViewportDef = { name: string; width: number; height: number };

const BASE_URL = process.env.PLAYWRIGHT_WEB_USER_URL || "http://127.0.0.1:5174";
const PROBE_DIR = process.env.WATANY_PROBE_DIR || path.join(".pma", "audits", "playwright-probes", "manual-main-menu-probe");

const TOGGLE_TEST_ID = "watany-main-menu-toggle";
const DRAWER_TEST_ID = "watany-main-menu-drawer";
const OVERLAY_TEST_ID = "watany-main-menu-overlay";
const PRIMARY_LINKS_TEST_ID = "watany-main-menu-primary-links";

const VIEWPORTS: ViewportDef[] = [
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
];

const allViewportResults: unknown[] = [];
const allConsoleEvents: Array<{ viewport: string; type: string; text: string }> = [];
const allRequestFailures: Array<{ viewport: string; url: string; method: string; errorText: string }> = [];

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function getMatchedStyles(session: CDPSession, selector: string) {
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  const documentNode = await session.send("DOM.getDocument", { depth: -1, pierce: true });
  const q = await session.send("DOM.querySelector", {
    nodeId: documentNode.root.nodeId,
    selector,
  });

  if (!q.nodeId) {
    return { selector, found: false, matchedCSSRules: [], inherited: [], inlineStyle: null, attributesStyle: null };
  }

  const matched = await session.send("CSS.getMatchedStylesForNode", { nodeId: q.nodeId });
  const computed = await session.send("CSS.getComputedStyleForNode", { nodeId: q.nodeId });

  return {
    selector,
    found: true,
    matchedCSSRules: matched.matchedCSSRules || [],
    inherited: matched.inherited || [],
    inlineStyle: matched.inlineStyle || null,
    attributesStyle: matched.attributesStyle || null,
    cssKeyframesRules: matched.cssKeyframesRules || [],
    pseudoElements: matched.pseudoElements || [],
    computedStyle: computed.computedStyle || [],
  };
}

async function collectGeometry(page: Page) {
  return page.evaluate(({ drawerId, overlayId, linksId }) => {
    const drawer = document.querySelector<HTMLElement>(`[data-testid="${drawerId}"]`);
    const overlay = document.querySelector<HTMLElement>(`[data-testid="${overlayId}"]`);
    const links = document.querySelector<HTMLElement>(`[data-testid="${linksId}"]`);

    function box(el: HTMLElement | null) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
      };
    }

    function style(el: HTMLElement | null) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        direction: cs.direction,
        insetInlineStart: cs.getPropertyValue("inset-inline-start"),
        insetInlineEnd: cs.getPropertyValue("inset-inline-end"),
        insetBlockStart: cs.getPropertyValue("inset-block-start"),
        insetBlockEnd: cs.getPropertyValue("inset-block-end"),
        width: cs.width,
        minWidth: cs.minWidth,
        maxWidth: cs.maxWidth,
        boxSizing: cs.boxSizing,
        padding: cs.padding,
        border: cs.border,
        transform: cs.transform,
        position: cs.position,
        zIndex: cs.zIndex,
        pointerEvents: cs.pointerEvents,
        transitionDuration: cs.transitionDuration,
      };
    }

    const drawerChildren = drawer ? Array.from(drawer.children) : [];
    const drawerChildrenWidths = drawerChildren.map((child) => {
      const el = child as HTMLElement;
      const r = el.getBoundingClientRect();
      return {
        tagName: el.tagName,
        className: el.className,
        width: r.width,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });

    return {
      drawerBox: box(drawer),
      overlayBox: box(overlay),
      primaryLinksBox: box(links),
      drawerChildrenWidths,
      drawerScrollWidth: drawer?.scrollWidth ?? null,
      drawerClientWidth: drawer?.clientWidth ?? null,
      linksScrollWidth: links?.scrollWidth ?? null,
      linksClientWidth: links?.clientWidth ?? null,
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
      drawerStyle: style(drawer),
      overlayStyle: style(overlay),
      linksStyle: style(links),
      drawerOpenAttributes: {
        dataOpen: drawer?.closest("[data-watany-universal-feature-menu]")?.getAttribute("data-open") ?? null,
        ariaHidden: drawer?.getAttribute("aria-hidden") ?? null,
      },
    };
  }, {
    drawerId: DRAWER_TEST_ID,
    overlayId: OVERLAY_TEST_ID,
    linksId: PRIMARY_LINKS_TEST_ID,
  });
}

async function waitForStableDrawerGeometry(page: Page) {
  await page.waitForFunction((drawerId) => {
    const el = document.querySelector<HTMLElement>(`[data-testid="${drawerId}"]`);
    if (!el) return false;
    const key = `${Math.round(el.getBoundingClientRect().width)}:${Math.round(el.getBoundingClientRect().height)}:${getComputedStyle(el).transform}`;
    const current = (window as any).__watanyDrawerStable || { key: "", count: 0 };
    if (current.key === key) {
      current.count += 1;
    } else {
      current.key = key;
      current.count = 1;
    }
    (window as any).__watanyDrawerStable = current;
    return current.count >= 3;
  }, DRAWER_TEST_ID);
}

async function resolveActionableTestIdIndex(page: Page, testId: string): Promise<number> {
  return page.evaluate((id) => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const cs = getComputedStyle(node);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") continue;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;

      const top = document.elementFromPoint(cx, cy);
      if (top && (top === node || node.contains(top))) {
        return i;
      }
    }
    return -1;
  }, testId);
}

for (const vp of VIEWPORTS) {
  test.describe(`canonical main menu ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`deterministic ownership probe ${vp.name}`, async ({ page, context, browserName }) => {
      ensureDir(PROBE_DIR);

      page.on("console", (msg) => {
        allConsoleEvents.push({ viewport: vp.name, type: msg.type(), text: msg.text() });
      });
      page.on("requestfailed", (req) => {
        allRequestFailures.push({
          viewport: vp.name,
          url: req.url(),
          method: req.method(),
          errorText: req.failure()?.errorText || "unknown",
        });
      });

      await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".watany-mobile-shell, [data-watany-universal-feature-menu='true']", { timeout: 30000 });

      let clickToggle = page.locator(`[data-testid="${TOGGLE_TEST_ID}"].menu-toggle`).first();
      if (!(await clickToggle.isVisible())) {
        clickToggle = page
          .locator(
            `[data-testid="${TOGGLE_TEST_ID}"].watany-top-header__burger, ` +
            `[data-testid="${TOGGLE_TEST_ID}"].menu-logo__burger`
          )
          .first();
      }
      const stateToggle = page
        .locator(
          `[data-testid="${TOGGLE_TEST_ID}"].watany-universal-feature-menu__trigger`
        )
        .first();
      const drawer = page.getByTestId(DRAWER_TEST_ID).first();
      const overlay = page.getByTestId(OVERLAY_TEST_ID).first();
      const primaryLinks = page.getByTestId(PRIMARY_LINKS_TEST_ID).first();

      await expect(clickToggle).toBeVisible();
      await expect(stateToggle).toBeVisible();
      await expect(stateToggle).toHaveAttribute("aria-expanded", /false/);
      await expect(drawer).toHaveAttribute("aria-hidden", /true/);

      await page.screenshot({ path: path.join(PROBE_DIR, `${vp.name}-closed.png`), fullPage: true });

      const toggleBox = await clickToggle.boundingBox();
      expect(toggleBox).not.toBeNull();
      expect((toggleBox?.width || 0)).toBeGreaterThanOrEqual(44);
      expect((toggleBox?.height || 0)).toBeGreaterThanOrEqual(44);

      await clickToggle.click({ clickCount: 1 });
      await expect(stateToggle).toHaveAttribute("aria-expanded", /true/);
      await expect(drawer).toHaveAttribute("aria-hidden", /false/);
      await expect(drawer).toBeVisible();
      await expect(overlay).toBeVisible();
      await expect(primaryLinks).toBeVisible();

      const transitionDurationMs = await drawer.evaluate((el) => {
        const raw = getComputedStyle(el).transitionDuration || "0s";
        const first = raw.split(",")[0]?.trim() || "0s";
        if (first.endsWith("ms")) return Number.parseFloat(first.replace("ms", ""));
        if (first.endsWith("s")) return Number.parseFloat(first.replace("s", "")) * 1000;
        return 0;
      });

      if (transitionDurationMs > 0) {
        await page.waitForTimeout(Math.min(2000, transitionDurationMs + 120));
      }
      await waitForStableDrawerGeometry(page);

      const geometry = await collectGeometry(page);
      const drawerSelector = `[data-testid="${DRAWER_TEST_ID}"]`;
      const overlaySelector = `[data-testid="${OVERLAY_TEST_ID}"]`;
      const linksSelector = `[data-testid="${PRIMARY_LINKS_TEST_ID}"]`;

      const session = await context.newCDPSession(page);
      const drawerMatched = await getMatchedStyles(session, drawerSelector);
      const overlayMatched = await getMatchedStyles(session, overlaySelector);
      const linksMatched = await getMatchedStyles(session, linksSelector);

      await page.screenshot({ path: path.join(PROBE_DIR, `${vp.name}-open.png`), fullPage: true });

      const overlayBox = await overlay.boundingBox();
      expect(overlayBox).not.toBeNull();
      const viewport = page.viewportSize();
      const overlayClickX = (overlayBox?.x || 0) + ((overlayBox?.width || 0) / 2);
      const bottomCandidate = (overlayBox?.y || 0) + (overlayBox?.height || 0) - 12;
      const overlayClickY = Math.min(viewport?.height ? viewport.height - 8 : bottomCandidate, Math.max((overlayBox?.y || 0) + 8, bottomCandidate));
      await page.mouse.click(overlayClickX, overlayClickY);
      await expect(stateToggle).toHaveAttribute("aria-expanded", /false/);
      await expect(drawer).toHaveAttribute("aria-hidden", /true/);

      await clickToggle.click();
      await page.keyboard.press("Escape");
      await expect(stateToggle).toHaveAttribute("aria-expanded", /false/);
      await expect(drawer).toHaveAttribute("aria-hidden", /true/);

      await clickToggle.click();
      await expect(drawer).toHaveAttribute("aria-hidden", /false/);
      const headerBox = await page.locator("header.top-menu").first().boundingBox();
      const routeButtons = page.locator(`[data-testid="${PRIMARY_LINKS_TEST_ID}"] button`);
      const routeButtonCount = await routeButtons.count();
      expect(routeButtonCount).toBeGreaterThan(0);
      let routeButtonIndex = 0;
      for (let i = 0; i < routeButtonCount; i += 1) {
        const box = await routeButtons.nth(i).boundingBox();
        if (!box) continue;
        const headerBottom = headerBox ? headerBox.y + headerBox.height : 0;
        if (box.y > headerBottom + 6) {
          routeButtonIndex = i;
          break;
        }
      }
      const routeButton = routeButtons.nth(routeButtonIndex);
      await expect(routeButton).toBeVisible();
      await routeButton.evaluate((el) => {
        (el as HTMLButtonElement).click();
      });
      await expect(stateToggle).toHaveAttribute("aria-expanded", /false/);
      await expect(drawer).toHaveAttribute("aria-hidden", /true/);

      const viewportResult = {
        viewport: vp,
        browserName,
        baseUrl: BASE_URL,
        selectors: {
          toggle: TOGGLE_TEST_ID,
          drawer: DRAWER_TEST_ID,
          overlay: OVERLAY_TEST_ID,
          primaryLinks: PRIMARY_LINKS_TEST_ID,
        },
        toggleHitTarget: toggleBox,
        geometry,
        matchedStyles: {
          drawer: drawerMatched,
          overlay: overlayMatched,
          primaryLinks: linksMatched,
        },
      };

      allViewportResults.push(viewportResult);

      const perViewportFile = path.join(PROBE_DIR, `${vp.name}-probe.json`);
      fs.writeFileSync(perViewportFile, JSON.stringify(viewportResult, null, 2), "utf8");
    });
  });
}

test.afterAll(async ({ browserName }) => {
  ensureDir(PROBE_DIR);

  const metadata = {
    generatedAt: new Date().toISOString(),
    browserName,
    baseUrl: BASE_URL,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };

  const payload = {
    metadata,
    viewportResults: allViewportResults,
    consoleEvents: allConsoleEvents,
    requestFailures: allRequestFailures,
  };

  fs.writeFileSync(path.join(PROBE_DIR, "probe-result.json"), JSON.stringify(payload, null, 2), "utf8");

  if (allRequestFailures.length > 0) {
    throw new Error(`Request failures detected during canonical main menu probe: ${allRequestFailures.length}`);
  }

  const consoleErrors = allConsoleEvents.filter((evt) => evt.type === "error");
  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected during canonical main menu probe: ${consoleErrors.length}`);
  }
});
