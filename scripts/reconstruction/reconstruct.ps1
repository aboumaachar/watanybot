#!/usr/bin/env pwsh
<#
.SYNOPSIS
    WatanyBot Reconstruction Orchestrator — Master Controller
.DESCRIPTION
    Executes all 8 reconstruction phases (0-7) in parallel, produces a unified
    dashboard report with scores, issues, and recommended next actions.

.PARAMETER Mode
    - "parallel"  (default)  Run all phases simultaneously using background jobs
    - "sequential"           Run phases one-by-one in order
    - "audit-only"           Run Phase 0 only
    - "quick"                Run Phases 0-3 (fast code-analysis only)

.PARAMETER Fix
    When set, auto-fix issues where possible (install deps, create dirs, etc.)

.PARAMETER LiveTest
    Also run live server endpoint tests (phases 2/4)

.PARAMETER RunTests
    Execute actual test suites in Phase 5

.EXAMPLE
    .\reconstruct.ps1                        # Parallel audit of all phases
    .\reconstruct.ps1 -Mode parallel -Fix    # Parallel + auto-fix
    .\reconstruct.ps1 -Mode quick            # Phases 0-3 only (fast)
    .\reconstruct.ps1 -LiveTest -RunTests    # Full with live tests
#>

[CmdletBinding()]
param(
    [ValidateSet("parallel","sequential","audit-only","quick")]
    [string]$Mode = "parallel",

    [switch]$Fix,
    [switch]$LiveTest,
    [switch]$RunTests,
    [switch]$RunE2E,
    [switch]$SecurityScan,

    [int]$TimeoutSeconds = 300   # Per-phase timeout (default 5 min)
)

$ErrorActionPreference = "Continue"
$Root = $PSScriptRoot -replace '\\scripts\\reconstruction$', ''
$ReportDir = "$Root\reconstruction-reports"
$ScriptDir = $PSScriptRoot

# ═══════════════════════════════════════════════════════════════
# Banner
# ═══════════════════════════════════════════════════════════════

