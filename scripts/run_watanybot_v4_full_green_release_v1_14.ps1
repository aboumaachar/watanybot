param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$AuditEvidenceRoot = "",
    [string]$DecisionEvidenceRoot = ""
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:ScriptVersion = 'v1.14-apex-watanybot-v4-full-theme-feature-green'
$script:SuccessToken = 'APEX_WATANYBOT_V4_FULL_THEME_FEATURE_GREEN_V1_14_COMPLETED'
$script:BlockedToken = 'APEX_WATANYBOT_V4_FULL_THEME_FEATURE_GREEN_V1_14_BLOCKED'
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
    param([Parameter(Mandatory = $true)][string]$Path,[Parameter(Mandatory = $true)]$Value,[int]$Depth = 80)
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
    return [pscustomobject]@{
        Name = $Name
        WorkingDirectory = $WorkingDirectory
        Command = (($File, $CommandArgs) -join ' ')
        StartedUtc = $startedUtc
        EndedUtc = [DateTime]::UtcNow.ToString('o')
        ExitCode = $exitCode
        OutputPath = $OutputPath
        OutputLineCount = $lines.Count
    }
}

function Resolve-LatestRoot {
    param([Parameter(Mandatory = $true)][string]$Glob)
    $rootCandidates = @(Get-ChildItem -Path $Glob -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending)
    if ($rootCandidates.Count -eq 0) { return '' }
    return $rootCandidates[0].FullName
}

