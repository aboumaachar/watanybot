import { load } from "cheerio";
import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PluginDb } from "../types/domain";
import { worldCupNewsSeed, worldCupNewsCrawlSources, type WorldCupNewsCrawlSource, type WorldCupNewsItem } from "../data/world-cup-news-seed";

type CrawledWorldCupNewsItem = WorldCupNewsItem & {
  sourceId: string;
  sourceLabel: string;
};

type WorldCupNewsRow = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  image_url: string | null;
  source_url: string | null;
  is_published: number;
  published_at: number;
  created_at: number;
  updated_at: number;
  created_by: string | null;
};

const WORLD_CUP_NEWS_CATEGORY = "World Cup";
const WORLD_CUP_NEWS_CRAWL_INTERVAL_MS = 15 * 60 * 1000;
const WORLD_CUP_NEWS_FETCH_TIMEOUT_MS = 15_000;
const WORLD_CUP_NEWS_CORE_PATTERNS = [
  /world\s*cup/i,
  /fifa\s*world\s*cup/i,
  /كأس العالم|المونديال/i,
  /fifa-world-cup|scores-fixtures/i,
];
const WORLD_CUP_NEWS_FIFA_PATTERNS = [
  /world\s*cup|fifa/i,
  /match|fixture|group\s+[a-h]|stadium|team/i,
  /كأس العالم|فيفا|مباراة|مباريات|المنتخبات/i,
];
const WORLD_CUP_NEWS_KOORA_PATTERNS = [
  /كأس العالم|المونديال|world\s*cup/i,
  /المنتخبات|المجموعة|المجموعات|مباراة|مباريات/i,
  /مسابقة\/كأس-العالم|%D9%85%D8%B3%D8%A7%D8%A8%D9%82%D8%A9\/.+%D9%83%D8%A3%D8%B3-%D8%A7%D9%84%D8%B9%D8%A7%D9%84%D9%85/i,
  /\/أخبار\/70excpe1synn9kadnbppahdn7|\/70excpe1synn9kadnbppahdn7/i,
];
const WORLD_CUP_NEWS_KOORA_EXCLUDED_TITLES = [
  /^مباريات اليوم$/i,
  /^جدول المباريات$/i,
  /^جدول الترتيب$/i,
  /^أفضل اللاعبين$/i,
  /^كأس العالم 2026$/i,
];

let crawlTimer: ReturnType<typeof setInterval> | null = null;
let crawlInFlight: Promise<void> | null = null;

