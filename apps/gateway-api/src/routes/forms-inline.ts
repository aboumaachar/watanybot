/**
 * Forms inline routes — catalog, detail, detect intent.
 * Extracted from server.ts.
 */
import type { FastifyPluginAsync } from "fastify";
import { normalizeArabic } from "@watany/shared/arabic";
import type { FormGovernance } from "../data/forms-catalog";
import { getFormsSourceRegistry } from "../data/forms-catalog";
import { buildFormsGovernanceReport } from "../lib/forms-governance-report";
import { loadIndex, mapStoredDocAssetToDocRef } from "../procedures/indexer";

type FormLike = {
  id: string;
  code?: string;
  title_ar?: string;
  description_ar?: string;
  category?: string;
  authority?: string;
  instructions_ar?: string;
  updatedAt?: string;
  related_tx?: number[];
  tags?: string[];
  sourceId?: string;
  governance?: FormGovernance;
  previewUrl?: string;
  downloadUrl?: string;
  shareUrl?: string;
  origin?: "forms_catalog" | "procedure_doc" | "document_asset" | "official_file" | "kb_node";
};

type FormSource = {
  sourceId: string;
  sourceName: string;
  formCount: number;
  icon?: string;
  description?: string;
};

type EnrichedForm = FormLike & {
  sourceId: string;
  sourceName: string;
  fileType: "html" | "pdf" | "docx" | "image" | "unknown";
  tags: string[];
  previewUrl: string;
  downloadUrl: string;
  shareUrl: string;
};

interface FormsInlineRoutesOptions {
  getFormsCatalog: () => FormLike[];
  getFormById: (id: string) => FormLike | undefined;
  searchForms: (q: string) => FormLike[];
  detectFormIntent: (text: string) => string[];
  isGenericFormRequest: (text: string) => boolean;
}

const SOURCE_LABELS: Record<string, { name: string; icon: string; description: string }> = {
  mof: {
    name: "وزارة المالية",
    icon: "ph-fill ph-currency-circle-dollar",
    description: "نماذج مالية وتعويضات مرتبطة بحقوق المتقاعد.",
  },
  laf: {
    name: "الجيش اللبناني",
    icon: "ph-fill ph-shield-star",
    description: "نماذج صادرة عن قيادة الجيش ووحداتها.",
  },
  retirement: {
    name: "مديرية التقاعد",
    icon: "ph-fill ph-briefcase-metal",
    description: "نماذج معاملات التقاعد والوضع العائلي.",
  },
  medical: {
    name: "طبابة عسكرية",
    icon: "ph-fill ph-heartbeat",
    description: "نماذج الطبابة والمتابعة الطبية.",
  },
  grant: {
    name: "الشؤون",
    icon: "ph-fill ph-handshake",
    description: "نماذج المساعدات والمنح والتعاضد.",
  },
  admin: {
    name: "الجيش اللبناني",
    icon: "ph-fill ph-files",
    description: "إفادات ونماذج إدارية صادرة عن المرجع الرسمي.",
  },
  other: {
    name: "مصادر أخرى",
    icon: "ph-fill ph-folders",
    description: "نماذج غير مصنفة ضمن مصدر محدد.",
  },
};

const CATEGORY_TO_FILTER: Record<string, string> = {
  family_status: "عائلة",
  divorce_declaration: "عائلة",
  retiree_declaration: "تقاعد",
  schooling_aid: "منح",
  social_compensation: "منح",
  service_card: "تقاعد",
  pension_attestation: "تقاعد",
  weapon_license: "الجيش اللبناني",
  medical: "طبابة",
  medical_hospitalization: "طبابة",
  medical_reimbursement: "طبابة",
  administrative_certificate: "إدارية",
};

/* eslint-disable-next-line sonarjs/cognitive-complexity */
function inferSourceId(form: FormLike): keyof typeof SOURCE_LABELS {
  if (form.sourceId) {
    const normalizedSource = normalizeArabic(form.sourceId || "");
    if (normalizedSource.includes("admin") || normalizedSource.includes("ادار")) return "admin";
    if (normalizedSource.includes("laf")) return "laf";
    if (normalizedSource.includes("mof")) return "mof";
    if (normalizedSource.includes("grant") || normalizedSource.includes("تعاضد")) return "grant";
    if (normalizedSource.includes("retirement") || normalizedSource.includes("تقاعد")) return "retirement";
    if (normalizedSource.includes("medical") || normalizedSource.includes("طبابة")) return "medical";
  }

  const authority = normalizeArabic(form.authority || "");
  const category = normalizeArabic(form.category || "");
  const haystack = `${authority} ${category}`;

  if (haystack.includes("ماليه")) return "mof";
  if (haystack.includes("تعاونيه") || haystack.includes("تعاضد") || category.includes("school")) return "grant";
  if (haystack.includes("طبابه") || category.includes("medical")) return "medical";
  if (haystack.includes("اداري") || haystack.includes("شؤون") || category.includes("administrative")) return "admin";
  if (haystack.includes("تقاعد") || haystack.includes("وضع عائلي") || category.includes("retire") || category.includes("family")) return "retirement";
  if (haystack.includes("جيش") || haystack.includes("دفاع")) return "laf";
  return "other";
}

