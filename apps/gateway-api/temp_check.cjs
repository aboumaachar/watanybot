const db = require('better-sqlite3')('./kb_nodes.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables);
if (tables.some(t => t.name === 'chunks')) {
  const forms = db.prepare("SELECT DISTINCT json_extract(meta, '$.code') as code, json_extract(meta, '$.title') as title FROM chunks WHERE json_extract(meta, '$.code') LIKE 'ت%' ORDER BY code").all();
  console.log('Forms with ت prefix:', forms.length);
  forms.forEach(f => console.log(f.code, '-', (f.title || '').slice(0, 60)));
}
