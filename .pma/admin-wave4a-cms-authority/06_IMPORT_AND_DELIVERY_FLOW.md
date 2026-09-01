# Import and Delivery Flow

## Global rule

Every flow is one-way with one canonical record owner. No row has bidirectional editor authority.

```text
source or user mutation -> validation/normalization -> canonical record -> publication/archive state -> Gateway delivery
```

## Locked flows

| Content type | Importer or writer | Validation / normalization | Canonical ID | Revision / lifecycle | Public or internal delivery |
| --- | --- | --- | --- | --- | --- |
| Generic CMS entities | Gateway CMS admin API | Gateway repository and route validation | Gateway `public_id` within `domain` | Gateway revision plus admin entity versions | Gateway API |
| News | Gateway news admin routes and source-specific ingestion | Admin route field/status validation | Gateway news UUID | `cms.news` version/audit authority and lifecycle actions | Gateway `/api/news` |
| Community | Authenticated client/community routes | Membership, moderation, and attachment checks | Gateway community IDs | Operational audit snapshots; no CMS revisions | Gateway community API |
| Documents | Authenticated upload/document routes | Document service kind/status/tag/path validation | Gateway document UUID | `cms.documents` snapshots and document status mapping | Gateway document API and controlled preview |
| Procedures | KB Studio source/import, plus bounded Gateway CMS create | Procedure schema/index validation and source normalization | Existing procedure ID; Gateway rejects duplicates | Gateway CMS versions/audit and lifecycle status | Gateway procedure API |
| Knowledge base | KB Studio import jobs and dataset builders | Ingestion, normalization, partial classification, indexing | Source/dataset IDs | KB version entries and dataset restore | Gateway KB/knowledge API |
| Ticker | Gateway ticker admin route and FAQ recompute | Field and time-window validation | Gateway ticker UUID | Time window and timestamps; no revision history | Gateway ticker API |
| AI training | Gateway admin AI route | Required input/output and review status | Generated training ID | File version entries; approval status | Internal training/admin API only |
| Abusive events | Chat runtime logger | Detection/structured event fields | Generated abuse event ID | Append-only event log | Internal admin API only |
| Chat inputs | Chat runtime logger | Input normalization and cluster update | Generated chat-input ID | Append-only log and regenerated clusters | Internal admin API only |
| Answer overrides | Gateway admin AI route | Pattern/answer validation and active flag | Generated override ID | File current state; no history proven | Gateway chat behavior/API |
| Chat sessions | Client/session route | Session/message shape and status validation | Gateway session ID | Current session row and close status | Gateway session API |
| Filter rules | Gateway admin rules route | Regex validation, severity/action checks | PostgreSQL rule UUID | `created_at`/`updated_at`; no history proven | Gateway filtering and admin API |
| Official services | External source sync plus admin service patch | Source URL/mode/health normalization | Service record ID and source IDs | Enabled/mode plus imported notice status | Gateway official-services API |
| ERM assets | None proven | None proven | None | None | None |

## Explicit authority answers

For imported editorial data, the importer, validator, ID owner, revision owner, publication owner, archive owner, provenance owner, and delivery owner are the values in `machine/content-authority.json`. A missing current implementation is represented explicitly as `NONE` or `OTHER_EXPLICIT`; it is never left blank.

## Integration constraint

Payload is absent and owns no flow. The only dataset-to-editor flow selected for Wave 4A is the one-way KB Studio source to Gateway procedure boundary. There is no Payload-to-Gateway flow and no Gateway-to-Payload flow.
