# Duplication Risks

| Risk | Current evidence | Locked control |
| --- | --- | --- |
| Payload and Gateway both claim canonical ownership | Payload project/config/collection search is empty; Gateway routes and stores are present | Payload count is zero. No Payload implementation may begin from this package. |
| Generic CMS table becomes a second owner for specialized domains | Specialized route/repository pairs exist for news, ticker, community, documents, rules, services, and chat/AI data | Each row names exactly one specialized or operational authority. |
| Web Admin page mistaken for persistence authority | `apps/web-admin` contains multiple pages while mutation code is in Gateway routes/services | The canonical editor value identifies the owning boundary, not a visual label. |
| Procedures overwritten by competing KB/editor pipelines | Procedure resolver chooses a dataset and `cms-routes.ts` writes that dataset; KB Studio exports also exist | One-way KB Studio source/import to Gateway procedure canonical record. Conflict handling is a Wave 4B requirement. |
| Duplicate revisions/history | News, documents, procedures, and KB use different version mechanisms; most other rows have no history | `revision_authority` is explicit per row. Missing history is not silently filled by a new CMS. |
| Transactional data moved into editorial CMS | Sessions, messages, uploads, moderation, filters, telemetry, training data, and applications are operational | `TRANSACTIONAL_TYPES_IN_PAYLOAD_TARGET=0`; operational rows are deferred or kept specialized. |
| External official sources treated as editable CMS records | `official-sources.ts` imports and health-checks source records and notices | Official service source/provenance and enabled/mode status remain with the specialized Gateway owner. |
| ERM label creates an invented model | No ERM routes, tables, editor, or delivery path were found | ERM assets are explicit `NONE`/`OTHER_EXPLICIT` and deferred pending identity evidence. |

## Zero-duplication gates

```text
DUPLICATE_EDITOR_COUNT=0
DUPLICATE_PAYLOAD_EDITOR_COUNT=0
BIDIRECTIONAL_EDITOR_AUTHORITY_COUNT=0
UNMAPPED_CONTENT_TYPE_COUNT=0
```

A repeated authority class across different rows is not a duplicate editor. Duplicate means more than one canonical editor is assigned to the same row. The machine matrix contains one canonical editor value per row.
