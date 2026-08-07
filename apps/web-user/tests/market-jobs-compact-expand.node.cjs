const { createRequire } = require('module');
const requireFromApp = createRequire(__dirname + '/../package.json');
const { chromium } = requireFromApp('playwright');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item.startsWith('--')) {
      const key = item.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i += 1;
      } else {
        out[key] = 'true';
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const baseUrl = (args['base-url'] || process.env.WATANY_V1_BASE_URL || 'http://127.0.0.1:5174').replace(/\/$/, '');
const outputJson = args['output-json'] || path.join(process.cwd(), 'market-jobs-compact-expand-result.json');
const screenshot = args['screenshot'] || path.join(process.cwd(), 'market-jobs-compact-expand.png');

if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const res = await page.goto(baseUrl + '/jobs', { waitUntil: 'networkidle', timeout: 30000 });
    if (!res || res.status() < 200 || res.status() >= 400) {
      console.error('Failed to load jobs page', res && res.status());
      await browser.close();
      process.exit(2);
    }

    try {
      await page.waitForSelector('[data-job-listings="true"] .mj-job-card', { timeout: 15000 });
    } catch (err) {
      console.error('No job cards found on the page');
      await page.screenshot({ path: screenshot }).catch(() => {});
      await browser.close();
      process.exit(3);
    }

    const firstCard = (await page.$('[data-job-listings="true"] .mj-job-card'));
    if (!firstCard) {
      console.error('Unable to find first job card');
      await browser.close();
      process.exit(4);
    }

    // Initially the body should be hidden (compact)
    const bodyBefore = await firstCard.$('.mj-job-card__body');
    const compactBefore = !(bodyBefore);

    // Click the toggle
    const toggle = await firstCard.$('.mj-job-card__toggle');
    if (!toggle) {
      console.error('Toggle button not found in first job card');
      await browser.close();
      process.exit(5);
    }

    await toggle.click();
    // wait for expanded body
    let bodyAfter = null;
    try {
      bodyAfter = await firstCard.waitForSelector('.mj-job-card__body', { timeout: 5000 });
    } catch (err) {
      // ignore
    }

    const expanded = !!bodyAfter;

    // Check for badge text if present (Arabic 'جديد')
    const badgeEl = await page.$('[data-job-listings="true"] .mj-job-card__badge');
    const badgeText = badgeEl ? (await badgeEl.innerText()).trim() : null;

    // Verify apply/save UI for unauthenticated users: apply link should point to /register
    const applyLink = await firstCard.$('.mj-job-card__actions-row a') || await firstCard.$('a.mj-inline-sheet__primary');
    const applyHref = applyLink ? await (await applyLink.getProperty('href')).jsonValue() : null;

    // Verify save button exists and shows expected label when not saved (☆ احفظ) or saved (★ المحفوظة)
    const saveButton = await firstCard.$('.mj-job-card__actions-row button') || await firstCard.$('.mj-inline-sheet__ghost');
    const saveLabel = saveButton ? (await saveButton.innerText()).trim() : null;

    const result = {
      httpStatus: res.status(),
      compactBefore,
      expanded,
      badgeText,
      applyHref,
      saveLabel,
    };

    fs.writeFileSync(outputJson, JSON.stringify(result, null, 2), 'utf8');
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    await browser.close();

    if (!compactBefore) {
      console.error('Expected first card to be compact initially');
      process.exit(10);
    }
    if (!expanded) {
      console.error('Expected clicking toggle to expand card');
      process.exit(11);
    }

    // If a badge is expected by test data, assert it's the Arabic word 'جديد'
    if (badgeEl && badgeText !== 'جديد') {
      console.error('Badge found but text is not "جديد"', badgeText);
      process.exit(12);
    }

    // Apply link should point to register when unauthenticated
    if (applyHref && !applyHref.includes('/register')) {
      console.error('Apply link does not point to register for unauthenticated flow', applyHref);
      process.exit(13);
    }

    console.log('market-jobs-compact-expand: PASS', JSON.stringify(result));
    process.exit(0);
  })().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  });
}
