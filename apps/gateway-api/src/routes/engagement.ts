import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { PluginDb } from "../types/domain";
import { query } from "../lib/db.js";

type EngagementRoutesOptions = { pluginDb: PluginDb };
type Highlight = {
  id: string;
  title: string;
  summary: string;
  kind: string;
  source: string;
  href: string;
  publishedAt?: number;
  demandCount?: number;
};

const FEATURE_CATALOG: Record<string, Omit<Highlight, "demandCount" | "publishedAt">> = {
  salary: { id: "salary", title: "Ø§Ù„Ù…Ø¹Ø§Ø´", summary: "Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø¹Ø§Ø´ ÙˆÙ…ØªØ§Ø¨Ø¹Ø© ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø±Ø§ØªØ¨ ÙˆØ§Ù„Ø¨Ø¯Ù„Ø§Øª.", kind: "Ø®Ø¯Ù…Ø©", source: "Ø­Ù‚ÙˆÙ‚ÙŠ ÙˆÙ…Ø¹Ø§Ø´ÙŠ", href: "/salary" },
  jobs: { id: "jobs", title: "Ø§Ù„ÙˆØ¸Ø§Ø¦Ù", summary: "ÙØ±Øµ Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…ØªØ§Ø­Ø© ÙˆØ§Ù„ØªÙ‚Ø¯ÙŠÙ… Ø¹Ù„ÙŠÙ‡Ø§.", kind: "ÙØ±Øµ", source: "Ø§Ù„Ø®Ø¯Ù…Ø§Øª ÙˆØ§Ù„ÙØ±Øµ", href: "/jobs" },
  marketplace: { id: "marketplace", title: "Ø§Ù„Ø³ÙˆÙ‚", summary: "Ø§Ù„Ø¥Ø¹Ù„Ø§Ù†Ø§Øª ÙˆØ§Ù„Ø®Ø¯Ù…Ø§Øª ÙˆØ§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ù…Ù†Ø´ÙˆØ±Ø© ÙÙŠ Ø§Ù„Ø³ÙˆÙ‚.", kind: "Ø³ÙˆÙ‚", source: "Ø§Ù„Ø³ÙˆÙ‚", href: "/marketplace" },
  forms: { id: "forms", title: "Ø§Ù„Ù†Ù…Ø§Ø°Ø¬", summary: "Ø§Ù„Ù†Ù…Ø§Ø°Ø¬ ÙˆØ§Ù„Ù…Ø¹Ø§Ù…Ù„Ø§Øª Ø§Ù„Ø±Ø³Ù…ÙŠØ© Ø§Ù„Ù…ØªØ§Ø­Ø©.", kind: "Ù†Ù…Ø§Ø°Ø¬", source: "Ù…Ø¹Ø§Ù…Ù„Ø§ØªÙŠ", href: "/forms" },
  procedures: { id: "procedures", title: "Ø§Ù„Ù…Ø¹Ø§Ù…Ù„Ø§Øª", summary: "Ø§Ù„Ù…Ø¹Ø§Ù…Ù„Ø§Øª ÙˆØ§Ù„Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø§Ù„Ø£ÙƒØ«Ø± Ø§Ø±ØªØ¨Ø§Ø·Ø§Ù‹ Ø¨Ø­Ø§Ø¬Ø§Øª Ø§Ù„Ù…ØªÙ‚Ø§Ø¹Ø¯ ÙˆØ¹Ø§Ø¦Ù„ØªÙ‡.", kind: "Ù…Ø¹Ø§Ù…Ù„Ø§Øª", source: "Ù…Ø¹Ø§Ù…Ù„Ø§ØªÙŠ", href: "/procedures" },
  news: { id: "news", title: "Ø§Ù„Ø£Ø®Ø¨Ø§Ø±", summary: "Ø¢Ø®Ø± Ø§Ù„Ø£Ø®Ø¨Ø§Ø± ÙˆØ§Ù„Ù…Ù†Ø´ÙˆØ±Ø§Øª Ø§Ù„Ù…ØªØ§Ø­Ø© ÙÙŠ Ù…ÙˆØ·Ù†ÙŠ.", kind: "Ø£Ø®Ø¨Ø§Ø±", source: "Ø§Ù„Ø£Ø®Ø¨Ø§Ø±", href: "/news" },
  community: { id: "community", title: "Ù…Ø¬ØªÙ…Ø¹ÙŠ", summary: "Ø§Ù„Ù…Ø¬ØªÙ…Ø¹ ÙˆØ§Ù„ØªÙˆØ§ØµÙ„ ÙˆØ§Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„Ù…Ø´ØªØ±ÙƒØ©.", kind: "Ù…Ø¬ØªÙ…Ø¹", source: "Ù…Ø¬ØªÙ…Ø¹ÙŠ", href: "/community" },
};
const WORLD_CUP_MARKERS = [
  "world cup",
  "worldcup",
  "world_cup",
  "fifa 2026",
  "fifa world cup",
  "كأس العالم",
  "كاس العالم",
  "مونديال",
  "/world-cup",
  "/worldcup",
];

