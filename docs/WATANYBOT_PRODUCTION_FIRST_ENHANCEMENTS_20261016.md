# WatanyBot — Production-First Enhancement Routing (2026-10-16)

## Decision
The owner confirmed that https://koudama.com is the active, published WatanyBot and directed development from the canonical local workspace C:\xampp\htdocs\projectx\watanybot toward carefully controlled releases on the live site instead of requiring public Staging for every enhancement.

This is an **enhancement workflow change, not deployment approval or removal of existing safety protections**. Public Staging stays suspended. Production remains HOLD until a particular candidate has independent release-specific proof and an approved canary/rollback.

## Read-only facts rechecked 2026-10-16
- Live public URL: https://koudama.com/ responded successfully (native curl exit 0); returned HTML SHA-256 starts d318a7d1cc7f148c185e79fb.
- Exactly matches /home/koudama/public_html/index.html by byte count (20,168) and SHA-256. This is the live served frontend landing document.
- It does not byte-match /opt/watany/current/apps/web-user/dist/index.html (18,329 bytes; SHA-256 starts a556c1c51a9b21d25ab3).
- /opt/watany/current is a symlink to /opt/watany/releases/qwen35-ai-20261004T1115Z.
- /opt/watany/previous points to /opt/watany/releases/20260824T194446Z_04de677f, **not a verified immediately preceding October rollback**.
- October 16 local KB proof files official-claim-ledger.ts and official-source-fetch.ts are absent from the current active gateway release.
- Public frontend includes injected assets and v=20261005 variants; don't assume a simple build/deploy replaces the correct HTML and assets.
- Existing backup filename listings do not prove a complete fresh restorable frontend+gateway+database state. Do not infer backup coverage or rollback success from names alone.
- Production externally returns HTTP 200 with valid TLS (previous read-only checks); this alone is not interactive acceptance.

## Release workstreams (isolation of unrelated blockers)
A — Public web-user UX, Arabic accessibility and source presentation. Locally review/build/test, then candidate with exact static asset and HTML deltas. **Do not touch audit tables, protected auth routes or F-01**. First preferred candidate: existing local WB-CHAT-002 provenance/citation presentation, after checking actual live frontend interface/contracts.
B — Read-only KB retrieval improvements and bounded topic responses. Require gateway and frontend contract checks, source provenance and non-escalation, API canary and regression evidence; no live DB schema change.
C — Pension calculator 2027 date-based rules. Separate business-rule/semantic acceptance; do not combine with unrelated release.
D — KB reviewer authorizations, append-only DB, APEX register, F-01 and security repairs. Remain independently BLOCKED/UNVERIFIED, with no reclassification via direct Production.

## Minimal production-first release cycle
1. Identify one owned, small change and enumerate exact frontend/API/DB touch surfaces. Preserve dirty local workspace and current live artifacts.
2. Confirm current live source/asset baseline and freeze only relevant local changes. No wholesale local-to-server sync.
3. Verify isolated local compilation and scoped tests; include Arabic desktop/mobile/browser paths for UI, and genuine backend authorization proof for sensitive APIs.
4. Protect preimage of live /home/koudama/public_html and /opt/watany/current release, relevant storage configuration, and DB only if change affects DB; prove restoration to isolated target before any go-live.
5. Build immutable release candidate with provenance, hashes, and proof of no unrelated files. Do not use retired/denied APEX controller or a replacement that bypasses it.
6. Obtain explicit release-specific authorization and independently checked rollback/canary readiness. Carry out small canary or reversible asset update with smoke and observational monitoring.
7. Verify public rendering, HTTPS, API behavior, logs and non-regression. Roll back immediately if any mandatory check fails.
8. Record exact release identities, tests, native exit codes, failure tokens, browser acceptance, rollback and post-release observation.

## Current blocking findings
- Backup/restore parity of current active gateway and actual public_html: UNVERIFIED.
- Oct 4 current release vs Aug 24 previous pointer: ROLLBACK NOT VERIFIED.
- Actual published frontend does not equal release dist HTML: mapping must be explicit.
- APEX platform-denied F-01/register/protected-route/retired controllers stay BLOCKED; no bypass.
- Security-sensitive reviewer approval/audit DB remains UNVERIFIED; no Production DB writes.
- No release, restart, schema change or account modification performed during this routing decision.

## Next implementable unit
Produce an independent local-to-live **WB-CHAT-002 frontend-only release candidate** showing safe source references. Start by inspecting current production-bundled API fields and local UI contracts, then run TypeScript, scoped DOM and mobile browser acceptance before any live change. If its API needs backend changes, reclassify the candidate as dual-surface and complete the extra release gates instead of silently expanding scope.

**Disposition**: Production-first strategy accepted as direction. Live publish NOT RUN; Production HOLD continues pending feature-specific safety checks.

## Local pilot completed after this routing decision
- Read-only inspection found that `apps/web-user/src/lib/api.ts` `sanitizeChatKbHits` dropped `sourceUrl` and `url` during response mapping, so safe citation links could be missing even when the API supplied them.
- Made a **local-only frontend change** in `apps/web-user/src/lib/api.ts`: preserve API-provided sourceUrl (or url alias) while retaining existing title/body/score mapping; display layer `chatProvenance.ts` continues to reject unsafe and credentialed destinations. No new source link is generated.
- New local test file: `apps/web-user/src/lib/api.chat-source-bridge.wbchat003.test.ts`, four cases covering official HTTPS link, on-site relative link, unsafe URL rejection, and generic technical placeholder filtering.
- Scoped frontend tests: **27/27 passed**, four files. Rendered DOM chat-citation test: four tests passed in the same run.
- Frontend TypeScript noEmit: PASS in combined command. Expected success token `PRODUCTION_FIRST_CHAT_SOURCE_BRIDGE_LOCAL_PASS`; native process exit `0`.
- Independent Production read-only postflight: frontend HTML SHA-256 prefix `d318a7d1cc7f148c185e79fb` unchanged, `/opt/watany/current` still October 4 release, public Staging suspended, Production HTTPS 200/TLS 0, native curl exit 0, stderr empty.
- This proves a **local UI/API response mapping contract**, NOT that a real published source reference was rendered against the actual Production chat API. Browser/auth/live canary and source/build parity remain outstanding.

Disposition: local link preservation **PASS**. Public release **NOT RUN / HOLD** pending exact active frontend asset mapping, verified rollback snapshot/restoration, scoped approval and independent production canary evidence.
