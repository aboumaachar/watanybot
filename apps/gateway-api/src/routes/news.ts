import { load } from "cheerio";
import { createHash, createHmac } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

export interface NewsItem {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  image_url: string | null;
  source_url: string | null;
  published_at: number;
  is_published: number;
  created_at: number;
  updated_at: number;
  created_by: string | null;
}

const NNA_LATEST_NEWS_URL = "https://www.nna-leb.gov.lb/ar/latest-news";
const NNA_RSS_URL = "https://www.nna-leb.gov.lb/ar/rss";
const NNA_BACKEND_BASE_URL = "https://backend.nna-leb.gov.lb/api/v2";
const NNA_FETCH_TIMEOUT_MS = 15000;
const NNA_CACHE_TTL_MS = 5 * 60 * 1000;
const FACTCHECK_LANDING_URL = "https://factchecklebanon.nna-leb.gov.lb/";
const FACTCHECK_FETCH_TIMEOUT_MS = 15000;
const FACTCHECK_CACHE_TTL_MS = 5 * 60 * 1000;
const PUBLIC_NEWS_COLUMNS = "id, title, body, category, image_url, source_url, is_published, published_at, created_at, updated_at, created_by";

type NewsRow = NewsItem;

type NnaCacheEntry = {
  fetchedAt: number;
  items: NewsRow[];
};

export type FakeNewsItem = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  status: "زائف" | "صحيح" | "غير مؤكد" | null;
  image_url: string | null;
  source_url: string;
  published_at: number;
  verified_at: number | null;
  source_name: string;
};

type FactCheckCacheEntry = {
  fetchedAt: number;
  items: FakeNewsItem[];
};

type NnaApiNewsCategory = {
  title?: string | null;
};

type NnaApiNewsItem = {
  id: number;
  url?: string | null;
  title?: string | null;
  short_title?: string | null;
  publish_date?: number | null;
  diff_for_humans?: string | null;
  image?: string | null;
  category?: NnaApiNewsCategory | null;
};

type NnaApiResponse = {
  data?: {
    news?: NnaApiNewsItem[];
  };
};

let nnaCache: NnaCacheEntry | null = null;
let factCheckCache: FactCheckCacheEntry | null = null;

