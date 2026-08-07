# Watany Guided Help Canonical Feature Architecture

This package introduces the feature-based guided-help foundation.

## Why this exists

The previous audit found many application routes but only a smaller number of real user-facing features. Creating one guide card per route would create duplicated popups, noisy reminders, and inconsistent memory.

The new rule is:

```text
Many routes -> one canonical feature -> one guide memory model.
```

## New foundation files

- `src/features/guided-help/watanyCanonicalFeatureRegistry.ts`
- `src/features/guided-help/watanyFeatureGuidedHelpEngine.ts`
- `src/features/guided-help/watanyFeatureGuideProgress.ts`
- `src/features/guided-help/watanyGuidedHelpJourneyEngine.ts`

## Engines

The foundation supports five engines:

1. Welcome
2. Pre-Landing
3. Smart Tips
4. Profile Completion
5. Journey Recommendations

## Safe rollout

This package does not wire the new registry into live navigation yet. The next PMA should:

1. Typecheck the added files.
2. Compare route coverage against the generated evidence CSV.
3. Add a compatibility adapter from the existing route-based pre-landing provider to this feature registry.
4. Browser-smoke Salary, School Grants, Procedures, Marketplace, Profile, and Chat.
5. Only then remove duplicate route-level card definitions.

## Do not do

Do not add hundreds of route-level guide cards. Add or improve feature definitions instead.