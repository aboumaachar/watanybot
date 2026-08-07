import fs from 'node:fs';
import path from 'node:path';
const file = path.resolve('apps/gateway-api/data/official-sources/useful-links.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), count: data.length }, null, 2));
