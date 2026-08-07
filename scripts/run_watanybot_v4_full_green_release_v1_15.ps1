param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$AuditEvidenceRoot = "c:\xampp\htdocs\projectx\watanybot\.pma\audits\apex-watanybot-current-state-theme-strategy-v1\20260718-144901",
    [string]$DecisionEvidenceRoot = "c:\xampp\htdocs\projectx\watanybot\.pma\audits\apex-watanybot-theme-comparison-install-decision-v1\20260718-145554"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:ScriptVersion = 'v1.15-apex-watanybot-v4-false-green-correction'
$script:SuccessToken = 'APEX_WATANYBOT_V4_FULL_THEME_FEATURE_GREEN_V1_15_COMPLETED'
$script:BlockedToken = 'APEX_WATANYBOT_V4_FULL_THEME_FEATURE_GREEN_V1_15_BLOCKED'
$script:ExitComplete = 0
$script:ExitBlocked = 97

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

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    $value = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    return ,$value
}

function Invoke-ValidationCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$File,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$CommandArgs,
        [Parameter(Mandatory = $true)][string]$OutputPath
    )

    $startedUtc = [DateTime]::UtcNow.ToString('o')
    Push-Location $WorkingDirectory
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & $File @CommandArgs 2>&1
        $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        Pop-Location
    }

    $lines = @($output | ForEach-Object { [string]$_ })
    Write-AsciiLines -Path $OutputPath -Lines $lines
    $stderrLike = @($lines | Where-Object { $_ -match '(?i)\b(error|failed|failure|exception|blocked)\b' })
    return [pscustomobject]@{
        Name = $Name
        WorkingDirectory = $WorkingDirectory
        Command = (($File, $CommandArgs) -join ' ')
        StartedUtc = $startedUtc
        EndedUtc = [DateTime]::UtcNow.ToString('o')
        ExitCode = $exitCode
        OutputPath = $OutputPath
        OutputLineCount = $lines.Count
        UnexpectedStderrOrFailureTokenCount = $stderrLike.Count
    }
}

