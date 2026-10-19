/**
 * Ticker / suggestions routes — rotating curated items + popular queries.
 * Extracted from server.ts.
 */
import type { FastifyPluginAsync } from "fastify";
import type { PluginDb } from "../types/domain";
import { getLatestEngagementHighlights, isWorldCupRelated } from "./engagement";
import { readTickerSettings } from "../lib/ticker-settings.js";

interface TickerRoutesOptions {
  pluginDb: PluginDb;
}

type TickerItem = {
  kind: string;
  title: string;
  body?: string;
  url?: string;
  linkType?: string;
  linkId?: string;
};

function dedupeTickerItems(items: TickerItem[]): TickerItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.title}|${item.linkId || item.url || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const TICKER_CURATED: Array<{ kind: string; title: string; linkType?: string; linkId?: string }> = [
  { kind: "announce", title: "📋 شارك في استبيانات موطني المفتوحة", linkType: "route", linkId: "/surveys" },
  { kind: "announce", title: "💼 تصفح أحدث فرص العمل", linkType: "route", linkId: "/jobs" },
  { kind: "announce", title: "🛒 تصفح أحدث إعلانات السوق", linkType: "route", linkId: "/marketplace" },
  { kind: "announce", title: "💰 راجع المعاش والزيادات", linkType: "route", linkId: "/salary" },
  { kind: "announce", title: "🎓 راجع المساعدات والمنح المدرسية", linkType: "route", linkId: "/school-grants" },
  { kind: "tip", title: "💡 يمكنك حفظ أي رد لقراءته لاحقاً من المحفوظات" },
  { kind: "tip", title: "📋 النماذج الرسمية متاحة من قسم النماذج", linkType: "route", linkId: "/forms" },
]

export const tickerRoutes: FastifyPluginAsync<TickerRoutesOptions> = async (app, { pluginDb }) => {
  app.get("/api/ticker", async (req, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const query = req.query as Record<string, string | undefined>;
    const actorId = req.user?.id;
    const latestOnly = query?.mode === "latest";
    const settings = readTickerSettings(pluginDb);
    const items: TickerItem[] = [];

    // persistent items managed by admins
    try {
      const now = Date.now();
      const rows = pluginDb
        .prepare(
          `SELECT * FROM ticker_items
           WHERE (starts_at IS NULL OR starts_at <= ?)
             AND (ends_at IS NULL OR ends_at > ?)
           ORDER BY priority DESC, created_at DESC`,
        )
        .all(now, now) as Array<Record<string, unknown>>;
      for (const r of rows) {
        const kind = r.type === "announcement" ? "announce" : String(r.type);
        items.push({
          kind,
          title: String(r.title),
          body: r.body ? String(r.body) : undefined,
          url: r.url ? String(r.url) : undefined,
          linkType: r.link_type ? String(r.link_type) : undefined,
          linkId: r.link_id ? String(r.link_id) : undefined,
        });
      }
    } catch {
      /* ignore */
    }

    // Latest published posts and actionable features
    for (const highlight of (await getLatestEngagementHighlights(pluginDb)).slice(0, 20)) {
      items.push({
        kind: "latest",
        title: `🆕 ${highlight.title}`,
        body: highlight.summary,
        linkType: "route",
        linkId: highlight.href,
      });
    }

    // case updates from notifications
    try {
      let notifs;
      if (actorId) {
        notifs = pluginDb
          .prepare("SELECT * FROM notifications WHERE kind = 'ticket_reply' AND (user_id IS NULL OR user_id = ?) ORDER BY ts DESC LIMIT 5")
          .all(actorId) as Array<Record<string, unknown>>;
      } else {
        notifs = pluginDb
          .prepare("SELECT * FROM notifications WHERE kind = 'ticket_reply' AND user_id IS NULL ORDER BY ts DESC LIMIT 5")
          .all() as Array<Record<string, unknown>>;
      }
      for (const n of notifs) {
        items.push({
          kind: "case_update",
          title: String(n.title),
          body: String(n.body),
          linkType: n.ref_type ? String(n.ref_type) : undefined,
          linkId: n.ref_id ? String(n.ref_id) : undefined,
        });
      }
    } catch {
      /* ignore */
    }

    if (latestOnly) {
      const safeItems = items.filter((item) => !isWorldCupRelated(item.title, item.body, item.url, item.linkId, item.kind));
      const liveItems = dedupeTickerItems([
        ...safeItems.filter((item) => item.kind === "latest"),
        ...safeItems.filter((item) => item.kind !== "latest"),
      ]).slice(0, 20);
      return {
        items: liveItems.length > 0 ? liveItems : TICKER_CURATED.slice(0, 6),
        mode: "latest",
        generatedAt: Date.now(),
        settings,
      };
    }

    // popular user questions from chat_history
    try {
      const rows = pluginDb
        .prepare(
          `SELECT text, COUNT(*) as cnt FROM chat_history
           WHERE role = 'user' AND LENGTH(text) > 8 AND LENGTH(text) < 120
           GROUP BY text ORDER BY cnt DESC, MAX(ts) DESC LIMIT 5`,
        )
        .all() as Array<{ text: string; cnt: number }>;
      for (const r of rows) {
        items.push({ kind: "popular", title: `🔥 سؤال متكرر: ${r.text}` });
      }
    } catch {
      // chat_history may be empty
    }

    // question of the day
    const dayIndex = Math.floor(Date.now() / 86400000) % TICKER_CURATED.length;
    const qotd = TICKER_CURATED[dayIndex];
    items.push({ kind: "qotd", title: `🌟 ${qotd.title.replace(/^[^\s]+\s/, "")}` });

    // shuffle in curated items
    for (const item of TICKER_CURATED) {
      items.push(item);
    }

    return {
      items: dedupeTickerItems(items.filter((item) => !isWorldCupRelated(item.title, item.body, item.url, item.linkId, item.kind))).slice(0, 20),
      mode: "default",
      generatedAt: Date.now(),
      settings,
    };
  });
};
