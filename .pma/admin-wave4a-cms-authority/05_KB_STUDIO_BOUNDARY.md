# KB Studio Boundary

## Responsibility matrix

| Responsibility | Status | Evidence and locked interpretation |
| --- | --- | --- |
| Source ingestion | YES | `apps/gateway-api/src/routes/kb-import.ts` creates, processes, approves, rejects, and publishes import jobs. Runtime exports include source-derived JSONL datasets. |
| Normalization | YES | `apps/gateway-api/src/procedures/indexer.ts` loads and normalizes procedure/document records; KB import and procedure utilities form the normalization boundary. |
| Classification | PARTIAL | Procedure record kinds, tags, source routing, and links exist; a complete independent classification/editor contract is not proven. |
| Search index / knowledge dataset | YES | `kb_studio/runtime/exports/watanybot/` contains procedures, documents, directory entries, mappings, tags, manifest, and router index; Gateway exposes KB search/runtime routes. |
| Editorial authoring | PARTIAL | `apps/gateway-api/src/routes/admin-kb.ts` and Web Admin KB pages support dataset/chunk/rule administration, but the boundary between source authoring and Gateway procedure editing must remain explicit. |
| Public delivery | YES | Gateway procedure, KB, hybrid KB, and knowledge routes serve the Web/Mobile consumers. |

## Locked owners

- The `knowledge-base` row is canonical to `KB_STUDIO` and `FILESYSTEM_DATASET`.
- Procedures are canonical to `WEB_ADMIN_GATEWAY_CMS` at the Gateway procedure CMS boundary, while KB Studio owns upstream source ingestion and normalization.
- KB Studio is not a second generic editorial CMS for news, community, chat, or operational records.
- KB Studio does not become a bidirectional editor for procedures. Its source flow is one-way into the canonical procedure dataset.

## Dataset locations

The current resolver in `apps/gateway-api/src/procedures/config.ts` prefers an explicit procedure root or `kb_vnext` when complete, then configured/known KB Studio exports. The local proven export is `kb_studio/runtime/exports/watanybot/`. This resolver behavior is evidence for the dataset boundary, not permission to add another editor.

## Wave 4B guardrails

Future work must document import job identity, validation failures, canonical ID preservation, provenance, conflict handling, and whether a dataset export is ready for public delivery. It must not turn a normalization/export dataset into an untracked second editorial authority.