const PUBLIC_CMS_ACTIVITY_ROUTES: Record<string, { href: string; source: string; kind: string }> = {
  articles: { href: "/articles", source: "المقالات", kind: "مقال" },
  news: { href: "/news", source: "الأخبار", kind: "خبر" },
  forms: { href: "/forms", source: "النماذج", kind: "نموذج" },
  procedures: { href: "/procedures", source: "المعاملات", kind: "معاملة" },
  documents: { href: "/documents", source: "المستندات", kind: "مستند" },
  circulars: { href: "/circulars", source: "التعاميم", kind: "تعميم" },
  surveys: { href: "/surveys", source: "الاستبيانات", kind: "استبيان" },
  polls: { href: "/surveys", source: "الاستبيانات", kind: "استبيان" },
  jobs: { href: "/jobs", source: "الوظائف", kind: "وظيفة" },
  "job-posts": { href: "/jobs", source: "الوظائف", kind: "وظيفة" },
  opportunities: { href: "/jobs", source: "الوظائف", kind: "وظيفة" },
}; 

const CURRENT_JOB_HIGHLIGHTS: Highlight[] = [
  { id: "job-ainelhafeh", title: "💼 قطاف التفاح في عين الحفة - تنورين", summary: "فرصة عمل موسمية متاحة عبر موطني.", kind: "وظيفة", source: "الوظائف", href: "/jobs/ainelhafeh", publishedAt: 1 },
  { id: "job-ain-mreisseh-building-assistant", title: "💼 مساعد مدير مبنى – عين المريسة", summary: "فرصة عمل متاحة عبر موطني.", kind: "وظيفة", source: "الوظائف", href: "/jobs/ain-mreisseh-building-assistant", publishedAt: 1 },
  { id: "job-middle-east-security", title: "💼 فرصة عمل في الأمن والحماية", summary: "فرصة عمل متاحة عبر موطني.", kind: "وظيفة", source: "الوظائف", href: "/jobs/middle-east-security", publishedAt: 1 },
  { id: "job-accredited-bulldozer-driver", title: "💼 فرصة عمل – سائق جرافة معتمد", summary: "فرصة عمل متاحة عبر موطني.", kind: "وظيفة", source: "الوظائف", href: "/jobs/accredited-bulldozer-driver/application/", publishedAt: 1 },
];

function normalizeActivityText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.toLowerCase().replace(/\s+/g, " ").trim();
  try { return JSON.stringify(value).toLowerCase().replace(/\s+/g, " ").trim(); }
  catch { return String(value).toLowerCase(); }
}

export function isWorldCupRelated(...values: unknown[]): boolean {
  const haystack = values.map(normalizeActivityText).filter(Boolean).join(" | ");
  return WORLD_CUP_MARKERS.some((marker) => haystack.includes(marker));
}

