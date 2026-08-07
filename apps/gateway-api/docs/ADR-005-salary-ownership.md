# ADR-005: Salary Calculation Ownership

## Status
Accepted — 2026-03-08

## Context
Salary/pension calculation exists in both services:

- **Node gateway**: `GET /api/salary` (lookup), `GET /api/salary/meta`, `POST /api/salary/calc` — uses 303 pre-loaded salary entries, rank metadata, allowance tables. Full v4 pension calculator with family/medals modifiers.
- **Python backend**: `POST /api/v2/salary/compute` — separate computation endpoint.
- **Node also proxies** `/api/v2/salary/compute` → Python.

The Node implementation is more complete (v4 calculator with all modifiers). The Python endpoint duplicates core computation.

## Decision
**Node gateway** is the authoritative salary/pension calculator.

- Node owns: `/api/salary`, `/api/salary/meta`, `/api/salary/calc` — all salary logic.
- Node's proxy to `/api/v2/salary/compute` is **preserved for backward compatibility** but will be deprecated in 3 months.
- Python's `/api/v2/salary/compute` will return a deprecation header and redirect notice.

## Consequences
- Single source of truth for salary calculation in Node.
- Pre-computed tables stay in-memory (fast, no network hop).
- Admin salary rule editing in Node (`/api/admin/kb/rules`) remains authoritative.
