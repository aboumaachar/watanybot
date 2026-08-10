import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type LegalLawArticlesResponse } from "../../lib/api";
import type { SearchV2Hit } from "../../types/domain";
import { useConfig } from "../../store/app";
import { rankVeteranPriorityItems } from "../veteran-priority/veteranPriorityRanker";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./KoudamaLegalLibrarySearchPage.css";

type LegalCategory = "all" | "laws" | "decrees" | "rights" | "procedures" | "faq";

type LegalDocument = {
  id: string;
  title: string;
  type: string;
  category: Exclude<LegalCategory, "all">;
  summary: string;
  reference: string;
  updated: string;
  keywords: string[];
  endpoint: string;
};

const categories: Array<{ id: LegalCategory; label: string }> = [
  { id: "all", label: "الكل" },
  { id: "laws", label: "قوانين" },
  { id: "decrees", label: "مراسيم" },
  { id: "rights", label: "حقوق" },
  { id: "procedures", label: "إجراءات" },
  { id: "faq", label: "سؤال وجواب" },
];

const popularSearches = ["الابنة على العاتق", "تعويض عائلي", "المعاش", "مستندات مطلوبة", "مرسوم", "تقاعد", "وثائق رابطة", "نماذج رابطة"];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function categoryToTab(category: Exclude<LegalCategory, "all">): string {
  return category === "decrees" ? "browse" : category;
}

function parseTypeFromBody(body: string): string {
  const firstChunk = body.split("—")[0]?.trim();
  return firstChunk || "نظام";
}

export function inferLegalCategoryFromHit(hit: SearchV2Hit): Exclude<LegalCategory, "all"> {
  const legalType = parseTypeFromBody(hit.body || "");
  const searchable = normalizeText(`${hit.title} ${hit.body} ${hit.domain}`);

  if (legalType.includes("قانون")) return "laws";
  if (legalType.includes("مرسوم")) return "decrees";
  if (/(قانون|نظام|مرسوم|تعميم|قرار|لائحة|تشريع)/.test(normalizeText(hit.title))) return "laws";
  if (/(إجراء|معاملة|مستند|نماذج|طلب)/.test(searchable)) return "procedures";
  if (/(حق|حقوق|استحقاق)/.test(searchable)) return "rights";
  if (/(faq|سؤال|جواب|استفسار)/.test(searchable)) return "faq";

  return "rights";
}

export function mapSearchHitToLegalDocument(hit: SearchV2Hit): LegalDocument {
  const category = inferLegalCategoryFromHit(hit);
  const legalType = parseTypeFromBody(hit.body || "");
  const rawKeywords = [hit.domain, legalType, ...hit.title.split(/\s+/).slice(0, 4)].filter(Boolean);

  return {
    id: hit.id,
    title: hit.title,
    type: legalType,
    category,
    summary: (hit.body || "مرجع قانوني مباشر من بوابة المحتوى.").trim(),
    reference: `${hit.domain || "general"} / ${legalType}`,
    updated: "مباشر",
    keywords: rawKeywords,
    endpoint: `/legal?tab=${categoryToTab(category)}&doc=${encodeURIComponent(hit.id)}`,
  };
}

function mapTabToCategory(tab: string): LegalCategory {
  const normalized = tab.trim().toLowerCase();
  const map: Record<string, LegalCategory> = {
    laws: "laws",
    browse: "decrees",
    rights: "rights",
    procedures: "procedures",
    contact: "faq",
    trending: "faq",
    faq: "faq",
  };
  return map[normalized] || "all";
}

function getVisibleLegalDocuments(documents: LegalDocument[], activeCategory: LegalCategory, query: string): LegalDocument[] {
  const needle = normalizeText(query);
  const filtered = documents.filter((doc) => {
    const categoryMatch = activeCategory === "all" || doc.category === activeCategory;
    if (!categoryMatch) return false;
    if (!needle) return true;
    const haystack = normalizeText([doc.title, doc.type, doc.summary, doc.reference, ...doc.keywords].join(" "));
    return haystack.includes(needle);
  });

  return rankVeteranPriorityItems(filtered, query).map((entry) => entry.item);
}

export function countLegalDocumentsByCategory(documents: LegalDocument[]): Record<LegalCategory, number> {
  const counts: Record<LegalCategory, number> = {
    all: documents.length,
    laws: 0,
    decrees: 0,
    rights: 0,
    procedures: 0,
    faq: 0,
  };

  documents.forEach((document) => {
    counts[document.category] += 1;
  });

  return counts;
}

function buildSearchParamsForQuery(searchParams: URLSearchParams, nextQuery: string): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  const trimmed = nextQuery.trim();
  if (trimmed) {
    next.set("q", trimmed);
  } else {
    next.delete("q");
  }
  next.delete("doc");
  return next;
}

