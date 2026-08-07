#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 0: Comprehensive System Audit
.DESCRIPTION
    Audits infrastructure, codebase, database/KB, API endpoints, dependencies,
    and generates a structured JSON report for the orchestrator.
#>

param(
    [string]$ReportDir = "$PSScriptRoot\..\..\reconstruction-reports",
    [switch]$Quiet
)

$ErrorActionPreference = "Continue"
$Root = Resolve-Path "$PSScriptRoot\..\.."
$PhaseReport = @{
    phase       = 0
    name        = "Comprehensive Audit"
    startedAt   = (Get-Date -Format o)
    status      = "running"
    sections    = @{}
    issues      = @()
    score       = 0
    maxScore    = 0
}

function Write-PhaseLog($msg) { if (-not $Quiet) { Write-Host "  [Phase0] $msg" -ForegroundColor Cyan } }

# ── 1. Infrastructure ──────────────────────────────────────────
Write-PhaseLog "Auditing infrastructure..."
$infra = @{}
$infra["os"]       = [System.Runtime.InteropServices.RuntimeInformation]::OSDescription
$infra["arch"]     = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
$infra["hostname"] = $env:COMPUTERNAME
$infra["cpuCores"] = (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors
$infra["ramGB"]    = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)

# Software versions
$sw = @{}
try { $sw["node"]    = (node --version 2>$null) -replace '^v','' } catch { $sw["node"] = $null }
try { $sw["pnpm"]    = (pnpm --version 2>$null) }                  catch { $sw["pnpm"] = $null }
try { $sw["python"]  = (python --version 2>$null) -replace 'Python ','' } catch { $sw["python"] = $null }
try { $sw["git"]     = (git --version 2>$null) -replace 'git version ','' } catch { $sw["git"] = $null }
try { $sw["docker"]  = (docker --version 2>$null) -replace 'Docker version ','' -replace ',.*','' } catch { $sw["docker"] = $null }
try { $sw["tsc"]     = (npx tsc --version 2>$null) -replace 'Version ','' } catch { $sw["tsc"] = $null }
$infra["software"] = $sw

$PhaseReport.sections["infrastructure"] = $infra
$PhaseReport.maxScore += 6
$infraScore = 0
if ($sw.node)    { $infraScore++ } else { $PhaseReport.issues += @{severity="critical"; msg="Node.js not installed"} }
if ($sw.pnpm)    { $infraScore++ } else { $PhaseReport.issues += @{severity="critical"; msg="pnpm not installed"} }
if ($sw.python)  { $infraScore++ } else { $PhaseReport.issues += @{severity="warning";  msg="Python not installed"} }
if ($sw.git)     { $infraScore++ } else { $PhaseReport.issues += @{severity="warning";  msg="Git not installed"} }
if ($sw.docker)  { $infraScore++ } else { $PhaseReport.issues += @{severity="info";     msg="Docker not installed (optional for dev)"} }
if ($sw.tsc)     { $infraScore++ } else { $PhaseReport.issues += @{severity="warning";  msg="TypeScript compiler not found"} }
$PhaseReport.score += $infraScore

# ── 2. Codebase ─────────────────────────────────────────────────
Write-PhaseLog "Auditing codebase..."
$codebase = @{}

# File counts
$allFiles = Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch 'node_modules|\.git|dist|\.venv|__pycache__' }
$codebase["totalFiles"] = $allFiles.Count
$codebase["typescript"] = ($allFiles | Where-Object Extension -eq '.ts').Count
$codebase["tsx"]        = ($allFiles | Where-Object Extension -eq '.tsx').Count
$codebase["javascript"] = ($allFiles | Where-Object Extension -eq '.js').Count
$codebase["css"]        = ($allFiles | Where-Object Extension -eq '.css').Count
$codebase["python"]     = ($allFiles | Where-Object Extension -eq '.py').Count
$codebase["json"]       = ($allFiles | Where-Object Extension -eq '.json').Count
$codebase["markdown"]   = ($allFiles | Where-Object Extension -eq '.md').Count

