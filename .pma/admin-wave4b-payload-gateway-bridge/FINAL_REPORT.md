APEX_PS1_SKILL_UPDATE_NOT_REQUIRED
# Wave 4B.1 Final Report

RUN_ID=68721380-5e0c-4bdf-808b-41c4e99a6e34
EXECUTION_UTC=2026-09-01T12:15:31.2868617Z
WAVE=4B.1
FEATURE=PAYLOAD_TO_GATEWAY_CANONICAL_PUBLICATION_BRIDGE
STATUS=PASS_WITH_ADVISORY_RUNTIME_NOISE
BRANCH_REQUIRED=integration/theme-upgrade-20260728

## Decision

PAYLOAD_TO_GATEWAY_SYNC=PASS
GENERIC_CMS_COMPLETION_STARTED=NO
PRODUCTION_CONTACTED=NO
WAVE3_CLOSED=YES
WAVE4A_CLOSED=YES
EXTERNAL_PAYLOAD_SOURCE_MUTATED=NO
PAYLOAD_DATABASE_MUTATED=NO
FULL_PAYLOAD_RECORD_BODIES_CAPTURED=NO
SYNC_CREDENTIAL_PERSISTED_IN_EVIDENCE=NO

The locked one-way flow is preserved:

KB Studio source and normalization -> Payload canonical editorial record -> Gateway derived read model -> Gateway API -> Web and Mobile.

Payload remains the canonical editor for source-backed Procedures and Documents. Gateway remains the runtime delivery authority. Operational Gateway Documents, Forms, and Announcements remain on their existing owners.

## Bridge proof

The bridge reads Payload through HTTP only. It uses bounded pagination with limit=100, page, and depth=1, and filters to published records. Direct Payload database coupling is absent. Gateway never writes to Payload.

Canonical business identifiers are preserved:

- Procedure: P4B_PROCEDURE_A
- Documents: P4B_DOCUMENT_A and P4B_DOCUMENT_B

The procedure-to-document relationship is preserved in both directions. The procedure read API returned attachments P4B_DOCUMENT_A and P4B_DOCUMENT_B. The editorial document detail returned linked procedure P4B_PROCEDURE_A.

Synthetic draft and archived records were excluded. The live sync proof returned proceduresFetched=1, proceduresPublished=1, documentsFetched=4, documentsPublished=2, mappings=1.

Candidate JSONL output is written under a temporary directory and activated through an atomic active.json pointer. Invalid identifiers, missing titles, duplicates, and broken relationships fail closed. Concurrent sync attempts are rejected. Activation and reload failures preserve the previous last-good pointer.

LIVE_CONTENT_HASH=15b885a9d0a9c14255ec6b2cee3fe274f1276861ebed6e3daec43db6c5d4dd0e
LIVE_ACTIVE_RUN_ID=68721380-5e0c-4bdf-808b-41c4e99a6e34

## Authority and writer census

Payload sync read status is gated by cms.payload_sync.read and the existing procedures-read authority. Trigger is gated by cms.payload_sync.trigger and cms.publish. The CMS mutation authority surface contains eight boundaries: seven blocked Procedure writer routes plus the allowed Payload sync trigger. Procedure mutations return CANONICAL_EDITOR_PAYLOAD with canonicalEditor=PAYLOAD.

LEGACY_PROCEDURE_EDITOR_ROUTE_COUNT=11
CMS_MUTATING_AUTHORITY_BOUNDARY_COUNT=8
LEGACY_CMS_PROCEDURE_MUTATION_ROUTE_COUNT=7
LEGACY_ADMIN_PROCEDURE_MUTATION_ROUTE_COUNT=4
LEGACY_PROCEDURE_EDITOR_ROUTES_BLOCKED=11
WRITE_PROCEDURE_DOCS_LINKS_REACHABLE_CALL_COUNT=0
WRITE_PROCEDURE_DOCS_LINKS_HELPER=REMOVED

The KB Studio export and rebuild route is classified as one retained legacy dataset-generation path. It copies or rebuilds legacy KB artifacts and is not a Payload editor. It does not target the Payload-sync active directory. No external Payload files or database records were changed.

LEGACY_KB_STUDIO_DATASET_GENERATION_PATH_COUNT=1
LEGACY_KB_STUDIO_PATH_CLASSIFICATION=NON_CANONICAL_DATASET_GENERATOR

## Runtime and UI gates

The live Gateway sync route returned SYNCED and the active status endpoint returned configured=true and running=false. Gateway reads exposed the canonical procedure and two canonical editorial documents. Operational document behavior remains available through its existing surface.

Authenticated browser proof passed at 1440x900 and 430x932. The Procedure surface displayed the Payload CMS ownership label, read-only marker, canonical procedure ID, sync counts, and no mutation controls. The Payload editorial-document list and detail displayed Payload ownership, canonical document ID, linked procedure ID, and read-only state.