function activityEpoch(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function dedupeHighlights(items: Highlight[]): Highlight[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.title}|${item.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type CmsActivityRow = {
  domain: string;
  public_id: string;
  public_code: string | null;
  title: string;
  payload: Record<string, unknown> | string;
  created_at: string | Date;
  updated_at: string | Date;
  published_at: string | Date | null;
};

export async function getLatestEngagementHighlights(pluginDb: PluginDb): Promise<Highlight[]> {
  const rows: Highlight[] = [];

  try {
    const cms = await query<CmsActivityRow>(
      `SELECT domain,public_id,public_code,title,payload,created_at,updated_at,published_at
       FROM cms_content_entities
       WHERE status = 'PUBLISHED'
       ORDER BY COALESCE(published_at,created_at,updated_at) DESC NULLS LAST
       LIMIT 40`,
    );
    for (const item of cms.rows) {
      const domain = String(item.domain || "").trim().toLowerCase();
      const route = PUBLIC_CMS_ACTIVITY_ROUTES[domain];
      if (!route) continue;
      const stableId = String(item.public_code || item.public_id || "").trim();
      const href = domain === "articles" && stableId ? `/articles/${encodeURIComponent(stableId)}` : route.href;
      if (isWorldCupRelated(domain, item.title, item.payload, href)) continue;
      rows.push({
        id: `cms-${domain}-${item.public_id}`,
        title: item.title,
        summary: `محتوى جديد منشور في ${route.source}.`,
        kind: route.kind,
        source: route.source,
        href,
        publishedAt: activityEpoch(item.published_at || item.created_at || item.updated_at),
      });
    }
  } catch {
    /* PostgreSQL CMS can be unavailable in isolated tests; plugin sources remain usable. */
  }

  try {
    const news = pluginDb.prepare(
      `SELECT id,title,body,category,source_url,published_at FROM news_items
       WHERE is_published = 1 AND status = 'PUBLISHED'
       ORDER BY published_at DESC LIMIT 20`,
    ).all() as Array<{ id: string; title: string; body?: string; category?: string; source_url?: string; published_at: number }>;
    for (const item of news) {
      if (isWorldCupRelated(item.title, item.body, item.category, item.source_url)) continue;
      rows.push({ id: `news-${item.id}`, title: item.title, summary: "من أحدث الأخبار المنشورة في موطني.", kind: "خبر", source: "الأخبار", href: "/news", publishedAt: Number(item.published_at) || 0 });
    }
  } catch { /* source may be empty */ }

  try {
    const market = pluginDb.prepare(
      `SELECT id,title,description,category,created_at FROM marketplace_listings
       WHERE status IS NULL OR LOWER(status) NOT IN ('deleted','archived','rejected')
       ORDER BY created_at DESC LIMIT 12`,
    ).all() as Array<{ id: string; title: string; description?: string; category?: string; created_at: number }>;
    for (const item of market) {
      if (isWorldCupRelated(item.title, item.description, item.category)) continue;
      rows.push({ id: `market-${item.id}`, title: item.title, summary: "إعلان أو خدمة مضافة حديثاً إلى السوق.", kind: "سوق", source: "السوق", href: "/marketplace", publishedAt: Number(item.created_at) || 0 });
    }
  } catch { /* source may be empty */ }

  const dynamic = dedupeHighlights(
    rows
      .filter((item) => !isWorldCupRelated(item.title, item.summary, item.source, item.href))
      .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0)),
  ).slice(0, 16);

  const jobs = CURRENT_JOB_HIGHLIGHTS.filter(
    (item) => !dynamic.some((candidate) => candidate.href === item.href || candidate.title === item.title),
  );

  return dedupeHighlights([...dynamic, ...jobs])
    .filter((item) => !isWorldCupRelated(item.title, item.summary, item.source, item.href))
    .slice(0, 20);
}
function mostRequestedHighlights(pluginDb: PluginDb): Highlight[] {
  try {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const rows = pluginDb.prepare(
      `SELECT intent, COUNT(*) AS demand_count
       FROM analytics_events
       WHERE event_type = 'feature_open' AND created_at >= ? AND intent IS NOT NULL
       GROUP BY intent ORDER BY demand_count DESC, MAX(created_at) DESC LIMIT 8`,
    ).all(since) as Array<{ intent: string; demand_count: number }>;
    const highlights: Highlight[] = [];
    for (const row of rows) {
      const base = FEATURE_CATALOG[String(row.intent || "")];
      if (base) highlights.push({ ...base, demandCount: Number(row.demand_count) || 0 });
    }
    return highlights;
  } catch {
    return [];
  }
}

function recommendedHighlights(): Highlight[] {
  return [
    FEATURE_CATALOG.salary,
    FEATURE_CATALOG.jobs,
    FEATURE_CATALOG.procedures,
    FEATURE_CATALOG.forms,
    FEATURE_CATALOG.community,
  ];
}
export const engagementRoutes: FastifyPluginAsync<EngagementRoutesOptions> = async (app, { pluginDb }) => {
  app.get("/api/engagement/highlights", async () => ({
    ok: true,
    generatedAt: new Date().toISOString(),
    latest: await getLatestEngagementHighlights(pluginDb),
    mostRequested: mostRequestedHighlights(pluginDb),
    recommended: recommendedHighlights(),
  }));

  app.post<{ Body: { featureKey?: unknown } }>("/api/engagement/event", async (request, reply) => {
    const featureKey = typeof request.body?.featureKey === "string" ? request.body.featureKey.trim() : "";
    if (!FEATURE_CATALOG[featureKey]) return reply.code(400).send({ ok: false, error: "FEATURE_KEY_INVALID" });
    try {
      pluginDb.prepare(
        `INSERT INTO analytics_events (id, user_id, event_type, intent, text_hash, event_text, created_at)
         VALUES (?, NULL, 'feature_open', ?, NULL, NULL, ?)`,
      ).run(randomUUID(), featureKey, Date.now());
      return reply.code(201).send({ ok: true });
    } catch {
      return reply.code(503).send({ ok: false, error: "ENGAGEMENT_EVENT_STORE_UNAVAILABLE" });
    }
  });
};

export default engagementRoutes;
