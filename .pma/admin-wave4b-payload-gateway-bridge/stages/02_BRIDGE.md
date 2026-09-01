APEX_PS1_SKILL_UPDATE_NOT_REQUIRED
# Stage 02: Bridge

STATUS=COMPLETED

The Gateway bridge reads Payload over HTTP with bounded pagination, published-only lifecycle filtering, canonical ID preservation, and bidirectional Procedure/Document relationship mapping. It writes candidate JSONL data to a temporary run directory and activates it through an atomic active.json pointer.

Validation boundaries:
- Missing identifiers, missing titles, duplicate identifiers, and broken relationships fail closed.
- Concurrent sync attempts are rejected.
- Activation and reload failures preserve the previous last-good active pointer.
- Gateway does not write to Payload.
- Web and Mobile depend on Gateway APIs, not Payload directly.

Canonical proof IDs:
- Procedure: P4B_PROCEDURE_A
- Documents: P4B_DOCUMENT_A, P4B_DOCUMENT_B