function buildFormTags(form: FormLike, sourceName: string): string[] {
  const baseTags = [
    form.code || "",
    form.category || "",
    form.authority || "",
    sourceName,
    form.governance?.officialSourceLabel || "",
    form.governance?.officialReference || "",
    ...(form.tags ?? []),
  ].filter((value): value is string => Boolean(value?.trim()));

  const normalized = new Set<string>();
  for (const tag of baseTags) {
    normalized.add(tag.trim());
    const ar = normalizeArabic(tag);
    if (ar) normalized.add(ar);
  }
  return [...normalized];
}

function toEnrichedForm(form: FormLike): EnrichedForm {
  const sourceId = inferSourceId(form);
  const source = SOURCE_LABELS[sourceId];
  const categoryFilter = CATEGORY_TO_FILTER[form.category || ""];
  const tags = buildFormTags(form, source.name);
  if (categoryFilter) tags.push(categoryFilter);

  const previewUrl = form.previewUrl || `/api/forms/${encodeURIComponent(form.id)}/preview`;
  const downloadUrl = form.downloadUrl || `/api/forms/${encodeURIComponent(form.id)}/download`;
  const shareUrl = form.shareUrl || `/forms/${encodeURIComponent(sourceId)}?formId=${encodeURIComponent(form.id)}`;

  return {
    ...form,
    sourceId,
    sourceName: source.name,
    fileType: "html",
    tags,
    previewUrl,
    downloadUrl,
    shareUrl,
    origin: form.origin || "forms_catalog",
  };
}

function matchesFilter(form: EnrichedForm, filter: string): boolean {
  if (!filter || filter === "كل النماذج") return true;
  if (filter === "الأكثر استخداماً") {
    return form.sourceId !== "other";
  }

  const normalizedFilter = normalizeArabic(filter);
  const normalizedCategory = normalizeArabic(form.category || "");
  const normalizedTags = form.tags.map((tag) => normalizeArabic(tag));

  return normalizedCategory.includes(normalizedFilter) || normalizedTags.some((tag) => tag.includes(normalizedFilter));
}

function matchesQuery(form: EnrichedForm, q: string): boolean {
  if (!q) return true;
  const canonicalArabizi = q
    .replace(/ta3wid/gi, "ta3weed")
    .replace(/ta2aod/gi, "ta2aod")
    .replace(/man7a/gi, "min7ah")
    .replace(/tbebe/gi, "tababeh");
  const normalizedQuery = normalizeArabic(canonicalArabizi);
  const haystack = normalizeArabic([
    form.title_ar || "",
    form.description_ar || "",
    form.authority || "",
    form.sourceName,
    form.sourceId,
    form.category || "",
    ...(form.tags || []),
    ...(Array.isArray(form.related_tx) ? form.related_tx.map((tx) => `معامله ${tx}`) : []),
  ].join(" "));
  return haystack.includes(normalizedQuery);
}

function inferSourceIdFromSourceName(source: string | undefined): keyof typeof SOURCE_LABELS {
  const normalizedSource = normalizeArabic(source || "");
  if (normalizedSource.includes("admin") || normalizedSource.includes("ادار")) return "admin";
  if (normalizedSource.includes("laf")) return "laf";
  if (normalizedSource.includes("mof")) return "mof";
  if (normalizedSource.includes("grant") || normalizedSource.includes("تعاضد")) return "grant";
  if (normalizedSource.includes("retirement") || normalizedSource.includes("تقاعد")) return "retirement";
  if (normalizedSource.includes("medical") || normalizedSource.includes("طبابة")) return "medical";
  return "other";
}

