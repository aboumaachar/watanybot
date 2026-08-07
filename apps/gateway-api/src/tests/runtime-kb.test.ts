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

let originalRuntime: any = null;
let runtimePath: string | null = null;

beforeAll(async () => {
  const res = await app.inject({ method: 'GET', url: '/api/admin/kb/runtime', headers: adminHeaders() });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.payload || '{}');
  // keep a copy so tests restore state after
  originalRuntime = body.kb || null;
  runtimePath = body.path || null;
});

afterAll(() => {
  // restore original runtime KB file to avoid test pollution
  try {
    if (runtimePath && originalRuntime) fs.writeFileSync(runtimePath, JSON.stringify(originalRuntime, null, 2), 'utf8');
  } catch (err) {
    /* ignore */
  }
});

describe('Runtime KB admin endpoints', () => {
  it('GET /api/admin/kb/runtime returns the runtime KB', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/kb/runtime', headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload || '{}');
    expect(body.ok).toBe(true);
    expect(body.kb).toBeDefined();
  });

  it('POST /api/admin/kb/runtime-save persists new runtime KB and reload-preview works', async () => {
    const payload = { builtAt: new Date().toISOString(), kb: { procedures: [{ id: 'TEST_PROC' }] } };
    const saveRes = await app.inject({ method: 'POST', url: '/api/admin/kb/runtime-save', payload, headers: adminHeaders() });
    expect(saveRes.statusCode).toBe(200);
    const saveBody = JSON.parse(saveRes.payload || '{}');
    expect(saveBody.ok).toBe(true);

    // confirm GET returns updated content
    const getRes = await app.inject({ method: 'GET', url: '/api/admin/kb/runtime', headers: adminHeaders() });
    const getBody = JSON.parse(getRes.payload || '{}');
    expect(getBody.kb).toBeDefined();
    // runtime_kb.json has top-level shape { builtAt, kb: { procedures: [...] } }
    expect(getBody.kb.kb?.procedures?.length || 0).toBeGreaterThan(0);

    // reload into memory
    const reloadRes = await app.inject({ method: 'POST', url: '/api/admin/kb/runtime-reload', headers: adminHeaders() });
    expect(reloadRes.statusCode).toBe(200);
    const reloadBody = JSON.parse(reloadRes.payload || '{}');
    expect(reloadBody.ok).toBe(true);
  });
});
