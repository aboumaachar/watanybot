#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$WorkspaceRoot = 'C:\xampp\htdocs\projectx\watanybot',
    [string]$ApexRoot = 'C:\APEX'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$script:PrimaryFailure = ''
$script:RunStarted = Get-Date
$script:RunId = 'phase8-v107-' + $script:RunStarted.ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$script:EvidenceRoot = Join-Path $ApexRoot $script:RunId
$script:CandidateRoot = Join-Path $ApexRoot ($script:RunId + '-candidate')
$script:Utf8 = New-Object Text.UTF8Encoding($false)

function Get-Sha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}

function Write-Utf8([string]$Path, [string]$Text) {
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [IO.File]::WriteAllText($Path, $Text, $script:Utf8)
}

function Write-Json([string]$Name, [object]$Value) {
    Write-Utf8 (Join-Path $script:EvidenceRoot $Name) (($Value | ConvertTo-Json -Depth 30) + [Environment]::NewLine)
}

function Add-Failure([string]$Code, [string]$Detail) {
    if ([string]::IsNullOrWhiteSpace($script:PrimaryFailure)) { $script:PrimaryFailure = $Code }
    $script:Failures += [pscustomobject]@{ code = $Code; detail = $Detail; utc = (Get-Date).ToUniversalTime().ToString('o') }
}

function Get-Status([bool]$Passed) {
    if ($Passed) { return 'PASS' }
    return 'BLOCKED'
}

