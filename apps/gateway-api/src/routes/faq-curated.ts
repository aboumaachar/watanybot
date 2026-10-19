import { query as dbQuery } from "../lib/db.js";

type PublishedFaqRow = {
  public_id: string;
  title: string;
  payload: unknown;
  published_at: string | Date | null;
};

export type CuratedFaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
  procedureId: string;
  tags: string[];
  sourceReferences: string[];
  latestRank: number | null;
  trendingRank: number | null;
  publishedAt: string | null;
};

function stringField(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength
    ? value.trim() : null;
}
function rank(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 9999 ? Number(value) : null;
}
function toPublicItem(row: PublishedFaqRow, activeSourceIds: ReadonlySet<string>): CuratedFaqItem | null {
  const data = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? row.payload as Record<string, unknown> : {};
  if (data.reviewStatus !== "approved" || !stringField(data.reviewedBy, 160) ||
    !stringField(data.reviewedAt, 64)) return null;
  const title = stringField(row.title, 300), id = stringField(row.public_id, 160);
  const answer = stringField(data.answer, 5000);
  const sources = data.sourceReferences;
  if (!id || !title || !answer || answer.length < 10 || !Array.isArray(sources) || sources.length === 0 ||
    sources.length > 25 || !sources.every((s): s is string => typeof s === "string" && activeSourceIds.has(s)) ||
    new Set(sources).size !== sources.length) return null;
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((s): s is string => typeof s === "string" && s.length > 0 && s.length <= 80).slice(0, 30)
    : [];
  const category = typeof data.category === "string" && data.category.length <= 160 ? data.category : "";
  let publishedAt: string | null = null;
  if (row.published_at) {
    const date = new Date(row.published_at);
    if (Number.isFinite(date.getTime())) publishedAt = date.toISOString();
  }
  return { id: `curated-${id}`, question: title, answer, category, procedureId: sources[0],
    tags, sourceReferences: sources, latestRank: rank(data.latestRank), trendingRank: rank(data.trendingRank), publishedAt };
}

export function projectCuratedFaqs(rows: readonly PublishedFaqRow[], sourceIds: ReadonlySet<string>, search = "", limit = 10) {
  const normalized = search.trim().toLocaleLowerCase();
  const all = rows.map((row) => toPublicItem(row, sourceIds)).filter((item): item is CuratedFaqItem => item !== null)
    .filter((item) => !normalized ||
      [item.question, item.answer, item.category, ...item.tags].join(" ").toLocaleLowerCase().includes(normalized));
  const latest = [...all].sort((a, b) =>
    (a.latestRank ?? Number.MAX_SAFE_INTEGER) - (b.latestRank ?? Number.MAX_SAFE_INTEGER) ||
    (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0) ||
    a.id.localeCompare(b.id));
  // Trending is editorially ranked only: no invented popularity score.
  const trending = all.filter((item) => item.trendingRank !== null).sort((a, b) =>
    (a.trendingRank as number) - (b.trendingRank as number) || a.id.localeCompare(b.id));
  return { latest: latest.slice(0, limit), trending: trending.slice(0, limit) };
}

export async function listPublishedCuratedFaqs(sourceIds: ReadonlySet<string>, search = "", limit = 10) {
  const rows = await dbQuery<PublishedFaqRow>(
    `SELECT public_id, title, payload, published_at
     FROM cms_content_entities
     WHERE domain = $1 AND status = $2 AND payload->>'reviewStatus' = $3
       AND payload->>'reviewedBy' IS NOT NULL AND payload->>'reviewedAt' IS NOT NULL
     ORDER BY published_at DESC NULLS LAST, public_id ASC LIMIT 500`,
    ["faqs", "PUBLISHED", "approved"],
  );
  return projectCuratedFaqs(rows.rows, sourceIds, search, limit);
}
