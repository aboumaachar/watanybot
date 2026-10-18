import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
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

describe('AI training admin endpoints', () => {
  const trainingPath = path.resolve(__dirname, '../../data/ai_training/training.test.jsonl');
  let app: any;

  beforeAll(async () => {
    fs.mkdirSync(path.dirname(trainingPath), { recursive: true });
    process.env.AI_TRAINING_FILE = trainingPath;
    const mod = await import('../server');
    app = mod.default;
  }, 30000);

  afterAll(() => {
    try { fs.unlinkSync(trainingPath); } catch {}
  });

  it('POST /api/admin/ai/training then GET returns the example', async () => {
    const ex = { input: 'سلام', output: 'أهلًا' };
    const post = await app.inject({ method: 'POST', url: '/api/admin/ai/training', payload: ex, headers: adminHeaders() });
    expect(post.statusCode).toBe(200);
    const postBody = JSON.parse(post.payload || '{}');
    expect(postBody.item).toBeDefined();
    expect(postBody.item.id).toBeDefined();
    expect(postBody.item.status).toBe('pending');

    const get = await app.inject({ method: 'GET', url: '/api/admin/ai/training', headers: adminHeaders() });
    const body = JSON.parse(get.payload || '{}');
    expect(body.examples?.length).toBeGreaterThan(0);
    expect(body.examples[0].input).toBe('سلام');
  });
});