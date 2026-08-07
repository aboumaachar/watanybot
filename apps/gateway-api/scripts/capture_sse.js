/*
Simple Node script to POST to /api/chat/stream and print raw received chunks as hex + utf8.
Run: node apps/gateway-api/scripts/capture_sse.js
*/

const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: process.env.GATEWAY_PORT ? Number(process.env.GATEWAY_PORT) : 8010,
  path: '/api/chat/stream',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  },
};

const req = http.request(options, (res) => {
  console.error('STATUS', res.statusCode);
  console.error('HEADERS', res.headers);

  res.on('data', (chunk) => {
    const buf = Buffer.from(chunk);
    console.log('--- CHUNK START ---');
    console.log('HEX:', buf.toString('hex'));
    console.log('UTF8:', buf.toString('utf8'));
    console.log('--- CHUNK END ---\n');
  });

  res.on('end', () => {
    console.error('Response ended');
  });
});

req.on('error', (err) => {
  console.error('Request error', err);
});

const body = JSON.stringify({ message: 'مرحبا من الاختبار — testing utf8' });
req.write(body);
req.end();
