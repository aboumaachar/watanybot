# Wave 4B Implementation Scope

Wave 4A only locks authority. The categories below are the binding input to Wave 4B. No implementation from these categories is performed in this turn.

## Counts

```text
WAVE4B_PAYLOAD_SCOPE_COUNT=0
WAVE4B_WEB_ADMIN_SCOPE_COUNT=6
WAVE4B_INTEGRATION_SCOPE_COUNT=1
WAVE4B_READ_ONLY_SCOPE_COUNT=0
WAVE4B_DEFERRED_COUNT=8
```

## A. PAYLOAD IMPLEMENTATION/COMPLETION

Count: 0.

There is no Payload project, collection, adapter, or content type. No Payload files are authorized by Wave 4A.

## B. WEB-ADMIN/GATEWAY IMPLEMENTATION/COMPLETION

Count: 6. These rows remain at their Gateway/Web Admin or specialized Gateway authority. `NO_CHANGE` and `KEEP_SPECIALIZED_OWNER` rows are included here to prevent a competing generic editor.

- `generic-cms-entities`: `apps/gateway-api/src/cms/storage/genericCmsRepository.ts`, `apps/gateway-api/src/cms/cms-routes.ts`, `apps/web-admin/src/pages/CmsPage.tsx`. Complete the universal generic editor contract only at this boundary.
- `news`: `apps/gateway-api/src/routes/admin-news.ts`, `apps/web-admin/src/pages/NewsAdminPage.tsx`. Preserve the pluginDb `news_items` owner and proven version/audit lifecycle.
- `procedures`: `apps/gateway-api/src/cms/cms-routes.ts`, `apps/gateway-api/src/procedures/config.ts`, `apps/web-admin/src/pages/CmsPage.tsx`. Preserve one-way KB import and the Gateway procedure editor authority.
- `ticker`: `apps/gateway-api/src/routes/admin-ticker.ts`, `ticker_items` pluginDb store. Keep the specialized ticker owner.
- `answer-overrides`: `apps/gateway-api/src/routes/admin-ai.ts`, `apps/gateway-api/src/lib/chat-logger.ts`. Keep chat behavior overrides specialized; do not convert them to generic editorial content.
- `official-services`: `apps/gateway-api/src/routes/official-sources.ts`, `apps/gateway-api/data/official-services.json` where present, and related source datasets. Keep source provenance and external health ownership specialized.

## C. INTEGRATION-ONLY

Count: 1.

- `knowledge-base`: `apps/gateway-api/src/routes/kb-import.ts`, `apps/gateway-api/src/routes/admin-kb.ts`, `apps/gateway-api/src/procedures/indexer.ts`, `apps/gateway-api/src/procedures/config.ts`, `kb_studio/runtime/exports/watanybot/`, `apps/web-admin/src/pages/AdminKBStudioPage.tsx`, and `KBEditorPage.tsx`. Keep KB Studio as the dataset/editor boundary and expose only the explicit Gateway delivery/integration contract.

## D. READ-ONLY/STATUS SURFACE

Count: 0 as a new Wave 4B category. Existing admin monitoring/listing surfaces for operational rows remain governed by their specialized owners and are not promoted to editorial editors.

## E. DEFERRED BECAUSE NOT ACTUALLY CMS

Count: 8.

- `community`: PostgreSQL user-generated groups/messages/membership/moderation in `apps/gateway-api/src/community/service.ts` and `community.ts`.
- `documents`: user document assets in `public.documents` through `cms/documents/documents-repository.ts` and `documents-service.ts`.
- `ai-training`: configured training JSONL and admin AI routes in `apps/gateway-api/src/routes/admin-ai.ts`.
- `abusive-events`: append-only `abusive-chat-events.jsonl` through `apps/gateway-api/src/lib/chat-logger.ts`.
- `chat-inputs`: `chat-inputs.jsonl` and question clusters through `chat-logger.ts`.
- `chat-sessions`: Gateway session route and pluginDb session store in `apps/gateway-api/src/routes/chat-sessions.ts`.
- `filter-rules`: PostgreSQL `filter_rules` and `apps/gateway-api/src/routes/admin-rules.ts`.
- `erm-assets`: no concrete source, persistence, editor, or delivery evidence.

No category authorizes CRUD implementation in this turn.
