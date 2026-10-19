import type { CmsGenericItem, CmsStatus } from "../lib/api";

export type WorkspaceView = "articles" | "editor" | "categories" | "tags" | "media";
export type EditorMode = "visual" | "html";

export type ArticleEditor = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  authorName: string;
  featuredImage: string;
  status: CmsStatus;
  categoryIds: string[];
  primaryCategoryId: string;
  permalinkSlug: string;
  tagIds: string[];
  seoTitle: string;
  seoDescription: string;
  focusKeyphrase: string;
  canonicalUrl: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  basePayload: Record<string, unknown>;
  baseSourceMeta: Record<string, unknown>;
};

export const PAGE_SIZE = 20;
export const FILTER_STATUSES: CmsStatus[] = ["DRAFT", "REVIEW_READY", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"];
export const STATUS_LABELS: Record<CmsStatus, string> = {
  DRAFT: "مسودة",
  REVIEW_READY: "جاهز للمراجعة",
  PUBLISHED: "منشور",
  UNPUBLISHED: "غير منشور",
  ARCHIVED: "مؤرشف",
};

export function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const ARABIC_LATIN: Record<string, string> = { "ا":"a","أ":"a","إ":"i","آ":"a","ب":"b","ت":"t","ث":"th","ج":"j","ح":"h","خ":"kh","د":"d","ذ":"dh","ر":"r","ز":"z","س":"s","ش":"sh","ص":"s","ض":"d","ط":"t","ظ":"z","ع":"a","غ":"gh","ف":"f","ق":"q","ك":"k","ل":"l","م":"m","ن":"n","ه":"h","ة":"a","و":"w","ؤ":"w","ي":"y","ى":"a","ئ":"y","ء":"" };
export function asciiSlugify(value: string): string { return Array.from(value.normalize("NFKD")).map((c) => ARABIC_LATIN[c] ?? c).join("").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 110) || "article"; }

export function slugify(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
}

