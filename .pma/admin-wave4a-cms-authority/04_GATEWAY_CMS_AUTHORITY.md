# Gateway CMS Authority

## Generic store

`apps/gateway-api/src/db/migrations/035_generic_cms_content.sql` defines the Gateway PostgreSQL generic store:

- `cms_content_entities` with domain, public identity, source identity, JSONB payload/source metadata, lifecycle status, revision, and timestamps.
- `cms_content_relationships` with typed target domain/public identity and cascading entity ownership.

`apps/gateway-api/src/cms/storage/genericCmsRepository.ts` is the repository boundary. It owns list, get, create, and update operations and increments the generic revision. `apps/gateway-api/src/cms/announcements/announcements-cms-adapter.ts` proves a concrete generic-domain adapter. The generic CMS authority is therefore Gateway PostgreSQL, with Web Admin as the editor surface.

## Procedure CMS boundary

`apps/gateway-api/src/cms/cms-routes.ts` registers the Gateway CMS registry and the procedure create/edit/publish/unpublish/archive/restore/version/audit routes. It writes the resolved procedure JSONL dataset returned by `apps/gateway-api/src/procedures/config.ts`, reloads the index, and records entity versions and audit events. Procedures are assigned to `WEB_ADMIN_GATEWAY_CMS` as their canonical editor, with KB Studio as the upstream ingestion/normalization source.

The import direction is one-way:

```text
KB Studio source and normalization -> Gateway canonical procedure dataset -> Gateway API -> Web/Mobile
```

A future importer must preserve canonical IDs and must not silently overwrite Gateway editorial changes. That hardening is Wave 4B work.

## Specialized Gateway owners

The following rows must not be moved into the generic table merely because they have an admin page:

- News: `admin-news.ts` and pluginDb `news_items`.
- Ticker: `admin-ticker.ts` and pluginDb `ticker_items`.
- Community: `community.ts` and `community/service.ts` over PostgreSQL community tables.
- Documents: CMS adapter over `public.documents`.
- Answer overrides, AI training, chat inputs, and abuse logs: file-backed chat/AI administration.
- Chat sessions: pluginDb session route and session store.
- Filter rules: `admin-rules.ts` over PostgreSQL `filter_rules`.
- Official services: `official-sources.ts` over controlled service datasets and upstream sources.

Their selected authority is recorded as either `SPECIALIZED_WEB_ADMIN_DOMAIN`, `NONE`, or `KB_STUDIO`, never as a second generic editor.

## Gateway completion rule

Wave 4B may complete missing lifecycle controls only at the selected owner boundary. It must preserve one canonical ID, one revision/history owner, one publication owner, one archive owner, and one delivery path per row.
