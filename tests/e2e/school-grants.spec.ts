import { test, expect } from "@playwright/test";

const WEB_USER_URL = process.env.PLAYWRIGHT_WEB_USER_URL || "http://localhost:5174";

test("school grants calculator uses the scanned MFE decree as the trusted source", async ({ page }) => {
  await page.goto(new URL("/school-grants", WEB_USER_URL).toString(), { waitUntil: "domcontentloaded" });

  
  // MFE flow activation
  const mfeTab = page.getByRole('button', { name: /تعاونية|MFE|موظفي/i }).first();
  if (await mfeTab.count()) await mfeTab.click();
await expect(page.getByTestId("mfe-grants-calculator")).toBeVisible();
  await page.getByTestId("aid-tab-mfe").click();
  await page.getByTestId("aid-open-mfe-popup").click();

  await page.getByTestId("aid-mfe-section-1").selectOption("A");
  await page.getByTestId("aid-mfe-rate-1").selectOption("0");

  await page.getByTestId("aid-add-mfe-student").click();
  await page.getByTestId("aid-mfe-section-2").selectOption("B");
  await page.getByTestId("aid-mfe-rate-2").selectOption("5");

  await page.getByTestId("aid-calculate-mfe").click();

  await expect(page.getByTestId("aid-results-mfe")).toBeVisible();
  await expect(page.getByTestId("aid-comparison-table")).toBeVisible();
  await expect(page.getByTestId("aid-total-mfe-100")).toHaveText("١٩٩٬٠٠٠٬٠٠٠ ل.ل.");
  await expect(page.getByTestId("aid-total-mfe-50")).toHaveText("٩٩٬٥٠٠٬٠٠٠ ل.ل.");
  await expect(page.getByTestId("aid-export-report")).toBeVisible();
  await expect(page.getByTestId("aid-print-report")).toBeVisible();
  await expect(page.getByTestId("aid-export-report")).toContainText("HTML");
  await expect(page.getByTestId("aid-print-sheet")).toContainText("قرار رقم 2026/40");
  await expect(page.getByTestId("aid-print-sheet")).toContainText("توقيع الموظف المختص");
});