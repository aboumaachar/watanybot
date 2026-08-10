import { test, expect, Page } from '@playwright/test';

const webBaseUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:5174';
const gatewayBaseUrl = process.env.GATEWAY_BASE_URL || 'http://127.0.0.1:8010';

async function gotoRoute(page: Page, route: string): Promise<string> {
  await page.goto(`${webBaseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1200);
  return await page.locator('body').innerText({ timeout: 15000 });
}

async function visibleCount(page: Page, selectors: string[]): Promise<number> {
  let total = 0;
  for (const selector of selectors) {
    const loc = page.locator(selector);
    const count = await loc.count();
    for (let i = 0; i < count; i += 1) {
      if (await loc.nth(i).isVisible().catch(() => false)) total += 1;
    }
  }
  return total;
}

test.describe('Watany Hybrid Assistant functional smoke', () => {
  test('gateway live search returns grounded school/salary candidates', async ({ request }) => {
    const schoolRes = await request.get(`${gatewayBaseUrl}/api/kb/live-search?q=${encodeURIComponent('مدر')}`);
    expect(schoolRes.ok(), 'مدر live-search should return 2xx').toBeTruthy();
    const schoolText = JSON.stringify(await schoolRes.json());
    expect(schoolText, 'مدر should resolve school-related candidates').toMatch(/مدرس|منح|school/i);

    const salaryRes = await request.get(`${gatewayBaseUrl}/api/kb/live-search?q=salary`);
    expect(salaryRes.ok(), 'salary live-search should return 2xx').toBeTruthy();
    const salaryText = JSON.stringify(await salaryRes.json());
    expect(salaryText, 'salary should resolve salary/pension KB candidates').toMatch(/راتب|معاش|salary|pension/i);
  });

  test('/chat supports page-first context selection flow for مدر', async ({ page }) => {
    const body = await gotoRoute(page, '/chat');
    expect(body).toMatch(/مساعد|موطني|البحث|المحادثة|اسأل/);
    const surfaceCount = await visibleCount(page, ['[data-main-hybrid-chat-surface]', '[data-testid="main-hybrid-chat-surface"]']);
    expect(surfaceCount, '/chat should expose the main hybrid surface').toBeGreaterThan(0);

    const searchBox = page.getByPlaceholder(/مثلاً: مدرسة|مدرسة|طبابة|راتب/i).first();
    await expect(searchBox, 'Hybrid context search input should be visible').toBeVisible({ timeout: 15000 });
    await searchBox.fill('مدر');
    await page.waitForTimeout(1400);
    await expect(page.getByText(/منح مدرسية|مدرسية|مدرس/).first(), 'مدر should show school grants/school candidate').toBeVisible({ timeout: 15000 });

    const useContextButton = page.getByRole('button', { name: /استخدم بالسياق|استخدم.*سياق|السياق/ }).first();
    await expect(useContextButton, 'Use-in-context action should be visible').toBeVisible({ timeout: 15000 });
    await useContextButton.click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/السياق المختار|منح مدرسية|مدرسية/).first(), 'Selected context card should be visible').toBeVisible({ timeout: 15000 });

    const contextualInput = page.getByPlaceholder(/اضغط Enter|اكتب سؤالاً|اكتب سؤالا/).first();
    if (await contextualInput.isVisible().catch(() => false)) {
      await contextualInput.focus();
      await contextualInput.press('Enter');
      await page.waitForTimeout(1200);
    }
    const afterText = await page.locator('body').innerText();
    expect(afterText, 'After selecting context, assistant should keep school context visible').toMatch(/منح مدرسية|مدرسية|السياق المختار|مساعد/);
  });

  test('V2/V1 hybrid mounts exist on non-community routes and are absent on community routes', async ({ page }) => {
    for (const route of ['/chat', '/profile', '/saved', '/chat-sessions', '/updates', '/super-admin']) {
      const text = await gotoRoute(page, route);
      const surfaceCount = await visibleCount(page, ['[data-main-hybrid-chat-surface]', '[data-testid="main-hybrid-chat-surface"]']);
      expect(surfaceCount, `${route} should expose the main hybrid surface`).toBeGreaterThan(0);
      expect(text, `${route} should not show an error boundary`).not.toMatch(/حدث خطأ غير متوقع/);
    }
    for (const route of ['/groups', '/community']) {
      const text = await gotoRoute(page, route);
      const surfaceCount = await visibleCount(page, ['[data-main-hybrid-chat-surface]', '[data-testid="main-hybrid-chat-surface"]']);
      expect(surfaceCount, `${route} should not expose default Hybrid Assistant surface`).toBe(0);
      expect(text, `${route} should render community/social text`).toMatch(/مجتمع|مجتمعي|مجموعة|المجموعات/);
    }
  });

  test('legacy /mcp browser contract markers are still present', async ({ page }) => {
    for (const route of ['/mcp', '/mcp/procedures', '/mcp/laws', '/mcp/salary']) {
      await gotoRoute(page, route);
      const count = await visibleCount(page, ['[data-testid="watany-default-hybrid-chat-shell"]', '[data-default-hybrid-chat-shell="true"]', '[data-chat-scope="default"]']);
      expect(count, `${route} should expose default browser-contract marker`).toBeGreaterThan(0);
    }
    for (const route of ['/mcp/community', '/mcp/social', '/mcp/chat-groups']) {
      await gotoRoute(page, route);
      const count = await visibleCount(page, ['[data-testid="watany-social-hybrid-chat-shell"]', '[data-social-hybrid-chat-shell="true"]', '[data-chat-scope="social"]']);
      expect(count, `${route} should expose social/community browser-contract marker`).toBeGreaterThan(0);
    }
  });
});