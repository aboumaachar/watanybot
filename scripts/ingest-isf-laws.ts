import fs from 'node:fs';
import path from 'node:path';
const output = path.resolve('apps/gateway-api/data/legal/isf-laws-import-report.json');
const report = { generatedAt: new Date().toISOString(), sourceUrl: 'https://isf.gov.lb/ar/laws/', status: 'source_mapped', note: 'Full extraction must verify law titles/download URLs before public insertion.' };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2), 'utf8');
console.log('isf laws source mapped');
