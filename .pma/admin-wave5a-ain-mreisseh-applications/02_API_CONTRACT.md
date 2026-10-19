# API Contract

Repository contract tests passed 6/6. Covered behavior includes required public input validation, canonical campaign/location identity, unauthenticated admin denial, authorized campaign-scoped reads, allowlisted mutation, and absence of destructive SQL.

`AIN_ADMIN_MUTABLE_FIELD_ALLOWLIST=PASS`
`AIN_ADMIN_IDENTITY_MUTATION_COUNT=0`
`AIN_DELETE_ROUTE_COUNT=0` by committed route/test inspection.

Runtime API detail, history, stale-write, and filter checks were observed during the acceptance run but were not persisted as durable machine output.