The mobile repair uses the existing table-wrap bounded scroll utility for the CMS grid and anchors the RTL mobile drawer to the right edge before off-canvas translation. At 430px the document width and viewport width were both 415 CSS pixels and horizontalOverflow=false. The drawer was fully outside the viewport. Touch proof recorded maxTouchPoints=10, pointer coarse=false, any-pointer coarse=true, hover none=false; the repair is not gated by those media queries.

Screenshots were captured for the desktop editorial-document surface and the mobile CMS procedure surface after the responsive repair.

## Validation gates

- Focused bridge tests: 4 passed.
- CMS authority and writer-boundary tests: 3 passed.
- Combined Gateway regression before closeout: 5 suites passed, 17 tests passed, 3 skipped.
- Gateway typecheck: PASS.
- Gateway build/typecheck target: PASS.
- Web-admin typecheck: PASS.
- Web-admin production build: PASS, with existing Vite chunking advisories.
- Browser desktop proof: PASS at 1440x900.
- Browser mobile proof: PASS at 430x932 with zero horizontal overflow.
- Cleanup proof: PASS; ports 3001, 4000, 4010, and 5175 have no listeners.

## Recovered execution events

An earlier browser navigation retained a stale invalid init token and was repaired by overriding it with the disposable proof token. The initial mobile check identified the missing table-responsive rule and the RTL drawer anchoring defect; both were repaired and re-proved. Two pnpm test-alias invocations rejected --run on this host; direct Vitest execution passed with VITEST_EXIT_CODE=0. An immediate post-stop socket query raced process teardown; the subsequent process and port check was empty.

These events are recorded as recovered failures, not current blockers.

## Evidence and delivery

The complete APEX artifact set is in this directory. It contains no credentials and no full Payload record bodies. The report manifest covers all frozen report files except its own self-hash.

COMMIT_MESSAGE_REQUIRED=feat(cms): bridge Payload editorial content to Gateway
COMMIT_SHA=c7ca29999b41bf41511abd29429ac448e73b05aa
PUSH_BRANCH=integration/theme-upgrade-20260728
PUSH_RESULT=PASS_REMOTE_SHA_MATCH

The required commit was created with the exact subject and pushed successfully. The remote integration branch resolves to the same immutable SHA as local HEAD. Selective staging proved WAVE4B1_STAGED_UNRELATED_PATH_COUNT=0; six unrelated worktree paths remain unstaged and untouched.

---

## Final real-Payload acceptance addendum

The historical fixture and browser report above is preserved. Its original run identifiers and commit record are not rewritten. The final acceptance pass was performed separately against the real Payload HTTP API using only disposable isolated services and was not a Wave 4B.2 run.

The real Payload REST snapshot serialized 2 procedures and 4 documents, including separate `canonicalId` and `businessIdentifier` fields. The published procedure was `canonicalId=P4B_REAL_PROCEDURE_A` with `businessIdentifier=PROC-0001`; the published documents were `P4B_REAL_DOCUMENT_A` and `P4B_REAL_DOCUMENT_B`. The Gateway exposed the canonical ID and did not leak the forbidden business identifiers.

The enriched real sync returned `SYNCED`, run `d52f0819-0b3d-4f66-bdef-6c7e6747dd2d`, with 2 procedures fetched, 1 published, 4 documents fetched, 2 published, and 1 relationship mapping. Archive run `a7099911-10a7-44df-bbbc-e68f0a9d911d` published zero procedures and returned 404 for archived and draft procedure runtime reads. Republish run `7f209036-d8dd-43e9-a11c-162e11a45133` restored the canonical procedure, both document links, and the reverse document references.

When Payload was stopped, the sync route returned HTTP 503 with `UNAVAILABLE` and recorded `FAILED / UNAVAILABLE`. The active pointer SHA256 remained `D159524BBCD36FDC62F820B214264B40918D7879CCC159B352B37BD4DCD31C8A` before and after the failed attempt, and the last-good runtime readback remained available.

The protected normal Payload database `127.0.0.1:55432/watany_cms` and the external Payload source workspace were untouched. The isolated disposable databases `watany_payload_wave4b_8254e60ba40d` and `watany_gateway_wave4b_8254e60ba40d` were intentionally mutated for this proof and then dropped; the isolated PostgreSQL cluster, temporary runner, snapshots, and candidate runtime were removed. Ports 3001, 4001, and 55434 are clear.

SOURCE_CORRECTION_COMMIT_MESSAGE=fix(cms): correct real Payload bridge contract
SOURCE_CORRECTION_COMMIT_SHA=89335a1d4c7a133e6e3f200e77e5943890e40a35
EVIDENCE_COMMIT_MESSAGE_REQUIRED=docs(cms): finalize Wave 4B.1 bridge evidence
REAL_PAYLOAD_ACCEPTANCE=PASS
HISTORICAL_FIXTURE_BROWSER_PROOF_RERUN=NO
WAVE4B2_STARTED=NO
