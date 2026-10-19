import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { QueryUnderstandingEngine } from "../ai/query-understanding";
import { adaptiveRetrieve, selectStrategy } from "../ai/adaptive-retrieval";
import { loadRagChunks, resetRagChunks } from "../ai/rag";
import { buildKbFallbackReply } from "../lib/chat-service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ragPath = path.resolve(__dirname, "../../../../watany_kb_tables_v4/watany_rag_chunks_v4.jsonl");
const canonicalTitle = "طلب تخصيص محروقات للضباط والمؤهلين المتقاعدين أو الضباط الشهداء أو المؤهلين/المؤهلين أول الشهداء";
const documentNeedles = [
  "دفتر الآلية",
  "التأمين الإلزامي",
  "إثبات ملكية الآلية",
  "إثبات هوية صاحب العلاقة",
  "كتاب من صاحب العلاقة",
];

beforeAll(() => {
  expect(fs.existsSync(ragPath)).toBe(true);
  resetRagChunks();
  expect(loadRagChunks(ragPath)).toBeGreaterThan(0);
});

describe("fuel coupon KB regression", () => {
  it.each([
    "المستندات المطلوبة للمؤهل على قسائم محروقات",
    "شو الوراق المطلوبة للمؤهل للمحروقات",
    "اوراق قسائم المحروقات للمؤهل المتقاعد",
  ])("classifies and retrieves concrete documents for %s", async (query) => {
    const understanding = await new QueryUnderstandingEngine().understand(query);
    expect(understanding.primaryIntent).toBe("get_procedure");
    expect(understanding.queryType).toBe("procedural");
    expect(understanding.entities.some((entity) => entity.type === "rank" && entity.value.includes("مؤهل"))).toBe(true);

    const strategy = selectStrategy(understanding);
    expect(strategy.filters?.chunkTypes).toContain("documents");
    expect(strategy.filters?.chunkTypes).toContain("overview");

    const results = await adaptiveRetrieve(understanding, strategy);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metadata?.canonical_id).toBe("proc-0086");
    expect(results[0].chunk_type).toBe("documents");
    expect(results[0].metadata?.title_ar).toBe(canonicalTitle);
    for (const needle of documentNeedles) expect(results[0].text).toContain(needle);

    const reply = buildKbFallbackReply(results);
    for (const needle of documentNeedles) expect(reply).toContain(needle);
  });

  it("keeps the legacy uppercase procedure identity out of the active RAG", () => {
    const rows = fs.readFileSync(ragPath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(rows.some((row) => row.metadata?.canonical_id === "PROC-0086")).toBe(false);
    const activeRows = rows.filter((row) => row.metadata?.canonical_id === "proc-0086");
    expect(activeRows).toHaveLength(5);
    expect(activeRows.every((row) => row.metadata?.title_ar === canonicalTitle)).toBe(true);
  });
});
