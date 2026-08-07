#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 3: Frontend Verification & Quality Assessment
.DESCRIPTION
    Validates React components, pages, design system, routing, state management,
    and build quality.
#>

param(
    [string]$ReportDir = "$PSScriptRoot\..\..\reconstruction-reports",
    [switch]$Quiet,
    [switch]$BuildTest  # Run vite build to check for errors
)

$ErrorActionPreference = "Continue"
$Root = Resolve-Path "$PSScriptRoot\..\.."
$WU   = "$Root\apps\web-user"

$PhaseReport = @{
    phase     = 3
    name      = "Frontend Rebuild Verification"
    startedAt = (Get-Date -Format o)
    status    = "running"
    checks    = @()
    issues    = @()
}

function Write-PhaseLog($msg) { if (-not $Quiet) { Write-Host "  [Phase3] $msg" -ForegroundColor Magenta } }
function Add-Check($category, $name, $status, $detail) {
    $PhaseReport.checks += @{ category=$category; name=$name; status=$status; detail=$detail }
}

# ── 3.1 Setup & Configuration ───────────────────────────────────
Write-PhaseLog "Checking setup & config..."

$configFiles = @{
    "package.json"     = "$WU\package.json"
    "vite.config.ts"   = "$WU\vite.config.ts"
    "tsconfig.json"    = "$WU\tsconfig.json"
    "index.html"       = "$WU\index.html"
}

foreach ($kv in $configFiles.GetEnumerator()) {
    $exists = Test-Path $kv.Value
    Add-Check "setup" $kv.Key $(if($exists){"pass"}else{"fail"}) ""
    if (-not $exists) { $PhaseReport.issues += @{severity="critical"; msg="$($kv.Key) missing"} }
}

# Check React Router setup
$appTsx = "$WU\src\App.tsx"
if (Test-Path $appTsx) {
    $appContent = Get-Content $appTsx -Raw
    $hasRouter   = $appContent -match 'Router|Route|BrowserRouter|Routes'
    $hasImport   = $appContent -match 'react-router'
    Add-Check "setup" "react-router" $(if($hasRouter -and $hasImport){"pass"}else{"warn"}) ""
} else {
    Add-Check "setup" "App.tsx" "fail" "Main app component not found"
}

# ── 3.2 Design System ───────────────────────────────────────────
Write-PhaseLog "Checking design system..."

$stylesDir = "$WU\src\styles"
if (Test-Path $stylesDir) {
    $cssFiles = Get-ChildItem $stylesDir -Filter "*.css" -Recurse
    Add-Check "design" "stylesheets" "pass" "$($cssFiles.Count) CSS files"

    # Check for design tokens / CSS variables
    $allCSS = $cssFiles | ForEach-Object { Get-Content $_.FullName -Raw } | Out-String
    $hasVariables = $allCSS -match '--ink|--accent|--bg|--radius|--gap'
    $hasCairo     = $allCSS -match 'Cairo|cairo'
    $hasRTL       = $allCSS -match 'direction:\s*rtl|dir.*rtl|\[dir=.rtl.\]'
    Add-Check "design" "css-variables" $(if($hasVariables){"pass"}else{"warn"}) ""
    Add-Check "design" "cairo-font" $(if($hasCairo){"pass"}else{"warn"}) ""
    Add-Check "design" "rtl-support" $(if($hasRTL){"pass"}else{"warn"}) ""
} else {
    Add-Check "design" "stylesheets" "warn" "Styles directory not found"
}

# Also check main styles.css
$mainCSS = "$WU\src\styles.css"
if (Test-Path $mainCSS) {
    $mainContent = Get-Content $mainCSS -Raw
    $hasTokens = $mainContent -match '--ink|--accent|--bg'
    Add-Check "design" "main-styles" "pass" "$(($mainContent | Measure-Object -Line).Lines) lines"
} else {
    Add-Check "design" "main-styles" "warn" "styles.css not found"
}

# ── 3.3 Pages ────────────────────────────────────────────────────
Write-PhaseLog "Checking pages..."

