[CmdletBinding()]
param(
    [string]$ProjectRoot = 'C:\xampp\htdocs\projectx\watanybot',
    [string]$AuditEvidenceRoot = '',
    [string]$ApprovedViewerPath = '',
    [string]$ApprovedContractPath = ''
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'Continue'

$script:Version = 'v1.0-apex-theme-comparison-install-decision'
$script:CompleteToken = 'APEX_WATANYBOT_THEME_COMPARISON_INSTALL_DECISION_V1_COMPLETED'
$script:UnverifiedToken = 'APEX_WATANYBOT_THEME_COMPARISON_INSTALL_DECISION_V1_RUNTIME_UNVERIFIED'
$script:BlockedToken = 'APEX_WATANYBOT_THEME_COMPARISON_INSTALL_DECISION_V1_BLOCKED'
$script:ExpectedViewerSHA256 = 'ac52f3985f67fe3ef01161858059f864e525b011d7f40aa9f386833ff0d7df44'
$script:FailureRegister = @(
    'APEX_THEME_DECISION_PROJECT_ROOT_NOT_FOUND_DEFECT',
    'APEX_THEME_DECISION_AUDIT_ROOT_NOT_FOUND_DEFECT',
    'APEX_THEME_DECISION_AUDIT_FINAL_REPORT_NOT_FOUND_DEFECT',
    'APEX_THEME_DECISION_AUDIT_EVIDENCE_INCOMPLETE_DEFECT',
    'APEX_THEME_DECISION_VIEWER_NOT_FOUND_DEFECT',
    'APEX_THEME_DECISION_VIEWER_HASH_MISMATCH_DEFECT',
    'APEX_THEME_DECISION_CONTRACT_NOT_FOUND_DEFECT',
    'APEX_THEME_DECISION_WINDOWS_POWERSHELL_5_1_REQUIRED_DEFECT',
    'APEX_THEME_DECISION_SCRIPT_PARSER_FAILED_DEFECT',
    'APEX_THEME_DECISION_SCRIPT_NON_ASCII_DEFECT',
    'APEX_THEME_DECISION_SCRIPT_BOM_DEFECT',
    'APEX_THEME_DECISION_FILE_CLASSIFICATION_FAILED_DEFECT',
    'APEX_THEME_DECISION_EVIDENCE_MANIFEST_FAILED_DEFECT',
    'APEX_THEME_DECISION_UNHANDLED_EXCEPTION_DEFECT',
    'APEX_THEME_UPGRADE_SCOPE_INVERSION_DEFECT',
    'APEX_FULL_PRODUCT_REBUILD_NOT_AUTHORIZED_DEFECT',
    'APEX_PRESENTATION_REBUILD_WITHOUT_GREEN_BASELINE_PROHIBITED_DEFECT'
)

function Write-Utf8NoBomText {
    param([Parameter(Mandatory = $true)][string]$Path,[Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [System.IO.File]::WriteAllText($Path,$Text,(New-Object System.Text.UTF8Encoding($false)))
}

function Write-AsciiLines {
    param([Parameter(Mandatory = $true)][string]$Path,[Parameter(Mandatory = $true)][AllowEmptyCollection()][AllowEmptyString()][string[]]$Lines)
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [System.IO.File]::WriteAllLines($Path,[string[]]@($Lines),[System.Text.Encoding]::ASCII)
}

function Write-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path,[Parameter(Mandatory = $true)]$Value,[int]$Depth = 100)
    Write-Utf8NoBomText -Path $Path -Text (($Value | ConvertTo-Json -Depth $Depth) + [Environment]::NewLine)
}

function Get-ApexSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    $stream = $null
    $sha = $null
    try {
        $stream = [System.IO.File]::Open($Path,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::Read)
        $sha = [System.Security.Cryptography.SHA256]::Create()
        return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()
    }
    finally {
        if ($sha) { $sha.Dispose() }
        if ($stream) { $stream.Dispose() }
    }
}

