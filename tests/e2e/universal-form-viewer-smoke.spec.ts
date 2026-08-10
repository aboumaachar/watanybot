import { test, expect } from "@playwright/test";
import { clickWithDomFallback } from "./_helpers";

const WEB_USER_URL = process.env.PLAYWRIGHT_WEB_USER_URL || "http://localhost:5174";

test("school grants local html form opens in the universal viewer", async ({ page }) => {
  await page.goto(new URL("/school-grants", WEB_USER_URL).toString(), { waitUntil: "domcontentloaded" });

  // Support both card-based view buttons and the newer shortcuts grid
  const viewButton = page.locator(".school-aid-item-card__actions button, button:has-text(\"طلب مساعدة\"), button:has-text(\"النماذج\"), button:has-text(\"عرض\")").first();
  await expect(viewButton).toBeVisible({ timeout: 10000 });
  await viewButton.click();

  const viewer = page.locator('[data-testid="watany-universal-form-viewer"]').last();
  // If clicking the shortcut navigates to a listing, try clicking the first card's preview/view button.
  const openedFromShortcut = await viewer.isVisible();
  if (!openedFromShortcut) {
    const fallbackCardView = page.locator('.school-aid-item-card__actions button, article button:has-text("معاينة"), article button:has-text("عرض")').first();
    await expect(fallbackCardView).toBeVisible({ timeout: 10000 });
    await clickWithDomFallback(fallbackCardView);
    await expect(viewer).toBeVisible({ timeout: 10000 });
  }

  await expect(viewer).toBeVisible({ timeout: 10000 });

  await page.locator('[data-testid="form-viewer-close"]').last().click();
  await expect(viewer).toBeHidden();
});

test("guided procedures form opens in the universal viewer", async ({ page }) => {
  await page.goto(new URL("/procedures", WEB_USER_URL).toString(), { waitUntil: "domcontentloaded" });

  // Older UI used .case-header, newer UI lists articles with a details button.
  const firstCaseToggle = page.locator('.case-header, article button:has-text("إظهار تفاصيل المعاملة"), article button').first();
  await expect(firstCaseToggle).toBeVisible({ timeout: 15000 });
  await firstCaseToggle.click();

  // The forms area can be details-based or inline. Find a form trigger inside the expanded article.
  const expandedArticle = page
    .locator("article")
    .filter({ has: page.locator('button[aria-expanded="true"], button:has-text("إخفاء تفاصيل المعاملة")') })
    .first();
  await expect(expandedArticle).toBeVisible({ timeout: 10000 });

  const previewButton = expandedArticle
    .locator('[data-testid^="mof-procedure-cta-"], button:has-text("PDF"), .form-action-btn--primary, button:has-text("معاينة"), button:has-text("عرض")')
    .first();
  await expect(previewButton).toBeVisible({ timeout: 15000 });
  await clickWithDomFallback(previewButton);

  const viewer = page.locator('[data-testid="watany-universal-form-viewer"]').last();
  await expect(viewer).toBeVisible({ timeout: 10000 });

  await page.locator('[data-testid="form-viewer-close"]').last().click();
  await expect(viewer).toBeHidden();
});