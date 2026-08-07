import http from 'node:http';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const b = body ? JSON.stringify(body) : undefined;
    const headers = b ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } : {};

    const req = http.request(
      { method, host: 'localhost', port: 4000, path, headers },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve(d); }
        });
      }
    );
    req.on('error', reject);
    if (b) req.write(b);
    req.end();
  });
}

(async () => {
  try {
    console.log('emit error x2...');
    await req('POST', '/api/debug/emit-error', { message: 'TEST_ERROR_CLUSTER', route: '/api/test' });
    await req('POST', '/api/debug/emit-error', { message: 'TEST_ERROR_CLUSTER', route: '/api/test' });

    const res = await req('GET', '/api/debug/errors');
    const first = res.errors && res.errors.find(e => e.key && e.message && e.message.includes('TEST_ERROR_CLUSTER'));
    if (!first) {
      console.error('ERROR: expected TEST_ERROR_CLUSTER in error map', res);
      process.exit(2);
    }

    console.log('acknowledging key:', first.key);
    await req('POST', `/api/debug/errors/${encodeURIComponent(first.key)}/ack`, { by: 'ci-test' });

    const afterAck = await req('GET', '/api/debug/errors');
    const found = afterAck.errors.find(e => e.key === first.key);
    if (!found || !found.acknowledged) {
      console.error('ERROR: ack not reflected in map', afterAck);
      process.exit(3);
    }

    console.log('unacknowledging key (DELETE):', first.key);
    await req('DELETE', `/api/debug/errors/${encodeURIComponent(first.key)}`);

    const afterUnack = await req('GET', '/api/debug/errors');
    const found2 = afterUnack.errors.find(e => e.key === first.key);
    if (!found2 || found2.acknowledged) {
      console.error('ERROR: unack not reflected', afterUnack);
      process.exit(4);
    }

    console.log('OK - error ack/unack flow works');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(5);
  }
})();
