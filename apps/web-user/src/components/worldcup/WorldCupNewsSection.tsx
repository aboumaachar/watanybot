import { useEffect, useState } from "react";
import { api, type WorldCupNewsCrawlSource, type WorldCupNewsItem } from "../../lib/api";
import { useApp } from "../../store/app";

const localNewsSeed: WorldCupNewsItem[] = [
  {
    id: "wc-local-news-001",
    title: "تجريبي: تحديث رسمي لموعد المؤتمر الصحفي قبل الافتتاح",
    summary: "هذا خبر تجريبي محلي لصفحة أخبار كأس العالم حتى تعمل الصفحة حتى عند غياب مصدر حي.",
    publishedAt: "2026-05-29T10:00:00Z",
    sourceLabel: "بذرة محلية",
    sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026",
    tags: ["تجريبي", "مؤتمر صحفي"],
    isBreaking: false,
  },
  {
    id: "wc-local-news-002",
    title: "عاجل: تحديث بروتوكول يوم المباراة",
    summary: "تم تفعيل حالة خبر عاجل تجريبية لإظهار تنبيه الأخبار الكبرى في الواجهة.",
    publishedAt: "2026-05-29T11:45:00Z",
    sourceLabel: "بذرة محلية",
    sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026",
    tags: ["عاجل", "تجريبي"],
    isBreaking: true,
  },
];

const localSourcesSeed: WorldCupNewsCrawlSource[] = [
  {
    id: "fifa-official",
    label: "فيفا الرسمية لكأس العالم 2026",
    baseUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026",
    feedUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures",
    crawlIntervalMinutes: 15,
    parser: "html",
    enabled: true,
  },
];

function byPublishedAtDesc(left: WorldCupNewsItem, right: WorldCupNewsItem): number {
  return Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
}

function formatRelativePublishedAt(publishedAt: string): string {
  const publishedTime = Date.parse(publishedAt);
  if (Number.isNaN(publishedTime)) {
    return "منذ قليل";
  }

  const diffMs = publishedTime - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const absoluteMinutes = Math.abs(diffMinutes);
  const formatter = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });

  if (absoluteMinutes < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function getSourceChipClass(sourceLabel: string): string {
  const normalized = sourceLabel.toLowerCase();

  if (normalized.includes("fifa")) {
    return "wc-news-card__source-chip wc-news-card__source-chip--fifa";
  }

  if (normalized.includes("ap")) {
    return "wc-news-card__source-chip wc-news-card__source-chip--ap";
  }

  if (normalized.includes("kooora") || normalized.includes("كوورة")) {
    return "wc-news-card__source-chip wc-news-card__source-chip--kooora";
  }

  return "wc-news-card__source-chip";
}

export function WorldCupNewsSection() {
  const { apiBaseUrl } = useApp();
  const [items, setItems] = useState<WorldCupNewsItem[]>([]);
  const [breaking, setBreaking] = useState<WorldCupNewsItem[]>([]);
  const [sources, setSources] = useState<WorldCupNewsCrawlSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fallbackMode, setFallbackMode] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadNews() {
      setLoading(true);
      setError("");

      try {
        const [newsItems, breakingItems, crawlSources] = await Promise.all([
          api.getWorldCupNews(apiBaseUrl),
          api.getWorldCupBreakingNews(apiBaseUrl),
          api.getWorldCupNewsSources(apiBaseUrl),
        ]);

        if (!active) {
          return;
        }

        setItems([...newsItems].sort(byPublishedAtDesc));
        setBreaking([...breakingItems].sort(byPublishedAtDesc));
        setSources(crawlSources);
        setFallbackMode(false);
      } catch (reason) {
        if (!active) {
          return;
        }

        const fallbackItems = [...localNewsSeed].sort(byPublishedAtDesc);
        setItems(fallbackItems);
        setBreaking(fallbackItems.filter((item) => item.isBreaking));
        setSources(localSourcesSeed);
        setFallbackMode(true);
        setError(reason instanceof Error ? `تعذر تحميل الأخبار الحية، تم تفعيل البيانات التجريبية: ${reason.message}` : "تعذر تحميل الأخبار الحية، تم تفعيل البيانات التجريبية.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadNews();
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  return (
    <section className="wc-window" dir="rtl">
      <header className="wc-window__header">
        <h2>آخر أخبار كأس العالم</h2>
      </header>
      <div className="wc-window__body">
        {fallbackMode ? (
          <p className="wc-news-fallback">الوضع التجريبي مفعل: يتم عرض أخبار محلية حتى عودة التغذية الحية.</p>
        ) : null}

        {error ? <div className="wc-vote-error">{error}</div> : null}
        {loading ? <p className="watany-listing-card__summary">جارٍ تحميل الأخبار...</p> : null}

        {breaking.length > 0 ? (
          <div className="wc-breaking-wrap">
            <div className="wc-breaking-grid">
              {breaking.map((item) => (
                <article key={item.id} className="wc-breaking-card watany-listing-card">
                  <div className="wc-news-card__head">
                    <span className="wc-news-card__time">{formatRelativePublishedAt(item.publishedAt)}</span>
                    <span className={getSourceChipClass(item.sourceLabel)}>{item.sourceLabel}</span>
                  </div>
                  <h4 className="watany-listing-card__title">{item.title}</h4>
                  <p className="watany-listing-card__summary">{item.summary}</p>
                  <div className="wc-news-card__meta">
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">فتح المصدر</a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="wc-news-list">
          {items.map((item) => (
            <article key={item.id} className="wc-news-card watany-listing-card">
              <header className="wc-news-card__head">
                <span className="wc-news-card__time">{formatRelativePublishedAt(item.publishedAt)}</span>
                <span className={getSourceChipClass(item.sourceLabel)}>{item.sourceLabel}</span>
                <h4 className="watany-listing-card__title">{item.title}</h4>
              </header>
              <p className="watany-listing-card__summary">{item.summary}</p>
              <div className="wc-news-card__meta">
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">فتح المصدر</a>
              </div>
            </article>
          ))}
        </div>

        <div className="wc-crawl-sources">
          <h3>مصادر الزحف المعتمدة للتغذية</h3>
          <div className="wc-crawl-sources__list">
            {sources.map((source) => (
              <article key={source.id} className="wc-crawl-source-card watany-listing-card">
                <strong className="watany-listing-card__title">{source.label}</strong>
                <span className="watany-listing-card__summary">{source.baseUrl}</span>
                <span className="watany-listing-card__summary">كل {source.crawlIntervalMinutes} دقيقة · المحلل: {source.parser === "html" ? "صفحة ويب" : source.parser === "rss" ? "تغذية" : "واجهة برمجية"}</span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
