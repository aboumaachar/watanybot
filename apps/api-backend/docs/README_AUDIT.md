# WatanBot Audit Guide

This guide explains how to run the audit artifacts produced by Script #1.

## Files produced by audit
- Gap report: [docs/GAP_REPORT.md](docs/GAP_REPORT.md)
- Implementation plan: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- Repo doctor: [scripts/doctor_repo.py](scripts/doctor_repo.py)

## Run repo doctor (Python)

From the repo root:

```bash
python scripts/doctor_repo.py
```

What it checks:
- Repo structure and env presence
- SQLite KB file existence
- SQLite schema/FTS sanity
- API health endpoint (if running)

## Optional: run existing ops doctor

```bash
./scripts/doctor.sh
```

Note: `doctor.sh` checks the Postgres-based KB only.

## Smoke test

From [apps/api](apps/api):

```bash
pytest -k smoke
```
