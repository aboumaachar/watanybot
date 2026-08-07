#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 4: Integration — Verify backend-frontend connection, auth flow, API wiring
.DESCRIPTION
    Starts gateway + web-user dev servers, runs integration smoke-tests against live endpoints.
#>

param(
    [string]$ReportDir = "$PSScriptRoot\..\..\reconstruction-reports",
    [switch]$Quiet,
    [switch]$SkipLive  # Skip live server tests (code analysis only)
)

$ErrorActionPreference = "Continue"
$Root = Resolve-Path "$PSScriptRoot\..\.."

$PhaseReport = @{
    phase     = 4
    name      = "Integration Verification"
    startedAt = (Get-Date -Format o)
    status    = "running"
    checks    = @()
    issues    = @()
}

function Write-PhaseLog($msg) { if (-not $Quiet) { Write-Host "  [Phase4] $msg" -ForegroundColor Blue } }
function Add-Check($category, $name, $status, $detail) {
    $PhaseReport.checks += @{ category=$category; name=$name; status=$status; detail=$detail }
}

# ── 4.1 API Client → Gateway Alignment ──────────────────────────
Write-PhaseLog "Checking API client ↔ gateway alignment..."

$apiClient = "$Root\apps\web-user\src\lib\api.ts"
$serverFile = "$Root\apps\gateway-api\src\server.ts"

if ((Test-Path $apiClient) -and (Test-Path $serverFile)) {
    $apiContent    = Get-Content $apiClient -Raw
    $serverContent = Get-Content $serverFile -Raw

    # Extract URLs from api.ts — match template literals like `${baseUrl}/api/...` and plain strings
    $apiPaths = [regex]::Matches($apiContent, '/api/[a-z0-9/_-]+') | ForEach-Object {
        $_.Value.TrimEnd('/').ToLower()
    }
    $apiPathsUniq = $apiPaths | Sort-Object -Unique

    # Extract registered routes from server.ts — capture all /api/ patterns
    $serverPaths = [regex]::Matches($serverContent, '/api/[a-z0-9/_-]+') | ForEach-Object {
        $_.Value.TrimEnd('/').ToLower()
    }
    $serverPathsUniq = $serverPaths | Sort-Object -Unique

    $matched   = @()
    $unmatched = @()
    foreach ($ap in $apiPathsUniq) {
        # Match if server has exact path or a prefix (e.g. /api/cases matches /api/cases/:id)
        $found = $serverPathsUniq | Where-Object { $_ -eq $ap -or $_ -like "$ap/*" -or $ap -like "$_/*" }
        if ($found) {
            $matched += $ap
        } else {
            $unmatched += $ap
        }
    }

    Add-Check "alignment" "api-paths-total" "pass" "$($apiPathsUniq.Count) unique API paths in frontend"
    Add-Check "alignment" "server-paths-total" "pass" "$($serverPathsUniq.Count) unique API paths in gateway"
    Add-Check "alignment" "matched-paths" $(if($matched.Count -ge $apiPathsUniq.Count * 0.7){"pass"}else{"warn"}) "$($matched.Count) of $($apiPathsUniq.Count) matched"
    if ($unmatched.Count -gt 0 -and $unmatched.Count -gt $apiPathsUniq.Count * 0.3) {
        Add-Check "alignment" "unmatched-paths" "warn" "$($unmatched.Count) frontend paths not found in gateway"
        $PhaseReport.issues += @{severity="warning"; msg="$($unmatched.Count) API paths in frontend have no gateway route"}
    } elseif ($unmatched.Count -gt 0) {
        Add-Check "alignment" "unmatched-paths" "info" "$($unmatched.Count) frontend paths not in gateway (within tolerance)"
    }
} else {
    Add-Check "alignment" "files-missing" "fail" "api.ts or server.ts not found"
}

# ── 4.2 Environment Configuration ───────────────────────────────
Write-PhaseLog "Checking environment configuration..."

# Web-user .env
$webEnvDev  = "$Root\apps\web-user\.env.development"
$webEnvProd = "$Root\apps\web-user\.env.production"

