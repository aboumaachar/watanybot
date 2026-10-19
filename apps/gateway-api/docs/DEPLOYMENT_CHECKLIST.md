# Deployment Checklist

This checklist is the safest default path for deploying the gateway to production and for recovering after Node upgrades.

## 1. Pre-Deploy

- Confirm production process ownership is still `root` PM2.
- Confirm the active release root is `/opt/watany/current` and the gateway app directory is `/opt/watany/current/apps/gateway-api`.
- Confirm the checked-in deployment entry points are unchanged:
  - [ecosystem.config.cjs](../ecosystem.config.cjs)
  - [start.sh](../start.sh)
- Confirm `.env` contains the expected production DB settings and JWT secret.
- Confirm ERPNext CRM configuration without placing secrets in the release tree:
  - Source default is `ERPNEXT_BASE_URL=http://127.0.0.1:18080`; this production host must explicitly use `ERPNEXT_BASE_URL=http://127.0.0.1:18081` because port `18080` belongs to another Node service.
  - `ERPNEXT_SITE_NAME=frontend`
  - `ERPNEXT_CREDENTIAL_FILE` points to the protected `/opt/watany/secrets/erpnext-gateway.production.json` JSON file containing `apiKey`, `apiSecret`, and `principal`.
  - Never print, commit, copy, or place credential values in `.env`.

### NNA signed-news env note

If you want the gateway to use NNA's signed backend news API (instead of HTML fallback), set these in production `.env`:

```env
NNA_CLIENT_ID=<issued-client-id>
NNA_SIGNING_KEY=<issued-signing-key>
```

Behavior:

- If both vars are present, `/api/news` uses the signed NNA backend endpoint.
- If either var is missing, `/api/news` falls back to parsing the public NNA latest-news page.

## 2. Sync Code

- Update the release tree that will become `/opt/watany/current`.
- From the repo root on Windows, the canonical deploy command is `powershell -ExecutionPolicy Bypass -File .\deploy-gateway-live.ps1 -NoPrompt`.
- Keep `ecosystem.config.cjs` and `start.sh` in sync with the repo.
- Before PM2 recreation, verify the target release contains the current `ecosystem.config.cjs`, `src/routes/diagnostics.ts`, and the expected AI/voice `.env` keys.
- Do not replace the running PM2 process with ad hoc shell commands unless you are in incident recovery.
- Do not run `pnpm --dir apps/gateway-api build`; the gateway has no checked-in `build` script and runs directly from `tsx`.

## 3. Install Dependencies

Run in the deployed app directory:

```bash
cd /opt/watany/current/apps/gateway-api
pnpm install --frozen-lockfile
```

If `pnpm` is unavailable in the runtime shell, use the server's working package manager path rather than switching tools mid-deploy.

## 4. Node Upgrade Safety Step

If Node changed since the last successful deploy, rebuild native modules before restart:

```bash
cd /opt/watany/current/apps/gateway-api
npm rebuild better-sqlite3 --build-from-source
```

Current ABI-sensitive runtime modules observed on production:

- `better-sqlite3`
- `@rollup/rollup-linux-x64-gnu`

`better-sqlite3` is the one that must be treated as operationally critical.

## 5. Restart Through PM2

Run from `/opt/watany/current/apps/gateway-api`:

```bash
pm2 delete watany-gateway || true
pm2 start ecosystem.config.cjs --only watany-gateway --env production
pm2 save
```

If the process already exists, restart it instead:

```bash
pm2 restart watany-gateway --update-env
pm2 save
```

## 6. Verify Startup Logs

Healthy startup should show:

- `kb_nodes_fts_ready`
- `Plugin DB initialized with better-sqlite3 (persistent, WAL mode)`
- `Server listening at http://127.0.0.1:8015`

Failure indicators:

- `ERR_DLOPEN_FAILED`
- `Module did not self-register`
- `Plugin DB (better-sqlite3) unavailable; falling back to in-memory store.`

## 7. Verify Public Health

Check public auth through the edge path:

```bash
curl -X POST https://koudama.com/mcp/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<user>","password":"<password>"}'
```

Expected result:

- HTTP 200
- access token present
- refresh token present

## 8. Verify Family Pension Regression Guard

Run the family pension smoke checks after any chat, retrieval, intent, or deployment change.

Public edge path:

```bash
cd /home/koudama/watanybot-api
node ./scripts/run_smoke_suite.mjs family-pension --target public
```

Direct listener path:

```bash
cd /home/koudama/watanybot-api
node ./scripts/run_smoke_suite.mjs family-pension --target direct
```

Expected result for both:

- Final line is `Family pension smoke PASSED`
- No small-talk fallback replies for pension-domain questions
- Responses stay pension-domain for these high-risk variants:
  - `معاش الابنة`
  - `شو شروط معاش الابنة`
  - `معاش الابنة الأرملة`
  - `معاش الابنة المطلقة`
  - `ابني يدرس هل بيطلعله معاش`
  - `معاش الابن القاصر`
  - `معاش الزوجة`
  - `معاش الوالدة`

Optional second high-risk smoke set for death benefits and heirs:

```bash
cd /home/koudama/watanybot-api
node ./scripts/run_smoke_suite.mjs death-benefits --target public
node ./scripts/run_smoke_suite.mjs death-benefits --target direct
```

Expected result for both:

- Final line is `Death benefit smoke PASSED`
- Short queries such as `تعويض الوفاة`, `معاملة وفاة`, `الورثة`, and `مساعدة وفاة` stay in the death-benefit domain

Optional third high-risk smoke set for short financial queries:

```bash
cd /home/koudama/watanybot-api
node ./scripts/run_smoke_suite.mjs financial-short-queries --target public
node ./scripts/run_smoke_suite.mjs financial-short-queries --target direct
```

Expected result for both:

- Final line is `Financial short-query smoke PASSED`
- Short queries such as `راتب التقاعد`, `بدل انتقال`, `منحة مدرسية`, and `تعويض انتقال` stay in the financial domain

Optional fourth high-risk smoke set for medical and hospitalization entry queries:

```bash
cd /home/koudama/watanybot-api
node ./scripts/run_smoke_suite.mjs medical-short-queries --target public
node ./scripts/run_smoke_suite.mjs medical-short-queries --target direct
```

Expected result for both:

- Final line is `Medical short-query smoke PASSED`
- Queries such as `طبابة`, `بطاقة صحية`, `تصريح طبابة`, and `موافقة معالجة` stay in the medical domain

Optional fifth high-risk smoke set for administrative entry queries:

```bash
cd /home/koudama/watanybot-api
node ./scripts/run_smoke_suite.mjs admin-short-queries --target public
node ./scripts/run_smoke_suite.mjs admin-short-queries --target direct
```

Expected result for both:

- Final line is `Administrative short-query smoke PASSED`
- Queries such as `بيان خدمة`, `إفادة راتب`, `إخراج قيد`, `طلب خطي`, and `تصديق مستند` stay in the administrative domain

## 9. Incident Shortcut

If the app comes up but storage falls back to memory after a Node change, the shortest safe recovery is:

```bash
cd /home/koudama/watanybot-api
npm rebuild better-sqlite3 --build-from-source
pm2 restart watanybot-api
```