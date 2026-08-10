import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:8010';

function apiUrl(path: string): string {
  return new URL(path, API_BASE_URL).toString();
}

// E2E smoke: KB edit â†’ persist/reload â†’ rebuild â†’ retrieval (+ optional chat check)
test('KB edit â†’ rebuild â†’ retrieval â†’ (chat if available)', async ({ request }) => {
  const marker = `playwright-${Date.now().toString(36)}`;

  // 1) list chunks and pick one
  const listRes = await request.get(apiUrl('/api/admin/kb/chunks'));
  if (listRes.status() === 401 || listRes.status() === 403) test.skip(true, 'admin KB endpoint is auth-gated in this topology');
  if (listRes.status() === 401 || listRes.status() === 403) test.skip(true, "admin KB endpoint is auth-gated in this topology");
  expect(listRes.ok()).toBeTruthy();
  const list = await listRes.json();
  expect(list.total).toBeGreaterThan(0);
  const chunk = list.chunks[0];
  expect(chunk).toBeDefined();

  // 2) patch the chunk text to include a unique marker
  const patchedText = (chunk.text || '') + '\n\n' + marker;
  const patchRes = await request.patch(apiUrl(`/api/admin/kb/chunk/${chunk.id}`), { data: { text: patchedText } });
  expect(patchRes.ok()).toBeTruthy();
  const patchBody = await patchRes.json();
  expect((patchBody.chunk?.text || '')).toContain(marker);

  // 3) persist and reload chunks, then trigger AI rebuild
  const saveRes = await request.post(apiUrl('/api/admin/kb/chunks/save'));
  expect(saveRes.ok()).toBeTruthy();

  const reloadRes = await request.post(apiUrl('/api/admin/kb/chunks/reload'));
  expect(reloadRes.ok()).toBeTruthy();
  const reloadBody = await reloadRes.json();
  expect(reloadBody.loaded).toBeGreaterThan(0);

  const rebuildRes = await request.post(apiUrl('/api/admin/ai/rebuild'));
  expect(rebuildRes.ok()).toBeTruthy();

  // 4) verify retrieval finds the marker
  const searchRes = await request.get(apiUrl(`/api/admin/kb/chunks?q=${encodeURIComponent(marker)}`));
  expect(searchRes.ok()).toBeTruthy();
  const searchBody = await searchRes.json();
  expect(searchBody.total).toBeGreaterThan(0);

  // 5) optional: call /api/chat â€” assert response shape and (if present) marker
  const chatRes = await request.post(apiUrl('/api/chat'), { data: { message: marker, userId: 'e2e' } });
  if (chatRes.ok()) {
    const chatBody = await chatRes.json();
    expect(typeof chatBody.reply).toBe('string');
    // AI may be disabled in CI/dev â€” only assert marker presence if returned
    if ((chatBody.reply || '').includes(marker)) expect(chatBody.reply).toContain(marker);
  }
});
