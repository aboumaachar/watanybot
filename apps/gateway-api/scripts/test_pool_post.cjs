const http = require('http');
const data = JSON.stringify({ ownerUserId: 'test-user', pickupText: 'بيروت - الحمرا', seatsNeeded: 2 });
const options = {
  hostname: '127.0.0.1',
  port: 8010,
  path: '/api/taxi/pools',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = http.request(options, (res) => {
  let raw = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => { raw += chunk; });
  res.on('end', () => { console.log('STATUS', res.statusCode); console.log('BODY', raw); });
});
req.on('error', (e) => { console.error('ERR', e); });
req.write(data);
req.end();
