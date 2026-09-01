# External Payload Reconciliation

## Scope and non-mutation boundary

This is the Wave 4A.1 correction to the existing Wave 4A authority package. It inspects the separate Payload workspace at `C:/xampp/htdocs/projectx/watany-control-center/cms` and updates only `.pma/admin-wave4a-cms-authority/` in WatanyBot.

- The closed 15-row audit inventory is reused exactly; it is not reopened or expanded.
- Wave 4B is not started.
- WatanyBot application source, database schemas, KB datasets, Payload source, and Payload data were not modified.
- The external Payload workspace was not cleaned, reset, stashed, committed, or executed against.
- No Payload import or database mutation was run. The guarded importer was inspected statically only.

## Workspace baselines

```text
WATANYBOT_WORKSPACE=C:/xampp/htdocs/projectx/watanybot
WATANYBOT_EXISTS=YES
WATANYBOT_GIT_MANAGED=YES
WATANYBOT_BRANCH=integration/theme-upgrade-20260728
WATANYBOT_HEAD=7d169dfea2aa456d1e734174eed60f6c5e1fb177
WATANYBOT_PREEXISTING_DIRTY_PATH_COUNT=7
PAYLOAD_WORKSPACE=C:/xampp/htdocs/projectx/watany-control-center/cms
PAYLOAD_WORKSPACE_EXISTS=YES
PAYLOAD_WORKSPACE_GIT_MANAGED=NO
PAYLOAD_WORKSPACE_BRANCH=NOT_APPLICABLE
PAYLOAD_WORKSPACE_HEAD=NOT_APPLICABLE
PAYLOAD_WORKSPACE_GIT_STATUS=NOT_APPLICABLE
```

The seven pre-existing WatanyBot dirty paths remain outside this package. The external directory is a real Node workspace, but no `.git` directory was present. Its existing build/test directories were not modified.

## External Payload foundation

```text
EXTERNAL_PAYLOAD_WORKSPACE_FOUND=YES
PAYLOAD_PROJECT_FOUND=YES
PAYLOAD_VERSION=3.88.0
PAYLOAD_DATABASE_ADAPTER=@payloadcms/db-postgres
PAYLOAD_DATABASE_AUTHORITY=PostgreSQL via postgresAdapter(DATABASE_URI)
PAYLOAD_COLLECTION_COUNT=20
PAYLOAD_GLOBAL_COUNT=0
PAYLOAD_PLUGINS=@payloadcms/plugin-import-export
PAYLOAD_ADMIN_CONFIGURATION=Payload Users auth plus generated Payload Admin routes
PAYLOAD_AUTH_ACCESS=Users auth enabled; content create/update requires req.user; delete is role-gated
PAYLOAD_MEDIA_CONFIGURATION=Media upload collection with sharp
PAYLOAD_REST_EXPOSURE=YES
PAYLOAD_GRAPHQL_EXPOSURE=YES
PAYLOAD_CUSTOM_GRAPHQL_CONFIGURATION=NO
```

The 20 configured application collections in `src/payload.config.ts` are:

```text
users,media,sources,departments,categories,tags,procedures,announcements,laws,directives,documents,forms,services,articles,faqs,payment-updates,notices,publication-jobs,sync-jobs,audit-events
```

The 11 editorial collections with drafts and versions enabled are:

```text
procedures,announcements,laws,directives,documents,forms,services,articles,faqs,payment-updates,notices
```

Evidence is in the external `src/payload.config.ts`, `src/collections/watany/factory.ts`, `src/collections/watany/content.ts`, `src/collections/Users.ts`, `src/collections/Media.ts`, REST route, GraphQL route, and GraphQL playground route.

## Procedures and Documents evidence

```text
PAYLOAD_PROCEDURES_COLLECTION=YES
PAYLOAD_DOCUMENTS_COLLECTION=YES
PAYLOAD_RELATIONSHIP_MODEL=YES
PAYLOAD_REVISION_MODEL=YES
PAYLOAD_IMPORT_PIPELINE=YES
```

The collection definitions and factory prove that:

- `procedures` and `documents` have unique business identifiers, source system/key fields, source/content hashes, migration provenance, publication state, workflow status, SEO/media or storage fields, and cross-collection relationships.
- Both collections use drafts, scheduled publish, and up to 100 versions per document.
- Payload audit events are recorded after changes and publication creates sync jobs.
- `scripts/canonical-import-preview.ts` reads the WatanyBot KB Studio JSONL exports, plans procedure/document/relationship writes, and has a guarded transactional `LOCAL_COMMIT` path.
- The import/export plugin is configured for the editorial collections.

## Import evidence status

No reliable current import result artifact, report, or committed evidence file was found in the external workspace. The importer implementation is capability evidence, not proof that its commit path has completed. `test-results/.last-run.json` records failed tests and is not import accounting.

```text
PAYLOAD_IMPORTED_PROCEDURES=UNVERIFIED
PAYLOAD_IMPORTED_DOCUMENTS=UNVERIFIED
PAYLOAD_VALID_RELATIONSHIPS=UNVERIFIED
PAYLOAD_EXPECTED_RELATIONSHIPS=UNVERIFIED
PAYLOAD_QUARANTINE_COUNT=UNVERIFIED
```

The historical values `459`, `217`, `843/843`, and `23` are therefore not promoted as verified totals. No destructive import, relation test, or database mutation was executed.

## Corrected authority decision

Payload is canonical for the source-backed Procedures and Documents editorial plane. Gateway remains the proven WatanyBot runtime delivery API. The current Gateway procedure JSONL writer and overlapping Gateway document CMS writer are noncanonical convergence targets, not intentional second editors. Gateway operational upload records remain specialized operational data and are not migrated into Payload.

