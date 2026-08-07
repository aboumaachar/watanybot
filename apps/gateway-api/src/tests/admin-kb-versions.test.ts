import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../server';
import { signAccessToken } from '../auth/auth-middleware.js';

process.env.JWT_SECRET ||= 'test-jwt-secret-for-admin-tests-0123456789abcdef';

function adminHeaders() {
  const token = signAccessToken({ sub: 'test-admin', role: 'admin', email: 'admin@test.com' });
  return { authorization: `Bearer ${token}` };
}

const runtimePath = path.resolve(__dirname, '..', 'data', 'kb', 'runtime_kb.json');
const backupPath = path.join(path.dirname(runtimePath), '..', 'kb_versions');

describe('KB versions & rollback', () => {
  let orig: any = null;
  beforeAll(() => {
    try { orig = JSON.parse(fs.readFileSync(runtimePath, 'utf8')); } catch (_) { orig = null; }
  });
  afterAll(() => {
    // restore original runtime if possible
    try { if (orig) fs.writeFileSync(runtimePath, JSON.stringify(orig, null, 2), 'utf8'); } catch (_) {}
  });

  it('GET /api/admin/kb/versions returns array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/kb/versions', headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload || '{}');
    expect(Array.isArray(body.versions)).toBe(true);
  });

  it('POST /api/admin/kb/runtime-save creates a version entry', async () => {
    const payload = { builtAt: new Date().toISOString(), kb: { procedures: [{ id: 'TEST_SAVE' }] } };
    const saveRes = await app.inject({ method: 'POST', url: '/api/admin/kb/runtime-save', payload, headers: adminHeaders() });
    expect(saveRes.statusCode).toBe(200);
    const listRes = await app.inject({ method: 'GET', url: '/api/admin/kb/versions?file=runtime_kb.json', headers: adminHeaders() });
    const listBody = JSON.parse(listRes.payload || '{}');
    expect(listBody.versions.length).toBeGreaterThan(0);
  });

  it('POST /api/admin/kb/versions/rollback restores a version', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/admin/kb/versions?file=runtime_kb.json', headers: adminHeaders() });
    const listBody = JSON.parse(listRes.payload || '{}');
    const first = listBody.versions?.[0];
    expect(first).toBeDefined();
    const rb = await app.inject({ method: 'POST', url: '/api/admin/kb/versions/rollback', payload: { id: first.id }, headers: adminHeaders() });
    expect(rb.statusCode).toBe(200);
    const rbBody = JSON.parse(rb.payload || '{}');
    expect(rbBody.ok).toBe(true);
  });
});