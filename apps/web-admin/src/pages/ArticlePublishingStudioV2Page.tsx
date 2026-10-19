import { useEffect, useMemo, useRef, useState } from "react";
import { AdminFluentIcon } from "../components/AdminFluentIcon";
import {
  createCmsGenericEntity,
  getAdminErrorMessage,
  getApiUrl,
  getCmsGenericAudit,
  getCmsGenericEntities,
  getCmsGenericEntity,
  getCmsGenericVersions,
  replaceCmsGenericRelationships,
  rollbackCmsGenericEntity,
  runCmsGenericAction,
  runCmsGenericBulkArchive,
  updateCmsGenericEntity,
  uploadArticleMedia,
  type CmsAuditEvent,
  type CmsEntityVersion,
  type CmsGenericItem,
  type CmsStatus,
} from "../lib/api";
import {
  articlePayload, editorFromItem, emptyEditor, fileToBase64, FILTER_STATUSES, formatDate,
  mediaKind, newPublicId, PAGE_SIZE, seoScore, slugify, STATUS_LABELS, textValue,
  type ArticleEditor, type EditorMode, type WorkspaceView,
} from "./article-cms-v2-model";
import "../article-cms-v2.css";
function absoluteMediaUrl(path: string): string {
  if (/^https?:\/\//iu.test(path)) return path;
  const base = getApiUrl().replace(/\/+$/u, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function mediaPreviewUrl(item: CmsGenericItem): string {
  const value = textValue(item.payload.url);
  return value ? absoluteMediaUrl(value) : "";
}

function statusClass(status: CmsStatus): string {
  return `apv2-status apv2-status--${status.toLowerCase().replace("_", "-")}`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function ArticlePublishingStudioV2Page() {
  const [view, setView] = useState<WorkspaceView>("articles");
  const [articles, setArticles] = useState<CmsGenericItem[]>([]);
  const [categories, setCategories] = useState<CmsGenericItem[]>([]);
  const [tags, setTags] = useState<CmsGenericItem[]>([]);
  const [media, setMedia] = useState<CmsGenericItem[]>([]);
  const [legacyMedia, setLegacyMedia] = useState<Array<{ url: string; title: string }>>([]);
  const [editor, setEditor] = useState<ArticleEditor>(emptyEditor());
  const [selected, setSelected] = useState<CmsGenericItem | null>(null);
  const [versions, setVersions] = useState<CmsEntityVersion[]>([]);
  const [audit, setAudit] = useState<CmsAuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CmsStatus | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Partial<Record<CmsStatus, number>>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [taxonomyName, setTaxonomyName] = useState("");
  const [taxonomyParent, setTaxonomyParent] = useState("");
  const [mediaAlt, setMediaAlt] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const visualRef = useRef<HTMLDivElement | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const review = useMemo(() => seoScore(editor), [editor]);

  function patchEditor(patch: Partial<ArticleEditor>): void {
    setEditor((current) => ({ ...current, ...patch }));
    setDirty(true);
    setNotice("");
  }

  function beginCreate(): void {
    if (dirty && !globalThis.confirm("هناك تغييرات غير محفوظة. هل تريد إنشاء مقال جديد؟")) return;
    setSelected(null); setVersions([]); setAudit([]); setEditor(emptyEditor()); setEditorMode("visual");
    setDirty(false); setError(""); setNotice(""); setView("editor");
  }
  async function loadLibraries(): Promise<void> {
    const [categoryData, tagData, mediaData, archiveA, archiveB] = await Promise.all([
      getCmsGenericEntities("article-categories", { page: 1, pageSize: 100 }),
      getCmsGenericEntities("article-tags", { page: 1, pageSize: 100 }),
      getCmsGenericEntities("article-media", { page: 1, pageSize: 100 }),
      getCmsGenericEntities("articles", { page: 1, pageSize: 100 }),
      getCmsGenericEntities("articles", { page: 2, pageSize: 100 }),
    ]);
    setCategories(categoryData.items);
    setTags(tagData.items);
    setMedia(mediaData.items);
    const seen = new Set<string>();
    setLegacyMedia([...archiveA.items, ...archiveB.items].flatMap((item) => {
      const url = textValue(item.payload.featuredImage);
      if (!url || seen.has(url)) return [];
      seen.add(url);
      return [{ url, title: item.title }];
    }));
  }

  async function loadArticles(): Promise<void> {
    setLoading(true);
    try {
      const response = await getCmsGenericEntities("articles", { q: query, status: status || undefined, page, pageSize: PAGE_SIZE });
      setArticles(response.items); setTotal(response.total); setStatusCounts(response.statusCounts); setSelectedIds([]); setError("");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تحميل المقالات."));
    } finally { setLoading(false); }
  }
  useEffect(() => { void loadArticles(); }, [page, query, status]);
  useEffect(() => { void loadLibraries().catch((reason: unknown) => setError(getAdminErrorMessage(reason, "تعذر تحميل التصنيفات أو الوسائط."))); }, []);
  useEffect(() => {
    if (editorMode === "visual" && visualRef.current && visualRef.current.innerHTML !== editor.bodyHtml) {
      visualRef.current.innerHTML = editor.bodyHtml;
    }
  }, [editor.id, editor.bodyHtml, editorMode]);
  useEffect(() => {
    if (view !== "editor" || !dirty) return;
    const handle = globalThis.setTimeout(() => {
      localStorage.setItem(`watany_article_draft_${editor.id || "new"}`, JSON.stringify({ savedAt: new Date().toISOString(), editor }));
    }, 900);
    return () => globalThis.clearTimeout(handle);
  }, [dirty, editor, view]);

  async function openArticle(item: CmsGenericItem): Promise<void> {
    if (dirty && !globalThis.confirm("هناك تغييرات غير محفوظة. هل تريد فتح مقال آخر؟")) return;
    setSaving(true); setError("");
    try {
      const [detail, nextVersions, nextAudit] = await Promise.all([
        getCmsGenericEntity("articles", item.publicId), getCmsGenericVersions("articles", item.publicId), getCmsGenericAudit("articles", item.publicId),
      ]);
      setSelected(detail); setEditor(editorFromItem(detail, categories, tags)); setVersions(nextVersions); setAudit(nextAudit);
      setDirty(false); setEditorMode("visual"); setView("editor");
    } catch (reason: unknown) { setError(getAdminErrorMessage(reason, "تعذر فتح المقال.")); }
    finally { setSaving(false); }
  }
  async function saveArticle(): Promise<CmsGenericItem | null> {
    const title = editor.title.trim();
    if (!title) { setError("عنوان المقال مطلوب."); return null; }
    const slug = (editor.slug || slugify(title)).trim();
    if (!slug) { setError("أدخل رابطاً مختصراً صالحاً."); return null; }
    setSaving(true); setError(""); setNotice("");
    try {
      const next = { ...editor, slug };
      const payload = articlePayload(next, categories, tags);
      const sourceMeta = { ...next.baseSourceMeta, editorOwner: "ARTICLE_CMS_V2", lastEditorialSaveAt: new Date().toISOString() };
      const saved = selected
        ? await updateCmsGenericEntity("articles", selected.publicId, { title, publicCode: slug, payload, sourceMeta })
        : await createCmsGenericEntity("articles", { publicId: newPublicId("article"), title, publicCode: slug, locale: "ar-LB", status: "DRAFT", payload, sourceMeta });
      await Promise.all([
        replaceCmsGenericRelationships("articles", saved.publicId, "category", next.categoryIds.map((targetPublicId) => ({ targetDomain: "article-categories", targetPublicId }))),
        replaceCmsGenericRelationships("articles", saved.publicId, "tag", next.tagIds.map((targetPublicId) => ({ targetDomain: "article-tags", targetPublicId }))),
      ]);
      const detail = await getCmsGenericEntity("articles", saved.publicId);
      setSelected(detail); setEditor(editorFromItem(detail, categories, tags));
      setVersions(await getCmsGenericVersions("articles", detail.publicId)); setAudit(await getCmsGenericAudit("articles", detail.publicId));
      localStorage.removeItem(`watany_article_draft_${editor.id || "new"}`);
      setDirty(false); setNotice("تم حفظ المقال والتصنيفات والوسوم."); void loadArticles();
      return detail;
    } catch (reason: unknown) { setError(getAdminErrorMessage(reason, "تعذر حفظ المقال.")); return null; }
    finally { setSaving(false); }
  }
  async function lifecycle(action: "publish" | "unpublish" | "archive" | "restore"): Promise<void> {
    if (action === "archive" && !globalThis.confirm("هل تريد أرشفة هذا المقال؟")) return;
    let target = selected;
    if (dirty || !target) target = await saveArticle();
    if (!target) return;
    setSaving(true); setError("");
    try {
      const updated = await runCmsGenericAction("articles", target.publicId, action);
      const detail = await getCmsGenericEntity("articles", updated.publicId);
      setSelected(detail); setEditor(editorFromItem(detail, categories, tags));
      setVersions(await getCmsGenericVersions("articles", detail.publicId)); setAudit(await getCmsGenericAudit("articles", detail.publicId));
      setDirty(false);
      setNotice(action === "publish" ? "تم نشر المقال." : action === "unpublish" ? "تم إلغاء النشر." : action === "archive" ? "تمت الأرشفة." : "تمت الاستعادة.");
      void loadArticles();
    } catch (reason: unknown) { setError(getAdminErrorMessage(reason, "تعذر تحديث حالة المقال.")); }
    finally { setSaving(false); }
  }

  async function restoreVersion(version: CmsEntityVersion): Promise<void> {
    if (!selected || !globalThis.confirm(`استعادة الإصدار ${version.version}؟`)) return;
    setSaving(true);
    try {
      const restored = await rollbackCmsGenericEntity("articles", selected.publicId, version.id);
      const detail = await getCmsGenericEntity("articles", restored.publicId);
      setSelected(detail); setEditor(editorFromItem(detail, categories, tags));
      setVersions(await getCmsGenericVersions("articles", detail.publicId)); setAudit(await getCmsGenericAudit("articles", detail.publicId));
      setDirty(false); setNotice(`تمت استعادة الإصدار ${version.version}.`);
    } catch (reason: unknown) { setError(getAdminErrorMessage(reason, "تعذر استعادة الإصدار.")); }
    finally { setSaving(false); }
  }
  async function createTaxonomy(domain: "article-categories" | "article-tags"): Promise<void> {
    const title = taxonomyName.trim();
    if (!title) return;
    setSaving(true); setError("");
    try {
      const item = await createCmsGenericEntity(domain, {
        publicId: newPublicId(domain === "article-categories" ? "category" : "tag"), title,
        publicCode: slugify(title), locale: "ar-LB", status: "PUBLISHED",
        payload: domain === "article-categories" ? { parentId: taxonomyParent || null } : {},
        sourceMeta: { editorOwner: "ARTICLE_CMS_V2" },
      });
      if (domain === "article-categories" && taxonomyParent) {
        await replaceCmsGenericRelationships(domain, item.publicId, "parent", [{ targetDomain: "article-categories", targetPublicId: taxonomyParent }]);
      }
      setTaxonomyName(""); setTaxonomyParent(""); await loadLibraries();
      setNotice(domain === "article-categories" ? "تم إنشاء التصنيف." : "تم إنشاء الوسم.");
    } catch (reason: unknown) { setError(getAdminErrorMessage(reason, "تعذر إنشاء العنصر.")); }
    finally { setSaving(false); }
  }

  async function renameTaxonomy(domain: "article-categories" | "article-tags", item: CmsGenericItem): Promise<void> {
    const next = globalThis.prompt("الاسم الجديد", item.title)?.trim();
    if (!next || next === item.title) return;
    try { await updateCmsGenericEntity(domain, item.publicId, { title: next, publicCode: slugify(next) }); await loadLibraries(); }
    catch (reason: unknown) { setError(getAdminErrorMessage(reason, "تعذر تعديل العنصر.")); }
  }
  async function archiveTaxonomy(domain: "article-categories" | "article-tags", item: CmsGenericItem): Promise<void> {
    if (!globalThis.confirm(`أرشفة «${item.title}»؟`)) return;
    try { await runCmsGenericAction(domain, item.publicId, "archive"); await loadLibraries(); }
    catch (reason: unknown) { setError(getAdminErrorMessage(reason, "تعذر أرشفة العنصر.")); }
  }

  async function uploadMedia(file: File, useAsFeatured = false): Promise<CmsGenericItem | null> {
    setMediaBusy(true); setError("");
    try {
      const result = await uploadArticleMedia({
        name: file.name, mimeType: file.type, dataBase64: await fileToBase64(file), altText: mediaAlt, caption: mediaCaption,
      });
      const absolute = absoluteMediaUrl(result.asset.url);
      const normalized = { ...result.item, payload: { ...result.item.payload, url: absolute } };
      setMedia((current) => [normalized, ...current.filter((item) => item.publicId !== normalized.publicId)]);
      if (useAsFeatured && result.asset.mimeType.startsWith("image/")) patchEditor({ featuredImage: absolute, ogImage: editor.ogImage || absolute });
      setNotice("تم رفع الملف إلى مكتبة الوسائط.");
      return normalized;
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر رفع الملف. الصور والفيديو وPDF فقط حتى 25MB."));
      return null;
    } finally { setMediaBusy(false); }
  }
  function execEditor(command: string, value?: string): void {
    visualRef.current?.focus();
    document.execCommand(command, false, value);
    if (visualRef.current) patchEditor({ bodyHtml: visualRef.current.innerHTML });
  }

  function addLink(): void {
    const url = globalThis.prompt("رابط URL")?.trim();
    if (url) execEditor("createLink", url);
  }

  function insertMedia(item: CmsGenericItem): void {
    const url = mediaPreviewUrl(item);
    if (!url) return;
    const kind = mediaKind(item);
    const alt = escapeAttribute(textValue(item.payload.altText));
    const caption = textValue(item.payload.caption);
    const html = kind === "image"
      ? `<figure><img src="${url}" alt="${alt}">${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure><p><br></p>`
      : kind === "video" ? `<video controls preload="metadata" src="${url}"></video><p><br></p>`
        : `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${item.title}</a></p>`;
    setEditorMode("visual");
    globalThis.setTimeout(() => { visualRef.current?.focus(); document.execCommand("insertHTML", false, html); if (visualRef.current) patchEditor({ bodyHtml: visualRef.current.innerHTML }); }, 0);
    setView("editor");
  }
  function previewDraft(): void {
    const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>${escapeAttribute(editor.title)}</title><body style="max-width:900px;margin:40px auto;font-family:Arial;line-height:1.9">${editor.featuredImage ? `<img src="${editor.featuredImage}" style="max-width:100%">` : ""}<h1>${editor.title}</h1>${editor.bodyHtml}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    globalThis.open(url, "_blank", "noopener,noreferrer");
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function bulkArchive(): Promise<void> {
    if (!selectedIds.length || !globalThis.confirm(`أرشفة ${selectedIds.length} مقالات؟`)) return;
    setSaving(true);
    try { await runCmsGenericBulkArchive("articles", selectedIds); setSelectedIds([]); await loadArticles(); setNotice("تمت أرشفة المقالات المحددة."); }
    catch (reason: unknown) { setError(getAdminErrorMessage(reason, "تعذر تنفيذ الإجراء الجماعي.")); }
    finally { setSaving(false); }
  }

  function toggleTaxonomy(field: "categoryIds" | "tagIds", id: string): void {
    const current = editor[field];
    patchEditor({ [field]: current.includes(id) ? current.filter((value) => value !== id) : [...current, id] } as Pick<ArticleEditor, typeof field>);
  }

  const activeTaxonomy = view === "categories" ? categories : tags;
  const activeTaxonomyDomain: "article-categories" | "article-tags" = view === "categories" ? "article-categories" : "article-tags";
  function renderArticleRow(item: CmsGenericItem) {
    const image = textValue(item.payload.featuredImage);
    const rowCategories = Array.isArray(item.payload.categories) ? item.payload.categories.filter((value): value is string => typeof value === "string") : [];
    const seoReady = Boolean(textValue(item.payload.seoTitle) && textValue(item.payload.seoDescription));
    return <tr key={item.publicId}>
      <td><input type="checkbox" checked={selectedIds.includes(item.publicId)} onChange={() => setSelectedIds((current) => current.includes(item.publicId) ? current.filter((id) => id !== item.publicId) : [...current, item.publicId])} /></td>
      <td><button type="button" className="apv2-title-link" onClick={() => void openArticle(item)}>{image ? <img src={image} alt="" /> : <span className="apv2-thumb"><AdminFluentIcon name="document" /></span>}<span><strong>{item.title}</strong><small dir="ltr">/{item.publicCode || item.publicId}</small></span></button></td>
      <td>{textValue(item.payload.authorName) || "—"}</td>
      <td><div className="apv2-chips">{rowCategories.slice(0, 3).map((name) => <span key={name}>{name}</span>)}{rowCategories.length > 3 && <span>+{rowCategories.length - 3}</span>}</div></td>
      <td><span className={statusClass(item.status)}>{STATUS_LABELS[item.status]}</span></td>
      <td><span className={`apv2-seo-state ${seoReady ? "good" : "warn"}`}>{seoReady ? "جاهز" : "ناقص"}</span></td>
      <td>{formatDate(item.updatedAt)}</td>
      <td><button type="button" className="ghost sm" onClick={() => void openArticle(item)}>تحرير</button></td>
    </tr>;
  }
  function renderDashboard() {
    return <section className="apv2-panel">
      <div className="apv2-metrics"><div><span>الإجمالي</span><strong>{total}</strong></div>{FILTER_STATUSES.map((value) => <div key={value}><span>{STATUS_LABELS[value]}</span><strong>{statusCounts[value] ?? 0}</strong></div>)}</div>
      <div className="apv2-filters">
        <label><span>بحث</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="العنوان، المعرف أو المحتوى" /></label>
        <label><span>الحالة</span><select value={status} onChange={(event) => { setStatus(event.target.value as CmsStatus | ""); setPage(1); }}><option value="">كل الحالات</option>{FILTER_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label>
        <button type="button" className="ghost" onClick={() => void loadArticles()}><AdminFluentIcon name="refresh" /> تحديث</button>
        {selectedIds.length > 0 && <button type="button" className="ghost danger" disabled={saving} onClick={() => void bulkArchive()}>أرشفة المحدد ({selectedIds.length})</button>}
      </div>
      {loading ? <p className="page-loading">جار تحميل المقالات...</p> : articles.length === 0 ? <div className="apv2-empty">لا توجد مقالات مطابقة.</div> : <div className="apv2-table-wrap"><table className="apv2-table"><thead><tr><th><input type="checkbox" aria-label="اختيار الصفحة" checked={articles.length > 0 && articles.every((row) => selectedIds.includes(row.publicId))} onChange={() => setSelectedIds(articles.every((row) => selectedIds.includes(row.publicId)) ? [] : articles.map((row) => row.publicId))} /></th><th>المقال</th><th>الكاتب</th><th>التصنيفات</th><th>الحالة</th><th>SEO</th><th>آخر تحديث</th><th></th></tr></thead><tbody>{articles.map(renderArticleRow)}</tbody></table></div>}
      <div className="apv2-pagination"><button type="button" className="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</button><span>صفحة {page} من {totalPages}</span><button type="button" className="ghost" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>التالي</button></div>
    </section>;
  }
  function renderTaxonomy() {
    const isCategory = view === "categories";
    return <section className="apv2-panel apv2-taxonomy-layout">
      <form className="apv2-taxonomy-create" onSubmit={(event) => { event.preventDefault(); void createTaxonomy(activeTaxonomyDomain); }}>
        <h3>{isCategory ? "إضافة تصنيف جديد" : "إضافة وسم جديد"}</h3>
        <label><span>الاسم</span><input value={taxonomyName} onChange={(event) => setTaxonomyName(event.target.value)} /></label>
        {isCategory && <label><span>التصنيف الأب</span><select value={taxonomyParent} onChange={(event) => setTaxonomyParent(event.target.value)}><option value="">بدون تصنيف أب</option>{categories.filter((item) => item.status !== "ARCHIVED").map((item) => <option key={item.publicId} value={item.publicId}>{item.title}</option>)}</select></label>}
        <button type="submit" className="accent" disabled={saving || !taxonomyName.trim()}><AdminFluentIcon name="add" /> إضافة</button>
      </form>
      <div className="apv2-taxonomy-list"><div className="apv2-section-title"><h3>{isCategory ? "التصنيفات" : "الوسوم"}</h3><span>{activeTaxonomy.length} عنصر</span></div><table className="apv2-table"><thead><tr><th>الاسم</th><th>Slug</th><th>الحالة</th>{isCategory && <th>الأب</th>}<th>إجراءات</th></tr></thead><tbody>
        {activeTaxonomy.map((item) => <tr key={item.publicId}><td><strong>{item.title}</strong></td><td dir="ltr">{item.publicCode || "—"}</td><td><span className={statusClass(item.status)}>{STATUS_LABELS[item.status]}</span></td>{isCategory && <td>{categories.find((candidate) => candidate.publicId === textValue(item.payload.parentId))?.title || "—"}</td>}<td><button type="button" className="ghost sm" onClick={() => void renameTaxonomy(activeTaxonomyDomain, item)}>تعديل</button>{item.status !== "ARCHIVED" && <button type="button" className="ghost sm danger" onClick={() => void archiveTaxonomy(activeTaxonomyDomain, item)}>أرشفة</button>}</td></tr>)}
      </tbody></table></div>
    </section>;
  }
  function renderMediaCard(item: CmsGenericItem) {
    const url = mediaPreviewUrl(item);
    const kind = mediaKind(item);
    return <article className="apv2-media-card" key={item.publicId}>
      <div className="apv2-media-preview">{kind === "image" ? <img src={url} alt={textValue(item.payload.altText)} loading="lazy" /> : kind === "video" ? <video src={url} controls preload="metadata" /> : <span><AdminFluentIcon name="document" /><b>{kind === "pdf" ? "PDF" : "FILE"}</b></span>}</div>
      <strong>{item.title}</strong><small>{textValue(item.payload.mimeType)} · {Math.ceil(Number(item.payload.size || 0) / 1024)} KB</small>
      <div className="apv2-row-actions">{kind === "image" && <button type="button" className="ghost sm" onClick={() => { patchEditor({ featuredImage: url, ogImage: editor.ogImage || url }); setView("editor"); }}>صورة بارزة</button>}<button type="button" className="ghost sm" onClick={() => insertMedia(item)}>إدراج بالمقال</button></div>
    </article>;
  }

  function renderMedia() {
    return <section className="apv2-panel"><div className="apv2-section-title"><div><h3>مكتبة الوسائط</h3><p>صور، فيديو وPDF مع نص بديل وتعليقات قابلة لإعادة الاستخدام.</p></div></div>
      <div className="apv2-upload"><label><span>النص البديل</span><input value={mediaAlt} onChange={(event) => setMediaAlt(event.target.value)} /></label><label><span>التعليق</span><input value={mediaCaption} onChange={(event) => setMediaCaption(event.target.value)} /></label><label className="apv2-upload-button"><AdminFluentIcon name="upload" /> {mediaBusy ? "جار الرفع..." : "رفع ملف"}<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf" disabled={mediaBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file); event.currentTarget.value = ""; }} /></label></div>
      <h4>ملفات CMS</h4><div className="apv2-media-grid">{media.map(renderMediaCard)}</div>
      {legacyMedia.length > 0 && <><h4>صور الأرشيف المستوردة</h4><div className="apv2-media-grid">{legacyMedia.map((asset) => <article className="apv2-media-card" key={asset.url}><div className="apv2-media-preview"><img src={asset.url} alt="" /></div><strong>{asset.title}</strong><small>وسائط WordPress التاريخية</small><div className="apv2-row-actions"><button type="button" className="ghost sm" onClick={() => { patchEditor({ featuredImage: asset.url, ogImage: editor.ogImage || asset.url }); setView("editor"); }}>صورة بارزة</button><button type="button" className="ghost sm" onClick={() => { patchEditor({ bodyHtml: `${editor.bodyHtml}<figure><img src="${asset.url}" alt=""></figure>` }); setView("editor"); }}>إدراج</button></div></article>)}</div></>}
    </section>;
  }
  function renderArticles() {
    const allChecked = articles.length > 0 && articles.every((item) => selectedIds.includes(item.publicId));
    return <section className="article-cms-panel">
      <div className="article-cms-metrics">
        <div><span>إجمالي المقالات</span><strong>{total}</strong></div>
        {FILTER_STATUSES.map((value) => <div key={value}><span>{STATUS_LABELS[value]}</span><strong>{statusCounts[value] || 0}</strong></div>)}
      </div>
      <div className="article-cms-toolbar">
        <label><span>بحث</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="ابحث بالعنوان أو الرابط..." /></label>
        <label><span>الحالة</span><select value={status} onChange={(event) => { setStatus(event.target.value as CmsStatus | ""); setPage(1); }}><option value="">كل الحالات</option>{FILTER_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label>
        <button type="button" className="accent" onClick={beginCreate}>+ مقال جديد</button>
        <button type="button" className="ghost danger" disabled={!selectedIds.length || saving} onClick={() => void bulkArchive()}>أرشفة المحدد ({selectedIds.length})</button>
      </div>
      <div className="article-table-wrap"><table className="article-table"><thead><tr><th><input aria-label="تحديد الصفحة" type="checkbox" checked={allChecked} onChange={(event) => setSelectedIds(event.target.checked ? articles.map((item) => item.publicId) : [])} /></th><th>المقال</th><th>الكاتب</th><th>التصنيفات</th><th>الحالة</th><th>SEO</th><th>آخر تعديل</th></tr></thead>
        <tbody>{articles.map((item) => { const payload = item.payload || {}; const image = textValue(payload.featuredImage); const names = Array.isArray(payload.categories) ? payload.categories.filter((v): v is string => typeof v === "string") : []; const seoOk = Boolean(textValue(payload.seoTitle) && textValue(payload.seoDescription)); return <tr key={item.publicId}>
          <td><input aria-label={`تحديد ${item.title}`} type="checkbox" checked={selectedIds.includes(item.publicId)} onChange={() => setSelectedIds((current) => current.includes(item.publicId) ? current.filter((id) => id !== item.publicId) : [...current, item.publicId])} /></td>
          <td><div className="article-cms-v2__title-cell">{image ? <img src={image} alt="" /> : <span className="article-cms-v2__thumb-placeholder"><AdminFluentIcon name="document" /></span>}<div><button type="button" className="article-title-link" onClick={() => void openArticle(item)}>{item.title}</button><small>/articles/{item.publicCode || textValue(payload.slug)}</small></div></div></td>
          <td>{textValue(payload.authorName) || "—"}</td><td>{names.length ? names.join("، ") : "—"}</td><td><span className={statusClass(item.status)}>{STATUS_LABELS[item.status]}</span></td><td><span className={seoOk ? "seo-dot seo-dot--ok" : "seo-dot seo-dot--warn"}>{seoOk ? "جيد" : "ناقص"}</span></td><td>{formatDate(item.updatedAt)}</td>
        </tr>; })}</tbody></table></div>
      {loading && <div className="article-cms-empty">جارٍ تحميل المقالات...</div>}{!loading && !articles.length && <div className="article-cms-empty">لا توجد مقالات مطابقة.</div>}
      <div className="article-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>السابق</button><span>صفحة {page} من {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>التالي</button></div>
    </section>;
  }
  function renderEditor() {
    return <section className="apv2-editor">
      <div className="apv2-editor-head"><button type="button" className="ghost" onClick={() => setView("articles")}>← كل المقالات</button><div className="apv2-editor-head-actions"><button type="button" className="ghost" onClick={previewDraft}>معاينة</button><button type="button" className="ghost" disabled={saving || !dirty} onClick={() => void saveArticle()}>{saving ? "جار الحفظ..." : "حفظ"}</button>{selected?.status === "PUBLISHED" ? <button type="button" className="ghost" onClick={() => void lifecycle("unpublish")}>إلغاء النشر</button> : <button type="button" className="accent" onClick={() => void lifecycle("publish")}>نشر</button>}</div></div>
      <div className="apv2-editor-layout"><main className="apv2-editor-main">
        <label className="apv2-title-field"><span>عنوان المقال</span><input value={editor.title} onChange={(event) => { const title = event.target.value; patchEditor({ title, slug: editor.slug || slugify(title) }); }} placeholder="أدخل عنوان المقال" /></label>
        <label><span>الرابط المختصر</span><div className="apv2-slug"><span dir="ltr">/articles/</span><input dir="ltr" value={editor.slug} onChange={(event) => patchEditor({ slug: slugify(event.target.value) })} /></div></label>
        <label><span>المقتطف</span><textarea rows={3} value={editor.excerpt} onChange={(event) => patchEditor({ excerpt: event.target.value })} placeholder="ملخص قصير للأرشيف ومحركات البحث" /></label>
        <div className="apv2-body-editor"><div className="apv2-mode-tabs"><button type="button" className={editorMode === "visual" ? "active" : ""} onClick={() => setEditorMode("visual")}>مرئي</button><button type="button" className={editorMode === "html" ? "active" : ""} onClick={() => setEditorMode("html")}>HTML</button></div>
          {editorMode === "visual" ? <><div className="apv2-toolbar"><button type="button" onClick={() => execEditor("formatBlock", "h2")}>H2</button><button type="button" onClick={() => execEditor("formatBlock", "h3")}>H3</button><button type="button" onClick={() => execEditor("bold")}><b>B</b></button><button type="button" onClick={() => execEditor("italic")}><i>I</i></button><button type="button" onClick={() => execEditor("underline")}><u>U</u></button><button type="button" onClick={() => execEditor("insertUnorderedList")}>• قائمة</button><button type="button" onClick={() => execEditor("insertOrderedList")}>1. قائمة</button><button type="button" onClick={() => execEditor("formatBlock", "blockquote")}>اقتباس</button><button type="button" onClick={addLink}>رابط</button><button type="button" onClick={() => setView("media")}>+ وسائط</button></div><div ref={visualRef} className="apv2-contenteditable" contentEditable suppressContentEditableWarning onInput={() => { if (visualRef.current) patchEditor({ bodyHtml: visualRef.current.innerHTML }); }} /></> : <textarea className="apv2-html" dir="ltr" rows={24} value={editor.bodyHtml} onChange={(event) => patchEditor({ bodyHtml: event.target.value })} />}
        </div>
        <section className="apv2-seo"><div className="apv2-section-title"><div><h3>تحسين محركات البحث SEO</h3><p>تحكم في نتيجة البحث والمشاركة الاجتماعية.</p></div><strong className={review.score >= 80 ? "good" : review.score >= 55 ? "warn" : "bad"}>{review.score}/100</strong></div>
          <div className="apv2-search-preview"><small>koudama.com › articles › {editor.slug || "article"}</small><h4>{editor.seoTitle || editor.title || "عنوان المقال"}</h4><p>{editor.seoDescription || editor.excerpt || "أضف وصفاً ليظهر في نتيجة البحث."}</p></div>
          <div className="apv2-seo-grid"><label><span>عنوان SEO <small>{editor.seoTitle.length}/60</small></span><input value={editor.seoTitle} onChange={(event) => patchEditor({ seoTitle: event.target.value })} /></label><label><span>العبارة المفتاحية</span><input value={editor.focusKeyphrase} onChange={(event) => patchEditor({ focusKeyphrase: event.target.value })} /></label><label className="wide"><span>وصف Meta <small>{editor.seoDescription.length}/160</small></span><textarea rows={3} value={editor.seoDescription} onChange={(event) => patchEditor({ seoDescription: event.target.value })} /></label><label className="wide"><span>Canonical URL</span><input dir="ltr" value={editor.canonicalUrl} onChange={(event) => patchEditor({ canonicalUrl: event.target.value })} /></label><label><span>Robots</span><select value={editor.robots} onChange={(event) => patchEditor({ robots: event.target.value })}><option value="index,follow">index, follow</option><option value="noindex,follow">noindex, follow</option><option value="noindex,nofollow">noindex, nofollow</option></select></label><label><span>عنوان المشاركة</span><input value={editor.ogTitle} onChange={(event) => patchEditor({ ogTitle: event.target.value })} /></label><label className="wide"><span>وصف المشاركة</span><textarea rows={2} value={editor.ogDescription} onChange={(event) => patchEditor({ ogDescription: event.target.value })} /></label><label className="wide"><span>صورة المشاركة</span><input dir="ltr" value={editor.ogImage} onChange={(event) => patchEditor({ ogImage: event.target.value })} /></label></div>
          {review.notes.length > 0 ? <ul className="apv2-seo-notes">{review.notes.map((note) => <li key={note}>{note}</li>)}</ul> : <p className="apv2-seo-pass">فحوص SEO الأساسية مكتملة.</p>}
        </section>
  function renderTaxonomy() {
    const isCategory = activeTaxonomyDomain === "article-categories";
    return <section className="article-cms-v2__taxonomy">
      <div className="article-cms-v2__taxonomy-create">
        <div><h2>{isCategory ? "إضافة تصنيف" : "إضافة وسم"}</h2><p className="muted">أنشئ العنصر من دون مغادرة مساحة النشر.</p></div>
        <label><span>الاسم</span><input value={taxonomyName} onChange={(event) => setTaxonomyName(event.target.value)} placeholder={isCategory ? "اسم التصنيف" : "اسم الوسم"} /></label>
        {isCategory && <label><span>التصنيف الأب</span><select value={taxonomyParent} onChange={(event) => setTaxonomyParent(event.target.value)}><option value="">بدون أب</option>{categories.filter((item) => item.status !== "ARCHIVED").map((item) => <option key={item.publicId} value={item.publicId}>{item.title}</option>)}</select></label>}
        <button type="button" className="primary" disabled={saving || !taxonomyName.trim()} onClick={() => void createTaxonomy(activeTaxonomyDomain)}>{saving ? "جارٍ الحفظ..." : "إضافة"}</button>
      </div>
      <div className="article-cms-v2__taxonomy-list">
        <div className="article-section-head"><div><h2>{isCategory ? "التصنيفات" : "الوسوم"}</h2><p>{activeTaxonomy.length} عنصر</p></div></div>
        <div className="taxonomy-grid">{activeTaxonomy.map((item) => { const parentId = textValue(item.payload.parentId); const parent = categories.find((candidate) => candidate.publicId === parentId); return <article className="taxonomy-card" key={item.publicId}>
          <strong>{item.title}</strong><span>{item.publicCode || "—"}</span>{isCategory && parent && <span>الأب: {parent.title}</span>}<span>{STATUS_LABELS[item.status]}</span>
          <div className="row-actions"><button type="button" className="secondary small" onClick={() => void renameTaxonomy(activeTaxonomyDomain, item)}>تعديل</button>{item.status !== "ARCHIVED" && <button type="button" className="danger small" onClick={() => void archiveTaxonomy(activeTaxonomyDomain, item)}>أرشفة</button>}</div>
        </article>; })}</div>
      </div>
    </section>;
  }

  function setFeatured(url: string): void {
    patchEditor({ featuredImage: url, ogImage: editor.ogImage || url });
    setView("editor");
  }
        {selected && <section className="apv2-history"><details open><summary>المراجعات ({versions.length})</summary><div className="apv2-history-list">{versions.length === 0 ? <p>لا توجد مراجعات سابقة.</p> : versions.map((version) => <div key={version.id}><span><strong>الإصدار {version.version}</strong><small>{version.createdBy} · {formatDate(version.createdAt)}</small></span><button type="button" className="ghost sm" onClick={() => void restoreVersion(version)}>استعادة</button></div>)}</div></details>
          <details><summary>سجل التدقيق ({audit.length})</summary><div className="apv2-history-list">{audit.map((event) => <div key={event.id}><span><strong dir="ltr">{event.eventType}</strong><small>{event.actorId} · {formatDate(event.createdAt)}</small></span><code dir="ltr">{event.immutableHash?.slice(0, 12) || ""}</code></div>)}</div></details>
          <details><summary>بيانات الأرشيف المتقدمة</summary><p>قراءة فقط. يحافظ المحرر على معرفات WordPress وبيانات المصدر التاريخية.</p><pre dir="ltr">{JSON.stringify({ sourceMeta: editor.baseSourceMeta, originalWpId: editor.basePayload.originalWpId, legacyUrl: editor.basePayload.legacyUrl }, null, 2)}</pre></details>
        </section>}
      </main>
      <aside className="apv2-sidebar">
  function renderMedia() {
    return <section className="article-cms-v2__media">
      <div className="article-cms-v2__media-upload"><div><h2>رفع وسائط</h2><p className="muted">صور، MP4/WebM أو PDF حتى 25MB.</p></div>
        <label><span>النص البديل</span><input value={mediaAlt} onChange={(event) => setMediaAlt(event.target.value)} placeholder="وصف الصورة لإمكانية الوصول وSEO" /></label>
        <label><span>التعليق</span><input value={mediaCaption} onChange={(event) => setMediaCaption(event.target.value)} /></label>
        <label className="article-editor-v2__upload-button">{mediaBusy ? "جارٍ الرفع..." : "اختيار ملف ورفعه"}<input hidden type="file" disabled={mediaBusy} accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file); event.currentTarget.value = ""; }} /></label>
      </div>
      <div className="article-cms-v2__media-library"><div className="article-section-head"><div><h2>مكتبة الوسائط</h2><p>{media.length} ملفات CMS</p></div></div>
        <div className="article-cms-v2__media-grid">{media.map((item) => { const url = mediaPreviewUrl(item); const kind = mediaKind(item); return <article className="article-cms-v2__media-card" key={item.publicId}>
          <div className="article-cms-v2__media-preview">{kind === "image" ? <img src={url} alt={textValue(item.payload.altText)} /> : kind === "video" ? <video src={url} controls preload="metadata" /> : <div className="article-cms-v2__file-icon">PDF</div>}</div>
          <h3>{item.title}</h3><small>{textValue(item.payload.mimeType)} · {Math.ceil(Number(item.payload.size || 0) / 1024)} KB</small>
          <div className="row-actions">{kind === "image" && <button type="button" className="secondary small" onClick={() => setFeatured(url)}>صورة بارزة</button>}<button type="button" className="secondary small" onClick={() => insertMedia(item)}>إدراج في المقال</button></div>
        </article>; })}</div>
      </div>
      {legacyMedia.length > 0 && <div className="article-cms-v2__legacy-media"><div className="article-section-head"><div><h2>وسائط الأرشيف</h2><p>صور WordPress المستوردة والقابلة لإعادة الاستخدام.</p></div></div>
        <div className="article-cms-v2__media-grid">{legacyMedia.map((asset) => <article className="article-cms-v2__media-card" key={asset.url}><div className="article-cms-v2__media-preview"><img src={asset.url} alt="" /></div><h3>{asset.title}</h3><small>وسائط الأرشيف</small><div className="row-actions"><button type="button" className="secondary small" onClick={() => setFeatured(asset.url)}>صورة بارزة</button><button type="button" className="secondary small" onClick={() => { patchEditor({ bodyHtml: `${editor.bodyHtml}<p><img src="${asset.url}" alt=""></p>` }); setView("editor"); }}>إدراج</button></div></article>)}</div>
      </div>}
    </section>;
  }
        <section className="apv2-side-card"><h3>النشر</h3><div className="apv2-publish-state"><span>الحالة</span><strong className={statusClass(selected?.status || editor.status)}>{STATUS_LABELS[selected?.status || editor.status]}</strong></div><label><span>الكاتب</span><input value={editor.authorName} onChange={(event) => patchEditor({ authorName: event.target.value })} /></label><small>{dirty ? "● توجد تغييرات تحفظ محلياً تلقائياً" : `آخر تعديل: ${selected ? formatDate(selected.updatedAt) : "غير محفوظ"}`}</small><div className="apv2-side-actions"><button type="button" className="ghost" disabled={saving} onClick={() => void saveArticle()}>حفظ</button>{selected?.status === "PUBLISHED" ? <button type="button" className="ghost" onClick={() => void lifecycle("unpublish")}>إلغاء النشر</button> : <button type="button" className="accent" onClick={() => void lifecycle("publish")}>نشر</button>}{selected && selected.status !== "ARCHIVED" && <button type="button" className="ghost danger" onClick={() => void lifecycle("archive")}>أرشفة</button>}{selected?.status === "ARCHIVED" && <button type="button" className="ghost" onClick={() => void lifecycle("restore")}>استعادة</button>}</div></section>
        <section className="apv2-side-card"><h3>التصنيفات</h3><div className="apv2-checks">{categories.filter((item) => item.status !== "ARCHIVED").map((item) => <label key={item.publicId}><input type="checkbox" checked={editor.categoryIds.includes(item.publicId)} onChange={() => toggleTaxonomy("categoryIds", item.publicId)} /><span>{item.title}</span></label>)}</div><button type="button" className="ghost sm" onClick={() => setView("categories")}>+ إدارة التصنيفات</button></section>
        <section className="apv2-side-card"><h3>الوسوم</h3><div className="apv2-checks apv2-tag-checks">{tags.filter((item) => item.status !== "ARCHIVED").map((item) => <label key={item.publicId}><input type="checkbox" checked={editor.tagIds.includes(item.publicId)} onChange={() => toggleTaxonomy("tagIds", item.publicId)} /><span>{item.title}</span></label>)}</div><button type="button" className="ghost sm" onClick={() => setView("tags")}>+ إدارة الوسوم</button></section>
        <section className="apv2-side-card"><h3>الصورة البارزة</h3>{editor.featuredImage ? <img className="apv2-featured" src={editor.featuredImage} alt="" /> : <div className="apv2-featured-empty"><AdminFluentIcon name="document" /><span>لا توجد صورة بارزة</span></div>}<input dir="ltr" value={editor.featuredImage} onChange={(event) => patchEditor({ featuredImage: event.target.value })} placeholder="URL أو اختر من المكتبة" /><div className="apv2-side-actions"><button type="button" className="ghost" onClick={() => setView("media")}>اختيار من المكتبة</button><label className="ghost apv2-inline-upload">رفع<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file, true); event.currentTarget.value = ""; }} /></label>{editor.featuredImage && <button type="button" className="ghost danger" onClick={() => patchEditor({ featuredImage: "" })}>إزالة</button>}</div></section>
      </aside></div>
    </section>;
  }
  function renderEditor() {
    return <section className="article-editor-v2">
      <main className="article-editor-v2__main">
        <div className="article-editor-v2__title-row"><input className="article-editor-v2__title" value={editor.title} onChange={(event) => { const title = event.target.value; patchEditor({ title, slug: editor.slug || slugify(title) }); }} placeholder="أدخل عنوان المقال" /><div className="article-editor-v2__slug"><span>/articles/</span><input value={editor.slug} onChange={(event) => patchEditor({ slug: slugify(event.target.value) })} /></div></div>
        <div><div className="article-editor-v2__mode-tabs"><button type="button" className={editorMode === "visual" ? "active" : ""} onClick={() => setEditorMode("visual")}>مرئي</button><button type="button" className={editorMode === "html" ? "active" : ""} onClick={() => setEditorMode("html")}>HTML</button></div>
          {editorMode === "visual" ? <><div className="article-editor-v2__toolbar"><button type="button" onClick={() => execEditor("bold")}><b>B</b></button><button type="button" onClick={() => execEditor("italic")}><i>I</i></button><button type="button" onClick={() => execEditor("formatBlock", "h2")}>H2</button><button type="button" onClick={() => execEditor("formatBlock", "h3")}>H3</button><button type="button" onClick={() => execEditor("insertUnorderedList")}>• قائمة</button><button type="button" onClick={() => execEditor("insertOrderedList")}>1. قائمة</button><button type="button" onClick={addLink}>رابط</button><button type="button" onClick={() => setView("media")}>+ وسائط</button></div><div ref={visualRef} className="article-editor-v2__content" contentEditable suppressContentEditableWarning onInput={() => { if (visualRef.current) patchEditor({ bodyHtml: visualRef.current.innerHTML }); }} dangerouslySetInnerHTML={{ __html: editor.bodyHtml }} /></> : <textarea className="article-editor-v2__html" value={editor.bodyHtml} onChange={(event) => patchEditor({ bodyHtml: event.target.value })} />}
        </div>
        <label className="article-editor-v2__field"><span>المقتطف</span><textarea rows={3} value={editor.excerpt} onChange={(event) => patchEditor({ excerpt: event.target.value })} placeholder="ملخص قصير يظهر في الأرشيف والبحث" /></label>
        <section className="article-editor-v2__seo"><div className="article-editor-v2__section-title"><div><span>تحسين محركات البحث SEO</span><small>النتيجة الحالية للمقال</small></div><strong className={review.score >= 80 ? "score-good" : review.score >= 55 ? "score-mid" : "score-low"}>{review.score}/100</strong></div>
          <div className="article-editor-v2__seo-preview"><span>{editor.canonicalUrl || `/articles/${editor.slug || "article"}`}</span><h3>{editor.seoTitle || editor.title || "عنوان المقال"}</h3><p>{editor.seoDescription || editor.excerpt || "أضف وصفاً لمحركات البحث."}</p></div>
          <div className="article-editor-v2__field-grid"><label><span>عنوان SEO</span><input value={editor.seoTitle} onChange={(event) => patchEditor({ seoTitle: event.target.value })} /><small>{editor.seoTitle.length}/60</small></label><label><span>العبارة المفتاحية</span><input value={editor.focusKeyphrase} onChange={(event) => patchEditor({ focusKeyphrase: event.target.value })} /></label><label className="wide"><span>وصف نتائج البحث</span><textarea rows={3} value={editor.seoDescription} onChange={(event) => patchEditor({ seoDescription: event.target.value })} /><small>{editor.seoDescription.length}/160</small></label>
  let content: JSX.Element;
  if (view === "editor") content = renderEditor();
  else if (view === "categories" || view === "tags") content = renderTaxonomy();
  else if (view === "media") content = renderMedia();
  else content = renderDashboard();

  return <section className="apv2-workspace" dir="rtl" data-article-cms-v2="professional-publishing">
    <header className="apv2-header"><div><span className="eyebrow">موطني Ops / CMS & Knowledge</span><h2>المقالات والأرشيف</h2><p>نشر احترافي للمقالات مع التصنيفات والوسائط والمراجعات وSEO.</p></div><button type="button" className="accent" onClick={beginCreate}><AdminFluentIcon name="add" /> أضف مقالاً جديداً</button></header>
    <nav className="apv2-nav" aria-label="إدارة المقالات"><button type="button" className={view === "articles" ? "active" : ""} onClick={() => setView("articles")}>كل المقالات</button><button type="button" className={view === "editor" ? "active" : ""} onClick={() => selected || dirty ? setView("editor") : beginCreate()}>المحرر</button><button type="button" className={view === "categories" ? "active" : ""} onClick={() => { setTaxonomyName(""); setView("categories"); }}>التصنيفات</button><button type="button" className={view === "tags" ? "active" : ""} onClick={() => { setTaxonomyName(""); setView("tags"); }}>الوسوم</button><button type="button" className={view === "media" ? "active" : ""} onClick={() => setView("media")}>مكتبة الوسائط</button></nav>
    {error && <div className="apv2-alert error" role="alert">{error}</div>}
    {notice && <output className="apv2-alert notice">{notice}</output>}
    {content}
  </section>;
}
            <label><span>Canonical URL</span><input dir="ltr" value={editor.canonicalUrl} onChange={(event) => patchEditor({ canonicalUrl: event.target.value })} /></label><label><span>Robots</span><select value={editor.robots} onChange={(event) => patchEditor({ robots: event.target.value })}><option value="index,follow">index, follow</option><option value="noindex,follow">noindex, follow</option><option value="noindex,nofollow">noindex, nofollow</option></select></label>
            <label><span>OG Title</span><input value={editor.ogTitle} onChange={(event) => patchEditor({ ogTitle: event.target.value })} /></label><label><span>OG Image</span><input dir="ltr" value={editor.ogImage} onChange={(event) => patchEditor({ ogImage: event.target.value })} /></label><label className="wide"><span>OG Description</span><textarea rows={2} value={editor.ogDescription} onChange={(event) => patchEditor({ ogDescription: event.target.value })} /></label></div>
          {review.notes.length ? <ul className="article-editor-v2__seo-notes">{review.notes.map((note) => <li key={note}>{note}</li>)}</ul> : <div className="article-editor-v2__seo-pass">أساسيات SEO مكتملة.</div>}
        </section>
      </main>
      <aside className="article-editor-v2__sidebar">
        <section className="article-editor-v2__box article-editor-v2__publish"><h2>النشر</h2><dl><div><dt>الحالة</dt><dd>{selected ? STATUS_LABELS[selected.status] : "مسودة جديدة"}</dd></div><div><dt>آخر تعديل</dt><dd>{selected ? formatDate(selected.updatedAt) : "—"}</dd></div></dl><span className={dirty ? "article-editor-v2__autosave" : "article-editor-v2__saved"}>{dirty ? "تغييرات غير محفوظة · الحفظ المحلي التلقائي مفعل" : "كل التغييرات محفوظة"}</span>
          <div className="article-editor-v2__publish-actions"><button type="button" className="secondary" disabled={saving} onClick={previewDraft}>معاينة</button><button type="button" className="primary" disabled={saving || !dirty} onClick={() => void saveArticle()}>{saving ? "جارٍ الحفظ..." : "حفظ"}</button>{selected?.status !== "PUBLISHED" && selected?.status !== "ARCHIVED" && <button type="button" className="primary" disabled={saving} onClick={() => void lifecycle("publish")}>نشر</button>}{selected?.status === "PUBLISHED" && <button type="button" className="secondary" disabled={saving} onClick={() => void lifecycle("unpublish")}>إلغاء النشر</button>}{selected?.status !== "ARCHIVED" && selected && <button type="button" className="danger" disabled={saving} onClick={() => void lifecycle("archive")}>أرشفة</button>}{selected?.status === "ARCHIVED" && <button type="button" className="secondary" disabled={saving} onClick={() => void lifecycle("restore")}>استعادة</button>}</div>
        </section>
        <section className="article-editor-v2__box"><h2>التصنيفات</h2><div className="article-editor-v2__checks">{categories.filter((item) => item.status !== "ARCHIVED").map((item) => <label key={item.publicId}><input type="checkbox" checked={editor.categoryIds.includes(item.publicId)} onChange={() => toggleTaxonomy("categoryIds", item.publicId)} /><span>{item.title}</span></label>)}</div><button type="button" className="text-action" onClick={() => { setTaxonomyName(""); setView("categories"); }}>+ إضافة / إدارة التصنيفات</button></section>
        <section className="article-editor-v2__box"><h2>الوسوم</h2><div className="article-editor-v2__checks article-editor-v2__checks--tags">{tags.filter((item) => item.status !== "ARCHIVED").map((item) => <label key={item.publicId}><input type="checkbox" checked={editor.tagIds.includes(item.publicId)} onChange={() => toggleTaxonomy("tagIds", item.publicId)} /><span>{item.title}</span></label>)}</div><button type="button" className="text-action" onClick={() => { setTaxonomyName(""); setView("tags"); }}>+ إضافة / إدارة الوسوم</button></section>
        <section className="article-editor-v2__box"><h2>الصورة البارزة</h2>{editor.featuredImage ? <img className="article-editor-v2__featured" src={editor.featuredImage} alt="" /> : <div className="article-editor-v2__featured-empty"><AdminFluentIcon name="document" /><span>لا توجد صورة بارزة</span></div>}<button type="button" className="secondary" onClick={() => setView("media")}>اختيار من المكتبة</button>{editor.featuredImage && <button type="button" className="text-action danger-text" onClick={() => patchEditor({ featuredImage: "" })}>إزالة الصورة</button>}</section>
        <section className="article-editor-v2__box"><h2>الكاتب</h2><input value={editor.authorName} onChange={(event) => patchEditor({ authorName: event.target.value })} placeholder="اسم الكاتب" /></section>
        {selected && <section className="article-editor-v2__box"><h2>المراجعات</h2><div className="article-editor-v2__history">{versions.slice(0, 8).map((version) => <div key={version.id}><span>الإصدار {version.version}<small>{formatDate(version.createdAt)}</small></span><button type="button" className="text-action" onClick={() => void restoreVersion(version)}>استعادة</button></div>)}</div></section>}
        {selected && <section className="article-editor-v2__box"><h2>سجل النشاط</h2><div className="article-editor-v2__audit">{audit.slice(0, 8).map((event) => <div key={event.id}><span>{event.eventType}<small>{formatDate(event.createdAt)} · {event.actorId}</small></span></div>)}</div></section>}
        {selected && <details className="article-editor-v2__box article-editor-v2__advanced"><summary>بيانات متقدمة</summary><pre>{JSON.stringify({ sourceMeta: selected.sourceMeta, publicId: selected.publicId, sourceId: selected.sourceId }, null, 2)}</pre></details>}
      </aside>
    </section>;
  }

  const navItems: Array<{ id: Exclude<WorkspaceView, "editor">; label: string; icon: string }> = [
    { id: "articles", label: "كل المقالات", icon: "document" }, { id: "categories", label: "التصنيفات", icon: "folder" },
    { id: "tags", label: "الوسوم", icon: "bookmark" }, { id: "media", label: "مكتبة الوسائط", icon: "upload" },
  ];
  return <div className="article-cms-v2" dir="rtl" data-article-cms-v2="professional-publishing">
    <header className="article-cms-v2__header"><div><span className="article-cms-v2__eyebrow">موطني Ops / CMS & Knowledge</span><h1>المقالات والأرشيف</h1><p>مساحة نشر احترافية للمقالات: محرر مرئي، تصنيفات، وسوم، وسائط، مراجعات وتحسين SEO.</p></div><div className="article-cms-v2__header-actions"><button type="button" className="primary" onClick={beginCreate}><AdminFluentIcon name="edit" /> مقال جديد</button></div></header>
    <nav className="article-cms-v2__tabs" aria-label="إدارة المقالات">{navItems.map((item) => <button type="button" key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => { setView(item.id); setError(""); setNotice(""); }}><AdminFluentIcon name={item.icon} /> {item.label}</button>)}{view === "editor" && <button type="button" aria-current="page" onClick={() => setView("editor")}><AdminFluentIcon name="edit" /> المحرر</button>}</nav>
    {error && <div className="article-cms-v2__alert article-cms-v2__alert--error" role="alert">{error}</div>}
    {notice && <div className="article-cms-v2__alert article-cms-v2__alert--success" role="status">{notice}</div>}
    {view === "articles" && renderArticles()}
    {(view === "categories" || view === "tags") && renderTaxonomy()}
    {view === "media" && renderMedia()}
    {view === "editor" && renderEditor()}
  </div>;
}