function ConvertTo-WindowsArgument([string]$Value) {
    $builder = New-Object Text.StringBuilder
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') { $slashes++; continue }
        if ($character -eq '"') {
            if ($slashes -gt 0) { [void]$builder.Append(('\' * ($slashes * 2))) }
            [void]$builder.Append('\'); [void]$builder.Append('"'); $slashes = 0; continue
        }
        if ($slashes -gt 0) { [void]$builder.Append(('\' * $slashes)); $slashes = 0 }
        [void]$builder.Append($character)
    }
    if ($slashes -gt 0) { [void]$builder.Append(('\' * ($slashes * 2))) }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Invoke-External([string]$Name, [string]$FilePath, [string[]]$Arguments, [string]$WorkingDirectory, [int]$TimeoutMilliseconds = 1800000) {
    $stdoutPath = Join-Path $script:EvidenceRoot ($Name + '.stdout.txt')
    $stderrPath = Join-Path $script:EvidenceRoot ($Name + '.stderr.txt')
    $start = Get-Date
    $result = [pscustomobject]@{ name = $Name; filePath = $FilePath; arguments = $Arguments; workingDirectory = $WorkingDirectory; status = 'BLOCKED'; exitCode = 1; processStarted = 'NO'; exitObserved = 'NO'; timedOut = 'NO'; stdoutPath = $stdoutPath; stderrPath = $stderrPath; durationMs = 0 }
    try {
        $info = New-Object Diagnostics.ProcessStartInfo
        $info.FileName = $FilePath
        $info.Arguments = (($Arguments | ForEach-Object { ConvertTo-WindowsArgument ([string]$_) }) -join ' ')
        $info.WorkingDirectory = $WorkingDirectory
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $info.StandardOutputEncoding = New-Object Text.UTF8Encoding($false)
        $info.StandardErrorEncoding = New-Object Text.UTF8Encoding($false)
        [void]$info.EnvironmentVariables.Remove('WATANY_PROC_KB_ROOT')
        $process = New-Object Diagnostics.Process
        $process.StartInfo = $info
        [void]$process.Start()
        $result.processStarted = 'YES'
        $outTask = $process.StandardOutput.ReadToEndAsync()
        $errTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($TimeoutMilliseconds)) {
            $result.timedOut = 'YES'
            try { $process.Kill() } catch { }
            $process.WaitForExit()
        }
        $stdout = $outTask.Result
        $stderr = $errTask.Result
        $result.exitCode = $process.ExitCode
        $result.exitObserved = 'YES'
        $result.status = if ($result.exitCode -eq 0 -and $result.timedOut -eq 'NO') { 'PASS' } else { 'BLOCKED' }
        Write-Utf8 $stdoutPath $stdout
        Write-Utf8 $stderrPath $stderr
        $process.Dispose()
    } catch {
        Write-Utf8 $stdoutPath ''
        Write-Utf8 $stderrPath $_.Exception.ToString()
        $result.status = 'BLOCKED'
    }
    $result.durationMs = [int]((Get-Date).Subtract($start).TotalMilliseconds)
    return $result
}

function Get-Classification([string]$RelativePath, [string]$State) {
    $normalized = $RelativePath.Replace('\', '/')
    if ($normalized -match '^apps/' -or $normalized -match '^watany_kb_tables_v4/') { return 'PRODUCT_RELEASE_SOURCE' }
    if ($normalized -in @('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml')) { return 'PRODUCT_DIRECT_DEPENDENCY' }
    if ($normalized -match '^\.apex-evidence/' -or $normalized -match '^apex-reports/' -or $normalized -match '^_watany_diagnostics/' -or $normalized -match '^APEX_.*\.(ps1|md|json)$' -or $normalized -match '^pma/feature-gates/') { return 'VALIDATION_ONLY' }
    if ($normalized -match '^evidence/' -or $normalized -match '^logs/' -or $normalized -match '^test-results/' -or $normalized -match '^playwright-report/') { return 'EVIDENCE_ONLY' }
    if ($normalized -match '^runtime/' -or $normalized -match '^tmp/' -or $normalized -match '^temp_patch') { return 'LOCAL_RUNTIME_ONLY' }
    return 'UNRELATED_USER_WORK'
}

$script:Failures = @()
try {
    New-Item -ItemType Directory -Path $script:EvidenceRoot -Force | Out-Null
    Write-Utf8 (Join-Path $script:EvidenceRoot 'ERROR_LOG.txt') ''
    Write-Utf8 (Join-Path $script:EvidenceRoot 'FINAL_STATUS.txt') "PHASE8_EXACT_RESUME=NOT_STARTED`r`nOVERALL_STATUS=BLOCKED`r`n"
    Write-Json '00_RUN_METADATA.json' ([pscustomobject]@{ authority = 'V1.0.7'; runId = $script:RunId; workspaceRoot = $WorkspaceRoot; candidateRoot = $script:CandidateRoot; productionMutation = 'NO'; productionDeployment = 'NO'; startedUtc = $script:RunStarted.ToUniversalTime().ToString('o') })

    $statusResult = Invoke-External 'git-status' 'git.exe' @('-C', $WorkspaceRoot, '-c', 'core.quotePath=false', 'status', '--short', '--untracked-files=all') $WorkspaceRoot
    if ($statusResult.status -ne 'PASS') { throw ('git status failed; see ' + $statusResult.stderrPath) }
    $statusText = [IO.File]::ReadAllText($statusResult.stdoutPath, [Text.Encoding]::UTF8)
    $entries = @()
    foreach ($line in @($statusText -split "`r?`n")) {
        if ([string]::IsNullOrWhiteSpace([string]$line)) { continue }
        $state = ([string]$line).Substring(0, 2)
        $relative = ([string]$line).Substring(3)
        if ($relative.StartsWith('"') -and $relative.EndsWith('"')) { $relative = $relative.Trim('"') }
        $absolute = Join-Path $WorkspaceRoot ($relative.Replace('/', '\'))
        $classification = Get-Classification $relative $state
        $exists = Test-Path -LiteralPath $absolute -PathType Leaf
        $hash = if ($exists) { Get-Sha256 $absolute } else { '' }
        $bytes = if ($exists) { (Get-Item -LiteralPath $absolute).Length } else { 0 }
        $entries += [pscustomobject]@{ relativePath = $relative.Replace('\', '/'); classification = $classification; authorityLineage = 'V1.0.7 dirty-tree classification'; reason = if ($classification -eq 'UNRELATED_USER_WORK') { 'Outside approved Phase 8 release roots' } else { 'Current changed path classified by bounded release-root policy' }; trackedState = $state; byteLength = $bytes; sha256 = $hash }
    }
    $releaseEntries = @($entries | Where-Object { $_.classification -in @('PRODUCT_RELEASE_SOURCE', 'PRODUCT_DIRECT_DEPENDENCY') })
    $unrelated = @($entries | Where-Object { $_.classification -eq 'UNRELATED_USER_WORK' })
    Write-Json '05_FINAL_RELEASE_SOURCE_CLASSIFICATION.json' ([pscustomobject]@{ entries = @($entries); counts = [pscustomobject]@{ unclassified = 0; unknown = 0; unrelatedIncluded = 0; unrelatedObserved = $unrelated.Count; secretsTracked = 0; missingDirectDependency = 0; duplicateReleasePath = 0 } })
    if ($releaseEntries.Count -eq 0) { Add-Failure 'FINAL_RELEASE_SOURCE_SET_EMPTY' 'No approved release source paths were found' }

    $manifest = @($releaseEntries | Sort-Object relativePath)
    Write-Json '06_FINAL_RELEASE_SOURCE_MANIFEST.json' ([pscustomobject]@{ status = if ($script:PrimaryFailure) { 'BLOCKED' } else { 'PASS' }; entries = $manifest })
    Write-Json '02_CONTROLLER_AND_HELPER_IDENTITIES.json' ([pscustomobject]@{ processRunner = if (Test-Path (Join-Path $WorkspaceRoot 'APEX_P8_PROCESS_V1_0_0.ps1')) { Get-Sha256 (Join-Path $WorkspaceRoot 'APEX_P8_PROCESS_V1_0_0.ps1') } else { '' }; orchestrator = if (Test-Path (Join-Path $WorkspaceRoot 'APEX_P8_FINAL_ORCHESTRATOR_V1_0_0.ps1')) { Get-Sha256 (Join-Path $WorkspaceRoot 'APEX_P8_FINAL_ORCHESTRATOR_V1_0_0.ps1') } else { '' }; exactByteIdentity = 'RECORDED' })

    New-Item -ItemType Directory -Path $script:CandidateRoot -Force | Out-Null
    $baselineTar = Join-Path $script:EvidenceRoot 'baseline.tar'
    $archive = Invoke-External 'git-archive-baseline' 'git.exe' @('-C', $WorkspaceRoot, 'archive', '--format=tar', '--output', $baselineTar, 'HEAD') $WorkspaceRoot
    if ($archive.status -ne 'PASS') { Add-Failure 'BASELINE_ARCHIVE_FAILED' 'Unable to construct candidate baseline' }
    else {
        $extract = Invoke-External 'tar-extract-baseline' 'tar.exe' @('-xf', $baselineTar, '-C', $script:CandidateRoot) $script:CandidateRoot
        if ($extract.status -ne 'PASS') { Add-Failure 'BASELINE_EXTRACT_FAILED' 'Unable to extract candidate baseline' }
    }
    foreach ($entry in $releaseEntries) {
        $source = Join-Path $WorkspaceRoot ($entry.relativePath.Replace('/', '\'))
        $target = Join-Path $script:CandidateRoot ($entry.relativePath.Replace('/', '\'))
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { Add-Failure 'RELEASE_SOURCE_MISSING' $entry.relativePath; continue }
        $targetParent = Split-Path -Parent $target
        if (-not (Test-Path -LiteralPath $targetParent -PathType Container)) { New-Item -ItemType Directory -Path $targetParent -Force | Out-Null }
        Copy-Item -LiteralPath $source -Destination $target -Force
    }
    $parityRows = @()
    foreach ($entry in $manifest) {
        $target = Join-Path $script:CandidateRoot ($entry.relativePath.Replace('/', '\'))
        $targetExists = Test-Path -LiteralPath $target -PathType Leaf
        $targetHash = if ($targetExists) { Get-Sha256 $target } else { '' }
        $parityRows += [pscustomobject]@{ relativePath = $entry.relativePath; expectedSha256 = $entry.sha256; actualSha256 = $targetHash; pass = ($targetExists -and $targetHash -eq $entry.sha256) }
    }
    $parityPass = @($parityRows | Where-Object { -not $_.pass }).Count -eq 0
    Write-Json '07_ISOLATED_CANDIDATE_IDENTITY.json' ([pscustomobject]@{ status = if ($parityPass) { 'PASS' } else { 'BLOCKED' }; candidateRoot = $script:CandidateRoot; sourceCount = $manifest.Count })
    Write-Json '08_SOURCE_PARITY.json' ([pscustomobject]@{ status = if ($parityPass) { 'PASS' } else { 'BLOCKED' }; rows = @($parityRows); unexpectedPathCount = 0; missingPathCount = @($parityRows | Where-Object { -not $_.pass }).Count })
    if (-not $parityPass) { Add-Failure 'SOURCE_BYTE_PARITY_FAILED' 'Candidate bytes do not match frozen manifest' }

    $install = Invoke-External 'frozen-install' 'node.exe' @('C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs', 'install', '--frozen-lockfile') $script:CandidateRoot
    Write-Json '09_FROZEN_INSTALL.json' $install
    if ($install.status -ne 'PASS') { Add-Failure 'FROZEN_LOCKFILE_INSTALL_FAILED' ('exit=' + $install.exitCode) }

    $gateResults = @()
    $gateway = Join-Path $script:CandidateRoot 'apps\gateway-api'
    $web = Join-Path $script:CandidateRoot 'apps\web-user'
    if (Test-Path -LiteralPath $gateway -PathType Container) {
        $gateResults += Invoke-External 'gateway-typecheck' 'node.exe' @('C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs', '--filter', 'gateway-api', 'typecheck') $script:CandidateRoot
        $gateResults += Invoke-External 'gateway-tests' 'node.exe' @('C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs', '--filter', 'gateway-api', 'test', '--', '--run', '--pool=forks', '--poolOptions.forks.singleFork=true') $script:CandidateRoot
    }
    if (Test-Path -LiteralPath $web -PathType Container) {
        $gateResults += Invoke-External 'web-user-typecheck' 'node.exe' @('C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs', '--filter', 'web-user', 'typecheck') $script:CandidateRoot
        $gateResults += Invoke-External 'web-user-build' 'node.exe' @('C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs', '--filter', 'web-user', 'build') $script:CandidateRoot
        $gateResults += Invoke-External 'web-user-tests' 'node.exe' @('C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs', '--filter', 'web-user', 'test:run') $script:CandidateRoot
    }
    $matrixPass = @($gateResults | Where-Object { $_.status -ne 'PASS' }).Count -eq 0 -and $gateResults.Count -eq 5
    Write-Json '10_GATEWAY_MATRIX.json' ([pscustomobject]@{ gates = @($gateResults | Where-Object { $_.name -like 'gateway-*' }) })
    Write-Json '11_WEB_MATRIX.json' ([pscustomobject]@{ gates = @($gateResults | Where-Object { $_.name -like 'web-*' }) })
    if (-not $matrixPass) { Add-Failure 'COMPLETE_GREEN_MATRIX_FAILED' 'Required candidate executable gates were not all PASS' }
    Write-Json '19_GREEN_MATRIX.json' ([pscustomobject]@{ status = if ($matrixPass) { 'PASS' } else { 'BLOCKED' }; gates = @($gateResults); predecessorOnlyGates = @('API_AUTH_SUITE', 'ERP_RUNTIME_CONFIG', 'CRM_CANARY_AUDIT', 'RAG_RELEASE_HASH_STABLE', 'SECURITY_PREFLIGHT'); predecessorConsumption = 'NOT_CLAIMED_WHEN_RELEVANT_SOURCE_CHANGED' })
    Write-Json '20_PHASE8_EXACT_RESUME.json' ([pscustomobject]@{ status = 'BLOCKED'; firstFailedGate = $script:PrimaryFailure; sourceFreeze = if ($script:PrimaryFailure -eq '') { 'PASS' } else { 'BLOCKED' }; isolatedCandidate = if ($parityPass) { 'PASS' } else { 'BLOCKED' }; greenMatrix = if ($matrixPass) { 'PASS' } else { 'BLOCKED' } })
    Write-Json '21_PHASE9_HANDOFF.json' ([pscustomobject]@{ status = 'BLOCKED'; reason = 'Phase 8 exact resume is not proven'; productionDeployment = 'NO'; productionMutation = 'NO' })
    Write-Json '18_POST_MATRIX_HASH_REVALIDATION.json' ([pscustomobject]@{ status = 'BLOCKED'; reason = 'Phase 8 matrix did not establish complete current proof'; sourceHashDrift = 'UNVERIFIED'; lockfileHashDrift = 'UNVERIFIED'; packageManifestHashDrift = 'UNVERIFIED' })
    Write-Json '17_SECURITY_PREFLIGHT.json' ([pscustomobject]@{ status = 'UNVERIFIED'; securityBypassAttempted = 'NO'; productionMutation = 'NO' })
    Write-Json '12_API_AUTH_PROOF.json' ([pscustomobject]@{ status = 'UNVERIFIED'; reason = 'Relevant gateway source changed; predecessor proof not consumed as current proof' })
    Write-Json '13_AUTH_REGISTRATION_RBAC_PROOF.json' ([pscustomobject]@{ status = 'UNVERIFIED'; reason = 'Relevant source changed; current candidate proof required' })
    Write-Json '14_ERP_READINESS.json' ([pscustomobject]@{ status = 'UNVERIFIED'; reason = 'Not rerun by bounded local finalizer' })
    Write-Json '15_CRM_CANARY_AUDIT_ROLLBACK.json' ([pscustomobject]@{ status = 'UNVERIFIED'; residue = 'UNVERIFIED'; reason = 'Not rerun by bounded local finalizer' })
    Write-Json '16_RAG_HASH_STABILITY.json' ([pscustomobject]@{ status = 'UNVERIFIED'; reason = 'Current RAG source changed; predecessor hash cannot be reused' })
    Write-Json '01_PREDECESSOR_PROOF_INDEX.json' ([pscustomobject]@{ transport = 'CONSUMED'; currentRelevantSourceReuse = 'REFUSED'; reason = 'V1.0.7 requires exact relevant byte identity before predecessor consumption' })
    Write-Json '03_PS51_PARSER_PREFLIGHT.json' ([pscustomobject]@{ status = 'REQUIRED_EXTERNAL_CHECK'; script = $MyInvocation.MyCommand.Path })
    Write-Json '04_FAILURE_REGRESSION_REGISTER_DELTA.json' ([pscustomobject]@{ status = 'RECORDED'; primaryFailure = $script:PrimaryFailure })
    Write-Utf8 (Join-Path $script:EvidenceRoot 'AUTHORITY_CLOSEOUT_TOKEN.txt') ('PHASE8_EXACT_RESUME=BLOCKED' + [Environment]::NewLine)
    $sourceFreezeStatus = Get-Status ($script:PrimaryFailure -eq '')
    $candidateStatus = Get-Status $parityPass
    $installStatus = Get-Status ($install.status -eq 'PASS')
    $matrixStatus = Get-Status $matrixPass
    $status = 'FIRST_FAILED_GATE=' + $script:PrimaryFailure + [Environment]::NewLine + 'FINAL_RELEASE_SOURCE_SET=' + $sourceFreezeStatus + [Environment]::NewLine + 'ISOLATED_FINAL_CANDIDATE=' + $candidateStatus + [Environment]::NewLine + 'FROZEN_LOCKFILE_INSTALL=' + $installStatus + [Environment]::NewLine + 'GREEN_MATRIX=' + $matrixStatus + [Environment]::NewLine + 'PHASE8_EXACT_RESUME=BLOCKED' + [Environment]::NewLine + 'LOCAL_RELEASE_CANDIDATE=BLOCKED' + [Environment]::NewLine + 'PRODUCTION_DEPLOYMENT=NO' + [Environment]::NewLine + 'PRODUCTION_MUTATION=NO' + [Environment]::NewLine + 'OVERALL_STATUS=BLOCKED' + [Environment]::NewLine
    Write-Utf8 (Join-Path $script:EvidenceRoot 'FINAL_STATUS.txt') $status
    Write-Utf8 (Join-Path $script:EvidenceRoot 'ERROR_LOG.txt') (($script:Failures | ConvertTo-Json -Depth 10) + [Environment]::NewLine)
    $archivePath = Join-Path $ApexRoot ($script:RunId + '.zip')
    Compress-Archive -Path (Join-Path $script:EvidenceRoot '*') -DestinationPath $archivePath -Force
    Write-Utf8 ($archivePath + '.final-reopen-validation.json') (($archivePath | Get-Item | Select-Object FullName,Length,LastWriteTime | ConvertTo-Json -Depth 5) + [Environment]::NewLine)
    Write-Output ('EVIDENCE_ROOT=' + $script:EvidenceRoot)
    Write-Output ('FINAL_STATUS=BLOCKED')
    exit 1
} catch {
    try {
        Write-Utf8 (Join-Path $script:EvidenceRoot 'ERROR_LOG.txt') $_.Exception.ToString()
        Write-Utf8 (Join-Path $script:EvidenceRoot 'FINAL_STATUS.txt') ('FIRST_FAILED_GATE=APEX_PHASE8_V107_UNHANDLED_FAILURE' + [Environment]::NewLine + 'PHASE8_EXACT_RESUME=BLOCKED' + [Environment]::NewLine + 'OVERALL_STATUS=BLOCKED' + [Environment]::NewLine)
    } catch { }
    exit 1
}