function compactText(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function removeLatinFragments(value: string): string {
  return compactText(value.replace(/[A-Za-z][A-Za-z\s.,'"-]*/g, " "));
}

function sanitizeWorldCupSummary(value: string): string {
  return removeLatinFragments(value).replace(/\bWorld\s*Cup\b\s*html\b/gi, "").replace(/\bhtml\b/gi, "").trim();
}

function hasArabicContent(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function isArabicOnlyNews(title: string, summary: string): boolean {
  return hasArabicContent(title) && hasArabicContent(summary);
}

function toAbsoluteUrl(rawUrl: string, baseUrl: string): string {
  return new URL(rawUrl, baseUrl).toString();
}

function hashSourceUrl(sourceUrl: string): string {
  return createHash("sha1").update(sourceUrl.toLowerCase()).digest("hex").slice(0, 24);
}

function isRelevantWorldCupItem(text: string): boolean {
  return WORLD_CUP_NEWS_CORE_PATTERNS.some((pattern) => pattern.test(text));
}

function isRelevantWorldCupUrl(sourceUrl: string): boolean {
  return WORLD_CUP_NEWS_CORE_PATTERNS.some((pattern) => pattern.test(sourceUrl));
}

function isRelevantForSource(source: WorldCupNewsCrawlSource, title: string, summary: string, sourceUrl: string): boolean {
  const combined = `${title} ${summary} ${sourceUrl}`;

  if (source.id === "fifa-official") {
    if (!isArabicOnlyNews(title, summary)) {
      return false;
    }
    return WORLD_CUP_NEWS_FIFA_PATTERNS.some((pattern) => pattern.test(combined));
  }

  if (source.id === "kooora-world-cup") {
    const normalizedTitle = compactText(title);
    const hasKooraArticleUrl = /\/(?:أخبار|%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1)\//i.test(sourceUrl);
    const isExcludedTitle = WORLD_CUP_NEWS_KOORA_EXCLUDED_TITLES.some((pattern) => pattern.test(normalizedTitle));

    if (!hasKooraArticleUrl || isExcludedTitle || !hasArabicContent(normalizedTitle)) {
      return false;
    }

    return WORLD_CUP_NEWS_KOORA_PATTERNS.some((pattern) => pattern.test(combined));
  }

  if (!isArabicOnlyNews(title, summary)) {
    return false;
  }

  return isRelevantWorldCupItem(combined) || isRelevantWorldCupUrl(sourceUrl);
}

function readScalarString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isKooraArticleUrl(sourceUrl: string): boolean {
  return /kooora\.com\/.+\/(?:أخبار|%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1)\//i.test(sourceUrl);
}

function extractKooraArticleDetails(html: string): { title: string; summary: string } | null {
  const $ = load(html);
  const title = compactText($("h1").first().text());

  if (!title) {
    return null;
  }

  const bodyCandidates = $("article p, main p, p")
    .map((_, element) => compactText($(element).text()))
    .get()
    .map((candidate) => removeLatinFragments(candidate))
    .filter((candidate) => candidate.length >= 40 && candidate !== title && hasArabicContent(candidate));

  const summary = bodyCandidates[0] ?? title;
  return { title, summary };
}

async function enrichKooraNewsItem(item: CrawledWorldCupNewsItem): Promise<CrawledWorldCupNewsItem> {
  if (!isKooraArticleUrl(item.sourceUrl)) {
    return item;
  }

  try {
    const response = await fetch(item.sourceUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "WatanyBot/1.0 (+https://koudama.com)",
      },
      signal: AbortSignal.timeout(WORLD_CUP_NEWS_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return item;
    }

    const details = extractKooraArticleDetails(await response.text());
    if (!details) {
      return item;
    }

    return {
      ...item,
      title: details.title,
      summary: sanitizeWorldCupSummary(details.summary),
      isBreaking: /عاجل|breaking/i.test(`${details.title} ${details.summary}`),
    };
  } catch {
    return item;
  }
}

async function maybeEnrichSourceItems(source: WorldCupNewsCrawlSource, items: CrawledWorldCupNewsItem[]): Promise<CrawledWorldCupNewsItem[]> {
  if (source.id !== "kooora-world-cup" || items.length === 0) {
    return items;
  }

  return Promise.all(items.map((item) => enrichKooraNewsItem(item)));
}

function parseHtmlSource(source: WorldCupNewsCrawlSource, html: string, now: number): CrawledWorldCupNewsItem[] {
  const $ = load(html);
  const seen = new Set<string>();

  return $("article a[href], main a[href], section a[href], a[href]")
    .map((index, element): CrawledWorldCupNewsItem | null => {
      const link = $(element);
      const href = compactText(link.attr("href"));
      const title = compactText(link.text()) || compactText(link.attr("title")) || compactText(link.attr("aria-label"));

      if (!href || !title || title.length < 12) {
        return null;
      }

      const sourceUrl = toAbsoluteUrl(href, source.baseUrl);
      const uniqueKey = sourceUrl.toLowerCase();
      if (seen.has(uniqueKey)) {
        return null;
      }
      seen.add(uniqueKey);

      const container = link.closest("article, li, div, section, main");
      const summary = compactText(
        container
          .find("p")
          .first()
          .text()
      );

      if (!isRelevantForSource(source, title, summary, sourceUrl)) {
        return null;
      }

      return {
        id: `wc-news:${hashSourceUrl(sourceUrl)}`,
        title,
        summary: sanitizeWorldCupSummary(summary || title),
        publishedAt: new Date(now - index * 60_000).toISOString(),
        sourceLabel: source.label,
        sourceUrl,
        tags: ["World Cup", source.parser],
        isBreaking: /عاجل|breaking/i.test(`${title} ${summary}`),
        sourceId: source.id,
      } satisfies CrawledWorldCupNewsItem;
    })
    .get()
    .filter((item): item is CrawledWorldCupNewsItem => Boolean(item));
}

function parseRssSource(source: WorldCupNewsCrawlSource, xml: string, now: number): CrawledWorldCupNewsItem[] {
  const $ = load(xml, { xmlMode: true });
  const seen = new Set<string>();

  return $("item")
    .map((index, element): CrawledWorldCupNewsItem | null => {
      const item = $(element);
      const title = compactText(item.find("title").first().text());
      const link = compactText(item.find("link").first().text());
      const description = compactText(item.find("description").first().text());
      const publishedAtText = compactText(item.find("pubDate").first().text());

      if (!title || !link) {
        return null;
      }

      const sourceUrl = toAbsoluteUrl(link, source.baseUrl);
      const uniqueKey = sourceUrl.toLowerCase();
      if (seen.has(uniqueKey)) {
        return null;
      }
      seen.add(uniqueKey);

      if (!isRelevantForSource(source, title, description, sourceUrl)) {
        return null;
      }

      return {
        id: `wc-news:${hashSourceUrl(sourceUrl)}`,
        title,
        summary: sanitizeWorldCupSummary(description || title),
        publishedAt: Number.isFinite(Date.parse(publishedAtText)) ? new Date(Date.parse(publishedAtText)).toISOString() : new Date(now - index * 60_000).toISOString(),
        sourceLabel: source.label,
        sourceUrl,
        tags: ["World Cup", source.parser],
        isBreaking: /عاجل|breaking/i.test(`${title} ${description}`),
        sourceId: source.id,
      } satisfies CrawledWorldCupNewsItem;
    })
    .get()
    .filter((item): item is CrawledWorldCupNewsItem => Boolean(item));
}

function parseApiSource(source: WorldCupNewsCrawlSource, payload: unknown, now: number): CrawledWorldCupNewsItem[] {
  let candidates: unknown[] = [];
  if (Array.isArray(payload)) {
    candidates = payload;
  } else if (payload && typeof payload === "object") {
    candidates = [payload];
  }

  return candidates
    .flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") {
        return [];
      }

      const record = candidate as Record<string, unknown>;
      let items: unknown[] = [];
      if (Array.isArray(record.items)) {
        items = record.items;
      } else if (Array.isArray(record.news)) {
        items = record.news;
      } else if (Array.isArray(record.data)) {
        items = record.data;
      }

      return items.flatMap((item, index) => {
        if (!item || typeof item !== "object") {
          return [];
        }

        const recordItem = item as Record<string, unknown>;
        const title = compactText(readScalarString(recordItem.title) || readScalarString(recordItem.headline) || readScalarString(recordItem.name));
        const rawUrl = readScalarString(recordItem.url) || readScalarString(recordItem.link) || readScalarString(recordItem.source_url);
        const summary = compactText(readScalarString(recordItem.summary) || readScalarString(recordItem.description));

        if (!title || !rawUrl) {
          return [];
        }

        const sourceUrl = toAbsoluteUrl(rawUrl, source.baseUrl);

        if (!isRelevantForSource(source, title, summary, sourceUrl)) {
          return [];
        }

        return [{
          id: `wc-news:${hashSourceUrl(sourceUrl)}`,
          title,
          summary: sanitizeWorldCupSummary(summary || title),
          publishedAt: new Date(now - index * 60_000).toISOString(),
          sourceLabel: source.label,
          sourceUrl,
          tags: ["World Cup", source.parser],
          isBreaking: /عاجل|breaking/i.test(`${title} ${summary}`),
          sourceId: source.id,
        } satisfies CrawledWorldCupNewsItem];
      });
    });
}

function clearCrawlerWorldCupNews(pluginDb: PluginDb): void {
  const sourceLabels = worldCupNewsCrawlSources.map((source) => source.label);
  if (sourceLabels.length === 0) {
    return;
  }

  pluginDb
    .prepare("DELETE FROM news_items WHERE category = ?")
    .run(WORLD_CUP_NEWS_CATEGORY);
}

async function crawlSource(source: WorldCupNewsCrawlSource, now: number): Promise<CrawledWorldCupNewsItem[]> {
  const targetUrl = source.feedUrl ?? source.baseUrl;
  const response = await fetch(targetUrl, {
    headers: {
      Accept: source.parser === "rss" ? "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8" : "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "User-Agent": "WatanyBot/1.0 (+https://koudama.com)",
    },
    signal: AbortSignal.timeout(WORLD_CUP_NEWS_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`worldcup_news_fetch_failed_${source.id}_${response.status}`);
  }

  if (source.parser === "rss") {
    return parseRssSource(source, await response.text(), now);
  }

  if (source.parser === "api") {
    return parseApiSource(source, await response.json(), now);
  }

  const parsedItems = parseHtmlSource(source, await response.text(), now);
  return maybeEnrichSourceItems(source, parsedItems);
}

function upsertWorldCupNewsItem(pluginDb: PluginDb, item: CrawledWorldCupNewsItem): boolean {
  const now = Date.now();
  const publishedAt = Date.parse(item.publishedAt);
  const row: WorldCupNewsRow = {
    id: item.id,
    title: item.title,
    body: compactText(`${sanitizeWorldCupSummary(item.summary)} ${item.tags.join(" ")}`),
    category: WORLD_CUP_NEWS_CATEGORY,
    image_url: null,
    source_url: item.sourceUrl,
    is_published: 1,
    published_at: Number.isFinite(publishedAt) ? publishedAt : now,
    created_at: now,
    updated_at: now,
    created_by: item.sourceLabel,
  };

  const result = pluginDb
    .prepare(`
      INSERT INTO news_items (id, title, body, category, image_url, source_url, is_published, published_at, created_at, updated_at, created_by)
      VALUES (@id, @title, @body, @category, @image_url, @source_url, @is_published, @published_at, @created_at, @updated_at, @created_by)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        category = excluded.category,
        image_url = excluded.image_url,
        source_url = excluded.source_url,
        is_published = excluded.is_published,
        published_at = excluded.published_at,
        updated_at = excluded.updated_at,
        created_by = excluded.created_by
    `)
    .run(row);

  return Number(result.changes) > 0;
}

export async function crawlWorldCupNews(pluginDb: PluginDb): Promise<{ crawledSources: number; crawledItems: number; storedItems: number }> {
  const now = Date.now();
  const sources = worldCupNewsCrawlSources.filter((source) => source.enabled);
  const crawledItems: CrawledWorldCupNewsItem[] = [];

  for (const source of sources) {
    try {
      const items = await crawlSource(source, now);
      crawledItems.push(...items);
    } catch {
      // Keep the ingestion job resilient: one bad source should not stop the others.
    }
  }

  const deduped = new Map<string, CrawledWorldCupNewsItem>();
  for (const item of crawledItems) {
    deduped.set(item.sourceUrl.toLowerCase(), item);
  }

  let storedItems = 0;
  clearCrawlerWorldCupNews(pluginDb);
  for (const item of deduped.values()) {
    if (upsertWorldCupNewsItem(pluginDb, item)) {
      storedItems += 1;
    }
  }

  return {
    crawledSources: sources.length,
    crawledItems: deduped.size,
    storedItems,
  };
}

export function listWorldCupNewsRows(pluginDb: PluginDb, limit = 20): WorldCupNewsRow[] {
  const parsedLimit = Math.max(1, Math.min(limit, 100));
  const rows = pluginDb
    .prepare(
      "SELECT * FROM news_items WHERE is_published = 1 AND category = ? ORDER BY published_at DESC LIMIT ?"
    )
    .all(WORLD_CUP_NEWS_CATEGORY, parsedLimit) as WorldCupNewsRow[];

  if (rows.length > 0) {
    return rows;
  }

  return worldCupNewsSeed.slice(0, parsedLimit).map((item, index) => ({
    id: item.id,
    title: item.title,
    body: item.summary,
    category: WORLD_CUP_NEWS_CATEGORY,
    image_url: null,
    source_url: item.sourceUrl,
    is_published: 1,
    published_at: Date.parse(item.publishedAt) || Date.now() - index * 60_000,
    created_at: Date.parse(item.publishedAt) || Date.now(),
    updated_at: Date.parse(item.publishedAt) || Date.now(),
    created_by: item.sourceLabel,
  }));
}

function rowToNewsItem(row: WorldCupNewsRow): WorldCupNewsItem {
  const summary = sanitizeWorldCupSummary(row.body ?? row.title);
  return {
    id: row.id,
    title: row.title,
    summary,
    publishedAt: new Date(row.published_at).toISOString(),
    sourceLabel: row.created_by ?? "World Cup",
    sourceUrl: row.source_url ?? "",
    tags: [WORLD_CUP_NEWS_CATEGORY],
    isBreaking: /عاجل|breaking/i.test(`${row.title} ${summary}`),
  };
}

export function listWorldCupNewsItems(pluginDb: PluginDb, limit = 20): WorldCupNewsItem[] {
  return listWorldCupNewsRows(pluginDb, limit).map(rowToNewsItem);
}

export function listBreakingWorldCupNewsItems(pluginDb: PluginDb, limit = 10): WorldCupNewsItem[] {
  const rows = listWorldCupNewsRows(pluginDb, Math.max(limit, 10));
  const breaking = rows.filter((item) => /عاجل|breaking/i.test(`${item.title} ${item.body ?? ""}`));

  return (breaking.length > 0 ? breaking : rows).slice(0, limit).map(rowToNewsItem);
}

export function listBreakingWorldCupNewsRows(pluginDb: PluginDb, limit = 10): WorldCupNewsRow[] {
  const rows = listWorldCupNewsRows(pluginDb, Math.max(limit, 10));
  const breaking = rows.filter((item) => /عاجل|breaking/i.test(`${item.title} ${item.body ?? ""}`));

  if (breaking.length > 0) {
    return breaking.slice(0, limit);
  }

  return rows.slice(0, limit);
}

export function startWorldCupNewsIngestionJob(app: FastifyInstance): void {
  if (crawlTimer) {
    return;
  }

  const run = async () => {
    try {
      await crawlWorldCupNews(app.pluginDb);
      app.log.info({ scope: "worldcup-news" }, "world cup news ingestion completed");
    } catch (error) {
      app.log.warn({ err: error instanceof Error ? error.message : String(error) }, "world cup news ingestion failed");
    }
  };

  const scheduleRun = () => {
    if (crawlInFlight) {
      return;
    }

    crawlInFlight = run().finally(() => {
      crawlInFlight = null;
    });
  };

  scheduleRun();
  crawlTimer = globalThis.setInterval(() => {
    scheduleRun();
  }, WORLD_CUP_NEWS_CRAWL_INTERVAL_MS);

  app.addHook("onClose", async () => {
    if (crawlTimer) {
      globalThis.clearInterval(crawlTimer);
      crawlTimer = null;
    }
    crawlInFlight = null;
  });
}
