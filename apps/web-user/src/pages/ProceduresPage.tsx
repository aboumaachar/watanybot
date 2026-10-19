import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, type FormListItem } from "../lib/api";
import { getDefaultApiBaseUrl } from "../lib/api-base";
import { normalizeSearchableArabicInput } from "../lib/lang";
import { isVeteranRelevantProcedure, sortByProcedureVeteranRelevance, type ProcedureRankable } from "../lib/procedures-veteran-ranking";
import { openWatanyUniversalFormViewer } from "../lib/watanyUniversalFormViewer";
import { useApp } from "../store/app";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/procedures.css";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/procedures-browser.css";

const WatanyCompactProceduresViewer = lazy(() => import("../components/procedures/WatanyCompactProceduresViewer"));

// Mirror of gateway SOURCE_VETERAN_PRIORITY for frontend tab ordering
const SOURCE_VETERAN_PRIORITY: Record<string, number> = {
  mof: 100,
  procedures: 90,
  laf: 80,
  isf: 70,
  rabita: 60,
  other: 10,
};

const SOURCE_DISPLAY_META: Record<string, { title: string; basis: string }> = {
  mof: { title: "دائرة التقاعد", basis: "استناداً إلى mof.html" },
  procedures: { title: "الشؤون", basis: "إجراءات الشؤون المعتمدة" },
  laf: { title: "قيادة الجيش", basis: "استناداً إلى laf.html" },
  isf: { title: "قوى الأمن الداخلي", basis: "إجراءات متقاعدي قوى الأمن الداخلي" },
  rabita: { title: "الرابطة", basis: "رابطة قدماء القوى المسلحة" },
  other: { title: "مصادر اخرى", basis: "إجراءات مرجعية خارج التصنيف الأساسي" },
};

type ProcedureCatalogItem = {
  id: string;
  title_ar: string;
  summary_lb: string;
  steps?: string[];
  title_clean?: string;
  summary_clean?: string;
  faq_variants?: string[];
  tags?: string[];
  record_kind?: "procedure" | "reference" | "notice" | "fragment";
  source?: string;
  source_label?: string;
  source_anchors?: Array<{ file?: string; anchor?: string }>;
  section_path?: string[];
  section_label?: string;
  audience_scope?: ProcedureRankable["audience_scope"];
  content_tier?: ProcedureRankable["content_tier"];
  domain?: string;
  applies_to?: string[];
  relevance_weight?: number;
  score?: number;
};

type ProcedureCatalogSection = {
  id: string;
  title: string;
  source: string;
  source_label: string;
  count: number;
  items?: ProcedureCatalogItem[];
  notice_items?: ProcedureCatalogItem[];
  procedure_items?: ProcedureCatalogItem[];
  reference_items?: ProcedureCatalogItem[];
};

type ProcedureCatalogSource = {
  id: string;
  title: string;
  count: number;
  basis?: string;
  guide_mentions?: string[];
};

type ProcedureDocsResponse = {
  docs?: Array<{
    id?: string;
    title?: string;
    title_ar?: string;
    summary_lb?: string;
    description_lb?: string;
    preview_url?: string;
    download_url?: string;
    url?: string;
  }>;
};

type ProcedureDocItem = NonNullable<ProcedureDocsResponse["docs"]>[number];

type ProcedureCatalogResponse = {
  sources?: ProcedureCatalogSource[];
  sections?: ProcedureCatalogSection[];
};

type FaqSearchItem = {
  id: string;
  question: string;
  answer: string;
  category?: string;
  procedureId?: string;
  tags?: string[];
  hitsTotal?: number;
  lastAskedAt?: string | null;
};

type ProcedureSearchEntry = {
  sectionId: string;
  sectionTitle: string;
  sourceId: string;
  sourceTitle: string;
  item: ProcedureCatalogItem;
};

const API_BASE = getDefaultApiBaseUrl("8010");
const MAX_UNIFIED_SEARCH_RESULTS = 12;
const h = React.createElement;
const Fragment = React.Fragment;

function getItemTitle(item: ProcedureCatalogItem): string {
  return item.title_clean || item.title_ar || item.id;
}

function getItemSummary(item: ProcedureCatalogItem): string {
  return item.summary_clean || item.summary_lb || "لا يوجد وصف";
}


function isNonRelevantProcedureListing(item: ProcedureCatalogItem): boolean {
  const haystack = [
    item.title_ar || "",
    item.summary_lb || "",
    ...(item.tags || []),
  ].join(" ").toLowerCase();

  return (
    haystack.includes("ممثل عن ارباب العمل")
    || haystack.includes("ممثل عن الاجراء")
    || haystack.includes("ينشأ مجلس اعلى للدفاع")
  );
}

