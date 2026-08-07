# Jobs ReliefWeb Source Probe and Normalized Sample

This module is the first safe source-ingestion proof for WatanyBot Jobs.

## Purpose

- Use ReliefWeb official API, not HTML scraping.
- Fetch a small Lebanon jobs sample.
- Normalize into the WatanyBot jobs schema.
- Preserve original job/source links.
- Keep content metadata/link-only unless terms and source permission allow reuse.

## Generated command

```powershell
node apps/gateway-api/scripts/jobs-reliefweb-source-probe.mjs --appname YOUR_APPROVED_RELIEFWEB_APPNAME --limit 5 --write --project-root C:\xampp\htdocs\projectx\watanybot
```

## Normalized location model

Every job location should be mapped into:

```text
Mohafaza -> Caza -> Village/Town -> Exact address
```

ReliefWeb may provide only country/city-level data. Missing fields must stay blank until admin normalization or a trusted mapping process fills them.

## Safety rule

This script is API-only. It does not crawl commercial boards or copy full job descriptions into WatanyBot.