if (Test-Path $webEnvDev) {
    $envContent = Get-Content $webEnvDev -Raw
    $hasAPIUrl = $envContent -match 'VITE_API_BASE_URL|VITE_GATEWAY_URL|VITE_API_URL'
    Add-Check "env" "web-env-dev" $(if($hasAPIUrl){"pass"}else{"warn"}) ""
} else {
    Add-Check "env" "web-env-dev" "warn" ".env.development not found"
}

if (Test-Path $webEnvProd) {
    Add-Check "env" "web-env-prod" "pass" ""
} else {
    Add-Check "env" "web-env-prod" "warn" ".env.production not found"
}

# Gateway .env
$gwEnv = "$Root\apps\gateway-api\.env"
if (Test-Path $gwEnv) {
    $gwContent = Get-Content $gwEnv -Raw
    $hasPort      = $gwContent -match 'PORT'
    $hasPythonUrl = $gwContent -match 'PYTHON_API_URL'
    Add-Check "env" "gateway-env" "pass" ""
    Add-Check "env" "gateway-port" $(if($hasPort){"pass"}else{"warn"}) ""
    Add-Check "env" "gateway-python-url" $(if($hasPythonUrl){"pass"}else{"warn"}) ""
} else {
    Add-Check "env" "gateway-env" "fail" ".env not found"
    $PhaseReport.issues += @{severity="critical"; msg="Gateway .env missing"}
}

# ── 4.3 CORS Configuration ──────────────────────────────────────
Write-PhaseLog "Checking CORS configuration..."

if (Test-Path $serverFile) {
    $corsBlock = $serverContent -match 'cors\s*\(' -or $serverContent -match 'register\s*\(\s*cors'
    Add-Check "cors" "cors-registered" $(if($corsBlock){"pass"}else{"fail"}) ""

    $hasOrigin = $serverContent -match 'origin.*5174|origin.*localhost|origin:\s*true'
    Add-Check "cors" "dev-origins" $(if($hasOrigin){"pass"}else{"warn"}) ""
}

# ── 4.4 Shared Types Consistency ────────────────────────────────
Write-PhaseLog "Checking shared types..."

$sharedTypes = "$Root\packages\types"
if (Test-Path $sharedTypes) {
    $typeFiles = Get-ChildItem $sharedTypes -Filter "*.ts" -Recurse
    Add-Check "types" "shared-types" "pass" "$($typeFiles.Count) shared type files"

    # Check if both gateway and web-user import from @watany/types
    $gwPkg = Get-Content "$Root\apps\gateway-api\package.json" -Raw
    $wuPkg = Get-Content "$Root\apps\web-user\package.json" -Raw
    $gwUsesTypes = $gwPkg -match '@watany/types'
    $wuUsesTypes = $wuPkg -match '@watany/types'
    Add-Check "types" "gateway-uses-types" $(if($gwUsesTypes){"pass"}else{"warn"}) ""
    Add-Check "types" "web-uses-types" $(if($wuUsesTypes){"pass"}else{"warn"}) ""
} else {
    Add-Check "types" "shared-types" "warn" "Shared types package not found"
}

# ── 4.5 Auth Flow Integration ───────────────────────────────────
Write-PhaseLog "Checking auth flow integration..."

if (Test-Path $apiClient) {
    $apiContent = Get-Content $apiClient -Raw
    $hasLogin    = $apiContent -match 'login|/auth/login'
    $hasRegister = $apiContent -match 'register|/auth/register'
    $hasToken    = $apiContent -match 'token|Authorization|Bearer'
    $hasLogout   = $apiContent -match 'logout|/auth/logout'

    Add-Check "auth-flow" "login-api" $(if($hasLogin){"pass"}else{"warn"}) ""
    Add-Check "auth-flow" "register-api" $(if($hasRegister){"pass"}else{"info"}) ""
    Add-Check "auth-flow" "token-handling" $(if($hasToken){"pass"}else{"warn"}) ""
    Add-Check "auth-flow" "logout-api" $(if($hasLogout){"pass"}else{"info"}) ""
}

