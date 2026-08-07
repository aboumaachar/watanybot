import fs from 'node:fs';
import path from 'node:path';

import { loadRagChunks, resetRagChunks, retrieveChunks } from '../src/ai/rag.ts';

const candidatePaths = [
  path.resolve('../../watany_kb_tables_v4/watany_rag_chunks_v4.jsonl'),
  path.resolve('../watany_kb_tables_v4/watany_rag_chunks_v4.jsonl'),
  path.resolve('watany_kb_tables_v4/watany_rag_chunks_v4.jsonl'),
];

const ragPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

console.log(
  JSON.stringify(
    {
      ragPath,
      loaded: ragPath ? loadRagChunks(ragPath) : 0,
    },
    null,
    2,
  ),
);

for (const query of ['معاش الابنة الأرملة', 'معاش الابنة المطلقة', 'معاش الابن الذي يتابع الدراسة']) {
  const hits = retrieveChunks(query, 5);
  console.log(`QUERY:${query}`);
  console.log(
    JSON.stringify(
      hits.map((hit) => hit.text.slice(0, 180).replace(/\n/g, ' ')),
      null,
      2,
    ),
  );
}

resetRagChunks();