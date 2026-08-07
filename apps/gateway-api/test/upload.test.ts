import http from 'http';
import { describe, it, expect } from 'vitest';

function requestJson(options: any, body?: any) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(raw || '{}');
          resolve({ status: res.statusCode || 0, body: json });
        } catch (e) {
          resolve({ status: res.statusCode || 0, body: raw });
        }
      });
    });
    req.on('error', (e) => reject(e));
    if (data) req.write(data);
    req.end();
  });
}

describe('upload endpoint', () => {
  it('accepts small png dataurl', async () => {
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    const res = await requestJson({ hostname: '127.0.0.1', port: 8010, path: '/api/files/upload', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { dataUrl: tinyPng });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('url');
  });
});
