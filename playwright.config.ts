import { defineConfig, devices } from "@playwright/test";

const webUserUrl = process.env.PLAYWRIGHT_WEB_USER_URL || "http://127.0.0.1:5174";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["dot"]] : [["list"]],
  use: {
    baseURL: webUserUrl,
    browserName: "chromium",
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: "off",
    screenshot: "off",
    video: "off",
    ...devices["Desktop Chrome"],
  },
});
