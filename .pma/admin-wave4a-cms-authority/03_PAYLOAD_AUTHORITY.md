# Payload Authority

## Result

```text
EXTERNAL_PAYLOAD_WORKSPACE_FOUND=YES
PAYLOAD_PROJECT_FOUND=YES
PAYLOAD_VERSION=3.88.0
PAYLOAD_DATABASE_ADAPTER=@payloadcms/db-postgres
PAYLOAD_COLLECTION_COUNT=20
PAYLOAD_GLOBAL_COUNT=0
PAYLOAD_CANONICAL_CONTENT_TYPES=procedures,documents
```

The separate project at `C:/xampp/htdocs/projectx/watany-control-center/cms` contains `payload@3.88.0`, `buildConfig`, a PostgreSQL adapter, 20 configured application collections, Payload Admin routes, REST and GraphQL exposure, and the import/export plugin. This corrects the earlier scoped statement that Payload was absent from the WatanyBot repository: repository absence did not establish architectural absence.

## Foundation evidence

- `src/payload.config.ts` registers Procedures, Documents, Users, Media, taxonomy collections, publication/sync/audit jobs, and the other editorial collections.
- `src/collections/watany/factory.ts` supplies canonical IDs, workflow status, visibility, provenance, relationships, SEO, drafts, scheduled publish, audit events, sync jobs, and `maxPerDoc: 100` versions.
- `src/collections/watany/content.ts` defines concrete `procedures` and `documents` fields, including `businessIdentifier`, source hashes, migration provenance, publication state, and procedure/document relationships.
- `src/collections/Users.ts` proves Payload authentication and role/access definitions. `src/collections/Media.ts` proves an upload-enabled media collection.
- `src/app/(payload)/api/[...slug]/route.ts` exposes Payload REST methods. `src/app/(payload)/api/graphql/route.ts` and its playground route expose GraphQL.

## Canonical ownership

Payload is canonical for the source-backed Procedures/Documents editorial plane. Its authority is based on concrete collection definitions and the guarded `scripts/canonical-import-preview.ts`, which reads WatanyBot KB Studio JSONL and can upsert procedures, documents, and relationships in a Payload transaction when separately authorized. No import was executed during this reconciliation.

The Gateway procedure JSONL writer and overlapping Gateway document CMS writer are not second canonical editors. They are recorded as `LEGACY_TO_REMOVE` convergence targets. Gateway remains the runtime delivery authority for WatanyBot Web/Mobile clients until a future one-way Payload-to-Gateway read-model contract is implemented and proven.

## Import evidence

```text
PAYLOAD_PROCEDURES_COLLECTION=YES
PAYLOAD_DOCUMENTS_COLLECTION=YES
PAYLOAD_RELATIONSHIP_MODEL=YES
PAYLOAD_REVISION_MODEL=YES
PAYLOAD_IMPORT_PIPELINE=YES
PAYLOAD_IMPORTED_PROCEDURES=UNVERIFIED
PAYLOAD_IMPORTED_DOCUMENTS=UNVERIFIED
PAYLOAD_VALID_RELATIONSHIPS=UNVERIFIED
PAYLOAD_EXPECTED_RELATIONSHIPS=UNVERIFIED
PAYLOAD_QUARANTINE_COUNT=UNVERIFIED
```

The importer implementation and Payload plugin are evidence of capability, not evidence that the historical `459`, `217`, `843/843`, or `23` totals were actually committed. No reliable current artifact was found under external `artifacts`, `reports`, or `evidence` directories, and the failed test last-run file is not import accounting.

## Transactional exclusion

```text
TRANSACTIONAL_TYPES_IN_PAYLOAD_TARGET=0
```

Payload does not own community messages/memberships, Gateway operational document uploads, chat sessions/messages, filter rules, chat input telemetry, abusive-event logs, AI training operations, user identity/application records, approvals, marketplace transactions, CRM/ERM operational records, or runtime audit records. The external `documents` collection is selected only for the source-backed canonical document plane proven by the KB import contract.

## Wave 4B boundary

Do not scaffold another Payload project, alter Payload collections, run the importer, migrate operational uploads, or add a competing full editor in `apps/web-admin`. Wave 4B may implement only the explicit one-way convergence/status contract after a separate authorization and runtime proof.
