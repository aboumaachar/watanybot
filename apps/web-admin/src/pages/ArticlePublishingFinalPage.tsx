import { useEffect, useMemo, useRef, useState } from "react";
import { AdminFluentIcon } from "../components/AdminFluentIcon";
import {
  createCmsGenericEntity, getAdminErrorMessage, getApiUrl, getCmsGenericAudit,
  getCmsGenericEntities, getCmsGenericEntity, getCmsGenericVersions,
  replaceCmsGenericRelationships, rollbackCmsGenericEntity, runCmsGenericAction,
  runCmsGenericBulkArchive, updateCmsGenericEntity, uploadArticleMedia,
  type CmsAuditEvent, type CmsEntityVersion, type CmsGenericItem, type CmsStatus,
} from "../lib/api";
import {
  articlePayload, editorFromItem, emptyEditor, fileToBase64, FILTER_STATUSES,
  formatDate, mediaKind, newPublicId, PAGE_SIZE, seoScore, slugify,
  STATUS_LABELS, textValue, type ArticleEditor, type EditorMode, type WorkspaceView,
} from "./article-cms-v2-model";
import "../article-cms-v2.css";

function mediaUrl(item: CmsGenericItem): string {
  const raw = textValue(item.payload.url);
  if (!raw) return "";
  if (/^https?:\/\//iu.test(raw)) return raw;
  return `${getApiUrl().replace(/\/+$/u, "")}${raw.startsWith("/") ? raw : `/${raw}`}`;
}
  const [taxonomyName, setTaxonomyName] = useState("");
  const [taxonomyParent, setTaxonomyParent] = useState("");
  const [mediaAlt, setMediaAlt] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);

  function patchEditor(patch: Partial<ArticleEditor>): void {
    setEditor((current) => ({ ...current, ...patch }));
    setDirty(true);
    setNotice("");
  }

  async function loadLibraries(): Promise<void> {
    const [categoryData, tagData, mediaData] = await Promise.all([
      getCmsGenericEntities("article-categories", { page: 1, pageSize: 100 }),
      getCmsGenericEntities("article-tags", { page: 1, pageSize: 100 }),
      getCmsGenericEntities("article-media", { page: 1, pageSize: 100 }),
    ]);
    setCategories(categoryData.items);
    setTags(tagData.items);
    setMedia(mediaData.items);
  }

  async function loadArticles(): Promise<void> {
    setLoading(true);
    try {
      const data = await getCmsGenericEntities("articles", {
export default function ArticlePublishingFinalPage() {
  const [view, setView] = useState<WorkspaceView>("articles");
  const [articles, setArticles] = useState<CmsGenericItem[]>([]);
  const [categories, setCategories] = useState<CmsGenericItem[]>([]);
  const [tags, setTags] = useState<CmsGenericItem[]>([]);
  const [media, setMedia] = useState<CmsGenericItem[]>([]);
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
  const [taxonomyName, setTaxonomyName] = useState("");
  const [taxonomyParent, setTaxonomyParent] = useState("");
  const [mediaAlt, setMediaAlt] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
        q: query || undefined, status: status || undefined, page, pageSize: PAGE_SIZE,
      });
      setArticles(data.items);
      setTotal(data.total);
      setStatusCounts(data.statusCounts || {});
      setSelectedIds([]);
      setError("");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تحميل المقالات."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLibraries().catch((reason: unknown) => {
      setError(getAdminErrorMessage(reason, "تعذر تحميل التصنيفات أو الوسائط."));
    });
  }, []);
  useEffect(() => { void loadArticles(); }, [page, query, status]);
  useEffect(() => {
    if (editorMode === "visual" && visualRef.current && visualRef.current.innerHTML !== editor.bodyHtml) {
      visualRef.current.innerHTML = editor.bodyHtml;
    }
  }, [editor.id, editor.bodyHtml, editorMode]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const visualRef = useRef<HTMLDivElement | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const review = useMemo(() => seoScore(editor), [editor]);

  function patchEditor(patch: Partial<ArticleEditor>): void {
    setEditor((current) => ({ ...current, ...patch }));
    setDirty(true);
    setNotice("");
  }

  async function loadLibraries(): Promise<void> {
    const [categoryData, tagData, mediaData] = await Promise.all([
      getCmsGenericEntities("article-categories", { page: 1, pageSize: 100 }),
      getCmsGenericEntities("article-tags", { page: 1, pageSize: 100 }),
      getCmsGenericEntities("article-media", { page: 1, pageSize: 100 }),
    ]);
    setCategories(categoryData.items);
    setTags(tagData.items);
    setMedia(mediaData.items);
  }
  useEffect(() => {
    if (view !== "editor" || !dirty) return;
    const handle = globalThis.setTimeout(() => {
      localStorage.setItem(`watany_article_draft_${editor.id || "new"}`, JSON.stringify({
        savedAt: new Date().toISOString(), editor,
      }));
    }, 900);
    return () => globalThis.clearTimeout(handle);
  }, [dirty, editor, view]);

  function beginCreate(): void {
    if (dirty && !globalThis.confirm("هناك تغييرات غير محفوظة. هل تريد إنشاء مقال جديد؟")) return;
    setSelected(null);
    setEditor(emptyEditor());
    setVersions([]);
    setAudit([]);
    setEditorMode("visual");
    setDirty(false);
    setError("");
    setNotice("");
    setView("editor");
  }

  async function openArticle(item: CmsGenericItem): Promise<void> {
    if (dirty && !globalThis.confirm("هناك تغييرات غير محفوظة. هل تريد فتح مقال آخر؟")) return;
  async function loadArticles(): Promise<void> {
    setLoading(true);
    try {
      const response = await getCmsGenericEntities("articles", {
        q: query, status: status || undefined, page, pageSize: PAGE_SIZE,
      });
      setArticles(response.items);
      setTotal(response.total);
      setStatusCounts(response.statusCounts);
      setSelectedIds([]);
      setError("");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تحميل المقالات."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadArticles(); }, [page, query, status]);
  useEffect(() => {
    void loadLibraries().catch((reason: unknown) => setError(getAdminErrorMessage(reason, "تعذر تحميل التصنيفات أو الوسائط.")));
  }, []);
    setSaving(true);
    setError("");
    try {
      const [detail, nextVersions, nextAudit] = await Promise.all([
        getCmsGenericEntity("articles", item.publicId),
        getCmsGenericVersions("articles", item.publicId),
        getCmsGenericAudit("articles", item.publicId),
      ]);
      setSelected(detail);
      setEditor(editorFromItem(detail, categories, tags));
      setVersions(nextVersions);
      setAudit(nextAudit);
      setEditorMode("visual");
      setDirty(false);
      setView("editor");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر فتح المقال."));
    } finally {
      setSaving(false);
    }
  }

  async function syncRelationships(articleId: string, next: ArticleEditor): Promise<void> {
    await Promise.all([
      replaceCmsGenericRelationships("articles", articleId, "category", next.categoryIds.map((targetPublicId) => ({
        targetDomain: "article-categories", targetPublicId,
      }))),
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

  function beginCreate(): void {
    setSelected(null);
    setVersions([]);
    setAudit([]);
    setEditor(emptyEditor());
    setEditorMode("visual");
    setDirty(false);
    setError("");
    setNotice("");
    setView("editor");
  }
      replaceCmsGenericRelationships("articles", articleId, "tag", next.tagIds.map((targetPublicId) => ({
        targetDomain: "article-tags", targetPublicId,
      }))),
    ]);
  }

  async function saveArticle(): Promise<CmsGenericItem | null> {
    const title = editor.title.trim();
    if (!title) { setError("عنوان المقال مطلوب."); return null; }
    const slug = (editor.slug || slugify(title)).trim();
    if (!slug) { setError("الرابط المختصر مطلوب."); return null; }
    setSaving(true);
    setError("");
    try {
      const next = { ...editor, slug };
      const payload = articlePayload(next, categories, tags);
      const sourceMeta = {
        ...next.baseSourceMeta,
        editorOwner: "ARTICLE_CMS_V2_FINAL",
        lastEditorialSaveAt: new Date().toISOString(),
      };
      const saved = selected
        ? await updateCmsGenericEntity("articles", selected.publicId, {
            title, publicCode: slug, locale: "ar-LB", payload, sourceMeta,
          })
  async function openArticle(item: CmsGenericItem): Promise<void> {
    setSaving(true);
    setError("");
    try {
      const [detail, nextVersions, nextAudit] = await Promise.all([
        getCmsGenericEntity("articles", item.publicId),
        getCmsGenericVersions("articles", item.publicId),
        getCmsGenericAudit("articles", item.publicId),
      ]);
      setSelected(detail);
      setEditor(editorFromItem(detail, categories, tags));
      setVersions(nextVersions);
      setAudit(nextAudit);
      setDirty(false);
      setEditorMode("visual");
      setView("editor");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر فتح المقال."));
    } finally {
      setSaving(false);
    }
  }

  async function saveArticle(): Promise<CmsGenericItem | null> {
        : await createCmsGenericEntity("articles", {
            publicId: newPublicId("article"), title, publicCode: slug, locale: "ar-LB",
            status: "DRAFT", payload, sourceMeta,
          });
      await syncRelationships(saved.publicId, next);
      const detail = await getCmsGenericEntity("articles", saved.publicId);
      setSelected(detail);
      setEditor(editorFromItem(detail, categories, tags));
      setVersions(await getCmsGenericVersions("articles", detail.publicId));
      setAudit(await getCmsGenericAudit("articles", detail.publicId));
      localStorage.removeItem(`watany_article_draft_${editor.id || "new"}`);
      setDirty(false);
      setNotice("تم حفظ المقال والتصنيفات والوسوم.");
      void loadArticles();
      return detail;
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر حفظ المقال."));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function lifecycle(action: "publish" | "unpublish" | "archive" | "restore"): Promise<void> {
    if (action === "archive" && !globalThis.confirm("هل تريد أرشفة هذا المقال؟")) return;
    const title = editor.title.trim();
    const slug = (editor.slug || slugify(title)).trim();
    if (!title) { setError("عنوان المقال مطلوب."); return null; }
    if (!slug) { setError("الرابط المختصر مطلوب."); return null; }
    setSaving(true);
    setError("");
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
      setSelected(detail);
      setEditor(editorFromItem(detail, categories, tags));
      setVersions(await getCmsGenericVersions("articles", detail.publicId));
      setAudit(await getCmsGenericAudit("articles", detail.publicId));
    let target = selected;
    if (dirty || !target) target = await saveArticle();
    if (!target) return;
    setSaving(true);
    setError("");
    try {
      const updated = await runCmsGenericAction("articles", target.publicId, action);
      const detail = await getCmsGenericEntity("articles", updated.publicId);
      setSelected(detail);
      setEditor(editorFromItem(detail, categories, tags));
      setVersions(await getCmsGenericVersions("articles", detail.publicId));
      setAudit(await getCmsGenericAudit("articles", detail.publicId));
      setDirty(false);
      setNotice(action === "publish" ? "تم نشر المقال." : action === "unpublish"
        ? "تم إلغاء النشر." : action === "archive" ? "تمت الأرشفة." : "تمت الاستعادة.");
      void loadArticles();
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تحديث حالة المقال."));
    } finally {
      setSaving(false);
    }
  }

  async function restoreVersion(version: CmsEntityVersion): Promise<void> {
    if (!selected || !globalThis.confirm(`استعادة الإصدار ${version.version}؟`)) return;
      localStorage.removeItem(`watany_article_draft_${editor.id || "new"}`);
      setDirty(false);
      setNotice("تم حفظ المقال والتصنيفات والوسوم.");
      void loadArticles();
      return detail;
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر حفظ المقال."));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function lifecycle(action: "publish" | "unpublish" | "archive" | "restore"): Promise<void> {
    let target = selected;
    if (dirty || !target) target = await saveArticle();
    if (!target) return;
    setSaving(true);
    try {
      const updated = await runCmsGenericAction("articles", target.publicId, action);
      const detail = await getCmsGenericEntity("articles", updated.publicId);
      setSelected(detail);
      setEditor(editorFromItem(detail, categories, tags));
      setDirty(false);
    setSaving(true);
    try {
      const restored = await rollbackCmsGenericEntity("articles", selected.publicId, version.id);
      const detail = await getCmsGenericEntity("articles", restored.publicId);
      setSelected(detail);
      setEditor(editorFromItem(detail, categories, tags));
      setVersions(await getCmsGenericVersions("articles", detail.publicId));
      setAudit(await getCmsGenericAudit("articles", detail.publicId));
      setDirty(false);
      setNotice(`تمت استعادة الإصدار ${version.version}.`);
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر استعادة الإصدار."));
    } finally {
      setSaving(false);
    }
  }

  async function bulkArchive(): Promise<void> {
    if (!selectedIds.length || !globalThis.confirm(`أرشفة ${selectedIds.length} مقالات؟`)) return;
    setSaving(true);
    try {
      await runCmsGenericBulkArchive("articles", selectedIds);
      setSelectedIds([]);
      await loadArticles();
      setNotice("تمت أرشفة المقالات المحددة.");
      setNotice(action === "publish" ? "تم نشر المقال." : action === "unpublish" ? "تم إلغاء النشر." : action === "archive" ? "تمت الأرشفة." : "تمت الاستعادة.");
      setVersions(await getCmsGenericVersions("articles", detail.publicId));
      setAudit(await getCmsGenericAudit("articles", detail.publicId));
      void loadArticles();
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تحديث حالة المقال."));
    } finally {
      setSaving(false);
    }
  }

  async function restoreVersion(version: CmsEntityVersion): Promise<void> {
    if (!selected) return;
    setSaving(true);
    try {
      const restored = await rollbackCmsGenericEntity("articles", selected.publicId, version.id);
      const detail = await getCmsGenericEntity("articles", restored.publicId);
      setSelected(detail);
      setEditor(editorFromItem(detail, categories, tags));
      setVersions(await getCmsGenericVersions("articles", detail.publicId));
      setAudit(await getCmsGenericAudit("articles", detail.publicId));
      setDirty(false);
      setNotice(`تمت استعادة الإصدار ${version.version}.`);
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر استعادة الإصدار."));
    } finally { setSaving(false); }
  }
  async function createTaxonomy(domain: "article-categories" | "article-tags"): Promise<void> {
    const title = taxonomyName.trim();
    if (!title) return;
    setSaving(true);
    try {
      const item = await createCmsGenericEntity(domain, {
        publicId: newPublicId(domain === "article-categories" ? "category" : "tag"),
        title, publicCode: slugify(title), locale: "ar-LB", status: "PUBLISHED",
        payload: domain === "article-categories" ? { parentId: taxonomyParent || null } : {},
        sourceMeta: { editorOwner: "ARTICLE_CMS_V2" },
      });
      if (domain === "article-categories" && taxonomyParent) {
        await replaceCmsGenericRelationships(domain, item.publicId, "parent", [{ targetDomain: "article-categories", targetPublicId: taxonomyParent }]);
      }
      setTaxonomyName("");
      setTaxonomyParent("");
      await loadLibraries();
      setNotice(domain === "article-categories" ? "تم إنشاء التصنيف." : "تم إنشاء الوسم.");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر إنشاء العنصر."));
    } finally { setSaving(false); }
  }

  async function archiveTaxonomy(domain: "article-categories" | "article-tags", item: CmsGenericItem): Promise<void> {
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تنفيذ الإجراء الجماعي."));
    } finally {
      setSaving(false);
    }
  }

  async function createTaxonomy(domain: "article-categories" | "article-tags"): Promise<void> {
    const title = taxonomyName.trim();
    if (!title) return;
    setSaving(true);
    setError("");
    try {
      const item = await createCmsGenericEntity(domain, {
        publicId: newPublicId(domain === "article-categories" ? "category" : "tag"),
        title, publicCode: slugify(title), locale: "ar-LB", status: "PUBLISHED",
        payload: domain === "article-categories" ? { parentId: taxonomyParent || null } : {},
        sourceMeta: { editorOwner: "ARTICLE_CMS_V2_FINAL" },
      });
      if (domain === "article-categories" && taxonomyParent) {
        await replaceCmsGenericRelationships(domain, item.publicId, "parent", [{
          targetDomain: "article-categories", targetPublicId: taxonomyParent,
        }]);
      }
      setTaxonomyName("");
      setTaxonomyParent("");
      await loadLibraries();
      setNotice(domain === "article-categories" ? "تم إنشاء التصنيف." : "تم إنشاء الوسم.");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر إنشاء العنصر."));
    } finally {
      setSaving(false);
    }
  }

  async function renameTaxonomy(domain: "article-categories" | "article-tags", item: CmsGenericItem): Promise<void> {
    const next = globalThis.prompt("الاسم الجديد", item.title)?.trim();
    if (!next || next === item.title) return;
    try {
      await updateCmsGenericEntity(domain, item.publicId, { title: next, publicCode: slugify(next) });
      await loadLibraries();
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تعديل العنصر."));
    }
  }

  async function archiveTaxonomy(domain: "article-categories" | "article-tags", item: CmsGenericItem): Promise<void> {
    if (!globalThis.confirm(`أرشفة «${item.title}»؟`)) return;
    try {
      await runCmsGenericAction(domain, item.publicId, "archive");
    if (!globalThis.confirm(`أرشفة «${item.title}»؟`)) return;
    try {
      await runCmsGenericAction(domain, item.publicId, "archive");
      await loadLibraries();
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر أرشفة العنصر."));
    }
  }

  async function uploadMedia(file: File): Promise<void> {
    setMediaBusy(true);
    try {
      const result = await uploadArticleMedia({ name: file.name, mimeType: file.type, dataBase64: await fileToBase64(file), altText: mediaAlt, caption: mediaCaption });
      const normalized = { ...result.item, payload: { ...result.item.payload, url: result.asset.url } };
      setMedia((current) => [normalized, ...current.filter((item) => item.publicId !== normalized.publicId)]);
      setNotice("تم رفع الملف إلى مكتبة الوسائط.");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر رفع الملف."));
    } finally { setMediaBusy(false); }
  }

  function editorCommand(command: string, value?: string): void {
    visualRef.current?.focus();
    document.execCommand(command, false, value);
    if (visualRef.current) patchEditor({ bodyHtml: visualRef.current.innerHTML });
  }
      await loadLibraries();
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر أرشفة العنصر."));
    }
  }

  async function uploadMedia(file: File, useAsFeatured = false): Promise<CmsGenericItem | null> {
    setMediaBusy(true);
    setError("");
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
  function insertMedia(item: CmsGenericItem): void {
    const url = mediaUrl(item);
    if (!url) return;
    const kind = mediaKind(item);
    const html = kind === "image" ? `<p><img src="${url}" alt="${textValue(item.payload.altText)}"></p>`
      : kind === "video" ? `<video controls src="${url}"></video>`
        : `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${item.title}</a></p>`;
    patchEditor({ bodyHtml: `${editor.bodyHtml}${html}` });
    setView("editor");
  }

  async function bulkArchive(): Promise<void> {
    if (!selectedIds.length) return;
    setSaving(true);
    try {
      await runCmsGenericBulkArchive("articles", selectedIds);
      setSelectedIds([]);
      await loadArticles();
      setNotice("تمت أرشفة المقالات المحددة.");
    } catch (reason: unknown) {
      setError(getAdminErrorMessage(reason, "تعذر تنفيذ الإجراء الجماعي."));
    } finally { setSaving(false); }
  }

  function toggleTerm(field: "categoryIds" | "tagIds", id: string): void {
    const current = editor[field];
    patchEditor({ [field]: current.includes(id) ? current.filter((value) => value !== id) : [...current, id] } as Pick<ArticleEditor, typeof field>);
  }
    } finally {
      setMediaBusy(false);
    }
  }

  function execEditor(command: string, value?: string): void {
    visualRef.current?.focus();
    document.execCommand(command, false, value);
    if (visualRef.current) patchEditor({ bodyHtml: visualRef.current.innerHTML });
  }

  function insertMedia(item: CmsGenericItem): void {
    const rawUrl = textValue(item.payload.url);
    if (!rawUrl) return;
    const url = absoluteMediaUrl(rawUrl);
    const kind = mediaKind(item);
    const alt = textValue(item.payload.altText).replaceAll('"', "&quot;");
    const caption = textValue(item.payload.caption);
    const html = kind === "image"
      ? `<figure><img src="${url}" alt="${alt}">${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure><p><br></p>`
      : kind === "video"
        ? `<figure><video controls preload="metadata" src="${url}"></video>${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure><p><br></p>`
        : `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${item.title}</a></p>`;
    patchEditor({ bodyHtml: `${editor.bodyHtml}${html}` });
    setEditorMode("visual");
    setView("editor");
  }
  function renderArticles() {
    const allChecked = articles.length > 0 && articles.every((item) => selectedIds.includes(item.publicId));
    return <section className="article-cms-panel">
      <div className="article-cms-metrics"><div><span>الإجمالي</span><strong>{total}</strong></div>{FILTER_STATUSES.map((value) => <div key={value}><span>{STATUS_LABELS[value]}</span><strong>{statusCounts[value] || 0}</strong></div>)}</div>
      <div className="article-cms-toolbar"><label><span>بحث</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="العنوان أو الرابط" /></label><label><span>الحالة</span><select value={status} onChange={(event) => { setStatus(event.target.value as CmsStatus | ""); setPage(1); }}><option value="">كل الحالات</option>{FILTER_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label><button type="button" className="accent" onClick={beginCreate}>+ مقال جديد</button><button type="button" className="ghost danger" disabled={!selectedIds.length || saving} onClick={() => void bulkArchive()}>أرشفة المحدد ({selectedIds.length})</button></div>
      <div className="article-table-wrap"><table className="article-table"><thead><tr><th><input aria-label="تحديد الصفحة" type="checkbox" checked={allChecked} onChange={(event) => setSelectedIds(event.target.checked ? articles.map((item) => item.publicId) : [])} /></th><th>المقال</th><th>الكاتب</th><th>التصنيفات</th><th>الحالة</th><th>SEO</th><th>التعديل</th></tr></thead><tbody>
        {articles.map((item) => { const payload = item.payload || {}; const image = textValue(payload.featuredImage); const categoryNames = Array.isArray(payload.categories) ? payload.categories.filter((value): value is string => typeof value === "string") : []; const seoReady = Boolean(textValue(payload.seoTitle) && textValue(payload.seoDescription)); return <tr key={item.publicId}>
          <td><input aria-label={`تحديد ${item.title}`} type="checkbox" checked={selectedIds.includes(item.publicId)} onChange={() => setSelectedIds((current) => current.includes(item.publicId) ? current.filter((id) => id !== item.publicId) : [...current, item.publicId])} /></td>
          <td><div className="article-cms-v2__title-cell">{image ? <img src={image} alt="" /> : <span className="article-cms-v2__thumb-placeholder"><AdminFluentIcon name="document" /></span>}<div><button type="button" className="article-title-link" onClick={() => void openArticle(item)}>{item.title}</button><small>/articles/{item.publicCode || textValue(payload.slug)}</small></div></div></td>
          <td>{textValue(payload.authorName) || "—"}</td><td>{categoryNames.length ? categoryNames.join("، ") : "—"}</td><td><span className={`article-status status-${item.status.toLowerCase()}`}>{STATUS_LABELS[item.status]}</span></td><td><span className={seoReady ? "seo-dot seo-dot--ok" : "seo-dot seo-dot--warn"}>{seoReady ? "جيد" : "ناقص"}</span></td><td>{formatDate(item.updatedAt)}</td>
        </tr>; })}
      </tbody></table></div>
  function setFeatured(item: CmsGenericItem): void {
    const rawUrl = textValue(item.payload.url);
    if (!rawUrl) return;
    const url = absoluteMediaUrl(rawUrl);
    patchEditor({ featuredImage: url, ogImage: editor.ogImage || url });
    setView("editor");
  }

  function toggleTaxonomy(field: "categoryIds" | "tagIds", id: string): void {
    const current = editor[field];
    patchEditor({ [field]: current.includes(id)
      ? current.filter((value) => value !== id) : [...current, id] } as Pick<ArticleEditor, typeof field>);
  }

  function previewDraft(): void {
    const safeTitle = editor.title.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>${safeTitle}</title><body style="max-width:900px;margin:40px auto;font-family:Arial;line-height:1.9">${editor.featuredImage ? `<img src="${editor.featuredImage}" style="max-width:100%">` : ""}<h1>${safeTitle}</h1>${editor.bodyHtml}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    globalThis.open(url, "_blank", "noopener,noreferrer");
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function renderDashboard() {
    const allChecked = articles.length > 0 && articles.every((item) => selectedIds.includes(item.publicId));
    return <section className="apf-panel">
      {loading && <div className="article-cms-empty">جارٍ التحميل...</div>}{!loading && !articles.length && <div className="article-cms-empty">لا توجد نتائج.</div>}
      <div className="article-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>السابق</button><span>صفحة {page} من {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>التالي</button></div>
    </section>;
  }

  function renderTaxonomy() {
    const domain = view === "categories" ? "article-categories" : "article-tags";
    const items = domain === "article-categories" ? categories : tags;
    const isCategory = domain === "article-categories";
    return <section className="article-cms-v2__taxonomy"><div className="article-cms-v2__taxonomy-create"><h2>{isCategory ? "إضافة تصنيف" : "إضافة وسم"}</h2><label><span>الاسم</span><input value={taxonomyName} onChange={(event) => setTaxonomyName(event.target.value)} /></label>{isCategory && <label><span>التصنيف الأب</span><select value={taxonomyParent} onChange={(event) => setTaxonomyParent(event.target.value)}><option value="">بدون أب</option>{categories.filter((item) => item.status !== "ARCHIVED").map((item) => <option key={item.publicId} value={item.publicId}>{item.title}</option>)}</select></label>}<button type="button" className="primary" disabled={saving || !taxonomyName.trim()} onClick={() => void createTaxonomy(domain)}>إضافة</button></div>
      <div className="article-cms-v2__taxonomy-list"><div className="article-section-head"><div><h2>{isCategory ? "التصنيفات" : "الوسوم"}</h2><p>{items.length} عنصر</p></div></div><div className="taxonomy-grid">{items.map((item) => <article className="taxonomy-card" key={item.publicId}><strong>{item.title}</strong><span>{item.publicCode || "—"}</span><span>{STATUS_LABELS[item.status]}</span>{item.status !== "ARCHIVED" && <button type="button" className="danger small" onClick={() => void archiveTaxonomy(domain, item)}>أرشفة</button>}</article>)}</div></div>
    </section>;
  }
      <div className="apf-metrics">
        <div><span>الإجمالي</span><strong>{total}</strong></div>
        {FILTER_STATUSES.map((value) => <div key={value}><span>{STATUS_LABELS[value]}</span><strong>{statusCounts[value] ?? 0}</strong></div>)}
      </div>
      <div className="apf-filters">
        <label><span>بحث</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="العنوان، الرابط أو المحتوى" /></label>
        <label><span>الحالة</span><select value={status} onChange={(event) => { setStatus(event.target.value as CmsStatus | ""); setPage(1); }}>
          <option value="">كل الحالات</option>{FILTER_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
        </select></label>
        <button type="button" className="ghost" onClick={() => void loadArticles()}><AdminFluentIcon name="refresh" /> تحديث</button>
        <button type="button" className="accent" onClick={beginCreate}><AdminFluentIcon name="add" /> مقال جديد</button>
        {selectedIds.length > 0 && <button type="button" className="ghost danger" disabled={saving} onClick={() => void bulkArchive()}>أرشفة المحدد ({selectedIds.length})</button>}
      </div>
      {loading ? <div className="apf-empty">جار تحميل المقالات...</div> : articles.length === 0 ? <div className="apf-empty">لا توجد مقالات مطابقة.</div> : <div className="apf-table-wrap">
        <table className="apf-table"><thead><tr><th><input aria-label="تحديد الصفحة" type="checkbox" checked={allChecked} onChange={(event) => setSelectedIds(event.target.checked ? articles.map((item) => item.publicId) : [])} /></th><th>المقال</th><th>الكاتب</th><th>التصنيفات</th><th>الحالة</th><th>SEO</th><th>آخر تعديل</th></tr></thead><tbody>
          {articles.map((item) => {
            const payload = item.payload || {};
            const image = textValue(payload.featuredImage);
            const names = Array.isArray(payload.categories) ? payload.categories.filter((value): value is string => typeof value === "string") : [];
            const seoReady = Boolean(textValue(payload.seoTitle) && textValue(payload.seoDescription));
            return <tr key={item.publicId}>
              <td><input aria-label={`تحديد ${item.title}`} type="checkbox" checked={selectedIds.includes(item.publicId)} onChange={() => setSelectedIds((current) => current.includes(item.publicId) ? current.filter((id) => id !== item.publicId) : [...current, item.publicId])} /></td>
              <td><button type="button" className="apf-title-link" onClick={() => void openArticle(item)}>{image ? <img src={image} alt="" /> : <span className="apf-thumb"><AdminFluentIcon name="document" /></span>}<span><strong>{item.title}</strong><small dir="ltr">/articles/{item.publicCode || textValue(payload.slug)}</small></span></button></td>
              <td>{textValue(payload.authorName) || "—"}</td>
              <td>{names.length ? names.slice(0, 3).join("، ") : "—"}{names.length > 3 ? ` +${names.length - 3}` : ""}</td>
              <td><span className={statusClass(item.status)}>{STATUS_LABELS[item.status]}</span></td>
              <td><span className={seoReady ? "apf-seo good" : "apf-seo warn"}>{seoReady ? "جاهز" : "ناقص"}</span></td>
              <td>{formatDate(item.updatedAt)}</td>
            </tr>;
          })}
        </tbody></table>
      </div>}
      <div className="apf-pagination"><button type="button" className="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</button><span>صفحة {page} من {totalPages}</span><button type="button" className="ghost" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>التالي</button></div>
    </section>;
  }
  function renderMedia() {
    return <section className="article-cms-v2__media"><div className="article-cms-v2__media-upload"><h2>رفع وسائط</h2><label><span>Alt text</span><input value={mediaAlt} onChange={(event) => setMediaAlt(event.target.value)} /></label><label><span>التعليق</span><input value={mediaCaption} onChange={(event) => setMediaCaption(event.target.value)} /></label><label className="article-editor-v2__upload-button">{mediaBusy ? "جارٍ الرفع..." : "اختيار ملف"}<input hidden type="file" disabled={mediaBusy} accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file); event.currentTarget.value = ""; }} /></label></div>
      <div className="article-cms-v2__media-library"><div className="article-section-head"><div><h2>مكتبة الوسائط</h2><p>{media.length} ملف</p></div></div><div className="article-cms-v2__media-grid">{media.map((item) => { const url = mediaUrl(item); const kind = mediaKind(item); return <article className="article-cms-v2__media-card" key={item.publicId}><div className="article-cms-v2__media-preview">{kind === "image" ? <img src={url} alt={textValue(item.payload.altText)} /> : kind === "video" ? <video src={url} controls preload="metadata" /> : <div className="article-cms-v2__file-icon">PDF</div>}</div><h3>{item.title}</h3><small>{textValue(item.payload.mimeType)}</small><div className="row-actions">{kind === "image" && <button type="button" className="secondary small" onClick={() => { patchEditor({ featuredImage: url, ogImage: editor.ogImage || url }); setView("editor"); }}>صورة بارزة</button>}<button type="button" className="secondary small" onClick={() => insertMedia(item)}>إدراج</button></div></article>; })}</div></div>
    </section>;
  }

  function renderEditor() {
    return <section className="article-editor-v2"><main className="article-editor-v2__main"><div className="article-editor-v2__title-row"><input className="article-editor-v2__title" value={editor.title} onChange={(event) => { const title = event.target.value; patchEditor({ title, slug: editor.slug || slugify(title) }); }} placeholder="أدخل عنوان المقال" /><div className="article-editor-v2__slug"><span>/articles/</span><input value={editor.slug} onChange={(event) => patchEditor({ slug: slugify(event.target.value) })} /></div></div>
      <div><div className="article-editor-v2__mode-tabs"><button type="button" className={editorMode === "visual" ? "active" : ""} onClick={() => setEditorMode("visual")}>مرئي</button><button type="button" className={editorMode === "html" ? "active" : ""} onClick={() => setEditorMode("html")}>HTML</button></div>{editorMode === "visual" ? <><div className="article-editor-v2__toolbar"><button type="button" onClick={() => editorCommand("bold")}><b>B</b></button><button type="button" onClick={() => editorCommand("italic")}><i>I</i></button><button type="button" onClick={() => editorCommand("formatBlock", "h2")}>H2</button><button type="button" onClick={() => editorCommand("formatBlock", "h3")}>H3</button><button type="button" onClick={() => editorCommand("insertUnorderedList")}>• قائمة</button><button type="button" onClick={() => editorCommand("insertOrderedList")}>1. قائمة</button><button type="button" onClick={() => setView("media")}>+ وسائط</button></div><div ref={visualRef} className="article-editor-v2__content" contentEditable suppressContentEditableWarning onInput={() => { if (visualRef.current) patchEditor({ bodyHtml: visualRef.current.innerHTML }); }} dangerouslySetInnerHTML={{ __html: editor.bodyHtml }} /></> : <textarea className="article-editor-v2__html" value={editor.bodyHtml} onChange={(event) => patchEditor({ bodyHtml: event.target.value })} />}</div>
  function renderTaxonomy() {
    const domain: "article-categories" | "article-tags" = view === "categories" ? "article-categories" : "article-tags";
    const items = domain === "article-categories" ? categories : tags;
    const isCategory = domain === "article-categories";
    return <section className="apf-taxonomy">
      <form className="apf-card apf-taxonomy-form" onSubmit={(event) => { event.preventDefault(); void createTaxonomy(domain); }}>
        <h2>{isCategory ? "إضافة تصنيف" : "إضافة وسم"}</h2>
        <label><span>الاسم</span><input value={taxonomyName} onChange={(event) => setTaxonomyName(event.target.value)} /></label>
        {isCategory && <label><span>التصنيف الأب</span><select value={taxonomyParent} onChange={(event) => setTaxonomyParent(event.target.value)}><option value="">بدون أب</option>{categories.filter((item) => item.status !== "ARCHIVED").map((item) => <option key={item.publicId} value={item.publicId}>{item.title}</option>)}</select></label>}
        <button type="submit" className="accent" disabled={saving || !taxonomyName.trim()}>إضافة</button>
      </form>
      <div className="apf-card"><div className="apf-section-head"><div><h2>{isCategory ? "التصنيفات" : "الوسوم"}</h2><p>{items.length} عنصر</p></div></div>
        <div className="apf-term-grid">{items.map((item) => <article className="apf-term" key={item.publicId}><strong>{item.title}</strong><span dir="ltr">{item.publicCode || "—"}</span><span>{STATUS_LABELS[item.status]}</span><div><button type="button" className="ghost sm" onClick={() => void renameTaxonomy(domain, item)}>تعديل</button>{item.status !== "ARCHIVED" && <button type="button" className="ghost danger sm" onClick={() => void archiveTaxonomy(domain, item)}>أرشفة</button>}</div></article>)}</div>
      </div>
    </section>;
  }
      <label className="article-editor-v2__field"><span>المقتطف</span><textarea rows={3} value={editor.excerpt} onChange={(event) => patchEditor({ excerpt: event.target.value })} /></label>
      <section className="article-editor-v2__seo"><div className="article-editor-v2__section-title"><div><span>تحسين محركات البحث SEO</span><small>معاينة نتيجة البحث وإعدادات المشاركة</small></div><strong className={review.score >= 80 ? "score-good" : review.score >= 55 ? "score-mid" : "score-low"}>{review.score}/100</strong></div><div className="article-editor-v2__seo-preview"><span>{editor.canonicalUrl || `/articles/${editor.slug || "article"}`}</span><h3>{editor.seoTitle || editor.title || "عنوان المقال"}</h3><p>{editor.seoDescription || editor.excerpt || "أضف وصفاً لمحركات البحث."}</p></div>
        <div className="article-editor-v2__field-grid"><label><span>عنوان SEO</span><input value={editor.seoTitle} onChange={(event) => patchEditor({ seoTitle: event.target.value })} /><small>{editor.seoTitle.length}/60</small></label><label><span>العبارة المفتاحية</span><input value={editor.focusKeyphrase} onChange={(event) => patchEditor({ focusKeyphrase: event.target.value })} /></label><label className="wide"><span>Meta Description</span><textarea rows={3} value={editor.seoDescription} onChange={(event) => patchEditor({ seoDescription: event.target.value })} /><small>{editor.seoDescription.length}/160</small></label><label><span>Canonical URL</span><input dir="ltr" value={editor.canonicalUrl} onChange={(event) => patchEditor({ canonicalUrl: event.target.value })} /></label><label><span>Robots</span><select value={editor.robots} onChange={(event) => patchEditor({ robots: event.target.value })}><option value="index,follow">index, follow</option><option value="noindex,follow">noindex, follow</option><option value="noindex,nofollow">noindex, nofollow</option></select></label><label><span>OG Title</span><input value={editor.ogTitle} onChange={(event) => patchEditor({ ogTitle: event.target.value })} /></label><label><span>OG Image</span><input dir="ltr" value={editor.ogImage} onChange={(event) => patchEditor({ ogImage: event.target.value })} /></label><label className="wide"><span>OG Description</span><textarea rows={2} value={editor.ogDescription} onChange={(event) => patchEditor({ ogDescription: event.target.value })} /></label></div>
        {review.notes.length ? <ul className="article-editor-v2__seo-notes">{review.notes.map((note) => <li key={note}>{note}</li>)}</ul> : <div className="article-editor-v2__seo-pass">أساسيات SEO مكتملة.</div>}
      </section>
    </main>
    <aside className="article-editor-v2__sidebar">
  function renderMedia() {
    return <section className="apf-media">
      <div className="apf-card apf-media-upload">
        <h2>رفع وسائط</h2><p>صور، MP4/WebM أو PDF حتى 25MB.</p>
        <label><span>النص البديل</span><input value={mediaAlt} onChange={(event) => setMediaAlt(event.target.value)} /></label>
        <label><span>التعليق</span><input value={mediaCaption} onChange={(event) => setMediaCaption(event.target.value)} /></label>
        <label className="accent apf-file-button"><AdminFluentIcon name="upload" /> {mediaBusy ? "جار الرفع..." : "اختيار ملف"}<input hidden type="file" disabled={mediaBusy} accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file); event.currentTarget.value = ""; }} /></label>
      </div>
      <div className="apf-card"><div className="apf-section-head"><div><h2>مكتبة الوسائط</h2><p>{media.length} ملف</p></div></div>
        <div className="apf-media-grid">{media.map((item) => { const raw = textValue(item.payload.url); const url = raw ? absoluteMediaUrl(raw) : ""; const kind = mediaKind(item); return <article className="apf-media-card" key={item.publicId}>
          <div className="apf-media-preview">{kind === "image" ? <img src={url} alt={textValue(item.payload.altText)} /> : kind === "video" ? <video src={url} controls preload="metadata" /> : <span><AdminFluentIcon name="document" /><b>{kind === "pdf" ? "PDF" : "FILE"}</b></span>}</div>
          <strong>{item.title}</strong><small>{textValue(item.payload.mimeType)}</small><div>{kind === "image" && <button type="button" className="ghost sm" onClick={() => setFeatured(item)}>صورة بارزة</button>}<button type="button" className="ghost sm" onClick={() => insertMedia(item)}>إدراج</button></div>
        </article>; })}</div>
      </div>
    </section>;
  }
      <section className="article-editor-v2__box article-editor-v2__publish"><h2>النشر</h2><dl><div><dt>الحالة</dt><dd>{selected ? STATUS_LABELS[selected.status] : "مسودة جديدة"}</dd></div><div><dt>آخر تعديل</dt><dd>{selected ? formatDate(selected.updatedAt) : "—"}</dd></div></dl><span className={dirty ? "article-editor-v2__autosave" : "article-editor-v2__saved"}>{dirty ? "تغييرات غير محفوظة · الحفظ المحلي مفعل" : "كل التغييرات محفوظة"}</span><div className="article-editor-v2__publish-actions"><button type="button" className="primary" disabled={saving || !dirty} onClick={() => void saveArticle()}>حفظ</button>{selected?.status !== "PUBLISHED" && selected?.status !== "ARCHIVED" && <button type="button" className="primary" disabled={saving} onClick={() => void lifecycle("publish")}>نشر</button>}{selected?.status === "PUBLISHED" && <button type="button" className="secondary" disabled={saving} onClick={() => void lifecycle("unpublish")}>إلغاء النشر</button>}{selected && selected.status !== "ARCHIVED" && <button type="button" className="danger" disabled={saving} onClick={() => void lifecycle("archive")}>أرشفة</button>}{selected?.status === "ARCHIVED" && <button type="button" className="secondary" onClick={() => void lifecycle("restore")}>استعادة</button>}</div></section>
      <section className="article-editor-v2__box"><h2>التصنيفات</h2><div className="article-editor-v2__checks">{categories.filter((item) => item.status !== "ARCHIVED").map((item) => <label key={item.publicId}><input type="checkbox" checked={editor.categoryIds.includes(item.publicId)} onChange={() => toggleTerm("categoryIds", item.publicId)} /><span>{item.title}</span></label>)}</div><button type="button" className="text-action" onClick={() => setView("categories")}>+ إدارة التصنيفات</button></section>
      <section className="article-editor-v2__box"><h2>الوسوم</h2><div className="article-editor-v2__checks article-editor-v2__checks--tags">{tags.filter((item) => item.status !== "ARCHIVED").map((item) => <label key={item.publicId}><input type="checkbox" checked={editor.tagIds.includes(item.publicId)} onChange={() => toggleTerm("tagIds", item.publicId)} /><span>{item.title}</span></label>)}</div><button type="button" className="text-action" onClick={() => setView("tags")}>+ إدارة الوسوم</button></section>
      <section className="article-editor-v2__box"><h2>الصورة البارزة</h2>{editor.featuredImage ? <img className="article-editor-v2__featured" src={editor.featuredImage} alt="" /> : <div className="article-editor-v2__featured-empty">لا توجد صورة بارزة</div>}<button type="button" className="secondary" onClick={() => setView("media")}>اختيار من المكتبة</button>{editor.featuredImage && <button type="button" className="text-action danger-text" onClick={() => patchEditor({ featuredImage: "" })}>إزالة</button>}</section>
      <section className="article-editor-v2__box"><h2>الكاتب</h2><input value={editor.authorName} onChange={(event) => patchEditor({ authorName: event.target.value })} /></section>
      {selected && <section className="article-editor-v2__box"><h2>المراجعات</h2><div className="article-editor-v2__history">{versions.slice(0, 6).map((version) => <div key={version.id}><span>الإصدار {version.version}<small>{formatDate(version.createdAt)}</small></span><button type="button" className="text-action" onClick={() => void restoreVersion(version)}>استعادة</button></div>)}</div></section>}
      {selected && <section className="article-editor-v2__box"><h2>سجل النشاط</h2><div className="article-editor-v2__audit">{audit.slice(0, 6).map((event) => <div key={event.id}><span>{event.eventType}<small>{formatDate(event.createdAt)} · {event.actorId}</small></span></div>)}</div></section>}
    </aside></section>;
  }
  function renderEditor() {
    return <section className="apf-editor">
      <div className="apf-editor-head">
        <button type="button" className="ghost" onClick={() => setView("articles")}>← كل المقالات</button>
        <div><button type="button" className="ghost" onClick={previewDraft}>معاينة</button><button type="button" className="accent" disabled={saving || !dirty} onClick={() => void saveArticle()}>{saving ? "جار الحفظ..." : "حفظ"}</button></div>
      </div>
      <div className="apf-editor-layout"><main className="apf-editor-main">
        <div className="apf-card apf-title-card">
          <input className="apf-title-input" value={editor.title} onChange={(event) => { const title = event.target.value; patchEditor({ title, slug: editor.slug || slugify(title) }); }} placeholder="أدخل عنوان المقال" />
          <label className="apf-slug"><span dir="ltr">/articles/</span><input dir="ltr" value={editor.slug} onChange={(event) => patchEditor({ slug: slugify(event.target.value) })} /></label>
        </div>
        <label className="apf-card apf-field"><span>المقتطف</span><textarea rows={3} value={editor.excerpt} onChange={(event) => patchEditor({ excerpt: event.target.value })} placeholder="ملخص قصير للأرشيف ومحركات البحث" /></label>
        <div className="apf-body-editor"><div className="apf-mode-tabs"><button type="button" className={editorMode === "visual" ? "active" : ""} onClick={() => setEditorMode("visual")}>مرئي</button><button type="button" className={editorMode === "html" ? "active" : ""} onClick={() => setEditorMode("html")}>HTML</button></div>
          {editorMode === "visual" ? <><div className="apf-format"><button type="button" onClick={() => execEditor("bold")}><b>B</b></button><button type="button" onClick={() => execEditor("italic")}><i>I</i></button><button type="button" onClick={() => execEditor("formatBlock", "h2")}>H2</button><button type="button" onClick={() => execEditor("formatBlock", "h3")}>H3</button><button type="button" onClick={() => execEditor("insertUnorderedList")}>• قائمة</button><button type="button" onClick={() => execEditor("insertOrderedList")}>1. قائمة</button><button type="button" onClick={() => setView("media")}>+ وسائط</button></div>
            <div ref={visualRef} className="apf-content" contentEditable suppressContentEditableWarning onInput={() => { if (visualRef.current) patchEditor({ bodyHtml: visualRef.current.innerHTML }); }} dangerouslySetInnerHTML={{ __html: editor.bodyHtml }} /></> : <textarea className="apf-html" dir="ltr" rows={24} value={editor.bodyHtml} onChange={(event) => patchEditor({ bodyHtml: event.target.value })} />}
        </div>
  const navItems: Array<{ id: Exclude<WorkspaceView, "editor">; label: string; icon: string }> = [
    { id: "articles", label: "كل المقالات", icon: "document" },
    { id: "categories", label: "التصنيفات", icon: "folder" },
    { id: "tags", label: "الوسوم", icon: "bookmark" },
    { id: "media", label: "مكتبة الوسائط", icon: "upload" },
  ];

  return <div className="article-cms-v2" dir="rtl" data-article-cms-v2="professional-publishing">
    <header className="article-cms-v2__header"><div><span className="article-cms-v2__eyebrow">موطني Ops / CMS & Knowledge</span><h1>المقالات والأرشيف</h1><p>مساحة نشر احترافية للمقالات: محرر مرئي، تصنيفات، وسوم، وسائط، مراجعات وتحسين SEO.</p></div><div className="article-cms-v2__header-actions"><button type="button" className="primary" onClick={beginCreate}><AdminFluentIcon name="edit" /> مقال جديد</button></div></header>
    <nav className="article-cms-v2__tabs" aria-label="إدارة المقالات">{navItems.map((item) => <button type="button" key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => { setView(item.id); setError(""); setNotice(""); }}><AdminFluentIcon name={item.icon} /> {item.label}</button>)}{view === "editor" && <button type="button" aria-current="page"><AdminFluentIcon name="edit" /> المحرر</button>}</nav>
    {error && <div className="article-cms-v2__alert article-cms-v2__alert--error" role="alert">{error}</div>}
    {notice && <div className="article-cms-v2__alert article-cms-v2__alert--success" role="status">{notice}</div>}
    {view === "articles" && renderArticles()}
    {(view === "categories" || view === "tags") && renderTaxonomy()}
    {view === "media" && renderMedia()}
    {view === "editor" && renderEditor()}
  </div>;
}
        <section className="apf-card apf-seo-panel">
          <div className="apf-section-head"><div><h2>تحسين محركات البحث SEO</h2><p>نتيجة البحث والمشاركة الاجتماعية.</p></div><strong className={review.score >= 80 ? "apf-score good" : review.score >= 55 ? "apf-score warn" : "apf-score bad"}>{review.score}/100</strong></div>
          <div className="apf-search-preview"><small>{editor.canonicalUrl || `/articles/${editor.slug || "article"}`}</small><h3>{editor.seoTitle || editor.title || "عنوان المقال"}</h3><p>{editor.seoDescription || editor.excerpt || "أضف وصفاً ليظهر في نتيجة البحث."}</p></div>
          <div className="apf-seo-grid">
            <label><span>عنوان SEO <small>{editor.seoTitle.length}/60</small></span><input value={editor.seoTitle} onChange={(event) => patchEditor({ seoTitle: event.target.value })} /></label>
            <label><span>العبارة المفتاحية</span><input value={editor.focusKeyphrase} onChange={(event) => patchEditor({ focusKeyphrase: event.target.value })} /></label>
            <label className="wide"><span>وصف Meta <small>{editor.seoDescription.length}/160</small></span><textarea rows={3} value={editor.seoDescription} onChange={(event) => patchEditor({ seoDescription: event.target.value })} /></label>
            <label className="wide"><span>Canonical URL</span><input dir="ltr" value={editor.canonicalUrl} onChange={(event) => patchEditor({ canonicalUrl: event.target.value })} /></label>
            <label><span>Robots</span><select value={editor.robots} onChange={(event) => patchEditor({ robots: event.target.value })}><option value="index,follow">index, follow</option><option value="noindex,follow">noindex, follow</option><option value="noindex,nofollow">noindex, nofollow</option></select></label>
            <label><span>OG Title</span><input value={editor.ogTitle} onChange={(event) => patchEditor({ ogTitle: event.target.value })} /></label>
            <label className="wide"><span>OG Description</span><textarea rows={2} value={editor.ogDescription} onChange={(event) => patchEditor({ ogDescription: event.target.value })} /></label>
            <label className="wide"><span>OG Image</span><input dir="ltr" value={editor.ogImage} onChange={(event) => patchEditor({ ogImage: event.target.value })} /></label>
          </div>
          {review.notes.length > 0 ? <ul className="apf-seo-notes">{review.notes.map((note) => <li key={note}>{note}</li>)}</ul> : <p className="apf-seo-pass">فحوص SEO الأساسية مكتملة.</p>}
        </section>
        {selected && <section className="apf-history-grid">
          <details className="apf-card" open><summary>المراجعات ({versions.length})</summary>{versions.length === 0 ? <p>لا توجد مراجعات سابقة.</p> : versions.slice(0, 10).map((version) => <div className="apf-history-row" key={version.id}><span><strong>الإصدار {version.version}</strong><small>{formatDate(version.createdAt)}</small></span><button type="button" className="ghost sm" onClick={() => void restoreVersion(version)}>استعادة</button></div>)}</details>
          <details className="apf-card"><summary>سجل النشاط ({audit.length})</summary>{audit.slice(0, 12).map((event) => <div className="apf-history-row" key={event.id}><span><strong dir="ltr">{event.eventType}</strong><small>{event.actorId} · {formatDate(event.createdAt)}</small></span></div>)}</details>
        </section>}
      </main>
      <aside className="apf-sidebar">
        <section className="apf-card apf-publish"><h2>النشر</h2><div className="apf-publish-state"><span>الحالة</span><strong className={statusClass(selected?.status || editor.status)}>{STATUS_LABELS[selected?.status || editor.status]}</strong></div><label><span>الكاتب</span><input value={editor.authorName} onChange={(event) => patchEditor({ authorName: event.target.value })} /></label><small>{dirty ? "● تغييرات غير محفوظة · الحفظ المحلي التلقائي مفعل" : selected ? `آخر تعديل: ${formatDate(selected.updatedAt)}` : "مسودة جديدة"}</small>
          <div className="apf-side-actions"><button type="button" className="ghost" disabled={saving} onClick={() => void saveArticle()}>حفظ</button>{selected?.status === "PUBLISHED" ? <button type="button" className="ghost" disabled={saving} onClick={() => void lifecycle("unpublish")}>إلغاء النشر</button> : <button type="button" className="accent" disabled={saving} onClick={() => void lifecycle("publish")}>نشر</button>}{selected && selected.status !== "ARCHIVED" && <button type="button" className="ghost danger" disabled={saving} onClick={() => void lifecycle("archive")}>أرشفة</button>}{selected?.status === "ARCHIVED" && <button type="button" className="ghost" disabled={saving} onClick={() => void lifecycle("restore")}>استعادة</button>}</div>
        </section>
        <section className="apf-card"><h2>الصورة البارزة</h2>{editor.featuredImage ? <img className="apf-featured" src={editor.featuredImage} alt="" /> : <div className="apf-featured-empty">لا توجد صورة بارزة</div>}<button type="button" className="ghost" onClick={() => setView("media")}>اختيار من مكتبة الوسائط</button>{editor.featuredImage && <button type="button" className="ghost danger" onClick={() => patchEditor({ featuredImage: "" })}>إزالة</button>}</section>
        <section className="apf-card"><h2>التصنيفات</h2><div className="apf-checks">{categories.filter((item) => item.status !== "ARCHIVED").map((item) => <label key={item.publicId}><input type="checkbox" checked={editor.categoryIds.includes(item.publicId)} onChange={() => toggleTaxonomy("categoryIds", item.publicId)} /><span>{item.title}</span></label>)}</div><button type="button" className="apf-text-button" onClick={() => { setTaxonomyName(""); setView("categories"); }}>+ إضافة / إدارة التصنيفات</button></section>
        <section className="apf-card"><h2>الوسوم</h2><div className="apf-checks apf-tag-checks">{tags.filter((item) => item.status !== "ARCHIVED").map((item) => <label key={item.publicId}><input type="checkbox" checked={editor.tagIds.includes(item.publicId)} onChange={() => toggleTaxonomy("tagIds", item.publicId)} /><span>{item.title}</span></label>)}</div><button type="button" className="apf-text-button" onClick={() => { setTaxonomyName(""); setView("tags"); }}>+ إضافة / إدارة الوسوم</button></section>
        <section className="apf-card"><h2>رفع صورة بارزة</h2><label className="accent apf-file-button">{mediaBusy ? "جار الرفع..." : "رفع صورة"}<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={mediaBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file, true); event.currentTarget.value = ""; }} /></label></section>
      </aside></div>
    </section>;
  }

  let content;
  if (view === "editor") content = renderEditor();
  else if (view === "categories" || view === "tags") content = renderTaxonomy();
  else if (view === "media") content = renderMedia();
  else content = renderDashboard();

  return <section className="apf-workspace" dir="rtl" data-article-cms-v2="final-professional-editor">
    <header className="apf-header"><div><span className="eyebrow">موطني Ops / CMS & Knowledge</span><h1>المقالات والأرشيف</h1><p>نشر وتحرير المقالات مع التصنيفات والوسائط والمراجعات وتحسين محركات البحث.</p></div><button type="button" className="accent" onClick={beginCreate}><AdminFluentIcon name="add" /> مقال جديد</button></header>
    <nav className="apf-nav" aria-label="إدارة المقالات">
      <button type="button" className={view === "articles" ? "active" : ""} onClick={() => setView("articles")}>كل المقالات</button>
      <button type="button" className={view === "editor" ? "active" : ""} onClick={() => selected || dirty ? setView("editor") : beginCreate()}>المحرر</button>
      <button type="button" className={view === "categories" ? "active" : ""} onClick={() => { setTaxonomyName(""); setView("categories"); }}>التصنيفات</button>
      <button type="button" className={view === "tags" ? "active" : ""} onClick={() => { setTaxonomyName(""); setView("tags"); }}>الوسوم</button>
      <button type="button" className={view === "media" ? "active" : ""} onClick={() => setView("media")}>مكتبة الوسائط</button>
    </nav>
    {error && <div className="apf-alert error" role="alert">{error}</div>}
    {notice && <output className="apf-alert notice">{notice}</output>}
    {content}
  </section>;
}
