import { stat } from "node:fs/promises";
import { getAiChat, getAiModel, getAiProvider } from "../../bootstrap/ai-state.js";
import { query } from "../../lib/db.js";
import { resolveArticleMediaPath } from "./articleMediaStorage.js";

export type ArticleSeoAgentInput = {
  id?: string;
  status?: string;
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
};
export type ArticleSeoAuditCheck = { id: string; label: string; status: "pass" | "warn" | "fail"; severity: "info" | "warning" | "blocking"; detail: string };
export type ArticleSeoDuplicate = { title: string; url: string; similarity: number };
export type ArticleSeoAudit = {
  score: number;
  checks: ArticleSeoAuditCheck[];
  duplicateCandidates: ArticleSeoDuplicate[];
  heading: { count: number; bodyH1Count: number; skippedLevels: number };
  images: { total: number; missingAlt: number };
  links: { internal: number; external: number; brokenInternal: string[]; malformed: string[] };
  media: { checked: number; broken: string[] };
  indexing: { publicationStatus: string; robots: string; indexable: boolean; sitemapEligible: boolean; sitemapIncluded: boolean; expectedCanonical: string; canonicalMatches: boolean };
};
export type ArticleSeoAgentProposal = {
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
  audit: ArticleSeoAudit;
};

type ArticleCandidate = { public_id: string; public_code: string | null; title: string; status?: string; payload: Record<string, unknown> };
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
}
const SEO_STOP_WORDS=new Set(["في","من","على","إلى","الى","عن","مع","هذا","هذه","ذلك","التي","الذي","ما","هو","هي","أو","او","ثم","كما","بعد","قبل","بين","عند","ضمن","كل","حول","عبر","لدى","حتى","أمام","امام"]);
function seoTokens(value:string):Set<string>{return new Set(Array.from(tokenize(value)).filter((token)=>!SEO_STOP_WORDS.has(token)));}
function tokenSimilarity(a:Set<string>,b:Set<string>):number{if(!a.size||!b.size)return 0;let overlap=0;a.forEach((token)=>{if(b.has(token))overlap+=1;});const union=new Set([...a,...b]).size;return union?overlap/union:0;}
function attrValue(attrs:string,name:string):string{const re=new RegExp('\\b'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','iu');const m=attrs.match(re);return (m?.[1]||m?.[2]||m?.[3]||'').trim();}
function internalPath(value:string):string|null{try{const u=new URL(value,'https://koudama.com');if(u.origin!=='https://koudama.com')return null;return decodeURIComponent(u.pathname).replace(/\/+$/u,'')||'/';}catch{return null;}}
function inspectArticleHtml(bodyHtml:string){const headings:number[]=[];for(const m of bodyHtml.matchAll(/<h([1-6])\b[^>]*>/giu))headings.push(Number(m[1]));let skippedLevels=0;for(let i=1;i<headings.length;i++){if(headings[i]>headings[i-1]+1)skippedLevels+=1;}let totalImages=0;let missingAlt=0;for(const m of bodyHtml.matchAll(/<img\b([^>]*)>/giu)){totalImages+=1;if(!attrValue(m[1]||'', 'alt'))missingAlt+=1;}const hrefs:string[]=[];for(const m of bodyHtml.matchAll(/<a\b([^>]*)>/giu)){const href=attrValue(m[1]||'','href');if(href)hrefs.push(href);}const srcs:string[]=[];for(const m of bodyHtml.matchAll(/<(?:img|source|video|audio)\b([^>]*)>/giu)){const src=attrValue(m[1]||'','src');if(src)srcs.push(src);}return {headings,skippedLevels,totalImages,missingAlt,hrefs,srcs};}
function check(id:string,label:string,status:ArticleSeoAuditCheck['status'],severity:ArticleSeoAuditCheck['severity'],detail:string):ArticleSeoAuditCheck{return{id,label,status,severity,detail};}
async function analyzeSeoAudit(input:ArticleSeoAgentInput):Promise<ArticleSeoAudit>{
  const result=await query<ArticleCandidate>(`SELECT public_id,public_code,title,status,payload FROM cms_content_entities WHERE domain='articles' AND (status='PUBLISHED' OR public_id=COALESCE($1,'')) ORDER BY published_at DESC NULLS LAST,updated_at DESC LIMIT 200`,[input.id||'']);
  const rows=result.rows;const current=rows.find((row)=>row.public_id===input.id);const publicationStatus=cleanText(current?.status)||cleanText(input.status)||'DRAFT';
  const expectedCanonical=canonicalArticleUrl(input);const currentCanonical=cleanText(input.canonicalUrl)||expectedCanonical;const canonicalMatches=currentCanonical===expectedCanonical;const robots=cleanText(input.robots)||'index,follow';const indexable=!robots.startsWith('noindex');const sitemapEligible=publicationStatus==='PUBLISHED'&&indexable;
  const html=inspectArticleHtml(input.bodyHtml||'');const canonicalPaths=new Set<string>();const legacyPaths=new Set<string>();
  for(const row of rows.filter((item)=>item.status==='PUBLISHED')){canonicalPaths.add(candidateCanonicalPath(row));if(row.public_code)legacyPaths.add('/articles/'+row.public_code.replace(/^\/+|\/+$/gu,''));}canonicalPaths.add(new URL(expectedCanonical).pathname);
  const brokenInternal:string[]=[];const malformed:string[]=[];let internal=0;let external=0;
  for(const href of html.hrefs){if(/^(?:#|mailto:|tel:)/iu.test(href))continue;let u:URL;try{u=new URL(href,'https://koudama.com');}catch{malformed.push(href);continue;}if(!/^https?:$/u.test(u.protocol)){malformed.push(href);continue;}if(u.origin==='https://koudama.com'){internal+=1;const path=decodeURIComponent(u.pathname).replace(/\/+$/u,'')||'/';if(path.startsWith('/articles/')&&!canonicalPaths.has(path)&&!legacyPaths.has(path))brokenInternal.push(href);}else external+=1;}
  const mediaRefs=[...html.hrefs,...html.srcs].filter((value)=>{const path=internalPath(value);return Boolean(path&&path.startsWith('/mcp/api/articles/media/'));});const brokenMedia:string[]=[];
  for(const value of [...new Set(mediaRefs)]){const path=internalPath(value);if(!path)continue;const fileName=path.split('/').pop()||'';const filePath=resolveArticleMediaPath(fileName);if(!filePath){brokenMedia.push(value);continue;}try{const info=await stat(filePath);if(!info.isFile())brokenMedia.push(value);}catch{brokenMedia.push(value);}}
  const sourceTokens=seoTokens(`${input.title} ${input.focusKeyphrase||""} ${input.excerpt||""}`);const duplicates:ArticleSeoDuplicate[]=[];
  for(const row of rows){if(row.public_id===input.id||row.status!=='PUBLISHED')continue;const payload=row.payload&&typeof row.payload==='object'?row.payload:{};const candidateTokens=seoTokens(`${row.title} ${cleanText((payload as Record<string,unknown>).seoTitle)} ${cleanText((payload as Record<string,unknown>).focusKeyphrase)} ${cleanText((payload as Record<string,unknown>).excerpt)}`);const similarity=tokenSimilarity(sourceTokens,candidateTokens);if(similarity>=0.42)duplicates.push({title:row.title,url:candidateCanonicalPath(row),similarity:Number(similarity.toFixed(3))});}
  duplicates.sort((x,y)=>y.similarity-x.similarity);const topDuplicates=duplicates.slice(0,6);const bodyH1Count=html.headings.filter((level)=>level===1).length;const titleLen=cleanText(input.seoTitle).length;const descLen=cleanText(input.seoDescription).length;
  const checks:ArticleSeoAuditCheck[]=[
    check('canonical','Canonical URL مطابق للرابط الدائم',canonicalMatches?'pass':'fail',canonicalMatches?'info':'blocking',canonicalMatches?expectedCanonical:`المتوقع: ${expectedCanonical}`),
    check('seo-title','طول عنوان SEO مناسب',titleLen>=20&&titleLen<=60?'pass':'warn','warning',`الطول الحالي: ${titleLen} حرفاً`),
    check('meta-description','طول وصف Meta مناسب',descLen>=70&&descLen<=160?'pass':'warn','warning',`الطول الحالي: ${descLen} حرفاً`),
    check('body-h1','لا يوجد H1 داخل جسم المقال',bodyH1Count===0?'pass':'warn','warning',bodyH1Count===0?'عنوان الصفحة يملك H1 الوحيد.':`تم العثور على ${bodyH1Count} H1 داخل المحتوى.`),
    check('heading-hierarchy','تسلسل العناوين دون قفزات',html.skippedLevels===0?'pass':'warn','warning',html.skippedLevels===0?`${html.headings.length} عنواناً فرعياً دون قفزات.`:`${html.skippedLevels} قفزة في مستويات H2-H6.`),
    check('image-alt','النص البديل للصور مكتمل',html.missingAlt===0?'pass':'warn','warning',`${html.totalImages} صورة، منها ${html.missingAlt} بلا alt واضح.`),
    check('internal-links','الروابط الداخلية سليمة',brokenInternal.length===0?'pass':'fail',brokenInternal.length===0?'info':'blocking',brokenInternal.length===0?`${internal} رابطاً داخلياً تم فحصه.`:`${brokenInternal.length} رابط داخلي غير مطابق لمقال منشور.`),
    check('media-links','وسائط المقال المتحكم بها موجودة',brokenMedia.length===0?'pass':'fail',brokenMedia.length===0?'info':'blocking',brokenMedia.length===0?`${mediaRefs.length} مرجع وسائط متحكم به تم فحصه.`:`${brokenMedia.length} مرجع وسائط مفقود.`),
    check('url-format','صيغة الروابط صالحة',malformed.length===0?'pass':'warn','warning',malformed.length===0?'لا توجد روابط بصيغة غير صالحة.':`${malformed.length} رابط بصيغة غير صالحة.`),
    check('cannibalization','لا يوجد تضارب موضوعي مرتفع',topDuplicates.some((item)=>item.similarity>=0.72)?'fail':topDuplicates.length?'warn':'pass',topDuplicates.some((item)=>item.similarity>=0.72)?'blocking':topDuplicates.length?'warning':'info',topDuplicates.length?`أعلى تشابه: ${Math.round(topDuplicates[0].similarity*100)}%.`:'لا توجد مقالات منشورة متشابهة بما يكفي.'),
    check('indexing','حالة الفهرسة والخريطة واضحة',publicationStatus==='PUBLISHED'&&!indexable?'warn':'pass',publicationStatus==='PUBLISHED'&&!indexable?'warning':'info',publicationStatus==='PUBLISHED'?(indexable?'منشور ومؤهل للفهرسة والخريطة.':'منشور لكن robots=noindex؛ مستبعد من الخريطة.'):'غير منشور؛ لن يظهر في الخريطة حتى النشر.'),
  ];
  let score=100;for(const item of checks){if(item.status==='fail')score-=item.severity==='blocking'?16:12;else if(item.status==='warn')score-=6;}score=Math.max(0,Math.min(100,score));
  return {score,checks,duplicateCandidates:topDuplicates,heading:{count:html.headings.length,bodyH1Count,skippedLevels:html.skippedLevels},images:{total:html.totalImages,missingAlt:html.missingAlt},links:{internal,external,brokenInternal:[...new Set(brokenInternal)].slice(0,12),malformed:[...new Set(malformed)].slice(0,12)},media:{checked:new Set(mediaRefs).size,broken:[...new Set(brokenMedia)].slice(0,12)},indexing:{publicationStatus,robots,indexable,sitemapEligible,sitemapIncluded:sitemapEligible,expectedCanonical,canonicalMatches}};
}

function deterministicAuditIssues(audit:ArticleSeoAudit):string[]{return audit.checks.filter((item)=>item.status!=='pass').map((item)=>`${item.label}: ${item.detail}`).slice(0,12);}
export async function analyzeArticleSeo(input: ArticleSeoAgentInput): Promise<ArticleSeoAgentProposal> {
  const fallback = buildHeuristicFields(input);
  const links = await relatedArticles(input).catch(() => [] as ArticleSeoAgentLink[]);
  const auditBefore = await analyzeSeoAudit(input);
  const auditAfter = await analyzeSeoAudit({ ...input, ...fallback });
  const before = Math.min(scoreFields(input), auditBefore.score);
  const base: ArticleSeoAgentProposal = {
    mode: "heuristic",
    provider: getAiProvider(),
    model: getAiModel(),
    scoreBefore: before,
    scoreAfter: Math.min(scoreFields({ ...input, ...fallback }), auditAfter.score),
    summary: "تم إعداد تحسينات SEO أساسية واقتراح روابط داخلية من محتوى موطني المنشور.",
    fields: fallback,
    issues: deterministicAuditIssues(auditBefore),
    contentRecommendations: ["استخدم عنوان H2 واضحاً لكل محور رئيسي.", "اجعل الفقرة الافتتاحية تجيب مباشرة عن موضوع المقال."],
    siteRecommendations: links.length ? ["أضف روابط داخلية إلى المقالات المرتبطة أدناه لزيادة الترابط الموضوعي."] : ["لا توجد روابط داخلية قوية كفاية حالياً؛ راجع بنية المحتوى المرتبط."],
    internalLinks: links.slice(0, 4),
    audit: auditBefore,
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
    deterministicAudit: { score: auditBefore.score, checks: auditBefore.checks, duplicateCandidates: auditBefore.duplicateCandidates, indexing: auditBefore.indexing },
  };  const instruction = `Analyze this draft and return JSON with this exact shape: {"fields":{"seoTitle":"","seoDescription":"","focusKeyphrase":"","canonicalUrl":"","robots":"index,follow","ogTitle":"","ogDescription":"","ogImage":"","excerpt":""},"summary":"","issues":[],"contentRecommendations":[],"siteRecommendations":[],"internalLinks":[{"url":"","anchor":"","reason":""}]}.\nDraft: ${JSON.stringify(payload)}`;
  try {
    const raw = await ai.complete([
      { role: "system", content: system },
      { role: "user", content: instruction },
    ], { temperature: 0.2, maxTokens: 1800 });
    const parsed = extractJson(raw);
    if (!parsed) return base;
    const fields = normalizeAiFields(parsed.fields, fallback);
    const aiAudit = await analyzeSeoAudit({ ...input, ...fields });
    const proposal: ArticleSeoAgentProposal = {
      mode: "ai",
      provider: getAiProvider(),
      model: getAiModel(),
      scoreBefore: before,
      scoreAfter: Math.min(scoreFields({ ...input, ...fields }), aiAudit.score),
      summary: truncate(cleanText(parsed.summary) || base.summary, 500),
      fields,
      issues: Array.from(new Set([...deterministicAuditIssues(auditBefore), ...stringArray(parsed.issues, 10)])).slice(0, 12),
      contentRecommendations: stringArray(parsed.contentRecommendations, 10),
      siteRecommendations: stringArray(parsed.siteRecommendations, 10),
      internalLinks: allowedLinks(parsed.internalLinks, links),
      audit: auditBefore,
    };
    if (!proposal.contentRecommendations.length) proposal.contentRecommendations = base.contentRecommendations;
    if (!proposal.siteRecommendations.length) proposal.siteRecommendations = base.siteRecommendations;
    return proposal;
  } catch {
    return base;
  }
}
