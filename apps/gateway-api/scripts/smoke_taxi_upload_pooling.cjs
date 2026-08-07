const http = require('http');

const baseUrl = process.env.GATEWAY_BASE_URL || process.argv[2] || 'http://127.0.0.1:8010';

function requestJson(method, path, body) {
  return new Promise((resolve) => {
    const url = new URL(path, baseUrl);
    const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const req = http.request({
      method,
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      headers: {
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
      },
      timeout: 8000,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', (err) => resolve({ ok: false, statusCode: 0, body: err.message }));
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
  const upload = await requestJson('POST', '/api/files/upload', { filename: 'driver.png', mimeType: 'image/png', base64: png1x1 });
  console.log(JSON.stringify({ check: 'POST /api/files/upload', ...upload }));

  let uploadedUrl = '';
  try {
    const parsed = JSON.parse(upload.body);
    uploadedUrl = parsed?.file?.url || '';
  } catch {}

  if (uploadedUrl) {
    const fetchUpload = await requestJson('GET', uploadedUrl, null);
    console.log(JSON.stringify({ check: `GET ${uploadedUrl}`, ok: fetchUpload.statusCode === 200, statusCode: fetchUpload.statusCode, body: fetchUpload.body.slice(0, 40) }));
  }

  const badSvg = await requestJson('POST', '/api/files/upload', { filename: 'x.svg', mimeType: 'image/svg+xml', base64: Buffer.from('<svg />').toString('base64') });
  console.log(JSON.stringify({ check: 'POST /api/files/upload rejects svg', ok: badSvg.statusCode === 415, statusCode: badSvg.statusCode, body: badSvg.body }));

  const pool = await requestJson('POST', '/api/taxi/pools', {
    ownerId: 'smoke',
    pickup: { muhafaza: 'بيروت', qaza: 'بيروت', village: 'بيروت' },
    destination: { muhafaza: 'جبل لبنان', qaza: 'المتن', village: 'سن الفيل' },
    seats: 2,
    note: 'smoke',
  });
  console.log(JSON.stringify({ check: 'POST /api/taxi/pools', ...pool }));

  const list = await requestJson('GET', '/api/taxi/pools', null);
  console.log(JSON.stringify({ check: 'GET /api/taxi/pools', ...list }));

  const allOk = upload.ok && uploadedUrl && badSvg.statusCode === 415 && pool.ok && list.ok;
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});