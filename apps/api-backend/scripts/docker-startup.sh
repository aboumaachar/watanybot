#!/bin/bash
# Docker startup script - runs migrations and seeds superadmin

set -e

python /app/scripts/guard_root_strict.py --expect-entrypoint main:app --root /app

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

echo "🔄 Running database migrations..."
cd /app
alembic upgrade head

echo "👤 Seeding superadmin user..."
python seed.py

echo "✅ Startup complete! Starting API server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
