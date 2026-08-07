import { useEffect, useState } from "react";
import { Megaphone24Regular } from "../theme/watany-v4/legacyIconBridge";
import { useApp } from "../store/app";
import { api, type NewsItem } from "../lib/api";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./news-page.css";


import { WatanyFeatureTemplate } from "../components/template";
function NewsPageLegacy() {
  const { apiBaseUrl } = useApp();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    let retryHandle: ReturnType<typeof setTimeout> | null = null;

    async function loadNews() {
      setLoading(true);
      setError(null);

      const sameOriginBase = globalThis.location?.origin;
      const baseCandidates = Array.from(new Set([apiBaseUrl, sameOriginBase]));

      for (const base of baseCandidates) {
        try {
          const data = await api.getNews(base);
          if (!cancelled) {
            setItems(data);
            setLoading(false);
          }
          return;
        } catch {
          // Try the next known gateway candidate.
        }
      }

      if (!cancelled) {
        setError("تعذّر تحميل الأخبار. حاول مجدداً.");
        setLoading(false);

        // Retry shortly because local gateway routing may stabilize after hydration/proxy startup.
        retryHandle = setTimeout(() => {
          void loadNews();
        }, 4000);
      }
    }

    setLoading(true);
    setError(null);
    void loadNews();
    return () => {
      cancelled = true;
      if (retryHandle) {
        clearTimeout(retryHandle);
      }
    };
  }, [apiBaseUrl]);

  const categories = ["all", ...Array.from(new Set(items.map((i) => i.category).filter((cat): cat is string => Boolean(cat))))];

  const filtered = category === "all" ? items : items.filter((i) => i.category === category);

  return (
    <div className="news-page" dir="rtl">
      <div className="news-page__header">
        <Megaphone24Regular aria-hidden className="news-page__header-icon" />
        <h1 className="news-page__title">الأخبار</h1>
      </div>

      {categories.length > 1 && (
        <div className="news-page__filters" aria-label="تصنيف الأخبار">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`news-page__filter-btn${category === cat ? " is-active" : ""}`}
              onClick={() => setCategory(cat)}
            >
              {cat === "all" ? "الكل" : cat}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="news-page__loader" aria-live="polite">
          <span className="news-page__spinner" />
          <span>جارٍ التحميل…</span>
        </div>
      )}

      {error && !loading && (
        <div className="news-page__error" role="alert">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="news-page__empty">لا توجد أخبار حالياً.</div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <ul className="news-page__list">
          {filtered.map((item) => (
            <li key={item.id} className="news-card">
              <div className="news-card__body">
                <div className="news-card__row">
                  {item.source_url ? (
                    <a className="news-card__title-link" href={item.source_url} target="_blank" rel="noopener noreferrer">
                      <h2 className="news-card__title">{item.title}</h2>
                    </a>
                  ) : (
                    <h2 className="news-card__title">{item.title}</h2>
                  )}
                  <time className="news-card__time" dateTime={new Date(item.published_at).toISOString()}>
                    {new Date(item.published_at).toLocaleTimeString("ar-LB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export default function NewsPage() {
  return (
    <WatanyFeatureTemplate
      category="updates"
      eyebrow="WatanyBot unified surface"
      title="News"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.2."
      meta={[{ label: "Route", value: "/news" }]}
      className="watany-template-batch-v142"
    >
      <div data-watany-template-batch="v1.4.2" data-watany-template-route="/news">
        <NewsPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}


