# Current CMS Planes

## Evidence scope

This document reads the closed audit inventory, the current local source, and the bounded external Payload workspace. It does not rerun the audit. The external workspace exists at `C:/xampp/htdocs/projectx/watany-control-center/cms` and is a real Payload project; its state is recorded in `11_EXTERNAL_PAYLOAD_RECONCILIATION.md`.

## Planes

| Plane | Current authority | Persistence | Delivery | Evidence |
| --- | --- | --- | --- | --- |
| External Payload CMS | Payload Admin for source-backed editorial content | Payload PostgreSQL via `@payloadcms/db-postgres` | Payload Admin/REST/GraphQL and integration surface | External `src/payload.config.ts`, content collections, factory, importer, REST route, and GraphQL route. |
| Gateway generic CMS | Gateway API and Web Admin CMS boundary | PostgreSQL `cms_content_entities` and `cms_content_relationships` | Gateway API | `apps/gateway-api/src/db/migrations/035_generic_cms_content.sql`, `apps/gateway-api/src/cms/storage/genericCmsRepository.ts`, `apps/gateway-api/src/cms/cms-routes.ts` |
| Gateway CMS procedure/document boundary | Existing Gateway admin writers; noncanonical after reconciliation | Filesystem JSONL and PostgreSQL `public.documents` | Gateway API runtime delivery | `apps/gateway-api/src/cms/cms-routes.ts`, `apps/gateway-api/src/cms/documents/documents-cms-adapter.ts`, `apps/gateway-api/src/procedures/config.ts`, `apps/gateway-api/src/procedures/indexer.ts` |
| Gateway specialized domains | Domain-specific Gateway routes and repositories | PostgreSQL, pluginDb SQLite, or controlled files by domain | Gateway API | `apps/gateway-api/src/routes/admin-news.ts`, `admin-ticker.ts`, `community.ts`, `admin-rules.ts`, `official-sources.ts`, and related modules |
| KB Studio | Ingestion, normalization, export, and knowledge dataset boundary | `kb_studio/runtime/exports/watanybot` and related datasets | Gateway KB and knowledge APIs | `apps/gateway-api/src/routes/kb-import.ts`, `apps/gateway-api/src/routes/admin-kb.ts`, `kb_studio/runtime/exports/watanybot/` |
| Web Admin | Administrative user interface and domain control surface | Does not independently persist records | Calls Gateway APIs | `apps/web-admin/src/pages/CmsPage.tsx`, `NewsAdminPage.tsx`, `AdminKBStudioPage.tsx`, `RulesPage.tsx`, `CommunityPage.tsx`, `SessionsPage.tsx` |
| Public delivery | Gateway read and action APIs | Reads the owning domain store | Web/Mobile clients consume Gateway APIs | `apps/gateway-api/src/routes/news.ts`, `documents.ts`, `ticker.ts`, `community.ts`, `official-sources.ts`, procedure and KB routes |

## Reconciled two-plane rule

Payload is canonical for source-backed Procedures and Documents because the external importer, structured collections, relationships, lifecycle fields, provenance, and versioning are concrete. Gateway remains the proven WatanyBot runtime delivery API. The existing Gateway procedure writer and overlapping document CMS writer are `LEGACY_TO_REMOVE` convergence work; Gateway operational upload stores remain separate specialized data.

## Inventory note

The current CMS registry also exposes `announcements` and `forms`. They are supporting Gateway CMS domains, but they are not additional rows in the closed audit's 15-type inventory. The generic authority row covers the generic entity/relationship plane; the Wave 4A count is not expanded.

## Authority rule

A Web Admin page is not itself a persistence authority. The canonical owner is the source/API boundary that validates and mutates the record. A page may remain an operational view, editor, or deep link only as specified in the authority matrix.
