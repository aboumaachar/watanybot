# Gateway CMS Authority

## Generic store

`apps/gateway-api/src/db/migrations/035_generic_cms_content.sql` defines the Gateway PostgreSQL generic store:

- `cms_content_entities` with domain, public identity, source identity, JSONB payload/source metadata, lifecycle status, revision, and timestamps.
- `cms_content_relationships` with typed target domain/public identity and cascading entity ownership.

`apps/gateway-api/src/cms/storage/genericCmsRepository.ts` is the repository boundary. It owns list, get, create, and update operations and increments the generic revision. `apps/gateway-api/src/cms/announcements/announcements-cms-adapter.ts` proves a concrete generic-domain adapter. The generic CMS authority is therefore Gateway PostgreSQL, with Web Admin as the editor surface.

## Reconciled Procedure CMS boundary

`apps/gateway-api/src/cms/cms-routes.ts` still registers procedure create/edit/publish/unpublish/archive/restore/version/audit routes and writes the resolved procedure JSONL dataset. This is concrete evidence of a current Gateway writer, but the external Payload workspace has the stronger canonical editorial model: structured procedure fields, source provenance, workflow/draft/version configuration, a guarded KB-to-Payload importer, and Payload audit/sync jobs. The Gateway procedure writer is therefore `LEGACY_TO_REMOVE`; it must not remain an intentional second editor.

The future one-way contract is:

```text
KB Studio source/normalization -> Payload canonical Procedures -> Gateway derived read model -> Gateway API -> Web/Mobile
```

No Payload-to-Gateway sync implementation is currently proven. Preserving canonical IDs, conflict handling, revision provenance, and atomic publication is Wave 4B convergence work.

## Reconciled Document CMS boundary

`apps/gateway-api/src/cms/documents/documents-cms-adapter.ts` and `documents-repository.ts` provide a current Gateway document writer over `public.documents`, with Gateway versions/audit snapshots and lifecycle mapping. The external Payload `documents` collection and guarded importer provide the stronger source-backed canonical document model, including relationships, provenance, and Payload versions. The Gateway CMS document writer is `LEGACY_TO_REMOVE` for overlapping source-backed content; its UUID-based operational upload records remain a separate specialized store and are not migrated into Payload.

The future one-way contract is:

```text
KB Studio source/normalization -> Payload canonical Documents -> Gateway derived read model/file delivery -> Gateway API -> Web/Mobile
```

## Specialized Gateway owners

The following rows must not be moved into the generic table merely because they have an admin page:

- News: `admin-news.ts` and pluginDb `news_items`.
- Ticker: `admin-ticker.ts` and pluginDb `ticker_items`.
- Community: `community.ts` and `community/service.ts` over PostgreSQL community tables.
- Source-backed Documents: Payload canonical collection; Gateway `public.documents` overlap is a convergence target. Gateway pluginDb/user upload documents remain operational.
- Answer overrides, AI training, chat inputs, and abuse logs: file-backed chat/AI administration.
- Chat sessions: pluginDb session route and session store.
- Filter rules: `admin-rules.ts` over PostgreSQL `filter_rules`.
- Official services: `official-sources.ts` over controlled service datasets and upstream sources.

Their selected authority is recorded as `PAYLOAD`, `SPECIALIZED_WEB_ADMIN_DOMAIN`, `NONE`, or `KB_STUDIO`, never as a second generic editor.

## Gateway completion rule

Wave 4B may complete missing lifecycle controls only at the selected owner boundary. For Procedures/Documents it must converge Payload into a one-way Gateway read model and must preserve one canonical ID, one revision/history owner, one publication owner, one archive owner, and one delivery path per row.
