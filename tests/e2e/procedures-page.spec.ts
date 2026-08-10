import { test, expect, type Page } from "@playwright/test";
import { clickWithDomFallback } from "./_helpers";

const WEB_USER_URL = process.env.PLAYWRIGHT_WEB_USER_URL || "http://localhost:5174";

async function disableNativeShare(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => undefined,
      },
    });
  });
}

function proceduresSearchInput(page: Page) {
  return page.getByRole("textbox", { name: /ابحث.*المعاملات/ }).first();
}

async function openProceduresSearch(page: Page) {
  await page.goto(new URL("/procedures", WEB_USER_URL).toString(), { waitUntil: "domcontentloaded" });
  await expect(proceduresSearchInput(page)).toBeVisible({ timeout: 15000 });
}

async function searchTransactions(page: Page, query: string) {
  const input = proceduresSearchInput(page);
  await input.fill(query);

  const searchButton = page.locator(".procs-search__btn").first();
  if (await searchButton.count()) {
    await clickWithDomFallback(searchButton);
  } else {
    await input.press("Enter");
  }

  const transactionsRegion = page.getByRole("region", { name: /نتائج بحث المعاملات/ }).first();
  await expect(transactionsRegion).toBeVisible({ timeout: 15000 });
  return transactionsRegion;
}

async function openFirstMatchingProcedure(page: Page, transactionsRegion: ReturnType<Page["getByRole"]>, queryToken: string) {
  const procedureCard = transactionsRegion
    .locator("article")
    .filter({ hasText: new RegExp(queryToken) })
    .first();

  await expect(procedureCard).toBeVisible({ timeout: 15000 });

  const detailsToggle = procedureCard.getByRole("button", { name: /إظهار تفاصيل المعاملة|إخفاء تفاصيل المعاملة/ }).first();
  await expect(detailsToggle).toBeVisible({ timeout: 15000 });
  await clickWithDomFallback(detailsToggle);

  await expect(procedureCard.getByRole("button", { name: /إخفاء تفاصيل المعاملة|إظهار تفاصيل المعاملة/ }).first()).toBeVisible();
}

async function openFirstModelPreview(page: Page) {
  const modelsRegion = page.getByRole("region", { name: /نتائج بحث النماذج/ }).first();
  await expect(modelsRegion).toBeVisible({ timeout: 15000 });

  const openModelButton = modelsRegion.getByRole("button", { name: /فتح النموذج/ }).first();
  await expect(openModelButton).toBeVisible({ timeout: 15000 });
  await clickWithDomFallback(openModelButton);

  const viewer = page.locator('[data-testid="watany-universal-form-viewer"]').last();
  await expect(viewer).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="form-viewer-close"]').last()).toBeVisible();

  await clickWithDomFallback(page.locator('[data-testid="form-viewer-close"]').last());
  await expect(viewer).toBeHidden({ timeout: 10000 });
}

test("procedures search supports reallocation flow and opens model preview", async ({ page }) => {
  await disableNativeShare(page);
  await openProceduresSearch(page);

  const transactionsRegion = await searchTransactions(page, "إعادة تخصيص");
  await openFirstMatchingProcedure(page, transactionsRegion, "إعادة");
  await openFirstModelPreview(page);
});

test("procedures search supports fuel flow and opens model preview", async ({ page }) => {
  await disableNativeShare(page);
  await openProceduresSearch(page);

  const transactionsRegion = await searchTransactions(page, "محروقات");
  await openFirstMatchingProcedure(page, transactionsRegion, "محروقات");
  await openFirstModelPreview(page);
});
