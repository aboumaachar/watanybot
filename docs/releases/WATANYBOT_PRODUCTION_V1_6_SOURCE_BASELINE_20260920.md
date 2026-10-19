# WATANYBOT Production V1.6 Source Baseline - 2026-09-20

## Authority
- Production release: `/opt/watany/releases/fresh-release-cms-closeout-20260920-v1-6`
- Source baseline parent: `5c8133c43086f26df08e855d5e460c98520a752f`
- V1.6 bundle SHA-256: `D5042F1C3900D35BDDFBCFB88B87845C7988871C467BBFAC1A26B9EF1E287FA3`
- V1.6 controller SHA-256: `89FCF0947DF041443DC3F6C959F05F025B536EEDE64084991F50193B9D8A9F2D`
- Payload runtime source: `payload_sync`
- Procedures at production acceptance: `286`
- Forms at production acceptance: `132` total, `111` procedure-document references
- Announcements at production acceptance: `2` published

## Selective-source provenance
The baseline was reconstructed in an isolated worktree from committed HEAD plus retained production-lineage evidence. Unrelated dirty workspace changes were excluded.

- V1.6 CMS overlay: frozen `.pma/cms-closeout-v1-4-stage` bytes (V1.4/V1.5/V1.6 bundle payload identical).
- Payload editorial relation fix: `.pma/payload-relfix-v1` source.
- Auth/SSO/import-plan dependencies: retained 2026-09-12 runtime-deploy snapshot where byte-identical to current production-era source.
- Payload CMS app: 2026-09-12 frozen snapshot, with the sole later source delta `src/payload.config.ts` from 2026-09-19 production-origin trust hardening.
- Reference package: 217 records, 36 delivery targets, all bundled for self-contained preview/download delivery.
- Mixed working-tree files were reduced to the required production hunks only (`bootstrap/routes.ts`, `AdminPrimitives.tsx`, `packages/types/src/index.ts`).

## Clean-room validation
- Gateway TypeScript typecheck: PASS
- Gateway build: PASS
- CMS fast regression gate: PASS - 46/46 tests
- Web-user production build: PASS
- Web-admin production build: PASS
- Payload frozen-lock install: PASS
- Payload TypeScript typecheck: PASS
- Payload production build: PASS
- Existing pnpm workspace importers changed by lock generation: 0
- New pnpm importer: `apps/payload-cms` only
- Existing package resolutions changed: 0
- Secret hygiene scan: PASS — the only pattern match was `.env.example`, verified as localhost/placeholder values only
- Packages removed: 0

## Production acceptance inherited and independently rechecked
- CMS functionality: GREEN
- Payload SSO authenticated browser seal: PASS
- Protected-data reconciliation: PASS
- KB live search/hybrid-chat smoke: PASS
- Public `/`, `/ops/`, Payload admin, Forms, Announcements, Procedures: reachable/valid
- Anonymous protected API boundaries: 401 as expected
- WhatsApp and SMS/OTP infrastructure remain owner-deferred and are outside this release baseline.

## Closure shape
- Tracked files modified from parent before release records: 28
- New/untracked source or reference files before release records: 80
- Generated `.next` and TypeScript build-cache files: excluded

The accompanying SHA-256 manifest records the canonical Git source bytes after repository text normalization. The immutable V1.6 bundle/controller hashes above remain the raw deployment-byte authority.
