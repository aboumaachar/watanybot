#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 5: Comprehensive Testing — Unit, Integration, E2E, Performance, Security
#>

param(
    [string]$ReportDir = "$PSScriptRoot\..\..\reconstruction-reports",
    [switch]$Quiet,
    [switch]$RunTests,       # Actually execute test suites
    [switch]$RunE2E,         # Run Playwright E2E tests
    [switch]$SecurityScan    # Run security checks
)

$ErrorActionPreference = "Continue"
$Root = Resolve-Path "$PSScriptRoot\..\.."

$PhaseReport = @{
    phase     = 5
    name      = "Comprehensive Testing"
    startedAt = (Get-Date -Format o)
    status    = "running"
    checks    = @()
    issues    = @()
    results   = @{}
}

function Write-PhaseLog($msg) { if (-not $Quiet) { Write-Host "  [Phase5] $msg" -ForegroundColor DarkCyan } }
function Add-Check($category, $name, $status, $detail) {
    $PhaseReport.checks += @{ category=$category; name=$name; status=$status; detail=$detail }
}

# ── 5.1 Test Infrastructure ─────────────────────────────────────
Write-PhaseLog "Auditing test infrastructure..."

$hasVitest     = Test-Path "$Root\node_modules\vitest"
$hasPlaywright = Test-Path "$Root\node_modules\@playwright"
$hasSupertest  = Test-Path "$Root\node_modules\supertest"
$hasPytest     = $false

# Check pytest
try { $pytestVer = python -m pytest --version 2>$null; $hasPytest = $true } catch {}

Add-Check "infra" "vitest" $(if($hasVitest){"pass"}else{"fail"}) ""
Add-Check "infra" "playwright" $(if($hasPlaywright){"pass"}else{"warn"}) ""
Add-Check "infra" "supertest" $(if($hasSupertest){"pass"}else{"warn"}) ""
Add-Check "infra" "pytest" $(if($hasPytest){"pass"}else{"info"}) ""

if (-not $hasVitest) {
    $PhaseReport.issues += @{severity="critical"; msg="Vitest not installed. Run: pnpm add -D vitest"}
}

# ── 5.2 Test File Inventory ─────────────────────────────────────
Write-PhaseLog "Inventorying test files..."

$testFiles = Get-ChildItem $Root -Recurse -Include "*.test.ts","*.test.tsx","*.spec.ts","*.spec.tsx" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch 'node_modules' }

$unitTests = $testFiles | Where-Object { $_.FullName -notmatch 'e2e|integration' }
$e2eTests  = $testFiles | Where-Object { $_.FullName -match 'e2e' }
$intTests  = $testFiles | Where-Object { $_.FullName -match 'integration' }

Add-Check "inventory" "unit-tests" $(if($unitTests.Count -gt 0){"pass"}else{"warn"}) "$($unitTests.Count) files"
Add-Check "inventory" "e2e-tests" $(if($e2eTests.Count -gt 0){"pass"}else{"warn"}) "$($e2eTests.Count) files"
Add-Check "inventory" "integration-tests" $(if($intTests.Count -gt 0){"pass"}else{"info"}) "$($intTests.Count) files"
Add-Check "inventory" "total-test-files" "info" "$($testFiles.Count) total test files"

