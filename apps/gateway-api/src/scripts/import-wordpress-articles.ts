import fs from "node:fs";
import { getClient } from "../lib/db.js";

type Category = { publicId: string; name: string; slug: string; wpTermId: number; wpTaxonomyId: number };
type Article = {
  wpId: number; publicId: string; slug: string; title: string; bodyHtml: string;
  publishedAtLocal: string; legacyGuid: string; authorWpId: number; authorName: string;
  authorLogin: string; featuredImage: string | null; categories: string[]; categoryPublicIds: string[];
};
type Relation = { articlePublicId: string; categoryPublicId: string };
type Media = { sha256: string; path: string };
type Payload = {
  version: number; source: string; articleCount: number; categoryCount: number;
  relationshipCount: number; mediaCount: number; articles: Article[]; categories: Category[];
  relationships: Relation[]; media: Media[];
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const payloadArg = args.find((x) => x.startsWith("--payload="));
if (!payloadArg) throw new Error("PAYLOAD_REQUIRED");
const payloadPath = payloadArg.slice("--payload=".length);
const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as Payload;
function validatePayload(input: Payload): string[] {
  const errors: string[] = [];
  if (input.version !== 1) errors.push(`VERSION:${input.version}`);
  if (input.source !== "koudama.sql") errors.push(`SOURCE:${input.source}`);
  if (input.articles.length !== 189 || input.articleCount !== 189) errors.push(`ARTICLES:${input.articles.length}`);
  if (input.categories.length !== 14 || input.categoryCount !== 14) errors.push(`CATEGORIES:${input.categories.length}`);
  if (input.relationships.length !== 238 || input.relationshipCount !== 238) errors.push(`RELATIONSHIPS:${input.relationships.length}`);
  if (input.media.length !== 147 || input.mediaCount !== 147) errors.push(`MEDIA:${input.media.length}`);
  const ids = new Set(input.articles.map((x) => x.publicId));
  const slugs = new Set(input.articles.map((x) => x.slug));
  if (ids.size !== input.articles.length) errors.push("DUPLICATE_PUBLIC_ID");
  if (slugs.size !== input.articles.length) errors.push("DUPLICATE_SLUG");
  if (input.articles.filter((x) => x.categories.includes("اخبار")).length !== 31) errors.push("NEWS_COUNT");
  if (input.articles.filter((x) => x.categories.length > 1).length !== 42) errors.push("MULTI_CATEGORY_COUNT");
  for (const media of input.media) {
    if (!/^[a-f0-9]{64}$/.test(media.sha256) || media.path.startsWith("/") || media.path.includes("..")) errors.push(`MEDIA_PATH:${media.path}`);
  }
  return errors;
}

const validationErrors = validatePayload(payload);
console.log(`WP_ARTICLE_PAYLOAD_ARTICLES=${payload.articles.length}`);
console.log(`WP_ARTICLE_PAYLOAD_CATEGORIES=${payload.categories.length}`);
console.log(`WP_ARTICLE_PAYLOAD_RELATIONSHIPS=${payload.relationships.length}`);
console.log(`WP_ARTICLE_PAYLOAD_MEDIA=${payload.media.length}`);
console.log(`WP_ARTICLE_PAYLOAD_VALIDATION_ERRORS=${validationErrors.length}`);
if (validationErrors.length) throw new Error(validationErrors.slice(0, 20).join(","));
async function resolveAuthorUserId(client: any, wpId: number): Promise<string | null> {
  if (!wpId) return null;
  const result = await client.query(
    `SELECT user_id::text AS user_id FROM legacy_wp_user_identities
     WHERE canonical_wp_id=$1 OR $1=ANY(source_wp_ids) LIMIT 2`,
    [wpId],
  );
  if (result.rows.length > 1) throw new Error(`AMBIGUOUS_AUTHOR_LINK:${wpId}`);
  return result.rows[0]?.user_id ?? null;
}

async function main(): Promise<void> {
  const client = await getClient();
  try {
    const articleIds = payload.articles.map((x) => x.publicId);
    const categoryIds = payload.categories.map((x) => x.publicId);
    const slugs = payload.articles.map((x) => x.slug);
    const existing = await client.query(
      `SELECT domain,public_id,public_code,source_id FROM cms_content_entities
       WHERE (domain='articles' AND (public_id=ANY($1::text[]) OR public_code=ANY($2::text[])))
          OR (domain='article-categories' AND public_id=ANY($3::text[]))`,
      [articleIds, slugs, categoryIds],
    );
    const blocking: string[] = [];
    const expectedArticleSource = new Map(payload.articles.map((x) => [x.publicId, `wordpress:koudama:${x.wpId}`]));
    const expectedSlugOwner = new Map(payload.articles.map((x) => [x.slug, x.publicId]));
    const expectedCategorySource = new Map(payload.categories.map((x) => [x.publicId, `wordpress:koudama:category:${x.wpTermId}`]));
    let existingArticles = 0;
    let existingCategories = 0;
    for (const row of existing.rows) {
      if (row.domain === "articles") {
        const expectedId = expectedSlugOwner.get(String(row.public_code || ""));
        if (expectedId && expectedId !== row.public_id) blocking.push(`SLUG_OWNER:${row.public_code}`);
        const expectedSource = expectedArticleSource.get(String(row.public_id));
        if (expectedSource) {
          existingArticles += 1;
          if (row.source_id && row.source_id !== expectedSource) blocking.push(`ARTICLE_SOURCE:${row.public_id}`);
        }
      } else if (row.domain === "article-categories") {
        existingCategories += 1;
        const expectedSource = expectedCategorySource.get(String(row.public_id));
        if (expectedSource && row.source_id && row.source_id !== expectedSource) blocking.push(`CATEGORY_SOURCE:${row.public_id}`);
      }
    }
    const authorLinks = new Map<number, string | null>();
    for (const wpId of Array.from(new Set(payload.articles.map((x) => x.authorWpId)))) {
      authorLinks.set(wpId, await resolveAuthorUserId(client, wpId));
    }
    const linkedAuthorArticles = payload.articles.filter((x) => Boolean(authorLinks.get(x.authorWpId))).length;
    if (linkedAuthorArticles !== 93) blocking.push(`AUTHOR_LINKED_ARTICLES:${linkedAuthorArticles}`);
    console.log(`PREFLIGHT_EXISTING_ARTICLES=${existingArticles}`);
    console.log(`PREFLIGHT_EXISTING_CATEGORIES=${existingCategories}`);
    console.log(`PREFLIGHT_LINKED_AUTHOR_ARTICLES=${linkedAuthorArticles}`);
    console.log(`PREFLIGHT_HISTORICAL_AUTHOR_ONLY=${payload.articles.length-linkedAuthorArticles}`);
    console.log(`PREFLIGHT_BLOCKING_CONFLICTS=${blocking.length}`);
    if (blocking.length) throw new Error(blocking.slice(0, 30).join(","));
    if (dryRun) {
      console.log("WP_ARTICLE_IMPORT_DRY_RUN=PASS");
      return;
    }

    await client.query("BEGIN");
    try {
      for (const category of payload.categories) {
        await client.query(
          `INSERT INTO cms_content_entities
           (domain,public_id,public_code,source_id,status,locale,title,payload,source_meta,created_by,updated_by,published_at)
           VALUES('article-categories',$1,$2,$3,'PUBLISHED','ar-LB',$4,$5::jsonb,$6::jsonb,'wordpress:koudama','wordpress:koudama',NOW())
           ON CONFLICT(domain,public_id) DO UPDATE SET
             public_code=EXCLUDED.public_code,source_id=EXCLUDED.source_id,status='PUBLISHED',locale='ar-LB',title=EXCLUDED.title,
             payload=EXCLUDED.payload,source_meta=EXCLUDED.source_meta,updated_by='wordpress:koudama',updated_at=NOW()`,
          [
            category.publicId, category.slug, `wordpress:koudama:category:${category.wpTermId}`, category.name,
            JSON.stringify({ slug: category.slug, wpTermId: category.wpTermId, wpTaxonomyId: category.wpTaxonomyId }),
            JSON.stringify({ source: "koudama.sql", taxonomy: "category" }),
          ],
        );
      }

      for (const article of payload.articles) {
        const authorUserId = authorLinks.get(article.authorWpId) ?? null;
        const articlePayload = {
          slug: article.slug,
          bodyHtml: article.bodyHtml,
          publishedAtLocal: article.publishedAtLocal,
          originalWpId: article.wpId,
          authorWpId: article.authorWpId,
          authorName: article.authorName,
          authorLogin: article.authorLogin,
          authorUserId,
          featuredImage: article.featuredImage,
          legacyUrl: article.legacyGuid,
          categories: article.categories,
          categoryPublicIds: article.categoryPublicIds,
        };
        await client.query(
          `INSERT INTO cms_content_entities
           (domain,public_id,public_code,source_id,status,locale,title,payload,source_meta,created_by,updated_by,created_at,updated_at,published_at)
           VALUES('articles',$1,$2,$3,'PUBLISHED','ar-LB',$4,$5::jsonb,$6::jsonb,'wordpress:koudama','wordpress:koudama',
                  ($7::timestamp AT TIME ZONE 'Asia/Beirut'),($7::timestamp AT TIME ZONE 'Asia/Beirut'),($7::timestamp AT TIME ZONE 'Asia/Beirut'))
           ON CONFLICT(domain,public_id) DO UPDATE SET
             public_code=EXCLUDED.public_code,source_id=EXCLUDED.source_id,status='PUBLISHED',locale='ar-LB',title=EXCLUDED.title,
             payload=EXCLUDED.payload,source_meta=EXCLUDED.source_meta,updated_by='wordpress:koudama',updated_at=NOW(),published_at=EXCLUDED.published_at`,
          [article.publicId, article.slug, `wordpress:koudama:${article.wpId}`, article.title,
           JSON.stringify(articlePayload),
           JSON.stringify({ source: "koudama.sql", wpId: article.wpId, legacyGuid: article.legacyGuid }),
           article.publishedAtLocal],
        );
      }

      await client.query(
        `DELETE FROM cms_content_relationships r USING cms_content_entities e
         WHERE r.entity_id=e.id AND e.domain='articles' AND e.public_id=ANY($1::text[]) AND r.relation_type='category'`,
        [articleIds],
      );
      for (const relation of payload.relationships) {
        await client.query(
          `INSERT INTO cms_content_relationships(entity_id,relation_type,target_domain,target_public_id)
           SELECT id,'category','article-categories',$2 FROM cms_content_entities
           WHERE domain='articles' AND public_id=$1
           ON CONFLICT(entity_id,relation_type,target_domain,target_public_id) DO NOTHING`,
          [relation.articlePublicId, relation.categoryPublicId],
        );
      }

      const recon = await client.query(
        `SELECT
          (SELECT COUNT(*)::int FROM cms_content_entities WHERE domain='articles' AND public_id=ANY($1::text[])) AS articles,
          (SELECT COUNT(*)::int FROM cms_content_entities WHERE domain='article-categories' AND public_id=ANY($2::text[])) AS categories,
          (SELECT COUNT(*)::int FROM cms_content_relationships r JOIN cms_content_entities e ON e.id=r.entity_id
             WHERE e.domain='articles' AND e.public_id=ANY($1::text[]) AND r.relation_type='category') AS relationships,
          (SELECT COUNT(*)::int FROM cms_content_entities WHERE domain='articles' AND public_id=ANY($1::text[])
             AND payload->'categories' ? 'اخبار') AS news_articles`,
        [articleIds, categoryIds],
      );
      const r = recon.rows[0];
      if (Number(r.articles) !== 189) throw new Error(`RECON_ARTICLES:${r.articles}`);
      if (Number(r.categories) !== 14) throw new Error(`RECON_CATEGORIES:${r.categories}`);
      if (Number(r.relationships) !== 238) throw new Error(`RECON_RELATIONSHIPS:${r.relationships}`);
      if (Number(r.news_articles) !== 31) throw new Error(`RECON_NEWS:${r.news_articles}`);
      await client.query("COMMIT");
      console.log(`RECON_WP_ARTICLES=${r.articles}/189`);
      console.log(`RECON_WP_ARTICLE_CATEGORIES=${r.categories}/14`);
      console.log(`RECON_WP_ARTICLE_RELATIONSHIPS=${r.relationships}/238`);
      console.log(`RECON_WP_NEWS_ARTICLES=${r.news_articles}/31`);
      console.log(`RECON_WP_LINKED_AUTHOR_ARTICLES=${linkedAuthorArticles}/93`);
      console.log("WP_ARTICLE_IMPORT_FINAL=PASS");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
