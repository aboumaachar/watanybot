param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $ComposeArgs
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $repoRoot "watan\docker-compose.yml"

if (-not (Test-Path $composeFile)) {
  Write-Error "Nested runtime compose file not found: $composeFile"
  exit 1
}

if (-not $ComposeArgs -or $ComposeArgs.Count -eq 0) {
  Write-Host "Usage: .\scripts\watan-runtime.ps1 up -d --build api-backend"
  Write-Host "       .\scripts\watan-runtime.ps1 logs -f gateway-api"
  exit 0
}

Push-Location $repoRoot
try {
  & docker compose -f $composeFile @ComposeArgs
  exit $LASTEXITCODE
} finally {
  Pop-Location
}