function Test-AsciiNoBom {
    param([Parameter(Mandatory = $true)][string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $nonAscii = 0
    foreach ($byte in $bytes) { if ($byte -gt 127) { $nonAscii++ } }
    return [pscustomobject]@{ NonAsciiByteCount = $nonAscii; Utf8Bom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) }
}

function Test-PowerShellParser {
    param([Parameter(Mandatory = $true)][string]$Path)
    $tokens = $null
    $errors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors)
    return [pscustomobject]@{ ErrorCount = @($errors).Count; Errors = @($errors | ForEach-Object { [pscustomobject]@{ Message = $_.Message; Line = $_.Extent.StartLineNumber } }); GatePass = (@($errors).Count -eq 0) }
}

function Get-RelativePathSafe {
    param([Parameter(Mandatory = $true)][string]$Root,[Parameter(Mandatory = $true)][string]$Path)
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $pathFull = [System.IO.Path]::GetFullPath($Path)
    if ($pathFull.StartsWith($rootFull,[System.StringComparison]::OrdinalIgnoreCase)) { return $pathFull.Substring($rootFull.Length) }
    return $pathFull
}

function Resolve-FailureClass {
    param([Parameter(Mandatory = $true)][Exception]$Exception)
    if ([string]$Exception.Message -match '^(APEX_[A-Z0-9_]+)') { return [string]$Matches[1] }
    return 'APEX_THEME_DECISION_UNHANDLED_EXCEPTION_DEFECT'
}

$startedUtc = [DateTime]::UtcNow
$runRoot = ''
$finalStatus = 'BLOCKED'
$finalToken = $script:BlockedToken
$finalExitCode = 97
$failureClass = ''
$failureMessage = ''
$executionMode = 'BLOCKED'
$currentPhase = 'INITIALIZATION'

