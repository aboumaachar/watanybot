APEX_PS1_SKILL_UPDATE_NOT_REQUIRED
# Stage 03: Runtime Proof

STATUS=COMPLETED
RUN_ID=68721380-5e0c-4bdf-808b-41c4e99a6e34

The disposable Payload fixture and Gateway runtime completed a live sync and readback proof:
- proceduresFetched=1
- proceduresPublished=1
- documentsFetched=4
- documentsPublished=2
- mappings=1
- draftRecordsPublished=0
- archivedRecordsPublished=0

Readback preserved procedure attachments P4B_DOCUMENT_A and P4B_DOCUMENT_B. Editorial document readback preserved linked procedure P4B_PROCEDURE_A.

LIVE_CONTENT_HASH=15b885a9d0a9c14255ec6b2cee3fe274f1276861ebed6e3daec43db6c5d4dd0e
ACTIVE_RUN_ID=68721380-5e0c-4bdf-808b-41c4e99a6e34
SYNC_CREDENTIAL_PERSISTED_IN_EVIDENCE=NO
FULL_PAYLOAD_RECORD_BODIES_CAPTURED=NO

## Final real-Payload acceptance

The historical fixture run above is preserved. The final real-Payload pass used the real Payload HTTP API and an isolated disposable database. The REST snapshot contained 2 procedures and 4 documents with separate canonicalId and businessIdentifier fields. The published procedure was P4B_REAL_PROCEDURE_A with businessIdentifier PROC-0001; published documents were P4B_REAL_DOCUMENT_A and P4B_REAL_DOCUMENT_B.

ENRICHED_SYNC_RUN_ID=d52f0819-0b3d-4f66-bdef-6c7e6747dd2d
ENRICHED_SYNC_COUNTS=procedures 2/1; documents 4/2; mappings 1
ENRICHED_CONTENT_HASH=6ad074fd51d65f1e2718998390bd252f2a51745740a4ebd1db37ba76d823d060
ARCHIVE_SYNC_RUN_ID=a7099911-10a7-44df-bbbc-e68f0a9d911d
ARCHIVE_EXCLUSION=PASS; proceduresPublished 0; archived and draft procedure reads 404
REPUBLISH_SYNC_RUN_ID=7f209036-d8dd-43e9-a11c-162e11a45133
REPUBLISH_RESTORATION=PASS; procedure and both relationship directions available
FINAL_ACTIVE_POINTER_SHA256=D159524BBCD36FDC62F820B214264B40918D7879CCC159B352B37BD4DCD31C8A
UNAVAILABLE_SYNC=503 / UNAVAILABLE; pointer unchanged
HISTORICAL_FIXTURE_BROWSER_PROOF_RERUN=NO
