import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// runtime-save writes the runtime KB and a version backup. Point both at a
// temp dir so the tracked src/data/kb/runtime_kb.json and data/kb_versions
// stay untouched. Hoisted so RUNTIME_KB_JSON is set before ../server loads.
const isolated = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const trackedRuntime = path.resolve(here, '..', 'data', 'kb', 'runtime_kb.json');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'watany-runtime-kb-'));
  const versionsDir = path.join(root, 'data', 'kb_versions');
  const runtimePath = path.join(root, 'runtime_kb.json');
  fs.mkdirSync(versionsDir, { recursive: true });
  fs.copyFileSync(trackedRuntime, runtimePath);
  process.env.RUNTIME_KB_JSON = runtimePath;
  return { root, versionsDir, runtimePath, trackedRuntime };
});

vi.mock('../lib/versioning', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/versioning')>();
  return { ...actual, createVersioningService: () => actual.createVersioningService(isolated.versionsDir) };
});

vi.mock('../lib/db.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db.js')>();
  return {
    ...actual,
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("SELECT id, email, role FROM users WHERE id = $1 AND status = 'active'")) {
        return { rows: [{ id: String(params[0] ?? ''), email: 'admin@test.com', role: 'admin' }], rowCount: 1 };
      }
      if (sql.includes('SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND expires_at > now()')) {
        return { rows: [{ id: String(params[0] ?? '') }], rowCount: 1 };
      }
      return actual.query(sql, params);
    }),
  };
});

import app from '../server';
import { signAccessToken } from '../auth/auth-middleware.js';

process.env.JWT_SECRET ||= 'test-jwt-secret-for-admin-tests-0123456789abcdef';

function adminHeaders() {
  const token = signAccessToken({ sub: 'test-admin', role: 'admin', email: 'admin@test.com', sid: 'runtime-kb-session' });
  return { authorization: `Bearer ${token}` };
}

let trackedBefore: Buffer;

beforeAll(() => {
  trackedBefore = fs.readFileSync(isolated.trackedRuntime);
});

afterAll(() => {
  fs.rmSync(isolated.root, { recursive: true, force: true });
});

describe('Runtime KB admin endpoints', () => {
  it('GET /api/admin/kb/runtime returns the runtime KB', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/kb/runtime', headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload || '{}');
    expect(body.ok).toBe(true);
    expect(body.kb).toBeDefined();
    expect(path.resolve(body.path)).toBe(path.resolve(isolated.runtimePath));
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

  it('leaves the tracked runtime_kb.json byte-identical', () => {
    expect(fs.readFileSync(isolated.trackedRuntime).equals(trackedBefore)).toBe(true);
  });
});
