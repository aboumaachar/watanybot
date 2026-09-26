import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { signAccessToken } from '../../apps/gateway-api/src/auth/auth-middleware.ts';
import { query } from '../../apps/gateway-api/src/lib/db.ts';

const gateway = 'http://127.0.0.1:8015';
const web = 'https://koudama.com';
const tokenKey = 'watany_access_token';

type HttpResult = { status: number; json: any };
async function api(method: string, path: string, token: string, body?: unknown): Promise<HttpResult> {
  const response = await fetch(gateway + path, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await response.json(); } catch {}
  return { status: response.status, json };
}

async function authedContext(browser: Browser, token: string): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 1180, height: 860 } });
  await context.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), { key: tokenKey, value: token });
  return context;
}
async function waitForDirectReady(page: Page) {
  await page.locator('[data-direct-messages="true"]').waitFor({ state: 'visible', timeout: 30000 });
  const input = page.locator('[data-direct-message-input="true"]');
  await input.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLInputElement>('[data-direct-message-input="true"]');
    return Boolean(el && !el.disabled);
  }, undefined, { timeout: 30000 });
  await page.getByText('متصل مباشر', { exact: true }).waitFor({ state: 'visible', timeout: 30000 });
}

async function main() {
  const stamp = Date.now();
  const userA = randomUUID();
  const userB = randomUUID();
  const emailA = `dm.final.a.${stamp}@watany.test`;
  const emailB = `dm.final.b.${stamp}@watany.test`;
  const nameA = `DM Final A ${stamp}`;
  const nameB = `DM Final B ${stamp}`;
  const body = `DM_FINAL_REALTIME_${stamp}`;
  const failures: string[] = [];
  let groupId = '';
  let browser: Browser | null = null;
  let contextA: BrowserContext | null = null;
  let contextB: BrowserContext | null = null;
  let typingSeen = false;
  let realtimeMessageSeen = false;
  let receiptSeen = false;
  let reloadPersisted = false;
  let reloadGenericMatches = -1;
  let reloadScopedMatches = -1;
  let conversationKind: string | null = null;
  let memberCount = -1;
  let messageCount = -1;
  let cleanupGroup = false;
  let cleanupUsers = false;

  try {
    for (const [id, email, name] of [[userA, emailA, nameA], [userB, emailB, nameB]]) {
      await query(
        `INSERT INTO users (id,email,password_hash,name,role,status)
         VALUES ($1,$2,'test-only',$3,'accredited','active')`,
        [id, email, name],
      );
    }
    const tokenA = signAccessToken({ sub: userA, role: 'accredited', email: emailA });
    const tokenB = signAccessToken({ sub: userB, role: 'accredited', email: emailB });
    const created = await api('POST', '/api/community/direct', tokenA, { recipientUserId: userB });
    if (created.status !== 200 || typeof created.json?.groupId !== 'string') {
      failures.push(`directCreate=${created.status}`);
      throw new Error('DIRECT_CREATE_FAILED');
    }
    groupId = created.json.groupId;
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    contextA = await authedContext(browser, tokenA);
    contextB = await authedContext(browser, tokenB);
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const url = `${web}/messages/${encodeURIComponent(groupId)}`;
    await Promise.all([
      pageA.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }),
      pageB.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }),
    ]);
    await Promise.all([waitForDirectReady(pageA), waitForDirectReady(pageB)]);

    const inputA = pageA.locator('[data-direct-message-input="true"]');
    await inputA.fill(body);
    try {
      await pageB.getByText(/يكتب الآن\.\.\./u).waitFor({ state: 'visible', timeout: 15000 });
      typingSeen = true;
    } catch { failures.push('typingNotSeen'); }

    await pageA.locator('[data-direct-send="true"]').click();
    try {
      await pageB.locator('[data-direct-message-list="true"]').getByText(body, { exact: true }).waitFor({ state: 'visible', timeout: 20000 });
      realtimeMessageSeen = true;
    } catch { failures.push('realtimeMessageNotSeen'); }

    try {
      await pageA.getByText('✓✓ مقروءة', { exact: true }).waitFor({ state: 'visible', timeout: 20000 });
      receiptSeen = true;
    } catch { failures.push('readReceiptNotSeen'); }
    await pageB.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForDirectReady(pageB);
    reloadGenericMatches = await pageB.getByText(body, { exact: true }).count();
    reloadScopedMatches = await pageB.locator('[data-direct-message-list="true"]').getByText(body, { exact: true }).count();
    try {
      await pageB.locator('[data-direct-message-list="true"]').getByText(body, { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      reloadPersisted = true;
    } catch { failures.push('reloadPersistenceNotSeen'); }

    const groupProof = await query<{ conversation_kind: string }>(
      'SELECT conversation_kind FROM community_groups WHERE id=$1', [groupId],
    );
    conversationKind = groupProof.rows[0]?.conversation_kind ?? null;
    const memberProof = await query<{ count: string }>(
      `SELECT count(*)::text AS count FROM community_group_members
       WHERE group_id=$1 AND status IN ('active','muted')`, [groupId],
    );
    memberCount = Number(memberProof.rows[0]?.count ?? -1);
    const messageProof = await query<{ count: string }>(
      'SELECT count(*)::text AS count FROM community_messages WHERE group_id=$1', [groupId],
    );
    messageCount = Number(messageProof.rows[0]?.count ?? -1);
    if (conversationKind !== 'direct') failures.push(`conversationKind=${conversationKind}`);
    if (memberCount !== 2) failures.push(`memberCount=${memberCount}`);
    if (messageCount < 1) failures.push(`messageCount=${messageCount}`);
  } catch (error) {
    failures.push(`fatal=${error instanceof Error ? error.message : String(error)}`);
  } finally {
    try { await contextA?.close(); } catch (error) { failures.push(`closeA=${String(error)}`); }
    try { await contextB?.close(); } catch (error) { failures.push(`closeB=${String(error)}`); }
    try { await browser?.close(); } catch (error) { failures.push(`closeBrowser=${String(error)}`); }
    try {
      if (groupId) {
        const deletedGroup = await query('DELETE FROM community_groups WHERE id=$1', [groupId]);
        cleanupGroup = deletedGroup.rowCount === 1;
      } else {
        cleanupGroup = true;
      }
    } catch (error) { failures.push(`cleanupGroup=${String(error)}`); }
    try {
      const deletedUsers = await query(
        'DELETE FROM users WHERE id::text = ANY($1::text[])', [[userA, userB]],
      );
      cleanupUsers = deletedUsers.rowCount === 2;
    } catch (error) { failures.push(`cleanupUsers=${String(error)}`); }
    if (!cleanupGroup) failures.push('cleanupGroupIncomplete');
    if (!cleanupUsers) failures.push('cleanupUsersIncomplete');
  }

  const result = {
    status: failures.length ? 'FAIL' : 'PASS', groupId, typingSeen, realtimeMessageSeen,
    receiptSeen, reloadPersisted, reloadGenericMatches, reloadScopedMatches, conversationKind, memberCount, messageCount,
    cleanupGroup, cleanupUsers, failures,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = failures.length ? 91 : 0;
}

main().catch((error) => {
  console.error('DM_BROWSER_PROOF_FATAL', error);
  process.exitCode = 92;
});
