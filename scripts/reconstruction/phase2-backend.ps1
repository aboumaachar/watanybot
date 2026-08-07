#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 2: Backend Verification & Repair
.DESCRIPTION
    Validates all backend components: server, routes, auth, KB, AI, chat, admin, filters.
    Optionally starts the gateway to run live endpoint tests.
#>

param(
    [string]$ReportDir = "$PSScriptRoot\..\..\reconstruction-reports",
    [switch]$Quiet,
    [switch]$LiveTest  # Start the server and test endpoints
)

$ErrorActionPreference = "Continue"
$Root = Resolve-Path "$PSScriptRoot\..\.."
$GW   = "$Root\apps\gateway-api"

$PhaseReport = @{
    phase     = 2
    name      = "Backend Rebuild Verification"
    startedAt = (Get-Date -Format o)
    status    = "running"
    checks    = @()
    issues    = @()
}

function Write-PhaseLog($msg) { if (-not $Quiet) { Write-Host "  [Phase2] $msg" -ForegroundColor Green } }
function Add-Check($category, $name, $status, $detail) {
    $PhaseReport.checks += @{ category=$category; name=$name; status=$status; detail=$detail }
}

# ── 2.1 Core API Structure ──────────────────────────────────────
Write-PhaseLog "Checking core API structure..."

$serverFile = "$GW\src\server.ts"
if (Test-Path $serverFile) {
    $lines = (Get-Content $serverFile | Measure-Object -Line).Lines
    Add-Check "core" "server.ts" "pass" "$lines lines"

    $content = Get-Content $serverFile -Raw
    # Check for essential middleware
    $hasCors     = $content -match 'cors'
    $hasCompress = $content -match 'compress'
    $hasRateLimit = $content -match 'rateLimit|rate-limit'
    Add-Check "core" "cors-middleware" $(if($hasCors){"pass"}else{"fail"}) ""
    Add-Check "core" "compression" $(if($hasCompress){"pass"}else{"fail"}) ""
    Add-Check "core" "rate-limiting" $(if($hasRateLimit){"pass"}else{"fail"}) ""

    # Health endpoint
    $hasHealth = $content -match '/health'
    Add-Check "core" "health-endpoint" $(if($hasHealth){"pass"}else{"fail"}) ""
} else {
    Add-Check "core" "server.ts" "fail" "Server file not found"
    $PhaseReport.issues += @{severity="critical"; msg="server.ts not found"}
}

# ── 2.2 Authentication System ───────────────────────────────────
Write-PhaseLog "Checking authentication system..."

$authFiles = @{
    "auth-middleware" = "$GW\src\auth\auth-middleware.ts"
    "auth-routes"     = "$GW\src\auth\auth-routes.ts"
    "rbac"            = "$GW\src\auth\rbac.ts"
    "password"        = "$GW\src\auth\password.ts"
}

foreach ($kv in $authFiles.GetEnumerator()) {
    if (Test-Path $kv.Value) {
        $content = Get-Content $kv.Value -Raw
        $lineCount = (Get-Content $kv.Value | Measure-Object -Line).Lines
        Add-Check "auth" $kv.Key "pass" "$lineCount lines"

        # Check for specific patterns
        if ($kv.Key -eq "auth-routes") {
            $hasLogin    = $content -match 'login|/auth/login'
            $hasRegister = $content -match 'register|/auth/register'
            $hasLogout   = $content -match 'logout|/auth/logout'
            if (-not $hasLogin)    { $PhaseReport.issues += @{severity="warning"; msg="Login endpoint may be missing"} }
            if (-not $hasRegister) { $PhaseReport.issues += @{severity="info"; msg="Register endpoint not detected"} }
        }
        if ($kv.Key -eq "rbac") {
            $hasRoles = $content -match 'admin|moderator|superadmin|public|accredited'
            Add-Check "auth" "rbac-roles" $(if($hasRoles){"pass"}else{"warn"}) ""
        }
    } else {
        Add-Check "auth" $kv.Key "fail" "File not found"
        $PhaseReport.issues += @{severity="warning"; msg="Auth component missing: $($kv.Key)"}
    }
}

# ── 2.3 Knowledge Base ──────────────────────────────────────────
Write-PhaseLog "Checking knowledge base integration..."

