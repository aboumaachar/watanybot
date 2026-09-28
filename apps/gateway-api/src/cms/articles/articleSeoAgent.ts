import { getAiChat, getAiModel, getAiProvider } from "../../bootstrap/ai-state.js";
import { query } from "../../lib/db.js";

export type ArticleSeoAgentInput = {
  id?: string;
  title: string;
  slug: string;
  permalinkSlug?: string;
  primaryCategory?: string;
  excerpt?: string;
  bodyHtml?: string;
  categories?: string[];
  tags?: string[];
  featuredImage?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyphrase?: string;
  canonicalUrl?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
};

export type ArticleSeoAgentLink = {
  title: string;
  url: string;
  anchor: string;
  reason: string;
};export type ArticleSeoAgentProposal = {
  mode: "ai" | "heuristic";
  provider: string;
  model: string;
  scoreBefore: number;
  scoreAfter: number;
  summary: string;
  fields: {
    seoTitle: string;
    seoDescription: string;
    focusKeyphrase: string;
    canonicalUrl: string;
    robots: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    excerpt: string;
  };
  issues: string[];
  contentRecommendations: string[];
  siteRecommendations: string[];
  internalLinks: ArticleSeoAgentLink[];
};

type ArticleCandidate = { public_id: string; public_code: string | null; title: string; payload: Record<string, unknown> };
function candidateCanonicalPath(row:ArticleCandidate):string{const payload=row.payload&&typeof row.payload==="object"?row.payload:{};const categories=Array.isArray(payload.categories)?payload.categories.filter((item):item is string=>typeof item==="string"):[];const primary=cleanText(payload.primaryCategory)||categories[0]||"articles";const permalink=cleanText(payload.permalinkSlug)||row.title;return `/articles/${articleAsciiSlug(primary)}/${articleAsciiSlug(permalink)}`;}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

const ARTICLE_ARABIC_LATIN: Record<string,string>={"ا":"a","أ":"a","إ":"i","آ":"a","ب":"b","ت":"t","ث":"th","ج":"j","ح":"h","خ":"kh","د":"d","ذ":"dh","ر":"r","ز":"z","س":"s","ش":"sh","ص":"s","ض":"d","ط":"t","ظ":"z","ع":"a","غ":"gh","ف":"f","ق":"q","ك":"k","ل":"l","م":"m","ن":"n","ه":"h","ة":"a","و":"w","ؤ":"w","ي":"y","ى":"a","ئ":"y","ء":""};
function articleAsciiSlug(value:string):string{return Array.from(cleanText(value).normalize("NFKD")).map((c)=>ARTICLE_ARABIC_LATIN[c]??c).join("").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,110)||"article";}
function canonicalArticleUrl(input:ArticleSeoAgentInput):string{const category=articleAsciiSlug(cleanText(input.primaryCategory)||(input.categories||[])[0]||"articles");const permalink=articleAsciiSlug(cleanText(input.permalinkSlug)||input.title);return `https://koudama.com/articles/${category}/${permalink}`;}
function normalizeOwnCanonical(input:ArticleSeoAgentInput):string{const generated=canonicalArticleUrl(input);const current=cleanText(input.canonicalUrl);if(!current||/^https:\/\/koudama\.com\/articles\//iu.test(current))return generated;return current;}function stripHtml(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/\s+/gu, " ")
    .trim();
}

function truncate(value: string, max: number): string {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function tokenize(value: string): Set<string> {
  return new Set(cleanText(value).toLocaleLowerCase("ar-LB")
    .split(/[^\p{L}\p{N}]+/gu)
    .filter((token) => token.length >= 3));
}

function scoreFields(input: Pick<ArticleSeoAgentInput, "seoTitle" | "seoDescription" | "focusKeyphrase" | "featuredImage" | "excerpt">): number {
  let score = 100;
  if (!cleanText(input.seoTitle)) score -= 20;
  if (cleanText(input.seoTitle).length > 60) score -= 10;  if (!cleanText(input.seoDescription)) score -= 20;
  if (cleanText(input.seoDescription).length > 160) score -= 10;
  if (!cleanText(input.focusKeyphrase)) score -= 10;
  if (!cleanText(input.featuredImage)) score -= 15;
  if (!cleanText(input.excerpt)) score -= 10;
  return Math.max(0, score);
}

function heuristicKeyphrase(input: ArticleSeoAgentInput): string {
  const source = `${input.title} ${(input.categories || []).join(" ")} ${(input.tags || []).join(" ")}`;
  return Array.from(tokenize(source)).slice(0, 4).join(" ");
}

function buildHeuristicFields(input: ArticleSeoAgentInput) {
  const title = cleanText(input.title) || "مقال موطني";
  const plain = stripHtml(input.bodyHtml || "");
  const excerpt = truncate(cleanText(input.excerpt) || plain, 155);
  const seoTitle = truncate(cleanText(input.seoTitle) || title, 60);
  const seoDescription = truncate(cleanText(input.seoDescription) || excerpt || title, 160);
  const focusKeyphrase = cleanText(input.focusKeyphrase) || heuristicKeyphrase(input);
  const canonicalUrl = normalizeOwnCanonical(input);
  return {
    seoTitle, seoDescription, focusKeyphrase, canonicalUrl,
    robots: cleanText(input.robots) || "index,follow",
    ogTitle: cleanText(input.ogTitle) || seoTitle,
    ogDescription: cleanText(input.ogDescription) || seoDescription,
    ogImage: cleanText(input.ogImage) || cleanText(input.featuredImage),
    excerpt: truncate(cleanText(input.excerpt) || excerpt, 220),
  };
}async function relatedArticles(input: ArticleSeoAgentInput): Promise<ArticleSeoAgentLink[]> {
  const rows = await query<ArticleCandidate>(
    `SELECT public_id, public_code, title, payload
     FROM cms_content_entities
     WHERE domain='articles' AND status='PUBLISHED' AND public_id <> COALESCE($1, '')
     ORDER BY published_at DESC NULLS LAST, updated_at DESC
     LIMIT 80`,
    [input.id || ""],
  );
  const sourceTokens = tokenize(`${input.title} ${stripHtml(input.bodyHtml || "")} ${(input.categories || []).join(" ")} ${(input.tags || []).join(" ")}`);
  return rows.rows.map((row) => {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    const excerpt = cleanText((payload as Record<string, unknown>).excerpt);
    const tokens = tokenize(`${row.title} ${excerpt}`);
    let score = 0;
    tokens.forEach((token) => { if (sourceTokens.has(token)) score += 1; });
    return { row, score };
  }).filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ row }) => ({
      title: row.title,
      url: candidateCanonicalPath(row),
      anchor: row.title,
      reason: "مقال مرتبط دلالياً ويمكن استخدامه كرابط داخلي طبيعي.",
    }));
}

function extractJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  const start = trimmed.indexOf("{"); const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>; } catch { return null; }
}function stringArray(value: unknown, max = 12): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map(cleanText).filter(Boolean).slice(0, max)
    : [];
}

function normalizeAiFields(value: unknown, fallback: ReturnType<typeof buildHeuristicFields>) {
  const obj = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    seoTitle: truncate(cleanText(obj.seoTitle) || fallback.seoTitle, 60),
    seoDescription: truncate(cleanText(obj.seoDescription) || fallback.seoDescription, 160),
    focusKeyphrase: truncate(cleanText(obj.focusKeyphrase) || fallback.focusKeyphrase, 80),
    canonicalUrl: fallback.canonicalUrl,
    robots: ["index,follow", "noindex,follow", "noindex,nofollow"].includes(cleanText(obj.robots)) ? cleanText(obj.robots) : fallback.robots,
    ogTitle: truncate(cleanText(obj.ogTitle) || fallback.ogTitle, 90),
    ogDescription: truncate(cleanText(obj.ogDescription) || fallback.ogDescription, 200),
    ogImage: cleanText(obj.ogImage) || fallback.ogImage,
    excerpt: truncate(cleanText(obj.excerpt) || fallback.excerpt, 220),
  };
}

function allowedLinks(value: unknown, candidates: ArticleSeoAgentLink[]): ArticleSeoAgentLink[] {
  const allowed = new Map(candidates.map((item) => [item.url, item]));
  if (!Array.isArray(value)) return candidates.slice(0, 4);
  const result: ArticleSeoAgentLink[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>; const url = cleanText(obj.url); const base = allowed.get(url);
    if (!base) continue;
    result.push({ ...base, anchor: truncate(cleanText(obj.anchor) || base.anchor, 100), reason: truncate(cleanText(obj.reason) || base.reason, 220) });
  }
  return result.slice(0, 6);
}export async function analyzeArticleSeo(input: ArticleSeoAgentInput): Promise<ArticleSeoAgentProposal> {
  const fallback = buildHeuristicFields(input);
  const links = await relatedArticles(input).catch(() => [] as ArticleSeoAgentLink[]);
  const before = scoreFields(input);
  const base: ArticleSeoAgentProposal = {
    mode: "heuristic",
    provider: getAiProvider(),
    model: getAiModel(),
    scoreBefore: before,
    scoreAfter: scoreFields({ ...input, ...fallback }),
    summary: "تم إعداد تحسينات SEO أساسية واقتراح روابط داخلية من محتوى موطني المنشور.",
    fields: fallback,
    issues: before >= 80 ? [] : ["توجد عناصر SEO قابلة للتحسين قبل النشر أو التحديث."],
    contentRecommendations: ["استخدم عنوان H2 واضحاً لكل محور رئيسي.", "اجعل الفقرة الافتتاحية تجيب مباشرة عن موضوع المقال."],
    siteRecommendations: links.length ? ["أضف روابط داخلية إلى المقالات المرتبطة أدناه لزيادة الترابط الموضوعي."] : ["لا توجد روابط داخلية قوية كفاية حالياً؛ راجع بنية المحتوى المرتبط."],
    internalLinks: links.slice(0, 4),
  };
  const ai = getAiChat();
  if (!ai) return base;

  const bodyText = truncate(stripHtml(input.bodyHtml || ""), 12000);
  const linkContext = links.map((item) => ({ title: item.title, url: item.url })).slice(0, 8);
  const system = `You are the DC SEO Agent for Watany (koudama.com). Return ONLY valid JSON. Improve Arabic-first SEO without inventing facts. Preserve the article's meaning. Never recommend keyword stuffing. Only use internal URLs supplied by the user. Keep seoTitle <=60 chars and seoDescription <=160 chars. Canonical must be the article's own koudama.com URL unless there is a clear duplicate-content reason. Robots should normally be index,follow.`;
  const payload = {
    title: input.title, slug: input.slug, permalinkSlug: input.permalinkSlug || "", primaryCategory: input.primaryCategory || "", excerpt: input.excerpt || "", bodyText,
    categories: input.categories || [], tags: input.tags || [], featuredImage: input.featuredImage || "",
    currentSeo: { seoTitle: input.seoTitle, seoDescription: input.seoDescription, focusKeyphrase: input.focusKeyphrase, canonicalUrl: input.canonicalUrl, robots: input.robots, ogTitle: input.ogTitle, ogDescription: input.ogDescription, ogImage: input.ogImage },
    internalLinkCandidates: linkContext,
  };  const instruction = `Analyze this draft and return JSON with this exact shape: {"fields":{"seoTitle":"","seoDescription":"","focusKeyphrase":"","canonicalUrl":"","robots":"index,follow","ogTitle":"","ogDescription":"","ogImage":"","excerpt":""},"summary":"","issues":[],"contentRecommendations":[],"siteRecommendations":[],"internalLinks":[{"url":"","anchor":"","reason":""}]}.\nDraft: ${JSON.stringify(payload)}`;
  try {
    const raw = await ai.complete([
      { role: "system", content: system },
      { role: "user", content: instruction },
    ], { temperature: 0.2, maxTokens: 1800 });
    const parsed = extractJson(raw);
    if (!parsed) return base;
    const fields = normalizeAiFields(parsed.fields, fallback);
    const proposal: ArticleSeoAgentProposal = {
      mode: "ai",
      provider: getAiProvider(),
      model: getAiModel(),
      scoreBefore: before,
      scoreAfter: scoreFields({ ...input, ...fields }),
      summary: truncate(cleanText(parsed.summary) || base.summary, 500),
      fields,
      issues: stringArray(parsed.issues, 10),
      contentRecommendations: stringArray(parsed.contentRecommendations, 10),
      siteRecommendations: stringArray(parsed.siteRecommendations, 10),
      internalLinks: allowedLinks(parsed.internalLinks, links),
    };
    if (!proposal.contentRecommendations.length) proposal.contentRecommendations = base.contentRecommendations;
    if (!proposal.siteRecommendations.length) proposal.siteRecommendations = base.siteRecommendations;
    return proposal;
  } catch {
    return base;
  }
}
