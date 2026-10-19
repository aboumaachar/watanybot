import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import app from '../server';
import { cleanupSessionUsers, createSessionToken } from './helpers/session-auth';

// POST /api/admin/ai-config persists <dataDir>/ai_config.json. Send that one
// write to a temp dir so the tracked data/ai_config.json is never rewritten.
const aiConfigTmp = vi.hoisted(() => ({ dir: '', writes: [] as string[] }));
vi.mock('../lib/versioning', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/versioning')>();
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  aiConfigTmp.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watany-ai-config-'));
  return {
    ...actual,
    writeJsonFile: async (p: string, data: unknown) => {
      const target = path.basename(p) === 'ai_config.json' ? path.join(aiConfigTmp.dir, 'ai_config.json') : p;
      aiConfigTmp.writes.push(target);
      return actual.writeJsonFile(target, data);
    },
  };
});
afterAll(() => {
  if (aiConfigTmp.dir) fs.rmSync(aiConfigTmp.dir, { recursive: true, force: true });
});

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
    expect(aiConfigTmp.writes.map((p) => path.resolve(p))).toContain(path.resolve(aiConfigTmp.dir, 'ai_config.json'));
  });

  it('POST /api/admin/python/probe accepts base and returns info', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/python/probe', payload: { base: 'http://localhost:8012' }, headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    const b = JSON.parse(res.payload || '{}');
    expect(b).toHaveProperty('base');
  });
});