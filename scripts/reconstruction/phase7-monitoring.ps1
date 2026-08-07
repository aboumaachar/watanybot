#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 7: Monitoring & Post-Launch Validation
.DESCRIPTION
    Validates monitoring infrastructure, logging, alerting, health checks,
    and runtime observability.
#>

param(
    [string]$ReportDir = "$PSScriptRoot\..\..\reconstruction-reports",
    [switch]$Quiet,
    [switch]$LiveCheck  # Check live monitoring endpoints
)

$ErrorActionPreference = "Continue"
$Root = Resolve-Path "$PSScriptRoot\..\.."

$PhaseReport = @{
    phase     = 7
    name      = "Monitoring & Post-Launch"
    startedAt = (Get-Date -Format o)
    status    = "running"
    checks    = @()
    issues    = @()
}

function Write-PhaseLog($msg) { if (-not $Quiet) { Write-Host "  [Phase7] $msg" -ForegroundColor DarkGreen } }
function Add-Check($category, $name, $status, $detail) {
    $PhaseReport.checks += @{ category=$category; name=$name; status=$status; detail=$detail }
}

# ── 7.1 Health Endpoints ────────────────────────────────────────
Write-PhaseLog "Checking health endpoint definitions..."

$serverFile = "$Root\apps\gateway-api\src\server.ts"
if (Test-Path $serverFile) {
    $content = Get-Content $serverFile -Raw
    $hasHealth      = $content -match '/health'
    $hasReadiness   = $content -match '/ready|/readiness'
    $hasLiveness    = $content -match '/live|/liveness'
    $hasDebugStats  = $content -match '/debug/stats|/api/debug'

    Add-Check "health" "health-endpoint" $(if($hasHealth){"pass"}else{"fail"}) ""
    Add-Check "health" "readiness-probe" $(if($hasReadiness){"pass"}else{"info"}) "Optional for K8s"
    Add-Check "health" "debug-stats" $(if($hasDebugStats){"pass"}else{"info"}) ""
}

# ── 7.2 Logging Infrastructure ──────────────────────────────────
Write-PhaseLog "Checking logging infrastructure..."

# Gateway logging
$hasLogDir = Test-Path "$Root\apps\gateway-api\logs"
Add-Check "logging" "log-directory" $(if($hasLogDir){"pass"}else{"info"}) ""

# Check for structured logging in server
if (Test-Path $serverFile) {
    $content = Get-Content $serverFile -Raw
    $hasFastifyLog  = $content -match 'logger:\s*true|logger:\s*\{' 
    $hasLogLevel    = $content -match 'LOG_LEVEL|log.level'
    Add-Check "logging" "fastify-logger" $(if($hasFastifyLog){"pass"}else{"warn"}) ""
    Add-Check "logging" "log-level-config" $(if($hasLogLevel){"pass"}else{"info"}) ""
}

# PM2 log configuration
$pm2Config = "$Root\apps\gateway-api\ecosystem.config.cjs"
if (Test-Path $pm2Config) {
    $pm2Content = Get-Content $pm2Config -Raw
    $hasLogDate = $pm2Content -match 'log_date_format'
    $hasMerge   = $pm2Content -match 'merge_logs'
    Add-Check "logging" "pm2-log-format" $(if($hasLogDate){"pass"}else{"info"}) ""
    Add-Check "logging" "pm2-merge-logs" $(if($hasMerge){"pass"}else{"info"}) ""
}

# ── 7.3 Prometheus Metrics ──────────────────────────────────────
Write-PhaseLog "Checking Prometheus metrics..."

$promFile = "$Root\monitoring\prometheus.yml"
if (Test-Path $promFile) {
    $promContent = Get-Content $promFile -Raw
    Add-Check "metrics" "prometheus-config" "pass" ""

    # Check scrape targets
    $targets = [regex]::Matches($promContent, 'targets:\s*\[([^\]]+)\]')
    $targetCount = $targets.Count
    Add-Check "metrics" "scrape-targets" $(if($targetCount -gt 0){"pass"}else{"warn"}) "$targetCount target groups"

    # Check for gateway metrics
    $hasGateway = $promContent -match 'gateway|4000'
    Add-Check "metrics" "gateway-metrics" $(if($hasGateway){"pass"}else{"warn"}) ""
} else {
    Add-Check "metrics" "prometheus-config" "warn" "Prometheus config not found"
}

# Check if gateway exposes metrics endpoint
if (Test-Path $serverFile) {
    $content = Get-Content $serverFile -Raw
    $hasMetricsEndpoint = $content -match '/metrics|prometheus|prom-client'
    Add-Check "metrics" "metrics-endpoint" $(if($hasMetricsEndpoint){"pass"}else{"info"}) ""
}

# ── 7.4 Grafana Dashboards ──────────────────────────────────────
Write-PhaseLog "Checking Grafana dashboards..."

$grafanaDir = "$Root\monitoring\grafana"
if (Test-Path $grafanaDir) {
    $dashboards = Get-ChildItem "$grafanaDir\dashboards" -Filter "*.json" -Recurse -ErrorAction SilentlyContinue
    $datasources = Get-ChildItem "$grafanaDir\datasources" -Recurse -ErrorAction SilentlyContinue
    Add-Check "grafana" "dashboards" $(if($dashboards.Count -gt 0){"pass"}else{"warn"}) "$($dashboards.Count) dashboards"
    Add-Check "grafana" "datasources" $(if($datasources.Count -gt 0){"pass"}else{"warn"}) "$($datasources.Count) datasources"
} else {
    Add-Check "grafana" "dashboards" "info" "Grafana directory not set up"
}

