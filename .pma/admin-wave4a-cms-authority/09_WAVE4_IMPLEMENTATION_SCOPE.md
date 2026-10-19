# Wave 4B Implementation Scope

Wave 4A.1 only locks the corrected authority. The categories below are the binding input to Wave 4B. No implementation from these categories is performed in this turn. Every audited content type appears in exactly one category.

## Counts by required category

```text
WAVE4B_PAYLOAD_SCOPE_COUNT=0
WAVE4B_WEB_ADMIN_SCOPE_COUNT=1
WAVE4B_INTEGRATION_SCOPE_COUNT=2
WAVE4B_READ_ONLY_SCOPE_COUNT=0
WAVE4B_DEFERRED_COUNT=7
WAVE4B_KEEP_SPECIALIZED_OWNER_COUNT=3
WAVE4B_NO_CHANGE_COUNT=2
```

## A. COMPLETE_IN_PAYLOAD

Count: 0. Payload already contains the canonical collection foundation; this correction authorizes no Payload implementation or import execution.

## B. WEB-ADMIN/GATEWAY IMPLEMENTATION/COMPLETION

Count: 1.

- `generic-cms-entities`: Gateway generic repository/routes and `apps/web-admin/src/pages/CmsPage.tsx`. Complete only the Gateway generic editor contract.

## C. INTEGRATE_PAYLOAD_WITH_GATEWAY

Count: 2.

- `procedures`: External Payload `procedures` collection and guarded importer are canonical. The current Gateway JSONL CMS writer becomes `LEGACY_TO_REMOVE`; Wave 4B may define one-way Payload -> Gateway read-model publication and preserve Gateway API delivery.
- `documents`: External Payload `documents` collection and relationships are canonical for source-backed documents. Gateway `public.documents`/CMS overlap becomes convergence work; operational uploads remain specialized and outside Payload.

The required future contract for both rows is:

```text
KB Studio source/normalization -> Payload canonical editorial record -> Gateway derived read model -> Gateway API -> Web/Mobile
```

## D. READ-ONLY/STATUS SURFACE

Count: 0 as a new Wave 4B category. Existing admin monitoring/listing surfaces for operational rows remain governed by their specialized owners and are not promoted to editorial editors.

## E. KEEP_SPECIALIZED_OWNER

Count: 3.

- `knowledge-base`: Keep KB Studio as ingestion/normalization/dataset authority and Gateway as delivery.
- `answer-overrides`: Keep chat behavior overrides in the specialized Gateway AI/file-backed owner.
- `official-services`: Keep source provenance, health, and enabled/mode controls in the specialized Gateway owner.

## F. DEFER_NOT_CMS

Count: 7.

- `community`: PostgreSQL user-generated groups/messages/membership/moderation.
- `ai-training`: configured training JSONL and internal admin AI operations.
- `abusive-events`: append-only abuse-event telemetry.
- `chat-inputs`: input telemetry and question clusters.
- `chat-sessions`: Gateway runtime session state.
- `filter-rules`: PostgreSQL runtime moderation policy.
- `erm-assets`: no concrete source, persistence, editor, or delivery evidence.

## G. NO_CHANGE

Count: 2.

- `news`: retain the pluginDb `news_items` owner and existing specialized lifecycle.
- `ticker`: retain the pluginDb `ticker_items` owner and time-window delivery.

No category authorizes CRUD implementation, Payload import execution, application source edits, or database schema edits in this turn.
