# APEX WatanyBot Documents C3 Bounded Source Implementation V1.0.0

`APEX_EXECUTION_AUTHORITY=DOCUMENTS_C3_BOUNDED_SOURCE_IMPLEMENTATION`

## Governing state

Canonical workspace:

`C:\xampp\htdocs\projectx\watanybot`

Closed predecessors:

- `SUPERADMIN_S1=CLOSED`
- `CMS_C1=CLOSED`
- `PROCEDURES_C2=CLOSED`
- `DOCUMENTS_C3_BUILD_MATERIALIZATION=PASS`

Materialization authority SHA-256:

`E71BF749A52A3ECE801010F906239DB5AE54B2B5EDD42BE9C6DC9CFA946EAB80`

This is the **actual source implementation authority**. It is not an installer, audit, or discovery request.

Broad CMS discovery remains CLOSED.

## APEX execution doctrine

Before any PowerShell command, apply the current APEX PS1 skill and the repository failure/regression register.

Windows PowerShell 5.1 is the default PowerShell runtime.

Do not use `-ExecutionPolicy Bypass`.

Parser PASS is not runtime proof.

A child/native command succeeds only when:
- its expected exit code is verified;
- stderr is handled fail-closed;
- expected output/success token is present;
- failure tokens are absent.

If a new failure class appears, register it before generating or applying a replacement.

Do not patch only an observed failing line and immediately retry. Revalidate the complete execution chain.

## PRE-MUTATION AUTHORITY

Before changing product source:

1. Capture:
   - `git rev-parse HEAD`
   - `git status --porcelain=v1 --untracked-files=all`
   - `git diff --cached --name-only`
2. Preserve all pre-existing dirty paths.
3. Verify the six source hashes recorded in:
   - `pma/feature-gates` authority package snapshots if available; otherwise the bound materialization evidence.
4. Verify the current public Documents owners remain present.

If product-source hashes have drifted from the materialization authority, STOP `BLOCKED`.

## HARD_MUTATION_BOUNDARY

Existing product files authorized to change **only**:

1. `apps/web-admin/src/pages/CmsPage.tsx`
2. `apps/web-admin/src/lib/api.ts`
3. `apps/gateway-api/src/cms/cms-routes.ts`

New product files may be created **only** beneath:

1. `apps/web-admin/src/pages/cms-documents/`
2. `apps/gateway-api/src/cms/documents/`

Existing product files explicitly forbidden without a new APEX authority:

1. `apps/gateway-api/src/routes/documents.ts`
2. `apps/web-user/src/pages/DocumentsPage.tsx`
3. every other existing product source file

If another existing file is genuinely required:
- do not edit it;
- register `APEX_DOCUMENTS_C3_SCOPE_EXPANSION_WITHOUT_NEW_AUTHORITY_FORBIDDEN`;
- emit `pma/evidence/cms/DOCUMENTS_C3_SCOPE_ESCALATION_REQUIRED.json`;
- stop `BLOCKED`.

Evidence files and the repository APEX failure register are not product source and may be created/updated only
as required by this authority.

## CANONICAL OWNERSHIP

Use these current owners:

- CMS UI owner: `apps/web-admin/src/pages/CmsPage.tsx`
- CMS Gateway owner: `apps/gateway-api/src/cms/cms-routes.ts`
- existing Documents API/storage owner to preserve and adapt:
  `apps/gateway-api/src/routes/documents.ts`
- existing public consumer to preserve:
  `apps/web-user/src/pages/DocumentsPage.tsx`

Ownership classification:

`ADAPTER_CONVERGENCE_REQUIRED_NO_PARALLEL_DOCUMENT_REPOSITORY`

Do not create a parallel Documents repository, table, filesystem namespace, or content store.

Read the protected existing Documents API/public consumer as needed to understand contracts, but do not modify them.

## IMPLEMENTATION GOAL

Build a Documents child dashboard inside the closed CMS/Superadmin framework.

The child dashboard must manage the existing Documents owner through a CMS adapter.

Required administrator capabilities, where the existing owner semantics support them:

- list;
- read/details;
- create;
- edit;
- publish;
- unpublish;
- archive;
- attachment/media management;
- audit history;
- version history;
- rollback.

If lifecycle metadata is not represented by the existing Documents owner, it may be maintained by the new
CMS adapter layer only if this does not duplicate the source document or change its canonical identifier/storage.

## FRONTEND

Create Documents CMS UI code only below:

`apps/web-admin/src/pages/cms-documents/`

Use the closed Procedures child implementation as an architectural pattern, not blind copy/paste.

The UI should include:

- searchable document list;
- pagination where the CMS framework expects it;
- status filtering;
- stable document ID display;
- title/name display;
- file/attachment indication;
- public link indication where currently available;
- create/edit form;
- publish/unpublish/archive actions;
- audit history view;
- version history view;
- rollback action;
- loading/error/empty states;
- accessibility-consistent controls.

Wire the child through `CmsPage.tsx`.

Do not create a new top-level Superadmin shell or unrelated application route.

## WEB-ADMIN API

Extend only:

`apps/web-admin/src/lib/api.ts`

Follow existing CMS/Procedures typed API conventions.

Do not rename or break existing exports.

Use the existing authentication/session transport.

## GATEWAY CMS ADAPTER

Create adapter code only below:

`apps/gateway-api/src/cms/documents/`

Wire only through:

`apps/gateway-api/src/cms/cms-routes.ts`