function buildSearchParamsForCategory(searchParams: URLSearchParams, nextCategory: LegalCategory): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (nextCategory === "all") {
    next.delete("tab");
  } else {
    next.set("tab", categoryToTab(nextCategory));
  }
  next.delete("doc");
  return next;
}

function useSelectedLawDetails(apiBaseUrl: string, selectedDocId: string | null) {
  const [selectedLaw, setSelectedLaw] = useState<LegalLawArticlesResponse | null>(null);
  const [isLoadingLaw, setIsLoadingLaw] = useState(false);
  const [lawError, setLawError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!selectedDocId) {
      setSelectedLaw(null);
      setLawError(null);
      setIsLoadingLaw(false);
      return;
    }

    const lawId = selectedDocId;

    async function loadLawDetails() {
      setIsLoadingLaw(true);
      setLawError(null);

      try {
        const payload = await api.getLegalLawArticles(lawId, apiBaseUrl);
        if (cancelled) return;
        setSelectedLaw(payload);
      } catch (error_) {
        if (cancelled) return;
        setSelectedLaw(null);
        setLawError(error_ instanceof Error ? error_.message : "تعذر تحميل مواد القانون.");
      } finally {
        if (!cancelled) {
          setIsLoadingLaw(false);
        }
      }
    }

    loadLawDetails();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, selectedDocId]);

  return { selectedLaw, isLoadingLaw, lawError };
}

type LegalLawDetailsPanelProps = {
  selectedDocId: string | null;
  isLoadingLaw: boolean;
  lawError: string | null;
  selectedLaw: LegalLawArticlesResponse | null;
  onClose: () => void;
};

