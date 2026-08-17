
// ADDRESS_NETWORK_CANONICAL_ADDRESS_WIDGET_MIGRATION_REVIEWED
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FormViewer } from "../components/FormViewer";
import UtilityHeaderTitleRow from "../components/UtilityHeaderTitleRow";
import { api } from "../lib/api";
import type { FormListItem, FormSourceCard } from "../lib/api";
import { openWatanyUniversalFormViewer } from "../lib/watanyUniversalFormViewer";
import {
  getSourceVeteranRelevance,
  sortFormsByVeteranRelevance,
} from "../lib/forms-veteran-ranking";
import { useApp } from "../store/app";

function normalizeArabicSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F]/g, "")
    .trim();
}

function sourceSectionId(sourceId: string) {
  return `forms-source-section-${sourceId}`;
}

const SOURCE_NAME_FALLBACKS: Record<string, string> = {
  mof: "وزارة المالية",
  laf: "قيادة الجيش اللبناني",
  retirement: "دائرة التقاعد",
  medical: "الشؤون الطبية",
  grant: "قسم الشؤون",
  financial: "مالية / معاش تقاعدي",
  education: "المساعدة التعليمية",
  compensation: "تعويضات ومساعدات",
  admin: "الشؤون الإدارية",
  other: "مصادر أخرى",
};

function resolveSourceName(sourceId: string, sources: FormSourceCard[]): string {
  return sources.find((item) => item.sourceId === sourceId)?.sourceName || SOURCE_NAME_FALLBACKS[sourceId] || "مصدر غير محدد";
}

function getFormSummary(form: FormListItem): string {
  const summary = form.description || form.description_ar || form.instructions_ar || "";
  if (/مستند\/رابط\s+مرتبط\s+بمرجع\s+/i.test(summary) || /مرتبط\s+بمرجع\s+/i.test(summary)) {
    return "";
  }
  return summary.trim();
}

/** True when the downloadUrl is only the auto-generated JSON metadata fallback. */
function isDownloadFallbackOnly(form: FormListItem): boolean {
  return !form.downloadUrl || form.downloadUrl === `/api/forms/${encodeURIComponent(form.id)}/download`;
}