function Show-Banner {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════════════╗" -ForegroundColor DarkCyan
    Write-Host "  ║                                                          ║" -ForegroundColor DarkCyan
    Write-Host "  ║     WATANYBOT  -  RECONSTRUCTION  ORCHESTRATOR           ║" -ForegroundColor Cyan
    Write-Host "  ║                                                          ║" -ForegroundColor DarkCyan
    Write-Host "  ║     Mode: $($Mode.PadRight(15))  Fix: $($Fix.ToString().PadRight(8))          ║" -ForegroundColor DarkCyan
    Write-Host "  ║     Live: $($LiveTest.ToString().PadRight(15))  Tests: $($RunTests.ToString().PadRight(5))       ║" -ForegroundColor DarkCyan
    Write-Host "  ║                                                          ║" -ForegroundColor DarkCyan
    Write-Host "  ╚══════════════════════════════════════════════════════════╝" -ForegroundColor DarkCyan
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════════
# Phase Definitions
# ═══════════════════════════════════════════════════════════════

$allPhases = @(
    @{
        id     = 0; name = "Comprehensive Audit"
        script = "$ScriptDir\phase0-audit.ps1"
        args   = @{ ReportDir=$ReportDir; Quiet=$true }
        color  = "Cyan"
    },
    @{
        id     = 1; name = "Foundation"
        script = "$ScriptDir\phase1-foundation.ps1"
        args   = @{ ReportDir=$ReportDir; Quiet=$true; Fix=$Fix }
        color  = "Yellow"
    },
    @{
        id     = 2; name = "Backend"
        script = "$ScriptDir\phase2-backend.ps1"
        args   = @{ ReportDir=$ReportDir; Quiet=$true; LiveTest=$LiveTest }
        color  = "Green"
    },
    @{
        id     = 3; name = "Frontend"
        script = "$ScriptDir\phase3-frontend.ps1"
        args   = @{ ReportDir=$ReportDir; Quiet=$true }
        color  = "Magenta"
    },
    @{
        id     = 4; name = "Integration"
        script = "$ScriptDir\phase4-integration.ps1"
        args   = @{ ReportDir=$ReportDir; Quiet=$true; SkipLive=(-not $LiveTest) }
        color  = "Blue"
    },
    @{
        id     = 5; name = "Testing"
        script = "$ScriptDir\phase5-testing.ps1"
        args   = @{ ReportDir=$ReportDir; Quiet=$true; RunTests=$RunTests; RunE2E=$RunE2E; SecurityScan=$SecurityScan }
        color  = "DarkCyan"
    },
    @{
        id     = 6; name = "Deployment"
        script = "$ScriptDir\phase6-deployment.ps1"
        args   = @{ ReportDir=$ReportDir; Quiet=$true }
        color  = "DarkYellow"
    },
    @{
        id     = 7; name = "Monitoring"
        script = "$ScriptDir\phase7-monitoring.ps1"
        args   = @{ ReportDir=$ReportDir; Quiet=$true }
        color  = "DarkGreen"
    }
)

# Select phases based on mode
$phases = switch ($Mode) {
    "audit-only"  { $allPhases | Where-Object { $_.id -eq 0 } }
    "quick"       { $allPhases | Where-Object { $_.id -le 3 } }
    default       { $allPhases }
}

# ═══════════════════════════════════════════════════════════════
# Execution Engine
# ═══════════════════════════════════════════════════════════════

Show-Banner

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$startTime = Get-Date

Write-Host "  Starting $($phases.Count) phases in $Mode mode..." -ForegroundColor White
Write-Host "  Reports → $ReportDir" -ForegroundColor DarkGray
Write-Host ""

$results = @{}

if ($Mode -eq "parallel") {
    # ── Parallel Execution ──────────────────────────────────────
    $jobs = @()
    foreach ($phase in $phases) {
        Write-Host "  ▶ Launching Phase $($phase.id): $($phase.name)..." -ForegroundColor $phase.color

        $scriptPath = $phase.script
        $phaseArgs  = $phase.args

        $job = Start-Job -Name "Phase$($phase.id)" -ScriptBlock {
            param($scriptPath, $phaseArgs)
            $splat = @{}
            foreach ($kv in $phaseArgs.GetEnumerator()) {
                $splat[$kv.Key] = $kv.Value
            }
            & $scriptPath @splat
        } -ArgumentList $scriptPath, $phase.args

        $jobs += @{ phase=$phase; job=$job }
    }

    Write-Host ""
    Write-Host "  ⏳ Waiting for all phases to complete (timeout: ${TimeoutSeconds}s)..." -ForegroundColor White

    # Wait with progress + timeout
    $waitStart = Get-Date
    $allDone = $false
    $timedOut = $false
    while (-not $allDone) {
        $elapsed = ((Get-Date) - $waitStart).TotalSeconds
        $completed = ($jobs | Where-Object { $_.job.State -in 'Completed','Failed','Stopped' }).Count
        $pct = [math]::Round(($completed / $jobs.Count) * 100)

        # Show which phases are still running
        $running = ($jobs | Where-Object { $_.job.State -eq 'Running' } | ForEach-Object { "P$($_.phase.id)" }) -join ","
        $statusLine = "  Progress: $completed/$($jobs.Count) ($pct%) | Elapsed: $([math]::Round($elapsed))s"
        if ($running) { $statusLine += " | Running: $running" }

        Write-Host "`r$($statusLine.PadRight(80))" -NoNewline -ForegroundColor Gray

        if ($completed -eq $jobs.Count) {
            $allDone = $true
        } elseif ($elapsed -ge $TimeoutSeconds) {
            $timedOut = $true
            $allDone = $true
            Write-Host ""
            Write-Host "  ⚠ Timeout reached ($([math]::Round($elapsed))s). Stopping hung phases..." -ForegroundColor Yellow

            # Stop any still-running jobs
            foreach ($j in $jobs) {
                if ($j.job.State -eq 'Running') {
                    Write-Host "     Stopping Phase $($j.phase.id): $($j.phase.name)" -ForegroundColor Yellow
                    Stop-Job -Job $j.job -ErrorAction SilentlyContinue
                }
            }
            Start-Sleep -Seconds 2
        } else {
            Start-Sleep -Seconds 2
        }
    }
    Write-Host ""

    # Collect results — try job output first, then fall back to JSON on disk
    foreach ($j in $jobs) {
        $phaseId = $j.phase.id
        try {
            $output = Receive-Job -Job $j.job -ErrorAction Stop
            if ($output) {
                $results[$phaseId] = $output
            } else {
                throw "Empty output"
            }
        } catch {
            # Fallback: read the JSON report saved by the phase script
            $reportFile = Join-Path $ReportDir "phase$phaseId-*.json"
            $found = Get-ChildItem $reportFile -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                Write-Host "  [i] Phase $phaseId`: reading cached report from $($found.Name)" -ForegroundColor DarkGray
                try {
                    $results[$phaseId] = Get-Content $found.FullName -Raw | ConvertFrom-Json -AsHashtable
                } catch {
                    $results[$phaseId] = @{
                        phase=$phaseId; name=$j.phase.name; status="error"
                        error="Job failed and JSON parse failed: $_"; passRate=0
                    }
                }
            } else {
                $results[$phaseId] = @{
                    phase=$phaseId; name=$j.phase.name; status="error"
                    error="Timed out or failed — no report file found"; passRate=0
                }
            }
        }
        Remove-Job -Job $j.job -Force -ErrorAction SilentlyContinue
    }

} else {
    # ── Sequential Execution ────────────────────────────────────
    foreach ($phase in $phases) {
        Write-Host "  ▶ Running Phase $($phase.id): $($phase.name)..." -ForegroundColor $phase.color
        try {
            $splat = @{}
            foreach ($kv in $phase.args.GetEnumerator()) {
                $splat[$kv.Key] = $kv.Value
            }
            $output = & $phase.script @splat
            $results[$phase.id] = $output
        } catch {
            $results[$phase.id] = @{
                phase=$phase.id; name=$phase.name; status="error"
                error=$_.Exception.Message; passRate=0
            }
        }
    }
}