# Check for protected routes in frontend
$appTsxPath = "$Root\apps\web-user\src\App.tsx"
$appContent2 = if (Test-Path $appTsxPath) { Get-Content $appTsxPath -Raw -ErrorAction SilentlyContinue } else { $null }
if ($appContent2) {
    $hasProtected = $appContent2 -match 'ProtectedRoute|RequireAuth|isAuthenticated|authGuard'
    Add-Check "auth-flow" "protected-routes" $(if($hasProtected){"pass"}else{"info"}) ""
}

# ── 4.6 WebSocket Integration ───────────────────────────────────
Write-PhaseLog "Checking WebSocket integration..."

$wsAdminFile = "$Root\apps\gateway-api\src\ws\admin-ws.ts"
if (Test-Path $wsAdminFile) {
    $wsContent = Get-Content $wsAdminFile -Raw
    $hasUpgrade = $wsContent -match 'websocket|WebSocket|upgrade'
    Add-Check "websocket" "admin-ws" $(if($hasUpgrade){"pass"}else{"warn"}) ""
}

# Check if frontend has WS client
if (Test-Path $apiClient) {
    $hasWS = $apiContent -match 'WebSocket|ws://|wss://'
    Add-Check "websocket" "frontend-ws" $(if($hasWS){"pass"}else{"info"}) "Frontend WebSocket client"
}

# ── 4.7 Live Integration Tests ──────────────────────────────────
if (-not $SkipLive) {
    Write-PhaseLog "Starting live integration tests..."

    # Start gateway
    $gwProc = Start-Process -FilePath "node" -ArgumentList "--env-file=.env","--import","tsx","src/server.ts" `
        -WorkingDirectory "$Root\apps\gateway-api" -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 5

    $liveTests = @(
        @{name="health"; method="GET"; path="/health"; expectCode=200},
        @{name="salary-grades"; method="GET"; path="/api/salary/grades"; expectCode=200},
        @{name="kb-stats"; method="GET"; path="/api/kb/stats"; expectCode=200},
        @{name="chat-post"; method="POST"; path="/api/chat"; body=@{message="مرحبا"}; expectCode=200}
    )

    foreach ($test in $liveTests) {
        try {
            $params = @{
                Uri = "http://localhost:4000$($test.path)"
                Method = $test.method
                TimeoutSec = 10
                ContentType = "application/json"
            }
            if ($test.body) {
                $params["Body"] = ($test.body | ConvertTo-Json -Compress)
            }
            $resp = Invoke-WebRequest @params -ErrorAction Stop
            $ok = $resp.StatusCode -eq $test.expectCode
            Add-Check "live" $test.name $(if($ok){"pass"}else{"warn"}) "HTTP $($resp.StatusCode)"
        } catch {
            Add-Check "live" $test.name "fail" $_.Exception.Message
        }
    }

    Stop-Process -Id $gwProc.Id -Force -ErrorAction SilentlyContinue
} else {
    Add-Check "live" "skipped" "skip" "Live tests skipped (use -SkipLive:$false)"
}

# ── Finalize ────────────────────────────────────────────────────
# passRate: count pass/(pass+fail+warn) — info and skip are neutral
$passed  = ($PhaseReport.checks | Where-Object { $_.status -eq "pass" }).Count
$graded  = ($PhaseReport.checks | Where-Object { $_.status -in 'pass','fail','warn' }).Count
$total   = $PhaseReport.checks.Count
$PhaseReport.completedAt = (Get-Date -Format o)
$PhaseReport.status      = "completed"
$PhaseReport.summary     = "$passed / $total checks passed"
$PhaseReport.passRate    = if ($graded -gt 0) { [math]::Round(($passed/$graded)*100) } else { 100 }

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportPath = Join-Path $ReportDir "phase4-integration.json"
$PhaseReport | ConvertTo-Json -Depth 10 | Set-Content $reportPath -Encoding UTF8

Write-PhaseLog "Integration verification complete. $passed/$total passed ($($PhaseReport.passRate)%)"

return $PhaseReport
