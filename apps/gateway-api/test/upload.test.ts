import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let app: FastifyInstance | undefined;

beforeAll(async () => {
  const server = await import('../src/server.js');
  app = server.default;
  await app.ready();
}, 120_000);

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

describe('upload endpoint', () => {
  it('accepts small png dataurl', async () => {
    if (!app) throw new Error('Gateway app was not initialized');

    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

    const response = await app.inject({
      method: 'POST',
      url: '/api/files/upload',
      headers: { 'content-type': 'application/json' },
      payload: { dataUrl: tinyPng },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('url');
  });
});
