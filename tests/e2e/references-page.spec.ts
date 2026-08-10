import { test, expect } from "@playwright/test";

const WEB_USER_URL = process.env.PLAYWRIGHT_WEB_USER_URL || "http://localhost:5174";
const API_BASE_URL = process.env.PLAYWRIGHT_API_URL || "http://localhost:4000";

test("references page loads embeddable viewers and switches tabs", async ({ page, request }) => {
  await page.goto(new URL("/references", WEB_USER_URL).toString(), { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: "🏢 الشؤون" })).toBeVisible();
  await expect(page.locator(".kb-loading")).toBeHidden({ timeout: 10000 });
  await expect(page.locator(".kb-error")).toHaveCount(0);

  const iframe = page.locator(".kb-iframe");
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute("src", `${API_BASE_URL}/api/v2/procedures/reference/shoon`);

  await page.getByRole("button", { name: "💼 المالية" }).click();
  await expect(page.locator(".kb-loading")).toBeHidden({ timeout: 10000 });
  await expect(page.locator(".kb-error")).toHaveCount(0);
  await expect(page.locator(".kb-iframe")).toHaveAttribute("src", `${API_BASE_URL}/api/v2/procedures/reference/mof`);

  const mofFrame = page.frameLocator(".kb-iframe");
  const mofAttachmentLink = mofFrame.getByRole("link", { name: /طلب اعادة تخصيص معاش تقاعدي - ت7/i }).first();
  await expect(mofAttachmentLink).toHaveAttribute("href", "/api/v2/procedures/reference/mof/asset/DOC-WATANY_MOF_HTML-0006");

  const mofAssetResponse = await request.get(`${API_BASE_URL}/api/v2/procedures/reference/mof/asset/DOC-WATANY_MOF_HTML-0006`);
  expect(mofAssetResponse.url()).toContain("/api/v2/procedures/reference/mof/asset/DOC-WATANY_MOF_HTML-0006");
  expect(mofAssetResponse.headers()["content-type"]).toContain("image/jpeg");

  await page.getByRole("button", { name: "🪖 الجيش" }).click();
  await expect(page.locator(".kb-loading")).toBeHidden({ timeout: 10000 });
  await expect(page.locator(".kb-error")).toHaveCount(0);
  await expect(page.locator(".kb-iframe")).toHaveAttribute("src", `${API_BASE_URL}/api/v2/procedures/reference/laf`);

  const lafFrame = page.frameLocator(".kb-iframe");
  await expect(lafFrame.locator('a[href*="/api/v2/procedures/reference/laf/asset/"]').first()).toBeVisible({ timeout: 10000 });

  const lafTransactionResponse = await request.get(`${API_BASE_URL}/api/v2/procedures/reference/laf/asset/DOC-WATANY_LAF_HTML-0076`, {
    maxRedirects: 0,
  });
  expect(lafTransactionResponse.status()).toBe(302);
  expect(lafTransactionResponse.headers()["location"]).toContain("/api/v2/procedures/reference/laf?focusDoc=DOC-WATANY_LAF_HTML-0076&fallback=1#transaction-76");

  const lafAttachmentResponse = await request.get(`${API_BASE_URL}/api/v2/procedures/reference/laf/asset/DOC-WATANY_LAF_HTML-0113`, {
    maxRedirects: 0,
  });
  expect(lafAttachmentResponse.status()).toBe(302);
  expect(lafAttachmentResponse.headers()["location"]).toContain("/api/v2/procedures/reference/laf?focusDoc=DOC-WATANY_LAF_HTML-0113&fallback=1#transaction-17");
});