# ── 7.5 Error Tracking ──────────────────────────────────────────
Write-PhaseLog "Checking error tracking..."

# Check for global error handlers in gateway
if (Test-Path $serverFile) {
    $content = Get-Content $serverFile -Raw
    $hasErrorHandler = $content -match 'setErrorHandler|onError|ErrorHandler'
    $hasCircuitBreaker = $content -match 'circuit.*breaker|CircuitBreaker'
    $hasUncaught = $content -match 'uncaughtException|unhandledRejection'

    Add-Check "errors" "error-handler" $(if($hasErrorHandler){"pass"}else{"warn"}) ""
    Add-Check "errors" "circuit-breaker" $(if($hasCircuitBreaker){"pass"}else{"info"}) ""
    Add-Check "errors" "uncaught-handlers" $(if($hasUncaught){"pass"}else{"info"}) ""
}

# Check for ErrorBoundary in frontend
$errorBoundary = "$Root\apps\web-user\src\components\ErrorBoundary.tsx"
if (Test-Path $errorBoundary) {
    Add-Check "errors" "frontend-error-boundary" "pass" ""
} else {
    Add-Check "errors" "frontend-error-boundary" "warn" "ErrorBoundary component missing"
}

# ── 7.6 Admin Monitoring Console ────────────────────────────────
Write-PhaseLog "Checking admin monitoring console..."

$adminWs = "$Root\apps\gateway-api\src\ws\admin-ws.ts"
if (Test-Path $adminWs) {
    $wsContent = Get-Content $adminWs -Raw
    $hasBroadcast   = $wsContent -match 'broadcast'
    $hasIntervene   = $wsContent -match 'intervene|intervention'
    $hasLiveMonitor = $wsContent -match 'monitor|activity|live'

    Add-Check "admin" "ws-broadcast" $(if($hasBroadcast){"pass"}else{"warn"}) ""
    Add-Check "admin" "ws-intervention" $(if($hasIntervene){"pass"}else{"info"}) ""
    Add-Check "admin" "ws-live-monitor" $(if($hasLiveMonitor){"pass"}else{"info"}) ""
}

# Admin dashboard route
$adminDashRoute = "$Root\apps\gateway-api\src\routes\admin-dashboard.ts"
if (Test-Path $adminDashRoute) {
    $adContent = Get-Content $adminDashRoute -Raw
    $hasAnalytics = $adContent -match 'analytics|stats|metrics'
    $hasUserMgmt  = $adContent -match 'user|manage'
    Add-Check "admin" "dashboard-analytics" $(if($hasAnalytics){"pass"}else{"warn"}) ""
    Add-Check "admin" "dashboard-users" $(if($hasUserMgmt){"pass"}else{"info"}) ""
} else {
    Add-Check "admin" "dashboard-route" "warn" "Admin dashboard route not found"
}

# ── 7.7 Backup & Recovery ───────────────────────────────────────
Write-PhaseLog "Checking backup & recovery..."

$hasBackupDir   = Test-Path "$Root\backups"
$dcFilePath     = "$Root\docker-compose.yml"
$hasDockerVols  = (Test-Path $dcFilePath) -and ((Get-Content $dcFilePath -Raw -ErrorAction SilentlyContinue) -match 'volumes:')

Add-Check "backup" "backup-directory" $(if($hasBackupDir){"pass"}else{"info"}) ""
Add-Check "backup" "docker-volumes" $(if($hasDockerVols){"pass"}else{"info"}) ""

# ── 7.8 Live Monitoring Check ───────────────────────────────────
if ($LiveCheck) {
    Write-PhaseLog "Testing live monitoring endpoints..."

    $monitorEndpoints = @(
        @{name="health"; url="http://localhost:4000/health"},
        @{name="debug-stats"; url="http://localhost:4000/api/debug/stats"},
        @{name="prometheus"; url="http://localhost:9090/-/ready"},
        @{name="grafana"; url="http://localhost:3000/api/health"}
    )

    foreach ($ep in $monitorEndpoints) {
        try {
            $resp = Invoke-WebRequest -Uri $ep.url -TimeoutSec 3 -ErrorAction Stop
            Add-Check "live-monitor" $ep.name $(if($resp.StatusCode -eq 200){"pass"}else{"warn"}) "HTTP $($resp.StatusCode)"
        } catch {
            Add-Check "live-monitor" $ep.name "fail" "Not reachable"
        }
    }
}

# ── Finalize ────────────────────────────────────────────────────
$passed = ($PhaseReport.checks | Where-Object { $_.status -eq "pass" }).Count
$total  = $PhaseReport.checks.Count
$PhaseReport.completedAt = (Get-Date -Format o)
$PhaseReport.status      = "completed"
$PhaseReport.summary     = "$passed / $total checks passed"
$PhaseReport.passRate    = if ($total -gt 0) { [math]::Round(($passed/$total)*100) } else { 0 }

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportPath = Join-Path $ReportDir "phase7-monitoring.json"
$PhaseReport | ConvertTo-Json -Depth 10 | Set-Content $reportPath -Encoding UTF8

Write-PhaseLog "Monitoring verification complete. $passed/$total passed ($($PhaseReport.passRate)%)"

return $PhaseReport
