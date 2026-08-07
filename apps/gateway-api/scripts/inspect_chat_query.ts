import fs from "node:fs";
import path from "node:path";

import { loadRagChunks, resetRagChunks, retrieveChunks } from "../src/ai/rag";
import { buildClarificationOptions, getChunkTitle, normalizeArabic } from "../src/lib/chat-service";

function resolveRagPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "../../watany_kb_tables_v4/watany_rag_chunks_v4.jsonl"),
    path.resolve(process.cwd(), "../watany_kb_tables_v4/watany_rag_chunks_v4.jsonl"),
    path.resolve(process.cwd(), "watany_kb_tables_v4/watany_rag_chunks_v4.jsonl"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function main() {
  const query = process.argv.slice(2).join(" ").trim() || "معاش الابنة الأرملة";
  const ragPath = resolveRagPath();

  if (!ragPath) {
    console.error("RAG path not found");
    process.exit(1);
  }

  const loaded = loadRagChunks(ragPath);
  const hits = retrieveChunks(query, 5);
  const clarificationOptions = buildClarificationOptions(query, hits);

  console.log(JSON.stringify({
    query,
    queryNorm: normalizeArabic(query),
    ragPath,
    loaded,
    clarificationOptions,
    hits: hits.map((hit) => ({
      id: hit.id,
      score: hit.score,
      title: getChunkTitle(hit),
      titleNorm: normalizeArabic(getChunkTitle(hit)),
      titleAr: typeof hit.metadata?.title_ar === "string" ? hit.metadata.title_ar : null,
      sectionNameAr: typeof hit.metadata?.section_name_ar === "string" ? hit.metadata.section_name_ar : null,
      textPreview: hit.text.slice(0, 260).replace(/\s+/g, " ").trim(),
    })),
  }, null, 2));

  resetRagChunks();
}

main();