export function newPublicId(prefix: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function emptyEditor(): ArticleEditor {
  return { id: "", title: "", slug: "", excerpt: "", bodyHtml: "<p><br></p>", authorName: "", featuredImage: "", status: "DRAFT",
    categoryIds: [], primaryCategoryId: "", permalinkSlug: "", tagIds: [], seoTitle: "", seoDescription: "", focusKeyphrase: "", canonicalUrl: "", robots: "index,follow",
    ogTitle: "", ogDescription: "", ogImage: "", basePayload: {}, baseSourceMeta: {} };
}
export function editorFromItem(item: CmsGenericItem, categories: CmsGenericItem[], tags: CmsGenericItem[]): ArticleEditor {
  const payload = item.payload || {};
  const relationships = item.relationships || [];
  const categoryRelations = relationships.filter((row) => row.relationType === "category" && row.targetDomain === "article-categories").map((row) => row.targetPublicId);
  const tagRelations = relationships.filter((row) => row.relationType === "tag" && row.targetDomain === "article-tags").map((row) => row.targetPublicId);
  const payloadCategories = new Set(stringList(payload.categories));
  const payloadTags = new Set(stringList(payload.tags));
  const selectedCategoryIds = categoryRelations.length ? categoryRelations : categories.filter((row) => payloadCategories.has(row.title)).map((row) => row.publicId);
  const payloadPrimaryId = textValue(payload.primaryCategoryId);
  const payloadPrimaryName = textValue(payload.primaryCategory);
  const primaryCategoryId = selectedCategoryIds.includes(payloadPrimaryId) ? payloadPrimaryId : (categories.find((row) => selectedCategoryIds.includes(row.publicId) && row.title === payloadPrimaryName)?.publicId || selectedCategoryIds[0] || "");
  return {
    id: item.publicId,
    title: item.title.trim() || textValue(payload.title).trim() || textValue(payload.seoTitle).trim() || textValue(payload.ogTitle).trim() || (item.publicCode || textValue(payload.slug)).replace(/-+/g, " ").trim(),
    slug: item.publicCode || textValue(payload.slug),
    excerpt: textValue(payload.excerpt),
    bodyHtml: textValue(payload.bodyHtml) || "<p><br></p>",
    authorName: textValue(payload.authorName),
    featuredImage: textValue(payload.featuredImage),
    status: item.status,
    categoryIds: selectedCategoryIds,
    primaryCategoryId,
    permalinkSlug: textValue(payload.permalinkSlug) || asciiSlugify(item.title),
    tagIds: tagRelations.length ? tagRelations : tags.filter((row) => payloadTags.has(row.title)).map((row) => row.publicId),
    seoTitle: textValue(payload.seoTitle),
    seoDescription: textValue(payload.seoDescription),
    focusKeyphrase: textValue(payload.focusKeyphrase),
    canonicalUrl: textValue(payload.canonicalUrl),
    robots: textValue(payload.robots) || "index,follow",
    ogTitle: textValue(payload.ogTitle),
    ogDescription: textValue(payload.ogDescription),
    ogImage: textValue(payload.ogImage),
    basePayload: { ...payload },
    baseSourceMeta: { ...(item.sourceMeta || {}) },
  };
}
export function articlePayload(editor: ArticleEditor, categories: CmsGenericItem[], tags: CmsGenericItem[]): Record<string, unknown> {
  const categoryNames = categories.filter((row) => editor.categoryIds.includes(row.publicId)).map((row) => row.title);
  const tagNames = tags.filter((row) => editor.tagIds.includes(row.publicId)).map((row) => row.title);
  const primaryCategory = categories.find((row) => row.publicId === editor.primaryCategoryId && editor.categoryIds.includes(row.publicId)) || categories.find((row) => editor.categoryIds.includes(row.publicId));
  return {
    ...editor.basePayload,
    slug: editor.slug,
    excerpt: editor.excerpt,
    bodyHtml: editor.bodyHtml,
    authorName: editor.authorName,
    featuredImage: editor.featuredImage || null,
    categories: categoryNames,
    primaryCategoryId: primaryCategory?.publicId || null,
    primaryCategory: primaryCategory?.title || null,
    permalinkSlug: editor.permalinkSlug || asciiSlugify(editor.title),
    tags: tagNames,
    seoTitle: editor.seoTitle,
    seoDescription: editor.seoDescription,
    focusKeyphrase: editor.focusKeyphrase,
    canonicalUrl: editor.canonicalUrl,
    robots: editor.robots,
    ogTitle: editor.ogTitle,
    ogDescription: editor.ogDescription,
    ogImage: editor.ogImage,
  };
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ar-LB");
}

export function mediaKind(item: CmsGenericItem): "image" | "video" | "pdf" | "file" {
  const mime = textValue(item.payload.mimeType);
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return mime === "application/pdf" ? "pdf" : "file";
}
export type SeoCheck = { id: string; label: string; ok: boolean; blocking?: boolean };

function plainText(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/giu, " ").replace(/<style[\s\S]*?<\/style>/giu, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function localHeadingStats(value: string): { bodyH1Count: number; skippedLevels: number } {
  const levels = Array.from(value.matchAll(/<h([1-6])\b[^>]*>/giu), (match) => Number(match[1]));
  let skippedLevels = 0;
  for (let index = 1; index < levels.length; index += 1) if (levels[index] > levels[index - 1] + 1) skippedLevels += 1;
  return { bodyH1Count: levels.filter((level) => level === 1).length, skippedLevels };
}
function localImageStats(value: string): { total: number; missingAlt: number } {
  const images = Array.from(value.matchAll(/<img\b([^>]*)>/giu));
  const missingAlt = images.filter((match) => !/\balt\s*=\s*(?:"[^"\s][^"]*"|'[^'\s][^']*')/iu.test(match[1] || "")).length;
  return { total: images.length, missingAlt };
}

export function articleCanonicalPath(editor: ArticleEditor, categories: CmsGenericItem[]): string {
  const primary = categories.find((row) => row.publicId === editor.primaryCategoryId && editor.categoryIds.includes(row.publicId)) || categories.find((row) => editor.categoryIds.includes(row.publicId));
  return `/articles/${asciiSlugify(primary?.title || "articles")}/${editor.permalinkSlug || asciiSlugify(editor.title)}`;
}

export function fillMissingSeo(editor: ArticleEditor, categories: CmsGenericItem[]): ArticleEditor {
  const bodyText = plainText(editor.bodyHtml);
  const excerpt = editor.excerpt.trim() || bodyText.slice(0, 155);
  const path = articleCanonicalPath({ ...editor, excerpt }, categories);
  const existingCanonical = editor.canonicalUrl.trim();
  const canonicalUrl = !existingCanonical || /^https:\/\/koudama\.com\/articles\//u.test(existingCanonical) ? `https://koudama.com${path}` : existingCanonical;
  const seoTitle = editor.seoTitle.trim() || editor.title.trim().slice(0, 60);
  const seoDescription = editor.seoDescription.trim() || excerpt.slice(0, 160);
  const ogTitle = editor.ogTitle.trim() || seoTitle || editor.title.trim();
  const ogDescription = editor.ogDescription.trim() || seoDescription;
  const ogImage = editor.ogImage.trim() || editor.featuredImage.trim() || "https://koudama.com/logo.png?v=20260827-1";
  const focusKeyphrase = editor.focusKeyphrase.trim() || editor.title.trim().split(/\s+/u).slice(0, 5).join(" ");
  return { ...editor, excerpt, permalinkSlug: editor.permalinkSlug || asciiSlugify(editor.title), seoTitle, seoDescription, focusKeyphrase, canonicalUrl, ogTitle, ogDescription, ogImage };
}

export function seoScore(editor: ArticleEditor): { score: number; notes: string[]; checks: SeoCheck[]; blockingIssues: string[] } {
  const bodyText = plainText(editor.bodyHtml);
  const heading = localHeadingStats(editor.bodyHtml);
  const images = localImageStats(editor.bodyHtml);
  const checks: SeoCheck[] = [
    { id: "title", label: "عنوان المقال موجود", ok: Boolean(editor.title.trim()), blocking: true },
    { id: "body", label: "محتوى المقال موجود", ok: bodyText.length >= 40, blocking: true },
    { id: "category", label: "تم اختيار تصنيف أساسي", ok: Boolean(editor.primaryCategoryId), blocking: true },
    { id: "permalink", label: "رابط دائم ASCII", ok: /^[a-z0-9][a-z0-9-]*$/u.test(editor.permalinkSlug), blocking: true },
    { id: "seo-title", label: "عنوان SEO بين 20 و60 حرفاً", ok: editor.seoTitle.trim().length >= 20 && editor.seoTitle.trim().length <= 60 },
    { id: "description", label: "وصف Meta بين 70 و160 حرفاً", ok: editor.seoDescription.trim().length >= 70 && editor.seoDescription.trim().length <= 160 },
    { id: "canonical", label: "Canonical URL مطابق للرابط الدائم", ok: /^https:\/\/koudama\.com\/articles\//u.test(editor.canonicalUrl) && Boolean(editor.permalinkSlug) && editor.canonicalUrl.endsWith(`/${editor.permalinkSlug}`) },
    { id: "featured", label: "صورة بارزة أو بديل اجتماعي", ok: Boolean(editor.featuredImage.trim() || editor.ogImage.trim()) },
    { id: "og", label: "بيانات OpenGraph مكتملة", ok: Boolean(editor.ogTitle.trim() && editor.ogDescription.trim() && editor.ogImage.trim()) },
    { id: "excerpt", label: "المقتطف موجود", ok: editor.excerpt.trim().length >= 40 },
    { id: "body-h1", label: "لا يوجد H1 داخل جسم المقال", ok: heading.bodyH1Count === 0 },
    { id: "heading-hierarchy", label: "تسلسل H2-H6 دون قفزات", ok: heading.skippedLevels === 0 },
    { id: "image-alt", label: "كل صور المحتوى لها نص بديل", ok: images.missingAlt === 0 },
  ];
  const failed = checks.filter((check) => !check.ok);
  const score = Math.max(0, Math.round(((checks.length - failed.length) / checks.length) * 100));
  const notes = failed.map((check) => check.label);
  const blockingIssues = failed.filter((check) => check.blocking).map((check) => check.label);
  return { score, notes, checks, blockingIssues };
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("FILE_READ_FAILED"));
    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.readAsDataURL(file);
  });
}