```text
CONTENT_TYPE_COUNT=15
PAYLOAD_CANONICAL_COUNT=2
WEB_ADMIN_GATEWAY_CANONICAL_COUNT=1
SPECIALIZED_OWNER_COUNT=7
KB_STUDIO_CANONICAL_EDITOR_COUNT=1
READ_ONLY_EXTERNAL_COUNT=0
DEFERRED_NOT_CMS_COUNT=7
```

The exact inventory IDs remain:

```text
generic-cms-entities,news,community,documents,procedures,knowledge-base,ticker,ai-training,abusive-events,chat-inputs,answer-overrides,chat-sessions,filter-rules,official-services,erm-assets
```

Only `documents` and `procedures` change canonical editor/persistence to Payload. The other 13 rows retain their existing authority decisions.

## Procedure reconciliation

```text
PROCEDURES_CANONICAL_EDITOR=PAYLOAD
PROCEDURES_CANONICAL_PERSISTENCE=PAYLOAD_POSTGRES
PROCEDURES_CANONICAL_DELIVERY=GATEWAY_API
PROCEDURES_CURRENT_DUAL_WRITE=YES
PROCEDURES_NONCANONICAL_WRITER=Gateway /api/admin/cms/:domain JSONL writer
PROCEDURES_NONCANONICAL_WRITER_DISPOSITION=LEGACY_TO_REMOVE
PROCEDURES_FUTURE_FLOW=KB_STUDIO -> PAYLOAD -> GATEWAY_DERIVED_READ_MODEL -> GATEWAY_API
```

The external Payload collection/importer owns source-backed editorial Procedures. `apps/gateway-api/src/cms/cms-routes.ts` still writes the resolved `procedures.jsonl`, reloads the index, and records Gateway versions/audit events. That current writer must converge to a derived read model in Wave 4B.

## Document reconciliation

```text
DOCUMENTS_CANONICAL_EDITOR=PAYLOAD
DOCUMENTS_CANONICAL_PERSISTENCE=PAYLOAD_POSTGRES
DOCUMENTS_CANONICAL_DELIVERY=GATEWAY_API
DOCUMENTS_CURRENT_DUAL_WRITE=YES
DOCUMENTS_NONCANONICAL_WRITER=Gateway document CMS representation
DOCUMENTS_NONCANONICAL_WRITER_DISPOSITION=LEGACY_TO_REMOVE_FOR_SOURCE_BACKED_OVERLAP
DOCUMENTS_OPERATIONAL_UPLOAD_DISPOSITION=SPECIALIZED_OPERATIONAL_SEPARATE
DOCUMENTS_FUTURE_FLOW=KB_STUDIO -> PAYLOAD -> GATEWAY_DERIVED_READ_MODEL_OR_FILE_DELIVERY -> GATEWAY_API
```

The Payload `documents` collection/importer owns source-backed canonical documents. Gateway `public.documents` and upload records have separate UUID/operational storage semantics and no proven shared Payload business identifiers, so they remain outside the Payload target. The Gateway CMS adapter is a convergence target only where it overlaps source-backed content.

## Actual flow and missing bridge

The current code proves two parallel flows:

```text
KB Studio source exports -> guarded canonical-import-preview.ts -> Payload PostgreSQL -> Payload Admin/REST/GraphQL
KB Studio source exports or resolved dataset -> Gateway JSONL resolver/indexer -> Gateway API -> WatanyBot Web/Mobile
```

The Payload publish hook creates `sync-jobs` for `KB_STUDIO` and `SEARCH`, but no Payload-to-Gateway synchronization implementation was found. Therefore:

```text
PAYLOAD_TO_GATEWAY_SYNC_IMPLEMENTED=NO
PAYLOAD_TO_GATEWAY_CONVERGENCE_REQUIRED=YES
```

Gateway delivery remains selected until a future one-way read-model contract is implemented and runtime-proven. Canonical IDs, conflict handling, revision provenance, publication atomicity, and failure reporting are Wave 4B requirements.

## Wave 4B scope counts

```text
WAVE4B_PAYLOAD_SCOPE_COUNT=0
WAVE4B_WEB_ADMIN_SCOPE_COUNT=1
WAVE4B_INTEGRATION_SCOPE_COUNT=2
WAVE4B_READ_ONLY_SCOPE_COUNT=0
WAVE4B_DEFERRED_COUNT=7
WAVE4B_KEEP_SPECIALIZED_OWNER_COUNT=3
WAVE4B_NO_CHANGE_COUNT=2
```

- `generic-cms-entities` remains the one Gateway/Web Admin completion row.
- `procedures` and source-backed `documents` are the two Payload-to-Gateway integration rows.
- `knowledge-base`, `answer-overrides`, and `official-services` keep specialized owners.
- `news` and `ticker` are unchanged.
- `community`, `ai-training`, `abusive-events`, `chat-inputs`, `chat-sessions`, `filter-rules`, and `erm-assets` remain deferred operational/unproven rows.

No category authorizes CRUD implementation, Payload import execution, application source edits, schema edits, or external Payload data edits in this turn.

## Gates and final boundary

```text
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
APPLICATION_SOURCE_MODIFIED=NO
DATABASE_SCHEMA_MODIFIED=NO
PAYLOAD_SOURCE_MODIFIED=NO
PAYLOAD_DATA_MODIFIED=NO
WAVE4B_STARTED=NO
```

The corrected machine files are `machine/content-authority.json`, `machine/lifecycle-matrix.json`, and `machine/integration-flow.json`. The package must be the only staged scope for the reconciliation commit.