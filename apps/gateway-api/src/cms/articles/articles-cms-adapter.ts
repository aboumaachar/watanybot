import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildAdminAuthorityPreHandler, getRoutePolicyByKey } from "../../admin-authority/adminAuthorityGuard.js";
import { registerGenericCmsRoutes } from "../storage/genericCmsRoutes.js";
import { GenericCmsService, type GenericCmsRouteConfig } from "../storage/genericCmsService.js";
import { replaceArticleMedia, writeArticleMedia } from "./articleMediaStorage.js";
import { analyzeArticleSeo, auditPublishedArticlesSeo, buildArticleSeoSafeFixes, type ArticleSeoAgentInput } from "./articleSeoAgent.js";

const articleConfig: GenericCmsRouteConfig = {
  domain: "articles",
  entityType: "cms.articles",
  auditEntityType: "article",
  title: "Articles",
  defaultLocale: "ar-LB",
};

const categoryConfig: GenericCmsRouteConfig = {
  domain: "article-categories",
  entityType: "cms.article_categories",
  auditEntityType: "article-category",
  title: "Article categories",
  defaultLocale: "ar-LB",
};

const tagConfig: GenericCmsRouteConfig = {
  domain: "article-tags",
  entityType: "cms.article_tags",
  auditEntityType: "article-tag",
  title: "Article tags",
  defaultLocale: "ar-LB",
};

const mediaConfig: GenericCmsRouteConfig = {
  domain: "article-media",
  entityType: "cms.article_media",
  auditEntityType: "article-media",
  title: "Article media",
  defaultLocale: "ar-LB",
};

const autosaveConfig: GenericCmsRouteConfig = {
  domain: "article-autosaves",
  entityType: "cms.article_autosaves",
  auditEntityType: "article-autosave",
  title: "Article autosaves",
  defaultLocale: "ar-LB",
};

function actorId(request: FastifyRequest): string {
  const user = (request as any).user;
  return String(user?.id || user?.sub || "unknown-admin");
}

function autosavePublicId(request: FastifyRequest, articleId: string): string {
  return `autosave-${Buffer.from(`${actorId(request)}|${articleId}`, "utf8").toString("base64url").slice(0, 120)}`;
}

function editorSnapshot(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ARTICLE_AUTOSAVE_EDITOR_REQUIRED");
  return value as Record<string, unknown>;
}

const uploadPolicy = {
  preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey("cms.create"))],
  bodyLimit: 36 * 1024 * 1024,
};
const replacePolicy = {
  preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey("cms.edit"))],
  bodyLimit: 36 * 1024 * 1024,
};

function base64Buffer(value: unknown): Buffer {
  if (typeof value !== "string" || !value.trim()) throw new Error("ARTICLE_MEDIA_DATA_REQUIRED");
  const data = Buffer.from(value, "base64");
  if (!data.length) throw new Error("ARTICLE_MEDIA_DATA_INVALID");
  return data;
}

