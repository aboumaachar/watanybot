# Production Runtime

This document captures the Watany gateway process shape verified live on 2026-06-15.

Primary deployment references:

- PM2 config: [ecosystem.config.cjs](../ecosystem.config.cjs)
- Launch wrapper: [start.sh](../start.sh)
- Checklist: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

## Active Process

- PM2 owner: `root`
- PM2 home: `/root/.pm2`
- App name: `watany-gateway`
- Working directory: `/opt/watany/current/apps/gateway-api`
- Launch shape: `/bin/bash ./start.sh`
- Effective Node runtime: `v20.20.0`

## Native Modules

The deployed API currently contains these `.node` binaries:

- `better-sqlite3`
- `@rollup/rollup-linux-x64-gnu`

`better-sqlite3` is the operationally important one because the gateway uses it at runtime for:

- persistent plugin storage
- KB node FTS access

## Safe Repair After Node Upgrades

If the gateway starts logging ABI errors such as `Module did not self-register` or falls back to the in-memory plugin DB, run this on the server:

```bash
cd /opt/watany/current/apps/gateway-api
npm rebuild better-sqlite3 --build-from-source
pm2 restart watany-gateway --update-env
```

## Verification Signals

Healthy startup should include these log lines:

- `kb_nodes_fts_ready`
- `Plugin DB initialized with better-sqlite3 (persistent, WAL mode)`
- `Server listening at http://127.0.0.1:8015`

## Release Guards

Before PM2 recreation, the target release must satisfy all of these:

- `ecosystem.config.cjs` contains `name: 'watany-gateway'`
- `src/routes/diagnostics.ts` contains `/ready` and `/version`
- `apps/gateway-api/.env` contains the expected Ollama + local STT production keys

If the repair did not hold, you will usually see one of these instead:

- `ERR_DLOPEN_FAILED`
- `Module did not self-register`
- `Plugin DB (better-sqlite3) unavailable; falling back to in-memory store.`

## Auth Smoke Test

After any restart, confirm public auth still works through the public edge:

```bash
curl -X POST https://koudama.com/mcp/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<user>","password":"<password>"}'
```

## Family Pension Smoke Test

After any restart or deploy that touches chat classification, retrieval, or gateway routing, run both smoke presets from the deployed app directory:

```bash
cd /home/koudama/watanybot-api
node ./scripts/run_smoke_suite.mjs family-pension --target public
node ./scripts/run_smoke_suite.mjs family-pension --target direct
```

Healthy behavior:

- Both commands end with `Family pension smoke PASSED`
- Public edge and direct listener both return pension-domain answers
- Queries such as `معاش الابنة` and `ابني يدرس هل بيطلعله معاش` do not fall back to conversational small-talk

## Death Benefits Smoke Test

An additional short-query guard is available for death-benefit and heirs flows:

```bash
cd /home/koudama/watanybot-api
node ./scripts/run_smoke_suite.mjs death-benefits --target public
node ./scripts/run_smoke_suite.mjs death-benefits --target direct
```

Healthy behavior:

- Both commands end with `Death benefit smoke PASSED`
- Queries such as `تعويض الوفاة`, `معاملة وفاة`, `الورثة`, and `مساعدة وفاة` remain domain-specific and do not collapse to generic fallback replies

## Financial Short-Query Smoke Test

An additional short-query guard is available for financial and benefits flows:

```bash
cd /home/koudama/watanybot-api
node ./scripts/run_smoke_suite.mjs financial-short-queries --target public
node ./scripts/run_smoke_suite.mjs financial-short-queries --target direct
```

Healthy behavior:

- Both commands end with `Financial short-query smoke PASSED`
- Queries such as `راتب التقاعد`, `بدل انتقال`, `منحة مدرسية`, and `تعويض انتقال` remain domain-specific and do not collapse to generic fallback replies

## Medical Short-Query Smoke Test

An additional short-query guard is available for medical and hospitalization entry flows:

```bash
cd /home/koudama/watanybot-api
node ./scripts/run_smoke_suite.mjs medical-short-queries --target public
node ./scripts/run_smoke_suite.mjs medical-short-queries --target direct
```

Healthy behavior:

- Both commands end with `Medical short-query smoke PASSED`
- Queries such as `طبابة`, `بطاقة صحية`, `تصريح طبابة`, and `موافقة معالجة` remain domain-specific and do not collapse to generic fallback replies

## Administrative Short-Query Smoke Test

An additional short-query guard is available for administrative entry flows:

```bash
cd /home/koudama/watanybot-api
node ./scripts/run_smoke_suite.mjs admin-short-queries --target public
node ./scripts/run_smoke_suite.mjs admin-short-queries --target direct
```

Healthy behavior:

- Both commands end with `Administrative short-query smoke PASSED`
- Queries such as `بيان خدمة`, `إفادة راتب`, `إخراج قيد`, `طلب خطي`, and `تصديق مستند` remain domain-specific and do not collapse to generic fallback replies