const http = require('http');
const payload = JSON.stringify({ email: "user superadmin", password: "Abouyara1", rememberMe: true });
const options = {
  hostname: '127.0.0.1',
  port: 8015,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Origin': 'https://koudama.com',
    'Host': 'koudama.com'
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log(body);
  });
});
req.on('error', (e) => { console.error('ERROR', e); });
req.write(payload);
req.end();
