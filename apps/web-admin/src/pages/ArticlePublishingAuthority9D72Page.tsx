import { useEffect, useMemo, useRef, useState } from "react";
import { AdminFluentIcon } from "../components/AdminFluentIcon";
import {
  adminFetch, clearArticleAutosave, createCmsGenericEntity, getAdminErrorCode, getAdminErrorMessage, getApiUrl, getArticleAutosave, getCmsGenericAudit,
  getCmsGenericEntities, getCmsGenericEntity, getCmsGenericVersions,
  replaceCmsGenericRelationships, rollbackCmsGenericEntity, runCmsGenericAction,
  runCmsGenericBulkArchive, saveArticleAutosave, updateCmsGenericEntity, uploadArticleMedia, replaceArticleMedia,
  type CmsAuditEvent, type CmsEntityVersion, type CmsGenericItem, type CmsStatus,
} from "../lib/api";
import {
  articleCanonicalPath, articlePayload, asciiSlugify, editorFromItem, emptyEditor, fileToBase64, fillMissingSeo, FILTER_STATUSES,
  formatDate, mediaKind, newPublicId, PAGE_SIZE, seoScore, slugify,
  STATUS_LABELS, textValue, type ArticleEditor, type EditorMode, type WorkspaceView,
} from "./article-cms-v2-model";
import "../article-authority-9d72.css";

type LegacyMedia = { url: string; title: string };
type ArticleAuthor = { id: string; name: string; email: string };
type AutosaveState = "idle" | "saving" | "saved" | "error";
function articleEditorFromAutosave(value: unknown): ArticleEditor | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<ArticleEditor>; const blank = emptyEditor();
  return { ...blank, ...record,
    categoryIds: Array.isArray(record.categoryIds) ? record.categoryIds.filter((item): item is string => typeof item === "string") : [],
    tagIds: Array.isArray(record.tagIds) ? record.tagIds.filter((item): item is string => typeof item === "string") : [],
    basePayload: record.basePayload && typeof record.basePayload === "object" && !Array.isArray(record.basePayload) ? record.basePayload : {},
    baseSourceMeta: record.baseSourceMeta && typeof record.baseSourceMeta === "object" && !Array.isArray(record.baseSourceMeta) ? record.baseSourceMeta : {},
  };
}
type SeoAgentProposal = {
  mode: "ai" | "heuristic"; provider: string; model: string; scoreBefore: number; scoreAfter: number; summary: string;
  fields: { seoTitle: string; seoDescription: string; focusKeyphrase: string; canonicalUrl: string; robots: string; ogTitle: string; ogDescription: string; ogImage: string; excerpt: string };
  issues: string[]; contentRecommendations: string[]; siteRecommendations: string[];
  internalLinks: Array<{ title: string; url: string; anchor: string; reason: string }>;
  audit: {
    score: number;
    checks: Array<{ id: string; label: string; status: "pass" | "warn" | "fail"; severity: "info" | "warning" | "blocking"; detail: string }>;
    duplicateCandidates: Array<{ title: string; url: string; similarity: number }>;
    heading: { count: number; bodyH1Count: number; skippedLevels: number };
    images: { total: number; missingAlt: number };
    links: { internal: number; external: number; brokenInternal: string[]; malformed: string[] };
    media: { checked: number; broken: string[] };
    indexing: { publicationStatus: string; robots: string; indexable: boolean; sitemapEligible: boolean; sitemapIncluded: boolean; expectedCanonical: string; canonicalMatches: boolean };
  };
};
type SeoSafeFixResult = {
  patch: { permalinkSlug: string; seoTitle: string; seoDescription: string; focusKeyphrase: string; canonicalUrl: string; robots: string; ogTitle: string; ogDescription: string; ogImage: string; excerpt: string; bodyHtml: string };
  changes: string[]; scoreBefore: number; scoreAfter: number; audit: SeoAgentProposal["audit"];
};
type SeoDashboardPerformance = { views30d: number; shares30d: number; pdfDownloads30d: number; internalLinkClicks30d: number };
type SeoDashboardItem = { id: string; title: string; url: string; score: number; indexable: boolean; sitemapIncluded: boolean; issues: string[]; performance: SeoDashboardPerformance; duplicateRisk: number };
type SeoDashboardReport = { generatedAt: string; summary: { total: number; averageScore: number; perfectCount: number; needsAttention: number; indexable: number; sitemapIncluded: number; canonicalIssues: number; missingAlt: number; brokenInternalLinks: number; brokenMedia: number; duplicateRisks: number; performance: SeoDashboardPerformance }; items: SeoDashboardItem[] };

