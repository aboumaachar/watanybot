# Wave04 Civilian Jobs Persistence and Admin Hardening

This wave introduces the persistence boundary for Civilian Jobs & Services while keeping the feature independent from إعلانات التطويع.

## What this wave adds

- Additive SQL migration proposal under `apps/gateway-api/src/db/migrations/`.
- Repository boundary for opportunities, applications, sources, imported opportunities, and audit events.
- Persistence health endpoint.
- Admin audit endpoint.
- Persistence tests.

## Important limitation

The repository currently ships with an in-memory implementation plus an additive SQL migration proposal. This prevents breaking the current runtime while preparing the next DB adapter step.

## Boundary rule

No military recruitment-announcement behavior is modified by this wave.