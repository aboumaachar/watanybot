#!/bin/bash
set -e

cd "$(dirname "$0")/.."

OUT_DIR="docs"
ENV_JSON="${OUT_DIR}/.kb_env.json"
SQLITE_JSON="${OUT_DIR}/.kb_sqlite.json"
PG_JSON="${OUT_DIR}/.kb_pg.json"

python scripts/kb_sqlite_inspect.py --kb-path "${KB_SQLITE_PATH:-./data/kb.sqlite}" --out "$SQLITE_JSON" || true
python scripts/kb_postgres_inspect.py --out "$PG_JSON" || true
python scripts/kb_env_audit.py --sqlite-json "$SQLITE_JSON" --postgres-json "$PG_JSON" --out "${OUT_DIR}/KB_AUDIT_REPORT.md" --readiness "${OUT_DIR}/KB_STEP3_READINESS.md"

EXIT_CODE=$?

echo "KB audit completed with exit code ${EXIT_CODE}"
exit $EXIT_CODE
