# Run Vitest once (non-watch) with polling and ignored paths to avoid FSWatcher issues
$env:CHOKIDAR_USEPOLLING = 'true'
$env:CHOKIDAR_IGNORED = '**/.tools/**'
Write-Host "Environment: CHOKIDAR_USEPOLLING=$env:CHOKIDAR_USEPOLLING, CHOKIDAR_IGNORED=$env:CHOKIDAR_IGNORED"
Write-Host "Running Vitest (single run)..."
pnpm exec vitest -- --run --reporter=dot
exit $LASTEXITCODE