async function loadProcedureFormCandidates(): Promise<FormLike[]> {
  const state = await loadIndex(false);
  return state.docs
    .filter((doc) => doc.asset_type === "form")
    .map((doc) => {
      const docRef = mapStoredDocAssetToDocRef(doc);
      return {
        id: doc.id,
        code: docRef.file_name || doc.id,
        title_ar: docRef.title,
        description_ar: docRef.description_lb || "",
        category: "نماذج مرتبطة",
        authority: docRef.source_label || docRef.source || "وثيقة رسمية",
        instructions_ar: docRef.description_lb || "افتح المستند الرسمي للمعاينة.",
        updatedAt: undefined,
        related_tx: [],
        tags: [...(docRef.tags || []), docRef.source || ""].filter(Boolean),
        sourceId: inferSourceIdFromSourceName(docRef.source),
        previewUrl: docRef.preview_url,
        downloadUrl: docRef.download_url,
        shareUrl: docRef.share_url,
        origin: "procedure_doc",
      };
    });
}

async function getCombinedCatalog(getFormsCatalog: () => FormLike[]): Promise<FormLike[]> {
  const catalog = getFormsCatalog();
  const procedureForms = await loadProcedureFormCandidates();
  const ids = new Set(catalog.map((form) => form.id));
  const uniqueProcedureForms = procedureForms.filter((form) => !ids.has(form.id));
  return [...catalog, ...uniqueProcedureForms];
}

function buildSources(forms: EnrichedForm[]): FormSource[] {
  const grouped = new Map<string, FormSource>();
  for (const form of forms) {
    const existing = grouped.get(form.sourceId);
    if (existing) {
      existing.formCount += 1;
      continue;
    }

    const source = SOURCE_LABELS[form.sourceId] || SOURCE_LABELS.other;
    grouped.set(form.sourceId, {
      sourceId: form.sourceId,
      sourceName: source.name,
      formCount: 1,
      icon: source.icon,
      description: source.description,
    });
  }

  const ordered = [...grouped.values()];
  ordered.sort((a, b) => {
    if (a.sourceId === "other") return 1;
    if (b.sourceId === "other") return -1;
    return a.sourceName.localeCompare(b.sourceName, "ar");
  });
  return ordered;
}

function findCombinedForm(forms: FormLike[], id: string): FormLike | null {
  return forms.find((form) => form.id === id) ?? null;
}

function escapeHtml(value: string): string {
  return value
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}