$endTime  = Get-Date
$duration = $endTime - $startTime

# ═══════════════════════════════════════════════════════════════
# Dashboard Generation
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "  ═══════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
Write-Host "                    RECONSTRUCTION DASHBOARD                " -ForegroundColor Cyan
Write-Host "  ═══════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "  Duration: $([math]::Round($duration.TotalSeconds))s | Mode: $Mode" -ForegroundColor Gray
Write-Host ""

# Score table
Write-Host "  ┌──────┬────────────────────────────┬────────┬──────────┐" -ForegroundColor DarkGray
Write-Host "  │Phase │ Name                       │ Score  │ Status   │" -ForegroundColor DarkGray
Write-Host "  ├──────┼────────────────────────────┼────────┼──────────┤" -ForegroundColor DarkGray

$overallScore = 0
$overallMax   = 0
$allIssues    = @()

foreach ($phase in $phases) {
    $r = $results[$phase.id]
    if (-not $r) { continue }

    # Try to extract pass rate from different report structures
    $rate = 0
    if ($r -is [hashtable]) {
        if ($r.passRate) { $rate = $r.passRate }
        elseif ($r.scorePercent) { $rate = $r.scorePercent }
        if ($r.issues) { $allIssues += $r.issues }
    }

    $rateStr = "${rate}%".PadLeft(5)
    $statusStr = if ($r.status -eq "error") { "ERROR" }
                 elseif ($rate -ge 80) { "PASS" }
                 elseif ($rate -ge 50) { "WARN" }
                 else { "FAIL" }
    $statusColor = switch ($statusStr) {
        "PASS"  { "Green" }
        "WARN"  { "Yellow" }
        "FAIL"  { "Red" }
        "ERROR" { "DarkRed" }
    }

    $nameStr = $phase.name.PadRight(26)
    $phaseStr = "  $($phase.id)".PadRight(4)

    Write-Host "  │ $phaseStr │ $nameStr │ $rateStr  │ " -NoNewline -ForegroundColor DarkGray
    Write-Host $statusStr.PadRight(9) -NoNewline -ForegroundColor $statusColor
    Write-Host "│" -ForegroundColor DarkGray

    $overallScore += $rate
    $overallMax++
}

Write-Host "  └──────┴────────────────────────────┴────────┴──────────┘" -ForegroundColor DarkGray

# Overall score
$overallPct = if ($overallMax -gt 0) { [math]::Round($overallScore / $overallMax) } else { 0 }
$overallColor = if ($overallPct -ge 80) { "Green" } elseif ($overallPct -ge 50) { "Yellow" } else { "Red" }

Write-Host ""
Write-Host "  OVERALL READINESS: " -NoNewline -ForegroundColor White
Write-Host "$overallPct%" -ForegroundColor $overallColor
Write-Host ""

# Progress bar
$barLen = 40
$filled = [math]::Round($overallPct / 100 * $barLen)
$empty  = $barLen - $filled
$bar = ("█" * $filled) + ("░" * $empty)
Write-Host "  [$bar] $overallPct%" -ForegroundColor $overallColor
Write-Host ""

# ── Critical Issues ─────────────────────────────────────────────
$critIssues = $allIssues | Where-Object { $_.severity -eq "critical" }
$warnIssues = $allIssues | Where-Object { $_.severity -eq "warning" }
$infoIssues = $allIssues | Where-Object { $_.severity -eq "info" }

if ($critIssues.Count -gt 0) {
    Write-Host "  ❌ CRITICAL ISSUES ($($critIssues.Count)):" -ForegroundColor Red
    foreach ($ci in $critIssues) {
        Write-Host "     • $($ci.msg)" -ForegroundColor Red
    }
    Write-Host ""
}

if ($warnIssues.Count -gt 0) {
    Write-Host "  ⚠  WARNINGS ($($warnIssues.Count)):" -ForegroundColor Yellow
    foreach ($wi in $warnIssues | Select-Object -First 10) {
        Write-Host "     • $($wi.msg)" -ForegroundColor Yellow
    }
    if ($warnIssues.Count -gt 10) { Write-Host "     ... and $($warnIssues.Count - 10) more" -ForegroundColor DarkYellow }
    Write-Host ""
}

