# ADR-003: Universal Dashboard Control Plane with Specialized Owners

**Date:** 2026-09-18  
**Status:** Accepted  
**Decision authority:** Product owner — Option B

## Decision

`/ops` is the complete administrator-facing control plane for WatanyBot.

Payload CMS is a specialized editorial backend, not the universal administration shell. Gateway APIs remain authoritative for operational, transactional, system, integration, search, analytics, and service domains that do not belong naturally in a CMS collection.

Every manageable domain MUST have exactly one primary owner. A projection, cache, compatibility route, or public API may expose an owner's data, but it MUST NOT become a second mutation authority.

## Owner classes

- `PAYLOAD_MANAGED`: canonical editorial mutation is performed in Payload; `/ops` supplies status, review, import/export, synchronization, and authenticated SSO handoff.
- `GATEWAY_MANAGED`: Gateway service/database/runtime state is the canonical mutation authority and `/ops` manages it through protected Gateway APIs.
- `FILE_MANAGED`: versioned repository/runtime data is the canonical source and Gateway exposes it; mutation requires the domain's controlled file/import workflow rather than an invented Payload collection.

## Administrator experience

Administrators start in `/ops`. Direct knowledge of backend URLs is not required. If a specialized editor is necessary, `/ops` must provide the authenticated handoff and return operational status/readback.

The direct Payload shell is therefore an internal specialized workspace. Its standalone English/LTR shell is not the primary WatanyBot administrator UX under this architecture; `/ops` remains Arabic-first and RTL.
## Procedures transition

Procedures are `PAYLOAD_MANAGED` for canonical editorial mutation, but the current proven production projection remains `kb_vnext` until Payload contains a complete published dataset.

The first Payload activation must fail closed if its published Procedure count is lower than the currently healthy runtime count. After a complete first activation establishes the Payload sync pointer, normal explicit editorial publication may add or remove records through the governed workflow.

Legacy `/api/procedures` and related compatibility surfaces must delegate the current Procedures runtime index; they must not probe independent obsolete JSON catalogs.

## Payload handoff contract

The production web-admin build must bind `VITE_PAYLOAD_CMS_URL=https://payload.koudama.com`. The SSO flow is Gateway-issued short-lived assertion → Payload exchange → Payload session. Assertions and secrets must not be persisted in evidence or URLs.

## Closure gates

Option B reaches full GREEN only when:

1. the owner matrix has no required `UNOWNED` or unresolved `DUPLICATED` domain;
2. every `/ops` module reaches its canonical owner and proves required actions/permissions;
3. the complete Procedures dataset is safely imported/published before first Payload activation;
4. compatibility and public surfaces agree with their canonical runtime owners;
5. authenticated production browser proof verifies `/ops`, owner handoffs, permissions, representative mutations, cleanup, and public readback;
6. protected users, job applications, attachments, roles, and authentication remain unchanged by the closure process.

This ADR supersedes any requirement interpretation that every WatanyBot operational domain must become a Payload collection. It does not waive the functional audit requirements; it assigns them to the correct canonical owner.