export function registerArticlesCmsRoutes(app: FastifyInstance): void {
  const mediaService = new GenericCmsService(mediaConfig);
  const autosaveService = new GenericCmsService(autosaveConfig);
  app.post<{ Body: { name?: unknown; mimeType?: unknown; dataBase64?: unknown; altText?: unknown; caption?: unknown } }>(
    "/api/admin/cms/article-media/upload",
    uploadPolicy,
    async (request, reply) => {
      try {
        const name = typeof request.body?.name === "string" ? request.body.name.trim() : "media";
        const mimeType = typeof request.body?.mimeType === "string" ? request.body.mimeType.trim().toLowerCase() : "";
        const altText = typeof request.body?.altText === "string" ? request.body.altText.trim() : "";
        const caption = typeof request.body?.caption === "string" ? request.body.caption.trim() : "";
        const data = base64Buffer(request.body?.dataBase64);
        const asset = await writeArticleMedia({ mimeType, data });
        const publicId = `media-${asset.fileName.replace(/\.[^.]+$/u, "")}`;
        const item = await mediaService.create({
          publicId,
          publicCode: asset.fileName,
          title: name || asset.fileName,
          status: "PUBLISHED",
          payload: { ...asset, originalName: name || asset.fileName, altText, caption },
          sourceMeta: { owner: "ARTICLE_CMS_V2", uploadedAt: new Date().toISOString() },
        }, actorId(request));
        await mediaService.recordMutation(request, "uploaded", item.publicId, null, item);
        return reply.code(201).send({ ok: true, item, asset });
      } catch (error) {
        const code = error instanceof Error ? error.message : "ARTICLE_MEDIA_UPLOAD_FAILED";
        const status = code.startsWith("ARTICLE_MEDIA_") ? 400 : 500;
        return reply.code(status).send({ ok: false, error: code });
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { name?: unknown; mimeType?: unknown; dataBase64?: unknown; altText?: unknown; caption?: unknown } }>(
    "/api/admin/cms/article-media/:id/replace", replacePolicy, async (request, reply) => {
      try {
        const before = await mediaService.get(request.params.id, true);
        if (!before) return reply.code(404).send({ ok: false, error: "ARTICLE_MEDIA_NOT_FOUND" });
        const mimeType = typeof request.body?.mimeType === "string" ? request.body.mimeType.trim().toLowerCase() : "";
        const data = base64Buffer(request.body?.dataBase64);
        const fileName = typeof before.payload.fileName === "string" ? before.payload.fileName : before.publicCode;
        if (!fileName) return reply.code(400).send({ ok: false, error: "ARTICLE_MEDIA_FILE_NAME_INVALID" });
        const asset = await replaceArticleMedia({ fileName, mimeType, data });
        const name = typeof request.body?.name === "string" && request.body.name.trim() ? request.body.name.trim() : before.title;
        const altText = typeof request.body?.altText === "string" ? request.body.altText.trim() : String(before.payload.altText || "");
        const caption = typeof request.body?.caption === "string" ? request.body.caption.trim() : String(before.payload.caption || "");
        const item = await mediaService.update(before.publicId, { title: name, payload: { ...before.payload, ...asset, url: `/api/articles/media/${fileName}`, originalName: name, altText, caption }, sourceMeta: { ...before.sourceMeta, replacedAt: new Date().toISOString(), editorOwner: "ARTICLE_CMS_V3" } }, actorId(request));
        if (!item) return reply.code(404).send({ ok: false, error: "ARTICLE_MEDIA_NOT_FOUND" });
        await mediaService.recordMutation(request, "replaced", item.publicId, before, item);
        return { ok: true, item, asset };
      } catch (error) {
        const code = error instanceof Error ? error.message : "ARTICLE_MEDIA_REPLACE_FAILED";
        const status = code.startsWith("ARTICLE_MEDIA_") ? 400 : 500;
        return reply.code(status).send({ ok: false, error: code });
      }
    },
  );

  app.get<{ Params: { id: string } }>("/api/admin/cms/articles/:id/autosave", { preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey("cms.read"))] }, async (request) => {
    const item = await autosaveService.get(autosavePublicId(request, request.params.id));
    if (!item || item.status === "ARCHIVED") return { ok: true, autosave: null };
    return { ok: true, autosave: item.payload };
  });

  app.put<{ Params: { id: string }; Body: { articleVersion?: unknown; editor?: unknown } }>("/api/admin/cms/articles/:id/autosave", { preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey("cms.edit"))], bodyLimit: 4 * 1024 * 1024 }, async (request, reply) => {
    try {
      const editor = editorSnapshot(request.body?.editor);
      const versionValue = request.body?.articleVersion;
      const articleVersion = versionValue === null || versionValue === undefined ? null : String(versionValue);
      const savedAt = new Date().toISOString();
      const publicId = autosavePublicId(request, request.params.id);
      const before = await autosaveService.get(publicId);
      const payload = { articleId: request.params.id, articleVersion, editor, savedAt };
      const sourceMeta = { owner: "ARTICLE_CMS_V3", autosave: true, actorId: actorId(request) };
      const item = before
        ? await autosaveService.update(publicId, { title: `Autosave ${request.params.id}`, status: "DRAFT", payload, sourceMeta }, actorId(request))
        : await autosaveService.create({ publicId, title: `Autosave ${request.params.id}`, status: "DRAFT", payload, sourceMeta }, actorId(request));
      if (!item) return reply.code(500).send({ ok: false, error: "ARTICLE_AUTOSAVE_WRITE_FAILED" });
      return { ok: true, autosave: item.payload };
    } catch (error) {
      const code = error instanceof Error ? error.message : "ARTICLE_AUTOSAVE_FAILED";
      return reply.code(code.startsWith("ARTICLE_AUTOSAVE_") ? 400 : 500).send({ ok: false, error: code });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/admin/cms/articles/:id/autosave", { preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey("cms.edit"))] }, async (request) => {
    const publicId = autosavePublicId(request, request.params.id);
    const before = await autosaveService.get(publicId);
    if (!before) return { ok: true, cleared: false };
    await autosaveService.update(publicId, { status: "ARCHIVED", payload: { ...before.payload, clearedAt: new Date().toISOString() } }, actorId(request));
    return { ok: true, cleared: true };
  });

  app.post<{ Body: ArticleSeoAgentInput }>(
    "/api/admin/cms/articles/seo-agent/analyze",
    { preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey("cms.edit"))], bodyLimit: 3 * 1024 * 1024 },
    async (request, reply) => {
      try {
        const title = typeof request.body?.title === "string" ? request.body.title.trim() : "";
        const slug = typeof request.body?.slug === "string" ? request.body.slug.trim() : "";
        if (!title || !slug) return reply.code(400).send({ ok: false, error: "ARTICLE_SEO_AGENT_TITLE_SLUG_REQUIRED" });
        const proposal = await analyzeArticleSeo({ ...request.body, title, slug });
        return reply.send({ ok: true, proposal });
      } catch (error) {
        app.log.error({ err: error }, "article_seo_agent_failed");
        return reply.code(500).send({ ok: false, error: "ARTICLE_SEO_AGENT_FAILED" });
      }
    },
  );

  app.post<{ Body: ArticleSeoAgentInput }>("/api/admin/cms/articles/seo-agent/safe-fix", { preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey("cms.edit"))], bodyLimit: 3 * 1024 * 1024 }, async (request, reply) => {
    try { const title=typeof request.body?.title==="string"?request.body.title.trim():""; const slug=typeof request.body?.slug==="string"?request.body.slug.trim():""; if(!title||!slug)return reply.code(400).send({ok:false,error:"ARTICLE_SEO_SAFE_FIX_TITLE_SLUG_REQUIRED"}); const fix=await buildArticleSeoSafeFixes({...request.body,title,slug}); return reply.send({ok:true,fix}); }
    catch(error){ app.log.error({err:error},"article_seo_safe_fix_failed"); return reply.code(500).send({ok:false,error:"ARTICLE_SEO_SAFE_FIX_FAILED"}); }
  });

  app.get<{ Querystring: { limit?: string } }>("/api/admin/cms/articles/seo-audit/bulk", { preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey("cms.read"))] }, async (request, reply) => {
    try { const limit=Math.min(Math.max(Number(request.query?.limit||300)||300,1),500); const report=await auditPublishedArticlesSeo(limit); return reply.send({ok:true,report}); }
    catch(error){ app.log.error({err:error},"article_seo_bulk_audit_failed"); return reply.code(500).send({ok:false,error:"ARTICLE_SEO_BULK_AUDIT_FAILED"}); }
  });

  registerGenericCmsRoutes(app, articleConfig);
  registerGenericCmsRoutes(app, categoryConfig);
  registerGenericCmsRoutes(app, tagConfig);
  registerGenericCmsRoutes(app, mediaConfig);
}