# Lines of code (TS/TSX only for speed)
$tsFiles = $allFiles | Where-Object { $_.Extension -in '.ts','.tsx' }
$loc = 0
foreach ($f in $tsFiles) { $loc += (Get-Content $f.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines }
$codebase["linesOfCode_TS"] = $loc

# Apps check
$apps = @()
foreach ($app in @("web-user","gateway-api","api-backend","web-admin","web-public","whatsapp-bot","desktop-admin")) {
    $appPath = Join-Path $Root "apps\$app"
    $exists  = Test-Path $appPath
    $hasPkg  = Test-Path (Join-Path $appPath "package.json")
    $hasSrc  = Test-Path (Join-Path $appPath "src")
    $apps += @{ name=$app; exists=$exists; hasPackageJson=$hasPkg; hasSrc=$hasSrc }
}
$codebase["apps"] = $apps

# Packages check
$packages = @()
foreach ($pkg in @("config","db","i18n","kb","shared","types","ui")) {
    $pkgPath = Join-Path $Root "packages\$pkg"
    $packages += @{ name=$pkg; exists=(Test-Path $pkgPath) }
}
$codebase["packages"] = $packages

# Git status
$gitInfo = @{}
Push-Location $Root
try {
    $gitInfo["isRepo"]     = Test-Path ".git"
    $gitInfo["branch"]     = git branch --show-current 2>$null
    $gitInfo["lastCommit"] = git log -1 --format="%h - %s (%ar)" 2>$null
    $gitInfo["totalCommits"] = [int](git rev-list --count HEAD 2>$null)
    $gitInfo["dirtyFiles"] = [int](git status --porcelain 2>$null | Measure-Object -Line).Lines
} catch { $gitInfo["isRepo"] = $false }
Pop-Location
$codebase["git"] = $gitInfo

$PhaseReport.sections["codebase"] = $codebase
$PhaseReport.maxScore += 7
$codeScore = 0
if ($codebase.totalFiles -gt 50) { $codeScore++ }
$essentialApps = @("web-user","gateway-api","api-backend")
$pythonApps = @("api-backend","whatsapp-bot")  # Python apps don't need src/ or package.json
foreach ($a in $apps) {
    if ($a.name -in $essentialApps -and $a.exists) {
        if ($a.name -in $pythonApps) {
            # Python apps: just check existence (no src/ or package.json expected)
            $codeScore += 2
        } elseif ($a.hasSrc) {
            $codeScore += 2
        }
    }
}
$PhaseReport.score += $codeScore

# ── 3. Database & KB ────────────────────────────────────────────
Write-PhaseLog "Auditing database & knowledge base..."
$dbkb = @{}

# SQLite KB files
$kbPaths = @(
    "$Root\watany_kb_tables_v4\Watany_KB_v4.sqlite",
    "$Root\apps\gateway-api\data\kb.sqlite",
    "$Root\kb\Watany_KB_v4.sqlite"
)
$kbFound = $false
foreach ($kp in $kbPaths) {
    if (Test-Path $kp) {
        $kbFound = $true
        $fi = Get-Item $kp
        $dbkb["sqliteKB"] = @{ path=$kp; sizeMB=[math]::Round($fi.Length/1MB,2); lastModified=$fi.LastWriteTime.ToString("o") }
        break
    }
}
if (-not $kbFound) { $dbkb["sqliteKB"] = @{ status="NOT FOUND" } }

# RAG chunks
$ragPaths = @(
    "$Root\watany_kb_tables_v4\watany_rag_chunks_v4.jsonl",
    "$Root\apps\gateway-api\data\watany_rag_chunks_v4.jsonl"
)
$ragFound = $false
foreach ($rp in $ragPaths) {
    if (Test-Path $rp) {
        $ragFound = $true
        $fi = Get-Item $rp
        $lineCount = (Get-Content $rp -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
        $dbkb["ragChunks"] = @{ path=$rp; sizeMB=[math]::Round($fi.Length/1MB,2); chunkCount=$lineCount }
        break
    }
}
if (-not $ragFound) { $dbkb["ragChunks"] = @{ status="NOT FOUND" } }

# Docker-compose postgres check
$dbkb["dockerCompose"] = Test-Path "$Root\docker-compose.yml"

# Check for migration files
$migrations = Get-ChildItem "$Root\apps\*\migrations" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
$dbkb["migrationFiles"] = $migrations

$PhaseReport.sections["database_kb"] = $dbkb
$PhaseReport.maxScore += 3
$dbScore = 0
if ($kbFound) { $dbScore++ } else { $PhaseReport.issues += @{severity="critical"; msg="SQLite KB not found"} }
if ($ragFound) { $dbScore++ } else { $PhaseReport.issues += @{severity="warning"; msg="RAG chunks not found"} }
if ($dbkb.dockerCompose) { $dbScore++ }
$PhaseReport.score += $dbScore

# ── 4. API Endpoints Audit ──────────────────────────────────────
Write-PhaseLog "Auditing API endpoints (code-level)..."
$apiAudit = @{}

$serverFile = "$Root\apps\gateway-api\src\server.ts"
if (Test-Path $serverFile) {
    $serverContent = Get-Content $serverFile -Raw
    # Count route registrations
    $getRoutes   = ([regex]::Matches($serverContent, 'app\.(get|GET)\s*\(')).Count
    $postRoutes  = ([regex]::Matches($serverContent, 'app\.(post|POST)\s*\(')).Count
    $putRoutes   = ([regex]::Matches($serverContent, 'app\.(put|PUT)\s*\(')).Count
    $deleteRoutes = ([regex]::Matches($serverContent, 'app\.(delete|DELETE)\s*\(')).Count
    $totalRoutes = $getRoutes + $postRoutes + $putRoutes + $deleteRoutes
    $apiAudit["routes"] = @{ GET=$getRoutes; POST=$postRoutes; PUT=$putRoutes; DELETE=$deleteRoutes; total=$totalRoutes }
    $apiAudit["serverLines"] = (Get-Content $serverFile | Measure-Object -Line).Lines

    # Route files
    $routeFiles = Get-ChildItem "$Root\apps\gateway-api\src\routes" -Filter "*.ts" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
    $apiAudit["routeModules"] = $routeFiles
}

# Middleware
$middlewareFiles = @("auth-middleware.ts","auth-routes.ts","rbac.ts","content-filter.ts","moderation.ts")
$existingMW = @()
foreach ($mw in $middlewareFiles) {
    $found = Get-ChildItem "$Root\apps\gateway-api\src" -Recurse -Filter $mw -ErrorAction SilentlyContinue
    if ($found) { $existingMW += $mw }
}
$apiAudit["middleware"] = $existingMW

$PhaseReport.sections["api"] = $apiAudit
$PhaseReport.maxScore += 4
$apiScore = 0
if ($totalRoutes -gt 10) { $apiScore += 2 }
if ($existingMW.Count -ge 3) { $apiScore++ }
if ($routeFiles -and $routeFiles.Count -ge 3) { $apiScore++ }
$PhaseReport.score += $apiScore

# ── 5. Dependencies ─────────────────────────────────────────────
Write-PhaseLog "Auditing dependencies..."
$deps = @{}

# Node packages
$rootPkg = Get-Content "$Root\package.json" -Raw | ConvertFrom-Json
$deps["rootDeps"]    = ($rootPkg.dependencies.PSObject.Properties | Measure-Object).Count
$deps["rootDevDeps"] = ($rootPkg.devDependencies.PSObject.Properties | Measure-Object).Count

# Gateway deps
$gwPkg = Get-Content "$Root\apps\gateway-api\package.json" -Raw | ConvertFrom-Json
$deps["gatewayDeps"]    = ($gwPkg.dependencies.PSObject.Properties | Measure-Object).Count
$deps["gatewayDevDeps"] = ($gwPkg.devDependencies.PSObject.Properties | Measure-Object).Count

# Web-user deps
$wuPkg = Get-Content "$Root\apps\web-user\package.json" -Raw | ConvertFrom-Json
$deps["webUserDeps"]    = ($wuPkg.dependencies.PSObject.Properties | Measure-Object).Count
$deps["webUserDevDeps"] = ($wuPkg.devDependencies.PSObject.Properties | Measure-Object).Count

# Python deps
$pyReqs = "$Root\apps\api-backend\requirements.txt"
if (Test-Path $pyReqs) {
    $deps["pythonDeps"] = (Get-Content $pyReqs | Where-Object { $_ -match '\S' -and $_ -notmatch '^\s*#' } | Measure-Object).Count
}

# node_modules existence
$deps["nodeModulesRoot"]    = Test-Path "$Root\node_modules"
$deps["nodeModulesGateway"] = Test-Path "$Root\apps\gateway-api\node_modules"
$deps["nodeModulesWebUser"] = Test-Path "$Root\apps\web-user\node_modules"

$PhaseReport.sections["dependencies"] = $deps
$PhaseReport.maxScore += 3
$depScore = 0
if ($deps.nodeModulesRoot)    { $depScore++ } else { $PhaseReport.issues += @{severity="warning"; msg="Root node_modules missing — run pnpm install"} }
if ($deps.nodeModulesGateway) { $depScore++ } else { $PhaseReport.issues += @{severity="critical"; msg="Gateway node_modules missing"} }
if ($deps.nodeModulesWebUser) { $depScore++ } else { $PhaseReport.issues += @{severity="critical"; msg="Web-user node_modules missing"} }
$PhaseReport.score += $depScore

# ── 6. Frontend Components ──────────────────────────────────────
Write-PhaseLog "Auditing frontend components..."
$frontend = @{}

$compDir = "$Root\apps\web-user\src\components"
$pageDir = "$Root\apps\web-user\src\pages"

if (Test-Path $compDir) {
    $components = Get-ChildItem $compDir -Filter "*.tsx" -Recurse | Select-Object -ExpandProperty BaseName
    $frontend["componentCount"] = $components.Count
    $frontend["components"] = $components
}
if (Test-Path $pageDir) {
    $pages = Get-ChildItem $pageDir -Filter "*.tsx" | Select-Object -ExpandProperty BaseName
    $frontend["pageCount"] = $pages.Count
    $frontend["pages"] = $pages
}

# Check critical files
$criticalUI = @("App.tsx","main.tsx","styles.css")
$frontend["criticalFiles"] = @{}
foreach ($cf in $criticalUI) {
    $frontend.criticalFiles[$cf] = Test-Path "$Root\apps\web-user\src\$cf"
}

$PhaseReport.sections["frontend"] = $frontend
$PhaseReport.maxScore += 3
$feScore = 0
if ($frontend.componentCount -gt 10) { $feScore++ }
if ($frontend.pageCount -gt 5)       { $feScore++ }
$allCrit = $true; foreach ($v in $frontend.criticalFiles.Values) { if (-not $v) { $allCrit = $false } }
if ($allCrit) { $feScore++ }
$PhaseReport.score += $feScore

# ── 7. Testing Infrastructure ───────────────────────────────────
Write-PhaseLog "Auditing test infrastructure..."
$testing = @{}

$testing["hasVitest"]      = Test-Path "$Root\node_modules\vitest" -ErrorAction SilentlyContinue
$testing["hasPlaywright"]  = Test-Path "$Root\node_modules\playwright" -ErrorAction SilentlyContinue
$testing["hasSupertest"]   = Test-Path "$Root\node_modules\supertest" -ErrorAction SilentlyContinue
$testing["playwrightConfig"] = Test-Path "$Root\playwright.config.ts"

# test files
$testFiles = Get-ChildItem $Root -Recurse -Include "*.test.ts","*.test.tsx","*.spec.ts","*.spec.tsx" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch 'node_modules' }
$testing["testFileCount"] = $testFiles.Count
$testing["testFiles"]     = $testFiles | ForEach-Object { $_.FullName.Replace($Root.Path + '\','') }

$PhaseReport.sections["testing"] = $testing
$PhaseReport.maxScore += 3
$testScore = 0
if ($testing.hasVitest)        { $testScore++ }
if ($testing.hasPlaywright)    { $testScore++ }
if ($testing.testFileCount -gt 0) { $testScore++ }
$PhaseReport.score += $testScore

# ── 8. Deployment Readiness ─────────────────────────────────────
Write-PhaseLog "Auditing deployment readiness..."
$deployment = @{}

$deployment["hasDockerfile"]       = Test-Path "$Root\Dockerfile"
$deployment["hasDockerfilePython"] = Test-Path "$Root\Dockerfile.python"
$deployment["hasDockerCompose"]    = Test-Path "$Root\docker-compose.yml"
$deployment["hasNginxConf"]        = Test-Path "$Root\monitoring\nginx.conf"
$deployment["hasPM2Config"]        = Test-Path "$Root\apps\gateway-api\ecosystem.config.cjs"
$deployment["hasEnvExample"]       = Test-Path "$Root\apps\gateway-api\.env.example"
$deployment["hasPrometheus"]       = Test-Path "$Root\monitoring\prometheus.yml"

$PhaseReport.sections["deployment"] = $deployment
$PhaseReport.maxScore += 4
$deplScore = 0
if ($deployment.hasDockerCompose) { $deplScore++ }
if ($deployment.hasNginxConf)     { $deplScore++ }
if ($deployment.hasPM2Config)     { $deplScore++ }
if ($deployment.hasEnvExample)    { $deplScore++ }
$PhaseReport.score += $deplScore

# ── Finalize ────────────────────────────────────────────────────
$PhaseReport.completedAt = (Get-Date -Format o)
$PhaseReport.status      = "completed"
$pct = if ($PhaseReport.maxScore -gt 0) { [math]::Round(($PhaseReport.score / $PhaseReport.maxScore) * 100) } else { 0 }
$PhaseReport.scorePercent = $pct
$PhaseReport.recommendation = switch ($true) {
    ($pct -ge 80) { "System is in good shape. Proceed with incremental improvements." }
    ($pct -ge 50) { "System needs attention. Address critical issues before proceeding." }
    default       { "Significant rebuilding required. Focus on foundation first." }
}

# Save report
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportPath = Join-Path $ReportDir "phase0-audit.json"
$PhaseReport | ConvertTo-Json -Depth 10 | Set-Content -Path $reportPath -Encoding UTF8

Write-PhaseLog "Audit complete. Score: $($PhaseReport.score)/$($PhaseReport.maxScore) ($pct%)"
Write-PhaseLog "Report saved to: $reportPath"
Write-PhaseLog "Issues found: $($PhaseReport.issues.Count)"

# Return structured result for orchestrator
return $PhaseReport
