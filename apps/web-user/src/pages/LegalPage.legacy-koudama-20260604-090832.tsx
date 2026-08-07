import { useEffect, useMemo, useState } from "react";
import { ArrowLeft24Regular, ArrowCounterclockwise24Regular, Search24Regular, Shield24Regular } from "../theme/watany-v4/legacyIconBridge";
import { WatanyFeatureTemplate } from "../components/template";
import { api } from "../lib/api";
import { useApp } from "../store/app";

type LegalHit = {
  source: string;
  id: string;
  title: string;
  domain?: string;
};

type LegalArticle = {
  id: string;
  article_number?: string;
  text: string;
  topic_tags: string[];
};

/* Derive a short label from the first line of article text */
function articleLabel(article: LegalArticle): string {
  const firstLine = article.text.split(/[/n.،]/)[0]?.trim() ?? "";
  return firstLine.length > 90 ? `${firstLine.slice(0, 90)}…` : firstLine;
}

/* ── Article list for a selected law ─────────────────────── */
function LawArticlesView({
  law,
  onBack,
  apiBaseUrl,
}: {
  readonly law: LegalHit;
  readonly onBack: () => void;
  readonly apiBaseUrl: string;
}) {
  const [articles, setArticles] = useState<LegalArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setArticles([]);
    api
      .getLegalLawArticles(law.id, apiBaseUrl)
      .then((res) => setArticles(res.items as LegalArticle[]))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [law.id, apiBaseUrl]);

  return (
    <div className="legal-articles-view" dir="rtl">
      <button type="button" className="legal-back-btn" onClick={onBack}>
        <ArrowLeft24Regular aria-hidden />
        رجوع إلى القائمة
      </button>

      <h2 className="legal-law-title">{law.title}</h2>

      {loading ? (
        <div className="muted">جارٍ تحميل المواد…</div>
      ) : articles.length === 0 ? (
        <div className="muted">لا توجد مواد متاحة لهذا القانون حالياً.</div>
      ) : (
        <ol className="legal-article-list">
          {articles.map((article) => (
            <li key={article.id} className="legal-article-item">
              <details>
                <summary className="legal-article-summary">
                  {article.article_number ? (
                    <span className="legal-article-num">المادة {article.article_number}</span>
                  ) : null}
                  <span className="legal-article-preview">{articleLabel(article)}</span>
                </summary>
                <div className="legal-article-body">{article.text}</div>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── Law list landing ─────────────────────────────────────── */
function LegalLandingPageBody() {
  const { apiBaseUrl } = useApp();
  const [items, setItems] = useState<LegalHit[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLaw, setSelectedLaw] = useState<LegalHit | null>(null);

  function loadLegal(q: string) {
    setLoading(true);
    setError("");
    api
      .getLegalContent(q.trim(), 50, undefined, apiBaseUrl)
      .then((res) => setItems((res.items as LegalHit[]) ?? []))
      .catch(() => {
        setError("تعذر تحميل القوانين حالياً.");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadLegal("");
  }, [apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => item.title.toLowerCase().includes(normalized));
  }, [items, query]);

  if (selectedLaw) {
    return (
      <LawArticlesView
        law={selectedLaw}
        onBack={() => setSelectedLaw(null)}
        apiBaseUrl={apiBaseUrl}
      />
    );
  }

  return (
    <main className="unified-pillar unified-pillar-slate legal-landing" dir="rtl">
      <section className="unified-pillar__hero" aria-labelledby="legal-title">
        <div className="unified-pillar__hero-copy">
          <span className="unified-pillar__eyebrow">موطني · المرجع القانوني</span>
          <h1 id="legal-title">القوانين والحقوق</h1>
          <p>اختر قانوناً أو تعميماً للاطلاع على مواده.</p>
        </div>
        <div className="unified-pillar__hero-icon" aria-hidden="true">
          <Shield24Regular />
        </div>
      </section>

      <section className="unified-pillar__search" aria-label="بحث في القوانين">
        <label className="unified-pillar__search-box">
          <span>بحث</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم القانون أو التعميم"
          />
        </label>
        <button type="button" className="watany-approved-home-icons faq-quick-action" onClick={() => loadLegal(query)}>
          <Search24Regular aria-hidden />
          بحث
        </button>
        <button type="button" className="watany-approved-home-icons faq-quick-action" onClick={() => { setQuery(""); loadLegal(""); }}>
          <ArrowCounterclockwise24Regular aria-hidden />
          عرض الكل
        </button>
      </section>

      {error ? <div className="panel-error">{error}</div> : null}
      {loading ? <div className="muted">جارٍ التحميل…</div> : null}

      <ul className="legal-law-list" aria-label="قائمة القوانين">
        {filteredItems.map((item) => (
          <li key={item.id} className="legal-law-row">
            <button
              type="button"
              className="legal-law-btn"
              onClick={() => setSelectedLaw(item)}
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function UnifiedGeneratedPillarPage() {
  return (
    <WatanyFeatureTemplate
      category="legal"
      eyebrow="WatanyBot unified surface"
      title="Legal"
      description="مراجع قانونية وروابط مواد داخل موطني."
      meta={[{ label: "Route", value: "/legal" }]}
      className="watany-template-batch-v141"
    >
      <div data-watany-template-batch="v1.4.1" data-watany-template-route="/legal">
        <LegalLandingPageBody />
      </div>
    </WatanyFeatureTemplate>
  );
}