try {
    $selfPath = [System.IO.Path]::GetFullPath($MyInvocation.MyCommand.Path)
    $ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
    if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) { throw 'APEX_THEME_DECISION_PROJECT_ROOT_NOT_FOUND_DEFECT' }
    if ([string]::IsNullOrWhiteSpace($AuditEvidenceRoot)) {
        $AuditEvidenceRoot = [string](
            Get-ChildItem -LiteralPath (Join-Path $ProjectRoot '.pma\audits\apex-watanybot-current-state-theme-strategy-v1') -Directory -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1 -ExpandProperty FullName
        )
    }
    if ([string]::IsNullOrWhiteSpace($AuditEvidenceRoot) -or -not (Test-Path -LiteralPath $AuditEvidenceRoot -PathType Container)) { throw 'APEX_THEME_DECISION_AUDIT_ROOT_NOT_FOUND_DEFECT' }
    $AuditEvidenceRoot = [System.IO.Path]::GetFullPath($AuditEvidenceRoot)
    $auditFinalPath = Join-Path $AuditEvidenceRoot 'FINAL_REPORT.json'
    if (-not (Test-Path -LiteralPath $auditFinalPath -PathType Leaf)) { throw 'APEX_THEME_DECISION_AUDIT_FINAL_REPORT_NOT_FOUND_DEFECT' }
    if ([string]::IsNullOrWhiteSpace($ApprovedViewerPath)) { $ApprovedViewerPath = Join-Path $env:USERPROFILE 'Downloads\WATANYBOT_SOURCE_OF_TRUTH_UI_VIEWER_V4_FULL_FEATURE_REGISTRY.html' }
    if ([string]::IsNullOrWhiteSpace($ApprovedContractPath)) { $ApprovedContractPath = Join-Path $env:USERPROFILE 'Downloads\WATANYBOT_APPROVED_THEME_V4_CONTRACT.json' }
    if (-not (Test-Path -LiteralPath $ApprovedViewerPath -PathType Leaf)) { throw 'APEX_THEME_DECISION_VIEWER_NOT_FOUND_DEFECT' }
    if (-not (Test-Path -LiteralPath $ApprovedContractPath -PathType Leaf)) { throw 'APEX_THEME_DECISION_CONTRACT_NOT_FOUND_DEFECT' }
    if ((Get-ApexSha256 -Path $ApprovedViewerPath) -ne $script:ExpectedViewerSHA256) { throw 'APEX_THEME_DECISION_VIEWER_HASH_MISMATCH_DEFECT' }
    $timestamp = [DateTime]::Now.ToString('yyyyMMdd-HHmmss')
    $runRoot = Join-Path $ProjectRoot ('.pma\audits\apex-watanybot-theme-comparison-install-decision-v1\' + $timestamp)
    New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

    $currentPhase = 'PREFLIGHT'
    Write-Progress -Activity 'APEX WatanyBot theme comparison and install decision' -Status $currentPhase -PercentComplete 5
    $parser = Test-PowerShellParser -Path $selfPath
    $ascii = Test-AsciiNoBom -Path $selfPath
    $auditFinal = Get-Content -Raw -LiteralPath $auditFinalPath | ConvertFrom-Json
    $requiredAuditFiles = @(
        '03_SOURCE_INVENTORY.json','04_ROUTE_FEATURE_MATRIX.json','05_THEME_OWNER_MAP.json',
        '06_CURRENT_THEME_SIGNATURE.json','07_APPROVED_THEME_SIGNATURE.json',
        '08_BASELINE_AUTHORITY.json','09_VALIDATION_RESULTS.json','10_STRATEGY_SCORECARD.json'
    )
    $missingAuditFiles = @($requiredAuditFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $AuditEvidenceRoot $_) -PathType Leaf) })
    $preflight = [ordered]@{
        ScriptVersion = $script:Version
        ScriptPath = $selfPath
        ScriptSHA256 = Get-ApexSha256 -Path $selfPath
        PowerShellVersion = $PSVersionTable.PSVersion.ToString()
        ParserErrorCount = $parser.ErrorCount
        ParserErrors = $parser.Errors
        NonAsciiByteCount = $ascii.NonAsciiByteCount
        Utf8Bom = $ascii.Utf8Bom
        ProjectRoot = $ProjectRoot
        AuditEvidenceRoot = $AuditEvidenceRoot
        AuditFinalSHA256 = Get-ApexSha256 -Path $auditFinalPath
        MissingAuditFiles = $missingAuditFiles
        ApprovedViewerSHA256 = Get-ApexSha256 -Path $ApprovedViewerPath
        GatePass = ($PSVersionTable.PSVersion.Major -eq 5 -and $PSVersionTable.PSVersion.Minor -eq 1 -and $parser.GatePass -and $ascii.NonAsciiByteCount -eq 0 -and -not $ascii.Utf8Bom -and @($missingAuditFiles).Count -eq 0)
    }
    Write-JsonFile -Path (Join-Path $runRoot '00_PREFLIGHT.json') -Value $preflight
    Write-JsonFile -Path (Join-Path $runRoot '01_FAILURE_AND_REGRESSION_REGISTER.json') -Value ([ordered]@{ ScriptVersion = $script:Version; FailureClasses = $script:FailureRegister })
    if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) { throw 'APEX_THEME_DECISION_WINDOWS_POWERSHELL_5_1_REQUIRED_DEFECT' }
    if (-not $parser.GatePass) { throw 'APEX_THEME_DECISION_SCRIPT_PARSER_FAILED_DEFECT' }
    if ($ascii.NonAsciiByteCount -ne 0) { throw 'APEX_THEME_DECISION_SCRIPT_NON_ASCII_DEFECT' }
    if ($ascii.Utf8Bom) { throw 'APEX_THEME_DECISION_SCRIPT_BOM_DEFECT' }
    if (@($missingAuditFiles).Count -ne 0) { throw 'APEX_THEME_DECISION_AUDIT_EVIDENCE_INCOMPLETE_DEFECT' }

    $currentPhase = 'EVIDENCE_BINDING'
    Write-Progress -Activity 'APEX WatanyBot theme comparison and install decision' -Status $currentPhase -PercentComplete 15
    $sourceInventory = Get-Content -Raw -LiteralPath (Join-Path $AuditEvidenceRoot '03_SOURCE_INVENTORY.json') | ConvertFrom-Json
    $routeFeature = Get-Content -Raw -LiteralPath (Join-Path $AuditEvidenceRoot '04_ROUTE_FEATURE_MATRIX.json') | ConvertFrom-Json
    $ownerMap = Get-Content -Raw -LiteralPath (Join-Path $AuditEvidenceRoot '05_THEME_OWNER_MAP.json') | ConvertFrom-Json
    $currentTheme = Get-Content -Raw -LiteralPath (Join-Path $AuditEvidenceRoot '06_CURRENT_THEME_SIGNATURE.json') | ConvertFrom-Json
    $approvedTheme = Get-Content -Raw -LiteralPath (Join-Path $AuditEvidenceRoot '07_APPROVED_THEME_SIGNATURE.json') | ConvertFrom-Json
    $baseline = Get-Content -Raw -LiteralPath (Join-Path $AuditEvidenceRoot '08_BASELINE_AUTHORITY.json') | ConvertFrom-Json
    $validation = Get-Content -Raw -LiteralPath (Join-Path $AuditEvidenceRoot '09_VALIDATION_RESULTS.json') | ConvertFrom-Json
    $scorecard = Get-Content -Raw -LiteralPath (Join-Path $AuditEvidenceRoot '10_STRATEGY_SCORECARD.json') | ConvertFrom-Json
    $binding = [ordered]@{
        AuditEvidenceRoot = $AuditEvidenceRoot
        AuditFinalStatus = $auditFinal.FinalStatus
        AuditFinalToken = $auditFinal.FinalToken
        AuditExitCode = $auditFinal.ExitCode
        RuntimeEvidenceComplete = [bool]$auditFinal.RuntimeEvidenceComplete
        AuditRecommendedStrategy = $scorecard.RecommendedStrategy
        Scorecard = $scorecard
        ApprovedViewerSHA256 = $script:ExpectedViewerSHA256
        GatePass = $true
    }
    Write-JsonFile -Path (Join-Path $runRoot '02_AUDIT_EVIDENCE_BINDING.json') -Value $binding -Depth 80

    $currentPhase = 'FILE_CLASSIFICATION'
    Write-Progress -Activity 'APEX WatanyBot theme comparison and install decision' -Status $currentPhase -PercentComplete 30
    $webRoot = Join-Path $ProjectRoot 'apps\web-user'
    $srcRoot = Join-Path $webRoot 'src'
    $approvedColors = @($approvedTheme.ApprovedColors)
    $keywords = @('welcome','login','topbar','ticker','feature-icon','listing','chat','popup','form-viewer','salary','sticky','drawer','menu')
    $activePaths = @($ownerMap.ActiveCssImports | ForEach-Object { [string]$_.ResolvedPath })
    $cssRows = @()
    foreach ($css in @(Get-ChildItem -LiteralPath $srcRoot -Recurse -File -ErrorAction Stop | Where-Object { $_.Extension -match '^\.(css|scss)$' -and $_.Length -le 2097152 })) {
        $text = [System.IO.File]::ReadAllText($css.FullName)
        $lower = $text.ToLowerInvariant()
        $colors = @([regex]::Matches($text,'(?i)#[0-9a-f]{6}') | ForEach-Object { $_.Value.ToLowerInvariant() } | Select-Object -Unique)
        $colorMatch = @($colors | Where-Object { $_ -in $approvedColors }).Count
        $keywordMatch = @($keywords | Where-Object { $lower.IndexOf($_) -ge 0 }).Count
        $colorPercent = $(if (@($approvedColors).Count -gt 0) { [math]::Round(100 * $colorMatch / @($approvedColors).Count,2) } else { 0 })
        $keywordPercent = [math]::Round(100 * $keywordMatch / @($keywords).Count,2)
        $similarity = [math]::Round(0.55 * $colorPercent + 0.45 * $keywordPercent,2)
        $active = $css.FullName -in $activePaths
        $duplicateName = ($css.Name -match '(?i)(approved|clean|final|forceclone|raster|visualclone|v3|v4|recovery)')
        if ($active -and $similarity -ge 65) { $classification = 'PATCH_IN_PLACE' }
        elseif ($active) { $classification = 'REPLACE_PRESENTATION_LAYER_KEEP_FUNCTIONAL_OWNER' }
        elseif ($similarity -ge 50) { $classification = 'SALVAGE_TOKENS_AND_COMPONENT_STYLES' }
        elseif ($duplicateName) { $classification = 'QUARANTINE_DUPLICATE_VISUAL_VARIANT' }
        else { $classification = 'KEEP_UNTIL_ROUTE_OWNER_REVIEW' }
        $cssRows += [pscustomobject]@{
            RelativePath = Get-RelativePathSafe -Root $ProjectRoot -Path $css.FullName
            SHA256 = Get-ApexSha256 -Path $css.FullName
            ActiveImport = $active
            ApprovedColorMatchPercent = $colorPercent
            RequiredKeywordMatchPercent = $keywordPercent
            SimilarityScore = $similarity
            Classification = $classification
        }
    }
    $routeOwnerPaths = @()
    foreach ($row in @($routeFeature.RouteRows)) { $routeOwnerPaths += @($row.SourceMatches) }
    foreach ($row in @($routeFeature.FeatureRows)) { $routeOwnerPaths += @($row.SourceMatches) }
    $routeOwnerPaths = @($routeOwnerPaths | Select-Object -Unique)
    $componentRows = @()
    foreach ($file in @(Get-ChildItem -LiteralPath $srcRoot -Recurse -File -ErrorAction Stop | Where-Object { $_.Extension -match '^\.(ts|tsx|js|jsx)$' -and $_.Length -le 2097152 })) {
        $relative = Get-RelativePathSafe -Root $ProjectRoot -Path $file.FullName
        $isOwner = $relative -in $routeOwnerPaths
        $text = [System.IO.File]::ReadAllText($file.FullName)
        $lower = $text.ToLowerInvariant()
        $visualTerms = @('className','style','theme','shell','layout','icon','topbar','ticker')
        $businessTerms = @('fetch(','axios','salary','pension','auth','permission','role','api/','mutation','query')
        $visualCount = @($visualTerms | Where-Object { $text.IndexOf($_,[System.StringComparison]::OrdinalIgnoreCase) -ge 0 }).Count
        $businessCount = @($businessTerms | Where-Object { $lower.IndexOf($_) -ge 0 }).Count
        $duplicateName = ($file.Name -match '(?i)(approved|clean|final|forceclone|raster|visualclone|v3|v4|recovery)' -and $file.Name -match '(?i)(home|shell|layout|chrome|launcher|theme)')
        if ($isOwner -and $businessCount -gt 0) { $classification = 'KEEP_FUNCTIONAL_OWNER_APPLY_THEME_ADAPTER' }
        elseif ($isOwner) { $classification = 'KEEP_ROUTE_OWNER_PATCH_PRESENTATION' }
        elseif ($duplicateName) { $classification = 'QUARANTINE_DUPLICATE_VISUAL_VARIANT' }
        elseif ($visualCount -gt 0 -and $businessCount -gt 0) { $classification = 'MIXED_EXTRACT_VISUAL_ONLY' }
        elseif ($visualCount -gt 0) { $classification = 'SALVAGE_VISUAL_COMPONENT' }
        else { continue }
        $componentRows += [pscustomobject]@{
            RelativePath = $relative
            SHA256 = Get-ApexSha256 -Path $file.FullName
            RouteOrFeatureOwner = $isOwner
            VisualTermCount = $visualCount
            BusinessTermCount = $businessCount
            Classification = $classification
        }
    }
    $ledger = [ordered]@{
        CssRows = $cssRows
        ComponentRows = $componentRows
        CssClassificationCounts = @($cssRows | Group-Object Classification | ForEach-Object { [pscustomobject]@{ Classification = $_.Name; Count = $_.Count } })
        ComponentClassificationCounts = @($componentRows | Group-Object Classification | ForEach-Object { [pscustomobject]@{ Classification = $_.Name; Count = $_.Count } })
        FullProductRebuildAuthorized = $false
        GatePass = $true
    }
    Write-JsonFile -Path (Join-Path $runRoot '03_THEME_FILE_SALVAGE_LEDGER.json') -Value $ledger -Depth 100

    $currentPhase = 'STRATEGY_DECISION'
    Write-Progress -Activity 'APEX WatanyBot theme comparison and install decision' -Status $currentPhase -PercentComplete 65
    $auditStrategy = [string]$scorecard.RecommendedStrategy
    $baselineAvailable = [bool]$baseline.AuthoritativeGreenBaselineFound
    $runtimeComplete = [bool]$auditFinal.RuntimeEvidenceComplete
    $patchableCssCount = @($cssRows | Where-Object { $_.Classification -eq 'PATCH_IN_PLACE' }).Count
    $replaceCssCount = @($cssRows | Where-Object { $_.Classification -eq 'REPLACE_PRESENTATION_LAYER_KEEP_FUNCTIONAL_OWNER' }).Count
    $duplicateCount = @($cssRows | Where-Object { $_.Classification -eq 'QUARANTINE_DUPLICATE_VISUAL_VARIANT' }).Count + @($componentRows | Where-Object { $_.Classification -eq 'QUARANTINE_DUPLICATE_VISUAL_VARIANT' }).Count
    switch ($auditStrategy) {
        'PATCH_IN_PLACE' { $executionMode = 'PATCH_CURRENT_PRESENTATION_IN_PLACE' }
        'CONTROLLED_THEME_OVERLAY_ON_CURRENT_FUNCTIONAL_OWNERS' { $executionMode = 'INSTALL_APPROVED_THEME_OVERLAY_ON_CURRENT_FUNCTIONAL_OWNERS' }
        'BASELINE_PLUS_VISUAL_SALVAGE' { $executionMode = 'RESTORE_GREEN_BASELINE_AND_PORT_SALVAGED_THEME' }
        'CLEAN_PRESENTATION_REBUILD_ON_GREEN_BASELINE' { $executionMode = 'INSTALL_PRESENTATION_FROM_SCRATCH_ON_GREEN_BASELINE' }
        default { $executionMode = 'BLOCKED_REQUIRE_BASELINE_OR_RUNTIME_AUTHORITY' }
    }
    if ($executionMode -like 'INSTALL_PRESENTATION_FROM_SCRATCH*' -and -not $baselineAvailable) { throw 'APEX_PRESENTATION_REBUILD_WITHOUT_GREEN_BASELINE_PROHIBITED_DEFECT' }
    $decision = [ordered]@{
        AuditRecommendedStrategy = $auditStrategy
        FinalExecutionMode = $executionMode
        RuntimeEvidenceComplete = $runtimeComplete
        FunctionalScore = $scorecard.FunctionalScore
        ThemeConformanceScore = $scorecard.ThemeConformanceScore
        FragmentationScore = $scorecard.FragmentationScore
        BaselineAuthorityAvailable = $baselineAvailable
        PatchableActiveCssCount = $patchableCssCount
        ReplaceActiveCssCount = $replaceCssCount
        QuarantineDuplicateCount = $duplicateCount
        FullProductRebuildAuthorized = $false
        InstallFromScratchMeaning = 'PRESENTATION_LAYER_ONLY_ON_GREEN_FUNCTIONAL_BASELINE'
        FunctionalLogicSource = 'LAST_KNOWN_GREEN_OR_CURRENT_PROVEN_FUNCTIONAL_OWNERS'
        VisualSource = 'APPROVED_V4_VIEWER_AND_SALVAGED_CURRENT_THEME_ASSETS'
        GatePass = $true
    }
    Write-JsonFile -Path (Join-Path $runRoot '04_FINAL_STRATEGY_DECISION.json') -Value $decision -Depth 80

    $currentPhase = 'IMPLEMENTATION_PLAN'
    Write-Progress -Activity 'APEX WatanyBot theme comparison and install decision' -Status $currentPhase -PercentComplete 82
    $waves = @(
        [pscustomobject]@{ Wave = 0; Name = 'Freeze and backup'; Action = 'Freeze current source, audit evidence, selected green baseline, V4 viewer, and all files in the salvage ledger.'; RequiredGate = 'Exact SHA-256 and rollback manifest.' },
        [pscustomobject]@{ Wave = 1; Name = 'Functional authority'; Action = 'Keep or restore route, API, permission, salary, form, and feature owners. Do not redesign business logic.'; RequiredGate = 'Route and feature set equality.' },
        [pscustomobject]@{ Wave = 2; Name = 'Theme foundation'; Action = 'Install one token source, one icon registry, smartphone shell, typography, spacing, and palette.'; RequiredGate = 'No duplicate active theme owner.' },
        [pscustomobject]@{ Wave = 3; Name = 'Primary surfaces'; Action = 'Apply approved welcome, login visitor CTA, homepage icons-only grid, topbar ticker, menus, and hybrid chat.'; RequiredGate = '390, 430, and 1440 browser geometry.' },
        [pscustomobject]@{ Wave = 4; Name = 'Feature surfaces'; Action = 'Standardize listings, feature landing pages, popups, form viewer frame and controls, and salary presentation.'; RequiredGate = 'Interaction and business-logic preservation.' },
        [pscustomobject]@{ Wave = 5; Name = 'Quarantine'; Action = 'Remove duplicate visual variants from active imports without deleting evidence or backups.'; RequiredGate = 'Active owner map has one owner per surface.' },
        [pscustomobject]@{ Wave = 6; Name = 'Release validation'; Action = 'Run targeted tests, full tests, typecheck, build, multi-viewport browser proof, runtime cleanup, and deployment artifact proof.'; RequiredGate = 'Exact final success contract.' }
    )
    $plan = [ordered]@{
        ExecutionMode = $executionMode
        Waves = $waves
        FilesToPatch = @($cssRows | Where-Object { $_.Classification -eq 'PATCH_IN_PLACE' } | Select-Object -ExpandProperty RelativePath)
        FilesToReplacePresentationOnly = @($cssRows | Where-Object { $_.Classification -eq 'REPLACE_PRESENTATION_LAYER_KEEP_FUNCTIONAL_OWNER' } | Select-Object -ExpandProperty RelativePath)
        FilesToSalvage = @($cssRows | Where-Object { $_.Classification -eq 'SALVAGE_TOKENS_AND_COMPONENT_STYLES' } | Select-Object -ExpandProperty RelativePath) + @($componentRows | Where-Object { $_.Classification -eq 'SALVAGE_VISUAL_COMPONENT' } | Select-Object -ExpandProperty RelativePath)
        FunctionalOwnersToPreserve = @($componentRows | Where-Object { $_.Classification -like 'KEEP_*' } | Select-Object -ExpandProperty RelativePath)
        MixedFilesToExtractVisualOnly = @($componentRows | Where-Object { $_.Classification -eq 'MIXED_EXTRACT_VISUAL_ONLY' } | Select-Object -ExpandProperty RelativePath)
        FilesToQuarantine = @($cssRows | Where-Object { $_.Classification -eq 'QUARANTINE_DUPLICATE_VISUAL_VARIANT' } | Select-Object -ExpandProperty RelativePath) + @($componentRows | Where-Object { $_.Classification -eq 'QUARANTINE_DUPLICATE_VISUAL_VARIANT' } | Select-Object -ExpandProperty RelativePath)
        FullProductRebuildAuthorized = $false
        GatePass = $true
    }
    Write-JsonFile -Path (Join-Path $runRoot '05_THEME_IMPLEMENTATION_PLAN.json') -Value $plan -Depth 100

    $md = @(
        '# WatanyBot Theme Comparison and Installation Decision',
        '',
        ('Audit evidence root: ' + $AuditEvidenceRoot),
        ('Decision evidence root: ' + $runRoot),
        ('Approved viewer SHA-256: ' + $script:ExpectedViewerSHA256),
        ('Execution mode: ' + $executionMode),
        ('Functional score: ' + [string]$scorecard.FunctionalScore),
        ('Theme conformance score: ' + [string]$scorecard.ThemeConformanceScore),
        ('Fragmentation score: ' + [string]$scorecard.FragmentationScore),
        ('Green baseline available: ' + [string]$baselineAvailable),
        ('Runtime evidence complete: ' + [string]$runtimeComplete),
        '',
        'Decision boundary:',
        '- Full product rebuild is prohibited.',
        '- Patch current presentation when functional owners are healthy and theme fragmentation is bounded.',
        '- Install the approved overlay when logic is healthy but visual conformance is low.',
        '- Restore the green baseline and port salvaged visual work when current functionality is damaged.',
        '- Install from scratch only for the presentation layer and only on the authoritative green baseline.',
        '',
        'The JSON implementation plan and salvage ledger contain the exact file classifications and waves.'
    )
    Write-AsciiLines -Path (Join-Path $runRoot '06_THEME_IMPLEMENTATION_PLAN.md') -Lines $md

    if ($runtimeComplete) {
        $finalStatus = 'DECISION_COMPLETE'
        $finalToken = $script:CompleteToken
        $finalExitCode = 0
    }
    else {
        $finalStatus = 'DECISION_COMPLETE_RUNTIME_UNVERIFIED'
        $finalToken = $script:UnverifiedToken
        $finalExitCode = 2
    }
}
catch {
    $failureClass = Resolve-FailureClass -Exception $_.Exception
    $failureMessage = [string]$_.Exception.Message
    if ($runRoot) {
        Write-JsonFile -Path (Join-Path $runRoot 'UNHANDLED_EXCEPTION_DETAIL.json') -Value ([ordered]@{
            ExceptionType = $_.Exception.GetType().FullName
            ExceptionMessage = $_.Exception.Message
            FullyQualifiedErrorId = $_.FullyQualifiedErrorId
            CategoryInfo = [string]$_.CategoryInfo
            ScriptStackTrace = $_.ScriptStackTrace
            CurrentPhase = $currentPhase
        })
    }
}
finally {
    if ($runRoot) {
        $finalReport = [ordered]@{
            ScriptVersion = $script:Version
            ProjectRoot = $ProjectRoot
            AuditEvidenceRoot = $AuditEvidenceRoot
            EvidenceRoot = $runRoot
            StartedUtc = $startedUtc.ToString('o')
            EndedUtc = [DateTime]::UtcNow.ToString('o')
            FinalStatus = $finalStatus
            ExitCode = $finalExitCode
            FinalToken = $finalToken
            FailureClass = $failureClass
            FailureMessage = $failureMessage
            LastPhase = $currentPhase
            ExecutionMode = $executionMode
            FullProductRebuildAuthorized = $false
            SourceMutationPerformed = $false
            GitMutationPerformed = $false
        }
        Write-JsonFile -Path (Join-Path $runRoot 'FINAL_REPORT.json') -Value $finalReport -Depth 60
        Write-AsciiLines -Path (Join-Path $runRoot 'FINAL.marker') -Lines @($finalToken)
        try {
            $manifestRows = @()
            foreach ($file in @(Get-ChildItem -LiteralPath $runRoot -Recurse -File -ErrorAction Stop | Where-Object { $_.Name -ne 'SHA256SUMS.json' })) {
                $manifestRows += [pscustomobject]@{ RelativePath = Get-RelativePathSafe -Root $runRoot -Path $file.FullName; SizeBytes = $file.Length; SHA256 = Get-ApexSha256 -Path $file.FullName }
            }
            Write-JsonFile -Path (Join-Path $runRoot 'SHA256SUMS.json') -Value ([ordered]@{ Rows = $manifestRows; EntryCount = @($manifestRows).Count; GatePass = $true }) -Depth 100
        }
        catch {
            $failureClass = 'APEX_THEME_DECISION_EVIDENCE_MANIFEST_FAILED_DEFECT'
            $failureMessage = $_.Exception.Message
            $finalStatus = 'BLOCKED'
            $finalToken = $script:BlockedToken
            $finalExitCode = 97
            $finalReport.FinalStatus = $finalStatus
            $finalReport.ExitCode = $finalExitCode
            $finalReport.FinalToken = $finalToken
            $finalReport.FailureClass = $failureClass
            $finalReport.FailureMessage = $failureMessage
            Write-JsonFile -Path (Join-Path $runRoot 'FINAL_REPORT.json') -Value $finalReport -Depth 60
            Write-AsciiLines -Path (Join-Path $runRoot 'FINAL.marker') -Lines @($finalToken)
        }
    }
    Write-Host ('FINAL_STATUS=' + $finalStatus)
    Write-Host ('EXIT_CODE=' + [string]$finalExitCode)
    Write-Host ('FINAL_TOKEN=' + $finalToken)
    Write-Host ('FAILURE_CLASS=' + $failureClass)
    Write-Host ('EXECUTION_MODE=' + $executionMode)
    Write-Host ('EVIDENCE_ROOT=' + $runRoot)
}

exit $finalExitCode