$rootStr = $Root.ToString()
$PhaseReport.results["testInventory"] = @{
    unit = @($unitTests | ForEach-Object { $_.FullName.Replace($rootStr + '\','') })
    e2e  = @($e2eTests | ForEach-Object { $_.FullName.Replace($rootStr + '\','') })
    integration = @($intTests | ForEach-Object { $_.FullName.Replace($rootStr + '\','') })
}

# ── 5.3 Test Coverage Areas ─────────────────────────────────────
Write-PhaseLog "Analyzing test coverage areas..."

$coveredAreas = @{
    "gateway-core"    = $false
    "auth-system"     = $false
    "chat-flow"       = $false
    "salary-calc"     = $false
    "kb-search"       = $false
    "admin-routes"    = $false
    "content-filter"  = $false
    "ai-integration"  = $false
    "frontend-pages"  = $false
    "e2e-user-flow"   = $false
}

foreach ($tf in $testFiles) {
    $content = Get-Content $tf.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    if ($content -match 'debug|health|stats')    { $coveredAreas["gateway-core"] = $true }
    if ($content -match 'auth|login|register')   { $coveredAreas["auth-system"] = $true }
    if ($content -match 'chat|message')           { $coveredAreas["chat-flow"] = $true }
    if ($content -match 'salary|grade')           { $coveredAreas["salary-calc"] = $true }
    if ($content -match 'kb|knowledge|search')    { $coveredAreas["kb-search"] = $true }
    if ($content -match 'admin|dashboard')        { $coveredAreas["admin-routes"] = $true }
    if ($content -match 'filter|moderat')         { $coveredAreas["content-filter"] = $true }
    if ($content -match 'ai|rag|llm|provider')    { $coveredAreas["ai-integration"] = $true }
    if ($content -match 'page|component|render')  { $coveredAreas["frontend-pages"] = $true }
    if ($content -match 'e2e|journey|flow')       { $coveredAreas["e2e-user-flow"] = $true }
}

$covered = ($coveredAreas.Values | Where-Object { $_ }).Count
$areaTotal = $coveredAreas.Count
Add-Check "coverage" "test-coverage-areas" $(if($covered -ge 7){"pass"}elseif($covered -ge 4){"warn"}else{"fail"}) "$covered/$areaTotal areas covered"

foreach ($area in $coveredAreas.GetEnumerator()) {
    Add-Check "coverage" "area-$($area.Key)" $(if($area.Value){"pass"}else{"missing"}) ""
    if (-not $area.Value) {
        $PhaseReport.issues += @{severity="info"; msg="No tests for: $($area.Key)"}
    }
}

# ── 5.4 Run Unit Tests ──────────────────────────────────────────
if ($RunTests -and $hasVitest) {
    Write-PhaseLog "Running unit tests..."

    Push-Location $Root
    $testOutput = & npx vitest run --reporter=json 2>&1 | Out-String
    $exitCode = $LASTEXITCODE

    try {
        $jsonMatch = [regex]::Match($testOutput, '\{.*\}', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        if ($jsonMatch.Success) {
            $testResults = $jsonMatch.Value | ConvertFrom-Json
            $PhaseReport.results["vitest"] = @{
                numPassed  = $testResults.numPassedTests
                numFailed  = $testResults.numFailedTests
                numTotal   = $testResults.numTotalTests
                duration   = $testResults.startTime
            }
            $allPassed = $testResults.numFailedTests -eq 0
            Add-Check "unit-test" "vitest-run" $(if($allPassed){"pass"}else{"fail"}) "$($testResults.numPassedTests)/$($testResults.numTotalTests) passed"
        }
    } catch {
        Add-Check "unit-test" "vitest-run" $(if($exitCode -eq 0){"pass"}else{"fail"}) "Exit code: $exitCode"
    }
    Pop-Location
} elseif ($RunTests) {
    Add-Check "unit-test" "vitest-run" "skip" "Vitest not available"
}

# ── 5.5 Run E2E Tests ───────────────────────────────────────────
if ($RunE2E -and $hasPlaywright) {
    Write-PhaseLog "Running Playwright E2E tests..."

    Push-Location $Root
    $e2eOutput = & npx playwright test --reporter=json 2>&1 | Out-String
    $e2eExit = $LASTEXITCODE

    Add-Check "e2e" "playwright-run" $(if($e2eExit -eq 0){"pass"}else{"fail"}) "Exit code: $e2eExit"

    $PhaseReport.results["e2e_output"] = $e2eOutput.Substring(0, [Math]::Min(2000, $e2eOutput.Length))
    Pop-Location
} elseif ($RunE2E) {
    Add-Check "e2e" "playwright-run" "skip" "Playwright not available"
}

# ── 5.6 Security Checks ─────────────────────────────────────────
Write-PhaseLog "Running security checks..."

# Check for secrets in code
$secretPatterns = @(
    'api[_-]?key\s*[=:]\s*[''"][a-zA-Z0-9]{20,}',
    'password\s*[=:]\s*[''"][^''"]{8,}',
    'secret\s*[=:]\s*[''"][^''"]{10,}',
    'sk-[a-zA-Z0-9]{20,}'
)

$secretsFound = 0
$srcFiles = Get-ChildItem "$Root\apps" -Recurse -Include "*.ts","*.tsx","*.js" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch 'node_modules|dist|\.env|\.test\.|\.spec\.' } | Select-Object -First 500

foreach ($sf in $srcFiles) {
    $content = Get-Content $sf.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    foreach ($pattern in $secretPatterns) {
        if ($content -match $pattern) {
            $secretsFound++
            $PhaseReport.issues += @{severity="critical"; msg="Potential secret in: $($sf.FullName.Replace($rootStr + '\',''))"}
            break
        }
    }
}

Add-Check "security" "secrets-scan" $(if($secretsFound -eq 0){"pass"}else{"fail"}) "$secretsFound files with potential secrets"

# Check .gitignore
$gitignore = "$Root\.gitignore"
if (Test-Path $gitignore) {
    $giContent = Get-Content $gitignore -Raw
    $hasEnvIgnore = $giContent -match '\.env'
    $hasNodeModules = $giContent -match 'node_modules'
    Add-Check "security" "gitignore-env" $(if($hasEnvIgnore){"pass"}else{"fail"}) ""
    Add-Check "security" "gitignore-node_modules" $(if($hasNodeModules){"pass"}else{"fail"}) ""
} else {
    Add-Check "security" "gitignore" "fail" ".gitignore not found"
    $PhaseReport.issues += @{severity="critical"; msg=".gitignore missing"}
}

# Dependency vulnerabilities (npm audit)
if ($SecurityScan) {
    Write-PhaseLog "Running npm audit..."
    Push-Location $Root
    $auditOutput = pnpm audit --json 2>$null | Out-String
    try {
        $auditData = $auditOutput | ConvertFrom-Json
        $vulns = $auditData.metadata.vulnerabilities
        $critVulns = $vulns.critical + $vulns.high
        Add-Check "security" "npm-audit" $(if($critVulns -eq 0){"pass"}else{"warn"}) "Critical+High: $critVulns"
        $PhaseReport.results["npmAudit"] = $vulns
    } catch {
        Add-Check "security" "npm-audit" "skip" "Could not parse audit results"
    }
    Pop-Location
}

# ── 5.7 Performance Baseline ────────────────────────────────────
Write-PhaseLog "Checking performance baseline..."

# Check gateway server.ts for performance features
if (Test-Path "$Root\apps\gateway-api\src\server.ts") {
    $sContent = Get-Content "$Root\apps\gateway-api\src\server.ts" -Raw
    $hasCompression = $sContent -match 'compress'
    $hasCaching     = $sContent -match 'cache|Cache-Control|ETag'
    $hasRateLimit   = $sContent -match 'rateLimit|rate-limit'
    $hasCircuit     = $sContent -match 'circuit|breaker'

    Add-Check "performance" "compression" $(if($hasCompression){"pass"}else{"warn"}) ""
    Add-Check "performance" "caching" $(if($hasCaching){"pass"}else{"info"}) ""
    Add-Check "performance" "rate-limiting" $(if($hasRateLimit){"pass"}else{"warn"}) ""
    Add-Check "performance" "circuit-breaker" $(if($hasCircuit){"pass"}else{"info"}) ""
}

# ── Finalize ────────────────────────────────────────────────────
# passRate: count pass/(pass+fail+warn+missing) — info and skip are neutral
$passed  = ($PhaseReport.checks | Where-Object { $_.status -eq "pass" }).Count
$graded  = ($PhaseReport.checks | Where-Object { $_.status -in 'pass','fail','warn','missing' }).Count
$total   = $PhaseReport.checks.Count
$PhaseReport.completedAt = (Get-Date -Format o)
$PhaseReport.status      = "completed"
$PhaseReport.summary     = "$passed / $total checks passed"
$PhaseReport.passRate    = if ($graded -gt 0) { [math]::Round(($passed/$graded)*100) } else { 100 }

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportPath = Join-Path $ReportDir "phase5-testing.json"
$PhaseReport | ConvertTo-Json -Depth 10 | Set-Content $reportPath -Encoding UTF8

Write-PhaseLog "Testing verification complete. $passed/$total passed ($($PhaseReport.passRate)%)"

return $PhaseReport
