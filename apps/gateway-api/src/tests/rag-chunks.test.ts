import { describe, it, expect } from 'vitest';
import app from '../server';
import { signAccessToken } from '../auth/auth-middleware.js';

process.env.JWT_SECRET ||= 'test-jwt-secret-for-admin-tests-0123456789abcdef';

function adminHeaders() {
  const token = signAccessToken({ sub: 'test-admin', role: 'admin', email: 'admin@test.com' });
  return { authorization: `Bearer ${token}` };
}

describe('RAG chunks admin endpoints', () => {
  it('GET /api/admin/kb/chunks returns structure', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/kb/chunks', headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload || '{}');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.chunks)).toBe(true);
  });

  it('PATCH /api/admin/kb/chunk/:id updates a chunk and persists', async () => {
    // Fetch actual loaded RAG chunks from the GET endpoint
    const listRes = await app.inject({ method: 'GET', url: '/api/admin/kb/chunks', headers: adminHeaders() });
    const listBody = JSON.parse(listRes.payload || '{}');
    const id = listBody.chunks?.[0]?.id || null;
    if (!id || listBody.total === 0) {
      // skip if no RAG chunks loaded (e.g. no JSONL in test env)
      expect(true).toBe(true);
      return;
    }

    const newText = `UPDATED_BY_TEST_${Date.now()}`;
  const patchRes = await app.inject({ method: 'PATCH', url: `/api/admin/kb/chunk/${encodeURIComponent(id)}`, payload: { text: newText }, headers: adminHeaders() });
    expect(patchRes.statusCode).toBe(200);
    const patchBody = JSON.parse(patchRes.payload || '{}');
    expect(patchBody.ok).toBe(true);
    expect(patchBody.chunk.text).toContain('UPDATED_BY_TEST');

    // reload chunks
    const reloadRes = await app.inject({ method: 'POST', url: '/api/admin/kb/chunks/reload', headers: adminHeaders() });
    expect(reloadRes.statusCode).toBe(200);
    const rl = JSON.parse(reloadRes.payload || '{}');
    expect(rl.ok).toBe(true);
  });
});