function LegalLawDetailsPanel({
  selectedDocId,
  isLoadingLaw,
  lawError,
  selectedLaw,
  onClose,
}: Readonly<LegalLawDetailsPanelProps>) {
  if (!selectedDocId) {
    return null;
  }

  return (
    <section className="legal-library-law-details" aria-live="polite">
      <div className="legal-library-law-details__head">
        <h2>تفاصيل القانون</h2>
        <button type="button" onClick={onClose}>إغلاق</button>
      </div>

      {isLoadingLaw ? <p>جاري تحميل مواد القانون...</p> : null}
      {!isLoadingLaw && lawError ? <p>{lawError}</p> : null}

      {!isLoadingLaw && !lawError && selectedLaw ? (
        <>
          <h3>{selectedLaw.lawName}</h3>
          <p>{selectedLaw.articleCount} مادة متاحة.</p>
          <div className="legal-library-law-details__articles">
            {selectedLaw.items.slice(0, 8).map((article) => (
              <article key={article.id}>
                <strong>{article.article_number ? `المادة ${article.article_number}` : "مادة"}</strong>
                <p>{article.text}</p>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

type LegalResultsSectionProps = {
  isLoading: boolean;
  loadError: string | null;
  visibleDocuments: LegalDocument[];
};

function LegalResultsSection({ isLoading, loadError, visibleDocuments }: Readonly<LegalResultsSectionProps>) {
  return (
    <section className="legal-library-results" aria-live="polite">
      <div className="legal-library-results__head">
        <div>
          <h2>النتائج</h2>
          <p>{visibleDocuments.length} نتيجة ضمن المكتبة القانونية</p>
        </div>
        <span>بحث أولاً</span>
      </div>

      {isLoading ? (
        <div className="legal-library-empty">
          <strong>جاري تحميل المحتوى القانوني...</strong>
          <span>الرجاء الانتظار لحظات.</span>
        </div>
      ) : null}

      {!isLoading && loadError ? (
        <div className="legal-library-empty" data-legal-library-error="true">
          <strong>تعذر تحميل المحتوى القانوني</strong>
          <span>{loadError}</span>
        </div>
      ) : null}

      <div className="legal-library-result-list">
        {!isLoading && !loadError ? visibleDocuments.map((doc, idx) => (
          <article className="legal-library-result-card" key={`${doc.id}-${idx}`}>
            <div className="legal-library-result-card__body">
              <h3>{doc.title}</h3>
                 <p>
                   {doc.summary} {" "}
                   <Link to={doc.endpoint} className="legal-library-open-button" aria-label={`فتح ${doc.title}`}>
                     فتح
                   </Link>
                 </p>
            </div>
          </article>
        )) : null}

        {!isLoading && !loadError && visibleDocuments.length === 0 ? (
          <div className="legal-library-empty">
            <strong>لا توجد نتيجة مباشرة</strong>
            <span>جرّب كلمة أبسط أو اختر تصنيفاً آخر من الأعلى.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function KoudamaLegalLibrarySearchPage() {
  const { apiBaseUrl } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<LegalCategory>("all");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [libraryDocuments, setLibraryDocuments] = useState<LegalDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { selectedLaw, isLoadingLaw, lawError } = useSelectedLawDetails(apiBaseUrl, selectedDocId);

  useEffect(() => {
    const tab = (searchParams.get("tab") || "").trim();
    const incomingQuery = (searchParams.get("q") || "").trim();
    const docId = (searchParams.get("doc") || "").trim();

    setActiveCategory(mapTabToCategory(tab));
    setQuery(incomingQuery);
    setSelectedDocId(docId || null);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await api.getLegalContent(query.trim(), 50, undefined, apiBaseUrl);
        if (cancelled) return;
        const mappedDocuments = (response.items || []).map(mapSearchHitToLegalDocument);
        setDocuments(mappedDocuments);

        if (!query.trim()) {
          setLibraryDocuments(mappedDocuments);
        }
      } catch (error_) {
        if (cancelled) return;
        setDocuments([]);
        setLoadError(error_ instanceof Error ? error_.message : "تعذر تحميل المحتوى القانوني.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadContent();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, query]);

  function syncQuery(nextQuery: string) {
    setQuery(nextQuery);
    const next = buildSearchParamsForQuery(searchParams, nextQuery);
    setSearchParams(next, { replace: true });
  }

  function syncCategory(nextCategory: LegalCategory) {
    setActiveCategory(nextCategory);
    const next = buildSearchParamsForCategory(searchParams, nextCategory);
    setSearchParams(next, { replace: true });
  }

  function clearSelectedLaw() {
    const next = new URLSearchParams(searchParams);
    next.delete("doc");
    setSearchParams(next, { replace: true });
  }

  const visibleDocuments = useMemo(() => {
    return getVisibleLegalDocuments(documents, activeCategory, query);
  }, [activeCategory, documents, query]);

  const categoryCounts = useMemo(() => countLegalDocumentsByCategory(libraryDocuments), [libraryDocuments]);

  return (
    <main className="legal-library-page" dir="rtl" data-legal-library-search-layout="v1">
      <section className="legal-library-hero" aria-labelledby="legal-library-title">
        <div className="legal-library-hero__content">
          <span className="legal-library-eyebrow">المكتبة القانونية</span>
          <h1 id="legal-library-title">ابحث في القوانين والمراسيم والمواد</h1>
          <p>اكتب كلمة، مادة، حق، أو مستند. النتائج تظهر كمدخل سريع قبل فتح النص الكامل.</p>
        </div>

        <div className="legal-library-search-card" role="search">
          <label htmlFor="legal-library-search">بحث قانوني</label>
          <div className="legal-library-search-box">
            <input
              id="legal-library-search"
              value={query}
              onChange={(event) => syncQuery(event.target.value)}
              placeholder="مثال: الابنة على العاتق، تعويض عائلي، مرسوم..."
              autoComplete="off"
            />
            {query.trim() ? (
              <div className="legal-library-search-actions">
                <button type="button" onClick={() => syncQuery(query.trim())} aria-label="بحث">بحث</button>
                <button type="button" onClick={() => syncQuery("")} aria-label="مسح البحث">×</button>
              </div>
            ) : (
              <button type="button" onClick={() => syncQuery(query.trim())} aria-label="بحث">بحث</button>
            )}
          </div>
          <div className="legal-library-popular" aria-label="عمليات بحث شائعة">
            {popularSearches.map((item) => (
              <button type="button" key={item} onClick={() => syncQuery(item)}>{item}</button>
            ))}
          </div>
        </div>
      </section>

      <nav className="legal-library-categories" aria-label="تصنيف قانوني">
        {categories.map((category) => (
          <button
            key={category.id}
            data-feature-key={category.id}
            type="button"
            className={activeCategory === category.id ? "is-active" : ""}
            onClick={() => syncCategory(category.id)}
          >
            <strong>{category.label}</strong>
            <span>{categoryCounts[category.id]} مستند</span>
          </button>
        ))}
      </nav>

      <LegalResultsSection isLoading={isLoading} loadError={loadError} visibleDocuments={visibleDocuments} />

      <LegalLawDetailsPanel
        selectedDocId={selectedDocId}
        isLoadingLaw={isLoadingLaw}
        lawError={lawError}
        selectedLaw={selectedLaw}
        onClose={clearSelectedLaw}
      />

      <section className="legal-library-shortcuts" aria-label="إرشادات البحث القانوني">
        <article><strong>للبحث بالمادة</strong><span>اكتب رقم المادة أو اسم القانون.</span></article>
        <article><strong>للبحث بالحالة</strong><span>استخدم كلمات مثل: تقاعد، تعويض، مستندات.</span></article>
        <article><strong>مصدر المحتوى</strong><span>النصوص مأخوذة من خدمة المحتوى القانوني الحية.</span></article>
      </section>
    </main>
  );
}

export default KoudamaLegalLibrarySearchPage;
