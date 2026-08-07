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
    // small 1x1 png base64
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    console.log('Uploading image...');
    const upload = await requestJson({ hostname: '127.0.0.1', port: 8010, path: '/api/files/upload', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { dataUrl: tinyPng });
    console.log('UPLOAD', upload.status, upload.body);
    if (!upload.body || !upload.body.ok || !upload.body.url) {
      console.error('Upload failed, aborting.');
      process.exit(2);
    }
    const url = upload.body.url;
    console.log('Applying driver with profileImageUrl =', url);
    const apply = await requestJson({ hostname: '127.0.0.1', port: 8010, path: '/api/taxi/driver/apply', method: 'POST', headers: { 'Content-Type': 'application/json' } }, {
      fullName: 'Test Driver',
      phone: '+10000000000',
      whatsappPhone: '+10000000000',
      profileImageUrl: url,
      vehicleCarType: 'سيدان',
      vehicleMake: 'Test',
      vehicleModel: '1',
      vehicleColor: 'أبيض',
      platePublicLastDigits: '999',
      muhafaza: 'بيروت',
      caza: 'بيروت',
      village: 'الحمرا',
      notes: 'E2E test',
    });
    console.log('APPLY', apply.status, apply.body);
  } catch (err) {
    console.error('ERR', err);
    process.exit(1);
  }
})();