The adapter must reuse the existing Documents owner/persistence behavior.

Required admin route families, as supported:

- list;
- get;
- create;
- update;
- publish;
- unpublish;
- archive;
- attachments;
- audit;
- versions;
- rollback.

Reuse closed CMS RBAC/audit/version/attachment contracts.

Write operations must remain protected by the existing admin/superadmin authority.

## PUBLIC OWNER PRESERVATION

The following files must remain byte-identical throughout the source-build stage:

- `apps/gateway-api/src/routes/documents.ts`
- `apps/web-user/src/pages/DocumentsPage.tsx`

Record their pre/post SHA-256.

Create:

`pma/evidence/cms/DOCUMENTS_C3_PUBLIC_ROUTE_PARITY.json`

It must report current evidence for:
- public route identifiers;
- document ID shape;
- attachment/file URL behavior;
- preview behavior if present;
- download behavior if present;
- share behavior if present.

For a capability not present in the current owner, report:

`UNVERIFIED_NOT_PRESENT_IN_CURRENT_OWNER`

Do not invent semantics.

## PROTECTED DATA

This source-build stage must not mutate:

- registered users;
- submitted applications;
- production;
- existing real Documents records;
- unrelated attachments/uploads;
- unrelated dirty-worktree paths.

Tests must be unit/in-memory/isolated unless rollback is deterministic and proven.

## REQUIRED_SOURCE_BUILD_EVIDENCE

Create exactly these source-build artifacts under:

`pma/evidence/cms/`

1. `DOCUMENTS_C3_PREBUILD_BASELINE.json`
2. `DOCUMENTS_C3_OWNERSHIP_BINDING.json`
3. `DOCUMENTS_C3_CHANGED_FILES.json`
4. `DOCUMENTS_C3_CONTRACT.json`
5. `DOCUMENTS_C3_RBAC_MATRIX.json`
6. `DOCUMENTS_C3_ATTACHMENT_CONTRACT.json`
7. `DOCUMENTS_C3_AUDIT_CONTRACT.json`
8. `DOCUMENTS_C3_VERSIONING_CONTRACT.json`
9. `DOCUMENTS_C3_PUBLIC_ROUTE_PARITY.json`
10. `DOCUMENTS_C3_TEST_RESULTS.json`
11. `DOCUMENTS_C3_POSTBUILD_HASH_MANIFEST.json`
12. `DOCUMENTS_C3_FINAL_STATUS.txt`

If a new failure class is discovered, also update the canonical repository APEX failure/regression register before
a replacement attempt.

## BUILD AND TEST VALIDATION

Discover the narrowest correct commands from the existing workspace/package scripts without reopening ownership discovery.

At minimum prove:

- web-admin typecheck;
- web-admin production build;
- gateway-api typecheck;
- focused Gateway tests for Documents CMS;
- relevant existing Documents public-route tests if present.

For each native command record:

- command;
- exit code;
- stdout byte count;
- stderr byte count;
- success marker/summary;
- absence of failure tokens.

Do not report a command PASS merely because its parser or launcher passed.

## SCOPE VALIDATION

At source-build end:

Allowed product changes are only:
- the three approved existing files;
- new files under the two approved prefixes.

Allowed control/evidence changes are:
- the twelve required `DOCUMENTS_C3_*` evidence artifacts;
- this implementation authority file;
- the canonical APEX failure/regression register only when a new failure class was discovered.

Any other path change introduced by this implementation is a blocker.

Pre-existing dirty paths must remain preserved exactly unless they are inside the authorized Documents delta.

Do not run generic cleanup.

## SOURCE-BUILD TERMINAL CONTRACT

Only when all source/build/test/evidence/scope requirements pass, emit:

```text
DOCUMENTS_C3_BOUNDED_SOURCE_IMPLEMENTATION=PASS
DOCUMENTS_C3_SOURCE_BUILD=CLOSED
RUNTIME_STATUS=UNVERIFIED_RUNTIME
NEXT_ACTION=APEX_DOCUMENTS_C3_RUNTIME_ACCEPTANCE_GATE
OVERALL_STATUS=PASS
TASK_STATUS=DOCUMENTS_C3_SOURCE_BUILD_CLOSED
```

The literal source-build runtime state must remain:

`RUNTIME_STATUS=UNVERIFIED_RUNTIME`

Do not claim runtime acceptance here.

Do not deploy.

Do not commit/push unless a later dedicated APEX release stage authorizes it.

## FAILURE CONTRACT

On any blocker:

1. stop further product mutation;
2. register the failure class before replacement;
3. preserve the bounded delta;
4. emit machine-readable blocker evidence;
5. report `OVERALL_STATUS=BLOCKED`;
6. do not proceed to runtime acceptance.

## NEXT STAGE AFTER SOURCE BUILD

Only after the complete source-build PASS, generate:

`APEX_DOCUMENTS_C3_RUNTIME_ACCEPTANCE_GATE`

The runtime gate must use uniquely named synthetic data and prove, as supported:

CREATE -> READ -> UPDATE -> PUBLISH -> PUBLIC REFLECTION ->
ATTACHMENT/PREVIEW/DOWNLOAD/SHARE ->
UNPUBLISH/ARCHIVE -> AUDIT -> VERSION -> ROLLBACK ->
CLEANUP -> ZERO SYNTHETIC RESIDUE

and separately reprove registered-user and submitted-application preservation.
