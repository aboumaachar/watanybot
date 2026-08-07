type ProcedureCatalogItem = {
  id: string;
  title_ar: string;
  summary_lb: string;
  title_clean?: string;
  summary_clean?: string;
  tags?: string[];
  record_kind?: "procedure" | "reference" | "notice" | "fragment";
  source_label?: string;
  section_label?: string;
  audience_scope?: string;
  content_tier?: string;
  domain?: string;
  relevance_weight?: number;
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

type CatalogShape = {
  sources: ProcedureCatalogSource[];
  sections: ProcedureCatalogSection[];
};

type RoutingOverride = {
  procedureNumber?: string;
  officialTitle?: string;
  matchedCurrentTitle?: string;
  expectedBucket?: string;
  expectedSourceId?: string;
  expectedSourceTabs?: string[];
  routingStatus?: string;
};

type DisabledListing = {
  id?: string;
  procedure_number?: string | number;
  source_id?: string;
  source_bucket?: string;
  expected_source_tabs?: string[];
  title?: string;
  summary?: string;
  subtitle?: string;
  status?: string;
};

const SOURCE_TITLES: Record<string, string> = {
  mof: "دائرة التقاعد",
  procedures: "الشؤون",
  laf: "قيادة الجيش",
  isf: "قوى الأمن الداخلي",
  rabita: "رابطة قدماء القوى المسلحة",
  omt: "OMT / جهات رسمية",
  other: "مصادر أخرى",
};

function normalizeArabic(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[ـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (ch) => "٠١٢٣٤٥٦٧٨٩".indexOf(ch).toString())
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function sectionItems(section: ProcedureCatalogSection): ProcedureCatalogItem[] {
  const merged = [
    ...(section.procedure_items || []),
    ...(section.notice_items || []),
    ...(section.reference_items || []),
    ...(section.items || []),
  ];
  const seen = new Set<string>();
  const out: ProcedureCatalogItem[] = [];
  for (const item of merged) {
    const key = item.id || normalizeArabic(item.title_ar);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function findItemByTitle(sections: ProcedureCatalogSection[], title: string): ProcedureCatalogItem | null {
  const target = normalizeArabic(title);
  if (!target) return null;

  for (const section of sections) {
    for (const item of sectionItems(section)) {
      const current = normalizeArabic(item.title_clean || item.title_ar);
      if (!current) continue;
      if (current === target || current.includes(target) || target.includes(current)) {
        return item;
      }
    }
  }

  return null;
}

function ensureSource(sources: ProcedureCatalogSource[], sourceId: string): ProcedureCatalogSource {
  let source = sources.find((item) => item.id === sourceId);
  if (!source) {
    source = {
      id: sourceId,
      title: SOURCE_TITLES[sourceId] || sourceId,
      count: 0,
      basis: "DOCX registry binding",
    };
    sources.push(source);
  }
  return source;
}

function ensureSection(sections: ProcedureCatalogSection[], sourceId: string): ProcedureCatalogSection {
  const id = "docx-bound-" + sourceId;
  let section = sections.find((item) => item.id === id);
  if (!section) {
    section = {
      id,
      title: SOURCE_TITLES[sourceId] || "DOCX",
      source: sourceId,
      source_label: SOURCE_TITLES[sourceId] || sourceId,
      count: 0,
      procedure_items: [],
      notice_items: [],
      reference_items: [],
      items: [],
    };
    sections.push(section);
  }
  return section;
}

function upsertIntoSection(section: ProcedureCatalogSection, item: ProcedureCatalogItem): void {
  const existing = sectionItems(section).some((candidate) => {
    return candidate.id === item.id || normalizeArabic(candidate.title_ar) === normalizeArabic(item.title_ar);
  });
  if (existing) return;

  if (item.record_kind === "notice") {
    section.notice_items = [...(section.notice_items || []), item];
  } else {
    section.procedure_items = [...(section.procedure_items || []), item];
  }
  section.items = [...(section.items || []), item];
  section.count = sectionItems(section).length;
}

function refreshCounts(catalog: CatalogShape): CatalogShape {
  for (const section of catalog.sections) {
    section.count = sectionItems(section).length;
  }

  for (const source of catalog.sources) {
    source.count = catalog.sections
      .filter((section) => section.source === source.id)
      .reduce((total, section) => total + (section.count || 0), 0);
  }

  return catalog;
}

function disabledListingToItem(row: DisabledListing, sourceId: string): ProcedureCatalogItem {
  const id = String(row.id || "docx-disabled-" + normalizeArabic(row.title || "").replace(/\s+/g, "-"));
  return {
    id,
    title_ar: String(row.title || id),
    title_clean: String(row.title || id),
    summary_lb: String(row.summary || "قيد تثبيت الرابط الرسمي قبل التفعيل."),
    summary_clean: String(row.summary || "قيد تثبيت الرابط الرسمي قبل التفعيل."),
    tags: ["DOCX", "قيد تثبيت الرابط", "CTA disabled"],
    record_kind: "notice",
    source_label: SOURCE_TITLES[sourceId] || row.source_bucket || sourceId,
    section_label: "DOCX pre-import",
    content_tier: "docx-preimport-disabled",
    audience_scope: "retired_military_and_family",
    relevance_weight: 100000,
  };
}

export function isWatanyDocxDisabledProcedureItem(item: { id?: string; tags?: string[]; content_tier?: string } | null | undefined): boolean {
  if (!item) return false;
  const id = String(item.id || "");
  if (id.startsWith("docx-missing-") || id.startsWith("docx-near-review-")) return true;
  if (item.content_tier === "docx-preimport-disabled") return true;
  return Boolean(item.tags?.some((tag) => normalizeArabic(tag).includes("cta disabled") || normalizeArabic(tag).includes("قيد تثبيت الرابط")));
}

export async function applyWatanyDocxProcedureRegistryBinding(input: CatalogShape): Promise<CatalogShape> {
  const catalog: CatalogShape = {
    sources: [...(input.sources || [])],
    sections: [...(input.sections || [])],
  };

  const routing = await fetchJson<{ rows?: RoutingOverride[] }>("/data/watany-procedure-source-routing-overrides.json");
  const disabled = await fetchJson<{ rows?: DisabledListing[] }>("/data/watany-docx-preimport-disabled-listings.json");

  for (const route of routing?.rows || []) {
    const tabs = route.expectedSourceTabs?.length ? route.expectedSourceTabs : [route.expectedSourceId || "other"];
    const baseItem = findItemByTitle(catalog.sections, route.matchedCurrentTitle || "") || findItemByTitle(catalog.sections, route.officialTitle || "");

    for (const sourceId of tabs) {
      if (!sourceId) continue;
      ensureSource(catalog.sources, sourceId);
      const section = ensureSection(catalog.sections, sourceId);
      const title = route.officialTitle || route.matchedCurrentTitle || "DOCX procedure";
      const item: ProcedureCatalogItem = {
        ...(baseItem || {}),
        id: (baseItem?.id || "docx-route-" + normalizeArabic(title).replace(/\s+/g, "-")) + "__docx_" + sourceId,
        title_ar: baseItem?.title_ar || title,
        title_clean: title,
        summary_lb: baseItem?.summary_lb || "تم ربط هذا الإجراء بالمصدر الصحيح استناداً إلى تدقيق DOCX.",
        summary_clean: baseItem?.summary_clean || "تم ربط هذا الإجراء بالمصدر الصحيح استناداً إلى تدقيق DOCX.",
        tags: Array.from(new Set([...(baseItem?.tags || []), "DOCX", "تصحيح مصدر"])),
        record_kind: baseItem?.record_kind || "procedure",
        source_label: SOURCE_TITLES[sourceId] || sourceId,
        section_label: "DOCX route binding",
        relevance_weight: Math.max(Number(baseItem?.relevance_weight || 0), 100000),
      };
      upsertIntoSection(section, item);
    }
  }

  for (const row of disabled?.rows || []) {
    const tabs = row.expected_source_tabs?.length ? row.expected_source_tabs : [row.source_id || "other"];
    for (const sourceId of tabs) {
      if (!sourceId) continue;
      ensureSource(catalog.sources, sourceId);
      const section = ensureSection(catalog.sections, sourceId);
      upsertIntoSection(section, disabledListingToItem(row, sourceId));
    }
  }

  return refreshCounts(catalog);
}
