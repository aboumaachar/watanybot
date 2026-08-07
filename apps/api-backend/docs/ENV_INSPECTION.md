# Environment Inspection

## How to run

- Windows (PowerShell):
  - `./scripts/env_inspect.ps1`
- Linux/macOS (sh):
  - `./scripts/env_inspect.sh`
- Direct:
  - `python scripts/env_inspector.py`

The report is written to `docs/ENV_INSPECTION_REPORT.md` and a short summary is printed to the terminal.

## What PASS / WARN / FAIL mean

- PASS: Check is satisfied.
- WARN: Non-blocking issue or missing optional configuration.
- FAIL: Blocking misconfiguration that should be fixed before running the system.

Exit codes:
- 0 = PASS
- 2 = WARN
- 4 = FAIL

## Common fixes

- Missing KB file:
  - Place the KB at `./data/kb.sqlite` and set `KB_SQLITE_PATH=./data/kb.sqlite`.
- JWT secret too short:
  - Set `JWT_SECRET` to a value of at least 32 characters.
- Missing WhatsApp variables:
  - Set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_VERIFY_TOKEN`.
- Ports already in use:
  - Stop the conflicting services or change the service ports.
