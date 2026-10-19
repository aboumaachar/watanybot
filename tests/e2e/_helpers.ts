import type { Locator } from "@playwright/test";

export async function clickWithDomFallback(locator: Locator, timeout = 10000) {
  await locator.waitFor({ state: "visible", timeout });
  try {
    await locator.click({ timeout });
  } catch {
    // Some overlays/animations can intercept synthetic clicks in CI.
    await locator.evaluate((el) => (el as HTMLElement).click());
  }
}