function compactText(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(href: string): string {
  return new URL(href, NNA_LATEST_NEWS_URL).toString();
}

function toAbsoluteFactCheckUrl(href: string): string {
  return new URL(href, FACTCHECK_LANDING_URL).toString();
}

function normalizeCategory(category: string | null | undefined): string | null {
  const compacted = compactText(category);
  return compacted.length ? compacted : null;
}

function getNnaSigningConfig(): { clientId: string; signingKey: string } {
  return {
    clientId: process.env.NNA_CLIENT_ID?.trim() || "",
    signingKey: process.env.NNA_SIGNING_KEY?.trim() || "",
  };
}

function parseFactCheckDate(dateText: string | null | undefined): number | null {
  const normalized = compactText(dateText);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const timestamp = Date.parse(`${normalized}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseFactCheckStatus(raw: string): FakeNewsItem["status"] {
  if (raw.includes("غير مؤكد")) return "غير مؤكد";
  if (raw.includes("زائف")) return "زائف";
  if (raw.includes("صحيح")) return "صحيح";
  return null;
}

function parseFactCheckCategory(titleWithoutStatus: string): string | null {
  const knownCategories = [
    "متفرقات",
    "سياسة",
    "أمن وقضاء",
    "اقتصاد وأعمال",
    "اقتصاد",
    "دوليات",
    "رياضة",
    "من الجنوب",
    "ثقافة",
    "صحة",
    "تربية",
    "قضاء",
  ];

  for (const candidate of knownCategories) {
    if (titleWithoutStatus.startsWith(`${candidate} `) || titleWithoutStatus === candidate) {
      return candidate;
    }
  }

  return null;
}

function parseFactCheckMetadata(text: string): {
  status: FakeNewsItem["status"];
  category: string | null;
  publishedAt: number | null;
  verifiedAt: number | null;
  cleanedTitle: string;
} {
  const status = parseFactCheckStatus(text);
  const publishedMatch = /تم\s+النشر\s+في:\s*(\d{4}-\d{2}-\d{2})/.exec(text);
  const verifiedMatch = /تم\s+التحقق\s+في:\s*(\d{4}-\d{2}-\d{2})/.exec(text);
  const publishedAt = parseFactCheckDate(publishedMatch?.[1]);
  const verifiedAt = parseFactCheckDate(verifiedMatch?.[1]);

  let cleanedTitle = compactText(text.replace(/تم\s+النشر\s+في:.*$/g, "").replace(/تم\s+التحقق\s+في:.*$/g, ""));
  if (status) {
    cleanedTitle = compactText(cleanedTitle.replace(new RegExp(`^${status}`), ""));
  }

  const category = parseFactCheckCategory(cleanedTitle);
  if (category) {
    cleanedTitle = compactText(cleanedTitle.replace(new RegExp(`^${category}`), ""));
  }

  return {
    status,
    category,
    publishedAt,
    verifiedAt,
    cleanedTitle,
  };
}

function buildNnaRequestHeaders(path: string, method: string, body = ""): Record<string, string> {
  const { clientId, signingKey } = getNnaSigningConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const requestPath = path.split("?")[0] ?? path;
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const signaturePayload = `${timestamp}\n${method.toUpperCase()}\n/api/v2${requestPath}\n${bodyHash}`;

  return {
    Accept: "application/json",
    "X-Client-ID": clientId,
    "X-Timestamp": String(timestamp),
    "X-Signature": createHmac("sha256", signingKey).update(signaturePayload).digest("hex"),
  };
}

export function buildMergedNewsFeed(
  adminRows: NewsRow[],
  nnaRows: NewsRow[],
  options?: { category?: string; limit?: number },
): NewsRow[] {
  const category = normalizeCategory(options?.category);
  const limit = Math.max(0, options?.limit ?? 50);
  const merged = [...adminRows, ...nnaRows]
    .filter((item) => item.is_published === 1)
    .filter((item) => (category ? compactText(item.category) === category : true))
    .sort((left, right) => right.published_at - left.published_at)
    .slice(0, limit);

  return merged;
}

export function parseNnaLatestNewsItems(pageHtml: string, now = Date.now()): NewsRow[] {
  const $ = load(pageHtml);
  const seen = new Set<string>();

  return $("a[href*='/ar/news/']")
    .map((index, element): NewsRow | null => {
      const link = $(element);
      const title = compactText(link.text());
      const href = compactText(link.attr("href"));

      if (!title || !href) {
        return null;
      }

      const container = link.closest("article, li, div, section, main");
      const directCategory = compactText(link.prevAll("a[href*='/ar/categories/']").first().text());
      const fallbackCategory = compactText(container.find("a[href*='/ar/categories/']").first().text());
      const category = normalizeCategory(directCategory || fallbackCategory);
      const sourceUrl = toAbsoluteUrl(href);
      const uniqueKey = sourceUrl.toLowerCase();

      if (seen.has(uniqueKey)) {
        return null;
      }
      seen.add(uniqueKey);

      return {
        id: `nna:${encodeURIComponent(sourceUrl)}`,
        title,
        body: category,
        category,
        image_url: null,
        source_url: sourceUrl,
        published_at: now - index * 60_000,
        is_published: 1,
        created_at: now,
        updated_at: now,
        created_by: "nna",
      } satisfies NewsRow;
    })
    .get()
    .filter((item): item is NewsRow => item !== null);
}

export function parseNnaRssItems(rssXml: string, now = Date.now()): NewsRow[] {
  const $ = load(rssXml, { xmlMode: true });
  const seen = new Set<string>();

  return $("item")
    .map((index, element): NewsRow | null => {
      const item = $(element);
      const title = compactText(item.find("title").first().text());
      const rawLink = compactText(item.find("link").first().text());
      const category = normalizeCategory(item.find("category").first().text());
      const description = compactText(item.find("description").first().text()) || category;
      const publishedAtRaw = compactText(item.find("pubDate").first().text());
      const publishedAt = Date.parse(publishedAtRaw);

      if (!title || !rawLink) {
        return null;
      }

      const sourceUrl = toAbsoluteUrl(rawLink);
      const uniqueKey = sourceUrl.toLowerCase();
      if (seen.has(uniqueKey)) {
        return null;
      }
      seen.add(uniqueKey);

      return {
        id: `nna:${encodeURIComponent(sourceUrl)}`,
        title,
        body: description || null,
        category,
        image_url: null,
        source_url: sourceUrl,
        published_at: Number.isFinite(publishedAt) ? publishedAt : now - index * 60_000,
        is_published: 1,
        created_at: now,
        updated_at: now,
        created_by: "nna",
      } satisfies NewsRow;
    })
    .get()
    .filter((item): item is NewsRow => item !== null);
}

export function mapNnaApiNewsItems(payload: NnaApiResponse, now = Date.now()): NewsRow[] {
  const items = payload.data?.news ?? [];

  return items
    .map((item, index): NewsRow | null => {
      const title = compactText(item.title ?? item.short_title);
      const sourceUrl = item.url ? toAbsoluteUrl(item.url) : null;
      const category = normalizeCategory(item.category?.title);
      const publishedAt = Number(item.publish_date ?? 0) * 1000;

      if (!title || !sourceUrl || !publishedAt) {
        return null;
      }

      return {
        id: `nna:${item.id}`,
        title,
        body: compactText(item.diff_for_humans ?? item.short_title) || category,
        category,
        image_url: item.image ? toAbsoluteUrl(item.image) : null,
        source_url: sourceUrl,
        published_at: publishedAt || now - index * 60_000,
        is_published: 1,
        created_at: now,
        updated_at: now,
        created_by: "nna",
      } satisfies NewsRow;
    })
    .filter((item): item is NewsRow => item !== null);
}

export function parseFactCheckLandingItems(pageHtml: string, now = Date.now()): FakeNewsItem[] {
  const $ = load(pageHtml);
  const seen = new Set<string>();

  return $("a[href*='/auth/rumor/'], a[href*='/rumor/']")
    .map((index, element) => {
      const link = $(element);
      const href = compactText(link.attr("href"));

      if (!href || !/\/(?:auth\/)?rumor\/\d+\//.test(href)) {
        return null;
      }

      const sourceUrl = toAbsoluteFactCheckUrl(href);
      const uniqueKey = sourceUrl.toLowerCase();
      if (seen.has(uniqueKey)) {
        return null;
      }
      seen.add(uniqueKey);

      const container = link.closest("article, li, div, section, main");
      const text = compactText(`${link.text()} ${container.text()}`);
      const metadata = parseFactCheckMetadata(text);
      const title = metadata.cleanedTitle || compactText(link.text());

      if (!title) {
        return null;
      }

      const imageSrc = compactText(container.find("img").first().attr("src"));
      const summary = compactText(
        container
          .find("p")
          .toArray()
          .map((node) => $(node).text())
          .join(" "),
      ) || null;

      return {
        id: `factcheck:${encodeURIComponent(sourceUrl)}`,
        title,
        summary,
        category: metadata.category,
        status: metadata.status,
        image_url: imageSrc ? toAbsoluteFactCheckUrl(imageSrc) : null,
        source_url: sourceUrl,
        published_at: metadata.publishedAt ?? now - index * 60_000,
        verified_at: metadata.verifiedAt,
        source_name: "Fact Check Lebanon",
      } satisfies FakeNewsItem;
    })
    .get()
    .filter((item): item is FakeNewsItem => Boolean(item));
}

async function fetchFactCheckLandingItems(limit: number): Promise<FakeNewsItem[]> {
  const cached = factCheckCache;
  const now = Date.now();
  if (cached && now - cached.fetchedAt < FACTCHECK_CACHE_TTL_MS) {
    return cached.items.slice(0, limit);
  }

  const response = await fetch(FACTCHECK_LANDING_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "WatanyBot/1.0 (+https://koudama.com)",
    },
    signal: AbortSignal.timeout(FACTCHECK_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`factcheck_landing_fetch_failed_${response.status}`);
  }

  const html = await response.text();
  const items = parseFactCheckLandingItems(html, now).slice(0, limit);
  factCheckCache = { fetchedAt: now, items };
  return items;
}

async function fetchNnaLatestNewsItems(limit: number): Promise<NewsRow[]> {
  const cached = nnaCache;
  const now = Date.now();
  if (cached && now - cached.fetchedAt < NNA_CACHE_TTL_MS) {
    return cached.items.slice(0, limit);
  }

  // Prefer the signed backend API when credentials are configured, otherwise crawl public latest-news HTML.
  const { clientId, signingKey } = getNnaSigningConfig();
  if (clientId && signingKey) {
    const response = await fetch(`${NNA_BACKEND_BASE_URL}/ar/news/latest?page=1`, {
      headers: buildNnaRequestHeaders("/ar/news/latest?page=1", "GET"),
      signal: AbortSignal.timeout(NNA_FETCH_TIMEOUT_MS),
    });

    if (response.ok) {
      const payload = (await response.json()) as NnaApiResponse;
      const items = mapNnaApiNewsItems(payload, now).slice(0, limit);
      nnaCache = { fetchedAt: now, items };
      return items;
    }
  }

  const rssResponse = await fetch(NNA_RSS_URL, {
    headers: {
      Accept: "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "WatanyBot/1.0 (+https://koudama.com)",
    },
    signal: AbortSignal.timeout(NNA_FETCH_TIMEOUT_MS),
  });

  if (rssResponse.ok) {
    const rssXml = await rssResponse.text();
    const items = parseNnaRssItems(rssXml, now).slice(0, limit);
    if (items.length > 0) {
      nnaCache = { fetchedAt: now, items };
      return items;
    }
  }

  const fallbackResponse = await fetch(NNA_LATEST_NEWS_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "WatanyBot/1.0 (+https://koudama.com)",
    },
    signal: AbortSignal.timeout(NNA_FETCH_TIMEOUT_MS),
  });

  if (!fallbackResponse.ok) {
    throw new Error(`nna_latest_news_fallback_failed_${fallbackResponse.status}`);
  }

  const fallbackHtml = await fallbackResponse.text();
  const items = parseNnaLatestNewsItems(fallbackHtml, now).slice(0, limit);
  nnaCache = { fetchedAt: now, items };
  return items;
}

export const newsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/news — public list of published items (newest first)
  app.get<{ Querystring: { category?: string; limit?: string } }>(
    "/api/news",
    {
      config: {
        compress: false,
      },
    },
    async (req, reply) => {
      const { category, limit } = req.query;
      const parsedLimit = Number(limit ?? 50);
      const maxItems = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 50, 100);

      let adminRows: NewsRow[];
      if (category) {
        adminRows = app.pluginDb
          .prepare(
            `SELECT ${PUBLIC_NEWS_COLUMNS} FROM news_items WHERE is_published = 1 AND category = ? ORDER BY published_at DESC LIMIT ?`
          )
          .all(category, maxItems) as unknown as NewsItem[];
      } else {
        adminRows = app.pluginDb
          .prepare(
            `SELECT ${PUBLIC_NEWS_COLUMNS} FROM news_items WHERE is_published = 1 ORDER BY published_at DESC LIMIT ?`
          )
          .all(maxItems) as unknown as NewsItem[];
      }

      let nnaRows: NewsRow[] = [];
      try {
        nnaRows = await fetchNnaLatestNewsItems(maxItems);
      } catch (error) {
        req.log.warn({ error }, "nna_latest_news_fetch_failed");
      }

      const rows = buildMergedNewsFeed(adminRows, nnaRows, { category, limit: maxItems });
      const payloadBytes = Buffer.byteLength(JSON.stringify(rows));

      req.log.debug(
        {
          category: category ?? null,
          limit: maxItems,
          adminCount: adminRows.length,
          nnaCount: nnaRows.length,
          mergedCount: rows.length,
          payloadBytes,
        },
        "news_feed_response",
      );

      reply
        .type("application/json; charset=utf-8")
        .send(rows);
    }
  );

  app.get<{ Querystring: { status?: string; limit?: string } }>(
    "/api/fake-news",
    {
      config: {
        compress: false,
      },
    },
    async (req, reply) => {
      const { status, limit } = req.query;
      const parsedLimit = Number(limit ?? 50);
      const maxItems = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 50, 100);
      const normalizedStatus = compactText(status);

      let rows: FakeNewsItem[] = [];
      try {
        rows = await fetchFactCheckLandingItems(maxItems);
      } catch (error) {
        req.log.warn({ error }, "factcheck_landing_fetch_failed");
      }

      const filtered = normalizedStatus
        ? rows.filter((item) => compactText(item.status) === normalizedStatus)
        : rows;

      req.log.debug(
        {
          status: normalizedStatus || null,
          limit: maxItems,
          fetchedCount: rows.length,
          returnedCount: filtered.length,
        },
        "fake_news_feed_response",
      );

      reply
        .type("application/json; charset=utf-8")
        .send(filtered.slice(0, maxItems));
    },
  );
};
