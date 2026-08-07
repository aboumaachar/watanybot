import { describe, it, expect } from 'vitest';
import app from '../server';
import { signAccessToken } from '../auth/auth-middleware.js';

process.env.JWT_SECRET ||= 'test-jwt-secret-for-admin-tests-0123456789abcdef';

function adminHeaders() {
  const token = signAccessToken({ sub: 'test-admin', role: 'admin', email: 'admin@test.com' });
  return { authorization: `Bearer ${token}` };
}

describe('AI config & python probe admin endpoints', () => {
  it('GET /api/admin/ai-config returns status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/ai-config', headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    const b = JSON.parse(res.payload || '{}');
    expect(b).toHaveProperty('enabled');
  });

  it('POST /api/admin/ai-config can disable AI', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/ai-config', payload: { enabled: false }, headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    const b = JSON.parse(res.payload || '{}');
    expect(b.ok).toBe(true);
    expect(b.enabled).toBe(false);
  });

  it('POST /api/admin/python/probe accepts base and returns info', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/python/probe', payload: { base: 'http://localhost:8012' }, headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    const b = JSON.parse(res.payload || '{}');
    expect(b).toHaveProperty('base');
  });
});