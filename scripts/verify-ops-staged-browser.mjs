import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const fail = (message, details = {}) => {
  console.error(`OPS_STAGED_BROWSER_GATE=FAIL ${message}`);
  if (Object.keys(details).length) console.error(JSON.stringify(details));
  process.exit(1);
};

const stage = path.resolve(process.argv[2] || '');
const indexPath = path.join(stage, 'index.html');
if (!stage || !fs.existsSync(indexPath)) fail('STAGE_INDEX_MISSING', { stage });
const index = fs.readFileSync(indexPath, 'utf8');
const contentType = (file) => file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream';
const channel = process.env.WATANY_BROWSER_CHANNEL || undefined;
const browser = await chromium.launch(channel ? { channel, headless: true } : { headless: true });

async function openCandidate(routePath, authenticated) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  const requestFailures = [];
  const loadedOpsAssets = new Set();
  const badLoopback = [];

  if (authenticated) {
    await context.addInitScript(() => {
      localStorage.setItem('admin_token', 'APEX_PRECUTOVER_INVALID_TOKEN');
      localStorage.setItem('admin_api_url', 'https://koudama.com/mcp');
    });
  }

  await context.route('https://koudama.com/ops/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/ops/assets/')) {
      const relative = url.pathname.slice('/ops/'.length);
      const local = path.resolve(stage, relative);
      if (!local.startsWith(stage + path.sep) || !fs.existsSync(local) || !fs.statSync(local).isFile()) {
        return route.fulfill({ status: 404, body: 'missing staged asset' });
      }
      return route.fulfill({ status: 200, body: fs.readFileSync(local), contentType: contentType(local) });
    }
    return route.fulfill({ status: 200, body: index, contentType: 'text/html; charset=utf-8' });
  });
  await context.route('https://koudama.com/mcp/**', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: '{"error":"UNAUTHORIZED"}',
  }));

  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push({ url: request.url(), error: request.failure()?.errorText || '' }));
  page.on('request', (request) => {
    try {
      const url = new URL(request.url());
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') badLoopback.push(request.url());
    } catch {}
  });
  page.on('response', (response) => {
    const url = response.url();
    if (url.startsWith('https://koudama.com/ops/assets/') && response.status() === 200) loadedOpsAssets.add(new URL(url).pathname);
  });

  const response = await page.goto(`https://koudama.com${routePath}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => ({
    rootText: (document.querySelector('#root')?.textContent || '').replace(/\s+/g, ' ').trim(),
    bodyText: (document.body?.innerText || '').replace(/\s+/g, ' ').trim(),
    apiUrl: localStorage.getItem('admin_api_url') || '',
    passwordVisible: !!document.querySelector('input[type="password"]'),
  }));
  const unexpectedFailures = requestFailures.filter((row) => !row.url.startsWith('wss://koudama.com/mcp/ws/admin'));
  const result = {
    status: response?.status() || 0,
    state,
    pageErrors,
    requestFailures: unexpectedFailures,
    badLoopback,
    loadedOpsAssets: [...loadedOpsAssets],
  };
  await context.close();
  return result;
}

const root = await openCandidate('/ops/', false);
if (root.status !== 200 || !root.state.rootText || !root.state.passwordVisible) fail('ROOT_DID_NOT_COMMIT', root);
if (root.state.apiUrl !== 'https://koudama.com/mcp') fail('PRODUCTION_API_NOT_DEFAULT', root);
if (root.pageErrors.length || root.requestFailures.length || root.badLoopback.length) fail('ROOT_RUNTIME_ERRORS', root);

const jobs = await openCandidate('/ops/jobs', true);
if (jobs.status !== 200 || !jobs.state.bodyText.includes('المحدد الجغرافي الشامل')) fail('JOBS_ROUTE_NOT_MOUNTED', jobs);
if (!jobs.loadedOpsAssets.some((url) => /\/JobsAdminPage-[^/]+\.js$/.test(url))) fail('JOBS_LAZY_CHUNK_NOT_LOADED', jobs);
if (!jobs.loadedOpsAssets.some((url) => /\/FormCreatorPlugin-[^/]+\.js$/.test(url))) fail('JOBS_FORM_CREATOR_CHUNK_NOT_LOADED', jobs);
if (jobs.pageErrors.length || jobs.requestFailures.length || jobs.badLoopback.length) fail('JOBS_RUNTIME_ERRORS', jobs);

const forms = await openCandidate('/ops/forms', true);
if (forms.status !== 200 || (!forms.state.bodyText.includes('FORM CREATOR V2') && !forms.state.bodyText.includes('منشئ النماذج'))) fail('FORMS_ROUTE_NOT_MOUNTED', forms);
if (!forms.loadedOpsAssets.some((url) => /\/UniversalFormsAdminPage-[^/]+\.js$/.test(url))) fail('FORMS_LAZY_CHUNK_NOT_LOADED', forms);
if (!forms.loadedOpsAssets.some((url) => /\/FormCreatorPlugin-[^/]+\.js$/.test(url))) fail('FORMS_FORM_CREATOR_CHUNK_NOT_LOADED', forms);
if (forms.pageErrors.length || forms.requestFailures.length || forms.badLoopback.length) fail('FORMS_RUNTIME_ERRORS', forms);

console.log('OPS_STAGED_ROOT_COMMIT=PASS');
console.log('OPS_STAGED_PRODUCTION_LOGIN_DEFAULT=PASS');
console.log('OPS_STAGED_JOBS_ROUTE=PASS');
console.log('OPS_STAGED_FORMS_ROUTE=PASS');
console.log(`OPS_STAGED_JOBS_ASSET_LOAD_COUNT=${jobs.loadedOpsAssets.length}`);
console.log(`OPS_STAGED_FORMS_ASSET_LOAD_COUNT=${forms.loadedOpsAssets.length}`);
console.log('OPS_STAGED_BROWSER_GATE=PASS');
await browser.close();
