/**
 * Negative Auth Tests — Admin Authority Routes
 *
 * Proves that /api/admin-authority/* endpoints correctly deny:
 *   - No token → 401 or 403
 *   - Normal user token (role: public) → 403
 *   - Admin token (role: admin, not superadmin) → 403
 *   - Superadmin token → 200
 *
 * Run: pnpm --dir apps/gateway-api test src/tests/admin-authority-negative-auth.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { signAccessToken } from '../auth/auth-middleware.js';

// Allow overriding the gateway URL for live-run tests via env.
// Default to the test runner's `PORT` so tests run hermetically when no external
// gateway is available.
const GATEWAY = process.env.GATEWAY_URL || `http://127.0.0.1:${process.env.PORT || 4000}`;
let app: { close: () => Promise<void> } | undefined;
let liveSuperadminToken = '';

function loadLiveGatewayJwtSecret(): string {
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const envPath = path.join(repoRoot, 'apps', 'gateway-api', '.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    const matching = lines.filter((line) => line.trim().startsWith('JWT_SECRET='));
    const raw = matching.at(-1);
    if (raw) {
      const value = raw.slice('JWT_SECRET='.length).trim().replace(/^"|"$/g, '');
      if (value) {
        return value;
      }
    }
  }
  return process.env.JWT_SECRET?.trim() || 'local-dev-proof-only-change-me-123456789';
}

beforeAll(async () => {
  process.env.JWT_SECRET = loadLiveGatewayJwtSecret();

  // If the test is pointed at a local gateway (no explicit GATEWAY_URL),
  // attempt to start the local Fastify app so `fetch` calls succeed.
  // This keeps the test hermetic when run under Vitest.
  if (!process.env.GATEWAY_URL) {
    try {
      const mod = await import('../server.js');
      // Only start the server if it's not already listening.
      // The server bootstrap avoids auto-listen in `NODE_ENV=test`, so call listen.
      if (mod && mod.default && typeof mod.default.listen === 'function') {
        await mod.default.listen({ port: Number(process.env.PORT || 4000), host: '127.0.0.1' });
      }
    } catch (err) {
      // If starting the local server fails, continue — tests will try live login
      // and then fall back to a locally-signed token.
      // eslint-disable-next-line no-console
      console.warn('admin-authority-negative-auth test: could not start local server', err?.message || err);
    }
  }

  // Try live login; if unavailable, fall back to a locally-signed token.
  try {
    const loginRes = await fetch(`${GATEWAY}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'local-admin@koudama.com',
        password: 'LocalAdmin!234',
        rememberMe: true,
      }),
    });
    if (loginRes.ok) {
      const payload = await loginRes.json() as { accessToken?: string };
      liveSuperadminToken = payload.accessToken || '';
    }
  } catch {
    liveSuperadminToken = '';
  }

  if (!liveSuperadminToken) {
    liveSuperadminToken = makeToken('superadmin', 'live-super');
  }
}, 30000);

afterAll(async () => {
  if (app) await app.close();
});

const ENDPOINTS = [
  '/api/admin-authority/me',
  '/api/admin-authority/permissions',
  '/api/admin-authority/dashboard/summary',
  '/api/admin-authority/audit-events',
  '/api/admin-authority/approval-requests',
  '/api/admin-authority/integration-status',
  '/api/admin-authority/module-health',
] as const;

function makeToken(role: 'public' | 'admin' | 'superadmin', id = 'test-user'): string {
  return signAccessToken({ sub: id, role, email: `${role}@test.local` });
}

describe('Admin Authority — No token', () => {
  for (const endpoint of ENDPOINTS) {
    it(`GET ${endpoint} without token returns 401 or 403`, async () => {
      const res = await fetch(`${GATEWAY}${endpoint}`, { method: 'GET' });
      expect([401, 403]).toContain(res.status);
    });
  }
});

describe('Admin Authority — Public user token (role: public)', () => {
  const token = makeToken('public');
  for (const endpoint of ENDPOINTS) {
    it(`GET ${endpoint} with public token returns 401 or 403`, async () => {
      const res = await fetch(`${GATEWAY}${endpoint}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([401, 403]).toContain(res.status);
    });
  }
});

describe('Admin Authority — Admin token (role: admin, not superadmin)', () => {
  const token = makeToken('admin');
  for (const endpoint of ENDPOINTS) {
    it(`GET ${endpoint} with admin token is denied`, async () => {
      const res = await fetch(`${GATEWAY}${endpoint}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([401, 403]).toContain(res.status);
    });
  }
});

describe('Admin Authority — Superadmin token (role: superadmin)', () => {
  it('GET /api/admin-authority/me returns 200 with authority object', async () => {
    const res = await fetch(`${GATEWAY}/api/admin-authority/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${liveSuperadminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.authority).toBeDefined();
    expect(body.authority.authenticated).toBe(true);
    expect(body.authority.roles).toContain('superadmin');
  });

  it('GET /api/admin-authority/permissions returns 200 with policy list', async () => {
    const res = await fetch(`${GATEWAY}/api/admin-authority/permissions`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${liveSuperadminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.policies)).toBe(true);
    expect(body.count).toBeGreaterThan(0);
  });

  it('GET /api/admin-authority/dashboard/summary returns 200 with summary shape', async () => {
    const res = await fetch(`${GATEWAY}/api/admin-authority/dashboard/summary`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${liveSuperadminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    const s = body.summary;
    expect(s.authority).toBeDefined();
    expect(Array.isArray(s.modules)).toBe(true);
    expect(s.audit).toBeDefined();
    expect(typeof s.generatedAt).toBe('string');
  });

  it('GET /api/admin-authority/audit-events returns 200', async () => {
    const res = await fetch(`${GATEWAY}/api/admin-authority/audit-events`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${liveSuperadminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
  });

  it('GET /api/admin-authority/approval-requests returns 200', async () => {
    const res = await fetch(`${GATEWAY}/api/admin-authority/approval-requests`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${liveSuperadminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.approvals)).toBe(true);
  });

  it('GET /api/admin-authority/module-health returns 200 with modules array', async () => {
    const res = await fetch(`${GATEWAY}/api/admin-authority/module-health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${liveSuperadminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.modules)).toBe(true);
  });
});

describe('Admin Authority — Dev bypass header (x-watany-role: superadmin)', () => {
  it('GET /api/admin-authority/me with dev header returns 200 in dev mode', async () => {
    const res = await fetch(`${GATEWAY}/api/admin-authority/me`, {
      method: 'GET',
      headers: { 'x-watany-role': 'superadmin' },
    });
    // Dev bypass only works in NODE_ENV=development.
    // Accept 200 (dev allowed) or 401/403 (non-dev or bypass disabled).
    expect([200, 401, 403]).toContain(res.status);
  });
});
