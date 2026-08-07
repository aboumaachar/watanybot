#!/usr/bin/env bash
# fix_fastapi_port.sh
# Run this once on the production server (as root or koudama user) to:
#   1. Kill any uvicorn process regardless of port
#   2. Start FastAPI on the correct port 8012
#   3. Register it with PM2 and save the process list
#
# Usage:
#   bash fix_fastapi_port.sh
#
# After running, verify:
#   curl http://localhost:8012/health
#   pm2 list

set -euo pipefail

DEPLOY_DIR="/home/koudama"
FASTAPI_DIR="$DEPLOY_DIR/apps/api-backend"
LOG_DIR="$DEPLOY_DIR/logs"
PORT=8012
HOST="127.0.0.1"
WORKERS=4
APP_MODULE="apps.api.main:app"

echo "==> [1/5] Killing any running uvicorn processes..."
pkill -f "uvicorn" || echo "  No uvicorn process found (ok)"
sleep 2

echo "==> [2/5] Verifying port $PORT is free..."
if ss -tlnp | grep -q ":$PORT "; then
    echo "  ERROR: Port $PORT still occupied. Check manually: ss -tlnp | grep $PORT"
    exit 1
fi
echo "  Port $PORT is free."

echo "==> [3/5] Ensuring log directory exists..."
mkdir -p "$LOG_DIR"

echo "==> [4/5] Starting FastAPI via PM2 on port $PORT..."
cd "$FASTAPI_DIR"

# Delete old entry if it exists
pm2 delete watanybot-fastapi 2>/dev/null || true

pm2 start ecosystem.config.cjs \
    --env production \
    --name watanybot-fastapi

echo "==> [5/5] Saving PM2 process list..."
pm2 save

echo ""
echo "==> Done. Verifying health endpoint..."
sleep 3
curl -sf "http://$HOST:$PORT/health" && echo "  FastAPI is healthy on port $PORT" \
    || echo "  WARNING: Health check failed — check logs: pm2 logs watanybot-fastapi"

echo ""
echo "pm2 list:"
pm2 list
