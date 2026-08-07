const db = require('better-sqlite3')('./kb_nodes.db');
const forms = db.prepare("SELECT code, title FROM kb_nodes WHERE code LIKE 'ت%' ORDER BY code").all();
console.log('Forms with ت prefix:', forms.length);
forms.forEach(f => console.log(f.code, '-', f.title.slice(0, 60)));
