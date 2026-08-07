# Jobs Source Ingest Script

This script is intentionally safe by default.

## Probe registry only
```bash
node apps/gateway-api/scripts/jobs-source-ingest-safe.mjs
```

## Fetch ReliefWeb API sample and write snapshot
```bash
node apps/gateway-api/scripts/jobs-source-ingest-safe.mjs --fetch-reliefweb --write
```

## Rules
- Do not crawl LinkedIn or commercial job boards aggressively.
- Prefer official APIs, RSS, CSV, JSON, or partner feeds.
- Store metadata, short summaries, and original links.
- Respect source terms and robots.txt.