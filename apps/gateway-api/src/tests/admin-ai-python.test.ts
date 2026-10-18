import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../server';
import { cleanupSessionUsers, createSessionToken } from './helpers/session-auth';

vi.mock('../lib/db.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db.js')>();
  return {
    ...actual,
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("SELECT id, email, role FROM users WHERE id = $1 AND status = 'active'")) {
        return { rows: [{ id: String(params[0]), email: 'admin@test.com', role: 'admin' }], rowCount: 1 };
      }
      if (sql.includes('SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND expires_at > now()')) {
        return { rows: [{ id: String(params[0]) }], rowCount: 1 };
      }
      return actual.query(sql, params);
    }),
  };
});

process.env.JWT_SECRET ||= 'test-jwt-secret-for-admin-tests-0123456789abcdef';

// Admin paths resolve the principal from the database (active user + live session + sid).
let adminToken = '';
beforeAll(async () => { adminToken = await createSessionToken('admin'); }, 30000);
afterAll(async () => { await cleanupSessionUsers(); });

function adminHeaders() {
  return { authorization: `Bearer ${adminToken}` };
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