function scoreGuideDocumentPriority(item: ProcedureCatalogItem, section: ProcedureCatalogSection): number {
  const sectionText = [section.title || "", section.source_label || ""].join(" ").toLowerCase();
  const itemText = [item.title_ar || "", item.summary_lb || "", ...(item.tags || [])].join(" ").toLowerCase();

  // Give utmost weight to entries that belong to/mention the procedures guide (الدليل).
  if (
    sectionText.includes("الدليل")
    || sectionText.includes("دليل")
    || sectionText.includes("معاملات")
    || sectionText.includes("اجراءات")
    || itemText.includes("الدليل")
    || itemText.includes("دليل")
  ) {
    return 1000;
  }

  return 0;
}

function collectSectionItems(section: ProcedureCatalogSection): ProcedureCatalogItem[] {
  const merged = [
    ...(section.procedure_items || []),
    ...(section.notice_items || []),
    ...(section.reference_items || []),
    ...(section.items || []),
  ];
  const seen = new Set<string>();
  const unique: ProcedureCatalogItem[] = [];

  for (const item of merged) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }

  const filtered = unique.filter((item) => !isNonRelevantProcedureListing(item) && isVeteranRelevantProcedure(item));
  const ranked = sortByProcedureVeteranRelevance(filtered);

  return ranked.sort((a, b) => {
    const delta = scoreGuideDocumentPriority(b, section) - scoreGuideDocumentPriority(a, section);
    if (delta !== 0) return delta;
    return 0;
  });
}

function collectSearchableSectionItems(section: ProcedureCatalogSection): ProcedureCatalogItem[] {
  const merged = [
    ...(section.procedure_items || []),
    ...(section.notice_items || []),
    ...(section.reference_items || []),
    ...(section.items || []),
  ];
  const seen = new Set<string>();
  const unique: ProcedureCatalogItem[] = [];

  for (const item of merged) {
    const itemKey = item.id || `${section.id}:${item.title_ar || item.title_clean || ""}`;
    if (seen.has(itemKey) || isNonRelevantProcedureListing(item)) continue;
    seen.add(itemKey);
    unique.push(item);
  }

  return unique;
}