export default function FormsPage() {
  const { apiBaseUrl } = useApp();
  const navigate = useNavigate();
  const { sourceId } = useParams<{ sourceId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const previewDialogId = "watany-form-preview-dialog";

  const [sources, setSources] = useState<FormSourceCard[]>([]);
  const [items, setItems] = useState<FormListItem[]>([]);
  const [globalMatches, setGlobalMatches] = useState<FormListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<FormListItem | null>(null);

  const initialQuery = (searchParams.get("q") || "").trim();
  const [query, setQuery] = useState(initialQuery);

  const isSourcePage = Boolean(sourceId);

  useEffect(() => {
    setQuery((searchParams.get("q") || "").trim());
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    async function loadSources() {
      try {
        const response = await api.getFormSources(apiBaseUrl);
        if (!active) return;
        setSources(response.items || []);
      } catch {
        if (!active) return;
        setSources([]);
      }
    }

    void loadSources();
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const timer = globalThis.setTimeout(async () => {
      try {
        const options = {
          q: query || undefined,
          sourceId: sourceId || undefined,
        };
        const formResponse = await api.getForms(options, apiBaseUrl);

        if (!active) return;
        setItems(formResponse.items || []);

        if (!isSourcePage && query) {
          const globalResponse = await api.getForms({ q: query }, apiBaseUrl);
          if (!active) return;
          setGlobalMatches(globalResponse.items || []);
        } else {
          setGlobalMatches([]);
        }
      } catch {
        if (!active) return;
        setItems([]);
        setGlobalMatches([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      globalThis.clearTimeout(timer);
    };
  }, [apiBaseUrl, sourceId, query, isSourcePage]);

  const sourceTitle = sourceId ? resolveSourceName(sourceId, sources) : "النماذج الرسمية";

  const visibleSources = useMemo(() => {
    const filtered = sources.filter((src) => src.formCount > 0);
    return [...filtered].sort((left, right) => {
      const relevanceDelta = getSourceVeteranRelevance(right) - getSourceVeteranRelevance(left);
      if (relevanceDelta !== 0) return relevanceDelta;
      return right.formCount - left.formCount;
    });
  }, [sources]);

  const filteredGlobalMatches = useMemo(() => {
    if (!query) return globalMatches;
    const normalizedQuery = normalizeArabicSearch(query);
    const filtered = globalMatches.filter((item) => {
      const haystack = normalizeArabicSearch([
        item.title_ar,
        item.description_ar,
        item.sourceName,
        item.governance?.officialSourceLabel || "",
        item.governance?.officialReference || "",
        item.category || "",
        ...(item.tags || []),
      ].join(" "));
      return haystack.includes(normalizedQuery);
    });
    return sortFormsByVeteranRelevance(filtered);
  }, [globalMatches, query]);

  const sortedSourceItems = useMemo(() => sortFormsByVeteranRelevance(items), [items]);

  const groupedRootItems = useMemo(() => {
    if (isSourcePage || query) return [] as Array<{ sourceId: string; sourceName: string; description?: string; items: FormListItem[] }>;

    const grouped = new Map<string, FormListItem[]>();
    for (const item of sortFormsByVeteranRelevance(items)) {
      const key = item.sourceId || "other";
      const bucket = grouped.get(key);
      if (bucket) bucket.push(item);
      else grouped.set(key, [item]);
    }

    return visibleSources
      .map((source) => ({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        description: source.description,
        items: grouped.get(source.sourceId) || [],
      }))
      .filter((group) => group.items.length > 0);
  }, [isSourcePage, items, query, visibleSources]);

  async function previewForm(form: FormListItem) {
    if (!form.id) return;
    const full = await api.getFormById(form.id, apiBaseUrl);
    const selected = full ?? form;
    const previewHref = selected.previewUrl ?? selected.downloadUrl ?? selected.shareUrl;
    const downloadHref = selected.downloadUrl ?? selected.previewUrl;
    const hasFields = Array.isArray(selected.fields) && selected.fields.length > 0;

    if (previewHref) {
      await openWatanyUniversalFormViewer({
        titleAr: selected.title_ar,
        previewUrl: previewHref.startsWith("http") ? previewHref : `${apiBaseUrl}${previewHref}`,
        ...(downloadHref ? { downloadUrl: downloadHref.startsWith("http") ? downloadHref : `${apiBaseUrl}${downloadHref}` } : {}),
        preferUniversal: true,
      });
      return;
    }

    if (hasFields) {
      setSelectedForm(selected);
    }
  }

  function handlePreviewButtonClick(form: FormListItem) {
    void previewForm(form);
  }

  function getPreviewHref(form: FormListItem): string {
    const href = form.previewUrl ?? form.downloadUrl ?? `/api/forms/${encodeURIComponent(form.id)}/preview`;
    return href.startsWith("http") ? href : `${apiBaseUrl}${href}`;
  }

  function handlePreviewButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>, form: FormListItem) {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") {
      return;
    }

    event.preventDefault();
    void previewForm(form);
  }

  function downloadForm(form: FormListItem) {
    const hasFields = Array.isArray(form.fields) && form.fields.length > 0;
    const href = form.downloadUrl ?? form.previewUrl;
    if (!href) {
      if (hasFields) setSelectedForm(form);
      return;
    }
    globalThis.open(href.startsWith("http") ? href : `${apiBaseUrl}${href}`, "_blank", "noopener,noreferrer");
  }

  async function shareForm(form: FormListItem) {
    const href = form.shareUrl || form.previewUrl || form.downloadUrl || `/forms/${form.sourceId}`;
    const absoluteUrl = href.startsWith("http") ? href : `${globalThis.location.origin}${href}`;
    const payload = {
      title: form.title_ar,
      text: `${form.title_ar} — ${form.sourceName}`,
      url: absoluteUrl,
    };

    try {
      if (globalThis.navigator?.share) {
        await globalThis.navigator.share(payload);
        return;
      }
      await globalThis.navigator.clipboard.writeText(`${payload.title}\n${payload.url}`);
      alert("تم نسخ رابط النموذج.");
    } catch {
      // ignored
    }
  }

  function handleSearchChange(nextValue: string) {
    setQuery(nextValue);
    const next = new URLSearchParams(searchParams);
    if (nextValue.trim()) next.set("q", nextValue.trim());
    else next.delete("q");
    setSearchParams(next, { replace: true });
  }

  function openFormsMenu() {
    navigate("/forms");
  }

  function goBackFromSource() {
    const querySuffix = query ? `?q=${encodeURIComponent(query)}` : "";
    navigate(`/forms${querySuffix}`);
  }

  return (
    <div
      className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-library-screen"
      data-forms-scroll-root="true"
    >
      <header className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-library-header">
        {isSourcePage ? (
          <button
            type="button"
            className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-library-back"
            onClick={goBackFromSource}
          >
            <span>رجوع</span>
          </button>
        ) : null}
        <UtilityHeaderTitleRow
          titleAs="h1"
          title={sourceTitle}
        />
        {isSourcePage ? <p>{`${items.length} نموذج متاح`}</p> : null}
      </header>

      {isSourcePage ? (
        <nav className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-library-nav" aria-label="التنقل السريع">
          <button type="button" className="forms-library-nav__item forms-library-nav__item--back" onClick={goBackFromSource}>
            <span>عودة</span>
          </button>
          <button type="button" className="forms-library-nav__item" onClick={openFormsMenu}>
            <span>القائمة</span>
          </button>
          <button type="button" className="forms-library-nav__item" onClick={() => navigate("/search") }>
            <span>بحث</span>
          </button>
        </nav>
      ) : null}

      <div className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-library-search">
        <input
          value={query}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder={isSourcePage ? "ابحث عن نموذج داخل هذا المصدر..." : "ابحث عن نموذج أو جهة..."}
          aria-label="بحث عن نموذج"
        />
      </div>

      {loading ? (
        <div className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-library-empty">جارٍ تحميل النماذج...</div>
      ) : null}

      {/* Root view — all forms grouped by source */}
      {!loading && !isSourcePage && !query ? (
        <section className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-item-list" aria-label="كل النماذج بحسب المصدر">
          {groupedRootItems.length === 0 ? (
            <div className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-library-empty">لا توجد نماذج متاحة حالياً.</div>
          ) : null}
          {groupedRootItems.map((group) => (
            <section
              key={group.sourceId}
              id={sourceSectionId(group.sourceId)}
              className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-source-section"
              aria-label={group.sourceName}
            >
              <>
                <header className="forms-source-section__header">
                  <div className="forms-source-section__title-block">
                    <h2>{group.sourceName}</h2>
                  </div>
                </header>
                <div className="forms-source-section__body">
                      {group.items.map((form) => {
                        const summary = getFormSummary(form);
                        return (
                          <article key={form.id} className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-item-row forms-item-row--compact">
                            <div className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-item-row__main">
                              <div className="forms-item-row__title-row">
                                <h3>{form.title_ar}</h3>
                              </div>
                              {summary ? <p className="forms-item-summary">{summary}</p> : null}
                            </div>
                            <div className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-item-actions">
                              <a
                                className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-action-btn forms-action-btn--primary"
                                href={getPreviewHref(form)}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-form-preview-trigger="true"
                                aria-haspopup="dialog"
                                aria-controls={previewDialogId}
                              >
                                معاينة
                              </a>
                              <button
                                type="button"
                                className={`forms-action-btn${isDownloadFallbackOnly(form) ? " forms-action-btn--limited" : ""}`}
                                onClick={() => downloadForm(form)}
                                title={isDownloadFallbackOnly(form) ? "الطباعة متاحة من نافذة المعاينة" : undefined}
                              >
                                {isDownloadFallbackOnly(form) ? "طباعة" : "تحميل"}
                              </button>
                              <button type="button" className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-action-btn" onClick={() => void shareForm(form)}>
                                مشاركة
                              </button>
                            </div>
                          </article>
                        );
                      })}
                </div>
              </>
            </section>
          ))}
        </section>
      ) : null}

      {/* Global search results on root */}
      {!loading && !isSourcePage && query ? (
        <section className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-match-list" aria-label="نتائج البحث">
          <h3>نتائج البحث ({filteredGlobalMatches.length})</h3>
          {filteredGlobalMatches.length === 0 ? (
            <div className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-library-empty">لا توجد نتائج مطابقة لـ «{query}».</div>
          ) : null}
          {filteredGlobalMatches.map((form) => {
            const summary = getFormSummary(form);
            return (
            <article key={form.id} className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-item-row forms-item-row--compact">
              <div className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-item-row__main">
                <div className="forms-item-row__title-row">
                  <h2>{form.title_ar}</h2>
                </div>
                {summary ? <p className="forms-item-summary">{summary}</p> : null}
              </div>
              <div className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-item-actions">
                <a
                  className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-action-btn"
                  href={getPreviewHref(form)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-form-preview-trigger="true"
                  aria-haspopup="dialog"
                  aria-controls={previewDialogId}
                >
                  معاينة
                </a>
                <button
                  type="button"
                  className={`forms-action-btn${isDownloadFallbackOnly(form) ? " forms-action-btn--limited" : ""}`}
                  onClick={() => downloadForm(form)}
                  title={isDownloadFallbackOnly(form) ? "الطباعة متاحة من نافذة المعاينة" : undefined}
                >
                  {isDownloadFallbackOnly(form) ? "طباعة" : "تحميل"}
                </button>
                <button type="button" className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-action-btn" onClick={() => void shareForm(form)}>
                  مشاركة
                </button>
              </div>
            </article>
          );})}
        </section>
      ) : null}

      {/* Source detail view */}
      {!loading && isSourcePage ? (
        <section className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-item-list" aria-label="قائمة النماذج">
          {sortedSourceItems.length === 0 ? (
            <div className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-library-empty">لا توجد نماذج مطابقة ضمن هذا المصدر.</div>
          ) : null}
          {sortedSourceItems.map((form) => {
            const summary = getFormSummary(form);
            return (
            <article key={form.id} className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-item-row forms-item-row--compact">
              <div className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-item-row__main">
                <div className="forms-item-row__title-row">
                  <h2>{form.title_ar}</h2>
                </div>
                {summary ? <p className="forms-item-summary">{summary}</p> : null}
              </div>
              <div className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-item-actions">
                <a
                  className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-action-btn forms-action-btn--primary"
                  href={getPreviewHref(form)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-form-preview-trigger="true"
                  aria-haspopup="dialog"
                  aria-controls={previewDialogId}
                >
                  معاينة
                </a>
                <button
                  type="button"
                  className={`forms-action-btn${isDownloadFallbackOnly(form) ? " forms-action-btn--limited" : ""}`}
                  onClick={() => downloadForm(form)}
                  title={isDownloadFallbackOnly(form) ? "الطباعة متاحة من نافذة المعاينة" : undefined}
                >
                  {isDownloadFallbackOnly(form) ? "طباعة" : "تحميل"}
                </button>
                <button type="button" className="wmo-service-route wmo-rebuilt-route wmo-core-route wmo-route-normalized forms-action-btn" onClick={() => void shareForm(form)}>
                  مشاركة
                </button>
              </div>
            </article>
          );})}
        </section>
      ) : null}

      {selectedForm ? (
        <FormViewer form={selectedForm} onClose={() => setSelectedForm(null)} dialogId={previewDialogId} />
      ) : null}
    </div>
  );
}




// APEX_PHASE3C_SERVICE_ROUTE_READY: next safe slice may wrap this route with WatanyServiceRoute after component-specific review.

