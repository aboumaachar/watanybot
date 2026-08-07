# Lebanese Job Source Daily Crawler Expansion

This module expands WatanyBot Civilian Jobs & Services with a source-coverage registry and a daily crawler contract.

## Rules

- Do not auto-publish crawled listings.
- Respect source terms and robots/policy checks before source-specific adapters are enabled.
- Social/WhatsApp/Facebook/Instagram jobs are manual-intake only unless the source is public and approved.
- All imports enter `PENDING_REVIEW` for admin approval.
- The military recruitment feature `إعلانات التطويع` remains separate and untouched.

## Daily Cron / Task Scheduler

Use `scripts/civilian-jobs-daily-crawl.ps1` from Windows Task Scheduler or server cron.

Example Windows Task Scheduler action:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\xampp\htdocs\projectx\watanybot\scripts\civilian-jobs-daily-crawl.ps1 -GatewayBaseUrl http://127.0.0.1:8010
```

Recommended cadence: once daily at 06:00 Beirut time, with admin review queue processing after import.

## Next Production Tasks

1. Wire `registerCivilianJobsDailyCrawlerRoutes` into gateway bootstrap if not already wired.
2. Persist `civilian_job_sources`, `civilian_job_crawl_runs`, and `civilian_imported_job_listings` using the active DB adapter.
3. Add source-specific adapters only after policy review.
4. Add admin UI for coverage health and crawl runs.
5. Run live smoke only against running gateway/web servers.