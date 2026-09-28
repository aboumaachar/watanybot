import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
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
    },
  };
}

const ARTICLE_PUBLIC_ORIGIN = "https://koudama.com";
const ARTICLE_DEFAULT_SHARE_IMAGE = `${ARTICLE_PUBLIC_ORIGIN}/logo.png?v=20260827-1`;
const ARTICLE_ARABIC_LATIN: Record<string, string> = {"ا":"a","أ":"a","إ":"i","آ":"a","ب":"b","ت":"t","ث":"th","ج":"j","ح":"h","خ":"kh","د":"d","ذ":"dh","ر":"r","ز":"z","س":"s","ش":"sh","ص":"s","ض":"d","ط":"t","ظ":"z","ع":"a","غ":"gh","ف":"f","ق":"q","ك":"k","ل":"l","م":"m","ن":"n","ه":"h","ة":"a","و":"w","ؤ":"w","ي":"y","ى":"a","ئ":"y","ء":""};
function articleAsciiSlug(value: string): string { return Array.from(value.normalize("NFKD")).map((c) => ARTICLE_ARABIC_LATIN[c] ?? c).join("").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,110) || "article"; }
function articleCategorySlug(categories: string[], primaryCategory?: string | null): string { return articleAsciiSlug(primaryCategory || categories[0] || "articles"); }
function articleHtmlEscape(value: unknown): string { return String(value ?? "").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] || c)); }
function articleAbsoluteUrl(value: string | null): string { if (!value) return ARTICLE_DEFAULT_SHARE_IMAGE; try { return new URL(value, ARTICLE_PUBLIC_ORIGIN).toString(); } catch { return ARTICLE_DEFAULT_SHARE_IMAGE; } }
function articleCanonicalPath(item: ReturnType<typeof toListItem>): string { return `/articles/${articleCategorySlug(item.categories,item.primaryCategory)}/${articleAsciiSlug(item.permalinkSlug||item.title)}`; }
function publicArticleItem(row: CmsRow) {
  const item=toListItem(row);
  return {...item,seo:{...item.seo,canonicalUrl:`${ARTICLE_PUBLIC_ORIGIN}${articleCanonicalPath(item)}`}};
}
function articleJsonScript(value: unknown): string { return JSON.stringify(value).replace(/</g,"\\u003c"); }
function articleSocialPreviewHtml(row: CmsRow): string {
  const item=publicArticleItem(row); const payload=asObject(row.payload); const canonical=`${ARTICLE_PUBLIC_ORIGIN}${articleCanonicalPath(item)}`;
  const image=articleAbsoluteUrl(item.featuredImage||item.seo.ogImage||ARTICLE_DEFAULT_SHARE_IMAGE);
  const title=item.seo.ogTitle||item.seo.title||item.title;
  const description=item.seo.ogDescription||item.seo.description||item.excerpt||"مقال منشور على منصة موطني.";
  const imageType=/\.jpe?g(?:$|\?)/i.test(image)?"image/jpeg":/\.webp(?:$|\?)/i.test(image)?"image/webp":"image/png";
  const articleSchema={"@context":"https://schema.org","@type":"Article",headline:item.title,description,image:[image],datePublished:item.publishedAt||undefined,dateModified:item.updatedAt||item.publishedAt||undefined,author:{"@type":"Person",name:item.authorName||"موطني"},publisher:{"@type":"Organization",name:"موطني",logo:{"@type":"ImageObject",url:ARTICLE_DEFAULT_SHARE_IMAGE}},mainEntityOfPage:canonical,articleSection:item.primaryCategory||item.categories[0]||undefined};
  const breadcrumbSchema={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"موطني",item:ARTICLE_PUBLIC_ORIGIN},{"@type":"ListItem",position:2,name:"المقالات",item:`${ARTICLE_PUBLIC_ORIGIN}/articles`},{"@type":"ListItem",position:3,name:item.primaryCategory||item.categories[0]||"المقالات",item:`${ARTICLE_PUBLIC_ORIGIN}/articles/${articleCategorySlug(item.categories,item.primaryCategory)}`},{"@type":"ListItem",position:4,name:item.title,item:canonical}]};
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${articleHtmlEscape(item.seo.title||item.title)} | موطني</title><meta name="description" content="${articleHtmlEscape(description)}"><link rel="canonical" href="${articleHtmlEscape(canonical)}"><meta name="robots" content="${articleHtmlEscape(item.seo.robots||"index,follow")}"><meta property="og:type" content="article"><meta property="og:site_name" content="موطني"><meta property="og:locale" content="ar_LB"><meta property="og:url" content="${articleHtmlEscape(canonical)}"><meta property="og:title" content="${articleHtmlEscape(title)}"><meta property="og:description" content="${articleHtmlEscape(description)}"><meta property="og:image" content="${articleHtmlEscape(image)}"><meta property="og:image:secure_url" content="${articleHtmlEscape(image)}"><meta property="og:image:type" content="${imageType}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${articleHtmlEscape(title)}"><meta name="twitter:description" content="${articleHtmlEscape(description)}"><meta name="twitter:image" content="${articleHtmlEscape(image)}"><script type="application/ld+json">${articleJsonScript(articleSchema)}</script><script type="application/ld+json">${articleJsonScript(breadcrumbSchema)}</script></head><body><main><h1>${articleHtmlEscape(item.title)}</h1><p><a href="${articleHtmlEscape(canonical)}">فتح المقال على موطني</a></p></main></body></html>`;
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
  const fullBody=`<body><main><article><header><h1>${articleHtmlEscape(item.title)}</h1>${byline}</header>${body}<p><a href="${articleHtmlEscape(canonical)}">فتح المقال على موطني</a></p></article></main></body>`;
  return articleSocialPreviewHtml(row).replace(/<body>[\s\S]*<\/body>/u,fullBody);
}

export const articleRoutes: FastifyPluginAsync = async (app) => {
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
    const inserted=await query<{id:number}>(`INSERT INTO watany_analytics_events(event_type,event_data) SELECT $1,jsonb_build_object('articleId',$2,'path',$3) WHERE EXISTS (SELECT 1 FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' AND public_id=$2) RETURNING id`,[eventType,articleId,pathValue]);
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

  app.get("/api/articles/sitemap.xml", async (_request, reply) => {
    const rows = await query<CmsRow & { updated_at: string | null }>(`SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' AND COALESCE(payload->>'robots','index,follow') NOT LIKE 'noindex%' ORDER BY published_at DESC NULLS LAST,public_id ASC`);
    const xmlEscape=(value:string)=>value.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]||c));
    const urls=[`<url><loc>${ARTICLE_PUBLIC_ORIGIN}/articles</loc></url>`,...rows.rows.map((row)=>{const item=toListItem(row);const loc=`${ARTICLE_PUBLIC_ORIGIN}${articleCanonicalPath(item)}`;const lastmod=row.updated_at||row.published_at;return `<url><loc>${xmlEscape(loc)}</loc>${lastmod?`<lastmod>${xmlEscape(new Date(lastmod).toISOString())}</lastmod>`:""}</url>`;})];
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

  app.get<{ Params: { category: string; slug: string } }>("/api/articles/social-preview/:category/:slug", async (request, reply) => {
    const category=decodeURIComponent(request.params.category); const slug=decodeURIComponent(request.params.slug); const requestedPath=`/articles/${category}/${slug}`;
    const result=await query<CmsRow>(`SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' ORDER BY published_at DESC NULLS LAST,public_id ASC`);
    const current=result.rows.find((candidate)=>articleCanonicalPath(toListItem(candidate))===requestedPath);
    const row=current||result.rows.find((candidate)=>toListItem(candidate).permalinkHistory.includes(requestedPath));
    if(!row)return reply.code(404).type("text/html; charset=utf-8").send("<!doctype html><meta charset=utf-8><title>Article not found</title>");
    const canonical=`${ARTICLE_PUBLIC_ORIGIN}${articleCanonicalPath(toListItem(row))}`;
    if(!current)return reply.code(301).header("Location",canonical).send();
    reply.header("Cache-Control","public, max-age=300"); return reply.type("text/html; charset=utf-8").send(articleSocialPreviewHtml(row));
  });
  app.get<{ Params: { slug: string } }>("/api/articles/social-preview-legacy/:slug", async (request, reply) => {
    const slug=decodeURIComponent(request.params.slug); const result=await query<CmsRow>(`SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' AND (public_code=$1 OR public_id=$1) LIMIT 1`,[slug]); const row=result.rows[0];
    if(!row)return reply.code(404).type("text/html; charset=utf-8").send("<!doctype html><meta charset=utf-8><title>Article not found</title>");
    reply.header("Cache-Control","public, max-age=300"); return reply.type("text/html; charset=utf-8").send(articleSocialPreviewHtml(row));
  });

  app.get<{ Params: { category: string; slug: string } }>("/api/articles/search-preview/:category/:slug", async (request, reply) => {
    const category=decodeURIComponent(request.params.category); const slug=decodeURIComponent(request.params.slug); const requestedPath=`/articles/${category}/${slug}`;
    const result=await query<CmsRow>(`SELECT public_id,public_code,title,payload,published_at,updated_at FROM cms_content_entities WHERE domain='articles' AND status='PUBLISHED' ORDER BY published_at DESC NULLS LAST,public_id ASC`);
    const current=result.rows.find((candidate)=>articleCanonicalPath(toListItem(candidate))===requestedPath);
    const row=current||result.rows.find((candidate)=>toListItem(candidate).permalinkHistory.includes(requestedPath));
    if(!row)return reply.code(404).type("text/html; charset=utf-8").send("<!doctype html><meta charset=utf-8><title>Article not found</title>");
    const canonical=`${ARTICLE_PUBLIC_ORIGIN}${articleCanonicalPath(toListItem(row))}`;
    if(!current)return reply.code(301).header("Location",canonical).send();
    reply.header("Cache-Control","public, max-age=300, must-revalidate"); return reply.type("text/html; charset=utf-8").send(articleSearchPreviewHtml(row));
  });
  app.get<{ Params: { slug: string } }>("/api/articles/search-preview-legacy/:slug", async (request, reply) => {
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
