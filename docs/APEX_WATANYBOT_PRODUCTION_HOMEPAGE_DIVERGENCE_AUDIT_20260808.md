# APEX WatanyBot Production Homepage Divergence Audit

Date: 2026-08-08
Status: ROOT CAUSE CONFIRMED / SUCCESSOR HOTFIX IN PROGRESS
Production rollback authority: `a7ee52ecbcc5c5f0bf2da4dbab900e33a39178df`
Failed merged hotfix: `65b1763aced36eccac2d9931c2dbeb47efc173ee`
Successor branch: `hotfix/post-deploy-runtime-closure-20260808`

## Confirmed production divergence

The failed hotfix modified `apps/web-user/src/theme/watany-v4/components.css` so that `.watany-service-grid` used three columns.

However `/home` in the deployed recovery runtime renders `HomeRecoveryPage` from `WatanyRecoveryPages.tsx`, which uses the classes:

- `.watany-service-grid`
- `.watany-service-card`

The Watany V4 theme entry loads `components.css` in the earlier `watany-v4` layer, then later loads `watany-v4-theme.css` in the `watany-v4-recovery` layer.

`watany-v4-theme.css` imports `watany-source-of-truth-recovery.css`, where the active rule remained:

```css
.watany-service-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
```

The later recovery layer therefore overrode the three-column rule added to `components.css` in the failed release.

## Secondary validation gap

The earlier local contract test validated the V4 launcher surface, but the production `/home` route was using the recovery homepage surface. The test therefore proved the wrong authority surface for the production route.

The same mismatch affected homepage icon sizing: the active recovery cards use `.watany-service-card > span`, which remained `38px × 38px`, while the failed hotfix enlarged V4 launcher icon variables instead.

## Root cause

`PRODUCTION_HOMEPAGE_ROOT_CAUSE=ACTIVE_SURFACE_AND_CSS_LAYER_AUTHORITY_MISMATCH`

Contributing factors:

1. production `/home` used `HomeRecoveryPage`;
2. the hotfix primarily modified V4 launcher styles;
3. recovery CSS loaded later and retained the two-column grid;
4. the local test did not assert the active production recovery surface.

## Successor repair

The successor branch keeps the valid authentication/forms/calculator changes from the failed merged hotfix and adds a small final recovery-layer override:

`apps/web-user/src/styles/post-deploy-runtime-closure.css`

It is imported last by `watany-v4-theme.css` and explicitly sets:

- active recovery homepage grid to three columns;
- recovery homepage icon tile to 48px;
- homepage labels to 14px;
- darker secondary text;
- brighter text on dark recovery chrome.

A new regression test validates:

- `HomeRecoveryPage` actually uses `.watany-service-grid`;
- the runtime closure loads after legacy recovery CSS;
- the active grid is three columns;
- active recovery icon and label sizing are present.

## Deployment governance

Do not redeploy `65b1763aced36eccac2d9931c2dbeb47efc173ee` unchanged.

The successor must pass, on its exact SHA:

1. targeted Vitest contract;
2. web-user typecheck;
3. production build;
4. production-build browser verification at 320/360/390/430px;
5. login redirect tests;
6. school calculator single-modal verification;
7. form viewer resolution tests;
8. API matrix;
9. canary deployment and asset-manifest parity;
10. production smoke tests before promotion.

Production must remain on the verified rollback until these gates pass.
