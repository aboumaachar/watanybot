#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 1: Foundation — Verify & repair infrastructure, install deps, validate configs
#>

param(
    [string]$ReportDir = "$PSScriptRoot\..\..\reconstruction-reports",
    [switch]$Quiet,
    [switch]$Fix  # When set, auto-install missing deps
)

$ErrorActionPreference = "Continue"
$Root = Resolve-Path "$PSScriptRoot\..\.."

$PhaseReport = @{
    phase     = 1
    name      = "Foundation"
    startedAt = (Get-Date -Format o)
    status    = "running"
    steps     = @()
    issues    = @()
}

function Write-PhaseLog($msg) { if (-not $Quiet) { Write-Host "  [Phase1] $msg" -ForegroundColor Yellow } }
function Add-Step($name, $status, $detail) {
    $PhaseReport.steps += @{ name=$name; status=$status; detail=$detail; timestamp=(Get-Date -Format o) }
}

# ── 1.1 Verify Node.js (>= 18) ──────────────────────────────────
Write-PhaseLog "Checking Node.js..."
$nodeVer = $null
try { $nodeVer = (node --version 2>$null) -replace '^v','' } catch {}
if ($nodeVer) {
    $major = [int]($nodeVer.Split('.')[0])
    if ($major -ge 18) {
        Add-Step "node" "pass" "Node.js v$nodeVer (>= 18)"
    } else {
        Add-Step "node" "warn" "Node.js v$nodeVer < 18. Upgrade recommended."
        $PhaseReport.issues += @{severity="warning"; msg="Node.js $nodeVer < 18"}
    }
} else {
    Add-Step "node" "fail" "Node.js not found"
    $PhaseReport.issues += @{severity="critical"; msg="Node.js not installed"}
}

# ── 1.2 Verify pnpm ─────────────────────────────────────────────
Write-PhaseLog "Checking pnpm..."
$pnpmVer = $null
try { $pnpmVer = pnpm --version 2>$null } catch {}
if ($pnpmVer) {
    Add-Step "pnpm" "pass" "pnpm v$pnpmVer"
} elseif ($Fix) {
    Write-PhaseLog "Installing pnpm..."
    npm install -g pnpm 2>$null
    Add-Step "pnpm" "fixed" "pnpm installed"
} else {
    Add-Step "pnpm" "fail" "pnpm not found"
    $PhaseReport.issues += @{severity="critical"; msg="pnpm not installed. Run: npm install -g pnpm"}
}

# ── 1.3 Verify Python ───────────────────────────────────────────
Write-PhaseLog "Checking Python..."
$pyVer = $null
try { $pyVer = (python --version 2>$null) -replace 'Python ','' } catch {}
if ($pyVer) {
    $pyMajor = [int]($pyVer.Split('.')[0])
    if ($pyMajor -ge 3) {
        Add-Step "python" "pass" "Python $pyVer"
    } else {
        Add-Step "python" "warn" "Python $pyVer — need >= 3.10"
    }
} else {
    Add-Step "python" "warn" "Python not found (needed for api-backend)"
    $PhaseReport.issues += @{severity="warning"; msg="Python not installed"}
}

# ── 1.4 Install node dependencies ───────────────────────────────
Write-PhaseLog "Checking node_modules..."
$nmRoot    = Test-Path "$Root\node_modules"
$nmGW      = Test-Path "$Root\apps\gateway-api\node_modules"
$nmWebUser = Test-Path "$Root\apps\web-user\node_modules"

if ($nmRoot -and $nmGW -and $nmWebUser) {
    Add-Step "node_modules" "pass" "All node_modules present"
} elseif ($Fix) {
    Write-PhaseLog "Running pnpm install..."
    Push-Location $Root
    pnpm install --frozen-lockfile 2>$null
    if ($LASTEXITCODE -ne 0) { pnpm install 2>$null }
    Pop-Location
    Add-Step "node_modules" "fixed" "pnpm install completed"
} else {
    $missing = @()
    if (-not $nmRoot)    { $missing += "root" }
    if (-not $nmGW)      { $missing += "gateway-api" }
    if (-not $nmWebUser) { $missing += "web-user" }
    Add-Step "node_modules" "fail" "Missing in: $($missing -join ', ')"
    $PhaseReport.issues += @{severity="critical"; msg="node_modules missing. Run: pnpm install"}
}

# ── 1.5 Install Python deps ─────────────────────────────────────
$pyReqs = "$Root\apps\api-backend\requirements.txt"
if (Test-Path $pyReqs) {
    $venvPath = "$Root\apps\api-backend\.venv"
    $hasVenv  = Test-Path $venvPath
    if ($hasVenv) {
        Add-Step "python_venv" "pass" "Python venv exists"
    } elseif ($Fix -and $pyVer) {
        Write-PhaseLog "Creating Python venv and installing deps..."
        Push-Location "$Root\apps\api-backend"
        python -m venv .venv 2>$null
        & ".venv\Scripts\pip.exe" install -r requirements.txt 2>$null
        Pop-Location
        Add-Step "python_venv" "fixed" "venv created & deps installed"
    } else {
        Add-Step "python_venv" "warn" "No Python venv found"
        $PhaseReport.issues += @{severity="warning"; msg="Python venv not set up for api-backend"}
    }
}

