import { useEffect, useMemo, useState } from "react";
import { ShieldError24Regular } from "../theme/watany-v4/legacyIconBridge";
import { useApp } from "../store/app";
import { api, type FakeNewsItem } from "../lib/api";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./fake-news-page.css";


import { WatanyFeatureTemplate } from "../components/template";
const SOURCE_URL = "https://factchecklebanon.nna-leb.gov.lb/";

type StatusFilter = "all" | "زائف" | "غير مؤكد" | "صحيح";

function buildFallbackSummary(item: FakeNewsItem): string | null {
  const segments = [
    item.category ? `التصنيف: ${item.category}` : null,
    item.source_name ? `المصدر: ${item.source_name}` : null,
  ].filter((segment): segment is string => Boolean(segment));

  return segments.length > 0 ? segments.join(" • ") : null;
}

function statusClassName(status: Exclude<StatusFilter, "all">): string {
  if (status === "زائف") return "false";
  if (status === "غير مؤكد") return "uncertain";
  return "true";
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ar-LB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FakeNewsPageLegacy() {
  const { apiBaseUrl } = useApp();
  const [items, setItems] = useState<FakeNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let cancelled = false;
    let retryHandle: ReturnType<typeof setTimeout> | null = null;

    async function loadFakeNews() {
      setLoading(true);
      setError(null);

      const sameOriginBase = globalThis.location?.origin;
      const baseCandidates = Array.from(new Set([apiBaseUrl, sameOriginBase]));

      for (const base of baseCandidates) {
        try {
          const data = await api.getFakeNews(base);
          if (!cancelled) {
            setItems(data);
            setLoading(false);
          }
          return;
        } catch {
          // Continue to next gateway candidate.
        }
      }

      if (!cancelled) {
        setError("تعذّر تحميل منصة زائف. حاول مجدداً.");
        setLoading(false);
        retryHandle = setTimeout(() => {
          void loadFakeNews();
        }, 4000);
      }
    }

    void loadFakeNews();

    return () => {
      cancelled = true;
      if (retryHandle) {
        clearTimeout(retryHandle);
      }
    };
  }, [apiBaseUrl]);

  const statusOptions = useMemo<StatusFilter[]>(() => {
    const dynamicStatuses = Array.from(
      new Set(items.map((item) => item.status).filter((status): status is Exclude<StatusFilter, "all"> => Boolean(status))),
    );

    return ["all", ...dynamicStatuses];
  }, [items]);

  const statusCounts = useMemo(() => {
    return items.reduce<Record<Exclude<StatusFilter, "all">, number>>((acc, item) => {
      if (item.status) {
        acc[item.status] += 1;
      }
      return acc;
    }, {
      "زائف": 0,
      "غير مؤكد": 0,
      "صحيح": 0,
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") {
      return items;
    }

    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  return (
    <div className="fake-news-page" dir="rtl">
      <header className="fake-news-page__header">
        <div className="fake-news-page__title-wrap">
          <ShieldError24Regular aria-hidden className="fake-news-page__icon" />
          <div>
            <h1 className="fake-news-page__title">زائف</h1>
            <p className="fake-news-page__subtitle">منصة للتحقق من الأخبار والإشاعات المتداولة في لبنان والعالم.</p>
          </div>
        </div>
        <a className="fake-news-page__source-link" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
          المصدر الرسمي
        </a>
      </header>

      {statusOptions.length > 1 && (
        <div className="fake-news-page__filters" aria-label="تصفية حسب نتيجة التحقق">
          {statusOptions.map((status) => (
            <button
              key={status}
              type="button"
              className={`fake-news-page__filter-btn${statusFilter === status ? " is-active" : ""}`}
              onClick={() => setStatusFilter(status)}
            >
              {status === "all" ? `الكل (${items.length})` : `${status} (${statusCounts[status] ?? 0})`}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="fake-news-page__state" aria-live="polite">جارٍ تحميل تقارير التحقق…</div>
      )}

      {error && !loading && (
        <div className="fake-news-page__state fake-news-page__state--error" role="alert">{error}</div>
      )}

      {!loading && !error && filteredItems.length === 0 && (
        <div className="fake-news-page__state">لا توجد نتائج حالياً.</div>
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <ul className="fake-news-page__list">
          {filteredItems.map((item) => (
            <li key={item.id} className="fake-news-card">
              {item.image_url ? (
                <a href={item.source_url} className="fake-news-card__media" target="_blank" rel="noopener noreferrer" aria-label={`فتح خبر ${item.title}`}>
                  <img src={item.image_url} alt={item.title} loading="lazy" />
                </a>
              ) : null}

              <div className="fake-news-card__body">
                <a href={item.source_url} className="fake-news-card__title" target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>

                {(item.summary || buildFallbackSummary(item)) ? (
                  <p className="fake-news-card__summary">{item.summary || buildFallbackSummary(item)}</p>
                ) : null}

                <div className="fake-news-card__meta">
                  {item.status ? <span className={`fake-news-card__pill fake-news-card__pill--${statusClassName(item.status)}`}>{item.status}</span> : null}
                  {item.category ? <span className="fake-news-card__pill fake-news-card__pill--category">{item.category}</span> : null}
                  <span className="fake-news-card__pill fake-news-card__pill--source">{item.source_name}</span>
                  <time dateTime={new Date(item.published_at).toISOString()} className="fake-news-card__time">
                    نشر: {formatDateTime(item.published_at)}
                  </time>
                  {item.verified_at ? (
                    <time dateTime={new Date(item.verified_at).toISOString()} className="fake-news-card__time">
                      تحقق: {formatDateTime(item.verified_at)}
                    </time>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export default function FakeNewsPage() {
  return (
    <WatanyFeatureTemplate
      category="updates"
      eyebrow="WatanyBot unified surface"
      title="Fake News"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.1."
      meta={[{ label: "Route", value: "/fake-news" }]}
      className="watany-template-batch-v141"
    >
      <div data-watany-template-batch="v1.4.1" data-watany-template-route="/fake-news">
        <FakeNewsPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}