$pagesDir = "$WU\src\pages"
$requiredPages = @(
    "LoginPage", "RegisterPage", "ChatSessionsPage", "SalaryPage",
    "SearchPage", "CasesPage", "DocumentsPage", "NotificationsPage",
    "JobsPage", "MarketplacePage", "ProfilePage", "AlertsPage",
    "SavedChatsPage", "FormsPage"
)

if (Test-Path $pagesDir) {
    $pageFiles = Get-ChildItem $pagesDir -Filter "*.tsx"
    Add-Check "pages" "page-count" "pass" "$($pageFiles.Count) pages"

    $existingPages = $pageFiles | ForEach-Object { $_.BaseName }
    foreach ($rp in $requiredPages) {
        $found = $existingPages -contains $rp
        Add-Check "pages" $rp $(if($found){"pass"}else{"missing"}) ""
        if (-not $found) { $PhaseReport.issues += @{severity="info"; msg="Page missing: $rp"} }
    }
} else {
    Add-Check "pages" "pages-dir" "fail" "Pages directory not found"
}

# ── 3.4 Components ──────────────────────────────────────────────
Write-PhaseLog "Checking components..."

$compDir = "$WU\src\components"
$requiredComponents = @(
    "AppShell", "ChatScreen", "UserWindow", "LandingPage",
    "DecisionTree", "SalaryWizard", "FeedbackButtons",
    "TopBar", "ErrorBoundary", "VoiceMode"
)

if (Test-Path $compDir) {
    $compFiles = Get-ChildItem $compDir -Filter "*.tsx" -Recurse
    Add-Check "components" "component-count" "pass" "$($compFiles.Count) components"

    $existingComps = $compFiles | ForEach-Object { $_.BaseName }
    foreach ($rc in $requiredComponents) {
        $found = $existingComps -contains $rc
        Add-Check "components" $rc $(if($found){"pass"}else{"warn"}) ""
    }

    # Check for chat subdirectory
    $chatDir = "$compDir\chat"
    if (Test-Path $chatDir) {
        $chatComps = Get-ChildItem $chatDir -Filter "*.tsx"
        Add-Check "components" "chat-components" "pass" "$($chatComps.Count) chat components"
    }
} else {
    Add-Check "components" "components-dir" "fail" "Components directory not found"
}

# ── 3.5 State Management ────────────────────────────────────────
Write-PhaseLog "Checking state management..."

$storeDir = "$WU\src\store"
if (Test-Path $storeDir) {
    $storeFiles = Get-ChildItem $storeDir -Filter "*.tsx" -Recurse
    $storeFilesTs = Get-ChildItem $storeDir -Filter "*.ts" -Recurse
    $allStore = @($storeFiles) + @($storeFilesTs) | Where-Object { $_ -ne $null }
    Add-Check "state" "store" "pass" "$($allStore.Count) store files"

    # Check for context API usage
    $storeContent = $allStore | ForEach-Object { Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue } | Out-String
    $hasContext = $storeContent -match 'createContext|useContext|React\.createContext'
    $hasReducer = $storeContent -match 'useReducer|reducer'
    Add-Check "state" "react-context" $(if($hasContext){"pass"}else{"warn"}) ""
} else {
    Add-Check "state" "store" "warn" "Store directory not found"
}

# ── 3.6 API Client ──────────────────────────────────────────────
Write-PhaseLog "Checking API client..."

$apiClient = "$WU\src\lib\api.ts"
if (Test-Path $apiClient) {
    $apiContent = Get-Content $apiClient -Raw
    $lineCount = (Get-Content $apiClient | Measure-Object -Line).Lines
    Add-Check "api-client" "api.ts" "pass" "$lineCount lines"

    # Check for key API methods
    $methods = @("chat","salary","search","login","register","cases","documents","notifications","jobs","marketplace")
    $foundMethods = 0
    foreach ($m in $methods) {
        if ($apiContent -match $m) { $foundMethods++ }
    }
    Add-Check "api-client" "api-methods" $(if($foundMethods -ge 7){"pass"}elseif($foundMethods -ge 4){"warn"}else{"fail"}) "$foundMethods/$($methods.Count) methods detected"
} else {
    Add-Check "api-client" "api.ts" "fail" "API client not found"
    $PhaseReport.issues += @{severity="critical"; msg="API client (lib/api.ts) missing"}
}

