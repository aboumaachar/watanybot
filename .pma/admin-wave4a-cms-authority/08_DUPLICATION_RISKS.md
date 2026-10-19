# Duplication Risks

| Risk | Current evidence | Locked control |
| --- | --- | --- |
| Payload and Gateway both claim canonical ownership | External Payload collections/importer and Gateway procedure/document writers are both concrete; no Payload-to-Gateway bridge is proven | Payload is canonical for source-backed Procedures/Documents. Gateway writers are `LEGACY_TO_REMOVE`; Gateway remains runtime delivery. |
| Generic CMS table becomes a second owner for specialized domains | Specialized route/repository pairs exist for news, ticker, community, documents, rules, services, and chat/AI data | Each row names exactly one specialized or operational authority. |
| Web Admin page mistaken for persistence authority | `apps/web-admin` contains multiple pages while mutation code is in Gateway routes/services | The canonical editor value identifies the owning boundary, not a visual label. |
| Procedures/Documents overwritten by competing planes | Payload importer writes structured Postgres collections; Gateway procedure JSONL and document CMS routes write parallel representations; KB exports feed both planes | One-way KB/source -> Payload canonical -> Gateway derived read model. Preserve IDs, provenance, conflict handling, and publication atomicity in Wave 4B. |
| Duplicate revisions/history | News, documents, procedures, and KB use different version mechanisms; most other rows have no history | `revision_authority` is explicit per row. Missing history is not silently filled by a new CMS. |
| Transactional data moved into editorial CMS | Sessions, messages, uploads, moderation, filters, telemetry, training data, and applications are operational | `TRANSACTIONAL_TYPES_IN_PAYLOAD_TARGET=0`; operational rows are deferred or kept specialized. |
| Operational uploads mistaken for canonical Payload Documents | Gateway `public.documents` and pluginDb records have UUID/storage semantics and no proven shared Payload business identifiers | Retain operational uploads as specialized data; reconcile only the source-backed canonical document plane. |
| External official sources treated as editable CMS records | `official-sources.ts` imports and health-checks source records and notices | Official service source/provenance and enabled/mode status remain with the specialized Gateway owner. |
| ERM label creates an invented model | No ERM routes, tables, editor, or delivery path were found | ERM assets are explicit `NONE`/`OTHER_EXPLICIT` and deferred pending identity evidence. |

## Zero-duplication gates

```text
DUPLICATE_EDITOR_COUNT=0
DUPLICATE_PAYLOAD_EDITOR_COUNT=0
BIDIRECTIONAL_EDITOR_AUTHORITY_COUNT=0
UNMAPPED_CONTENT_TYPE_COUNT=0
```

A repeated authority class across different rows is not a duplicate editor. Duplicate means more than one canonical editor is assigned to the same row. Current Gateway writers are recorded as noncanonical convergence work, so the machine matrix still contains one canonical editor value per row.
