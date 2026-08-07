# Run backend keyboard normalization test with safe env vars and in-memory SQLite
$env:TEST_DATABASE_URL = 'sqlite:///:memory:'
$env:POSTGRES_PASSWORD = 'testpass'
$env:JWT_SECRET = '01234567890123456789012345678901'
$env:SUPERADMIN_PASSWORD = 'testpass'
Write-Host "TEST_DATABASE_URL=$env:TEST_DATABASE_URL"
Write-Host "Starting pytest..."
& .\.venv\Scripts\python.exe -m pytest apps/api-backend/apps/api/tests/test_phase35.py::test_garbled_keyboard_normalization -q
exit $LASTEXITCODE