Write-Host "  ℹ  Info items: $($infoIssues.Count)" -ForegroundColor Gray
Write-Host ""

# ── Recommended Actions ─────────────────────────────────────────
Write-Host "  ═══════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
Write-Host "                    RECOMMENDED ACTIONS                     " -ForegroundColor Cyan
Write-Host "  ═══════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
Write-Host ""

$actions = @()
$priority = 1

# Generate smart recommendations based on results
if ($critIssues | Where-Object { $_.msg -match 'node_modules|pnpm install' }) {
    $actions += @{ n=$priority++; msg="Run 'pnpm install' in project root to install dependencies"; cmd="pnpm install" }
}
if ($critIssues | Where-Object { $_.msg -match 'Node.js' }) {
    $actions += @{ n=$priority++; msg="Install Node.js >= 18 LTS from https://nodejs.org"; cmd=$null }
}
if ($critIssues | Where-Object { $_.msg -match 'SQLite KB' }) {
    $actions += @{ n=$priority++; msg="Rebuild Knowledge Base: pnpm run build:kb"; cmd="pnpm run build:kb" }
}

$phaseResults = @{}
foreach ($phase in $phases) {
    $r = $results[$phase.id]
    $rate = 0
    if ($r -is [hashtable]) {
        if ($r.passRate) { $rate = $r.passRate }
        elseif ($r.scorePercent) { $rate = $r.scorePercent }
    }
    $phaseResults[$phase.id] = $rate
}

if (($phaseResults[2] -lt 70) -or ($phaseResults[2] -eq 0)) {
    $actions += @{ n=$priority++; msg="Focus on Backend (Phase 2): fix route modules and AI integration"; cmd=$null }
}
if (($phaseResults[3] -lt 70) -or ($phaseResults[3] -eq 0)) {
    $actions += @{ n=$priority++; msg="Focus on Frontend (Phase 3): add missing pages and components"; cmd=$null }
}
if (($phaseResults[5] -lt 50) -or ($phaseResults[5] -eq 0)) {
    $actions += @{ n=$priority++; msg="Add tests: vitest for unit tests, playwright for E2E"; cmd="pnpm test" }
}
if (($phaseResults[6] -lt 50) -or ($phaseResults[6] -eq 0)) {
    $actions += @{ n=$priority++; msg="Complete deployment configs (Docker, Nginx, PM2)"; cmd=$null }
}
if ($actions.Count -eq 0) {
    $actions += @{ n=1; msg="System looks good! Run with -LiveTest -RunTests for deeper validation"; cmd=$null }
}

foreach ($a in $actions) {
    Write-Host "  $($a.n). $($a.msg)" -ForegroundColor White
    if ($a.cmd) { Write-Host "     → $($a.cmd)" -ForegroundColor DarkGray }
}

Write-Host ""

# ═══════════════════════════════════════════════════════════════
# Save Master Report
# ═══════════════════════════════════════════════════════════════

$masterReport = @{
    generatedAt     = (Get-Date -Format o)
    duration        = "$([math]::Round($duration.TotalSeconds))s"
    mode            = $Mode
    overallScore    = $overallPct
    phaseCount      = $phases.Count
    phases          = @()
    criticalIssues  = $critIssues.Count
    warnings        = $warnIssues.Count
    infoItems       = $infoIssues.Count
    allIssues       = $allIssues
    actions         = $actions | ForEach-Object { $_.msg }
}

foreach ($phase in $phases) {
    $r = $results[$phase.id]
    $rate = 0
    if ($r -is [hashtable]) {
        if ($r.passRate) { $rate = $r.passRate }
        elseif ($r.scorePercent) { $rate = $r.scorePercent }
    }
    $masterReport.phases += @{
        id       = $phase.id
        name     = $phase.name
        score    = $rate
        status   = if ($r.status) { $r.status } else { "unknown" }
        summary  = if ($r.summary) { $r.summary } else { "" }
    }
}

$masterPath = Join-Path $ReportDir "MASTER_REPORT.json"
$masterReport | ConvertTo-Json -Depth 10 | Set-Content $masterPath -Encoding UTF8

Write-Host "  Reports saved to: $ReportDir\" -ForegroundColor DarkGray
Write-Host "  Master report: $masterPath" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Re-run with fixes: .\reconstruct.ps1 -Fix" -ForegroundColor DarkGray
Write-Host "  Deep test:         .\reconstruct.ps1 -LiveTest -RunTests" -ForegroundColor DarkGray
Write-Host ""

return $masterReport
