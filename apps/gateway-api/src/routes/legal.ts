/**
 * /api/legal/content  — Serves law_nodes.jsonl as searchable legal content.
 * Works entirely from the local filesystem; does NOT require the Python backend.
 *
 * GET /api/legal/content?q=...&limit=20&domain=...
 * Returns { items: SearchV2Hit[], total: number, query: string }
 */

import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";
import type { FastifyPluginAsync } from "fastify";
import { repoRoot } from "../lib/config.js";
import { rankVeteranPriorityRecords } from "../features/veteran-priority/veteran-priority-ranker.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface LawNode {
  id: string;
  law_name: string;
  article_number?: string;
  topic_tags?: string[];
  text: string;
  legal_weight?: string;
  source?: { file?: string; article?: string };
  domain?: string;
}

interface SearchV2Hit {
  source: string;
  id: string;
  title: string;
  body: string;
  domain: string;
  score: number;
}

interface LegalArticle {
  id: string;
  article_number?: string;
  text: string;
  topic_tags: string[];
}

interface LegalEntryDetail {
  id: string;
  law_name: string;
  domain: string;
  legal_weight: string;
  articles: LegalArticle[];
}

// ── Lazy-loaded index ─────────────────────────────────────────────────────────

/** One entry per unique law_name — summarizes the law with first article text */
interface LegalEntry {
  id: string;
  law_name: string;
  domain: string;
  excerpt: string;
  legal_weight: string;
  tags: string[];
  article_count: number;
}

let _entries: LegalEntry[] | null = null;
let _entryDetailsById: Map<string, LegalEntryDetail> | null = null;
let _loading = false;
let _loadPromise: Promise<LegalEntry[]> | null = null;

const LAW_NODES_CANDIDATES = [
  path.resolve(repoRoot, "apps/api-backend/data/kb_v2/law_nodes.jsonl"),
  path.resolve(repoRoot, "data/kb_v2/law_nodes.jsonl"),
  path.resolve(repoRoot, "data/kb_v2/law/law_nodes.jsonl"),
];
const LAW_NODES_PATH =
  LAW_NODES_CANDIDATES.find((p) => fs.existsSync(p)) ?? LAW_NODES_CANDIDATES[0];

async function loadLawEntries(): Promise<LegalEntry[]> {
  if (_entries !== null) return _entries;
  if (_loadPromise) return _loadPromise;

  _loading = true;
  _loadPromise = (async () => {
    if (!fs.existsSync(LAW_NODES_PATH)) {
      _entries = [];
      return _entries;
    }

    const byLaw = new Map<string, { entry: LegalEntry; detail: LegalEntryDetail }>();

    const rl = readline.createInterface({
      input: fs.createReadStream(LAW_NODES_PATH, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const node = JSON.parse(line) as LawNode;
        const key = node.law_name || "مرجع قانوني";
        const normalizedText = (node.text || "").replace(/\s+/g, " ").trim();
        const articleNumber = (node.article_number || node.source?.article || "").trim() || undefined;
        const article: LegalArticle = {
          id: node.id,
          article_number: articleNumber,
          text: normalizedText,
          topic_tags: node.topic_tags || [],
        };

        if (byLaw.has(key)) {
          const current = byLaw.get(key)!;
          current.entry.article_count++;
          current.detail.articles.push(article);
        } else {
          byLaw.set(key, {
            entry: {
              id: node.id,
              law_name: key,
              domain: node.domain || "general",
              excerpt: normalizedText.slice(0, 250),
              legal_weight: node.legal_weight || "regulation",
              tags: node.topic_tags || [],
              article_count: 1,
            },
            detail: {
              id: node.id,
              law_name: key,
              domain: node.domain || "general",
              legal_weight: node.legal_weight || "regulation",
              articles: [article],
            },
          });
        }
      } catch {
        // skip malformed lines
      }
    }

    const grouped = Array.from(byLaw.values());
    _entries = grouped.map(({ entry }) => entry);
    _entryDetailsById = new Map(grouped.map(({ detail }) => [detail.id, detail]));
    _loading = false;
    return _entries;
  })();

  return _loadPromise;
}

async function loadLawEntryDetail(entryId: string): Promise<LegalEntryDetail | null> {
  await loadLawEntries();
  return _entryDetailsById?.get(entryId) ?? null;
}

// ── Search helper ─────────────────────────────────────────────────────────────

function scoreEntry(entry: LegalEntry, q: string): number {
  if (!q) return 1;
  const haystack = `${entry.law_name} ${entry.domain} ${entry.tags.join(" ")} ${entry.excerpt}`.toLowerCase();
  const needle = q.toLowerCase();
  if (haystack.includes(needle)) return 2;

  // Word-level partial match
  const words = needle.split(/\s+/).filter(Boolean);
  const matchCount = words.filter((w) => haystack.includes(w)).length;
  return matchCount / (words.length || 1);
}

function legalWeightToType(weight: string): string {
  if (weight === "law") return "قانون";
  if (weight === "decree") return "مرسوم";
  if (weight === "circular") return "تعميم";
  if (weight === "memo") return "مذكرة";
  return "نظام";
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const legalRoutes: FastifyPluginAsync = async (app) => {
  // Pre-load on startup (non-blocking; errors are swallowed)
  loadLawEntries().catch(() => {
    app.log.warn("legal: failed to pre-load law_nodes.jsonl");
  });

  app.get("/api/legal/content", async (req, reply) => {
    const q = ((req.query as Record<string, string>).q || "").trim();
    const limit = Math.min(
      Math.max(Number((req.query as Record<string, string>).limit || "20"), 1),
      50,
    );
    const domain = ((req.query as Record<string, string>).domain || "").trim();

    let entries: LegalEntry[];
    try {
      entries = await loadLawEntries();
    } catch {
      reply.code(200);
      return { items: [], total: 0, query: q };
    }

    // Filter by domain if provided
    let filtered = domain
      ? entries.filter((e) => e.domain === domain)
      : entries;

    // Score and filter by query
    if (q) {
      const scored = filtered
        .map((e) => ({ entry: e, score: scoreEntry(e, q) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score);
      filtered = scored.map(({ entry }) => entry);

      const ranked = rankVeteranPriorityRecords(
        filtered.map((entry) => ({
          ...entry,
          sourceType: "laws",
          sourceTitle: entry.law_name,
          title: entry.law_name,
          summary: entry.excerpt,
          body: entry.excerpt,
          tags: entry.tags,
        })),
        q,
      );
      filtered = ranked.map((entry) => entry.item as LegalEntry);
    }

    const page = filtered.slice(0, limit);

    const items: SearchV2Hit[] = page.map((e) => ({
      source: "law_nodes",
      id: e.id,
      title: e.law_name,
      body: `${legalWeightToType(e.legal_weight)} — ${e.article_count} مادة — ${e.excerpt}`,
      domain: e.domain,
      score: 1,
    }));

    reply.header("cache-control", "public, max-age=300");
    return { items, total: filtered.length, query: q };
  });

  app.get<{ Params: { id: string } }>("/api/legal/content/:id/articles", async (req, reply) => {
    let detail: LegalEntryDetail | null;

    try {
      detail = await loadLawEntryDetail(req.params.id);
    } catch {
      reply.code(200);
      return { lawId: req.params.id, lawName: "", articleCount: 0, items: [] };
    }

    if (!detail) {
      reply.code(404);
      return { error: "legal law not found" } as const;
    }

    reply.header("cache-control", "public, max-age=300");
    return {
      lawId: detail.id,
      lawName: detail.law_name,
      articleCount: detail.articles.length,
      items: detail.articles,
    } as const;
  });
};
