# Watany Guided Help Canonical Compatibility Adapter

This adapter bridges route-based pre-landing guides to the new canonical feature registry.

The existing route registry is not removed.

The app may still find cards by route, but memory should be based on canonical feature ID.

Examples:

```text
/market       -> marketplace
/marketplace -> marketplace
/school-aid   -> schoolGrants
/school-grants -> schoolGrants
```

Generated files:

- `src/features/guided-help/watanyPreLandingCanonicalAdapter.ts`
- `docs/guided-help/WATANY_PRELANDING_CANONICAL_ADAPTER.md`
- `docs/guided-help/WATANY_PRELANDING_CANONICAL_ADAPTER_BROWSER_SMOKE.md`