$kbDir = "$GW\src\kb"
if (Test-Path $kbDir) {
    $kbFiles = Get-ChildItem $kbDir -Filter "*.ts" -Recurse
    Add-Check "kb" "kb-module" "pass" "$($kbFiles.Count) files"

    foreach ($kf in $kbFiles) {
        $content = Get-Content $kf.FullName -Raw
        $hasSearch = $content -match 'search|query|find'
        Add-Check "kb" $kf.BaseName $(if($hasSearch){"pass"}else{"info"}) ""
    }
} else {
    Add-Check "kb" "kb-module" "fail" "KB directory not found"
    $PhaseReport.issues += @{severity="critical"; msg="KB module directory missing"}
}

# Check @watany/kb package
$kbPackage = "$Root\packages\kb"
if ((Test-Path "$kbPackage\index.ts") -or (Test-Path "$kbPackage\src")) {
    Add-Check "kb" "watany-kb-package" "pass" ""
} else {
    Add-Check "kb" "watany-kb-package" "warn" "Package exists but may be incomplete"
}

# ── 2.4 AI Integration ──────────────────────────────────────────
Write-PhaseLog "Checking AI integration..."

$aiDir = "$GW\src\ai"
if (Test-Path $aiDir) {
    $aiFiles = Get-ChildItem $aiDir -Filter "*.ts"
    Add-Check "ai" "ai-module" "pass" "$($aiFiles.Count) files"

    # Check key AI files
    $aiFileNames = $aiFiles | ForEach-Object { $_.BaseName }
    $requiredAI = @("index","rag","openai-compat","types")
    foreach ($req in $requiredAI) {
        $found = $aiFileNames -contains $req
        Add-Check "ai" "ai-$req" $(if($found){"pass"}else{"warn"}) ""
    }

    # Check for multi-provider support
    $indexContent = Get-Content "$aiDir\index.ts" -Raw -ErrorAction SilentlyContinue
    if ($indexContent) {
        $hasOllama  = $indexContent -match 'ollama'
        $hasOpenAI  = $indexContent -match 'openai'
        $hasGroq    = $indexContent -match 'groq'
        Add-Check "ai" "provider-openai" $(if($hasOpenAI){"pass"}else{"warn"}) ""
        Add-Check "ai" "provider-ollama" $(if($hasOllama){"pass"}else{"info"}) ""
    }
} else {
    Add-Check "ai" "ai-module" "fail" "AI directory not found"
    $PhaseReport.issues += @{severity="critical"; msg="AI module missing"}
}

# ── 2.5 Route Modules ───────────────────────────────────────────
Write-PhaseLog "Checking route modules..."

$routeDir = "$GW\src\routes"
if (Test-Path $routeDir) {
    $routeFiles = Get-ChildItem $routeDir -Filter "*.ts" -Recurse
    Add-Check "routes" "route-modules" "pass" "$($routeFiles.Count) route files"

    $requiredRoutes = @("salary","admin-dashboard","admin-users","admin-rules","unified-search","elite","advanced")
    foreach ($rr in $requiredRoutes) {
        $found = $routeFiles | Where-Object { $_.BaseName -match $rr }
        Add-Check "routes" "route-$rr" $(if($found){"pass"}else{"warn"}) ""
    }
} else {
    Add-Check "routes" "route-modules" "fail" "Routes directory not found"
}

# ── 2.6 Content Filters ─────────────────────────────────────────
Write-PhaseLog "Checking content filters..."

$filterDir = "$GW\src\filters"
if (Test-Path $filterDir) {
    $filterFiles = Get-ChildItem $filterDir -Filter "*.ts"
    Add-Check "filters" "filter-module" "pass" "$($filterFiles.Count) files"

    foreach ($ff in $filterFiles) {
        $content = Get-Content $ff.FullName -Raw
        $hasExport = $content -match 'export'
        Add-Check "filters" $ff.BaseName $(if($hasExport){"pass"}else{"warn"}) ""
    }
} else {
    Add-Check "filters" "filter-module" "fail" "Filters directory not found"
    $PhaseReport.issues += @{severity="warning"; msg="Content filter module missing"}
}

# ── 2.7 WebSocket / Admin ───────────────────────────────────────
Write-PhaseLog "Checking WebSocket & admin features..."

$wsDir = "$GW\src\ws"
if (Test-Path $wsDir) {
    $wsFiles = Get-ChildItem $wsDir -Filter "*.ts"
    Add-Check "ws" "websocket-module" "pass" "$($wsFiles.Count) files"

    $adminWs = Get-Content "$wsDir\admin-ws.ts" -Raw -ErrorAction SilentlyContinue
    if ($adminWs -and $adminWs -match 'broadcast|intervene') {
        Add-Check "ws" "admin-interventions" "pass" ""
    } else {
        Add-Check "ws" "admin-interventions" "warn" "Admin WebSocket may be incomplete"
    }
} else {
    Add-Check "ws" "websocket-module" "fail" "WS directory not found"
}

