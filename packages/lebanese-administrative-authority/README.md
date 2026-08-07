# Lebanese Administrative Authority Platform

UL2 foundation for one governed Lebanese administrative dataset. The package owns the contract, normalization, alias resolution, search, hierarchy, validation, runtime loading, release metadata, and evidence boundaries.

## Current status

`UL2_STATUS=BLOCKED`

No approved dataset is shipped here. The existing candidate artifact is intentionally not copied or promoted because its provenance, Arabic crosswalk, coordinate coverage, and approval state are incomplete.

## Runtime rule

Applications must consume `loadAdministrativeRuntime(...)`. The loader rejects missing, candidate, unreleased, checksum-mismatched, schema-invalid, structurally-invalid, or non-production datasets. There is no fallback dataset in this package.
