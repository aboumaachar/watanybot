const http = require('http');

function requestJson(options, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(raw || '{}');
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', (e) => reject(e));
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  try {
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    const res = await requestJson({ hostname: '127.0.0.1', port: 8010, path: '/api/files/upload', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { dataUrl: tinyPng });
    console.log('STATUS', res.status, JSON.stringify(res.body));
    if (res.status !== 200 || !res.body || !res.body.ok) {
      console.error('Unit test failed: upload did not return ok');
      process.exit(2);
    }
    console.log('Unit test passed');
    process.exit(0);
  } catch (err) {
    console.error('ERR', err);
    process.exit(1);
  }
})();