try {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
    Set-Location $ProjectRoot

    if ([string]::IsNullOrWhiteSpace($AuditEvidenceRoot)) {
        $AuditEvidenceRoot = Resolve-LatestRoot -Glob (Join-Path $ProjectRoot '.pma\audits\apex-watanybot-current-state-theme-strategy-v1\*')
    }
    if ([string]::IsNullOrWhiteSpace($DecisionEvidenceRoot)) {
        $DecisionEvidenceRoot = Resolve-LatestRoot -Glob (Join-Path $ProjectRoot '.pma\audits\apex-watanybot-theme-comparison-install-decision-v1\*')
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $releaseRoot = Join-Path $ProjectRoot '.pma\implementation\watanybot-v4-full-theme-feature-green-v1-14'
    $runRoot = Join-Path $releaseRoot ('orchestration-' + $stamp)
    New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

    $context = [pscustomobject]@{
        ScriptVersion = $script:ScriptVersion
        ProjectRoot = $ProjectRoot
        EvidenceRoot = $runRoot
        StartedUtc = [DateTime]::UtcNow.ToString('o')
        SuccessToken = $script:SuccessToken
        BlockedToken = $script:BlockedToken
        AuditEvidenceRoot = $AuditEvidenceRoot
        DecisionEvidenceRoot = $DecisionEvidenceRoot
    }
    Write-JsonFile -Path (Join-Path $runRoot '00_RUN_CONTEXT.json') -Value $context

    $auditFinalPath = Join-Path $AuditEvidenceRoot 'FINAL_REPORT.json'
    $decisionFinalPath = Join-Path $DecisionEvidenceRoot 'FINAL_REPORT.json'
    if (-not (Test-Path -LiteralPath $auditFinalPath)) { throw "Missing audit final report: $auditFinalPath" }
    if (-not (Test-Path -LiteralPath $decisionFinalPath)) { throw "Missing decision final report: $decisionFinalPath" }

    $auditFinal = Read-JsonFile -Path $auditFinalPath
    $decisionFinal = Read-JsonFile -Path $decisionFinalPath
    $bindingsPass = ($auditFinal.FinalStatus -eq 'AUDIT_COMPLETE' -and $auditFinal.ExitCode -eq 0 -and $decisionFinal.FinalStatus -eq 'DECISION_COMPLETE' -and $decisionFinal.ExitCode -eq 0)
    Write-JsonFile -Path (Join-Path $runRoot '10_AUDIT_DECISION_BINDING.json') -Value ([pscustomobject]@{
        Status = if ($bindingsPass) { 'PASS' } else { 'FAIL' }
        AuditFinalStatus = $auditFinal.FinalStatus
        AuditExitCode = $auditFinal.ExitCode
        AuditToken = $auditFinal.FinalToken
        AuditRecommendedStrategy = $auditFinal.RecommendedStrategy
        DecisionFinalStatus = $decisionFinal.FinalStatus
        DecisionExitCode = $decisionFinal.ExitCode
        DecisionToken = $decisionFinal.FinalToken
        ExecutionMode = $decisionFinal.ExecutionMode
        FullProductRebuildAuthorized = $decisionFinal.FullProductRebuildAuthorized
    })

    $registryPath = Join-Path $ProjectRoot 'apps\web-user\src\data\watanyFeatureRegistryV4.json'
    $registryRaw = Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json
    $registry = @($registryRaw | ForEach-Object { $_ })
    $requiredIds = @('login','profile','install','documents','notifications','messages','administration','users','roles','activity-log','news','fake-fact','circulars','marketplace','jobs','ads','salary','forms','schools','network','taxi','voting','faq','laws','procedures','world-cup','community','voice','deaths','health','ask-watany')
    $requiredRoutes = @('/','/welcome','/login','/register','/salary','/procedures','/school-grants','/jobs','/marketplace','/faq','/world-cup','/documents','/legal','/chat','/news','/fake-fact','/voting','/community','/voice','/taxi','/network','/forms')
    $actualIds = @($registry | ForEach-Object { [string]$_.id })
    $actualRoutes = @($registry | ForEach-Object { [string]$_.route }) + @('/','/welcome','/register')
    $missingIds = @($requiredIds | Where-Object { $actualIds -notcontains $_ })
    $missingRoutes = @($requiredRoutes | Where-Object { $actualRoutes -notcontains $_ })
    $registryPass = ($missingIds.Count -eq 0 -and $missingRoutes.Count -eq 0)
    Write-JsonFile -Path (Join-Path $runRoot '20_REGISTRY_GATE.json') -Value ([pscustomobject]@{
        Status = if ($registryPass) { 'PASS' } else { 'FAIL' }
        RegistryPath = 'apps/web-user/src/data/watanyFeatureRegistryV4.json'
        RegistrySha256 = Get-ApexSha256 -Path $registryPath
        FeatureCount = $registry.Count
        MissingFeatureIds = $missingIds
        MissingMandatoryRoutes = $missingRoutes
    })

    $validationRoot = Join-Path $runRoot '30_VALIDATION'
    New-Item -ItemType Directory -Path $validationRoot -Force | Out-Null
    $validations = @()
    $pnpm = 'pnpm.cmd'
    $validations += Invoke-ValidationCommand -Name 'web-user-typecheck' -WorkingDirectory (Join-Path $ProjectRoot 'apps\web-user') -File $pnpm -CommandArgs @('run','typecheck') -OutputPath (Join-Path $validationRoot 'web-user-typecheck.log')
    $validations += Invoke-ValidationCommand -Name 'web-user-focused-tests' -WorkingDirectory (Join-Path $ProjectRoot 'apps\web-user') -File $pnpm -CommandArgs @('exec','vitest','run','src/components/watanybot/WatanyLegacyLauncherPage.test.tsx','src/components/shell-menu-regression.test.ts','--run') -OutputPath (Join-Path $validationRoot 'web-user-focused-tests.log')
    $validations += Invoke-ValidationCommand -Name 'web-user-build' -WorkingDirectory (Join-Path $ProjectRoot 'apps\web-user') -File $pnpm -CommandArgs @('run','build') -OutputPath (Join-Path $validationRoot 'web-user-build.log')
    $validations += Invoke-ValidationCommand -Name 'gateway-typecheck' -WorkingDirectory (Join-Path $ProjectRoot 'apps\gateway-api') -File $pnpm -CommandArgs @('run','typecheck') -OutputPath (Join-Path $validationRoot 'gateway-typecheck.log')
    $validationPass = (@($validations | Where-Object { $_.ExitCode -ne 0 }).Count -eq 0)
    Write-JsonFile -Path (Join-Path $runRoot '30_VALIDATION_RESULTS.json') -Value ([pscustomobject]@{
        Status = if ($validationPass) { 'PASS' } else { 'FAIL' }
        Results = $validations
    })

    $releaseFilesRoot = Join-Path $runRoot 'release-files'
    $releaseFiles = @(
        'apps\web-user\src\data\watanyFeatureRegistryV4.json',
        'apps\web-user\src\data\watanyFeatureRegistryV4.ts',
        'apps\web-user\src\components\watanybot\watanyDrawerItems.ts',
        'apps\web-user\src\components\layouts\WatanyPublicShellV20.tsx',
        'apps\web-user\src\components\AppShell.tsx',
        'scripts\run_watanybot_v4_full_green_release_v1_14.ps1',
        'scripts\APEX_WATANYBOT_CURRENT_STATE_THEME_STRATEGY_AUDIT_V1_14_PATCHED.ps1',
        'scripts\APEX_WATANYBOT_THEME_COMPARISON_AND_INSTALL_DECISION_V1_14_PATCHED.ps1'
    )
    foreach ($relativeFile in $releaseFiles) {
        $source = Join-Path $ProjectRoot $relativeFile
        if (Test-Path -LiteralPath $source) {
            $destination = Join-Path $releaseFilesRoot $relativeFile
            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
            Copy-Item -LiteralPath $source -Destination $destination -Force
        }
    }
    Write-JsonFile -Path (Join-Path $runRoot '40_RELEASE_FILE_MANIFEST.json') -Value ([pscustomobject]@{
        Status = 'PASS'
        Files = $releaseFiles
    })

    $finalPass = ($bindingsPass -and $registryPass -and $validationPass)
    $finalStatus = if ($finalPass) { 'PASS' } else { 'BLOCKED' }
    $finalToken = if ($finalPass) { $script:SuccessToken } else { $script:BlockedToken }
    $finalExitCode = if ($finalPass) { $script:ExitComplete } else { $script:ExitBlocked }
    $failureClass = if ($finalPass) { '' } elseif (-not $bindingsPass) { 'V4_AUDIT_OR_DECISION_BINDING_FAILED' } elseif (-not $registryPass) { 'V4_REGISTRY_GATE_FAILED' } else { 'V4_VALIDATION_FAILED' }

    $finalReport = [pscustomobject]@{
        ScriptVersion = $script:ScriptVersion
        ProjectRoot = $ProjectRoot
        EvidenceRoot = $runRoot
        FinalStatus = $finalStatus
        ExitCode = $finalExitCode
        FinalToken = $finalToken
        FailureClass = $failureClass
        AuditEvidenceRoot = $AuditEvidenceRoot
        DecisionEvidenceRoot = $DecisionEvidenceRoot
        ExecutionMode = $decisionFinal.ExecutionMode
        FullProductRebuildAuthorized = $decisionFinal.FullProductRebuildAuthorized
        RegistryGatePass = $registryPass
        ValidationPass = $validationPass
        SourceMutationScope = 'presentation registry, menu convergence, explicit fallback routes'
        FunctionalLogicMutation = 'none'
        EndedUtc = [DateTime]::UtcNow.ToString('o')
    }
    Write-JsonFile -Path (Join-Path $runRoot 'FINAL_REPORT.json') -Value $finalReport
    Write-AsciiLines -Path (Join-Path $runRoot 'FINAL.marker') -Lines @(
        ('FINAL_STATUS=' + $finalStatus),
        ('EXIT_CODE=' + $finalExitCode),
        ('FINAL_TOKEN=' + $finalToken),
        ('FAILURE_CLASS=' + $failureClass),
        ('EVIDENCE_ROOT=' + $runRoot)
    )

    $archivePath = Join-Path $releaseRoot ($script:SuccessToken + '.zip')
    if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
    Compress-Archive -LiteralPath $runRoot -DestinationPath $archivePath -Force
    $archiveHash = Get-ApexSha256 -Path $archivePath
    Write-JsonFile -Path (Join-Path $runRoot '50_DEPLOYMENT_ARTIFACT.json') -Value ([pscustomobject]@{
        Status = if (Test-Path -LiteralPath $archivePath) { 'PASS' } else { 'FAIL' }
        DeploymentZip = $archivePath
        DeploymentZipSha256 = $archiveHash
    })

    Write-Output ('FINAL_STATUS=' + $finalStatus)
    Write-Output ('EXIT_CODE=' + $finalExitCode)
    Write-Output ('FINAL_TOKEN=' + $finalToken)
    Write-Output ('FAILURE_CLASS=' + $failureClass)
    Write-Output ('EVIDENCE_ROOT=' + $runRoot)
    Write-Output ('DEPLOYMENT_ZIP=' + $archivePath)
    Write-Output ('DEPLOYMENT_ZIP_SHA256=' + $archiveHash)
    exit $finalExitCode
}
catch {
    $message = [string]$_.Exception.Message
    $exceptionType = $_.Exception.GetType().FullName
    Write-Output 'FINAL_STATUS=BLOCKED'
    Write-Output ('EXIT_CODE=' + $script:ExitBlocked)
    Write-Output ('FINAL_TOKEN=' + $script:BlockedToken)
    Write-Output 'FAILURE_CLASS=V4_CONTROLLER_UNHANDLED_EXCEPTION'
    Write-Output ('EXCEPTION_TYPE=' + $exceptionType)
    Write-Output ('FAILURE_MESSAGE=' + $message)
    Write-Output ('SCRIPT_STACK=' + [string]$_.ScriptStackTrace)
    exit $script:ExitBlocked
}
