# Content Authority Matrix

The machine-readable matrix in `machine/content-authority.json` is binding. Each audited content type appears exactly once below.

| ID | Content type | Canonical editor | Canonical persistence | Canonical delivery | Wave 4 action | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| generic-cms-entities | Generic CMS entities and relationships | WEB_ADMIN_GATEWAY_CMS | GATEWAY_POSTGRES_GENERIC_CMS | GATEWAY_API | COMPLETE_IN_WEB_ADMIN | MEDIUM |
| news | News | SPECIALIZED_WEB_ADMIN_DOMAIN | OTHER_EXPLICIT: Gateway pluginDb SQLite `news_items` | GATEWAY_API | NO_CHANGE | HIGH |
| community | Community | SPECIALIZED_WEB_ADMIN_DOMAIN | GATEWAY_POSTGRES_SPECIALIZED | GATEWAY_API | DEFER_NOT_CMS | HIGH |
| documents | Document assets and uploads | SPECIALIZED_WEB_ADMIN_DOMAIN | GATEWAY_POSTGRES_SPECIALIZED: `public.documents` | GATEWAY_API | DEFER_NOT_CMS | HIGH |
| procedures | Procedures | WEB_ADMIN_GATEWAY_CMS | FILESYSTEM_DATASET: resolved `procedures.jsonl` | GATEWAY_API | COMPLETE_IN_WEB_ADMIN | HIGH |
| knowledge-base | Knowledge base | KB_STUDIO | FILESYSTEM_DATASET | GATEWAY_API | KEEP_SPECIALIZED_OWNER | HIGH |
| ticker | Ticker | SPECIALIZED_WEB_ADMIN_DOMAIN | OTHER_EXPLICIT: Gateway pluginDb SQLite `ticker_items` | GATEWAY_API | NO_CHANGE | HIGH |
| ai-training | AI training examples | SPECIALIZED_WEB_ADMIN_DOMAIN | FILESYSTEM_DATASET: configured training JSONL | OTHER_EXPLICIT: internal training/admin API | DEFER_NOT_CMS | HIGH |
| abusive-events | Abusive chat events | NONE | FILESYSTEM_DATASET: `abusive-chat-events.jsonl` | OTHER_EXPLICIT: internal admin API | DEFER_NOT_CMS | HIGH |
| chat-inputs | Chat input telemetry | NONE | FILESYSTEM_DATASET: `chat-inputs.jsonl` and clusters | OTHER_EXPLICIT: internal admin API | DEFER_NOT_CMS | HIGH |
| answer-overrides | Answer overrides | SPECIALIZED_WEB_ADMIN_DOMAIN | FILESYSTEM_DATASET: `admin-answer-overrides.json` | GATEWAY_API | KEEP_SPECIALIZED_OWNER | HIGH |
| chat-sessions | Chat sessions | NONE | OTHER_EXPLICIT: Gateway pluginDb SQLite session store | GATEWAY_API | DEFER_NOT_CMS | HIGH |
| filter-rules | Chat filter rules | SPECIALIZED_WEB_ADMIN_DOMAIN | GATEWAY_POSTGRES_SPECIALIZED | GATEWAY_API | DEFER_NOT_CMS | HIGH |
| official-services | Official services | SPECIALIZED_WEB_ADMIN_DOMAIN | FILESYSTEM_DATASET: official service JSON/JSONL data | GATEWAY_API | KEEP_SPECIALIZED_OWNER | HIGH |
| erm-assets | ERM assets | NONE | OTHER_EXPLICIT: no implementation found | OTHER_EXPLICIT: no public delivery found | DEFER_NOT_CMS | LOW |

## Required ownership fields

Every row in the machine matrix also records the importer, validator, canonical ID owner, revision owner, publication owner, archive owner, source provenance owner, evidence paths, and confidence. `OTHER_EXPLICIT` is used only where the observed store is SQLite, an internal-only API, or a proven absence that does not fit the narrower allowed classes.

## Reading the table

- `DEFER_NOT_CMS` means the type remains in its current operational owner and is excluded from Wave 4 editorial CMS completion.
- `KEEP_SPECIALIZED_OWNER` means the current domain authority remains binding; no generic CMS duplicate may be introduced.
- `NO_CHANGE` means the current specialized owner is already the selected authority for this lock.
- `COMPLETE_IN_WEB_ADMIN` means the Gateway/Web Admin boundary is the future completion surface; it does not authorize a Payload implementation.
