# Watany V1 Runtime Chain Integrity Test

This repo-owned smoke test promotes the proven APEX runtime-chain checks into a repeatable test file.

## What it checks

- Watany V1 public runtime script loaders are present once.
- Popup chain order is preserved: v210, then v211, then v212.
- Required runtime asset URLs return JavaScript, not SPA fallback HTML.
- Required marker strings exist inside the deployed/local assets.
- Duplicate watany-v1 runtime loaders are rejected.

## How to run

Start the web-user dev server first, then run:

```
pnpm --dir apps/web-user test:watany-v1-runtime-chain
```

For a custom URL:

```
node apps/web-user/tests/watany-v1-runtime-chain-integrity.spec.cjs --base-url https://koudama.com/mcp
```

## Rule

Do not add new one-off `watany-v1-*.js` runtime layers unless this manifest and test are updated in the same change.
