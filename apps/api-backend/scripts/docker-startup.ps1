# Docker startup script for Windows
# This runs inside the container to set up the database and start the API

python /app/scripts/guard_root_strict.py --expect-entrypoint main:app --root /app
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Guard check failed. Aborting." -ForegroundColor Red
    exit 13
}

Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "🔄 Running database migrations..." -ForegroundColor Cyan
Set-Location /app
alembic upgrade head

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migration failed!" -ForegroundColor Red
    exit 1
}

Write-Host "👤 Seeding superadmin user..." -ForegroundColor Cyan
python seed.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Seeding failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Startup complete! Starting API server..." -ForegroundColor Green
uvicorn main:app --host 0.0.0.0 --port 8000