# ── 1.6 Validate config files ───────────────────────────────────
Write-PhaseLog "Validating configuration files..."
$configChecks = @(
    @{name="pnpm-workspace.yaml"; path="$Root\pnpm-workspace.yaml"},
    @{name="tsconfig (gateway)";  path="$Root\apps\gateway-api\tsconfig.json"},
    @{name="tsconfig (web-user)"; path="$Root\apps\web-user\tsconfig.json"},
    @{name="vite.config (web)";   path="$Root\apps\web-user\vite.config.ts"},
    @{name=".env.example (gw)";   path="$Root\apps\gateway-api\.env.example"},
    @{name=".env (gateway)";      path="$Root\apps\gateway-api\.env"},
    @{name="biome.json";          path="$Root\biome.json"},
    @{name="docker-compose.yml";  path="$Root\docker-compose.yml"}
)

$configPassed = 0
foreach ($cc in $configChecks) {
    if (Test-Path $cc.path) {
        $configPassed++
    } else {
        $PhaseReport.issues += @{severity="info"; msg="Config missing: $($cc.name)"}
    }
}
Add-Step "config_files" $(if ($configPassed -ge 6) {"pass"} elseif ($configPassed -ge 4) {"warn"} else {"fail"}) "$configPassed/$($configChecks.Count) config files present"

# ── 1.7 Validate directory structure ────────────────────────────
Write-PhaseLog "Validating directory structure..."
$requiredDirs = @(
    "apps\gateway-api\src",
    "apps\gateway-api\src\routes",
    "apps\gateway-api\src\auth",
    "apps\gateway-api\src\ai",
    "apps\gateway-api\src\db",
    "apps\gateway-api\src\filters",
    "apps\gateway-api\src\ws",
    "apps\gateway-api\src\kb",
    "apps\web-user\src",
    "apps\web-user\src\components",
    "apps\web-user\src\pages",
    "apps\web-user\src\styles",
    "apps\web-user\src\lib",
    "apps\web-user\src\store",
    "apps\web-user\src\types",
    "apps\api-backend\apps",
    "packages\types",
    "packages\kb",
    "packages\i18n",
    "tests\e2e",
    "monitoring"
)

$dirsPresent = 0
$dirsMissing = @()
foreach ($d in $requiredDirs) {
    if (Test-Path "$Root\$d") { $dirsPresent++ } else { $dirsMissing += $d }
}
$dirStatus = if ($dirsMissing.Count -eq 0) { "pass" } elseif ($dirsMissing.Count -le 3) { "warn" } else { "fail" }
Add-Step "directories" $dirStatus "$dirsPresent/$($requiredDirs.Count) directories present"

if ($Fix -and $dirsMissing.Count -gt 0) {
    foreach ($dm in $dirsMissing) {
        New-Item -ItemType Directory -Force -Path "$Root\$dm" | Out-Null
    }
    Add-Step "directories_fix" "fixed" "Created $($dirsMissing.Count) missing directories"
}

# ── 1.8 TypeScript compilation check ────────────────────────────
Write-PhaseLog "Checking TypeScript compilation..."
Push-Location "$Root\apps\gateway-api"
try {
    $tscOut = npx tsc --noEmit 2>&1 | Out-String
    $errorCount = ([regex]::Matches($tscOut, 'error TS\d+')).Count
    if ($errorCount -eq 0) {
        Add-Step "typecheck_gateway" "pass" "Gateway compiles clean"
    } else {
        Add-Step "typecheck_gateway" "warn" "$errorCount TypeScript errors in gateway"
        $PhaseReport.issues += @{severity="warning"; msg="$errorCount TS errors in gateway-api"}
    }
} catch {
    Add-Step "typecheck_gateway" "skip" "Could not run tsc"
}
Pop-Location

# ── Finalize ────────────────────────────────────────────────────
$passed  = ($PhaseReport.steps | Where-Object { $_.status -in "pass","fixed" }).Count
$total   = $PhaseReport.steps.Count
$PhaseReport.completedAt = (Get-Date -Format o)
$PhaseReport.status      = "completed"
$PhaseReport.summary     = "$passed / $total checks passed"
$PhaseReport.passRate    = if ($total -gt 0) { [math]::Round(($passed/$total)*100) } else { 0 }

# Save
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportPath = Join-Path $ReportDir "phase1-foundation.json"
$PhaseReport | ConvertTo-Json -Depth 10 | Set-Content $reportPath -Encoding UTF8

Write-PhaseLog "Foundation check complete. $passed/$total passed ($($PhaseReport.passRate)%)"
Write-PhaseLog "Issues: $($PhaseReport.issues.Count) | Report: $reportPath"

return $PhaseReport
