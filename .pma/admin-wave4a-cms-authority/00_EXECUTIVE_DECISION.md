# WatanyBot v1.2.0 - Wave 4A CMS Authority Lock

## Decision

Wave 4A locks one canonical editor, one canonical persistence authority, and one delivery authority for every row in the closed audit inventory. This package is evidence-only. It does not implement Wave 4B.

The closed audit at `.pma/admin-cms-audit-v1.2.0/` remains the inventory authority. Its CMS count is 15, with 0 full management and 15 partial management. The 15 rows are carried forward exactly once in `machine/content-authority.json`.

## Binding outcomes

- Payload CMS project found: NO.
- Payload collection count: 0.
- Payload canonical content types: none.
- Gateway generic CMS is canonical for the generic entity store and the Gateway procedure CMS boundary.
- Specialized Gateway/Web Admin domains remain canonical for news, ticker, answer overrides, and official services.
- KB Studio remains canonical for the knowledge dataset and its source normalization pipeline.
- Community, document uploads, AI training records, abusive events, chat inputs, chat sessions, and filter rules remain specialized operational data, not Payload targets.
- ERM assets have no implementation evidence and are deferred until the audited label is resolved.
- No audited type has bidirectional editor authority.
- No duplicate Payload editor exists.
- No transactional type is targeted for Payload.

## Gate values

```text
CONTENT_TYPE_COUNT=15
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

The next wave may complete the Gateway generic/procedure editor contract and preserve the existing specialty owners. It may add one-way integration and status reporting for KB Studio. It must not create a Payload project, move transactional data into Payload, or add a second editor for any locked owner.

The exact machine-readable decisions are in `machine/content-authority.json`, `machine/lifecycle-matrix.json`, and `machine/integration-flow.json`.
