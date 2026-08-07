# Project Root Rules

## Authoritative Root
`C:\xampp\htdocs\projectx\watanbot`

## Valid Run Locations
Only run from one of these roots:
1) Repo root (recommended): `C:\xampp\htdocs\projectx\watanbot`
2) API root: `C:\xampp\htdocs\projectx\watanbot\apps\api`

## Valid Entrypoints
- From repo root: `apps.api.main:app`
- From apps/api: `main:app`

## Detach Duplicate Projects
Dry-run:
```
python scripts/aggressive_detach_duplicates.py
```

Execute:
```
python scripts/aggressive_detach_duplicates.py --yes
```

## Rollback
Use the generated rollback script in the quarantine folder:
```
_quarantine/<timestamp>/rollback.ps1
```

## Notes
- Do not run from `public-salaries-app` or `_quarantine`.
- Guard scripts fail fast when launched from a detached folder.