# ── 3.7 Types ────────────────────────────────────────────────────
Write-PhaseLog "Checking types..."

$typesDir = "$WU\src\types"
if (Test-Path $typesDir) {
    $typeFiles = Get-ChildItem $typesDir -Filter "*.ts" -Recurse
    Add-Check "types" "type-definitions" "pass" "$($typeFiles.Count) type files"

    $domainFile = "$typesDir\domain.ts"
    if (Test-Path $domainFile) {
        $domainContent = Get-Content $domainFile -Raw
        $typeCount = ([regex]::Matches($domainContent, 'export\s+(type|interface)\s+')).Count
        Add-Check "types" "domain-types" "pass" "$typeCount types/interfaces"
    }
} else {
    Add-Check "types" "type-definitions" "warn" "Types directory not found"
}

# ── 3.8 Build Test ──────────────────────────────────────────────
if ($BuildTest) {
    Write-PhaseLog "Running build test (vite build)..."

    Push-Location $WU
    $buildOutput = & pnpm build 2>&1 | Out-String
    $buildSuccess = $LASTEXITCODE -eq 0

    if ($buildSuccess) {
        Add-Check "build" "vite-build" "pass" "Build succeeded"

        # Check dist output
        $distDir = "$WU\dist"
        if (Test-Path $distDir) {
            $distFiles = Get-ChildItem $distDir -Recurse -File
            $totalSize = ($distFiles | Measure-Object -Property Length -Sum).Sum
            $sizeMB = [math]::Round($totalSize / 1MB, 2)
            Add-Check "build" "dist-output" "pass" "$($distFiles.Count) files, ${sizeMB}MB"

            # Check for JS bundle
            $jsBundle = $distFiles | Where-Object { $_.Extension -eq '.js' } | Sort-Object Length -Descending | Select-Object -First 1
            if ($jsBundle) {
                $bundleSizeKB = [math]::Round($jsBundle.Length / 1KB)
                $status = if ($bundleSizeKB -le 500) { "pass" } elseif ($bundleSizeKB -le 1000) { "warn" } else { "fail" }
                Add-Check "build" "js-bundle-size" $status "${bundleSizeKB}KB"
            }
        }
    } else {
        Add-Check "build" "vite-build" "fail" "Build failed"
        $PhaseReport.issues += @{severity="critical"; msg="Vite build failed"}
        # Extract error lines
        $errorLines = $buildOutput -split "`n" | Where-Object { $_ -match 'error|Error|ERROR' } | Select-Object -First 10
        Add-Check "build" "build-errors" "fail" ($errorLines -join " | ")
    }
    Pop-Location
}

# ── 3.9 TypeScript Check ────────────────────────────────────────
Write-PhaseLog "Checking TypeScript compilation..."
Push-Location $WU
try {
    $tscOut = npx tsc --noEmit 2>&1 | Out-String
    $errorCount = ([regex]::Matches($tscOut, 'error TS\d+')).Count
    if ($errorCount -eq 0) {
        Add-Check "typecheck" "tsc" "pass" "No type errors"
    } else {
        Add-Check "typecheck" "tsc" "warn" "$errorCount TypeScript errors"
        $PhaseReport.issues += @{severity="warning"; msg="$errorCount TS errors in web-user"}
    }
} catch {
    Add-Check "typecheck" "tsc" "skip" "Could not run tsc"
}
Pop-Location

# ── Finalize ────────────────────────────────────────────────────
$passed = ($PhaseReport.checks | Where-Object { $_.status -eq "pass" }).Count
$total  = $PhaseReport.checks.Count
$PhaseReport.completedAt = (Get-Date -Format o)
$PhaseReport.status      = "completed"
$PhaseReport.summary     = "$passed / $total checks passed"
$PhaseReport.passRate    = if ($total -gt 0) { [math]::Round(($passed/$total)*100) } else { 0 }

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportPath = Join-Path $ReportDir "phase3-frontend.json"
$PhaseReport | ConvertTo-Json -Depth 10 | Set-Content $reportPath -Encoding UTF8

Write-PhaseLog "Frontend verification complete. $passed/$total passed ($($PhaseReport.passRate)%)"

return $PhaseReport
