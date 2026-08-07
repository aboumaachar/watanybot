import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { signAccessToken } from '../auth/auth-middleware.js';

process.env.JWT_SECRET ||= 'test-jwt-secret-for-admin-tests-0123456789abcdef';

function adminHeaders() {
  const token = signAccessToken({ sub: 'test-admin', role: 'admin', email: 'admin@test.com' });
  return { authorization: `Bearer ${token}` };
}

describe('AI training approve endpoint', () => {
  const trainingPath = path.resolve(__dirname, '../../data/ai_training/training.test-approve.jsonl');
  let app: any;

  beforeAll(async () => {
    fs.mkdirSync(path.dirname(trainingPath), { recursive: true });
    process.env.AI_TRAINING_FILE = trainingPath;
    const mod = await import('../server');
    app = mod.default;
  }, 30000);

  afterAll(() => {
    try { fs.unlinkSync(trainingPath); } catch {};
  });

  it('POST /api/admin/ai/training/:id/approve marks item as approved', async () => {
    const ex = { input: 'approve-test', output: 'approved-output' };
    const post = await app.inject({ method: 'POST', url: '/api/admin/ai/training', payload: ex, headers: adminHeaders() });
    expect(post.statusCode).toBe(200);
    const postBody = JSON.parse(post.payload || '{}');
    const id = postBody.item?.id;
    expect(id).toBeDefined();
    expect(postBody.item.status).toBe('pending');

    const approve = await app.inject({ method: 'POST', url: `/api/admin/ai/training/${id}/approve`, headers: adminHeaders() });
    expect(approve.statusCode).toBe(200);
    const apprBody = JSON.parse(approve.payload || '{}');
    expect(apprBody.ok).toBe(true);
    expect(apprBody.item).toBeDefined();
    expect(apprBody.item.id).toBe(id);
    expect(apprBody.item.status).toBe('approved');

    const getApproved = await app.inject({ method: 'GET', url: '/api/admin/ai/training?status=approved', headers: adminHeaders() });
    const getBody = JSON.parse(getApproved.payload || '{}');
    const found = (getBody.examples || []).find((e: any) => e.id === id);
    expect(found).toBeDefined();
    expect(found.status).toBe('approved');
  });
});