import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { signAccessToken } from '../auth/auth-middleware.js';

process.env.JWT_SECRET ||= 'test-jwt-secret-for-admin-tests-0123456789abcdef';

function adminHeaders() {
  const token = signAccessToken({ sub: 'test-admin', role: 'admin', email: 'admin@test.com' });
  return { authorization: `Bearer ${token}` };
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