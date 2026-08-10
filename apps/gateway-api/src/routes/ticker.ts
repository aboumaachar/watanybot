/**
 * Ticker / suggestions routes — rotating curated items + popular queries.
 * Extracted from server.ts.
 */
import type { FastifyPluginAsync } from "fastify";
import type { PluginDb } from "../types/domain";

interface TickerRoutesOptions {
  pluginDb: PluginDb;
}

const TICKER_CURATED: Array<{ kind: string; title: string; linkType?: string; linkId?: string }> = [
  { kind: "tip",      title: "💡 نصيحة اليوم: يمكنك حفظ أي رد بالنقر على المحفوظات لقراءته لاحقاً" },
  { kind: "tip",      title: "💡 هل تعلم؟ يمكنك التحدث صوتياً مع موطني بالضغط على 🎧" },
  { kind: "tip",      title: "💡 استخدم حاسبة الرواتب لمعرفة تفاصيل راتبك ومعاشك التقاعدي" },
  { kind: "tip",      title: "📋 النماذج الرسمية متاحة — اختر نموذجاً من القائمة لتعبئته وتحميله" },
  { kind: "announce", title: "📢 تم تحديث قاعدة المعرفة — 743 مقطع قانوني متاح للبحث" },
  { kind: "announce", title: "🔔 تابع حالة قضاياك ومستنداتك من الشريط الجانبي" },
  { kind: "announce", title: "🍎 فرصة عمل موسمية: قطاف التفاح في عين الحفة - تنورين", linkType: "route", linkId: "/jobs/ainelhafeh" },
  { kind: "announce", title: "💼 تحقق من أحدث عروض العمل", linkType: "route", linkId: "/jobs" },
  { kind: "announce", title: "🛒 تحقق من إعلانات السوق", linkType: "route", linkId: "/marketplace" },
  { kind: "announce", title: "💰 تحقق من معاشك", linkType: "route", linkId: "/salary" },
  { kind: "announce", title: "🎓 تحقق من المنح المدرسية", linkType: "route", linkId: "/school-grants" },
  { kind: "suggest",  title: "❓ سؤال شائع: ما هي شروط الإحالة على التقاعد؟" },
  { kind: "suggest",  title: "❓ سؤال شائع: كيف أحسب معاشي التقاعدي؟" },
  { kind: "suggest",  title: "❓ سؤال شائع: ما هي حقوق ذوي العسكري المتوفى؟" },
  { kind: "suggest",  title: "❓ سؤال شائع: كيف أقدم طلب مساعدة مدرسية؟" },
  { kind: "suggest",  title: "❓ سؤال شائع: ما هي إجراءات تسجيل الزواج؟" },
];

export const tickerRoutes: FastifyPluginAsync<TickerRoutesOptions> = async (app, { pluginDb }) => {
  app.get("/api/ticker", async (req) => {
    const userId = (req.query as Record<string, string | undefined>)?.userId;
    const items: Array<{ kind: string; title: string; body?: string; url?: string; linkType?: string; linkId?: string }> = [];

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

    // case updates from notifications
    try {
      let notifs;
      if (userId) {
        notifs = pluginDb
          .prepare("SELECT * FROM notifications WHERE kind = 'ticket_reply' AND (user_id IS NULL OR user_id = ?) ORDER BY ts DESC LIMIT 5")
          .all(userId) as Array<Record<string, unknown>>;
      } else {
        notifs = pluginDb
          .prepare("SELECT * FROM notifications WHERE kind = 'ticket_reply' ORDER BY ts DESC LIMIT 5")
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

    return { items };
  });
};
