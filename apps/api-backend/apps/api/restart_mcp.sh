#!/bin/bash
# restart_mcp.sh — kill old uvicorn, clear cache, restart with patched app.py
set -e

echo "Killing all uvicorn processes..."
pkill -9 -f uvicorn 2>/dev/null || true
sleep 3

echo "Clearing __pycache__..."
rm -rf ~/public_html/mcp/server/__pycache__

echo "Starting uvicorn..."
cd ~/public_html/mcp
source .venv/bin/activate
nohup python -m uvicorn server.app:app --host 127.0.0.1 --port 8770 > ~/public_html/mcp/uvicorn.log 2>&1 &
disown

sleep 3
echo "Port check:"
ss -ltnp 2>/dev/null | grep 8770 || echo "WARNING: port 8770 not listening"
echo "Log tail:"
tail -5 ~/public_html/mcp/uvicorn.log 2>/dev/null || echo "no log"
echo "DONE"
