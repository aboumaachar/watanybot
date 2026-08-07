import fs from 'node:fs';
import path from 'node:path';
const output = path.resolve('apps/gateway-api/data/official-sources/lebarmy-volunteer-conditions.json');
const record = { id: 'lebarmy_volunteer_conditions', sourceUrl: 'https://www.lebarmy.gov.lb/ar/content/%D8%B4%D8%B1%D9%88%D8%B7-%D8%A7%D9%84%D8%AA%D8%B7%D9%88%D8%B9', type: 'official_reference', category: 'recruitment_conditions', importedAt: new Date().toISOString(), status: 'source_mapped' };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(record, null, 2), 'utf8');
console.log('volunteer conditions source mapped');
