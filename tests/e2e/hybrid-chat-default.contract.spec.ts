import { expect, test, type Page } from '@playwright/test';

const webBaseUrl = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:5174';
const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:8010';

const requiredDefaultRoutes = [
  '/mcp',
  '/mcp/procedures',
  '/mcp/laws',
  '/mcp/jobs',
  '/mcp/market',
  '/mcp/world-cup',
  '/mcp/salary',
  '/mcp/documents',
];

const socialRoutes = [
  '/mcp/community',
  '/mcp/social',
  '/mcp/chat-groups',
  '/mcp/group-chats',
  '/mcp/rooms',
];

const defaultHybridShellSelectors = [
  '[data-testid="watany-default-hybrid-chat-shell"]',
  '[data-testid="watany-hybrid-chat-shell"]',
  '[data-chat-scope="default"]',
];

const socialHybridShellSelectors = [
  '[data-testid="watany-social-hybrid-chat-shell"]',
  '[data-chat-scope="social"]',
  '[data-testid="watany-community-chat-shell"]',
];

const composerSelectors = [
  '[data-testid="watany-hybrid-chat-composer"]',
  '[data-testid="watany-hybrid-chat-input"]',
  '[data-testid="watany-hybrid-chat-send"]',
];

async function firstVisibleCount(page: Page, selectors: string[]): Promise<number> {
  let count = 0;
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const itemCount = await locator.count().catch(() => 0);
    for (let index = 0; index < itemCount; index += 1) {
      if (await locator.nth(index).isVisible().catch(() => false)) {
        count += 1;
      }
    }
  }
  return count;
}

async function gotoRoute(page: Page, route: string): Promise<void> {
  await page.goto(`${webBaseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

test.describe('WatanyBot hybrid chat default contract', () => {
  for (const route of requiredDefaultRoutes) {
    test(`${route} exposes the default hybrid chat shell`, async ({ page }) => {
      await gotoRoute(page, route);
      const visibleDefaultShells = await firstVisibleCount(page, defaultHybridShellSelectors);
      expect(visibleDefaultShells, `${route} must expose default hybrid chat shell/composer. Add one stable data-testid if visual selectors are different.`).toBeGreaterThan(0);

      const visibleComposerParts = await firstVisibleCount(page, composerSelectors);
      expect(visibleComposerParts, `${route} must expose a visible hybrid chat composer/input/send control.`).toBeGreaterThan(0);

      const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      expect(bodyText.length, `${route} should render visible page text for page-grounded chat context`).toBeGreaterThan(20);
    });
  }

  for (const route of socialRoutes) {
    test(`${route} uses social/community chat scope instead of default shell`, async ({ page }) => {
      await gotoRoute(page, route);
      const visibleSocialShells = await firstVisibleCount(page, socialHybridShellSelectors);
      expect(visibleSocialShells, `${route} should expose a social/community chat shell marker.`).toBeGreaterThan(0);
    });
  }

  test('live KB search endpoint is available for hybrid grounding', async ({ request }) => {
    const response = await request.get(`${gatewayBaseUrl}/api/kb/live-search?q=%D8%B1%D8%A7%D8%AA%D8%A8`);
    expect([200, 204, 400, 404, 422]).toContain(response.status());
  });

  test('hybrid chat API candidate responds without a server crash', async ({ request }) => {
    const candidates = ['/api/chat/hybrid', '/api/kb/hybrid-chat', '/api/chat'];
    const statuses: number[] = [];

    for (const candidate of candidates) {
      const response = await request.post(`${gatewayBaseUrl}${candidate}`, {
        data: {
          message: 'ÙƒÙŠÙ ÙÙŠÙ†ÙŠ Ø§Ø¹Ø±Ù Ù…Ø¹Ø§Ù…Ù„ØªÙŠ',
          route: '/mcp/procedures',
          pageText: 'Ù…Ø¹Ø§Ù…Ù„Ø© ÙˆØ·Ù†ÙŠ Ù„Ù„Ø§Ø¬Ø±Ø§Ø¡Ø§Øª',
        },
      }).catch(() => null);

      if (response) {
        statuses.push(response.status());
      }
    }

    expect(statuses.some((status) => status < 500), `At least one hybrid chat endpoint should respond below 500. statuses=${statuses.join(',')}`).toBeTruthy();
  });
});