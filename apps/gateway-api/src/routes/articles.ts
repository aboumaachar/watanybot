import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { FastifyPluginAsync } from "fastify";
import { resolveArticleMediaPath, mimeForMediaFile } from "../cms/articles/articleMediaStorage.js";
import { query } from "../lib/db.js";

type CmsRow = {
  public_id: string;
  public_code: string | null;
  title: string;
  payload: Record<string, unknown>;
  published_at: string | null;
  updated_at?: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try { return asObject(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function positiveIntOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toListItem(row: CmsRow) {
  const p = asObject(row.payload);
  return {
    id: row.public_id,
    slug: row.public_code || String(p.slug || row.public_id),
    title: row.title,
    excerpt: stringOrNull(p.excerpt),
    publishedAt: row.published_at || p.publishedAtLocal || null,
    updatedAt: row.updated_at || null,
    authorName: stringOrNull(p.authorName),
    authorUserId: stringOrNull(p.authorUserId),
    featuredImage: stringOrNull(p.featuredImage),
    categories: stringArray(p.categories),
    primaryCategory: stringOrNull(p.primaryCategory) || stringArray(p.categories)[0] || null,
    permalinkSlug: stringOrNull(p.permalinkSlug),
    tags: stringArray(p.tags),
    permalinkHistory: stringArray(p.permalinkHistory),
    legacyUrl: stringOrNull(p.legacyUrl),
    seo: {
      title: stringOrNull(p.seoTitle),
      description: stringOrNull(p.seoDescription),
      canonicalUrl: stringOrNull(p.canonicalUrl),
      robots: stringOrNull(p.robots),
      ogTitle: stringOrNull(p.ogTitle),
      ogDescription: stringOrNull(p.ogDescription),
      ogImage: stringOrNull(p.ogImage),
      ogImageWidth: positiveIntOrNull(p.ogImageWidth),
      ogImageHeight: positiveIntOrNull(p.ogImageHeight),
      ogImageAlt: stringOrNull(p.ogImageAlt),
    },
  };
}

const ARTICLE_PUBLIC_ORIGIN = "https://koudama.com";
const ARTICLE_DEFAULT_SHARE_IMAGE = `${ARTICLE_PUBLIC_ORIGIN}/logo.png?v=20260827-1`;
const ARTICLE_SHARE_IMAGE_WIDTH = 1200;
const ARTICLE_SHARE_IMAGE_HEIGHT = 630;
const ARTICLE_SHARE_IMAGE_RECIPE = "jpeg-1200x630-q82-baseline-v2";
const ARTICLE_SHARE_PREVIEW_VERSION = "watany-wa-20261008-v3";
const execFileAsync = promisify(execFile);
const ARTICLE_COMMENT_WINDOW_MS = 5 * 60 * 1000;
const ARTICLE_COMMENT_MAX_PER_WINDOW = 5;
const articleCommentRate = new Map<string, { count: number; resetAt: number }>();
type ArticleCommentRow = { id: string; article_id: string; author_name: string; body: string; created_at: string };
function normalizeArticleComment(value: unknown): string {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}
function takeArticleCommentRate(ip: string): boolean {
  const now = Date.now();
  const current = articleCommentRate.get(ip);
  if (!current || current.resetAt <= now) {
    articleCommentRate.set(ip, { count: 1, resetAt: now + ARTICLE_COMMENT_WINDOW_MS });
    return true;
  }
  if (current.count >= ARTICLE_COMMENT_MAX_PER_WINDOW) return false;
  current.count += 1;
  return true;
}
function publicArticleComment(row: ArticleCommentRow) {
  return { id: row.id, articleId: row.article_id, authorName: row.author_name, body: row.body, createdAt: row.created_at };
}

const ARTICLE_ARABIC_LATIN: Record<string, string> = {"ا":"a","أ":"a","إ":"i","آ":"a","ب":"b","ت":"t","ث":"th","ج":"j","ح":"h","خ":"kh","د":"d","ذ":"dh","ر":"r","ز":"z","س":"s","ش":"sh","ص":"s","ض":"d","ط":"t","ظ":"z","ع":"a","غ":"gh","ف":"f","ق":"q","ك":"k","ل":"l","م":"m","ن":"n","ه":"h","ة":"a","و":"w","ؤ":"w","ي":"y","ى":"a","ئ":"y","ء":""};
function articleAsciiSlug(value: string): string { return Array.from(value.normalize("NFKD")).map((c) => ARTICLE_ARABIC_LATIN[c] ?? c).join("").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,110) || "article"; }
function articleCategorySlug(categories: string[], primaryCategory?: string | null): string { return articleAsciiSlug(primaryCategory || categories[0] || "articles"); }
function articleHtmlEscape(value: unknown): string { return String(value ?? "").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] || c)); }
function articleAbsoluteUrl(value: string | null): string { if (!value) return ARTICLE_DEFAULT_SHARE_IMAGE; try { return new URL(value, ARTICLE_PUBLIC_ORIGIN).toString(); } catch { return ARTICLE_DEFAULT_SHARE_IMAGE; } }
function articleShareSourceImage(item: ReturnType<typeof publicArticleItem>): string {
  return articleAbsoluteUrl(item.seo.ogImage || item.featuredImage || ARTICLE_DEFAULT_SHARE_IMAGE);
}
function articleShareImageVersion(row: CmsRow, sourceImage: string): string {
  return createHash("sha256").update(`${ARTICLE_SHARE_IMAGE_RECIPE}\0${sourceImage}\0${row.updated_at || row.published_at || ""}`).digest("hex").slice(0, 16);
}
function articleShareImageFileName(row: CmsRow, sourceImage: string): string {
  const articleKey = createHash("sha256").update(row.public_id).digest("hex").slice(0, 24);
  return `${articleKey}-${articleShareImageVersion(row, sourceImage)}.jpg`;
}
function articleShareImageUrl(row: CmsRow, item: ReturnType<typeof publicArticleItem>, sourceImage = articleShareSourceImage(item)): string {
  return `${ARTICLE_PUBLIC_ORIGIN}/media/share/articles/${articleShareImageFileName(row, sourceImage)}`;
}
function articleLocalShareSourcePath(imageUrl: string): string | null {
  try {
    const parsed = new URL(imageUrl, ARTICLE_PUBLIC_ORIGIN);
    if (parsed.origin !== ARTICLE_PUBLIC_ORIGIN) return null;
    const pathname = decodeURIComponent(parsed.pathname);
    const articleMediaPrefixes = ["/mcp/api/articles/media/", "/api/articles/media/"];
    for (const prefix of articleMediaPrefixes) {
      if (pathname.startsWith(prefix)) {
        const fileName = pathname.slice(prefix.length);
        return resolveArticleMediaPath(fileName);
      }
    }
    const publicRoot = path.resolve(String(process.env.WATANY_PUBLIC_WEBROOT || "/home/koudama/public_html"));
    if (pathname.startsWith("/media/archive/") || pathname.startsWith("/media/social/articles/")) {
      const mediaRoot = path.resolve(publicRoot, "media");
      const resolved = path.resolve(publicRoot, `.${pathname}`);
      if (resolved.startsWith(`${mediaRoot}${path.sep}`)) return resolved;
      return null;
    }
    if (pathname === "/logo.png") return path.join(publicRoot, "logo.png");
  } catch {
    return null;
  }
  return null;
}
async function ensureArticleShareImage(row: CmsRow, sourceImage: string, version: string): Promise<string | null> {
  const sourcePath = articleLocalShareSourcePath(sourceImage);
  if (!sourcePath) return null;
  try {
    const sourceInfo = await stat(sourcePath);
    if (!sourceInfo.isFile()) return null;
  } catch {
    return null;
  }
  const publicRoot = path.resolve(String(process.env.WATANY_PUBLIC_WEBROOT || "/home/koudama/public_html"));
  const cacheDir = path.join(publicRoot, "media", "share", "articles");
  await mkdir(cacheDir, { recursive: true });
  const target = path.join(cacheDir, articleShareImageFileName(row, sourceImage));
  try {
    const cached = await stat(target);
    if (cached.isFile() && cached.size > 0) return target;
  } catch {
    // Generate on first social-crawler request.
  }
  const temp = `${target}.${randomUUID()}.tmp.jpg`;
  try {
    await execFileAsync("convert", [
      sourcePath,
      "-auto-orient",
      "-thumbnail", `${ARTICLE_SHARE_IMAGE_WIDTH}x${ARTICLE_SHARE_IMAGE_HEIGHT}^`,
      "-gravity", "center",
      "-extent", `${ARTICLE_SHARE_IMAGE_WIDTH}x${ARTICLE_SHARE_IMAGE_HEIGHT}`,
      "-strip",
      "-quality", "82",
      temp,
    ], { timeout: 20_000, maxBuffer: 1024 * 1024 });
    await rename(temp, target);
    return target;
  } catch {
    await unlink(temp).catch(() => {});
    return null;
  }
}
async function prepareArticleShareImage(row: CmsRow): Promise<void> {
  const item = publicArticleItem(row);
  const sourceImage = articleShareSourceImage(item);
  const version = articleShareImageVersion(row, sourceImage);
  await ensureArticleShareImage(row, sourceImage, version);
}
const ARTICLE_GENERIC_PERMALINK_SLUGS = new Set(["article", "post", "byan"]);
function articleCanonicalSlug(item: ReturnType<typeof toListItem>): string {
  const rawPermalink = String(item.permalinkSlug || "").trim();
  const permalink = rawPermalink ? articleAsciiSlug(rawPermalink) : "";
  if (permalink && !ARTICLE_GENERIC_PERMALINK_SLUGS.has(permalink)) return permalink;
  const rawSourceSlug = String(item.slug || "").trim();
  if (rawSourceSlug) return articleAsciiSlug(rawSourceSlug);
  return articleAsciiSlug(item.title);
}
function articleCanonicalPath(item: ReturnType<typeof toListItem>): string { return `/articles/${articleCategorySlug(item.categories,item.primaryCategory)}/${articleCanonicalSlug(item)}`; }
function articleArchiveUrl(category="",page=1,q=""): string {
  const query=new URLSearchParams();
  if(category)query.set("category",category);
  if(q)query.set("q",q);
  if(page>1)query.set("page",String(page));
  const suffix=query.toString();
  return ARTICLE_PUBLIC_ORIGIN+"/articles"+(suffix?"?"+suffix:"");
}
function publicArticleItem(row: CmsRow) {
  const item=toListItem(row);
  return {...item,seo:{...item.seo,canonicalUrl:`${ARTICLE_PUBLIC_ORIGIN}${articleCanonicalPath(item)}`}};
}
function articleJsonScript(value: unknown): string { return JSON.stringify(value).replace(/</g,"\\u003c"); }
function articleSocialPreviewHtml(row: CmsRow): string {
  const item=publicArticleItem(row); const payload=asObject(row.payload); const canonical=`${ARTICLE_PUBLIC_ORIGIN}${articleCanonicalPath(item)}`;
  const sourceImage=articleShareSourceImage(item);
  const imageVersion=articleShareImageVersion(row,sourceImage);
  const image=articleShareImageUrl(row,item,sourceImage);
  const shareObjectUrl=`${canonical}?share=${ARTICLE_SHARE_PREVIEW_VERSION}`;
  const title=item.seo.ogTitle||item.seo.title||item.title;
  const description=item.seo.ogDescription||item.seo.description||item.excerpt||"مقال منشور على منصة موطني.";
  const imageType="image/jpeg";
  const imageDimensions=`<meta property="og:image:width" content="${ARTICLE_SHARE_IMAGE_WIDTH}"><meta property="og:image:height" content="${ARTICLE_SHARE_IMAGE_HEIGHT}">`;
  const imageAlt=item.seo.ogImageAlt||item.title;
  const articleSchema={"@context":"https://schema.org","@type":"Article",headline:item.title,description,image:[image],datePublished:item.publishedAt||undefined,dateModified:item.updatedAt||item.publishedAt||undefined,author:{"@type":"Person",name:item.authorName||"موطني"},publisher:{"@type":"Organization",name:"موطني",logo:{"@type":"ImageObject",url:ARTICLE_DEFAULT_SHARE_IMAGE}},mainEntityOfPage:canonical,articleSection:item.primaryCategory||item.categories[0]||undefined};
  const breadcrumbSchema={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"موطني",item:ARTICLE_PUBLIC_ORIGIN},{"@type":"ListItem",position:2,name:"المقالات",item:`${ARTICLE_PUBLIC_ORIGIN}/articles`},{"@type":"ListItem",position:3,name:item.primaryCategory||item.categories[0]||"المقالات",item:`${ARTICLE_PUBLIC_ORIGIN}/articles/${articleCategorySlug(item.categories,item.primaryCategory)}`},{"@type":"ListItem",position:4,name:item.title,item:canonical}]};
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${articleHtmlEscape(item.seo.title||item.title)} | موطني</title><meta name="description" content="${articleHtmlEscape(description)}"><link rel="canonical" href="${articleHtmlEscape(canonical)}"><meta name="robots" content="${articleHtmlEscape(item.seo.robots||"index,follow")}"><meta property="og:type" content="article"><meta property="og:site_name" content="موطني"><meta property="og:locale" content="ar_LB"><meta property="og:url" content="${articleHtmlEscape(shareObjectUrl)}"><meta property="og:title" content="${articleHtmlEscape(title)}"><meta property="og:description" content="${articleHtmlEscape(description)}"><meta property="og:image" content="${articleHtmlEscape(image)}"><meta property="og:image:url" content="${articleHtmlEscape(image)}"><meta property="og:image:secure_url" content="${articleHtmlEscape(image)}"><meta property="og:image:type" content="${imageType}">${imageDimensions}<meta property="og:image:alt" content="${articleHtmlEscape(imageAlt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${articleHtmlEscape(title)}"><meta name="twitter:description" content="${articleHtmlEscape(description)}"><meta name="twitter:image" content="${articleHtmlEscape(image)}"><script type="application/ld+json">${articleJsonScript(articleSchema)}</script><script type="application/ld+json">${articleJsonScript(breadcrumbSchema)}</script></head><body><main><h1>${articleHtmlEscape(item.title)}</h1><p><a href="${articleHtmlEscape(canonical)}">فتح المقال على موطني</a></p></main></body></html>`;
}

function articleSearchBodyHtml(value: unknown): string {
  let html=typeof value==="string"?value:"";
  html=html.replace(/<!--[\s\S]*?-->/gu," ")
    .replace(/<(script|style|iframe|object|embed|form|svg|math|button|textarea|select)\b[\s\S]*?<\/\1\s*>/giu," ")
    .replace(/<(script|style|iframe|object|embed|form|svg|math|button|input|textarea|select)\b[^>]*\/?\s*>/giu," ");
  const allowed=new Set(["p","h1","h2","h3","h4","ul","ol","li","strong","b","em","i","blockquote","br","hr","a","table","thead","tbody","tr","th","td"]);
  html=html.replace(/<([a-z0-9]+)\b([^>]*)>/giu,(full,rawTag,attrs)=>{const tag=String(rawTag).toLowerCase();if(!allowed.has(tag))return "";const outTag=tag==="h1"?"h2":tag;if(tag!=="a")return `<${outTag}>`;const match=String(attrs).match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu);const href=(match?.[1]||match?.[2]||match?.[3]||"").trim();const safe=/^https?:\/\//iu.test(href)||(/^\//u.test(href)&&!/^\/\//u.test(href));return safe?`<a href="${articleHtmlEscape(href)}" rel="noopener noreferrer">`:"<a>";});
  html=html.replace(/<\/([a-z0-9]+)\s*>/giu,(full,rawTag)=>{const tag=String(rawTag).toLowerCase();if(!allowed.has(tag)||tag==="br"||tag==="hr")return "";return `</${tag==="h1"?"h2":tag}>`;});
  return html;
}
function articleSearchPreviewHtml(row: CmsRow): string {
  const item=publicArticleItem(row);
  const payload=asObject(row.payload);
  const body=articleSearchBodyHtml(payload.bodyHtml);
  const canonical=`${ARTICLE_PUBLIC_ORIGIN}${articleCanonicalPath(item)}`;
  const byline=item.authorName?`<p>${articleHtmlEscape(item.authorName)}</p>`:"";
  const category=item.primaryCategory||item.categories[0]||"";
  const nav=`<nav aria-label="التنقل بين المقالات"><a href="${ARTICLE_PUBLIC_ORIGIN}/articles">كل المقالات</a>${category?` | <a href="${articleArchiveUrl(category)}">${articleHtmlEscape(category)}</a>`:""}</nav>`;
  const fullBody=`<body><main>${nav}<article><header><h1>${articleHtmlEscape(item.title)}</h1>${byline}</header>${body}<p><a href="${articleHtmlEscape(canonical)}">فتح المقال على موطني</a></p></article></main></body>`;
  return articleSocialPreviewHtml(row).replace(/<body>[\s\S]*<\/body>/u,fullBody);
}

export const articleRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { articleId: string; version: string } }>("/api/articles/share-image/:articleId/:version", { config: { rateLimit: false } }, async (request, reply) => {
    const articleId = decodeURIComponent(request.params.articleId).trim();
    const requestedVersion = String(request.params.version || "").replace(/\.jpg$/i, "");
    const result = await query<CmsRow>(
      `SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities
       WHERE domain='articles' AND status='PUBLISHED' AND public_id=$1 LIMIT 1`,
      [articleId],
    );
    const row = result.rows[0];
    if (!row) return reply.code(404).send({ error: "ARTICLE_NOT_FOUND" });
    const item = publicArticleItem(row);
    const sourceImage = articleShareSourceImage(item);
    const expectedVersion = articleShareImageVersion(row, sourceImage);
    if (requestedVersion !== expectedVersion) {
      return reply.redirect(articleShareImageUrl(row, item, sourceImage));
    }
    const imagePath = await ensureArticleShareImage(row, sourceImage, expectedVersion);
    if (!imagePath) return reply.redirect(sourceImage);
    const info = await stat(imagePath);
    reply.header("Content-Type", "image/jpeg");
    reply.header("Content-Length", String(info.size));
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(createReadStream(imagePath));
  });

  app.get<{ Params: { fileName: string } }>("/api/articles/media/:fileName", async (request, reply) => {
    const fileName = request.params.fileName;
    const filePath = resolveArticleMediaPath(fileName);
    const mimeType = mimeForMediaFile(fileName);
    if (!filePath || !mimeType) return reply.code(404).send({ error: "ARTICLE_MEDIA_NOT_FOUND" });
    try {
      const info = await stat(filePath);
      if (!info.isFile()) return reply.code(404).send({ error: "ARTICLE_MEDIA_NOT_FOUND" });
      reply.header("Content-Type", mimeType);
      reply.header("Content-Length", String(info.size));
      reply.header("Cache-Control", "public, max-age=300, must-revalidate");
      return reply.send(createReadStream(filePath));
    } catch {
      return reply.code(404).send({ error: "ARTICLE_MEDIA_NOT_FOUND" });
    }
  });

  app.post<{ Params: { id: string }; Body: { event?: unknown; path?: unknown } }>("/api/articles/:id/engagement", async (request, reply) => {
    const articleId=String(request.params.id||"").trim().slice(0,160);
    const rawEvent=typeof request.body?.event==="string"?request.body.event.trim():"";
    const eventMap:Record<string,string>={view:"article_view",share:"article_share",pdf_download:"article_pdf_download",internal_link:"article_internal_link"};
    const eventType=eventMap[rawEvent];
    if(!articleId||!eventType)return reply.code(400).send({ok:false,error:"ARTICLE_ENGAGEMENT_INVALID"});
    const pathValue=typeof request.body?.path==="string"?request.body.path.slice(0,300):"";
    const inserted=await query<{id:number}>(`INSERT INTO watany_analytics_events(event_type,event_data) SELECT $1::varchar(50),jsonb_build_object('articleId',$2::text,'path',$3::text) WHERE EXISTS (SELECT 1 FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' AND public_id=$2::text) RETURNING id`,[eventType,articleId,pathValue]);
    if(!inserted.rowCount)return reply.code(404).send({ok:false,error:"ARTICLE_NOT_FOUND"});
    reply.header("Cache-Control","no-store");
    return reply.code(202).send({ok:true});
  });

  app.get<{ Querystring: { category?: string; q?: string; limit?: string; offset?: string } }>("/api/articles", async (request) => {
    const category = String(request.query.category || "").trim();
    const q = String(request.query.q || "").trim();
    const limit = Math.min(Math.max(Number(request.query.limit || 50) || 50, 1), 100);
    const offset = Math.max(Number(request.query.offset || 0) || 0, 0);
    const params: unknown[] = [];
    const where = ["domain='articles'", "status='PUBLISHED'"];
    if (category) {
      params.push(category);
      where.push(`payload->'categories' ? $${params.length}`);
    }
    if (q) {
      params.push(`%${q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`);
      where.push(`(title ILIKE $${params.length} ESCAPE '\\' OR COALESCE(payload->>'bodyHtml','') ILIKE $${params.length} ESCAPE '\\')`);
    }
    params.push(limit, offset);
    const rows = await query<CmsRow>(
      `SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities
       WHERE ${where.join(" AND ")} ORDER BY published_at DESC NULLS LAST,public_id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.rows.map(publicArticleItem), limit, offset };
  });

  app.get<{ Params: { id: string } }>("/api/articles/:id/discovery", async (request, reply) => {
    const articleId = decodeURIComponent(request.params.id).trim();
    const all = await query<CmsRow>(`SELECT public_id,public_code,title,payload,published_at,updated_at
      FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED'
      ORDER BY published_at DESC NULLS LAST,updated_at DESC NULLS LAST,public_id ASC`);
    const index = all.rows.findIndex((row) => row.public_id === articleId);
    if (index < 0) return reply.code(404).send({ error: "ARTICLE_NOT_FOUND" });
    const current = publicArticleItem(all.rows[index]);
    const categories = new Set(current.categories);
    const latest = all.rows.filter((row) => row.public_id !== articleId).slice(0, 5).map(publicArticleItem);
    const related = all.rows
      .filter((row) => row.public_id !== articleId && publicArticleItem(row).categories.some((category) => categories.has(category)))
      .slice(0, 5)
      .map(publicArticleItem);
    const ranked = await query<CmsRow & { views_30d: number | string }>(`SELECT c.public_id,c.public_code,c.title,c.payload,c.published_at,c.updated_at,
      COALESCE(v.views_30d,0)::int AS views_30d
      FROM cms_content_entities c
      LEFT JOIN (
        SELECT event_data->>'articleId' AS article_id,COUNT(*)::int AS views_30d
        FROM watany_analytics_events
        WHERE event_type='article_view' AND created_at>=NOW()-INTERVAL '30 days'
        GROUP BY event_data->>'articleId'
      ) v ON v.article_id=c.public_id
      WHERE c.domain='articles' AND c.status='PUBLISHED' AND c.public_id<>$1
      ORDER BY COALESCE(v.views_30d,0) DESC,c.published_at DESC NULLS LAST,c.public_id ASC LIMIT 5`, [articleId]);
    return {
      previous: index < all.rows.length - 1 ? publicArticleItem(all.rows[index + 1]) : null,
      next: index > 0 ? publicArticleItem(all.rows[index - 1]) : null,
      latest,
      related,
      mostRead: ranked.rows.map((row) => ({ ...publicArticleItem(row), views30d: Number(row.views_30d) || 0 })),
    };
  });

  app.get<{ Params: { id: string } }>("/api/articles/:id/comments", async (request, reply) => {
    const articleId = decodeURIComponent(request.params.id).trim();
    const exists = await query<{ public_id: string }>(`SELECT public_id FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' AND public_id=$1 LIMIT 1`, [articleId]);
    if (!exists.rowCount) return reply.code(404).send({ error: "ARTICLE_NOT_FOUND" });
    const rows = await query<ArticleCommentRow>(`SELECT id::text,article_id,author_name,body,created_at::text FROM article_comments
      WHERE article_id=$1 AND status='PUBLISHED' ORDER BY created_at ASC,id ASC LIMIT 200`, [articleId]);
    reply.header("Cache-Control", "no-store");
    return { items: rows.rows.map(publicArticleComment) };
  });

  app.post<{ Params: { id: string }; Body: { authorName?: unknown; body?: unknown; website?: unknown } }>("/api/articles/:id/comments", async (request, reply) => {
    const articleId = decodeURIComponent(request.params.id).trim();
    const honeypot = normalizeArticleComment(request.body?.website);
    if (honeypot) return reply.code(202).send({ ok: true });
    const authorName = normalizeArticleComment(request.body?.authorName) || "قارئ موطني";
    const body = normalizeArticleComment(request.body?.body);
    if (!body) return reply.code(400).send({ error: "ARTICLE_COMMENT_BODY_REQUIRED" });
    if (body.length > 2000) return reply.code(400).send({ error: "ARTICLE_COMMENT_BODY_TOO_LONG" });
    if (authorName.length > 80) return reply.code(400).send({ error: "ARTICLE_COMMENT_AUTHOR_TOO_LONG" });
    if (!takeArticleCommentRate(request.ip || "unknown")) return reply.code(429).send({ error: "ARTICLE_COMMENT_RATE_LIMIT" });
    const inserted = await query<ArticleCommentRow>(`INSERT INTO article_comments(article_id,author_name,body)
      SELECT $1,$2,$3 WHERE EXISTS (
        SELECT 1 FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' AND public_id=$1
      ) RETURNING id::text,article_id,author_name,body,created_at::text`, [articleId, authorName, body]);
    const row = inserted.rows[0];
    if (!row) return reply.code(404).send({ error: "ARTICLE_NOT_FOUND" });
    await query(`INSERT INTO watany_analytics_events(event_type,event_data) VALUES ('article_comment',jsonb_build_object('articleId',$1::text,'commentId',$2::text))`, [articleId, row.id]);
    reply.header("Cache-Control", "no-store");
    return reply.code(201).send({ item: publicArticleComment(row) });
  });

  // Public search-crawler archive: real links for every page and active category.
  app.get<{ Querystring: { category?: string; q?: string; page?: string } }>("/api/articles/search-archive", { config: { rateLimit: false } }, async (request, reply) => {
    const category=String(request.query.category||"").trim();
    const q=String(request.query.q||"").trim();
    const requestedPage=Number(request.query.page||"1");
    const page=Number.isInteger(requestedPage)&&requestedPage>=1&&requestedPage<=1000?requestedPage:1;
    const pageSize=50;
    const filters=["domain='articles'","status='PUBLISHED'","COALESCE(payload->>'robots','index,follow') NOT LIKE 'noindex%'"];
    const bindings:unknown[]=[];
    if(category){bindings.push(category);filters.push("payload->'categories' ? $"+bindings.length);}
    if(q){
      bindings.push("%"+q.replace(/[\\%_]/g,(character)=>"\\"+character)+"%");
      const index=bindings.length;
      filters.push("(title ILIKE $"+index+" ESCAPE '\\' OR COALESCE(payload->>'bodyHtml','') ILIKE $"+index+" ESCAPE '\\')");
    }
    bindings.push(pageSize+1,(page-1)*pageSize);
    const rows=await query<CmsRow>(
      "SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities WHERE "+
      filters.join(" AND ")+" ORDER BY published_at DESC NULLS LAST,public_id ASC LIMIT $"+
      (bindings.length-1)+" OFFSET $"+bindings.length,bindings,
    );
    const categories=await query<{title:string}>(
      "SELECT title FROM cms_content_entities WHERE domain='article-categories' AND status='PUBLISHED' ORDER BY title",
    );
    const hasNext=rows.rows.length>pageSize;
    const items=rows.rows.slice(0,pageSize);
    const categoryLinks=categories.rows.map((row)=>
      '<a href="'+articleHtmlEscape(articleArchiveUrl(row.title))+'">'+articleHtmlEscape(row.title)+"</a>"
    ).join(" | ");
    const articleLinks=items.map((row)=>{
      const item=toListItem(row);
      return '<li><a href="'+articleHtmlEscape(ARTICLE_PUBLIC_ORIGIN+articleCanonicalPath(item))+'">'+articleHtmlEscape(item.title)+"</a></li>";
    }).join("");
    const previous=page>1?'<a href="'+articleHtmlEscape(articleArchiveUrl(category,page-1,q))+'">الصفحة السابقة</a>':"";
    const next=hasNext?'<a href="'+articleHtmlEscape(articleArchiveUrl(category,page+1,q))+'">الصفحة التالية</a>':"";
    const canonical=articleArchiveUrl(category,page,q);
    const title=category?"مقالات "+category+" | موطني":"المقالات والأرشيف | موطني";
    const html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<title>'+articleHtmlEscape(title)+'</title><meta name="description" content="أرشيف مقالات موطني المنشورة">'+
      '<meta name="robots" content="'+(q?"noindex,follow":"index,follow")+'"><link rel="canonical" href="'+articleHtmlEscape(canonical)+'"></head>'+
      '<body><main><h1>'+articleHtmlEscape(title)+'</h1><nav aria-label="تصنيفات المقالات"><a href="'+ARTICLE_PUBLIC_ORIGIN+'/articles">الكل</a> | '+categoryLinks+
      '</nav><ol>'+articleLinks+'</ol><nav aria-label="صفحات المقالات">'+previous+' <span>الصفحة '+page+'</span> '+next+
      '</nav></main></body></html>';
    reply.header("Cache-Control","public, max-age=300, must-revalidate");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/api/articles/sitemap.xml", async (_request, reply) => {
    const rows = await query<CmsRow & { updated_at: string | null }>(`SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' AND COALESCE(payload->>'robots','index,follow') NOT LIKE 'noindex%' ORDER BY published_at DESC NULLS LAST,public_id ASC`);
    const xmlEscape=(value:string)=>value.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]||c));
    const seenLocations = new Set<string>();
    const articleUrls = rows.rows.flatMap((row) => {
      const item = toListItem(row);
      const loc = `${ARTICLE_PUBLIC_ORIGIN}${articleCanonicalPath(item)}`;
      if (seenLocations.has(loc)) return [];
      seenLocations.add(loc);
      const lastmod = row.updated_at || row.published_at;
      return [`<url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${xmlEscape(new Date(lastmod).toISOString())}</lastmod>` : ""}</url>`];
    });
    const urls=[`<url><loc>${ARTICLE_PUBLIC_ORIGIN}/articles</loc></url>`, ...articleUrls];
    const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
    reply.header("Cache-Control","public, max-age=300, must-revalidate");
    return reply.type("application/xml; charset=utf-8").send(xml);
  });

  app.get("/api/articles/categories", async () => {
    const rows = await query<{ public_id: string; public_code: string | null; title: string; count: number }>(
      `SELECT c.public_id,c.public_code,c.title,COUNT(r.entity_id)::int AS count
       FROM cms_content_entities c
       LEFT JOIN cms_content_relationships r ON r.target_domain='article-categories' AND r.target_public_id=c.public_id AND r.relation_type='category'
       WHERE c.domain='article-categories' AND c.status='PUBLISHED'
       GROUP BY c.public_id,c.public_code,c.title ORDER BY c.title ASC`,
    );
    return {
      categories: rows.rows.map((row) => ({
        id: row.public_id,
        slug: row.public_code,
        name: row.title,
        count: Number(row.count),
      })),
    };
  });

  app.get<{ Params: { category: string; slug: string } }>("/api/articles/social-preview/:category/:slug", { config: { rateLimit: false } }, async (request, reply) => {
    const category=decodeURIComponent(request.params.category); const slug=decodeURIComponent(request.params.slug); const requestedPath=`/articles/${category}/${slug}`;
    const result=await query<CmsRow>(`SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' ORDER BY published_at DESC NULLS LAST,public_id ASC`);
    const current=result.rows.find((candidate)=>articleCanonicalPath(toListItem(candidate))===requestedPath);
    const row=current||result.rows.find((candidate)=>toListItem(candidate).permalinkHistory.includes(requestedPath));
    if(!row)return reply.code(404).type("text/html; charset=utf-8").send("<!doctype html><meta charset=utf-8><title>Article not found</title>");
    const canonical=`${ARTICLE_PUBLIC_ORIGIN}${articleCanonicalPath(toListItem(row))}`;
    if(!current)return reply.code(301).header("Location",canonical).send();
    await prepareArticleShareImage(row);
    reply.header("Cache-Control","public, max-age=0, must-revalidate"); return reply.type("text/html; charset=utf-8").send(articleSocialPreviewHtml(row));
  });
  app.get<{ Params: { slug: string } }>("/api/articles/social-preview-legacy/:slug", { config: { rateLimit: false } }, async (request, reply) => {
    const slug=decodeURIComponent(request.params.slug); const result=await query<CmsRow>(`SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' AND (public_code=$1 OR public_id=$1) LIMIT 1`,[slug]); const row=result.rows[0];
    if(!row)return reply.code(404).type("text/html; charset=utf-8").send("<!doctype html><meta charset=utf-8><title>Article not found</title>");
    await prepareArticleShareImage(row);
    reply.header("Cache-Control","public, max-age=0, must-revalidate"); return reply.type("text/html; charset=utf-8").send(articleSocialPreviewHtml(row));
  });

  app.get<{ Params: { category: string; slug: string } }>("/api/articles/search-preview/:category/:slug", { config: { rateLimit: false } }, async (request, reply) => {
    const category=decodeURIComponent(request.params.category); const slug=decodeURIComponent(request.params.slug); const requestedPath=`/articles/${category}/${slug}`;
    const result=await query<CmsRow>(`SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' ORDER BY published_at DESC NULLS LAST,public_id ASC`);
    const current=result.rows.find((candidate)=>articleCanonicalPath(toListItem(candidate))===requestedPath);
    const row=current||result.rows.find((candidate)=>toListItem(candidate).permalinkHistory.includes(requestedPath));
    if(!row)return reply.code(404).type("text/html; charset=utf-8").send("<!doctype html><meta charset=utf-8><title>Article not found</title>");
    const canonical=`${ARTICLE_PUBLIC_ORIGIN}${articleCanonicalPath(toListItem(row))}`;
    if(!current)return reply.code(301).header("Location",canonical).send();
    await prepareArticleShareImage(row);
    reply.header("Cache-Control","public, max-age=300, must-revalidate"); return reply.type("text/html; charset=utf-8").send(articleSearchPreviewHtml(row));
  });
  app.get<{ Params: { slug: string } }>("/api/articles/search-preview-legacy/:slug", { config: { rateLimit: false } }, async (request, reply) => {
    const slug=decodeURIComponent(request.params.slug);
    const result=await query<CmsRow>(`SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' AND (public_code=$1 OR public_id=$1) LIMIT 1`,[slug]);
    const row=result.rows[0];
    if(!row)return reply.code(404).type("text/html; charset=utf-8").send("<!doctype html><meta charset=utf-8><title>Article not found</title>");
    return reply.code(301).header("Location",`${ARTICLE_PUBLIC_ORIGIN}${articleCanonicalPath(toListItem(row))}`).send();
  });

  app.get<{ Params: { category: string; slug: string } }>("/api/articles/resolve/:category/:slug", async (request, reply) => {
    const category=decodeURIComponent(request.params.category); const slug=decodeURIComponent(request.params.slug); const requestedPath=`/articles/${category}/${slug}`;
    const result=await query<CmsRow>(`SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' ORDER BY published_at DESC NULLS LAST,public_id ASC`);
    const current=result.rows.find((candidate)=>articleCanonicalPath(toListItem(candidate))===requestedPath);
    const row=current||result.rows.find((candidate)=>toListItem(candidate).permalinkHistory.includes(requestedPath));
    if(!row)return reply.code(404).send({error:"ARTICLE_NOT_FOUND"});
    const payload=asObject(row.payload); const item=publicArticleItem(row); const canonicalPath=articleCanonicalPath(item);
    return {...item,bodyHtml:typeof payload.bodyHtml==="string"?payload.bodyHtml:"",originalWpId:payload.originalWpId??null,authorWpId:payload.authorWpId??null,authorLogin:payload.authorLogin??null,sourceMeta:typeof payload.sourceMeta==="object"?payload.sourceMeta:null,redirectTo:requestedPath===canonicalPath?null:canonicalPath};
  });

  app.get<{ Params: { slug: string } }>("/api/articles/:slug", async (request, reply) => {
    const slug = decodeURIComponent(request.params.slug);
    const result = await query<CmsRow>(
      `SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities
       WHERE domain='articles' AND status='PUBLISHED' AND (public_code=$1 OR public_id=$1) LIMIT 1`,
      [slug],
    );
    const row = result.rows[0];
    if (!row) return reply.code(404).send({ error: "ARTICLE_NOT_FOUND" });
    const payload = asObject(row.payload);
    return {
      ...publicArticleItem(row),
      bodyHtml: typeof payload.bodyHtml === "string" ? payload.bodyHtml : "",
      originalWpId: payload.originalWpId ?? null,
      authorWpId: payload.authorWpId ?? null,
      authorLogin: payload.authorLogin ?? null,
      sourceMeta: typeof payload.sourceMeta === "object" ? payload.sourceMeta : null,
    };
  });
};