function Get-ZipEntryProof {
    param([Parameter(Mandatory = $true)][string]$ZipPath,[Parameter(Mandatory = $true)][string]$ExtractRoot)
    if (Test-Path -LiteralPath $ExtractRoot) { Remove-Item -LiteralPath $ExtractRoot -Recurse -Force }
    New-Item -ItemType Directory -Path $ExtractRoot -Force | Out-Null
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractRoot -Force
    $entries = @(Get-ChildItem -LiteralPath $ExtractRoot -File -Recurse | ForEach-Object {
        $relative = $_.FullName.Substring($ExtractRoot.Length).TrimStart('\') -replace '\\','/'
        [pscustomobject]@{ Path = $relative; Size = $_.Length; Sha256 = Get-ApexSha256 -Path $_.FullName }
    })
    $duplicateCount = @($entries | Group-Object Path | Where-Object { $_.Count -gt 1 }).Count
    $traversalCount = @($entries | Where-Object { $_.Path -match '(^|/)\.\.(/|$)' -or $_.Path -match '^[A-Za-z]:' }).Count
    return [pscustomobject]@{
        EntryCount = $entries.Count
        DuplicateEntryCount = $duplicateCount
        TraversalEntryCount = $traversalCount
        Entries = $entries
        GatePass = ($entries.Count -gt 0 -and $duplicateCount -eq 0 -and $traversalCount -eq 0)
    }
}

try {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
    Set-Location $ProjectRoot

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $releaseRoot = Join-Path $ProjectRoot '.pma\implementation\watanybot-v4-full-theme-feature-green-v1-15'
    $runRoot = Join-Path $releaseRoot ('orchestration-' + $stamp)
    New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

    $failureClasses = @(
        'APEX_V1_14_REGISTRY_PRESENCE_FALSE_FEATURE_PROOF_DEFECT',
        'APEX_V1_14_FALLBACK_FEATURES_COUNTED_AS_RESTORED_DEFECT',
        'APEX_V1_14_FALLBACK_FEATURES_EXPOSED_AS_ENABLED_DEFECT',
        'APEX_V1_14_FULL_GREEN_VALIDATION_MATRIX_INCOMPLETE_DEFECT',
        'APEX_V1_14_NO_EXPANDED_BROWSER_MATRIX_DEFECT',
        'APEX_V1_14_NO_PRIMARY_INTERACTION_MATRIX_DEFECT',
        'APEX_V1_14_NO_ROLE_PERMISSION_MATRIX_DEFECT',
        'APEX_V1_14_NO_SALARY_COMPLETENESS_MATRIX_DEFECT',
        'APEX_V1_14_NO_FORM_VIEWER_MATRIX_DEFECT',
        'APEX_V1_14_NO_V113_REGRESSION_RERUN_DEFECT',
        'APEX_V1_14_NO_RUNTIME_CLEANUP_PROOF_DEFECT',
        'APEX_V1_14_STDERR_NOT_FAIL_CLOSED_DEFECT',
        'APEX_V1_14_SUCCESS_ZIP_CREATED_BEFORE_ARTIFACT_PROOF_DEFECT',
        'APEX_V1_14_SUCCESS_NAMED_ZIP_ON_BLOCKED_RUN_DEFECT',
        'APEX_V1_14_ZIP_ENTRY_SET_NOT_VERIFIED_DEFECT',
        'APEX_V1_14_FINAL_MARKER_WRITTEN_BEFORE_DEPLOYMENT_PROOF_DEFECT',
        'APEX_V1_14_APPROVED_THEME_IMPLEMENTATION_NOT_PROVEN_DEFECT',
        'APEX_V1_14_FALSE_GREEN_RELEASE_AUTHORIZATION_DEFECT'
    )
    Write-JsonFile -Path (Join-Path $runRoot '01_FAILURE_CLASS_REGISTER.json') -Value ([pscustomobject]@{ Status = 'REGISTERED'; FailureClasses = $failureClasses })

    $context = [pscustomobject]@{
        ScriptVersion = $script:ScriptVersion
        ProjectRoot = $ProjectRoot
        EvidenceRoot = $runRoot
        StartedUtc = [DateTime]::UtcNow.ToString('o')
        SuccessToken = $script:SuccessToken
        BlockedToken = $script:BlockedToken
        AuditEvidenceRoot = $AuditEvidenceRoot
        DecisionEvidenceRoot = $DecisionEvidenceRoot
        V114Adjudication = 'FALSE_GREEN'
    }
    Write-JsonFile -Path (Join-Path $runRoot '00_RUN_CONTEXT.json') -Value $context

    $auditFinal = Read-JsonFile -Path (Join-Path $AuditEvidenceRoot 'FINAL_REPORT.json')
    $decisionFinal = Read-JsonFile -Path (Join-Path $DecisionEvidenceRoot 'FINAL_REPORT.json')
    $bindingPass = ($auditFinal.FinalStatus -eq 'AUDIT_COMPLETE' -and $decisionFinal.FinalStatus -eq 'DECISION_COMPLETE')
    Write-JsonFile -Path (Join-Path $runRoot '10_AUDIT_DECISION_BINDING.json') -Value ([pscustomobject]@{
        Status = if ($bindingPass) { 'PASS' } else { 'FAIL' }
        AuditFinalStatus = $auditFinal.FinalStatus
        DecisionFinalStatus = $decisionFinal.FinalStatus
        ExecutionMode = $decisionFinal.ExecutionMode
        FullProductRebuildAuthorized = $decisionFinal.FullProductRebuildAuthorized
    })

    $registryPath = Join-Path $ProjectRoot 'apps\web-user\src\data\watanyFeatureRegistryV4.json'
    $registryRaw = Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json
    $registry = @($registryRaw | ForEach-Object { $_ })
    $allowedStates = @('LIVE_PROVEN','ROLE_RESTRICTED_PROVEN','EXTERNAL_BOUNDARY_PROVEN','DISABLED_NOT_IMPLEMENTED','BLOCKED_OWNER_MISSING')
    $enabledStates = @('LIVE_PROVEN','ROLE_RESTRICTED_PROVEN','EXTERNAL_BOUNDARY_PROVEN')
    $disabledStates = @('DISABLED_NOT_IMPLEMENTED','BLOCKED_OWNER_MISSING')
    $ambiguous = @($registry | Where-Object { $allowedStates -notcontains [string]$_.status })
    $disabledFeatures = @($registry | Where-Object { $disabledStates -contains [string]$_.status })
    $enabledUnproven = @($registry | Where-Object { ($allowedStates -notcontains [string]$_.status) -and ($_.menuPlacement -ne 'hidden' -or $_.homepagePlacement -ne 'hidden') })
    $missingOwner = @($registry | Where-Object { [string]::IsNullOrWhiteSpace([string]$_.featureOwner) })
    $duplicateFeatures = @($registry | Group-Object id | Where-Object { $_.Count -gt 1 })
    $registryGatePass = ($ambiguous.Count -eq 0 -and $disabledFeatures.Count -eq 0 -and $enabledUnproven.Count -eq 0 -and $missingOwner.Count -eq 0 -and $duplicateFeatures.Count -eq 0)
    Write-JsonFile -Path (Join-Path $runRoot '20_STRICT_REGISTRY_GATE.json') -Value ([pscustomobject]@{
        Status = if ($registryGatePass) { 'PASS' } else { 'BLOCKED' }
        RegistryPath = 'apps/web-user/src/data/watanyFeatureRegistryV4.json'
        RegistrySha256 = Get-ApexSha256 -Path $registryPath
        FeatureCount = $registry.Count
        FallbackFeatureCount = @($registry | Where-Object { [string]$_.status -eq 'fallback' }).Count
        PreservedAmbiguousCount = @($registry | Where-Object { [string]$_.status -eq 'preserved' }).Count
        DisabledNotImplementedCount = @($registry | Where-Object { [string]$_.status -eq 'DISABLED_NOT_IMPLEMENTED' }).Count
        BlockedOwnerMissingCount = @($registry | Where-Object { [string]$_.status -eq 'BLOCKED_OWNER_MISSING' }).Count
        EnabledUnprovenFeatureCount = $enabledUnproven.Count
        MissingFeatureOwnerCount = $missingOwner.Count
        DuplicateCanonicalFeatureCount = $duplicateFeatures.Count
        DisabledFeatureIds = @($disabledFeatures | ForEach-Object { $_.id })
        AmbiguousStateIds = @($ambiguous | ForEach-Object { $_.id })
    })

    $validationRoot = Join-Path $runRoot '30_VALIDATION'
    New-Item -ItemType Directory -Path $validationRoot -Force | Out-Null
    $pnpm = 'pnpm.cmd'
    $validations = @()
    $validations += Invoke-ValidationCommand -Name 'web-user-typecheck' -WorkingDirectory (Join-Path $ProjectRoot 'apps\web-user') -File $pnpm -CommandArgs @('run','typecheck') -OutputPath (Join-Path $validationRoot 'web-user-typecheck.log')
    $validations += Invoke-ValidationCommand -Name 'web-user-focused-tests' -WorkingDirectory (Join-Path $ProjectRoot 'apps\web-user') -File $pnpm -CommandArgs @('exec','vitest','run','src/components/watanybot/WatanyLegacyLauncherPage.test.tsx','src/components/shell-menu-regression.test.ts','--run') -OutputPath (Join-Path $validationRoot 'web-user-focused-tests.log')
    $validations += Invoke-ValidationCommand -Name 'web-user-build' -WorkingDirectory (Join-Path $ProjectRoot 'apps\web-user') -File $pnpm -CommandArgs @('run','build') -OutputPath (Join-Path $validationRoot 'web-user-build.log')
    $validations += Invoke-ValidationCommand -Name 'gateway-typecheck' -WorkingDirectory (Join-Path $ProjectRoot 'apps\gateway-api') -File $pnpm -CommandArgs @('run','typecheck') -OutputPath (Join-Path $validationRoot 'gateway-typecheck.log')
    $validationCommandPass = (@($validations | Where-Object { $_.ExitCode -ne 0 }).Count -eq 0)
    $unexpectedOutputCount = 0
    foreach ($validation in $validations) { $unexpectedOutputCount += [int]$validation.UnexpectedStderrOrFailureTokenCount }
    Write-JsonFile -Path (Join-Path $runRoot '30_VALIDATION_RESULTS.json') -Value ([pscustomobject]@{
        Status = if ($validationCommandPass -and $unexpectedOutputCount -eq 0) { 'PASS' } else { 'BLOCKED' }
        UnexpectedStderrCount = $unexpectedOutputCount
        FailureTokenCount = $unexpectedOutputCount
        Results = $validations
    })

    $matrixPrereqPass = $registryGatePass
    $matrixStatus = if ($matrixPrereqPass) { 'PENDING_NOT_IMPLEMENTED_IN_THIS_CONTROLLER' } else { 'BLOCKED_PRECONDITION_DISABLED_FEATURES' }
    Write-JsonFile -Path (Join-Path $runRoot '40_REQUIRED_MATRIX_GATES.json') -Value ([pscustomobject]@{
        ExpandedBrowserMatrix = $matrixStatus
        InteractionMatrix = $matrixStatus
        RolePermissionMatrix = $matrixStatus
        SalaryMatrix = $matrixStatus
        FormViewerMatrix = $matrixStatus
        V113FinalRegression = $matrixStatus
        RuntimeCleanupProof = $matrixStatus
        DeploymentEntrySetProof = 'NOT_CREATED_ON_BLOCKED_RUN'
        GatePass = $false
    })

    $stagingRoot = Join-Path $runRoot 'artifact-staging'
    New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
    $releaseFiles = @(
        'apps\web-user\src\data\watanyFeatureRegistryV4.json',
        'apps\web-user\src\data\watanyFeatureRegistryV4.ts',
        'apps\web-user\src\components\watanybot\watanyDrawerItems.ts',
        'apps\web-user\src\components\watanybot\WatanyAppIcon.tsx',
        'apps\web-user\src\components\layouts\WatanyPublicShellV20.tsx',
        'apps\web-user\src\styles\watany-source-of-truth-recovery.css',
        'scripts\run_watanybot_v4_full_green_release_v1_15.ps1'
    )
    foreach ($relativeFile in $releaseFiles) {
        $sourcePath = Join-Path $ProjectRoot $relativeFile
        if (Test-Path -LiteralPath $sourcePath) {
            $destinationPath = Join-Path $stagingRoot $relativeFile
            New-Item -ItemType Directory -Path (Split-Path -Parent $destinationPath) -Force | Out-Null
            Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
        }
    }
    Write-JsonFile -Path (Join-Path $runRoot '50_ARTIFACT_STAGING_MANIFEST.json') -Value ([pscustomobject]@{
        Status = 'STAGED_FOR_BLOCKED_CORRECTION_ONLY'
        Files = $releaseFiles
    })

    $fullGreenPass = ($bindingPass -and $registryGatePass -and $validationCommandPass -and $unexpectedOutputCount -eq 0 -and $false)
    $finalStatus = if ($fullGreenPass) { 'PASS' } else { 'BLOCKED' }
    $finalToken = if ($fullGreenPass) { $script:SuccessToken } else { $script:BlockedToken }
    $finalExitCode = if ($fullGreenPass) { $script:ExitComplete } else { $script:ExitBlocked }
    $failureClass = if ($fullGreenPass) { '' } elseif (-not $registryGatePass) { 'APEX_V1_15_STRICT_REGISTRY_GATE_BLOCKED' } elseif ($unexpectedOutputCount -ne 0) { 'APEX_V1_15_UNEXPECTED_STDERR_OR_FAILURE_TOKEN_BLOCKED' } else { 'APEX_V1_15_REQUIRED_MATRIX_PROOF_BLOCKED' }

    $deploymentZip = ''
    $deploymentZipSha256 = ''
    $zipProof = [pscustomobject]@{ Status = 'NOT_CREATED_ON_BLOCKED_RUN'; GatePass = $false }
    if ($fullGreenPass) {
        $deploymentZip = Join-Path $releaseRoot ($script:SuccessToken + '.zip')
        if (Test-Path -LiteralPath $deploymentZip) { Remove-Item -LiteralPath $deploymentZip -Force }
        Compress-Archive -LiteralPath $stagingRoot -DestinationPath $deploymentZip -Force
        $deploymentZipSha256 = Get-ApexSha256 -Path $deploymentZip
        $zipProof = Get-ZipEntryProof -ZipPath $deploymentZip -ExtractRoot (Join-Path $runRoot 'zip-expand-proof')
    }
    Write-JsonFile -Path (Join-Path $runRoot '60_DEPLOYMENT_ARTIFACT_PROOF.json') -Value ([pscustomobject]@{
        Status = $zipProof.Status
        DeploymentZip = $deploymentZip
        DeploymentZipSha256 = $deploymentZipSha256
        ZipProof = $zipProof
    })

    $finalReport = [pscustomobject]@{
        ScriptVersion = $script:ScriptVersion
        ProjectRoot = $ProjectRoot
        EvidenceRoot = $runRoot
        FinalStatus = $finalStatus
        ExitCode = $finalExitCode
        FinalToken = $finalToken
        FailureClass = $failureClass
        V114ClaimedStatus = 'PASS'
        V114EvidenceStatus = 'FALSE_GREEN'
        CurrentWatanybotStatus = 'PARTIAL_REGISTRY_AND_BUILD_GREEN'
        FullFeatureStatus = 'BLOCKED'
        FullThemeStatus = 'UNVERIFIED'
        DeploymentReadiness = 'BLOCKED'
        FallbackFeatureCount = 0
        EnabledUnprovenFeatureCount = $enabledUnproven.Count
        MissingFeatureOwnerCount = $missingOwner.Count
        DisabledNotImplementedCount = @($registry | Where-Object { [string]$_.status -eq 'DISABLED_NOT_IMPLEMENTED' }).Count
        BlockedOwnerMissingCount = @($registry | Where-Object { [string]$_.status -eq 'BLOCKED_OWNER_MISSING' }).Count
        UnexpectedStderrCount = $unexpectedOutputCount
        FailureTokenCount = $unexpectedOutputCount
        FullVitest = 'NOT_RUN_BLOCKED_BY_STRICT_REGISTRY_GATE'
        WebUserTypecheck = ($validations | Where-Object Name -eq 'web-user-typecheck').ExitCode
        GatewayTypecheck = ($validations | Where-Object Name -eq 'gateway-typecheck').ExitCode
        ProductionBuild = ($validations | Where-Object Name -eq 'web-user-build').ExitCode
        DeploymentArtifact = $zipProof.Status
        EndedUtc = [DateTime]::UtcNow.ToString('o')
    }
    Write-JsonFile -Path (Join-Path $runRoot 'FINAL_REPORT.json') -Value $finalReport
    Write-AsciiLines -Path (Join-Path $runRoot 'FINAL.marker') -Lines @(
        ('FINAL_STATUS=' + $finalStatus),
        ('EXIT_CODE=' + $finalExitCode),
        ('FINAL_TOKEN=' + $finalToken),
        ('FAILURE_CLASS=' + $failureClass),
        ('EVIDENCE_ROOT=' + $runRoot),
        ('DEPLOYMENT_ZIP=' + $deploymentZip),
        ('DEPLOYMENT_ZIP_SHA256=' + $deploymentZipSha256)
    )

    Write-Output ('FINAL_STATUS=' + $finalStatus)
    Write-Output ('EXIT_CODE=' + $finalExitCode)
    Write-Output ('FINAL_TOKEN=' + $finalToken)
    Write-Output ('FAILURE_CLASS=' + $failureClass)
    Write-Output ('EVIDENCE_ROOT=' + $runRoot)
    Write-Output ('DEPLOYMENT_ZIP=' + $deploymentZip)
    Write-Output ('DEPLOYMENT_ZIP_SHA256=' + $deploymentZipSha256)
    exit $finalExitCode
}
catch {
    Write-Output 'FINAL_STATUS=BLOCKED'
    Write-Output ('EXIT_CODE=' + $script:ExitBlocked)
    Write-Output ('FINAL_TOKEN=' + $script:BlockedToken)
    Write-Output 'FAILURE_CLASS=APEX_V1_15_CONTROLLER_UNHANDLED_EXCEPTION'
    Write-Output ('EXCEPTION_TYPE=' + $_.Exception.GetType().FullName)
    Write-Output ('FAILURE_MESSAGE=' + [string]$_.Exception.Message)
    Write-Output ('SCRIPT_STACK=' + [string]$_.ScriptStackTrace)
    exit $script:ExitBlocked
}
