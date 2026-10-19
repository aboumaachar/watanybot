import { test, expect } from '@playwright/test';

const WEB_USER_URL = process.env.PLAYWRIGHT_WEB_USER_URL || 'http://localhost:5174';
const WEB_PUBLIC_URL = process.env.PLAYWRIGHT_WEB_PUBLIC_URL
  ? new URL(process.env.PLAYWRIGHT_WEB_PUBLIC_URL, WEB_USER_URL).toString()
  : new URL('/chat', WEB_USER_URL).toString();

test('web-public fallback loads the chat surface', async ({ page }) => {
  await page.goto(WEB_PUBLIC_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.chat-messages').first()).toBeVisible();
  await expect(page.locator('.chat-composer').first()).toBeVisible();
});
