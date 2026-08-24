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