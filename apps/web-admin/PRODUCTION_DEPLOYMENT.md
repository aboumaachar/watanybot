# web-admin production deployment

The production `web-admin` surface is a static Vite build served from:

- Public URL: `https://koudama.com/ops/`
- cPanel live directory: `/home/koudama/public_html/ops`
- Production API: `https://koudama.com/mcp`
- User application origin: `https://koudama.com`

## Routing contract

`apps/web-admin` uses Vite's `BASE_URL` as the React Router basename.

Production builds use:

```bash
VITE_BASE=/ops/
VITE_API_URL=https://koudama.com/mcp
VITE_WEB_USER_ORIGIN=https://koudama.com
```

This keeps existing application routes intact beneath `/ops/`, for example:

- `/ops/`
- `/ops/users`
- `/ops/admin/command-center`
- `/ops/admin/kb-studio`
- `/ops/admin/documents`
- `/ops/admin/procedures`
- `/ops/superadmin/...`

The deployment script installs a subdirectory `.htaccess` fallback so direct navigation to SPA routes resolves to `/ops/index.html`.

## Canonical deployment entry point

Run on the cPanel account as user `koudama`:

```bash
bash /home/koudama/repositories/watanybot/scripts/cpanel-deploy-web-admin.sh
```

The script:

1. Requires the canonical branch `integration/theme-upgrade-20260728`.
2. Requires a clean cPanel repository worktree.
3. Installs locked dependencies.
4. Builds `apps/web-admin` with the production base/API/origin.
5. Creates a backup of the current `/home/koudama/public_html/ops` tree.
6. Publishes the new static build.
7. Writes `.apex-web-admin-deployed-sha`.
8. Verifies the public marker, root shell, deep-link fallback, and JavaScript asset.
9. Rolls back the static admin tree if a post-copy verification step fails.

This mechanism does not deploy or restart the gateway and does not run database migrations.
## Fail-closed `/ops` artifact gate

The deployment controller must run `apps/web-admin/scripts/verify-ops-build.mjs` before staging and again against the staged/live tree. The gate rejects a build unless the emitted main bundle is rooted at `/ops/`, the compiled React Router basename resolves to `/ops`, all emitted lazy dependencies exist, and the current Jobs + Universal Forms + Form Creator chunks retain their locator/form tokens. A deliberately `/superadmin/`-built candidate must fail this gate.

The Vite configuration now defaults to `/ops/`; `VITE_BASE` remains an explicit override for controlled non-production builds. This makes an omitted production environment variable fail safe for the live admin surface rather than silently producing a `/superadmin/` bundle.

If the live index references a versioned `ops-runtime-extension-v2-*.js`, the deployment controller preserves that exact referenced file and script tag in the staged release, then proves public byte parity after cutover. Post-cutover failure paths call rollback directly and restore the frozen live backup before returning failure.

The documented cPanel checkout is a deployment prerequisite, not a source of truth when stale: it must contain `scripts/cpanel-deploy-web-admin.sh`, the emitted-build verifier, the expected branch, and an otherwise clean worktree before deployment. If any of those checks fail, do not deploy from that checkout.
