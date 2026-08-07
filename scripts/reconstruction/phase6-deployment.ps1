#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 6: Deployment Readiness — Docker, PM2, Nginx, CI/CD, production configs
#>

param(
    [string]$ReportDir = "$PSScriptRoot\..\..\reconstruction-reports",
    [switch]$Quiet,
    [switch]$ValidateDocker  # Try docker-compose config validation
)

$ErrorActionPreference = "Continue"
$Root = Resolve-Path "$PSScriptRoot\..\.."

$PhaseReport = @{
    phase     = 6
    name      = "Deployment Readiness"
    startedAt = (Get-Date -Format o)
    status    = "running"
    checks    = @()
    issues    = @()
}

function Write-PhaseLog($msg) { if (-not $Quiet) { Write-Host "  [Phase6] $msg" -ForegroundColor DarkYellow } }
function Add-Check($category, $name, $status, $detail) {
    $PhaseReport.checks += @{ category=$category; name=$name; status=$status; detail=$detail }
}

# ── 6.1 Docker Configuration ────────────────────────────────────
Write-PhaseLog "Checking Docker configuration..."

$dcFile = "$Root\docker-compose.yml"
if (Test-Path $dcFile) {
    $dcContent = Get-Content $dcFile -Raw
    Add-Check "docker" "docker-compose" "pass" ""

    # Check for all services
    $services = @("postgres","redis","api-backend","gateway-api","web-user","web-admin","nginx","prometheus","grafana")
    foreach ($svc in $services) {
        $hasSvc = $dcContent -match "(?m)^\s+${svc}\s*:" -or $dcContent -match "container_name:.*$svc"
        Add-Check "docker" "svc-$svc" $(if($hasSvc){"pass"}else{"warn"}) ""
    }

    # Health checks
    $healthChecks = ([regex]::Matches($dcContent, 'healthcheck:')).Count
    Add-Check "docker" "health-checks" $(if($healthChecks -ge 3){"pass"}else{"warn"}) "$healthChecks healthchecks defined"

    # Volumes — named volumes are at top-level indentation in docker-compose
    $volumes = ([regex]::Matches($dcContent, '(?m)^\s*[a-z_]+_data:')).Count
    Add-Check "docker" "persistent-volumes" $(if($volumes -ge 2){"pass"}else{"warn"}) "$volumes named volumes"
} else {
    Add-Check "docker" "docker-compose" "fail" "docker-compose.yml not found"
    $PhaseReport.issues += @{severity="warning"; msg="docker-compose.yml missing"}
}

# Dockerfile
$dockerfile = "$Root\Dockerfile"
if (Test-Path $dockerfile) {
    $dfContent = Get-Content $dockerfile -Raw
    $hasMultiStage = $dfContent -match 'FROM.*AS\s+\w+'
    $hasNonRoot    = $dfContent -match 'USER\s+(?!root)'
    Add-Check "docker" "Dockerfile" "pass" ""
    Add-Check "docker" "multi-stage-build" $(if($hasMultiStage){"pass"}else{"info"}) ""
    Add-Check "docker" "non-root-user" $(if($hasNonRoot){"pass"}else{"info"}) ""
} else {
    Add-Check "docker" "Dockerfile" "warn" "Node Dockerfile not found"
}

$dockerfilePy = "$Root\Dockerfile.python"
if (Test-Path $dockerfilePy) {
    Add-Check "docker" "Dockerfile-python" "pass" ""
} else {
    Add-Check "docker" "Dockerfile-python" "warn" "Python Dockerfile not found"
}

# Validate docker-compose
if ($ValidateDocker) {
    try {
        Push-Location $Root
        $dcValidate = docker-compose config 2>&1 | Out-String
        $dcValid = $LASTEXITCODE -eq 0
        Add-Check "docker" "compose-validate" $(if($dcValid){"pass"}else{"fail"}) ""
        Pop-Location
    } catch {
        Add-Check "docker" "compose-validate" "skip" "Docker not available"
    }
}

# ── 6.2 PM2 Configuration ───────────────────────────────────────
Write-PhaseLog "Checking PM2 configuration..."

$pm2Config = "$Root\apps\gateway-api\ecosystem.config.cjs"
if (Test-Path $pm2Config) {
    $pm2Content = Get-Content $pm2Config -Raw
    Add-Check "pm2" "ecosystem-config" "pass" ""

    $hasMemLimit  = $pm2Content -match 'max_memory_restart'
    $hasLogs      = $pm2Content -match 'error_file|out_file'
    $hasRestart   = $pm2Content -match 'autorestart|max_restarts'
    $hasProdEnv   = $pm2Content -match 'env_production'

    Add-Check "pm2" "memory-limit" $(if($hasMemLimit){"pass"}else{"warn"}) ""
    Add-Check "pm2" "log-config" $(if($hasLogs){"pass"}else{"warn"}) ""
    Add-Check "pm2" "restart-policy" $(if($hasRestart){"pass"}else{"warn"}) ""
    Add-Check "pm2" "prod-env" $(if($hasProdEnv){"pass"}else{"warn"}) ""
} else {
    Add-Check "pm2" "ecosystem-config" "warn" "PM2 ecosystem config not found"
}