# ── 2.8 Database Layer ──────────────────────────────────────────
Write-PhaseLog "Checking database layer..."

$dbDir = "$GW\src\db"
if (Test-Path $dbDir) {
    $dbFiles = Get-ChildItem $dbDir -File -Recurse
    Add-Check "db" "db-module" "pass" "$($dbFiles.Count) files"

    $hasMigrate = Test-Path "$dbDir\migrate.ts"
    $hasPersist = Test-Path "$dbDir\persistence.ts"
    $hasSeed    = Test-Path "$dbDir\seed.ts"
    Add-Check "db" "migrations" $(if($hasMigrate){"pass"}else{"warn"}) ""
    Add-Check "db" "persistence" $(if($hasPersist){"pass"}else{"warn"}) ""
    Add-Check "db" "seed-data" $(if($hasSeed){"pass"}else{"info"}) ""

    # Check for migration files
    $migDir = "$dbDir\migrations"
    if (Test-Path $migDir) {
        $migFiles = Get-ChildItem $migDir -File
        Add-Check "db" "migration-files" "pass" "$($migFiles.Count) migrations"
    }
} else {
    Add-Check "db" "db-module" "fail" "DB directory not found"
}

# ── 2.9 Python Backend ──────────────────────────────────────────
Write-PhaseLog "Checking Python backend..."

$pyBackend = "$Root\apps\api-backend"
if (Test-Path $pyBackend) {
    $pyApiDir = "$pyBackend\apps\api"
    if (Test-Path $pyApiDir) {
        $pyFiles = Get-ChildItem $pyApiDir -Filter "*.py" -Recurse -ErrorAction SilentlyContinue
        Add-Check "python" "api-backend" "pass" "$($pyFiles.Count) Python files"

        $hasMain = Test-Path "$pyApiDir\main.py"
        Add-Check "python" "main-entry" $(if($hasMain){"pass"}else{"fail"}) ""
    } else {
        Add-Check "python" "api-backend" "warn" "apps/api directory not found under api-backend"
    }

    $hasReqs = Test-Path "$pyBackend\requirements.txt"
    Add-Check "python" "requirements" $(if($hasReqs){"pass"}else{"warn"}) ""
} else {
    Add-Check "python" "api-backend" "fail" "api-backend app not found"
}

# ── 2.10 Live Endpoint Tests ────────────────────────────────────
if ($LiveTest) {
    Write-PhaseLog "Starting gateway for live tests..."

    Push-Location $GW
    $proc = Start-Process -FilePath "node" -ArgumentList "--env-file=.env","--import","tsx","src/server.ts" -PassThru -WindowStyle Hidden -RedirectStandardError "$ReportDir\gateway-stderr.log"
    Start-Sleep -Seconds 5

    $endpoints = @(
        @{method="GET"; path="/health"; expect=200},
        @{method="GET"; path="/api/debug/stats"; expect=200},
        @{method="GET"; path="/api/salary/grades"; expect=200},
        @{method="GET"; path="/api/kb/stats"; expect=200}
    )

    foreach ($ep in $endpoints) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:4000$($ep.path)" -Method $ep.method -TimeoutSec 5 -ErrorAction Stop
            $ok = $resp.StatusCode -eq $ep.expect
            Add-Check "live" "$($ep.method) $($ep.path)" $(if($ok){"pass"}else{"warn"}) "HTTP $($resp.StatusCode)"
        } catch {
            Add-Check "live" "$($ep.method) $($ep.path)" "fail" $_.Exception.Message
        }
    }

    # Stop server
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Pop-Location
}

# ── Finalize ────────────────────────────────────────────────────
$passed = ($PhaseReport.checks | Where-Object { $_.status -eq "pass" }).Count
$total  = $PhaseReport.checks.Count
$PhaseReport.completedAt = (Get-Date -Format o)
$PhaseReport.status      = "completed"
$PhaseReport.summary     = "$passed / $total checks passed"
$PhaseReport.passRate    = if ($total -gt 0) { [math]::Round(($passed/$total)*100) } else { 0 }

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportPath = Join-Path $ReportDir "phase2-backend.json"
$PhaseReport | ConvertTo-Json -Depth 10 | Set-Content $reportPath -Encoding UTF8

Write-PhaseLog "Backend verification complete. $passed/$total passed ($($PhaseReport.passRate)%)"

return $PhaseReport
