$env:CHOKIDAR_USEPOLLING = 'true'
$env:CHOKIDAR_IGNORED = '**/.tools/**;**/.pma/**'
$report = Join-Path $PSScriptRoot '..\vitest_report.json'
Write-Host "Running Vitest with JSON reporter -> $report"
pnpm exec vitest -- --run --reporter=json | Out-File -FilePath $report -Encoding utf8
Write-Host "Wrote $report"
exit $LASTEXITCODE