function isSafeViewerTarget(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  if (/^(javascript|data|vbscript|file):/i.test(normalized)) return false;
  if (/^https?:\/\//i.test(normalized)) return true;
  return normalized.startsWith("/");
}

export const formsInlineRoutes: FastifyPluginAsync<FormsInlineRoutesOptions> = async (app, opts) => {
  const { getFormsCatalog, getFormById, detectFormIntent, isGenericFormRequest } = opts;

  /** GET /api/forms/viewer — server-side viewer shell for embedded online forms/files */
  app.get("/api/forms/viewer", async (req, reply) => {
    const query = (req.query as Record<string, string>) || {};
    const target = String(query.url || "").trim();
    const title = String(query.title || "معاينة مستند رسمي").trim().slice(0, 120);

    if (!isSafeViewerTarget(target)) {
      reply.code(400);
      return { error: "invalid viewer target" };
    }

    const safeTitle = escapeHtml(title || "معاينة مستند رسمي");
    const safeTarget = escapeHtml(target);
    const body = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${safeTitle}</title><style>html,body{margin:0;padding:0;height:100%;background:#f8fafc;color:#0f172a;font-family:Tahoma,Arial,sans-serif}.viewer{display:grid;grid-template-rows:auto 1fr;min-height:100%}.bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid #cbd5e1;background:#fff}.bar a{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:999px;background:#0f172a;color:#fff;text-decoration:none;font-weight:700}.frame-wrap{padding:10px;height:100%;box-sizing:border-box}.frame{width:100%;height:100%;min-height:70vh;border:1px solid #cbd5e1;border-radius:12px;background:#fff}</style></head><body><div class="viewer"><div class="bar"><strong>${safeTitle}</strong><a href="${safeTarget}" target="_blank" rel="noreferrer">فتح الملف مباشرة</a></div><div class="frame-wrap"><iframe class="frame" src="${safeTarget}" title="${safeTitle}"></iframe></div></div></body></html>`;
    reply.type("text/html; charset=utf-8");
    return body;
  });

  /** GET /api/forms/sources — grouped form sources with counts */
  app.get("/api/forms/sources", async () => {
    const forms = (await getCombinedCatalog(getFormsCatalog)).map(toEnrichedForm);
    return { items: buildSources(forms), total: forms.length };
  });

  /** GET /api/forms/governance-summary — catalog governance review summary */
  app.get("/api/forms/governance-summary", async () => {
    const forms = getFormsCatalog();
    return buildFormsGovernanceReport(forms as never, getFormsSourceRegistry());
  });

  /** GET /api/forms — list forms, optionally filtered by source and query */
  app.get("/api/forms", async (req) => {
    const query = (req.query as Record<string, string>) || {};
    const q = (query.q || "").trim();
    const requestedSourceId = (query.sourceId || "").trim();
    const sourceId = requestedSourceId === "admin" ? "grant" : requestedSourceId;
    const filter = (query.filter || "").trim();

    let forms = (await getCombinedCatalog(getFormsCatalog)).map(toEnrichedForm);
    if (sourceId) forms = forms.filter((form) => form.sourceId === sourceId);
    if (filter) forms = forms.filter((form) => matchesFilter(form, filter));
    if (q) forms = forms.filter((form) => matchesQuery(form, q));

    return { items: forms, total: forms.length };
  });

  /** GET /api/forms/:id — get a single form template by ID */
  app.get<{ Params: { id: string } }>("/api/forms/:id", async (req, reply) => {
    const forms = await getCombinedCatalog(getFormsCatalog);
    const form = findCombinedForm(forms, req.params.id) || getFormById(req.params.id) || null;
    if (!form) {
      reply.code(404);
      return { error: "form not found" };
    }
    return toEnrichedForm(form);
  });

  /** GET /api/forms/:id/preview — HTML preview fallback or redirect to attached form preview */
  app.get<{ Params: { id: string } }>("/api/forms/:id/preview", async (req, reply) => {
    const forms = await getCombinedCatalog(getFormsCatalog);
    const form = findCombinedForm(forms, req.params.id) || getFormById(req.params.id) || null;
    if (!form) {
      reply.code(404);
      return { error: "form not found" };
    }

    const enriched = toEnrichedForm(form);
    if (enriched.previewUrl && enriched.previewUrl !== `/api/forms/${encodeURIComponent(enriched.id)}/preview`) {
      return reply.redirect(enriched.previewUrl);
    }

    const officialMeta = enriched.governance
      ? [
        enriched.governance.officialSourceLabel,
        enriched.governance.officialReference || "",
        enriched.governance.verifiedAt ? `تحقق: ${enriched.governance.verifiedAt}` : "",
      ].filter(Boolean).join(" • ")
      : "";
    const title = enriched.title_ar || "نموذج";
    const summaryMeta = `${enriched.sourceName} • ${enriched.code || ""} • ${enriched.updatedAt || ""}`;
    const officialMetaHtml = officialMeta ? "<div class=\"meta\">" + officialMeta + "</div>" : "";

    const body = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${title}</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;line-height:1.7;background:#fff;color:#111}h1{font-size:20px;margin:0 0 8px}p{margin:0 0 10px}.meta{font-size:13px;color:#444;background:#f5f5f5;padding:10px 12px;border-radius:8px;margin-bottom:16px}</style></head><body><h1>${title}</h1><div class="meta">${summaryMeta}</div>${officialMetaHtml}<p>${enriched.description_ar || ""}</p><p>${enriched.instructions_ar || ""}</p></body></html>`;

    reply.type("text/html; charset=utf-8");
    return body;
  });

  /** GET /api/forms/:id/download — metadata or document download fallback */
  app.get<{ Params: { id: string } }>("/api/forms/:id/download", async (req, reply) => {
    const forms = await getCombinedCatalog(getFormsCatalog);
    const form = findCombinedForm(forms, req.params.id) || getFormById(req.params.id) || null;
    if (!form) {
      reply.code(404);
      return { error: "form not found" };
    }

    const enriched = toEnrichedForm(form);
    if (enriched.downloadUrl && enriched.downloadUrl !== `/api/forms/${encodeURIComponent(enriched.id)}/download`) {
      return reply.redirect(enriched.downloadUrl);
    }

    reply.header("content-disposition", `attachment; filename="${enriched.id}.json"`);
    reply.type("application/json; charset=utf-8");
    return enriched;
  });

  /** POST /api/forms/detect — detect form intent from user text */
  app.post<{ Body: { text: string } }>("/api/forms/detect", async (req) => {
    const text = (req.body?.text || "").trim();
    const matchedIds = detectFormIntent(text);
    const isGeneric = isGenericFormRequest(text);
    const matchedForms = matchedIds
      .map((id) => getFormById(id))
      .filter((item): item is FormLike => Boolean(item))
      .map(toEnrichedForm);
    return {
      matched: matchedForms,
      isGenericFormRequest: isGeneric,
      total: matchedForms.length,
    };
  });
};