# ── 6.3 Nginx Configuration ─────────────────────────────────────
Write-PhaseLog "Checking Nginx configuration..."

$nginxConf = "$Root\monitoring\nginx.conf"
if (Test-Path $nginxConf) {
    $ngContent = Get-Content $nginxConf -Raw
    Add-Check "nginx" "config-file" "pass" ""

    $hasSSL       = $ngContent -match 'ssl_certificate|ssl_protocol'
    $hasProxy     = $ngContent -match 'proxy_pass'
    $hasGzip      = $ngContent -match 'gzip'
    $hasHeaders   = $ngContent -match 'X-Frame-Options|Content-Security-Policy|X-Content-Type'
    $hasRateLimit = $ngContent -match 'limit_req'

    Add-Check "nginx" "ssl-config" $(if($hasSSL){"pass"}else{"info"}) ""
    Add-Check "nginx" "proxy-pass" $(if($hasProxy){"pass"}else{"warn"}) ""
    Add-Check "nginx" "gzip" $(if($hasGzip){"pass"}else{"info"}) ""
    Add-Check "nginx" "security-headers" $(if($hasHeaders){"pass"}else{"warn"}) ""
    Add-Check "nginx" "rate-limiting" $(if($hasRateLimit){"pass"}else{"info"}) ""
} else {
    Add-Check "nginx" "config-file" "warn" "nginx.conf not found"
}

# ── 6.4 Environment Templates ───────────────────────────────────
Write-PhaseLog "Checking environment templates..."

$envTemplates = @(
    @{name="gateway .env.example"; path="$Root\apps\gateway-api\.env.example"},
    @{name="gateway .env.production"; path="$Root\apps\gateway-api\.env.production.example"},
    @{name="web-user .env.production"; path="$Root\apps\web-user\.env.production"}
)

foreach ($et in $envTemplates) {
    $exists = Test-Path $et.path
    Add-Check "env-templates" $et.name $(if($exists){"pass"}else{"info"}) ""
}

# ── 6.5 Build Scripts ───────────────────────────────────────────
Write-PhaseLog "Checking build scripts..."

$buildScripts = @(
    @{name="build-production.ps1"; path="$Root\scripts\build-production.ps1"},
    @{name="build-production.sh"; path="$Root\scripts\build-production.sh"},
    @{name="verify-deployment.ps1"; path="$Root\scripts\verify-deployment.ps1"},
    @{name="deploy script"; path="$Root\scripts\deploy-ollama-deepseek.sh"}
)

foreach ($bs in $buildScripts) {
    $exists = Test-Path $bs.path
    Add-Check "build-scripts" $bs.name $(if($exists){"pass"}else{"info"}) ""
}

# ── 6.6 Monitoring Setup ────────────────────────────────────────
Write-PhaseLog "Checking monitoring setup..."

$promConfig = "$Root\monitoring\prometheus.yml"
if (Test-Path $promConfig) {
    Add-Check "monitoring" "prometheus-config" "pass" ""
} else {
    Add-Check "monitoring" "prometheus-config" "warn" "Prometheus config missing"
}

$grafanaDir = "$Root\monitoring\grafana"
if (Test-Path $grafanaDir) {
    Add-Check "monitoring" "grafana-dashboards" "pass" ""
} else {
    Add-Check "monitoring" "grafana-dashboards" "info" "Grafana dashboards not configured"
}

# ── 6.7 Documentation ───────────────────────────────────────────
Write-PhaseLog "Checking deployment documentation..."

$deployDocs = @(
    @{name="README.md"; path="$Root\README.md"},
    @{name="DEPLOYMENT_GUIDE"; path="$Root\PRODUCTION_DEPLOYMENT_GUIDE.md"},
    @{name="QUICK_REFERENCE"; path="$Root\QUICK_REFERENCE.md"}
)

foreach ($dd in $deployDocs) {
    $exists = Test-Path $dd.path
    Add-Check "docs" $dd.name $(if($exists){"pass"}else{"info"}) ""
}

# ── Finalize ────────────────────────────────────────────────────
$passed = ($PhaseReport.checks | Where-Object { $_.status -eq "pass" }).Count
$total  = $PhaseReport.checks.Count
$PhaseReport.completedAt = (Get-Date -Format o)
$PhaseReport.status      = "completed"
$PhaseReport.summary     = "$passed / $total checks passed"
$PhaseReport.passRate    = if ($total -gt 0) { [math]::Round(($passed/$total)*100) } else { 0 }

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportPath = Join-Path $ReportDir "phase6-deployment.json"
$PhaseReport | ConvertTo-Json -Depth 10 | Set-Content $reportPath -Encoding UTF8

Write-PhaseLog "Deployment readiness check complete. $passed/$total passed ($($PhaseReport.passRate)%)"

return $PhaseReport
