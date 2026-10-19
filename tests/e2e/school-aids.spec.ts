import { test, expect } from "@playwright/test";

const WEB_URL = process.env.WEB_URL || "http://localhost:5174";

test.describe("School grants page", () => {
  test("has download links for expected assets", async ({ page }) => {
    await page.goto(`${WEB_URL}/school-grants`);
    await page.waitForSelector("#school-grants-forms");

    const downloadAnchors = page.locator("#school-grants-forms a[download]");
    const count = await downloadAnchors.count();
    expect(count).toBeGreaterThan(0);

    // Click the first preview button and assert the in-app viewer opens
    const previewButtons = page.locator("#school-grants-forms button:has-text('عرض')");
    if ((await previewButtons.count()) > 0) {
      await previewButtons.nth(0).click();
      // viewer backdrop/root should appear
      await page.waitForSelector('#watany-form-viewer-root', { timeout: 3000 });
      const viewer = await page.locator('#watany-form-viewer-root');
      await expect(viewer).toBeVisible();
    }

    // Check for specific known assets
    const hrefs = await downloadAnchors.evaluateAll((nodes) => nodes.map((n) => (n as HTMLAnchorElement).href));
    const foundAnnexZ = hrefs.some((h) => h.endsWith("/school-aids/forms/annex-z.pdf") || h.endsWith("/school-aids/forms/annex-z.html"));
    const foundAnnexJ = hrefs.some((h) => h.endsWith("/school-aids/forms/annex-j.pdf") || h.endsWith("/school-aids/forms/annex-j.html"));
    const foundCert = hrefs.some((h) => h.endsWith("/school-aids/forms/school-year-completion-certificate.pdf") || h.endsWith("/school-aids/forms/school-year-completion-certificate.html"));

    expect(foundAnnexZ).toBeTruthy();
    expect(foundAnnexJ).toBeTruthy();
    expect(foundCert).toBeTruthy();
  });
});