function absoluteMediaUrl(value: string): string {
  if (/^https?:\/\//iu.test(value)) return value;
  const base = getApiUrl().replace(/\/+$/u, "");
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
}
function statusClass(status: CmsStatus): string {
  return `aa9-status aa9-status--${status.toLowerCase().replace("_", "-")}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function ArticlePublishingAuthority9D72Page({ initialArchive = false }: Readonly<{ initialArchive?: boolean }>) {
  const [view, setView] = useState<WorkspaceView>("articles");
  const [articles, setArticles] = useState<CmsGenericItem[]>([]);
  const [categories, setCategories] = useState<CmsGenericItem[]>([]);
  const [tags, setTags] = useState<CmsGenericItem[]>([]);
  const [media, setMedia] = useState<CmsGenericItem[]>([]);
  const [legacyMedia, setLegacyMedia] = useState<LegacyMedia[]>([]);
  const [authors, setAuthors] = useState<ArticleAuthor[]>([]);
  const [editor, setEditor] = useState<ArticleEditor>(emptyEditor());
  const [selected, setSelected] = useState<CmsGenericItem | null>(null);
  const [versions, setVersions] = useState<CmsEntityVersion[]>([]);
  const [audit, setAudit] = useState<CmsAuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CmsStatus | "">((initialArchive || globalThis.location.pathname.endsWith("/archive")) ? "ARCHIVED" : "");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Partial<Record<CmsStatus, number>>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [taxonomyName, setTaxonomyName] = useState("");
  const [taxonomyParent, setTaxonomyParent] = useState("");
  const [mediaAlt, setMediaAlt] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [seoAgentBusy, setSeoAgentBusy] = useState(false);
  const [seoFixBusy, setSeoFixBusy] = useState(false);
  const [seoProposal, setSeoProposal] = useState<SeoAgentProposal | null>(null);
  const [seoDashboardBusy, setSeoDashboardBusy] = useState(false);
  const [seoDashboard, setSeoDashboard] = useState<SeoDashboardReport | null>(null);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [autosaveAt, setAutosaveAt] = useState("");
  const [conflictItem, setConflictItem] = useState<CmsGenericItem | null>(null);
  const [mediaUsage, setMediaUsage] = useState<Record<string, number>>({});
  const visualRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const review = useMemo(() => seoScore(editor, categories), [editor, categories]);

  function patchEditor(patch: Partial<ArticleEditor>): void {
    setEditor((current) => ({ ...current, ...patch }));
    setDirty(true);
    setNotice("");
  }

  async function beginCreate(): Promise<void> {
    if (dirty && !globalThis.confirm("هناك تغييرات غير محفوظة. هل تريد إنشاء مقال جديد؟")) return;
    setSelected(null); setVersions([]); setAudit([]); setSeoProposal(null); setConflictItem(null); setEditor(emptyEditor());
    setEditorMode("visual"); setDirty(false); setError(""); setNotice(""); setAutosaveState("idle"); setAutosaveAt(""); setView("editor");
    try {
      const autosave = await getArticleAutosave("new"); const restored = articleEditorFromAutosave(autosave?.editor);
      if (autosave && restored && (restored.title.trim() || restored.bodyHtml.replace(/<[^>]+>/gu, "").trim()) && globalThis.confirm("توجد مسودة خادم تلقائية لمقال جديد. هل تريد استعادتها؟")) {
        setEditor(restored); setDirty(true); setAutosaveState("saved"); setAutosaveAt(autosave.savedAt); setNotice("تمت استعادة المسودة التلقائية من الخادم.");
      }
    } catch { setAutosaveState("error"); }
  }
  async function loadLibraries(): Promise<void> {
    const [categoryData, tagData, mediaData, archiveA, archiveB] = await Promise.all([
      getCmsGenericEntities("article-categories", { page: 1, pageSize: 100 }),
      getCmsGenericEntities("article-tags", { page: 1, pageSize: 100 }),
      getCmsGenericEntities("article-media", { page: 1, pageSize: 100 }),
      getCmsGenericEntities("articles", { page: 1, pageSize: 100 }),
      getCmsGenericEntities("articles", { page: 2, pageSize: 100 }),
    ]);
    const archiveItems = [...archiveA.items, ...archiveB.items];
    const authorNames = new Set<string>(["موطني"]);
    for (const item of archiveItems) { const name = textValue(item.payload.authorName).trim(); if (name) authorNames.add(name); }
    setAuthors([...authorNames].sort((a, b) => a.localeCompare(b, "ar")).map((name) => ({ id: name, name, email: "" })));
    setCategories(categoryData.items);
    setTags(tagData.items);
    const activeMedia = mediaData.items.filter((item) => item.status !== "ARCHIVED"); setMedia(activeMedia);
    const usage = Object.fromEntries(activeMedia.map((item) => [item.publicId, 0])) as Record<string, number>;
    for (const item of activeMedia) { const raw=textValue(item.payload.url); const absolute=raw?absoluteMediaUrl(raw):""; usage[item.publicId]=archiveItems.filter((article)=>{const payloadText=JSON.stringify(article.payload||{}); return Boolean((raw&&payloadText.includes(raw))||(absolute&&payloadText.includes(absolute)));}).length; }
    setMediaUsage(usage);
    const seen = new Set<string>();
    const historical = archiveItems.flatMap((item) => { const url = textValue(item.payload.featuredImage); if (!url || seen.has(url)) return []; seen.add(url); return [{ url, title: item.title }]; });
    setLegacyMedia(historical);
  }

  async function loadSeoDashboard(): Promise<void> {
    setSeoDashboardBusy(true); setError("");
    try { const response=await adminFetch("/api/admin/cms/articles/seo-audit/bulk?limit=300"); const data=await response.json() as {report?:SeoDashboardReport}; if(!data.report)throw new Error("ARTICLE_SEO_DASHBOARD_RESPONSE_MISSING"); setSeoDashboard(data.report); }
    catch(reason:unknown){setError(getAdminErrorMessage(reason,"\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0644\u0648\u062d\u0629 \u0635\u062d\u0629 SEO."));}
    finally {setSeoDashboardBusy(false);}
  }
  async function openSeoDashboardArticle(id:string):Promise<void> {
    try { const item=await getCmsGenericEntity("articles",id); await openArticle(item); } catch(reason:unknown){setError(getAdminErrorMessage(reason,"\u062a\u0639\u0630\u0631 \u0641\u062a\u062d \u0627\u0644\u0645\u0642\u0627\u0644 \u0645\u0646 \u0644\u0648\u062d\u0629 SEO.")); }
  }

  async function loadArticles(): Promise<void> {
    setLoading(true);
    try {
      const response = await getCmsGenericEntities("articles", {
        q: query, status: status || undefined, page, pageSize: PAGE_SIZE,
      });
      setArticles(response.items); setTotal(response.total); setStatusCounts(response.statusCounts);
      setSelectedIds([]); setError("");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تحميل المقالات."));
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadArticles(); }, [page, query, status]);
  useEffect(() => {
    void loadLibraries().catch((reason: unknown) => setError(getAdminErrorMessage(reason, "تعذر تحميل التصنيفات أو الوسائط.")));
  }, []);
  useEffect(() => { if (view === "seo") void loadSeoDashboard(); }, [view]);
  useEffect(() => {
    if (editorMode === "visual" && visualRef.current && visualRef.current.innerHTML !== editor.bodyHtml) {
      visualRef.current.innerHTML = editor.bodyHtml;
    }
  }, [editor.id, editor.bodyHtml, editorMode]);
  useEffect(() => {
    if (view !== "editor" || !dirty) return;
    const articleId = selected?.publicId || "new"; const articleVersion = selected?.version || null;
    const handle = globalThis.setTimeout(() => {
      const savedAt = new Date().toISOString(); localStorage.setItem(`watany_article_draft_${editor.id || "new"}`, JSON.stringify({ savedAt, editor })); setAutosaveState("saving");
      void saveArticleAutosave(articleId, { articleVersion, editor }).then((autosave) => { setAutosaveState("saved"); setAutosaveAt(autosave.savedAt); }).catch(() => setAutosaveState("error"));
    }, 1800);
    return () => globalThis.clearTimeout(handle);
  }, [dirty, editor, selected?.publicId, selected?.version, view]);
  async function openArticle(item: CmsGenericItem): Promise<void> {
    if (dirty && !globalThis.confirm("هناك تغييرات غير محفوظة. هل تريد فتح مقال آخر؟")) return;
    setSaving(true); setError("");
    try {
      const [detail, nextVersions, nextAudit] = await Promise.all([
        getCmsGenericEntity("articles", item.publicId),
        getCmsGenericVersions("articles", item.publicId),
        getCmsGenericAudit("articles", item.publicId),
      ]);
      const serverEditor = editorFromItem(detail, categories, tags);
      setSelected(detail); setSeoProposal(null); setConflictItem(null); setEditor(serverEditor);
      setVersions(nextVersions); setAudit(nextAudit); setDirty(false); setAutosaveState("idle"); setAutosaveAt("");
      setEditorMode("visual"); setView("editor");
      try {
        const autosave = await getArticleAutosave(detail.publicId); const restoredRaw = articleEditorFromAutosave(autosave?.editor); const restored = restoredRaw && categories.some((row) => restoredRaw.categoryIds.includes(row.publicId)) ? fillMissingSeo(restoredRaw, categories) : restoredRaw;
        const newer = autosave ? new Date(autosave.savedAt).getTime() > new Date(detail.updatedAt || 0).getTime() : false;
        if (autosave && restored && autosave.articleVersion === detail.version && newer && globalThis.confirm("توجد مسودة خادم تلقائية أحدث من آخر حفظ. هل تريد استعادتها؟")) { setEditor(restored); setDirty(true); setAutosaveState("saved"); setAutosaveAt(autosave.savedAt); setNotice("تمت استعادة مسودة الخادم التلقائية."); }
        else if (autosave && autosave.articleVersion && autosave.articleVersion !== detail.version) setNotice("توجد مسودة تلقائية مبنية على إصدار أقدم؛ لم تتم استعادتها تلقائياً لحماية التعديلات الأحدث.");
      } catch { setAutosaveState("error"); }
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر فتح المقال."));
    } finally { setSaving(false); }
  }

  async function runSeoAgent(): Promise<void> {
    const title = editor.title.trim();
    const slug = (editor.slug || slugify(title)).trim();
    if (!title || !slug) { setError("أدخل عنواناً ورابطاً مختصراً قبل تشغيل وكيل SEO."); return; }
    setSeoAgentBusy(true); setError(""); setNotice("");
    try {
      const categoryNames = categories.filter((item) => editor.categoryIds.includes(item.publicId)).map((item) => item.title);
      const tagNames = tags.filter((item) => editor.tagIds.includes(item.publicId)).map((item) => item.title);
      const primaryCategory = categories.find((item) => item.publicId === editor.primaryCategoryId)?.title || categoryNames[0] || "";
      const response = await adminFetch("/api/admin/cms/articles/seo-agent/analyze", { method: "POST", body: JSON.stringify({ ...editor, id: selected?.publicId || editor.id, title, slug, categories: categoryNames, primaryCategory, tags: tagNames }) });
      const data = await response.json() as { proposal?: SeoAgentProposal };
      if (!data.proposal) throw new Error("ARTICLE_SEO_AGENT_RESPONSE_MISSING");
      setSeoProposal(data.proposal);
      setNotice(data.proposal.mode === "ai" ? "أكمل وكيل DC تحليل SEO بالذكاء الاصطناعي. راجع المقترح قبل التطبيق." : "أكمل وكيل DC تحليل SEO بالقواعد المحلية. راجع المقترح قبل التطبيق.");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تشغيل وكيل DC لتحسين SEO."));
    } finally { setSeoAgentBusy(false); }
  }

  function applySeoProposal(includeExcerpt: boolean): void {
    if (!seoProposal) return;
    const fields = seoProposal.fields;
    patchEditor({ seoTitle: fields.seoTitle, seoDescription: fields.seoDescription, focusKeyphrase: fields.focusKeyphrase, canonicalUrl: fields.canonicalUrl, robots: fields.robots, ogTitle: fields.ogTitle, ogDescription: fields.ogDescription, ogImage: fields.ogImage, ...(includeExcerpt ? { excerpt: fields.excerpt } : {}) });
    setNotice(includeExcerpt ? "تم تطبيق تحسينات SEO والمقتطف. احفظ المقال لتسجيل نسخة ومراجعة جديدة." : "تم تطبيق حقول SEO المقترحة. احفظ المقال لتسجيل نسخة ومراجعة جديدة.");
  }

  async function runSeoSafeFixes(): Promise<void> {
    const title=editor.title.trim(); const slug=(editor.slug||slugify(title)).trim();
    if(!title||!slug){setError("\u0623\u062f\u062e\u0644 \u0639\u0646\u0648\u0627\u0646\u0627\u064b \u0648\u0631\u0627\u0628\u0637\u0627\u064b \u0642\u0628\u0644 \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0625\u0635\u0644\u0627\u062d\u0627\u062a \u0627\u0644\u0622\u0645\u0646\u0629.");return;}
    setSeoFixBusy(true);setError("");setNotice("");
    try {
      const categoryNames=categories.filter((item)=>editor.categoryIds.includes(item.publicId)).map((item)=>item.title);
      const tagNames=tags.filter((item)=>editor.tagIds.includes(item.publicId)).map((item)=>item.title);
      const primaryCategory=categories.find((item)=>item.publicId===editor.primaryCategoryId)?.title||categoryNames[0]||"";
      const response=await adminFetch("/api/admin/cms/articles/seo-agent/safe-fix",{method:"POST",body:JSON.stringify({...editor,id:selected?.publicId||editor.id,title,slug,categories:categoryNames,primaryCategory,tags:tagNames})});
      const data=await response.json() as {fix?:SeoSafeFixResult}; if(!data.fix)throw new Error("ARTICLE_SEO_SAFE_FIX_RESPONSE_MISSING");
      const fix=data.fix; patchEditor({permalinkSlug:fix.patch.permalinkSlug,seoTitle:fix.patch.seoTitle,seoDescription:fix.patch.seoDescription,focusKeyphrase:fix.patch.focusKeyphrase,canonicalUrl:fix.patch.canonicalUrl,robots:fix.patch.robots,ogTitle:fix.patch.ogTitle,ogDescription:fix.patch.ogDescription,ogImage:fix.patch.ogImage,excerpt:fix.patch.excerpt,bodyHtml:fix.patch.bodyHtml});
      setSeoProposal(null); const lead=fix.scoreAfter===100?"\u062a\u0645 \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0625\u0635\u0644\u0627\u062d\u0627\u062a \u0627\u0644\u0622\u0645\u0646\u0629 \u0648\u0623\u0635\u0628\u062d \u0627\u0644\u062a\u062f\u0642\u064a\u0642 \u0627\u0644\u0645\u062a\u0648\u0642\u0639 100/100. ":"\u062a\u0645 \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0625\u0635\u0644\u0627\u062d\u0627\u062a \u0627\u0644\u0622\u0645\u0646\u0629; \u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u0645\u062a\u0648\u0642\u0639\u0629 "+fix.scoreAfter+"/100. "; setNotice(lead+(fix.changes.length?fix.changes.join(" "):"\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u063a\u064a\u064a\u0631\u0627\u062a \u0625\u0636\u0627\u0641\u064a\u0629 \u0622\u0645\u0646\u0629.")+" \u0631\u0627\u062c\u0639 \u062b\u0645 \u0627\u062d\u0641\u0638 \u0627\u0644\u0645\u0642\u0627\u0644.");
    } catch(reason:unknown){setError(getAdminErrorMessage(reason,"\u062a\u0639\u0630\u0631 \u062a\u0637\u0628\u064a\u0642 \u0625\u0635\u0644\u0627\u062d\u0627\u062a SEO \u0627\u0644\u0622\u0645\u0646\u0629."));} finally {setSeoFixBusy(false);}
  }

  function insertSeoInternalLink(item:{url:string;anchor:string}):void {
    const href=escapeHtml(item.url); if(editor.bodyHtml.includes(`href="${href}"`)||editor.bodyHtml.includes(`href='${href}'`)){setNotice("\u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u062f\u0627\u062e\u0644\u064a \u0645\u0648\u062c\u0648\u062f \u0645\u0633\u0628\u0642\u0627\u064b \u0641\u064a \u0627\u0644\u0645\u0642\u0627\u0644.");return;}
    const block='<p><strong>\u0627\u0642\u0631\u0623 \u0623\u064a\u0636\u0627\u064b:</strong> <a href="'+href+'">'+escapeHtml(item.anchor)+'</a></p>'; patchEditor({bodyHtml:editor.bodyHtml+block}); setNotice("\u062a\u0645 \u0625\u062f\u0631\u0627\u062c \u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u062f\u0627\u062e\u0644\u064a \u0641\u064a \u0646\u0647\u0627\u064a\u0629 \u0627\u0644\u0645\u0642\u0627\u0644. \u0631\u0627\u062c\u0639 \u0645\u0648\u0636\u0639\u0647 \u062b\u0645 \u0627\u062d\u0641\u0638.");
  }
  function insertAllSeoInternalLinks():void {
    if(!seoProposal?.internalLinks.length)return; let body=editor.bodyHtml; let added=0;
    for(const item of seoProposal.internalLinks){const href=escapeHtml(item.url);if(body.includes(`href="${href}"`)||body.includes(`href='${href}'`))continue;body+='<p><strong>\u0627\u0642\u0631\u0623 \u0623\u064a\u0636\u0627\u064b:</strong> <a href="'+href+'">'+escapeHtml(item.anchor)+'</a></p>';added+=1;}
    if(!added){setNotice("\u0643\u0644 \u0627\u0644\u0631\u0648\u0627\u0628\u0637 \u0627\u0644\u0645\u0642\u062a\u0631\u062d\u0629 \u0645\u0648\u062c\u0648\u062f\u0629 \u0645\u0633\u0628\u0642\u0627\u064b.");return;} patchEditor({bodyHtml:body}); setNotice("\u062a\u0645 \u0625\u062f\u0631\u0627\u062c "+added+" \u0631\u0627\u0628\u0637 \u062f\u0627\u062e\u0644\u064a \u0645\u0642\u062a\u0631\u062d. \u0631\u0627\u062c\u0639 \u0627\u0644\u0645\u0648\u0627\u0636\u0639 \u062b\u0645 \u0627\u062d\u0641\u0638.");
  }

  function automateSeo(): void {
    const next = fillMissingSeo(editor, categories);
    setEditor(next); setDirty(true);
    setNotice("تم ملء حقول SEO الناقصة آلياً بدون استبدال الحقول المعدلة يدوياً.");
  }

  async function saveArticle(expectedVersionOverride?: string): Promise<CmsGenericItem | null> {
    const titleNode = titleRef.current ?? document.querySelector<HTMLInputElement>(".aa9-title-input");
    const legacyTitle = selected ? editorFromItem(selected, categories, tags).title : "";
    const slugSeed = String(editor.slug || selected?.publicCode || textValue(selected?.payload?.slug) || "").trim();
    const visibleTitle = String(titleNode?.value || editor.title || legacyTitle || "").trim();
    const title = visibleTitle || slugSeed.replace(/-+/g, " ").trim() || "مقال موطني";
    const slug = (slugSeed || slugify(title) || `article-${Date.now()}`).trim();
    const autosaveTarget = selected?.publicId || "new";
    if (title !== editor.title) setEditor((current) => ({ ...current, title, slug }));
    setSaving(true); setError(""); setNotice("");
    try {
      let next = fillMissingSeo({ ...editor, title, slug }, categories);
      if (selected) {
        const previous = editorFromItem(selected, categories, tags);
        const previousPath = articleCanonicalPath(previous, categories);
        const nextPath = articleCanonicalPath(next, categories);
        const existingHistory = Array.isArray(next.basePayload.permalinkHistory) ? next.basePayload.permalinkHistory.filter((value): value is string => typeof value === "string") : [];
        if (previousPath !== nextPath && !existingHistory.includes(previousPath)) next = { ...next, basePayload: { ...next.basePayload, permalinkHistory: [...existingHistory, previousPath].slice(-25) } };
      }
      const payload = { ...articlePayload(next, categories, tags), seoAutomationVersion: 4, structuredEditorVersion: 3 };
      const sourceMeta = { ...next.baseSourceMeta, editorOwner: "ARTICLE_CMS_V4", seoAutomationVersion: 4, lastEditorialSaveAt: new Date().toISOString() };
      const saved = selected
        ? await updateCmsGenericEntity("articles", selected.publicId, { title, publicCode: slug, payload, sourceMeta, expectedVersion: expectedVersionOverride || selected.version })
        : await createCmsGenericEntity("articles", {
            publicId: newPublicId("article"), title, publicCode: slug, locale: "ar-LB",
            status: "DRAFT", payload, sourceMeta,
          });
      await Promise.all([
        replaceCmsGenericRelationships("articles", saved.publicId, "category",
          next.categoryIds.map((targetPublicId) => ({ targetDomain: "article-categories", targetPublicId }))),
        replaceCmsGenericRelationships("articles", saved.publicId, "tag",
          next.tagIds.map((targetPublicId) => ({ targetDomain: "article-tags", targetPublicId }))),
      ]);
      const detail = await getCmsGenericEntity("articles", saved.publicId);
      setSelected(detail); setEditor(editorFromItem(detail, categories, tags));
      setVersions(await getCmsGenericVersions("articles", detail.publicId));
      setAudit(await getCmsGenericAudit("articles", detail.publicId));
      localStorage.removeItem(`watany_article_draft_${editor.id || "new"}`);
      await clearArticleAutosave(autosaveTarget).catch(() => undefined);
      setConflictItem(null); setAutosaveState("idle"); setAutosaveAt("");
      setDirty(false); setNotice("تم حفظ المقال والتصنيفات والوسوم.");
      void loadArticles();
      return detail;
    } catch (reason: unknown) {
      if (getAdminErrorCode(reason) === "CMS_REVISION_CONFLICT" && selected) {
        try { setConflictItem(await getCmsGenericEntity("articles", selected.publicId)); } catch { setConflictItem(null); }
        setError("تم تعديل هذا المقال من جلسة أخرى بعد فتحه. لم يتم استبدال نسخة الخادم؛ اختر نسخة الخادم أو أكد الاستبدال صراحةً.");
      } else setError(getAdminErrorMessage(reason, "تعذر حفظ المقال."));
      return null;
    } finally { setSaving(false); }
  }

  async function lifecycle(action: "publish" | "unpublish" | "archive" | "restore"): Promise<void> {
    if (action === "archive" && !globalThis.confirm("هل تريد أرشفة هذا المقال؟")) return;
    if (action === "publish") {
      const prepared = fillMissingSeo(editor, categories);
      const gate = seoScore(prepared, categories);
      setEditor(prepared);
      if (gate.blockingIssues.length) { setDirty(true); setError(`لا يمكن النشر قبل معالجة: ${gate.blockingIssues.join("، ")}`); return; }
    }
    let target = selected;
    if (dirty || !target) target = await saveArticle();
    if (!target) return;
    setSaving(true); setError("");
    try {
      const updated = await runCmsGenericAction("articles", target.publicId, action);
      const detail = await getCmsGenericEntity("articles", updated.publicId);
      setSelected(detail); setEditor(editorFromItem(detail, categories, tags));
      setVersions(await getCmsGenericVersions("articles", detail.publicId));
      setAudit(await getCmsGenericAudit("articles", detail.publicId));
      setDirty(false);
      setNotice(action === "publish" ? "تم نشر المقال." : action === "unpublish" ? "تم إلغاء النشر." : action === "archive" ? "تمت الأرشفة." : "تمت الاستعادة.");
      void loadArticles();
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تحديث حالة المقال."));
    } finally { setSaving(false); }
  }
  async function restoreVersion(version: CmsEntityVersion): Promise<void> {
    if (!selected || !globalThis.confirm(`استعادة الإصدار ${version.version}؟`)) return;
    setSaving(true);
    try {
      const restored = await rollbackCmsGenericEntity("articles", selected.publicId, version.id);
      const detail = await getCmsGenericEntity("articles", restored.publicId);
      setSelected(detail); setEditor(editorFromItem(detail, categories, tags));
      setVersions(await getCmsGenericVersions("articles", detail.publicId));
      setAudit(await getCmsGenericAudit("articles", detail.publicId));
      setDirty(false); setNotice(`تمت استعادة الإصدار ${version.version}.`);
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر استعادة الإصدار."));
    } finally { setSaving(false); }
  }

  function loadConflictFromServer(): void { if (!conflictItem) return; setSelected(conflictItem); setEditor(editorFromItem(conflictItem, categories, tags)); setConflictItem(null); setDirty(false); setError(""); setNotice("تم تحميل أحدث نسخة من الخادم."); }
  async function overwriteConflict(): Promise<void> { if (!conflictItem || !globalThis.confirm("سيتم استبدال نسخة الخادم الحالية بمحتوى المحرر المفتوح. هل تريد المتابعة؟")) return; await saveArticle(conflictItem.version); }

  async function createTaxonomy(domain: "article-categories" | "article-tags", stayInEditor = false): Promise<void> {
    const title = taxonomyName.trim();
    if (!title) return;
    setSaving(true); setError("");
    try {
      const item = await createCmsGenericEntity(domain, {
        publicId: newPublicId(domain === "article-categories" ? "category" : "tag"),
        title, publicCode: slugify(title), locale: "ar-LB", status: "PUBLISHED",
        payload: domain === "article-categories" ? { parentId: taxonomyParent || null } : {},
        sourceMeta: { editorOwner: "ARTICLE_CMS_V2" },
      });
      if (domain === "article-categories" && taxonomyParent) {
        await replaceCmsGenericRelationships(domain, item.publicId, "parent", [
          { targetDomain: "article-categories", targetPublicId: taxonomyParent },
        ]);
      }
      setTaxonomyName(""); setTaxonomyParent("");
      await loadLibraries();
      if (stayInEditor) {
        patchEditor(domain === "article-categories"
          ? { categoryIds: [...editor.categoryIds, item.publicId] }
          : { tagIds: [...editor.tagIds, item.publicId] });
      }
      setNotice(domain === "article-categories" ? "تم إنشاء التصنيف." : "تم إنشاء الوسم.");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر إنشاء العنصر."));
    } finally { setSaving(false); }
  }

  async function renameTaxonomy(domain: "article-categories" | "article-tags", item: CmsGenericItem): Promise<void> {
    const title = globalThis.prompt("الاسم الجديد", item.title)?.trim();
    if (!title || title === item.title) return;
    try {
      await updateCmsGenericEntity(domain, item.publicId, { title, publicCode: slugify(title) });
      await loadLibraries();
    } catch (reason: unknown) { setError(getAdminErrorMessage(reason, "تعذر تعديل العنصر.")); }
  }
  async function archiveTaxonomy(domain: "article-categories" | "article-tags", item: CmsGenericItem): Promise<void> {
    if (!globalThis.confirm(`أرشفة «${item.title}»؟`)) return;
    try {
      await runCmsGenericAction(domain, item.publicId, "archive");
      await loadLibraries();
    } catch (reason: unknown) { setError(getAdminErrorMessage(reason, "تعذر أرشفة العنصر.")); }
  }

  async function uploadMedia(file: File, useAsFeatured = false): Promise<CmsGenericItem | null> {
    setMediaBusy(true); setError("");
    try {
      const result = await uploadArticleMedia({
        name: file.name, mimeType: file.type, dataBase64: await fileToBase64(file),
        altText: mediaAlt, caption: mediaCaption,
      });
      const absolute = absoluteMediaUrl(result.asset.url);
      const normalized = { ...result.item, payload: { ...result.item.payload, url: absolute } };
      setMedia((current) => [normalized, ...current.filter((item) => item.publicId !== normalized.publicId)]);
      if (useAsFeatured && result.asset.mimeType.startsWith("image/")) {
        patchEditor({ featuredImage: absolute, ogImage: editor.ogImage || absolute });
      }
      setNotice("تم رفع الملف إلى مكتبة الوسائط.");
      return normalized;
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر رفع الملف. الصور والفيديو وPDF فقط حتى 25MB."));
      return null;
    } finally { setMediaBusy(false); }
  }
  async function replaceMediaFile(item: CmsGenericItem, file: File): Promise<void> {
    setMediaBusy(true); setError(""); setNotice("");
    try {
      const result = await replaceArticleMedia(item.publicId, { name: file.name || item.title, mimeType: file.type, dataBase64: await fileToBase64(file), altText: textValue(item.payload.altText), caption: textValue(item.payload.caption) });
      const absolute = absoluteMediaUrl(result.asset.url);
      const normalized = { ...result.item, payload: { ...result.item.payload, url: absolute } };
      setMedia((current) => current.map((candidate) => candidate.publicId === normalized.publicId ? normalized : candidate));
      setNotice("تم استبدال الملف مع الحفاظ على نفس الرابط العام وإنشاء نسخة احتياطية داخلية.");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر استبدال الملف. يجب أن يبقى نوع الملف والامتداد متوافقين."));
    } finally { setMediaBusy(false); }
  }

  async function editMediaMetadata(item: CmsGenericItem): Promise<void> {
    const title = globalThis.prompt("اسم الملف في المكتبة", item.title)?.trim(); if (!title) return;
    const altText = globalThis.prompt("النص البديل للصورة", textValue(item.payload.altText)) ?? textValue(item.payload.altText);
    const caption = globalThis.prompt("التعليق / الوصف", textValue(item.payload.caption)) ?? textValue(item.payload.caption);
    try { const updated = await updateCmsGenericEntity("article-media", item.publicId, { title, payload: { ...item.payload, altText: altText.trim(), caption: caption.trim() }, expectedVersion: item.version }); setMedia((current) => current.map((candidate) => candidate.publicId === updated.publicId ? updated : candidate)); setNotice("تم تحديث بيانات الوسائط."); }
    catch (reason: unknown) { setError(getAdminErrorMessage(reason, "تعذر تحديث بيانات الوسائط.")); }
  }
  async function archiveMedia(item: CmsGenericItem): Promise<void> {
    const usage = mediaUsage[item.publicId] || 0; if (usage > 0) { setError("لا يمكن أرشفة الملف لأنه مستخدم في " + usage + " مقال."); return; }
    if (!globalThis.confirm("أرشفة الملف «" + item.title + "»؟")) return;
    try { await runCmsGenericAction("article-media", item.publicId, "archive"); setMedia((current) => current.filter((candidate) => candidate.publicId !== item.publicId)); setNotice("تمت أرشفة الملف غير المستخدم."); }
    catch (reason: unknown) { setError(getAdminErrorMessage(reason, "تعذر أرشفة الملف.")); }
  }
  async function copyMediaUrl(item: CmsGenericItem): Promise<void> { const raw=textValue(item.payload.url); if(!raw)return; await navigator.clipboard.writeText(absoluteMediaUrl(raw)); setNotice("تم نسخ رابط الوسائط."); }
  function downloadMedia(item: CmsGenericItem): void { const raw=textValue(item.payload.url); if(!raw)return; const link=document.createElement("a"); link.href=absoluteMediaUrl(raw); link.target="_blank"; link.rel="noopener noreferrer"; link.download=item.title; link.click(); }


  function editorCommand(command: string, value?: string): void {
    visualRef.current?.focus();
    document.execCommand(command, false, value);
    if (visualRef.current) patchEditor({ bodyHtml: visualRef.current.innerHTML });
  }

  function addLink(): void {
    const url = globalThis.prompt("رابط URL")?.trim();
    if (url) editorCommand("createLink", url);
  }

  function insertEditorBlock(kind: "paragraph" | "heading" | "quote" | "callout" | "table" | "separator" | "button" | "ad" | "faq"): void {
    const blocks = {
      paragraph: '<p>اكتب النص هنا...</p>', heading: '<h2>عنوان القسم</h2>',
      quote: '<blockquote>أضف الاقتباس هنا...</blockquote>', callout: '<aside data-watany-block="callout"><strong>معلومة مهمة</strong><p>أضف التفاصيل هنا.</p></aside>', table: '<table><thead><tr><th>العنوان</th><th>القيمة</th></tr></thead><tbody><tr><td>بيان</td><td>—</td></tr></tbody></table>', separator: '<hr>',
      button: '<p><a class="watany-cms-button" href="#">نص الزر</a></p>',
      ad: '<div class="watany-cms-ad" data-watany-ad-placement="article-inline"><span>مساحة إعلانية</span></div><p><br></p>',
      faq: '<section class="watany-cms-faq"><h3>سؤال شائع</h3><p>أضف الإجابة هنا...</p></section>',
    } satisfies Record<string, string>;
    patchEditor({ bodyHtml: `${editor.bodyHtml}${blocks[kind]}` });
    setEditorMode("visual");
  }

  function insertMedia(item: CmsGenericItem): void {
    const raw = textValue(item.payload.url);
    if (!raw) return;
    const url = absoluteMediaUrl(raw);
    const kind = mediaKind(item);
    const alt = escapeHtml(textValue(item.payload.altText));
    const caption = escapeHtml(textValue(item.payload.caption));
    const html = kind === "image"
      ? `<figure><img src="${url}" alt="${alt}">${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure><p><br></p>`
      : kind === "video" ? `<video controls preload="metadata" src="${url}"></video><p><br></p>`
        : `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></p>`;
    patchEditor({ bodyHtml: `${editor.bodyHtml}${html}` });
    setView("editor");
  }

  function insertLegacy(asset: LegacyMedia, featured = false): void {
    if (featured) patchEditor({ featuredImage: asset.url, ogImage: editor.ogImage || asset.url });
    else patchEditor({ bodyHtml: `${editor.bodyHtml}<p><img src="${asset.url}" alt=""></p>` });
    setView("editor");
  }
  function previewDraft(): void {
    const body = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(editor.title)}</title></head><body style="max-width:900px;margin:40px auto;font-family:Arial,sans-serif;line-height:1.9">${editor.featuredImage ? `<img src="${editor.featuredImage}" style="max-width:100%;border-radius:12px">` : ""}<h1>${escapeHtml(editor.title)}</h1>${editor.bodyHtml}</body></html>`;
    const url = URL.createObjectURL(new Blob([body], { type: "text/html" }));
    globalThis.open(url, "_blank", "noopener,noreferrer");
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function bulkArchive(): Promise<void> {
    if (!selectedIds.length || !globalThis.confirm(`أرشفة ${selectedIds.length} مقالات؟`)) return;
    setSaving(true);
    try {
      await runCmsGenericBulkArchive("articles", selectedIds);
      setSelectedIds([]); await loadArticles(); setNotice("تمت أرشفة المقالات المحددة.");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تنفيذ الإجراء الجماعي."));
    } finally { setSaving(false); }
  }

  function toggleTerm(field: "categoryIds" | "tagIds", id: string): void {
    const current = editor[field];
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    if (field === "categoryIds") {
      patchEditor({ categoryIds: next, primaryCategoryId: next.includes(editor.primaryCategoryId) ? editor.primaryCategoryId : (next[0] || "") });
      return;
    }
    patchEditor({ tagIds: next });
  }

  function renderArticles() {
    const allChecked = articles.length > 0 && articles.every((item) => selectedIds.includes(item.publicId));
    return <section className="aa9-panel">
      <div className="aa9-metrics"><div><span>الإجمالي</span><strong>{total}</strong></div>{FILTER_STATUSES.map((value) => <div key={value}><span>{STATUS_LABELS[value]}</span><strong>{statusCounts[value] || 0}</strong></div>)}</div>
      <div className="aa9-toolbar">
        <label><span>بحث</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="العنوان أو الرابط" /></label>
        <label><span>الحالة</span><select value={status} onChange={(event) => { setStatus(event.target.value as CmsStatus | ""); setPage(1); }}><option value="">كل الحالات</option>{FILTER_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label>
        <button type="button" className="accent" onClick={() => void beginCreate()}>+ مقال جديد</button>
        <button type="button" className="ghost danger" disabled={!selectedIds.length || saving} onClick={() => void bulkArchive()}>أرشفة المحدد ({selectedIds.length})</button>
      </div>
      <div className="aa9-table-wrap"><table className="aa9-table"><thead><tr><th><input aria-label="تحديد الصفحة" type="checkbox" checked={allChecked} onChange={(event) => setSelectedIds(event.target.checked ? articles.map((item) => item.publicId) : [])} /></th><th>المقال</th><th>الكاتب</th><th>التصنيفات</th><th>الحالة</th><th>SEO</th><th>آخر تعديل</th><th>إجراءات</th></tr></thead><tbody>
        {articles.map((item) => {
          const payload = item.payload || {};
          const image = textValue(payload.featuredImage);
          const names = Array.isArray(payload.categories) ? payload.categories.filter((v): v is string => typeof v === "string") : [];
          const seoReady = Boolean(textValue(payload.seoTitle) && textValue(payload.seoDescription));
          return <tr key={item.publicId}>
            <td><input aria-label={`تحديد ${item.title}`} type="checkbox" checked={selectedIds.includes(item.publicId)} onChange={() => setSelectedIds((current) => current.includes(item.publicId) ? current.filter((id) => id !== item.publicId) : [...current, item.publicId])} /></td>
            <td><div className="aa9-title-cell">{image ? <img src={image} alt="" /> : <span className="aa9-thumb"><AdminFluentIcon name="document" /></span>}<div><button type="button" className="aa9-title-link" onClick={() => void openArticle(item)}>{item.title}</button><small dir="ltr">/articles/{item.publicCode || textValue(payload.slug)}</small></div></div></td>
            <td>{textValue(payload.authorName) || "—"}</td>
            <td>{names.length ? names.slice(0, 3).join("، ") : "—"}{names.length > 3 ? ` +${names.length - 3}` : ""}</td>
            <td><span className={statusClass(item.status)}>{STATUS_LABELS[item.status]}</span></td>
            <td><span className={seoReady ? "aa9-seo aa9-seo--good" : "aa9-seo aa9-seo--warn"}>{seoReady ? "جيد" : "ناقص"}</span></td>
            <td>{formatDate(item.updatedAt)}</td>
            <td><div className="aa9-row-actions"><button type="button" className="ghost sm" onClick={() => void openArticle(item)}>تعديل</button>{item.status === "PUBLISHED" ? <button type="button" className="ghost sm" onClick={() => globalThis.open(articleCanonicalPath(editorFromItem(item, categories, tags), categories), "_blank", "noopener,noreferrer")}>عرض</button> : null}</div></td>
          </tr>;
        })}
      </tbody></table></div>
      {loading && <div className="aa9-empty">جارٍ تحميل المقالات...</div>}
      {!loading && !articles.length && <div className="aa9-empty">لا توجد مقالات مطابقة.</div>}
      <div className="aa9-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>السابق</button><span>صفحة {page} من {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>التالي</button></div>
    </section>;
  }

  function renderTaxonomy() {
    const domain: "article-categories" | "article-tags" = view === "categories" ? "article-categories" : "article-tags";
    const items = domain === "article-categories" ? categories : tags;
    const isCategory = domain === "article-categories";
    return <section className="aa9-taxonomy">
      <form className="aa9-card aa9-taxonomy-create" onSubmit={(event) => { event.preventDefault(); void createTaxonomy(domain); }}>
        <h2>{isCategory ? "إضافة تصنيف" : "إضافة وسم"}</h2>
        <label><span>الاسم</span><input value={taxonomyName} onChange={(event) => setTaxonomyName(event.target.value)} /></label>
        {isCategory && <label><span>التصنيف الأب</span><select value={taxonomyParent} onChange={(event) => setTaxonomyParent(event.target.value)}><option value="">بدون أب</option>{categories.filter((item) => item.status !== "ARCHIVED").map((item) => <option key={item.publicId} value={item.publicId}>{item.title}</option>)}</select></label>}
        <button type="submit" className="accent" disabled={saving || !taxonomyName.trim()}>إضافة</button>
      </form>
      <div className="aa9-card"><div className="aa9-section-head"><div><h2>{isCategory ? "التصنيفات" : "الوسوم"}</h2><p>{items.length} عنصر</p></div></div>
        <div className="aa9-term-grid">{items.map((item) => {
          const parentId = textValue(item.payload.parentId);
          const parent = categories.find((candidate) => candidate.publicId === parentId);
          return <article className="aa9-term" key={item.publicId}>
            <strong>{item.title}</strong><span dir="ltr">{item.publicCode || "—"}</span>
            {isCategory && parent && <span>الأب: {parent.title}</span>}
            <span>{STATUS_LABELS[item.status]}</span>
            <div><button type="button" className="ghost sm" onClick={() => void renameTaxonomy(domain, item)}>تعديل</button>{item.status !== "ARCHIVED" && <button type="button" className="ghost danger sm" onClick={() => void archiveTaxonomy(domain, item)}>أرشفة</button>}</div>
          </article>;
        })}</div>
      </div>
    </section>;
  }

  function renderSeoDashboard() {
    const report = seoDashboard;
    return <section className="aa9-panel aa9-seo-dashboard">
      <div className="aa9-card aa9-seo-dashboard-head"><div><h2>لوحة صحة SEO</h2><p>تدقيق مجمّع لكل المقالات المنشورة مع حالة الفهرسة وخريطة الموقع وأداء آخر 30 يوماً.</p></div><button type="button" className="accent" disabled={seoDashboardBusy} onClick={() => void loadSeoDashboard()}>{seoDashboardBusy ? "جارٍ التدقيق…" : "إعادة التدقيق"}</button></div>
      {!report ? <div className="aa9-empty">{seoDashboardBusy ? "جارٍ تحليل المقالات المنشورة…" : "افتح اللوحة أو أعد التدقيق لتحميل التقرير."}</div> : <>
        <div className="aa9-seo-dashboard-metrics">
          <div><span>المقالات</span><strong>{report.summary.total}</strong></div><div><span>متوسط SEO</span><strong>{report.summary.averageScore}/100</strong></div><div><span>100/100</span><strong>{report.summary.perfectCount}</strong></div><div><span>تحتاج معالجة</span><strong>{report.summary.needsAttention}</strong></div>
          <div><span>مفهرسة</span><strong>{report.summary.indexable}</strong></div><div><span>في Sitemap</span><strong>{report.summary.sitemapIncluded}</strong></div><div><span>مشاكل Canonical</span><strong>{report.summary.canonicalIssues}</strong></div><div><span>صور بلا alt</span><strong>{report.summary.missingAlt}</strong></div>
          <div><span>روابط مكسورة</span><strong>{report.summary.brokenInternalLinks}</strong></div><div><span>وسائط مفقودة</span><strong>{report.summary.brokenMedia}</strong></div><div><span>تضارب محتمل</span><strong>{report.summary.duplicateRisks}</strong></div><div><span>مشاهدات 30 يوم</span><strong>{report.summary.performance.views30d}</strong></div>
          <div><span>مشاركات</span><strong>{report.summary.performance.shares30d}</strong></div><div><span>تنزيلات PDF</span><strong>{report.summary.performance.pdfDownloads30d}</strong></div><div><span>نقرات داخلية</span><strong>{report.summary.performance.internalLinkClicks30d}</strong></div>
        </div>
        <div className="aa9-card aa9-seo-dashboard-meta"><span>آخر تدقيق: {formatDate(report.generatedAt)}</span><span>الأداء المعروض هو قياس موطني الداخلي منذ تفعيل SEO V4، وليس بيانات Google Search Console.</span></div>
        <div className="aa9-table-wrap"><table className="aa9-table aa9-seo-dashboard-table"><thead><tr><th>المقال</th><th>SEO</th><th>الفهرسة</th><th>Sitemap</th><th>المشكلات</th><th>أداء 30 يوم</th><th>إجراء</th></tr></thead><tbody>{report.items.map((item) => <tr key={item.id}><td><a href={item.url} target="_blank" rel="noreferrer" className="aa9-title-link">{item.title}</a>{item.duplicateRisk >= 0.42 ? <small>تشابه محتمل {Math.round(item.duplicateRisk * 100)}%</small> : null}</td><td><strong className={item.score === 100 ? "aa9-score good" : item.score >= 80 ? "aa9-score warn" : "aa9-score bad"}>{item.score}/100</strong></td><td>{item.indexable ? "index" : "noindex"}</td><td>{item.sitemapIncluded ? "مدرج" : "غير مدرج"}</td><td>{item.issues.length ? item.issues.slice(0, 3).join("، ") : "مكتمل"}</td><td><small>👁 {item.performance.views30d} · ↗ {item.performance.shares30d} · PDF {item.performance.pdfDownloads30d} · 🔗 {item.performance.internalLinkClicks30d}</small></td><td><button type="button" className="ghost sm" onClick={() => void openSeoDashboardArticle(item.id)}>فتح المحرر</button></td></tr>)}</tbody></table></div>
      </>}
    </section>;
  }

  function renderMedia() {
    return <section className="aa9-media">
      <div className="aa9-card aa9-media-upload"><h2>رفع وسائط</h2><p>صور، MP4/WebM أو PDF حتى 25MB.</p>
        <label><span>النص البديل</span><input value={mediaAlt} onChange={(event) => setMediaAlt(event.target.value)} /></label>
        <label><span>التعليق</span><input value={mediaCaption} onChange={(event) => setMediaCaption(event.target.value)} /></label>
        <label className="accent aa9-file-button">{mediaBusy ? "جارٍ الرفع..." : "اختيار ملف"}<input hidden type="file" disabled={mediaBusy} accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file); event.currentTarget.value = ""; }} /></label>
      </div>
      <div className="aa9-card"><div className="aa9-section-head"><div><h2>مكتبة الوسائط</h2><p>{media.length} ملفات CMS</p></div></div>
        <div className="aa9-media-grid">{media.map((item) => {
          const raw = textValue(item.payload.url);
          const url = raw ? absoluteMediaUrl(raw) : "";
          const kind = mediaKind(item);
          return <article className="aa9-media-card" key={item.publicId}>
            <div className="aa9-media-preview">{kind === "image" ? <img src={url} alt={textValue(item.payload.altText)} /> : kind === "video" ? <video src={url} controls preload="metadata" /> : <span><AdminFluentIcon name="document" /><b>{kind === "pdf" ? "PDF" : "FILE"}</b></span>}</div>
            <strong>{item.title}</strong><small>{textValue(item.payload.mimeType)} · الاستخدام: {mediaUsage[item.publicId] || 0}</small>
            <div>{kind === "image" && <button type="button" className="ghost sm" onClick={() => { patchEditor({ featuredImage: url, ogImage: editor.ogImage || url }); setView("editor"); }}>صورة بارزة</button>}<button type="button" className="ghost sm" onClick={() => insertMedia(item)}>إدراج</button><button type="button" className="ghost sm" onClick={() => void editMediaMetadata(item)}>البيانات</button><button type="button" className="ghost sm" onClick={() => void copyMediaUrl(item)}>نسخ الرابط</button><button type="button" className="ghost sm" onClick={() => downloadMedia(item)}>تنزيل</button><label className="ghost sm aa9-file-button">استبدال بنفس الرابط<input hidden type="file" disabled={mediaBusy} accept={textValue(item.payload.mimeType)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceMediaFile(item, file); event.currentTarget.value = ""; }} /></label>{(mediaUsage[item.publicId] || 0) === 0 && <button type="button" className="ghost danger sm" onClick={() => void archiveMedia(item)}>أرشفة</button>}</div>
          </article>;
        })}</div>
      </div>
      {legacyMedia.length > 0 && <div className="aa9-card"><div className="aa9-section-head"><div><h2>وسائط الأرشيف</h2><p>صور WordPress المستوردة والقابلة لإعادة الاستخدام.</p></div></div>
        <div className="aa9-media-grid">{legacyMedia.map((asset) => <article className="aa9-media-card" key={asset.url}><div className="aa9-media-preview"><img src={asset.url} alt="" /></div><strong>{asset.title}</strong><small>WordPress Archive</small><div><button type="button" className="ghost sm" onClick={() => insertLegacy(asset, true)}>صورة بارزة</button><button type="button" className="ghost sm" onClick={() => insertLegacy(asset)}>إدراج</button></div></article>)}</div>
      </div>}
    </section>;
  }
  function renderEditor() {
    return <section className="aa9-editor">
      <div className="aa9-editor-head"><button type="button" className="ghost" onClick={() => setView("articles")}>← كل المقالات</button><div><button type="button" className="ghost" onClick={previewDraft}>معاينة</button><button type="button" className="accent" disabled={saving || !dirty} onClick={() => void saveArticle()}>{saving ? "جارٍ الحفظ..." : selected?.status === "PUBLISHED" ? "تحديث المنشور" : "حفظ"}</button></div></div>
      <div className="aa9-editor-layout"><main className="aa9-editor-main">
        <div className="aa9-card aa9-title-card"><input ref={titleRef} className="aa9-title-input" value={editor.title} onChange={(event) => { const title = event.target.value; patchEditor({ title, slug: editor.slug || slugify(title), permalinkSlug: editor.permalinkSlug || asciiSlugify(title) }); }} placeholder="أدخل عنوان المقال" /><label className="aa9-slug"><span dir="ltr">/articles/</span><input dir="ltr" value={editor.slug} onChange={(event) => patchEditor({ slug: slugify(event.target.value) })} /></label></div>
        <label className="aa9-card aa9-field"><span>المقتطف</span><textarea rows={3} value={editor.excerpt} onChange={(event) => patchEditor({ excerpt: event.target.value })} placeholder="ملخص قصير للأرشيف ومحركات البحث" /></label>
        <div className="aa9-body-editor"><div className="aa9-mode-tabs"><button type="button" className={editorMode === "visual" ? "active" : ""} onClick={() => setEditorMode("visual")}>مرئي</button><button type="button" className={editorMode === "html" ? "active" : ""} onClick={() => setEditorMode("html")}>HTML</button></div>
          {editorMode === "visual" ? <><div className="aa9-block-library" aria-label="مكتبة مكونات المحتوى"><span>+ إضافة مكوّن</span><button type="button" onClick={() => insertEditorBlock("paragraph")}>فقرة</button><button type="button" onClick={() => insertEditorBlock("heading")}>عنوان</button><button type="button" onClick={() => insertEditorBlock("quote")}>اقتباس</button><button type="button" onClick={() => setView("media")}>صورة / ملف</button><button type="button" onClick={() => insertEditorBlock("button")}>زر</button><button type="button" onClick={() => insertEditorBlock("faq")}>FAQ</button><button type="button" onClick={() => insertEditorBlock("callout")}>ملاحظة</button><button type="button" onClick={() => insertEditorBlock("table")}>جدول</button><button type="button" onClick={() => insertEditorBlock("ad")}>إعلان</button><button type="button" onClick={() => insertEditorBlock("separator")}>فاصل</button></div><div className="aa9-format"><button type="button" onClick={() => editorCommand("bold")}><b>B</b></button><button type="button" onClick={() => editorCommand("italic")}><i>I</i></button><button type="button" onClick={() => editorCommand("underline")}><u>U</u></button><button type="button" onClick={() => editorCommand("formatBlock", "h2")}>H2</button><button type="button" onClick={() => editorCommand("formatBlock", "h3")}>H3</button><button type="button" onClick={() => editorCommand("insertUnorderedList")}>• قائمة</button><button type="button" onClick={() => editorCommand("insertOrderedList")}>1. قائمة</button><button type="button" onClick={() => editorCommand("formatBlock", "blockquote")}>اقتباس</button><button type="button" onClick={addLink}>رابط</button><button type="button" onClick={() => setView("media")}>+ وسائط</button></div><div ref={visualRef} className="aa9-content" contentEditable suppressContentEditableWarning onInput={() => { if (visualRef.current) patchEditor({ bodyHtml: visualRef.current.innerHTML }); }} dangerouslySetInnerHTML={{ __html: editor.bodyHtml }} /></> : <textarea className="aa9-html" dir="ltr" rows={24} value={editor.bodyHtml} onChange={(event) => patchEditor({ bodyHtml: event.target.value })} />}
        </div>
        <section className="aa9-card aa9-seo-panel"><div className="aa9-section-head"><div><h2>تحسين محركات البحث SEO</h2><p>نتيجة البحث والمشاركة الاجتماعية.</p></div><div className="aa9-seo-head-actions"><button type="button" className="ghost sm" onClick={automateSeo}>ملء SEO تلقائياً</button><button type="button" className="ghost sm aa9-safe-fix" disabled={seoFixBusy} onClick={() => void runSeoSafeFixes()}>{seoFixBusy ? "جارٍ الإصلاح…" : "✓ إصلاح آمن نحو 100"}</button><strong className={review.score >= 80 ? "aa9-score good" : review.score >= 55 ? "aa9-score warn" : "aa9-score bad"}>{review.score}/100</strong><button type="button" className="accent aa9-agent-run" disabled={seoAgentBusy} onClick={() => void runSeoAgent()}>{seoAgentBusy ? "جارٍ التحليل…" : "✦ تشغيل وكيل DC SEO"}</button></div></div>
          <div className="aa9-search-preview"><small>{editor.canonicalUrl || articleCanonicalPath(editor, categories)}</small><h3>{editor.seoTitle || editor.title || "عنوان المقال"}</h3><p>{editor.seoDescription || editor.excerpt || "أضف وصفاً ليظهر في نتيجة البحث."}</p></div><div className="aa9-social-preview-grid"><article><span>Facebook / WhatsApp</span><img src={editor.ogImage || editor.featuredImage || "/logo.png?v=20260827-1"} alt="" /><div><strong>{editor.ogTitle || editor.seoTitle || editor.title || "عنوان المقال"}</strong><p>{editor.ogDescription || editor.seoDescription || editor.excerpt || "وصف المشاركة الاجتماعية"}</p><small dir="ltr">koudama.com</small></div></article></div>
          <div className="aa9-seo-grid">
            <label><span>عنوان SEO <small>{editor.seoTitle.length}/60</small></span><input value={editor.seoTitle} onChange={(event) => patchEditor({ seoTitle: event.target.value })} /></label>
            <label><span>العبارة المفتاحية</span><input value={editor.focusKeyphrase} onChange={(event) => patchEditor({ focusKeyphrase: event.target.value })} /></label>
            <label className="wide"><span>وصف Meta <small>{editor.seoDescription.length}/160</small></span><textarea rows={3} value={editor.seoDescription} onChange={(event) => patchEditor({ seoDescription: event.target.value })} /></label>
            <label className="wide"><span>Permalink slug</span><input dir="ltr" value={editor.permalinkSlug} onChange={(event) => patchEditor({ permalinkSlug: asciiSlugify(event.target.value) })} /></label><label className="wide"><span>Canonical URL</span><input dir="ltr" value={editor.canonicalUrl} onChange={(event) => patchEditor({ canonicalUrl: event.target.value })} /></label>
            <label><span>Robots</span><select value={editor.robots} onChange={(event) => patchEditor({ robots: event.target.value })}><option value="index,follow">index, follow</option><option value="noindex,follow">noindex, follow</option><option value="noindex,nofollow">noindex, nofollow</option></select></label>
            <label><span>OG Title</span><input value={editor.ogTitle} onChange={(event) => patchEditor({ ogTitle: event.target.value })} /></label>
            <label className="wide"><span>OG Description</span><textarea rows={2} value={editor.ogDescription} onChange={(event) => patchEditor({ ogDescription: event.target.value })} /></label>
            <label className="wide"><span>OG Image</span><input dir="ltr" value={editor.ogImage} onChange={(event) => patchEditor({ ogImage: event.target.value })} /></label>
          </div>
          <div className="aa9-seo-checks">{review.checks.map((check) => <div key={check.id} className={check.ok ? "pass" : check.blocking ? "fail" : "warn"}><span aria-hidden="true">{check.ok ? "✓" : check.blocking ? "!" : "•"}</span><span>{check.label}</span></div>)}</div>
          {review.notes.length > 0 ? <ul className="aa9-seo-notes">{review.notes.map((note) => <li key={note}>{note}</li>)}</ul> : <p className="aa9-seo-pass">فحوص SEO الأساسية مكتملة.</p>}
          {seoProposal && <section className="aa9-agent-panel" aria-live="polite">
            <div className="aa9-agent-title"><div><strong>وكيل DC SEO</strong><small>{seoProposal.mode === "ai" ? "AI · " + seoProposal.provider + " · " + seoProposal.model : "تحليل محلي احتياطي"}</small></div><span className="aa9-agent-score">{seoProposal.scoreBefore} → {seoProposal.scoreAfter}</span></div>
            <p>{seoProposal.summary}</p>
            <div className="aa9-audit-summary" aria-label="تدقيق SEO المتقدم">
              <div><span>النتيجة</span><strong>{seoProposal.audit.score}/100</strong></div>
              <div><span>الفهرسة</span><strong>{seoProposal.audit.indexing.indexable ? "مسموحة" : "noindex"}</strong></div>
              <div><span>خريطة الموقع</span><strong>{seoProposal.audit.indexing.sitemapIncluded ? "مدرج" : seoProposal.audit.indexing.sitemapEligible ? "مؤهل" : "غير مؤهل"}</strong></div>
              <div><span>الصور بلا alt</span><strong>{seoProposal.audit.images.missingAlt}</strong></div>
              <div><span>روابط داخلية مكسورة</span><strong>{seoProposal.audit.links.brokenInternal.length}</strong></div>
              <div><span>وسائط مفقودة</span><strong>{seoProposal.audit.media.broken.length}</strong></div>
            </div>
            <div className="aa9-audit-checks">{seoProposal.audit.checks.map((item) => <div key={item.id} className={item.status}><span>{item.status === "pass" ? "✓" : item.status === "fail" ? "!" : "•"}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></div>)}</div>
            {seoProposal.audit.duplicateCandidates.length > 0 && <details open><summary>تشابه / تضارب محتمل ({seoProposal.audit.duplicateCandidates.length})</summary><div className="aa9-agent-links">{seoProposal.audit.duplicateCandidates.map((item) => <div key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><small>نسبة التشابه {Math.round(item.similarity * 100)}%</small></div>)}</div></details>}
            {(seoProposal.audit.links.brokenInternal.length > 0 || seoProposal.audit.media.broken.length > 0 || seoProposal.audit.links.malformed.length > 0) && <details open><summary>روابط ووسائط تحتاج إصلاحاً</summary><ul>{seoProposal.audit.links.brokenInternal.map((item) => <li key={`link-${item}`}>رابط داخلي: <code dir="ltr">{item}</code></li>)}{seoProposal.audit.media.broken.map((item) => <li key={`media-${item}`}>وسيط مفقود: <code dir="ltr">{item}</code></li>)}{seoProposal.audit.links.malformed.map((item) => <li key={`bad-${item}`}>رابط غير صالح: <code dir="ltr">{item}</code></li>)}</ul></details>}
            <div className="aa9-agent-actions"><button type="button" className="accent" onClick={() => applySeoProposal(false)}>تطبيق حقول SEO</button><button type="button" className="ghost" onClick={() => applySeoProposal(true)}>تطبيق SEO + المقتطف</button><button type="button" className="ghost" disabled={seoAgentBusy} onClick={() => void runSeoAgent()}>إعادة التحليل</button></div>
            {seoProposal.issues.length > 0 && <details open><summary>المشكلات المكتشفة ({seoProposal.issues.length})</summary><ul>{seoProposal.issues.map((item) => <li key={item}>{item}</li>)}</ul></details>}
            {seoProposal.contentRecommendations.length > 0 && <details><summary>تحسين محتوى المقال</summary><ul>{seoProposal.contentRecommendations.map((item) => <li key={item}>{item}</li>)}</ul></details>}
            {seoProposal.internalLinks.length > 0 && <details open><summary>روابط داخلية مقترحة</summary><div className="aa9-agent-link-toolbar"><button type="button" className="ghost sm" onClick={insertAllSeoInternalLinks}>إدراج كل الروابط</button><small>تُضاف كروابط تحريرية قابلة للمراجعة قبل الحفظ.</small></div><div className="aa9-agent-links">{seoProposal.internalLinks.map((item) => <div key={item.url}><span><a href={item.url} target="_blank" rel="noreferrer">{item.anchor}</a><small>{item.reason}</small></span><button type="button" className="ghost sm" onClick={() => insertSeoInternalLink(item)}>إدراج الرابط</button></div>)}</div></details>}
            {seoProposal.siteRecommendations.length > 0 && <details><summary>تحسينات على مستوى الموقع</summary><ul>{seoProposal.siteRecommendations.map((item) => <li key={item}>{item}</li>)}</ul></details>}
          </section>}
        </section>
        {selected && <section className="aa9-history-grid">
          <details className="aa9-card" open><summary>المراجعات ({versions.length})</summary>{versions.length === 0 ? <p>لا توجد مراجعات سابقة.</p> : versions.slice(0, 10).map((version) => <div className="aa9-history-row" key={version.id}><span><strong>الإصدار {version.version}</strong><small>{version.createdBy} · {formatDate(version.createdAt)}</small></span><button type="button" className="ghost sm" onClick={() => void restoreVersion(version)}>استعادة</button></div>)}</details>
          <details className="aa9-card"><summary>سجل النشاط ({audit.length})</summary>{audit.slice(0, 12).map((event) => <div className="aa9-history-row" key={event.id}><span><strong dir="ltr">{event.eventType}</strong><small>{event.actorId} · {formatDate(event.createdAt)}</small></span></div>)}</details>
          <details className="aa9-card aa9-advanced"><summary>بيانات الأرشيف المتقدمة</summary><p>قراءة فقط للحفاظ على هوية وبيانات WordPress التاريخية.</p><pre dir="ltr">{JSON.stringify({ sourceMeta: editor.baseSourceMeta, originalWpId: editor.basePayload.originalWpId, legacyUrl: editor.basePayload.legacyUrl }, null, 2)}</pre></details>
        </section>}
      </main>
      <aside className="aa9-sidebar">
        <section className="aa9-card aa9-publish"><h2>النشر</h2><div className="aa9-publish-state"><span>الحالة</span><strong className={statusClass(selected?.status || editor.status)}>{STATUS_LABELS[selected?.status || editor.status]}</strong></div><div className={review.blockingIssues.length ? "aa9-publish-gate fail" : "aa9-publish-gate pass"}><strong>{review.blockingIssues.length ? "متطلبات نشر ناقصة" : "جاهز لبوابة النشر"}</strong>{review.blockingIssues.length ? <ul>{review.blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <small>العنوان والمحتوى والتصنيف والرابط الدائم صالحة للنشر.</small>}</div><label><span>الكاتب</span><select value={editor.authorName} onChange={(event) => patchEditor({ authorName: event.target.value })}><option value="">اختر الكاتب</option>{editor.authorName && !authors.some((author) => author.name === editor.authorName) ? <option value={editor.authorName}>{editor.authorName} (كاتب محفوظ)</option> : null}{authors.map((author) => <option key={author.id || author.email} value={author.name}>{author.name}{author.email ? ` — ${author.email}` : ""}</option>)}</select></label><small>{dirty ? "● تغييرات غير محفوظة · " + (autosaveState === "saving" ? "جارٍ الحفظ على الخادم" : autosaveState === "saved" ? "حفظ تلقائي على الخادم " + (autosaveAt ? formatDate(autosaveAt) : "") : autosaveState === "error" ? "تعذر الحفظ التلقائي على الخادم" : "بانتظار الحفظ التلقائي") : selected ? "آخر تعديل: " + formatDate(selected.updatedAt) : "مسودة جديدة"}</small>
          {conflictItem && <div className="aa9-publish-gate fail"><strong>تعارض تحرير</strong><small>الإصدار على الخادم أصبح {conflictItem.version} بينما المحرر مبني على {selected?.version || "—"}.</small><div className="aa9-side-actions"><button type="button" className="ghost" onClick={loadConflictFromServer}>تحميل نسخة الخادم</button><button type="button" className="ghost danger" disabled={saving} onClick={() => void overwriteConflict()}>استبدال نسخة الخادم بنسختي</button></div></div>}
          <div className="aa9-side-actions"><button type="button" className="ghost" disabled={saving} onClick={previewDraft}>معاينة</button><button type="button" className="ghost" disabled={saving || !dirty} onClick={() => void saveArticle()}>{selected?.status === "PUBLISHED" ? "تحديث المنشور" : "حفظ"}</button>{selected?.status === "PUBLISHED" ? <button type="button" className="ghost" disabled={saving} onClick={() => void lifecycle("unpublish")}>إلغاء النشر</button> : <button type="button" className="accent" disabled={saving} onClick={() => void lifecycle("publish")}>نشر</button>}{selected && selected.status !== "ARCHIVED" && <button type="button" className="ghost danger" disabled={saving} onClick={() => void lifecycle("archive")}>أرشفة</button>}{selected?.status === "ARCHIVED" && <button type="button" className="ghost" disabled={saving} onClick={() => void lifecycle("restore")}>استعادة</button>}</div>
        </section>
        <section className="aa9-card"><h2>الصورة البارزة</h2>{editor.featuredImage ? <img className="aa9-featured" src={editor.featuredImage} alt="" /> : <div className="aa9-featured-empty">لا توجد صورة بارزة</div>}<button type="button" className="ghost" onClick={() => setView("media")}>اختيار من مكتبة الوسائط</button><label className="ghost aa9-file-button">رفع صورة<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={mediaBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file, true); event.currentTarget.value = ""; }} /></label>{editor.featuredImage && <button type="button" className="ghost danger" onClick={() => patchEditor({ featuredImage: "" })}>إزالة</button>}</section>
        <section className="aa9-card"><h2>التصنيفات</h2><div className="aa9-checks">{categories.filter((item) => item.status !== "ARCHIVED").map((item) => <label key={item.publicId}><input type="checkbox" checked={editor.categoryIds.includes(item.publicId)} onChange={() => toggleTerm("categoryIds", item.publicId)} /><span>{item.title}</span></label>)}</div><label><span>التصنيف الأساسي للرابط</span><select value={editor.primaryCategoryId} onChange={(event) => patchEditor({ primaryCategoryId: event.target.value })}><option value="">تلقائي</option>{categories.filter((item) => item.status !== "ARCHIVED" && editor.categoryIds.includes(item.publicId)).map((item) => <option key={item.publicId} value={item.publicId}>{item.title}</option>)}</select></label><div className="aa9-quick-create"><input value={taxonomyName} onChange={(event) => setTaxonomyName(event.target.value)} placeholder="تصنيف جديد" /><button type="button" className="ghost sm" disabled={!taxonomyName.trim()} onClick={() => void createTaxonomy("article-categories", true)}>+ إضافة</button></div><button type="button" className="aa9-text-button" onClick={() => { setTaxonomyName(""); setView("categories"); }}>إدارة التصنيفات</button></section>
        <section className="aa9-card"><h2>الوسوم</h2><div className="aa9-checks aa9-tag-checks">{tags.filter((item) => item.status !== "ARCHIVED").map((item) => <label key={item.publicId}><input type="checkbox" checked={editor.tagIds.includes(item.publicId)} onChange={() => toggleTerm("tagIds", item.publicId)} /><span>{item.title}</span></label>)}</div><button type="button" className="aa9-text-button" onClick={() => { setTaxonomyName(""); setView("tags"); }}>+ إضافة / إدارة الوسوم</button></section>
      </aside></div>
    </section>;
  }

  const navItems: Array<{ id: Exclude<WorkspaceView, "editor">; label: string; icon: string }> = [
    { id: "articles", label: "كل المقالات", icon: "document" },
    { id: "seo", label: "لوحة SEO", icon: "search" },
    { id: "categories", label: "التصنيفات", icon: "folder" },
    { id: "tags", label: "الوسوم", icon: "bookmark" },
    { id: "media", label: "مكتبة الوسائط", icon: "upload" },
  ];
  return <section className="aa9-workspace" dir="rtl" data-article-cms-v2="authority-9d72">
    <header className="aa9-header"><div><span className="eyebrow">موطني Ops / CMS & Knowledge</span><h1>المقالات والأرشيف</h1><p>نشر وتحرير احترافي للمقالات مع التصنيفات والوسائط والمراجعات وتحسين محركات البحث.</p></div><button type="button" className="accent" onClick={() => void beginCreate()}><AdminFluentIcon name="add" /> مقال جديد</button></header>
    <nav className="aa9-nav" aria-label="إدارة المقالات">{navItems.map((item) => <button type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setError(""); setNotice(""); }}><AdminFluentIcon name={item.icon} /> {item.label}</button>)}<button type="button" className={view === "editor" ? "active" : ""} onClick={() => { if (selected || dirty) setView("editor"); else void beginCreate(); }}><AdminFluentIcon name="edit" /> المحرر</button></nav>
    {error && <div className="aa9-alert aa9-alert--error" role="alert">{error}</div>}
    {notice && <output className="aa9-alert aa9-alert--success">{notice}</output>}
    {view === "articles" && renderArticles()}
    {view === "seo" && renderSeoDashboard()}
    {(view === "categories" || view === "tags") && renderTaxonomy()}
    {view === "media" && renderMedia()}
    {view === "editor" && renderEditor()}
  </section>;
}
