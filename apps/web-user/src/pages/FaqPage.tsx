import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Chat24Regular } from "../theme/watany-v4/legacyIconBridge";
import { WatanyFeatureTemplate } from "../components/template";
import { api } from "../lib/api";
import { sortWatanyListingsVeteransFirst } from "../lib/watany-veterans-first-ranking";
import { useApp } from "../store/app";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/procedures-browser.css";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category?: string;
  procedureId?: string;
  tags?: string[];
  hitsTotal?: number;
  lastAskedAt?: string | null;
};

function FaqLandingPageBody() {
  const DEFAULT_VISIBLE_COUNT = 10;
  const LOAD_MORE_STEP = 10;
  const { apiBaseUrl } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);

  async function loadFaqs(currentQuery = query) {
    setLoading(true);
    setError("");
    try {
      const response = await api.getFaqs(currentQuery.trim() || undefined, apiBaseUrl);
      setItems(response.items);
      setVisibleCount(DEFAULT_VISIBLE_COUNT);
    } catch {
      setError("تعذر تحميل الأسئلة الشائعة حالياً.");
      setItems([]);
      setVisibleCount(DEFAULT_VISIBLE_COUNT);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFaqs("");
  }, [apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? items.filter((item) => {
          const combined = [item.question, item.answer, item.category ?? "", ...(item.tags ?? [])].join(" ").toLowerCase();
          return combined.includes(normalized);
        })
      : items;

    const veteranSorted = sortWatanyListingsVeteransFirst(
      filtered.map((item) => ({
        ...item,
        title: item.question,
        titleAr: item.question,
        tags: item.tags ?? [],
      })),
      { query: normalized },
    ) as typeof filtered;

    return [...veteranSorted].sort((left, right) => {
      const leftHits = left.hitsTotal ?? 0;
      const rightHits = right.hitsTotal ?? 0;
      if (rightHits !== leftHits) return rightHits - leftHits;

      const leftLastAsked = left.lastAskedAt ? Date.parse(left.lastAskedAt) || 0 : 0;
      const rightLastAsked = right.lastAskedAt ? Date.parse(right.lastAskedAt) || 0 : 0;
      if (rightLastAsked !== leftLastAsked) return rightLastAsked - leftLastAsked;

      return 0;
    });
  }, [items, query]);

  const visibleItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);
  const canLoadMore = visibleCount < filteredItems.length;

  useEffect(() => {
    setVisibleCount(DEFAULT_VISIBLE_COUNT);
  }, [query]);

  function toggleItemExpanded(itemId: string) {
    setExpandedItemIds((current) => ({
      ...current,
      [itemId]: !current[itemId],
    }));
  }

  return (
    <div className="procedures-browser" dir="rtl">
      <section className="procedures-browser__top-filter" aria-label="البحث داخل الأسئلة">
        <span className="procedures-browser__top-filter-label">البحث</span>
        <input
          className="procedures-browser__top-filter-select"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث في الأسئلة الشائعة"
        />
      </section>

      {error ? <div className="procedures-browser__state procedures-browser__state--error">{error}</div> : null}
      {loading ? <div className="procedures-browser__state">جارٍ تحميل الأسئلة الشائعة...</div> : null}

      {!loading && !error ? (
        <section className="procedures-browser__sections" aria-label="الأسئلة الشائعة">
          <article className="procedures-browser__section">
            <div className="procedures-browser__section-caption">
              <span className="procedures-browser__section-title">كل الأسئلة الشائعة</span>
              <span className="procedures-browser__section-meta-label">{`${filteredItems.length} سؤال`}</span>
            </div>

            <div className="procedures-browser__items">
              {filteredItems.length === 0 ? <div className="procedures-browser__empty">لا توجد أسئلة مطابقة حالياً.</div> : null}
              {visibleItems.map((item) => {
                const isExpanded = Boolean(expandedItemIds[item.id]);
                return (
                  <article key={item.id} className="procedures-browser__item">
                    <button
                      type="button"
                      className="procedures-browser__item-row"
                      aria-expanded={isExpanded}
                      onClick={() => toggleItemExpanded(item.id)}
                    >
                      <h2 className="procedures-browser__item-title">{item.question}</h2>
                      <span className="procedures-browser__item-toggle" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                    </button>
                    {isExpanded ? (
                      <>
                        <div className="procedures-browser__item-main">
                          <p className="procedures-browser__item-summary">{item.answer}</p>
                        </div>
                        <div className="procedures-browser__item-meta">
                          <span className="procedures-browser__item-kind">{item.category || "عام"}</span>
                          {(item.tags ?? []).length > 0 ? (
                            <span className="procedures-browser__item-tags">{(item.tags ?? []).slice(0, 3).join(" · ")}</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="procedures-browser__item-open"
                          onClick={() => navigate(`/chat?draft=${encodeURIComponent(item.question)}`)}
                        >
                          <Chat24Regular aria-hidden />
                          افتح في المحادثة
                        </button>
                        <button
                          type="button"
                          className="procedures-browser__item-open"
                          onClick={() => navigate(`/procedures?search=${encodeURIComponent(item.question)}`)}
                        >
                          عرض الإجراء المرتبط
                        </button>
                      </>
                    ) : null}
                  </article>
                );
              })}
              {canLoadMore ? (
                <button
                  type="button"
                  className="procedures-browser__item-open"
                  onClick={() => setVisibleCount((current) => current + LOAD_MORE_STEP)}
                >
                  المزيد
                </button>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}

export default function UnifiedGeneratedPillarPage() {
  return (
    <WatanyFeatureTemplate
      category="general"
      eyebrow="WatanyBot unified surface"
      title="FAQ"
      description="أسئلة شائعة وروابط مساندة داخل موطني."
      meta={[{ label: "Route", value: "/faq" }]}
      className="watany-template-batch-v141"
    >
      <div data-watany-template-batch="v1.4.1" data-watany-template-route="/faq">
        <FaqLandingPageBody />
      </div>
    </WatanyFeatureTemplate>
  );
}


