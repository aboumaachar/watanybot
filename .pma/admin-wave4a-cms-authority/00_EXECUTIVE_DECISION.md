# WatanyBot v1.2.0 - Wave 4A CMS Authority Lock

## Decision

Wave 4A locks one canonical editor, one canonical persistence authority, and one delivery authority for every row in the closed audit inventory. This package is evidence-only. It does not implement Wave 4B.

The closed audit at `.pma/admin-cms-audit-v1.2.0/` remains the inventory authority. Its CMS count is 15, with 0 full management and 15 partial management. The 15 rows are carried forward exactly once in `machine/content-authority.json`. Wave 4A.1 reconciles those rows with the separate Payload workspace at `C:/xampp/htdocs/projectx/watany-control-center/cms`; it does not reopen the audit.

## Binding outcomes

- External Payload workspace found: YES.
- Payload CMS project found: YES; `payload@3.88.0` with PostgreSQL adapter.
- Payload configured application collection count: 20; Payload globals: 0.
- Payload is canonical for the source-backed Procedures and Documents editorial plane.
- Gateway generic CMS remains canonical for the generic entity store.
- Gateway procedure/document writers are noncanonical convergence targets; Gateway API remains the runtime delivery authority.
- Specialized Gateway/Web Admin domains remain canonical for news, ticker, answer overrides, and official services.
- KB Studio remains canonical for the knowledge dataset and its source normalization pipeline.
- Community, Gateway operational uploads, AI training records, abusive events, chat inputs, chat sessions, and filter rules remain specialized operational data, not Payload targets.
- ERM assets have no implementation evidence and are deferred until the audited label is resolved.
- No audited type has bidirectional editor authority.
- No duplicate Payload editor exists.
- No transactional type is targeted for Payload.

## Gate values

```text
CONTENT_TYPE_COUNT=15
PAYLOAD_CANONICAL_COUNT=2
WEB_ADMIN_GATEWAY_CANONICAL_COUNT=1
SPECIALIZED_OWNER_COUNT=7
KB_STUDIO_CANONICAL_EDITOR_COUNT=1
READ_ONLY_EXTERNAL_COUNT=0
DEFERRED_NOT_CMS_COUNT=7
CANONICAL_EDITOR_ASSIGNED_COUNT=15
CANONICAL_PERSISTENCE_ASSIGNED_COUNT=15
CANONICAL_DELIVERY_ASSIGNED_COUNT=15
AMBIGUOUS_EDITOR_COUNT=0
AMBIGUOUS_PERSISTENCE_COUNT=0
AMBIGUOUS_DELIVERY_COUNT=0
DUPLICATE_EDITOR_COUNT=0
UNMAPPED_CONTENT_TYPE_COUNT=0
BIDIRECTIONAL_EDITOR_AUTHORITY_COUNT=0
DUPLICATE_PAYLOAD_EDITOR_COUNT=0
TRANSACTIONAL_TYPES_IN_PAYLOAD_TARGET=0
```

## Wave 4B boundary

The next wave may converge the Payload Procedures/Documents canonical plane into a Gateway read model and delivery API, and may complete the Gateway generic editor contract. It may add one-way integration and status reporting for KB Studio. It must not create another Payload project, execute an unapproved import, move transactional data into Payload, or leave Gateway and Payload as dual editors.

The exact machine-readable decisions are in `machine/content-authority.json`, `machine/lifecycle-matrix.json`, and `machine/integration-flow.json`.
