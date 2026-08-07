import fs from 'node:fs';
import path from 'node:path';
const output = path.resolve('apps/gateway-api/data/death-notices-import-report.json');
const report = { generatedAt: new Date().toISOString(), status: 'not_activated', note: 'Crawler scaffold created. Keep user uploads pending admin review. Activate only after parser review.' };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2), 'utf8');
console.log('death notice ingest scaffold report written');
