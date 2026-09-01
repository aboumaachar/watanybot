# Current CMS Planes

## Evidence scope

This document reads the closed audit inventory and the current local source. It does not rerun the audit. The source search found no Payload package, configuration, collection, or control-center project.

## Planes

| Plane | Current authority | Persistence | Delivery | Evidence |
| --- | --- | --- | --- | --- |
| Payload CMS | Not present | None | None | No `payloadcms`, `@payloadcms`, `buildConfig`, or Payload config/collection path in tracked source. |
| Gateway generic CMS | Gateway API and Web Admin CMS boundary | PostgreSQL `cms_content_entities` and `cms_content_relationships` | Gateway API | `apps/gateway-api/src/db/migrations/035_generic_cms_content.sql`, `apps/gateway-api/src/cms/storage/genericCmsRepository.ts`, `apps/gateway-api/src/cms/cms-routes.ts` |
| Gateway CMS procedure boundary | Gateway API CMS routes backed by the resolved procedure dataset | Filesystem JSONL dataset | Gateway procedure APIs | `apps/gateway-api/src/cms/cms-routes.ts`, `apps/gateway-api/src/procedures/config.ts`, `apps/gateway-api/src/procedures/indexer.ts` |
| Gateway specialized domains | Domain-specific Gateway routes and repositories | PostgreSQL, pluginDb SQLite, or controlled files by domain | Gateway API | `apps/gateway-api/src/routes/admin-news.ts`, `admin-ticker.ts`, `community.ts`, `admin-rules.ts`, `official-sources.ts`, and related modules |
| KB Studio | Ingestion, normalization, export, and knowledge dataset boundary | `kb_studio/runtime/exports/watanybot` and related datasets | Gateway KB and knowledge APIs | `apps/gateway-api/src/routes/kb-import.ts`, `apps/gateway-api/src/routes/admin-kb.ts`, `kb_studio/runtime/exports/watanybot/` |
| Web Admin | Administrative user interface and domain control surface | Does not independently persist records | Calls Gateway APIs | `apps/web-admin/src/pages/CmsPage.tsx`, `NewsAdminPage.tsx`, `AdminKBStudioPage.tsx`, `RulesPage.tsx`, `CommunityPage.tsx`, `SessionsPage.tsx` |
| Public delivery | Gateway read and action APIs | Reads the owning domain store | Web/Mobile clients consume Gateway APIs | `apps/gateway-api/src/routes/news.ts`, `documents.ts`, `ticker.ts`, `community.ts`, `official-sources.ts`, procedure and KB routes |

## Inventory note

The current CMS registry also exposes `announcements` and `forms`. They are supporting Gateway CMS domains, but they are not additional rows in the closed audit's 15-type inventory. The generic authority row covers the generic entity/relationship plane; the Wave 4A count is not expanded.

## Authority rule

A Web Admin page is not itself a persistence authority. The canonical owner is the source/API boundary that validates and mutates the record. A page may remain an operational view, editor, or deep link only as specified in the authority matrix.