function normalizeProcedureSearchText(value: string): string {
  return normalizeSearchableArabicInput(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesUnifiedSearch(haystackParts: Array<string | undefined>, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const haystack = normalizeProcedureSearchText(haystackParts.filter(Boolean).join(" "));
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

function toAbsoluteResourceUrl(baseUrl: string, value?: string): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function getSourceTitle(source: ProcedureCatalogSource | undefined, sourceId: string): string {
  if (SOURCE_DISPLAY_META[sourceId]?.title) return SOURCE_DISPLAY_META[sourceId].title;
  if (source?.title) return source.title;
  const fallback: Record<string, string> = {
    mof: "دائرة التقاعد",
    procedures: "الشؤون",
    laf: "قيادة الجيش",
    isf: "قوى الأمن الداخلي",
    rabita: "الرابطة",
    other: "مصادر اخرى",
  };
  return fallback[sourceId] || sourceId;
}

function resolveVisibleSectionList(
  isCompactMobile: boolean,
  activeSectionList: ProcedureCatalogSection[],
): ProcedureCatalogSection[] {
  if (!isCompactMobile) return activeSectionList;
  return activeSectionList;
}

function getSectionEmptyMessage(): string {
  return "لا توجد معاملات ضمن هذا المصدر حالياً.";
}

function getProcedureSteps(item: ProcedureCatalogItem): string[] {
  const steps = (item.steps || []).map((step) => String(step || "").trim()).filter(Boolean);
  if (steps.length > 0) return steps;

  const summary = getItemSummary(item).trim();
  if (summary && summary !== "لا يوجد وصف") return [summary];
  return [];
}

function renderProcedureStepsContent(item: ProcedureCatalogItem) {
  const procedureSteps = getProcedureSteps(item);
  const summary = getItemSummary(item);
  const summaryNode = summary && summary !== "لا يوجد وصف"
    ? h("p", { className: "procedures-browser__item-summary" }, summary)
    : null;

  if (procedureSteps.length === 0) {
    return h(
      Fragment,
      null,
      summaryNode,
      h("p", { className: "procedures-browser__item-summary" }, "لا توجد خطوات منشورة لهذه المعاملة حالياً."),
    );
  }

  return h(
    Fragment,
    null,
    summaryNode,
    h(
      "ol",
      { className: "procedures-browser__steps-list" },
      ...procedureSteps.map((step, index) => h("li", { key: `${item.id}-step-${index}` }, step)),
    ),
  );
}

function renderProcedureFormsContent(
  item: ProcedureCatalogItem,
  docs: ProcedureDocItem[],
  docsLoading: boolean,
  docsError: string | null | undefined,
  onPreviewDoc: (item: ProcedureCatalogItem, doc: ProcedureDocItem) => void,
) {
  if (docsLoading) {
    return h("div", { className: "procedures-browser__item-forms-empty" }, "جار تحميل النماذج...");
  }

  if (docsError) {
    return h("div", { className: "procedures-browser__item-forms-empty" }, docsError);
  }

  if (docs.length === 0) {
    return h("div", { className: "procedures-browser__item-forms-empty" }, "لا توجد نماذج مرفقة لهذه المعاملة.");
  }

  return h(
    "div",
    { className: "procedures-browser__item-form-ctas" },
    ...docs.map((doc, index) => {
      const docTitle = doc.title_ar || doc.title || doc.description_lb || `نموذج ${index + 1}`;
      return h(
        "button",
        {
          key: doc.id || `${item.id}-${index}`,
          type: "button",
          className: "procedures-browser__item-form-cta wt-cta-glow wt-cta-processing",
          onClick: () => onPreviewDoc(item, doc),
        },
        docTitle,
      );
    }),
  );
}

function getProceduresRootClassName(isCompactMobile: boolean): string {
  if (isCompactMobile) return "procedures-browser procedures-browser--compact";
  return "procedures-browser";
}

type RenderSectionsOptions = {
  visibleSectionList: ProcedureCatalogSection[];
  isCompactMobile: boolean;
  expandedSectionId: string | null;
  expandedItemIds: Record<string, boolean>;
  docsByProcedureId: Record<string, ProcedureDocItem[]>;
  docsLoadingByProcedureId: Record<string, boolean>;
  docsErrorByProcedureId: Record<string, string | null>;
  onToggleSection: (section: ProcedureCatalogSection) => void;
  onToggleItem: (item: ProcedureCatalogItem) => void;
  onPreviewDoc: (item: ProcedureCatalogItem, doc: ProcedureDocItem) => void;
};

function renderSectionsView({
  visibleSectionList,
  isCompactMobile,
  expandedSectionId,
  expandedItemIds,
  docsByProcedureId,
  docsLoadingByProcedureId,
  docsErrorByProcedureId,
  onToggleSection,
  onToggleItem,
  onPreviewDoc,
}: RenderSectionsOptions) {
  return h(
    "section",
    { className: "procedures-browser__sections", "aria-label": "المعاملات حسب المصدر" },
    ...visibleSectionList.map((section) => {
      const isExpanded = expandedSectionId === section.id;
      const sectionItems = collectSectionItems(section);
      const sectionItemsContent = sectionItems.length > 0
        ? sectionItems.map((item) => {
          const isItemExpanded = Boolean(expandedItemIds[item.id]);
            const docs = docsByProcedureId[item.id] || [];
            const docsLoading = Boolean(docsLoadingByProcedureId[item.id]);
            const docsError = docsErrorByProcedureId[item.id];
            const formsNode = renderProcedureFormsContent(item, docs, docsLoading, docsError, onPreviewDoc);
            const stepsNode = renderProcedureStepsContent(item);

            return h(
              "article",
              { key: item.id, className: `procedures-browser__item${isItemExpanded ? " procedures-browser__item--expanded" : ""}`, "data-watany-procedure-card": "true" },
              h(
                "div",
                { className: "procedures-browser__item-row" },
                h(
                  "h2",
                  { className: `procedures-browser__item-title${isItemExpanded ? " procedures-browser__item-title--expanded" : ""}` },
                  getItemTitle(item),
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "procedures-browser__item-toggle-button",
                    "aria-expanded": isItemExpanded,
                    "aria-label": isItemExpanded ? "إخفاء تفاصيل المعاملة" : "إظهار تفاصيل المعاملة",
                    onClick: () => onToggleItem(item),
                  },
                  h("span", { className: "procedures-browser__item-toggle", "aria-hidden": "true" }, isItemExpanded ? "−" : "+"),
                ),
              ),
              isItemExpanded
                ? h(
                    Fragment,
                    null,
                    h(
                      "div",
                      { className: "procedures-browser__item-steps" },
                      h("strong", { className: "procedures-browser__item-subtitle" }, "تعليمات المعاملة"),
                      stepsNode,
                    ),
                    h(
                      "div",
                      { className: "procedures-browser__item-forms" },
                      h("strong", { className: "procedures-browser__item-subtitle" }, "نماذج المعاملة"),
                      formsNode,
                    ),
                  )
                : null,
            );
          })
        : [h("div", { key: `${section.id}-empty`, className: "procedures-browser__empty" }, getSectionEmptyMessage())];

      return h(
        "article",
        { key: section.id, className: "procedures-browser__section" },
        h(
          isCompactMobile ? "button" : "div",
          isCompactMobile
            ? {
                type: "button",
                className: `procedures-browser__section-caption${isExpanded ? " procedures-browser__section-caption--active" : ""}`,
                "aria-expanded": isExpanded,
                onClick: () => onToggleSection(section),
              }
            : { className: "procedures-browser__section-caption" },
          h("span", { className: "procedures-browser__section-title" }, section.title),
          h("span", { className: "procedures-browser__section-meta-label" }, `${section.count} معاملة`),
        ),
        isExpanded ? h("div", { className: "procedures-browser__items" }, ...sectionItemsContent) : null,
      );
    }),
  );
}

function renderLoadingState(loading: boolean) {
  if (!loading) return null;
  return h("div", { className: "procedures-browser__state" }, "جارٍ تحميل المعاملات...");
}

function renderErrorState(error: string | null) {
  if (!error) return null;
  return h("div", { className: "procedures-browser__state procedures-browser__state--error" }, error);
}

function renderSectionsContent(loading: boolean, error: string | null, sectionsView: React.ReactNode) {
  if (loading || error) return null;
  return sectionsView;
}

function renderViewerMessage(viewerMessage: string) {
  if (!viewerMessage) return null;
  return h("div", { className: "procedures-browser__message" }, viewerMessage);
}

export default function ProceduresPage() {
  const { apiBaseUrl } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [sections, setSections] = useState<ProcedureCatalogSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSourceId, setActiveSourceId] = useState("mof");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchForms, setSearchForms] = useState<FormListItem[]>([]);
  const [searchFormsTotal, setSearchFormsTotal] = useState(0);
  const [searchFaqs, setSearchFaqs] = useState<FaqSearchItem[]>([]);
  const [searchFaqsTotal, setSearchFaqsTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});
  const [expandedFaqIds, setExpandedFaqIds] = useState<Record<string, boolean>>({});
  const [isCompactMobile, setIsCompactMobile] = useState(false);
  const [viewerMessage, setViewerMessage] = useState("");
  const [docsByProcedureId, setDocsByProcedureId] = useState<Record<string, ProcedureDocItem[]>>({});
  const [docsLoadingByProcedureId, setDocsLoadingByProcedureId] = useState<Record<string, boolean>>({});
  const [docsErrorByProcedureId, setDocsErrorByProcedureId] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextSearchQuery = params.get("search") || params.get("q") || params.get("query") || "";
    setSearchQuery((current) => (current === nextSearchQuery ? current : nextSearchQuery));
  }, [location.search]);

  useEffect(() => {
    const updateCompactMode = () => setIsCompactMobile(window.innerWidth <= 560);
    updateCompactMode();
    window.addEventListener("resize", updateCompactMode);
    return () => window.removeEventListener("resize", updateCompactMode);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/api/v2/procedures/catalog`, { credentials: "include" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = (await response.json()) as ProcedureCatalogResponse;
        if (cancelled) return;

        const nextSections = data.sections || [];
        setSections(nextSections);

        setActiveSourceId("mof");
        setExpandedSectionId(null);
      } catch {
        if (!cancelled) {
          setSections([]);
          setError("تعذر تحميل دليل المعاملات حالياً.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const trimmedSearchQuery = searchQuery.trim();
    if (!trimmedSearchQuery) {
      setSearchForms([]);
      setSearchFormsTotal(0);
      setSearchFaqs([]);
      setSearchFaqsTotal(0);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    const timeoutId = globalThis.setTimeout(() => {
      void (async () => {
        const [formsResult, faqResult] = await Promise.allSettled([
          api.getForms({ q: trimmedSearchQuery }, apiBaseUrl),
          api.getFaqs(trimmedSearchQuery, apiBaseUrl),
        ]);

        if (cancelled) return;

        if (formsResult.status === "fulfilled") {
          setSearchForms(formsResult.value.items || []);
          setSearchFormsTotal(formsResult.value.total || formsResult.value.items.length);
        } else {
          setSearchForms([]);
          setSearchFormsTotal(0);
        }

        if (faqResult.status === "fulfilled") {
          setSearchFaqs(faqResult.value.items || []);
          setSearchFaqsTotal(faqResult.value.total || faqResult.value.items.length);
        } else {
          setSearchFaqs([]);
          setSearchFaqsTotal(0);
        }

        setSearchLoading(false);
      })();
    }, 220);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timeoutId);
    };
  }, [searchQuery, apiBaseUrl]);

  const trimmedSearchQuery = searchQuery.trim();
  const unifiedSearchActive = trimmedSearchQuery.length > 0;
  const normalizedSearchQuery = useMemo(() => normalizeProcedureSearchText(trimmedSearchQuery), [trimmedSearchQuery]);

  const searchableProcedureEntries = useMemo(() => {
    const entries: ProcedureSearchEntry[] = [];
    const seen = new Set<string>();

    for (const section of sections) {
      for (const item of collectSearchableSectionItems(section)) {
        const itemKey = item.id || `${section.id}:${getItemTitle(item)}`;
        if (seen.has(itemKey)) continue;
        seen.add(itemKey);
        entries.push({
          sectionId: section.id,
          sectionTitle: section.title,
          sourceId: section.source,
          sourceTitle: getSourceTitle(undefined, section.source),
          item,
        });
      }
    }

    return entries;
  }, [sections]);

  const procedureSearchResults = useMemo(() => {
    if (!normalizedSearchQuery) {
      return { items: [] as ProcedureSearchEntry[], total: 0 };
    }

    const matches = searchableProcedureEntries.filter((entry) => matchesUnifiedSearch([
      entry.item.title_ar,
      entry.item.title_clean,
      entry.item.summary_lb,
      entry.item.summary_clean,
      entry.sectionTitle,
      entry.sourceTitle,
      ...(entry.item.tags || []),
      ...(entry.item.steps || []),
      ...(entry.item.faq_variants || []),
      ...(entry.item.applies_to || []),
    ], normalizedSearchQuery));

    return {
      items: matches.slice(0, MAX_UNIFIED_SEARCH_RESULTS),
      total: matches.length,
    };
  }, [normalizedSearchQuery, searchableProcedureEntries]);

  const visibleFormResults = useMemo(
    () => searchForms.slice(0, MAX_UNIFIED_SEARCH_RESULTS),
    [searchForms],
  );

  const visibleFaqResults = useMemo(
    () => searchFaqs.slice(0, MAX_UNIFIED_SEARCH_RESULTS),
    [searchFaqs],
  );

  const activeSourceSections = useMemo(() => {
    if (!activeSourceId) return sections;
    const matchingSections: ProcedureCatalogSection[] = [];
    for (const section of sections) {
      if (section.source === activeSourceId) {
        matchingSections.push(section);
      }
    }
    return matchingSections;
  }, [activeSourceId, sections]);

  const sourceTabs = useMemo(() => {
    const bySource = new Map<string, ProcedureCatalogSource>();
    for (const section of sections) {
      const existing = bySource.get(section.source);
      if (existing) {
        existing.count += section.count || 0;
      } else {
        bySource.set(section.source, {
          id: section.source,
          title: getSourceTitle(undefined, section.source),
          count: section.count || 0,
          basis: SOURCE_DISPLAY_META[section.source]?.basis,
        });
      }
    }

    const tabs = Array.from(bySource.values()).sort((a, b) => {
      const aPriority = SOURCE_VETERAN_PRIORITY[a.id] ?? 0;
      const bPriority = SOURCE_VETERAN_PRIORITY[b.id] ?? 0;
      if (bPriority !== aPriority) return bPriority - aPriority;
      return b.count - a.count;
    });

    if (!tabs.some((tab) => tab.id === "mof")) {
      tabs.unshift({
        id: "mof",
        title: SOURCE_DISPLAY_META.mof.title,
        count: sections.reduce((total, section) => total + (section.count || 0), 0),
        basis: SOURCE_DISPLAY_META.mof.basis,
      });
    }

    return tabs;
  }, [sections]);

  async function ensureProcedureDocs(procedureId: string) {
    if (!procedureId) return;
    if (docsByProcedureId[procedureId]) return;
    if (docsLoadingByProcedureId[procedureId]) return;

    setDocsLoadingByProcedureId((current) => ({ ...current, [procedureId]: true }));
    setDocsErrorByProcedureId((current) => ({ ...current, [procedureId]: null }));

    try {
      const response = await fetch(`${API_BASE}/api/v2/procedures/${encodeURIComponent(procedureId)}/docs`, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as ProcedureDocsResponse;
      setDocsByProcedureId((current) => ({ ...current, [procedureId]: data.docs || [] }));
    } catch {
      setDocsByProcedureId((current) => ({ ...current, [procedureId]: [] }));
      setDocsErrorByProcedureId((current) => ({ ...current, [procedureId]: "تعذر تحميل النماذج حالياً." }));
    } finally {
      setDocsLoadingByProcedureId((current) => ({ ...current, [procedureId]: false }));
    }
  }

  async function previewProcedureDoc(item: ProcedureCatalogItem, doc: ProcedureDocItem) {
    const title = doc.title_ar || doc.title || item.title_ar || item.id;
    const previewUrl = doc.preview_url || doc.url || "";
    const downloadUrl = doc.download_url || doc.url || doc.preview_url || "";

    if (!previewUrl && !downloadUrl) {
      setViewerMessage("هذا النموذج لا يحتوي رابط معاينة حالياً.");
      return;
    }

    const getFileExtension = (value: string): string => {
      try {
        const parsed = new URL(value, globalThis.location.origin);
        return parsed.pathname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
      } catch {
        return value.toLowerCase().match(/\.([a-z0-9]+)(?:[?#]|$)/)?.[1] || "";
      }
    };

    const originalFileExtensions = new Set([
      "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png", "webp", "gif", "tif", "tiff", "pdf",
    ]);
    const originalFileUrl = [downloadUrl, previewUrl].find((url) => originalFileExtensions.has(getFileExtension(url)));
    const viewerUrl = originalFileUrl || previewUrl || downloadUrl;

    setViewerMessage("");
    await openWatanyUniversalFormViewer({
      titleAr: title,
      previewUrl: viewerUrl,
      downloadUrl: downloadUrl || viewerUrl,
      preferUniversal: true,
    });
  }

  async function previewSearchForm(form: FormListItem) {
    const previewUrl = toAbsoluteResourceUrl(apiBaseUrl, form.previewUrl || form.downloadUrl || form.shareUrl);
    const downloadUrl = toAbsoluteResourceUrl(apiBaseUrl, form.downloadUrl || form.previewUrl || form.shareUrl);

    if (!previewUrl && !downloadUrl) {
      setViewerMessage("هذا النموذج لا يحتوي رابط معاينة حالياً.");
      return;
    }

    setViewerMessage("");
    await openWatanyUniversalFormViewer({
      titleAr: form.title_ar,
      previewUrl: previewUrl || downloadUrl,
      downloadUrl: downloadUrl || previewUrl,
      preferUniversal: true,
    });
  }

  function toggleItemExpanded(item: ProcedureCatalogItem) {
    setExpandedItemIds((current) => {
      const nextExpanded = !current[item.id];
      if (nextExpanded) void ensureProcedureDocs(item.id);
      return {
        ...current,
        [item.id]: nextExpanded,
      };
    });
  }

  function toggleSectionExpanded(section: ProcedureCatalogSection) {
    setExpandedSectionId((current) => (current === section.id ? null : section.id));
  }

  function toggleFaqExpanded(itemId: string) {
    setExpandedFaqIds((current) => ({
      ...current,
      [itemId]: !current[itemId],
    }));
  }

  function revealProcedureFromFaq(procedureId?: string) {
    if (!procedureId) return;
    setExpandedItemIds((current) => ({
      ...current,
      [procedureId]: true,
    }));
    void ensureProcedureDocs(procedureId);
    globalThis.setTimeout(() => {
      document.getElementById(`search-procedure-${procedureId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }

  const activeSectionList = activeSourceSections.length > 0 ? activeSourceSections : sections;
  const visibleSectionList = resolveVisibleSectionList(isCompactMobile, activeSectionList);
  const showCompactChrome = true;

  const sectionsView = renderSectionsView({
    visibleSectionList,
    isCompactMobile,
    expandedSectionId,
    expandedItemIds,
    docsByProcedureId,
    docsLoadingByProcedureId,
    docsErrorByProcedureId,
    onToggleSection: toggleSectionExpanded,
    onToggleItem: toggleItemExpanded,
    onPreviewDoc: (item, doc) => void previewProcedureDoc(item, doc),
  });

  const isMofActive = activeSourceId === "mof";
  const unifiedSearchTotal = procedureSearchResults.total + searchFormsTotal + searchFaqsTotal;

  const searchFilterNode = (
    <section className="procedures-browser__top-filter" aria-label="البحث داخل المعاملات والنماذج والأسئلة الشائعة">
      <span className="procedures-browser__top-filter-label">البحث الموحد</span>
      <input
        className="procedures-browser__top-filter-select"
        value={searchQuery}
        onChange={(event) => {
          setSearchQuery(event.target.value);
          setExpandedFaqIds({});
          setViewerMessage("");
        }}
        placeholder="ابحث في المعاملات والنماذج والأسئلة الشائعة"
        inputMode="search"
      />
    </section>
  );

  const unifiedSearchSummaryNode = unifiedSearchActive ? (
    <div className="procedures-browser__search-summary" role="status" aria-live="polite">
      <strong>يتم البحث في كل المعاملات والنماذج والأسئلة الشائعة.</strong>
      <span>
        {searchLoading
          ? "جارٍ تحديث نتائج النماذج والأسئلة الشائعة..."
          : `المعاملات ${procedureSearchResults.total} · النماذج ${searchFormsTotal} · الأسئلة ${searchFaqsTotal}`}
      </span>
    </div>
  ) : null;

  const unifiedSearchView = unifiedSearchActive ? (
    <>
      {searchLoading ? <div className="procedures-browser__state">جارٍ تحديث نتائج البحث...</div> : null}
      {unifiedSearchTotal === 0 && !searchLoading ? (
        <div className="procedures-browser__empty">لا توجد نتائج مطابقة في المعاملات أو النماذج أو الأسئلة الشائعة.</div>
      ) : null}

      {procedureSearchResults.total > 0 ? (
        <section className="procedures-browser__sections" aria-label="نتائج بحث المعاملات">
          <article className="procedures-browser__section">
            <div className="procedures-browser__section-caption">
              <span className="procedures-browser__section-title">المعاملات</span>
              <span className="procedures-browser__section-meta-label">{`${procedureSearchResults.total} نتيجة`}</span>
            </div>

            <div className="procedures-browser__items">
              {procedureSearchResults.items.map((entry) => {
                const item = entry.item;
                const isItemExpanded = Boolean(expandedItemIds[item.id]);
                const docs = docsByProcedureId[item.id] || [];
                const docsLoading = Boolean(docsLoadingByProcedureId[item.id]);
                const docsError = docsErrorByProcedureId[item.id];
                return (
                  <article key={item.id} id={`search-procedure-${item.id}`} className={`procedures-browser__item${isItemExpanded ? " procedures-browser__item--expanded" : ""}`} data-watany-procedure-card="true">
                    <div className="procedures-browser__item-row">
                      <h2 className={`procedures-browser__item-title${isItemExpanded ? " procedures-browser__item-title--expanded" : ""}`}>{getItemTitle(item)}</h2>
                      <button
                        type="button"
                        className="procedures-browser__item-toggle-button"
                        aria-expanded={isItemExpanded}
                        aria-label={isItemExpanded ? "إخفاء تفاصيل المعاملة" : "إظهار تفاصيل المعاملة"}
                        onClick={() => toggleItemExpanded(item)}
                      >
                        <span className="procedures-browser__item-toggle" aria-hidden="true">{isItemExpanded ? "−" : "+"}</span>
                      </button>
                    </div>

                    <div className="procedures-browser__item-main">
                      <p className="procedures-browser__item-summary">{getItemSummary(item)}</p>
                    </div>

                    <div className="procedures-browser__item-meta">
                      <span className="procedures-browser__item-kind">{entry.sourceTitle}</span>
                      <span className="procedures-browser__item-tags">{entry.sectionTitle}</span>
                    </div>

                    {isItemExpanded ? (
                      <>
                        <div className="procedures-browser__item-steps">
                          <strong className="procedures-browser__item-subtitle">تعليمات المعاملة</strong>
                          {renderProcedureStepsContent(item)}
                        </div>
                        <div className="procedures-browser__item-forms">
                          <strong className="procedures-browser__item-subtitle">نماذج المعاملة</strong>
                          {renderProcedureFormsContent(item, docs, docsLoading, docsError, (nextItem, doc) => void previewProcedureDoc(nextItem, doc))}
                        </div>
                      </>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </article>
        </section>
      ) : null}

      {searchFormsTotal > 0 ? (
        <section className="procedures-browser__sections" aria-label="نتائج بحث النماذج">
          <article className="procedures-browser__section">
            <div className="procedures-browser__section-caption">
              <span className="procedures-browser__section-title">النماذج</span>
              <span className="procedures-browser__section-meta-label">{`${searchFormsTotal} نتيجة`}</span>
            </div>

            <div className="procedures-browser__items">
              {visibleFormResults.map((form) => (
                <article key={form.id} className="procedures-browser__item">
                  <div className="procedures-browser__item-main">
                    <h2 className="procedures-browser__item-title">{form.title_ar}</h2>
                    <p className="procedures-browser__item-summary">{form.description || form.description_ar || "لا يوجد وصف لهذا النموذج حالياً."}</p>
                  </div>

                  <div className="procedures-browser__item-meta">
                    <span className="procedures-browser__item-kind">{form.sourceName || "النماذج الرسمية"}</span>
                    {form.category ? <span className="procedures-browser__item-tags">{form.category}</span> : null}
                    {form.tags?.length ? <span className="procedures-browser__item-tags">{form.tags.slice(0, 3).join(" · ")}</span> : null}
                  </div>

                  <div className="procedures-browser__item-actions">
                    <button
                      type="button"
                      className="procedures-browser__item-open procedures-browser__item-open--primary"
                      onClick={() => void previewSearchForm(form)}
                    >
                      فتح النموذج
                    </button>
                    <button
                      type="button"
                      className="procedures-browser__item-open"
                      onClick={() => {
                        if (form.shareUrl) {
                          if (/^https?:\/\//i.test(form.shareUrl)) {
                            globalThis.open(form.shareUrl, "_blank", "noopener,noreferrer");
                          } else {
                            navigate(form.shareUrl);
                          }
                          return;
                        }

                        navigate(`/forms?query=${encodeURIComponent(form.title_ar)}`);
                      }}
                    >
                      صفحة النماذج
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {searchFaqsTotal > 0 ? (
        <section className="procedures-browser__sections" aria-label="نتائج بحث الأسئلة الشائعة">
          <article className="procedures-browser__section">
            <div className="procedures-browser__section-caption">
              <span className="procedures-browser__section-title">الأسئلة الشائعة</span>
              <span className="procedures-browser__section-meta-label">{`${searchFaqsTotal} نتيجة`}</span>
            </div>

            <div className="procedures-browser__items">
              {visibleFaqResults.map((item) => {
                const isExpanded = Boolean(expandedFaqIds[item.id]);
                return (
                  <article key={item.id} className={`procedures-browser__item${isExpanded ? " procedures-browser__item--expanded" : ""}`}>
                    <button
                      type="button"
                      className="procedures-browser__item-row"
                      aria-expanded={isExpanded}
                      onClick={() => toggleFaqExpanded(item.id)}
                    >
                      <h2 className={`procedures-browser__item-title${isExpanded ? " procedures-browser__item-title--expanded" : ""}`}>{item.question}</h2>
                      <span className="procedures-browser__item-toggle" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                    </button>

                    {isExpanded ? (
                      <>
                        <div className="procedures-browser__item-main">
                          <p className="procedures-browser__item-summary">{item.answer}</p>
                        </div>

                        <div className="procedures-browser__item-meta">
                          <span className="procedures-browser__item-kind">{item.category || "سؤال شائع"}</span>
                          {item.tags?.length ? <span className="procedures-browser__item-tags">{item.tags.slice(0, 3).join(" · ")}</span> : null}
                        </div>

                        <div className="procedures-browser__item-actions">
                          <button
                            type="button"
                            className="procedures-browser__item-open procedures-browser__item-open--primary"
                            onClick={() => navigate(`/chat?draft=${encodeURIComponent(item.question)}`)}
                          >
                            افتح في المحادثة
                          </button>
                          {item.procedureId ? (
                            <button
                              type="button"
                              className="procedures-browser__item-open"
                              onClick={() => revealProcedureFromFaq(item.procedureId)}
                            >
                              إظهار الإجراء المرتبط
                            </button>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </article>
        </section>
      ) : null}
    </>
  ) : null;

  return h(
    "div",
    { className: getProceduresRootClassName(isCompactMobile), dir: "rtl", "data-viewer-route": "/procedures", "data-watany-procedures-page": "true", "data-watany-procedure-total": String(activeSectionList.reduce((total, section) => total + collectSectionItems(section).length, 0)) },
    showCompactChrome ? searchFilterNode : null,
    showCompactChrome ? unifiedSearchSummaryNode : null,
    showCompactChrome
      ? h(
          "section",
          { className: "procedures-browser__source-listings", "aria-label": "مصادر المعاملات" },
          h(
            "div",
            { className: "procedures-browser__source-pills", role: "tablist", "aria-label": "اختيار مصدر المعاملات" },
            ...sourceTabs.map((source) => {
              const isActive = source.id === activeSourceId;
              return h(
                "button",
                {
                  key: source.id,
                  type: "button",
                  role: "tab",
                  "aria-selected": isActive,
                  className: `procedures-browser__source-pill${isActive ? " procedures-browser__source-pill--active" : ""}`,
                  onClick: () => {
                    setActiveSourceId(source.id);
                    const firstSourceSection = sections.find((section) => section.source === source.id);
                    setExpandedSectionId(firstSourceSection?.id || null);
                  },
                },
                h("span", { className: "procedures-browser__source-pill-title" }, getSourceTitle(source, source.id)),
                h("span", { className: "procedures-browser__source-pill-count" }, String(source.count || 0)),
              );
            }),
          ),
        )
      : null,
    unifiedSearchActive
      ? unifiedSearchView
      : isMofActive
      ? h(
          Suspense,
          { fallback: h("div", { className: "procedures-browser__state" }, "جارٍ تحميل إجراءات دائرة التقاعد...") },
          h(WatanyCompactProceduresViewer),
        )
      : h(
          React.Fragment,
          null,
          renderLoadingState(loading),
          renderErrorState(error),
          renderSectionsContent(loading, error, sectionsView),
        ),
    renderViewerMessage(viewerMessage),
  );
}
