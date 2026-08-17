const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseURL = 'http://127.0.0.1:5174';
const stamp = Date.now();
const outDir = path.resolve('evidence/community-chat-whatsapp-v1/10_realtime/SLICE4_EXTERNAL_BROWSER');
const browserDir = path.resolve('evidence/community-chat-whatsapp-v1/07_browser/SLICE4_EXTERNAL_BROWSER');
const mobileDir = path.resolve('evidence/community-chat-whatsapp-v1/08_mobile/SLICE4_EXTERNAL_BROWSER');
for (const dir of [outDir, browserDir, mobileDir]) fs.mkdirSync(dir, { recursive: true });

const trace = [];
function record(client, direction, event, data = {}) {
  trace.push({ timestamp: new Date().toISOString(), client, direction, event, ...data });
}
async function login(page, email, password) {
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForTimeout(1500);
  if (!/\/(profile|home)(?:[/?#]|$)/.test(page.url())) {
    throw new Error(`login did not reach an authenticated destination: ${page.url()}`);
  }
  return { email };
}
async function waitForCommunity(page) {
  await page.goto(`${baseURL}/community`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  return page.locator('body').innerText();
}
async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/User/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  });
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  for (const [page, client] of [[pageA, 'A'], [pageB, 'B']]) {
    page.on('console', msg => record(client, 'browser', `console.${msg.type()}`, { text: msg.text() }));
    page.on('requestfailed', req => record(client, 'network', 'requestfailed', { url: req.url(), failure: req.failure()?.errorText }));
    page.on('websocket', ws => {
      record(client, 'ws', 'open', { url: ws.url() });
      ws.on('framesent', payload => record(client, 'ws', 'sent', { payload: String(payload).slice(0, 1000) }));
      ws.on('framereceived', payload => record(client, 'ws', 'received', { payload: String(payload).slice(0, 1000) }));
      ws.on('close', () => record(client, 'ws', 'close'));
    });
  }
  const userA = await login(pageA, 'slice4a.20260811@example.test', 'Slice4A!20260811');
  const userB = await login(pageB, 'slice4b.20260811@example.test', 'Slice4B!20260811');
  const getIdentity = page => page.evaluate(async () => {
    const token = sessionStorage.getItem('watany_access_token') || localStorage.getItem('watany_access_token') || '';
    const profile = token ? await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } }).then(response => response.json()) : null;
    return { url: location.href, profile, hasToken: Boolean(token), tokenFingerprint: token ? `${token.length}:${token.slice(-8)}` : '' };
  });
  const identityA = await getIdentity(pageA);
  const identityB = await getIdentity(pageB);
  const identityEmailA = identityA.profile?.email || identityA.profile?.profile?.email || identityA.profile?.user?.email;
  const identityEmailB = identityB.profile?.email || identityB.profile?.profile?.email || identityB.profile?.user?.email;
  const authIndependent = identityEmailA === userA.email && identityEmailB === userB.email && identityEmailA !== identityEmailB && identityA.tokenFingerprint !== identityB.tokenFingerprint;
  fs.writeFileSync(path.join(browserDir, 'auth-context-proof.json'), JSON.stringify({ stamp, userA, userB, identityA, identityB, authIndependent }, null, 2));
  fs.writeFileSync(path.join(browserDir, 'auth-context-proof.md'), `# Auth Context Proof\n\n- user A: ${userA.email}\n- user B: ${userB.email}\n- context A profile: ${identityEmailA || 'unresolved'}\n- context B profile: ${identityEmailB || 'unresolved'}\n- independent contexts: ${authIndependent}\n`);
  if (!authIndependent) throw new Error('auth contexts are not independent');
  const textA = await waitForCommunity(pageA);
  const textB = await waitForCommunity(pageB);
  fs.writeFileSync(path.join(browserDir, 'community-access.txt'), `A:\n${textA}\n\nB:\n${textB}`);
  await pageA.screenshot({ path: path.join(browserDir, '01-A-auth.png'), fullPage: true });
  await pageB.screenshot({ path: path.join(browserDir, '02-B-auth.png'), fullPage: true });
  const result = { status: 'AUTH_ISOLATION_PASS_COMMUNITY_FLOW_PENDING', stamp, userA, userB, authIndependent, communityAContains: textA.includes('مجتمعي'), communityBContains: textB.includes('مجتمعي') };
  fs.writeFileSync(path.join(outDir, 'external-harness-result.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(outDir, 'events.ndjson'), trace.map(x => JSON.stringify(x)).join('\n') + '\n');
  for (const width of [360, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: path.join(mobileDir, `mobile-${width}.png`), fullPage: true });
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify(result));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
