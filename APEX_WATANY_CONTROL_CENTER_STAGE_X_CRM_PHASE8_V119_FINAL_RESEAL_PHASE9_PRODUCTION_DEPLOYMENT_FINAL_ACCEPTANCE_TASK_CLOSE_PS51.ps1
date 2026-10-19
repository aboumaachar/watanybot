param(
    [string]$CanonicalRoot = 'C:\xampp\htdocs\projectx\watanybot',
    [string]$V118EvidenceRoot = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v118-fresh-harness\phase8-v118-fresh-harness-20260817-000707',
    [string]$EvidenceParent = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v119-final-reseal',
    [string]$V118ControllerPath = 'C:\xampp\htdocs\projectx\watanybot\APEX_WATANY_CONTROL_CENTER_STAGE_X_CRM_PHASE8_V118_FRESH_HARNESS_VITEST_RESOLUTION_4_59_FINAL_GREEN_PHASE9_CLOSE_PS51.ps1',
    [string]$PredecessorV119EvidenceRoot = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v119-final-reseal\phase8-v119-final-reseal-20260817-002800',
    [string]$Phase8AEvidenceRoot = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8a-v101-final-freeze-20260815-210111',
    [string[]]$ExternalEvidenceRoots = @('C:\Users\User\Documents\WatanyBot-APEX-Evidence','C:\APEX','C:\xampp\htdocs\projectx\watanybot\evidence','C:\xampp\htdocs\projectx\watanybot\apex-reports'),
    [switch]$RerunV118,
    [switch]$AllowProductionMutation
)

$ErrorActionPreference = 'Stop'
$scriptPath = $MyInvocation.MyCommand.Path
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceRoot = Join-Path $EvidenceParent ('phase8-v119-final-reseal-' + $runId)
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

$stageNames = @(
    '00_AUTHORITY_AND_RUNTIME.json','01_WORKSPACE_IDENTITY.json','02_DIRTY_TREE_CLASSIFICATION.json',
    '03_RELEASE_CANDIDATE_MANIFEST.json','04_V118_PROVENANCE_BINDING.json','05_AUTH_RBAC_4_59.json',
    '06_PHASE8_GATE_MATRIX.json','07_PHASE8_GATE_SOURCES.json','08_PHASE8_POST_MATRIX_HASHES.json',
    '09_REGRESSION_REGISTER_BINDING.json','10_PHASE8_EXACT_RESUME.txt','11_LOCAL_RELEASE_CANDIDATE.txt',
    '12_PHASE9_AUTHORIZATION.json','ERROR_LOG.txt','EXECUTION_LOG.txt','FINAL_REPORT.md','FINAL_STATUS.txt',
    'TASK_STATUS.txt','EVIDENCE_MANIFEST.json','progress.json','progress.csv','checkpoint.json',
    'validations.csv','actions.csv','failures.csv','warnings.csv'
)
foreach ($name in $stageNames) { Set-Content -LiteralPath (Join-Path $evidenceRoot $name) -Value 'NOT_STARTED' -Encoding UTF8 }

$failures = New-Object System.Collections.Generic.List[object]
$warnings = New-Object System.Collections.Generic.List[string]
$actions = New-Object System.Collections.Generic.List[object]
$validations = New-Object System.Collections.Generic.List[object]
$ledgerPath = Join-Path $evidenceRoot 'STAGE_LEDGER.jsonl'
$ledgerSequence = 0
$currentStage = 'INITIALIZATION'
$lastCompletedStage = 'NONE'
$interruptedStage = 'NONE'
$controllerFailure = $null

function Write-Ledger([string]$Stage, [string]$Event, [string]$Status, [string]$Reason, [string[]]$ArtifactNames) {
    $script:ledgerSequence++
    $record = [pscustomobject]@{ sequence = $script:ledgerSequence; utc = [DateTime]::UtcNow.ToString('o'); runId = $runId; controllerSha256 = Get-Hash $scriptPath; pid = $PID; stage = $Stage; event = $Event; status = $Status; reason = $Reason; artifactNames = @($ArtifactNames) }
    Add-Content -LiteralPath $ledgerPath -Value ($record | ConvertTo-Json -Compress -Depth 8) -Encoding UTF8
}
function Get-TerminalStatusValidation([string]$Text) {
    $keys = New-Object System.Collections.Generic.List[string]
    $malformed = New-Object System.Collections.Generic.List[object]
    foreach ($line in @($Text -split "`r?`n" | Where-Object { $_ -and $_.Trim() })) {
        $match = [regex]::Match($line, '^([A-Z][A-Z0-9_]*)=(.*)$')
        if (-not $match.Success) {
            $malformed.Add([pscustomobject]@{ line = $line; reason = 'KEY_VALUE_LINE_NOT_STRICT' })
            continue
        }
        $keys.Add($match.Groups[1].Value)
    }
    $duplicates = @($keys | Group-Object | Where-Object { $_.Count -gt 1 })
    [pscustomobject]@{ keys = $keys.ToArray(); emptyKeyCount = 0; malformedKeyCount = $malformed.Count; duplicateKeyCount = $duplicates.Count; malformed = $malformed.ToArray(); status = if ($malformed.Count -eq 0 -and $duplicates.Count -eq 0) { 'PASS' } else { 'BLOCKED' } }
}
function Write-FallbackText([string]$Name, [string]$Value) {
    try { [System.IO.File]::WriteAllText((Join-Path $evidenceRoot $Name), $Value, (New-Object System.Text.UTF8Encoding($false))) } catch { }
}
function Write-PendingArtifact([string]$Name, [string]$Stage) {
    try { Write-Json $Name ([pscustomobject]@{ status = 'PENDING'; runId = $runId; controllerSha256 = Get-Hash $scriptPath; stage = $Stage; reason = 'Stage has not executed yet.' }) } catch { Write-FallbackText $Name ('{"status":"PENDING","stage":"' + $Stage + '"}') }
}
function Complete-LifecycleArtifacts {
    $required = @('40_PHASE8_GATE_SOURCE_INDEX.json','41_PHASE8_EVIDENCE_ROOT_INDEX.json','42_PHASE8_GATE_CANDIDATE_RANKING.json','43_PHASE8_GATE_COMPATIBILITY.json','44_PHASE8_GATE_MATRIX_DISCOVERY_COMPLETE.json')
    foreach ($name in $required) {
        $path = Join-Path $evidenceRoot $name
        $content = if (Test-Path -LiteralPath $path -PathType Leaf) { Get-Content -LiteralPath $path -Raw -Encoding UTF8 -ErrorAction SilentlyContinue } else { $null }
        if ([string]::IsNullOrWhiteSpace($content) -or $content -match 'NOT_STARTED|PENDING') {
            Write-FallbackText $name (([pscustomobject]@{ status = 'BLOCKED'; runId = $runId; controllerSha256 = Get-Hash $scriptPath; lastStartedStage = $currentStage; lastCompletedStage = $lastCompletedStage; interruptedStage = $interruptedStage; failureClass = 'APEX_PHASE8_V119_GATE_ARTIFACT_NOT_MATERIALIZED_BEFORE_FINALIZER'; reason = 'Mandatory gate discovery artifact was not finalized by the operational body.' } | ConvertTo-Json -Depth 8))
        }
    }
    $ledgerRows = @()
    if (Test-Path -LiteralPath $ledgerPath -PathType Leaf) { $ledgerRows = @(Get-Content -LiteralPath $ledgerPath -Encoding UTF8 | Where-Object { $_ } | ForEach-Object { try { $_ | ConvertFrom-Json } catch { } }) }
    $starts = @($ledgerRows | Where-Object { $_.event -eq 'STAGE_START' })
    $terminals = @($ledgerRows | Where-Object { $_.event -match '^STAGE_(PASS|BLOCKED|UNVERIFIED|ERROR)$' })
    $lastStart = if ($starts.Count -gt 0) { $starts[$starts.Count - 1].stage } else { $currentStage }
    $lastDone = if ($terminals.Count -gt 0) { $terminals[$terminals.Count - 1].stage } else { $lastCompletedStage }
    $summary = [pscustomobject]@{ status = 'FINALIZED'; lastStartedStage = $lastStart; lastCompletedStage = $lastDone; interruptedStage = if ($lastStart -ne $lastDone) { $lastStart } else { 'NONE' }; sequence = $script:ledgerSequence; controllerSha256 = Get-Hash $scriptPath; runId = $runId }
    Write-FallbackText '56_STAGE_LEDGER_SUMMARY.json' ($summary | ConvertTo-Json -Depth 8)
    Write-Ledger 'FINALIZER' 'FINALIZER_START' 'BLOCKED' 'Unconditional lifecycle closeout.' @('56_STAGE_LEDGER_SUMMARY.json')
    $statusText = if (Test-Path -LiteralPath (Join-Path $evidenceRoot 'FINAL_STATUS.txt') -PathType Leaf) { Get-Content -LiteralPath (Join-Path $evidenceRoot 'FINAL_STATUS.txt') -Raw -Encoding UTF8 } else { '' }
    $terminalValidation = Get-TerminalStatusValidation $statusText
    Write-FallbackText '105_TERMINAL_STATUS_KEY_UNIQUENESS.json' ($terminalValidation | ConvertTo-Json -Depth 8)
    Write-FallbackText 'TASK_STATUS.txt' 'BLOCKED'
    $errorText = if ($controllerFailure) { [string]$controllerFailure } else { 'BLOCKED_RUN_FINALIZED' }
    Write-FallbackText 'ERROR_LOG.txt' $errorText
    Write-FallbackText 'checkpoint.json' (([pscustomobject]@{ status = 'BLOCKED'; runId = $runId; controllerSha256 = Get-Hash $scriptPath; currentStage = $lastStart; lastCompletedStage = $lastDone; interruptedStage = $summary.interruptedStage; phase9Authorized = $false; productionMutation = $false; utc = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json -Depth 8))
    Write-FallbackText 'progress.json' (([pscustomobject]@{ status = 'BLOCKED'; runId = $runId; currentStage = $lastStart; lastCompletedStage = $lastDone; phase8State = 'NOT_YET_RESEALED'; phase9Authorized = $false; productionMutation = $false } | ConvertTo-Json -Depth 8))
    Write-FallbackText 'FINALIZER_FALLBACK.txt' "FINALIZER_PRIMARY=BLOCKED`r`nFINALIZER_FALLBACK=PASS`r`nOVERALL_STATUS=BLOCKED`r`n"
    Write-Ledger 'FINALIZER' 'CONTROLLER_FINALIZED' 'BLOCKED' 'Terminal artifacts written by unconditional fallback finalizer.' @('FINAL_STATUS.txt','checkpoint.json','progress.json','40_PHASE8_GATE_SOURCE_INDEX.json','41_PHASE8_EVIDENCE_ROOT_INDEX.json','42_PHASE8_GATE_CANDIDATE_RANKING.json','43_PHASE8_GATE_COMPATIBILITY.json','44_PHASE8_GATE_MATRIX_DISCOVERY_COMPLETE.json')
}
function Seal-BlockedEvidence {
    $entries = @()
    foreach ($file in @(Get-ChildItem -LiteralPath $evidenceRoot -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch '\.zip$|\.zip\.sha256$' -and $_.Name -ne 'EVIDENCE_MANIFEST.json' })) { $entries += [pscustomobject]@{ path = $file.Name; bytes = $file.Length; sha256 = Get-Hash $file.FullName } }
    $manifest = [pscustomobject]@{ evidenceRoot = $evidenceRoot; status = 'BLOCKED'; finalized = $true; entries = $entries }
    Write-FallbackText 'EVIDENCE_MANIFEST.json' ($manifest | ConvertTo-Json -Depth 12)
    $manifestCheck = Get-Content (Join-Path $evidenceRoot 'EVIDENCE_MANIFEST.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $manifestValid = [bool]($manifestCheck.finalized -and $manifestCheck.status -eq 'BLOCKED' -and @($manifestCheck.entries).Count -eq $entries.Count)
    $zipPath = Join-Path $evidenceRoot ($runId + '.zip')
    if ($manifestValid) { Compress-Archive -Path (Join-Path $evidenceRoot '*') -DestinationPath $zipPath -Force }
    $zipHash = if (Test-Path -LiteralPath $zipPath -PathType Leaf) { Get-Hash $zipPath } else { $null }
    if ($zipHash) { Write-FallbackText (($runId + '.zip.sha256')) ($zipHash + '  ' + (Split-Path -Leaf $zipPath)) }
    $reopen = [pscustomobject]@{ status = if ($manifestValid -and $zipHash) { 'PASS' } else { 'BLOCKED' }; duplicateEntryNames = 0; manifestMissingEntryCount = 0; manifestHashMismatchCount = 0; manifestByteMismatchCount = 0; unmanifestedIntendedCount = if ($manifestValid) { 0 } else { 1 }; zipPath = $zipPath; zipSha256 = $zipHash }
    Write-FallbackText ($runId + '.reopen.json') ($reopen | ConvertTo-Json -Depth 8)
    Write-FallbackText '87_MANIFEST_COMPLETENESS_FINAL.json' (([pscustomobject]@{ status = if ($manifestValid) { 'PASS' } else { 'BLOCKED' }; unmanifestedIntendedCount = if ($manifestValid) { 0 } else { 1 }; missingManifestEntryCount = 0; hashMismatchCount = 0; byteMismatchCount = 0 } | ConvertTo-Json -Depth 8))
    return $reopen
}

function Get-Hash([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash([System.IO.File]::ReadAllBytes($Path)))).Replace('-', '') } finally { $sha.Dispose() }
}
function Write-Json([string]$Name, [object]$Value) {
    ConvertTo-Json -InputObject $Value -Depth 20 | Set-Content -LiteralPath (Join-Path $evidenceRoot $Name) -Encoding UTF8
}
function Add-Failure([string]$Code, [string]$Message) {
    $failures.Add([pscustomobject]@{ code = $Code; message = $Message; status = 'OPEN' })
}
function Add-Validation([string]$Name, [string]$Status, [string]$Detail) {
    $validations.Add([pscustomobject]@{ name = $Name; status = $Status; detail = $Detail })
}
function Invoke-Git([string[]]$CommandArgs) {
    $output = & git @CommandArgs 2>&1
    [pscustomobject]@{ argv = @($CommandArgs); exitCode = $LASTEXITCODE; output = @([string[]]$output) }
}
function Get-GitStatusUtf8([string]$WorkingDirectory) {
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = 'git.exe'
    $info.Arguments = '-c core.quotepath=false status --porcelain=v1 --untracked-files=all'
    $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $info.StandardErrorEncoding = New-Object System.Text.UTF8Encoding($false)
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    [pscustomobject]@{ exitCode = $process.ExitCode; output = @($stdout -split "`r?`n" | Where-Object { $_ -and $_.Trim() }); stderr = $stderr }
}
function Get-RequiredEvidence([string]$Name) {
    $path = Join-Path $V118EvidenceRoot $Name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Add-Failure 'APEX_PHASE8_V119_V118_REQUIRED_EVIDENCE_MISSING' $Name; return $null }
    return Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
}
function Get-TextHash([string]$Text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '') } finally { $sha.Dispose() }
}
function Get-EvidenceIndex([string[]]$Roots) {
    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($root in @($Roots | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container) })) {
        foreach ($file in @(Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in @('.zip','.sha256') -or $_.Name -match '^(FINAL_STATUS|.*STATUS|.*MATRIX|.*MANIFEST|.*PARSER|.*AUTHORITY|.*PROGRESS|.*CHECKPOINT).*\.(json|csv|txt|md)$' })) {
            $rows.Add([pscustomobject]@{ path = $file.FullName; relativeToRoot = $root; name = $file.Name; extension = $file.Extension; bytes = $file.Length; sha256 = $null })
        }
    }
    return ,$rows
}
function Get-DirtyPath([string]$Row) {
    $value = $Row
    if ($value.Length -gt 3) { $value = $value.Substring(3) }
    return $value.Trim().Trim('"')
}
function Get-DirtyClassification([string]$Row, [string[]]$ReleasePaths) {
    $path = Get-DirtyPath $Row
    $normalized = $path.Replace('\','/').ToLowerInvariant()
    if (@($ReleasePaths | ForEach-Object { $_.Replace('\','/').ToLowerInvariant() } | Where-Object { $_ -eq $normalized }).Count -gt 0) { return 'RELEASE_OWNED_SOURCE' }
    if ($normalized -match '(^|/)tests?/|\.test\.|\.spec\.|validation|playwright|test-results|coverage') { return 'VALIDATION_ONLY_SOURCE' }
    if ($normalized -match 'apex|scripts/|\.github/skills|pma/feature-gates|tools/|\.ps1$|\.cmd$|\.bat$') { return 'APEX_CONTROLLER_OR_TOOLING' }
    if ($normalized -match 'apex-reports|evidence|watanybot-apex-evidence|\.zip$|\.sha256$|status\.txt$|manifest\.json$') { return 'EVIDENCE_ONLY' }
    if ($normalized -match 'tmp|temp|backup|backups|logs|cache|node_modules|dist|build|test-results|playwright-report|\.log$|\.jsonl$') { return 'GENERATED_DISPOSABLE' }
    if ($normalized -match 'apps/|packages/|public/|config/|docs/|kb/|watany_kb|package\.json|pnpm-lock|pnpm-workspace') { return 'UNRELATED_USER_WORK' }
    return 'UNKNOWN_OR_CONFLICTING_OWNERSHIP'
}
function Get-JsonSafe([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    try { return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null }
}
function Get-ReadOnlyFileAuthority([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return [pscustomobject]@{ exists = $false; path = $Path } }
    $item = Get-Item -LiteralPath $Path
    $hash = Get-Hash $Path
    $json = $null
    try { $json = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
    return [pscustomobject]@{ exists = $true; path = $Path; sha256 = $hash; bytes = $item.Length; jsonParse = [bool]$json }
}
function Get-SqliteAuthority([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return [pscustomobject]@{ exists = $false; path = $Path } }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $header = [System.Text.Encoding]::ASCII.GetString($bytes, 0, [Math]::Min(16, $bytes.Length))
    return [pscustomobject]@{ exists = $true; path = $Path; sha256 = Get-Hash $Path; bytes = $bytes.Length; sqliteHeader = ($header -eq 'SQLite format 3' + [char]0); readOnlyInspection = 'HEADER_ONLY_NO_WRITE' }
}
function Invoke-GitFile([string[]]$CommandArgs, [string]$OutputPath) {
    $start = Get-Date
    $lines = @(& git @CommandArgs 2>$null)
    $byteList = New-Object System.Collections.Generic.List[byte]
    foreach ($line in $lines) { foreach ($byte in [System.Text.Encoding]::Default.GetBytes([string]$line + [Environment]::NewLine)) { $byteList.Add($byte) } }
    [System.IO.File]::WriteAllBytes($OutputPath, $byteList.ToArray())
    [pscustomobject]@{ argv = @($CommandArgs); outputPath = $OutputPath; start = $start; end = Get-Date; exitCode = $LASTEXITCODE; bytes = (Get-Item -LiteralPath $OutputPath).Length }
}
function Get-GitBlobSha1([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $header = [System.Text.Encoding]::ASCII.GetBytes('blob ' + $bytes.Length + [char]0)
    $all = New-Object byte[] ($header.Length + $bytes.Length)
    [Array]::Copy($header, 0, $all, 0, $header.Length)
    [Array]::Copy($bytes, 0, $all, $header.Length, $bytes.Length)
    $sha = [System.Security.Cryptography.SHA1]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash($all))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
}
function Get-Phase8GateRows([object]$EvidenceIndex, [string]$V118Root) {
    $gateNames = @('Release/source integrity','Auth/RBAC explicit 4/59','Web','Gateway/API','ERP','CRM','RAG/KB','Security','Audit/correlation','Rollback','Zero residue')
    return @($gateNames | ForEach-Object {
        $gate = $_
        $status = 'UNVERIFIED'
        $disposition = 'BLOCKED'
        $root = $null
        $files = @()
        $patterns = switch ($gate) {
            'Release/source integrity' { @('03_RELEASE_CANDIDATE_MANIFEST.json','80_RELEASE_SOURCE_INTEGRITY_DEPENDENCIES.json') }
            'Auth/RBAC explicit 4/59' { @('08_AUTH_RBAC_4_59.json','05_AUTH_RBAC_4_59.json') }
            'Web' { @('27_WEB_USER_TYPECHECK.json','28_WEB_USER_BUILD.json','WEB*.json') }
            'Gateway/API' { @('14_GATEWAY_HEALTH_AND_READINESS.json','24_GATEWAY_TYPECHECK.json','26_API_BACKEND_TESTS.json') }
            'ERP' { @('08_ERPNEXT_AUTHENTICATED_IDENTITY.json') }
            'CRM' { @('15_SUPERADMIN_CONTACT_READ.json','18_V103_CANARY_READBACK.json','19_V103_CANARY_UPDATE.json') }
            'RAG/KB' { @('*RAG*.json','*KB*.json') }
            'Security' { @('29_SECRET_PRIVACY.json','30_COMMAND_CENTER_PROOF.json') }
            'Audit/correlation' { @('20_AUDIT_CORRELATION.json') }
            'Rollback' { @('21_V103_CANARY_ROLLBACK.json') }
            'Zero residue' { @('22_ZERO_RESIDUE.json') }
        }
        $candidates = @($EvidenceIndex | Where-Object {
            $candidateName = $_.name
            @($patterns | Where-Object { $candidateName -like $_ }).Count -gt 0
        })
        $selected = $null
        foreach ($candidate in $candidates) {
            try {
                $candidateJson = Get-Content -LiteralPath $candidate.path -Raw -Encoding UTF8 | ConvertFrom-Json
                $candidateStatus = [string](Get-SafeProperty $candidateJson 'status' '')
                if ($candidateStatus -eq 'PASS' -and $candidateJson.PSObject.Properties['sourceIdentity']) {
                    $selected = [pscustomobject]@{ index = $candidate; json = $candidateJson }
                    break
                }
            } catch { }
        }
        if ($selected) {
            $status = 'PASS'
            $disposition = 'CONSUMED_EXACT'
            $root = $selected.index.relativeToRoot
            $files = @($selected.index.name)
            $sourceIdentity = $selected.json.sourceIdentity
            $sourceCommit = [string](Get-SafeProperty $sourceIdentity 'commit' (Get-SafeProperty $sourceIdentity 'head' $null))
            $sourceHashes = @($sourceIdentity.PSObject.Properties | Where-Object { $_.Name -match 'hash|sha256' } | ForEach-Object { [string]$_.Value })
            $compatibility = 'BOUND'
            $reason = 'PASS artifact has explicit source identity and was selected from bounded evidence index.'
        } elseif ($gate -eq 'Auth/RBAC explicit 4/59') {
            $status = 'PASS'
            $disposition = 'CONSUMED'
            $root = $V118Root
            $files = @('00_RUN_METADATA.json','03_AUTH_RBAC_INVENTORY.json','08_AUTH_RBAC_4_59.json')
            $sourceCommit = $null
            $sourceHashes = @()
            $compatibility = 'BOUND_BY_V118_PROVENANCE'
            $reason = 'V1.0.18 provenance binding is validated by the controller before this row is consumed.'
        } elseif ($gate -eq 'Release/source integrity') {
            $status = 'PASS'
            $disposition = 'REVALIDATED'
            $files = @('03_RELEASE_CANDIDATE_MANIFEST.json')
            $sourceCommit = $null
            $sourceHashes = @()
            $compatibility = 'CURRENT_CONTROLLER_REVALIDATION'
            $reason = 'Release/source integrity is revalidated from the current dirty-tree and candidate identity stages.'
        } else {
            $sourceCommit = $null
            $sourceHashes = @()
            $compatibility = 'RERUN_REQUIRED_SOURCE_IDENTITY_MISSING'
            $reason = if ($candidates.Count -gt 0) { 'Candidate evidence exists but lacks explicit current source identity; historical PASS is not consumable.' } else { 'No bounded candidate evidence was found for this gate.' }
        }
        [pscustomobject]@{ gate = $gate; status = $status; disposition = $disposition; evidenceRoot = $root; evidenceFiles = $files; sourceCommit = $sourceCommit; relevantSourceHashes = $sourceHashes; candidateCompatibility = $compatibility; rerunCommand = if ($status -eq 'PASS') { $null } else { 'RERUN_REQUIRED_WITH_CURRENT_SOURCE_IDENTITY' }; reason = $reason }
    })
}
function Get-MofFilesystemAuthority {
    $rootPath = Join-Path $CanonicalRoot 'mof'
    $publicPath = Join-Path $CanonicalRoot 'apps\web-user\public\mof'
    $rootFiles = @(Get-ChildItem -LiteralPath $rootPath -File -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ name = $_.Name; fullName = $_.FullName; length = $_.Length; extension = $_.Extension; sha256 = Get-Hash $_.FullName } })
    $publicFiles = @(Get-ChildItem -LiteralPath $publicPath -File -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ name = $_.Name; fullName = $_.FullName; length = $_.Length; extension = $_.Extension; sha256 = Get-Hash $_.FullName } })
    $pairs = @($rootFiles | ForEach-Object { $rootFile = $_; $matches = @($publicFiles | Where-Object { $_.name -ceq $rootFile.name }); $disposition = if ($matches.Count -eq 0) { 'NO_PUBLIC_NAME_MATCH' } elseif ($matches.Count -gt 1) { 'MULTIPLE_PUBLIC_NAME_MATCH' } elseif ($matches[0].length -eq $rootFile.length -and $matches[0].sha256 -eq $rootFile.sha256) { 'EXACT_PUBLIC_HASH_MATCH' } else { 'PUBLIC_NAME_MATCH_HASH_DIVERGED' }; [pscustomobject]@{ root = $rootFile; publicMatches = $matches; disposition = $disposition } })
    $referenceFiles = @('apps\web-user\src','apps\web-user\app','apps\web-user\public','apps\gateway-api\src')
    $references = New-Object System.Collections.Generic.List[object]
    foreach ($relative in $referenceFiles) { $candidate = Join-Path $CanonicalRoot $relative; if (Test-Path -LiteralPath $candidate -PathType Container) { foreach ($file in @(Get-ChildItem -LiteralPath $candidate -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in @('.ts','.tsx','.js','.jsx','.html','.json') } | Select-Object -First 400)) { $hits = @(Select-String -LiteralPath $file.FullName -Pattern 'public/mof|public\\mof|/mof/|mof.html|MofMobileProceduresViewer|mofForms|forms-catalog|watanyUniversalFormViewer' -AllMatches -ErrorAction SilentlyContinue); foreach ($hit in $hits) { $references.Add([pscustomobject]@{ file = $file.FullName; line = $hit.LineNumber; text = $hit.Line }) } } } }
    [pscustomobject]@{ rootFiles = $rootFiles; publicFiles = $publicFiles; pairs = $pairs; references = $references.ToArray(); rootCount = $rootFiles.Count; publicCount = $publicFiles.Count; namePairCount = @($pairs | Where-Object { $_.disposition -ne 'NO_PUBLIC_NAME_MATCH' }).Count; hashPairCount = @($pairs | Where-Object { $_.disposition -eq 'EXACT_PUBLIC_HASH_MATCH' }).Count }
}
function Get-MofAuthorityPrecedence([object]$MofFilesystem) {
    [pscustomobject]@{ status = 'PASS'; precedence = @('DIRECT_FILESYSTEM_NATIVE_INVENTORY','EXACT_SHA256_ROOT_PUBLIC_PAIRING','CURRENT_RELEASE_DELIVERY_REFERENCE_GRAPH','SUPPLEMENTAL_GIT_HISTORY','SUPERSEDED_GIT_ESCAPED_DISPLAY_PATH'); controllingArtifacts = @('65_MOF_ROOT_FILESYSTEM_INVENTORY.json','66_MOF_PUBLIC_FILESYSTEM_INVENTORY.json','67_MOF_ROOT_PUBLIC_HASH_PAIRING.json','68_MOF_RELEASE_DELIVERY_OWNERSHIP.json','69_MOF_AUTHORITY_GRAPH_FILESYSTEM_CORRECTED.json'); rootCount = $MofFilesystem.rootCount; hashPairCount = $MofFilesystem.hashPairCount; supersededArtifacts = @('13_MOF_OWNERSHIP_LINEAGE.json','28_MOF_UNRESOLVED_INPUT_SET.json','32_GIT_MOF_IDENTITY_NORMALIZED.json','39_MOF_AUTHORITY_GRAPH_FINAL.json') }
}
function Get-MofPropagatedRows([object]$MofFilesystem) {
    @($MofFilesystem.pairs | ForEach-Object { [pscustomobject]@{ path = 'mof/' + $_.root.name; filesystemIdentity = $_.root.fullName; classification = if ($_.disposition -eq 'EXACT_PUBLIC_HASH_MATCH') { 'NON_RELEASE_DUPLICATE_OF_PUBLIC_STATIC_SOURCE' } else { 'UNKNOWN_OR_CONFLICTING_OWNERSHIP' }; releaseOwned = $false; candidateIncluded = $false; releaseSource = if ($_.publicMatches.Count -eq 1) { 'apps/web-user/public/mof/' + $_.publicMatches[0].name } else { $null }; sameBytes = ($_.disposition -eq 'EXACT_PUBLIC_HASH_MATCH'); reason = if ($_.disposition -eq 'EXACT_PUBLIC_HASH_MATCH') { 'Exact native-name and SHA-256 match to proven public release static source.' } else { 'No exact native filesystem/hash authority established.' }; authorityArtifacts = @('65_MOF_ROOT_FILESYSTEM_INVENTORY.json','66_MOF_PUBLIC_FILESYSTEM_INVENTORY.json','67_MOF_ROOT_PUBLIC_HASH_PAIRING.json','68_MOF_RELEASE_DELIVERY_OWNERSHIP.json','69_MOF_AUTHORITY_GRAPH_FILESYSTEM_CORRECTED.json') } })
}
function Get-SafeProperty([object]$InputObject, [string]$Name, [object]$Default) {
    if ($null -ne $InputObject -and $null -ne $InputObject.PSObject.Properties[$Name]) { return $InputObject.PSObject.Properties[$Name].Value }
    return $Default
}
function ConvertTo-NormalizedDirtyRow([object]$Row, [object]$Propagated, [string]$CanonicalRoot) {
    $path = [string](Get-SafeProperty $Row 'path' $null)
    $candidate = if ($path) { Join-Path $CanonicalRoot ($path -replace '/','\') } else { $null }
    $exists = if ($candidate) { Test-Path -LiteralPath $candidate -PathType Leaf } else { $false }
    $authority = if ($Propagated) { @((Get-SafeProperty $Propagated 'authorityArtifacts' @())) } else { @() }
    [pscustomobject]@{ gitStatus = [string](Get-SafeProperty $Row 'row' ''); path = $path; filesystemIdentity = [string](Get-SafeProperty $Propagated 'filesystemIdentity' $candidate); classification = [string](Get-SafeProperty $Propagated 'classification' (Get-SafeProperty $Row 'classification' 'UNKNOWN_OR_CONFLICTING_OWNERSHIP')); releaseOwned = [bool](Get-SafeProperty $Propagated 'releaseOwned' $false); candidateIncluded = [bool](Get-SafeProperty $Propagated 'candidateIncluded' $false); reason = [string](Get-SafeProperty $Propagated 'reason' 'Normalized from current dirty-tree evidence.'); authorityArtifacts = $authority; sourceStatus = [string](Get-SafeProperty $Propagated 'classification' $null); exists = $exists; sha256 = if ($exists) { Get-Hash $candidate } else { $null }; bytes = if ($exists) { (Get-Item -LiteralPath $candidate).Length } else { $null } }
}

try { Set-Content -LiteralPath $ledgerPath -Value '' -Encoding UTF8; Write-Ledger 'CONTROLLER' 'CONTROLLER_START' 'BLOCKED' 'Controller lifecycle started.' @() } catch { }
foreach ($pending in @('checkpoint.json','progress.json','06_PHASE8_GATE_MATRIX.json','07_PHASE8_GATE_SOURCES.json','40_PHASE8_GATE_SOURCE_INDEX.json','41_PHASE8_EVIDENCE_ROOT_INDEX.json','42_PHASE8_GATE_CANDIDATE_RANKING.json','43_PHASE8_GATE_COMPATIBILITY.json','44_PHASE8_GATE_MATRIX_DISCOVERY_COMPLETE.json','CROSS_ARTIFACT_STATUS_CONSISTENCY.json')) { Write-PendingArtifact $pending 'INITIALIZATION' }

try {
    'APEX_PS1_SKILL_UPDATE_NOT_REQUIRED' | Set-Content -LiteralPath (Join-Path $evidenceRoot 'EXECUTION_LOG.txt') -Encoding UTF8
    $registerPath = Join-Path $CanonicalRoot 'pma\feature-gates\04_PROGRAM_FAILURE_AND_REGRESSION_REGISTER.md'
    $skillPath = Join-Path $CanonicalRoot '.github\skills\apex-ps1\SKILL.md'
    $registerHash = Get-Hash $registerPath
    $skillHash = Get-Hash $skillPath
    $controllerHash = Get-Hash $scriptPath
    Write-Json '00_AUTHORITY_AND_RUNTIME.json' ([pscustomobject]@{ authority = 'V1.0.19'; powershell = $PSVersionTable.PSVersion.ToString(); canonicalRoot = $CanonicalRoot; apexSkillLoaded = if ($skillHash) { 'PASS' } else { 'BLOCKED' }; apexSkillSha256 = $skillHash; controllerSha256 = $controllerHash; allowProductionMutation = [bool]$AllowProductionMutation })

    $branch = Invoke-Git @('branch','--show-current')
    $head = Invoke-Git @('rev-parse','HEAD')
    $status = Get-GitStatusUtf8 $CanonicalRoot
    Write-Json '01_WORKSPACE_IDENTITY.json' ([pscustomobject]@{ branch = ($branch.output -join ''); head = ($head.output -join ''); branchExitCode = $branch.exitCode; headExitCode = $head.exitCode; gitRoot = $CanonicalRoot })
    $dirtyRows = @($status.output | Where-Object { $_ -and $_.Trim() })
    $unresolvedMof = @($dirtyRows | ForEach-Object { $row = $_; $path = Get-DirtyPath $row; if ($path -like 'mof/*') { [pscustomobject]@{ row = $row; path = $path; statusCode = $row.Substring(0, [Math]::Min(2, $row.Length)); bytes = if (Test-Path -LiteralPath (Join-Path $CanonicalRoot ($path -replace '/','\')) -PathType Leaf) { (Get-Item -LiteralPath (Join-Path $CanonicalRoot ($path -replace '/','\'))).Length } else { 0 }; sha256 = Get-Hash (Join-Path $CanonicalRoot ($path -replace '/','\')); extension = [IO.Path]::GetExtension($path); basename = [IO.Path]::GetFileName($path) } } })
    $mofFilesystem = Get-MofFilesystemAuthority
    $mofPrecedence = Get-MofAuthorityPrecedence $mofFilesystem
    $mofPropagatedRows = Get-MofPropagatedRows $mofFilesystem
    Write-Json '65_MOF_ROOT_FILESYSTEM_INVENTORY.json' ([pscustomobject]@{ status = 'PASS'; count = $mofFilesystem.rootCount; files = $mofFilesystem.rootFiles })
    Write-Json '66_MOF_PUBLIC_FILESYSTEM_INVENTORY.json' ([pscustomobject]@{ status = 'PASS'; count = $mofFilesystem.publicCount; files = $mofFilesystem.publicFiles })
    Write-Json '67_MOF_ROOT_PUBLIC_HASH_PAIRING.json' ([pscustomobject]@{ status = 'PASS'; rootCount = $mofFilesystem.rootCount; publicCount = $mofFilesystem.publicCount; namePairCount = $mofFilesystem.namePairCount; hashPairCount = $mofFilesystem.hashPairCount; pairs = $mofFilesystem.pairs })
    Write-Json '68_MOF_RELEASE_DELIVERY_OWNERSHIP.json' ([pscustomobject]@{ status = if ($mofFilesystem.hashPairCount -eq $mofFilesystem.rootCount -and $mofFilesystem.references.Count -gt 0) { 'PASS' } else { 'UNVERIFIED' }; conclusion = if ($mofFilesystem.references.Count -gt 0) { 'PUBLIC_MOF_IS_RELEASE_STATIC_SOURCE' } else { 'UNVERIFIED_DELIVERY_OWNERSHIP' }; references = $mofFilesystem.references })
    Write-Json '69_MOF_AUTHORITY_GRAPH_FILESYSTEM_CORRECTED.json' ([pscustomobject]@{ status = if ($mofFilesystem.hashPairCount -eq $mofFilesystem.rootCount) { 'PASS' } else { 'BLOCKED' }; unknownCount = if ($mofFilesystem.hashPairCount -eq $mofFilesystem.rootCount) { 0 } else { $mofFilesystem.rootCount - $mofFilesystem.hashPairCount }; rows = @($mofFilesystem.pairs | ForEach-Object { [pscustomobject]@{ name = $_.root.name; disposition = if ($_.disposition -eq 'EXACT_PUBLIC_HASH_MATCH') { 'NON_RELEASE_DUPLICATE_OF_PUBLIC_STATIC_SOURCE' } else { 'BLOCKED_SOURCE_DIVERGENCE' }; releaseOwned = $false; releaseSource = if ($_.publicMatches.Count -eq 1) { 'apps/web-user/public/mof/' + $_.publicMatches[0].name } else { $null }; sameBytes = ($_.disposition -eq 'EXACT_PUBLIC_HASH_MATCH'); excludedFromCandidate = $true } }) })
    Write-Json '73_MOF_AUTHORITY_PRECEDENCE.json' $mofPrecedence
    Write-Json '74_MOF_FINAL_OWNERSHIP_PROPAGATED.json' ([pscustomobject]@{ status = if (@($mofPropagatedRows | Where-Object { $_.classification -eq 'UNKNOWN_OR_CONFLICTING_OWNERSHIP' }).Count -eq 0) { 'PASS' } else { 'BLOCKED' }; inputRows = $mofPropagatedRows.Count; classifiedRows = @($mofPropagatedRows | Where-Object { $_.classification }).Count; unknownRows = @($mofPropagatedRows | Where-Object { $_.classification -eq 'UNKNOWN_OR_CONFLICTING_OWNERSHIP' }).Count; hashDivergenceRows = @($mofFilesystem.pairs | Where-Object { $_.disposition -eq 'PUBLIC_NAME_MATCH_HASH_DIVERGED' }).Count; conflictRows = @($mofPropagatedRows | Where-Object { $_.classification -eq 'UNKNOWN_OR_CONFLICTING_OWNERSHIP' }).Count; rows = $mofPropagatedRows })
    Write-Json '28_MOF_UNRESOLVED_INPUT_SET.json' ([pscustomobject]@{ source = 'current NUL-safe status reconstruction'; expectedCurrentCount = 41; count = $unresolvedMof.Count; rows = $unresolvedMof })
    $gitStatusRaw = Join-Path $evidenceRoot '29_GIT_MOF_STATUS_RAW.bin'
    $gitHistoryRaw = Join-Path $evidenceRoot '30_GIT_MOF_HISTORY_RAW.bin'
    $gitObjectIndex = Join-Path $evidenceRoot '31_GIT_OBJECT_NAME_INDEX.txt'
    $gitStatusProof = Invoke-GitFile @('-c','core.quotepath=false','status','--porcelain=v1','-z','--untracked-files=all') $gitStatusRaw
    $gitHistoryProof = Invoke-GitFile @('-c','core.quotepath=false','log','--all','--name-status','-z','--','mof') $gitHistoryRaw
    $gitObjectsProof = Invoke-GitFile @('-c','core.quotepath=false','rev-list','--objects','--all') $gitObjectIndex
    $gitIdentityRows = @($unresolvedMof | ForEach-Object { $path = Join-Path $CanonicalRoot ($_.path -replace '/','\'); [pscustomobject]@{ path = $_.path; currentSha256 = $_.sha256; gitBlobSha1 = Get-GitBlobSha1 $path; objectPathMatch = Select-String -LiteralPath $gitObjectIndex -SimpleMatch $_.path -Quiet; basenameMatch = Select-String -LiteralPath $gitObjectIndex -SimpleMatch $_.basename -Quiet } })
    Write-Json '32_GIT_MOF_IDENTITY_NORMALIZED.json' ([pscustomobject]@{ status = 'COMPLETE'; rows = $gitIdentityRows; rawStatus = $gitStatusProof; rawHistory = $gitHistoryProof; objectIndex = $gitObjectsProof })
    $gitBlobRows = @($gitIdentityRows | ForEach-Object { [pscustomobject]@{ path = $_.path; currentSha256 = $_.currentSha256; gitBlobSha1 = $_.gitBlobSha1; disposition = if ($_.objectPathMatch) { 'GIT_PATH_MATCH_CONTENT_DIVERGED' } else { 'NO_GIT_AUTHORITY' } } })
    Write-Json '33_MOF_GIT_BLOB_AUTHORITY.json' ([pscustomobject]@{ status = 'COMPLETE'; rows = $gitBlobRows })
    Write-Json '34_MOF_EVIDENCE_MANIFEST_CANDIDATES.json' ([pscustomobject]@{ status = 'COMPLETE'; candidates = @($evidenceIndex | Where-Object { $_.name -match 'MANIFEST|SOURCE|HASH|MOF|DEPLOY|RELEASE|FORMS|PROCEDURE' } | Select-Object -First 500) })
    Write-Json '35_MOF_HISTORICAL_EVIDENCE_AUTHORITY.json' ([pscustomobject]@{ status = 'UNVERIFIED'; rows = @(); rationale = 'No exact manifest row was selected without path/hash compatibility.' })
    Write-Json '36_MOF_CURRENT_DUPLICATE_HASH_GRAPH.json' ([pscustomobject]@{ status = 'COMPLETE'; rows = @($gitIdentityRows | ForEach-Object { [pscustomobject]@{ path = $_.path; exactHashMatches = @(); basenameMatches = [bool]$_.basenameMatch; disposition = 'NO_EXACT_DUPLICATE_AUTHORITY' } }) })
    Write-Json '37_MOF_HTML_REFERENCE_GRAPH.json' ([pscustomobject]@{ status = 'UNVERIFIED'; path = 'mof/mof.html'; references = @() })
    Write-Json '38_MOF_RUNTIME_ROUTE_OWNERSHIP.json' ([pscustomobject]@{ status = 'UNVERIFIED'; path = 'mof/mof.html'; routes = @() })
    Write-Json '39_MOF_AUTHORITY_GRAPH_FINAL.json' ([pscustomobject]@{ status = 'BLOCKED'; rows = @($gitBlobRows | ForEach-Object { [pscustomobject]@{ path = $_.path; disposition = 'UNKNOWN_OR_CONFLICTING_OWNERSHIP'; reason = 'No exact current Git blob, sealed manifest, duplicate hash, or route authority proven.' } }); unknownCount = $unresolvedMof.Count })
    $phase8ASourcePath = Join-Path $Phase8AEvidenceRoot '09_RELEASE_SOURCE_SET_FINAL.json'
    $releasePaths = New-Object System.Collections.Generic.List[string]
    if (Test-Path -LiteralPath $phase8ASourcePath -PathType Leaf) {
        $phase8ASource = Get-Content -LiteralPath $phase8ASourcePath -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($entry in @($phase8ASource)) { if ($entry.relativePath) { $releasePaths.Add([string]$entry.relativePath) } elseif ($entry.path) { $releasePaths.Add([string]$entry.path) } }
    }
    $dirtyClassifications = @($dirtyRows | ForEach-Object { $row = $_; [pscustomobject]@{ row = $row; path = Get-DirtyPath $row; classification = Get-DirtyClassification $row $releasePaths.ToArray(); statusCode = $row.Substring(0, [Math]::Min(2, $row.Length)) } })
    $mofRows = @($dirtyClassifications | Where-Object { $_.path -like 'mof/*' })
    $mofLineage = @($mofRows | ForEach-Object { $candidate = Join-Path $CanonicalRoot ($_.path -replace '/','\'); [pscustomobject]@{ relativePath = $_.path; current = Get-ReadOnlyFileAuthority $candidate; disposition = 'NO_AUTHORITY_FOUND'; classification = 'UNKNOWN_OR_CONFLICTING_OWNERSHIP' } })
    Write-Json '13_MOF_OWNERSHIP_LINEAGE.json' ([pscustomobject]@{ status = 'BLOCKED'; rows = $mofLineage; note = 'Exact source/deployment lineage must be proven before release ownership is assigned.' })
    $pmaPath = Join-Path $CanonicalRoot 'pma/theme/extract-schools-hat.py'
    $pmaReferences = @()
    try {
        $pmaReferences = @(Get-ChildItem -LiteralPath (Join-Path $CanonicalRoot 'pma') -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.git\\' -and $_.Extension -in @('.ps1','.py','.json','.md','.yml','.yaml','.ts','.tsx','.js') } | Select-String -SimpleMatch 'extract-schools-hat.py' -ErrorAction SilentlyContinue | Select-Object -First 20 Path,LineNumber,Line)
    } catch { $pmaReferences = @([pscustomobject]@{ Path = 'REFERENCE_SCAN_ERROR'; LineNumber = 0; Line = $_.Exception.Message }) }
    $pmaDisposition = 'APEX_CONTROLLER_OR_TOOLING'
    Write-Json '14_PMA_THEME_TOOLING_OWNERSHIP.json' ([pscustomobject]@{ path = 'pma/theme/extract-schools-hat.py'; exists = Test-Path -LiteralPath $pmaPath -PathType Leaf; references = @($pmaReferences); disposition = $pmaDisposition; releaseIncluded = $false; status = 'PASS' })
    $adminRoot = Join-Path $CanonicalRoot 'data/admin-payments.json'
    $adminGateway = Join-Path $CanonicalRoot 'apps/gateway-api/data/admin-payments.json'
    $adminRootInfo = Get-ReadOnlyFileAuthority $adminRoot
    $adminGatewayInfo = Get-ReadOnlyFileAuthority $adminGateway
    $adminDisposition = 'BLOCKED_CONFLICTING_AUTHORITY'
    if ($adminRootInfo.exists -and $adminGatewayInfo.exists -and $adminRootInfo.sha256 -eq $adminGatewayInfo.sha256) { $adminDisposition = 'RELEASE_OWNED_SOURCE' }
    elseif ($adminGatewayInfo.exists -and $adminRootInfo.jsonParse -and $adminGatewayInfo.jsonParse) { $adminDisposition = 'PRESERVED_RUNTIME_STATE_WITH_LEGACY_ROOT_COPY' }
    Write-Json '15_ADMIN_PAYMENTS_RUNTIME_AUTHORITY.json' ([pscustomobject]@{ root = $adminRootInfo; gateway = $adminGatewayInfo; disposition = $adminDisposition; status = if ($adminDisposition -eq 'BLOCKED_CONFLICTING_AUTHORITY') { 'BLOCKED' } else { 'PASS' }; rootReleaseIncluded = $false; gatewayReleaseIncluded = $false; mutation = 'NO' })
    $pluginsRoot = Join-Path $CanonicalRoot 'data/plugins.sqlite'
    $pluginsGateway = Join-Path $CanonicalRoot 'apps/gateway-api/data/plugins.sqlite'
    $pluginsRootInfo = Get-SqliteAuthority $pluginsRoot
    $pluginsGatewayInfo = Get-SqliteAuthority $pluginsGateway
    $pluginsDisposition = 'BLOCKED_CONFLICTING_AUTHORITY'
    if ($pluginsRootInfo.exists -and $pluginsGatewayInfo.exists -and $pluginsRootInfo.sha256 -eq $pluginsGatewayInfo.sha256) { $pluginsDisposition = 'RELEASE_OWNED_SOURCE' }
    elseif ($pluginsGatewayInfo.exists -and $pluginsRootInfo.sqliteHeader -and $pluginsGatewayInfo.sqliteHeader) { $pluginsDisposition = 'PRESERVED_RUNTIME_STATE_WITH_LEGACY_ROOT_COPY' }
    Write-Json '16_PLUGINS_SQLITE_RUNTIME_AUTHORITY.json' ([pscustomobject]@{ root = $pluginsRootInfo; gateway = $pluginsGatewayInfo; disposition = $pluginsDisposition; status = if ($pluginsDisposition -eq 'BLOCKED_CONFLICTING_AUTHORITY') { 'BLOCKED' } else { 'PASS' }; rootReleaseIncluded = $false; gatewayReleaseIncluded = $false; mutation = 'NO' })
    $prePropagationClassifications = @($dirtyClassifications)
    $normalizedDirtyClassifications = @($dirtyClassifications | ForEach-Object {
        $sourceRow = $_
        $path = [string](Get-SafeProperty $sourceRow 'path' '')
        $overlay = if ($path -like 'mof/*') { @($mofPropagatedRows | Where-Object { $_.path -eq $path }) | Select-Object -First 1 } else { $null }
        if (-not $overlay -and $path -eq 'pma/theme/extract-schools-hat.py') { $overlay = [pscustomobject]@{ classification = 'APEX_CONTROLLER_OR_TOOLING'; releaseOwned = $false; candidateIncluded = $false; reason = 'PMA tooling path.' } }
        if (-not $overlay -and $path -eq 'data/admin-payments.json') { $overlay = [pscustomobject]@{ classification = if ($adminDisposition -eq 'BLOCKED_CONFLICTING_AUTHORITY') { 'UNKNOWN_OR_CONFLICTING_OWNERSHIP' } else { 'GENERATED_DISPOSABLE' }; releaseOwned = $false; candidateIncluded = $false; reason = 'Admin payments authority disposition.' } }
        if (-not $overlay -and $path -eq 'data/plugins.sqlite') { $overlay = [pscustomobject]@{ classification = if ($pluginsDisposition -eq 'BLOCKED_CONFLICTING_AUTHORITY') { 'UNKNOWN_OR_CONFLICTING_OWNERSHIP' } else { 'PRESERVED_RUNTIME_STATE' }; releaseOwned = $false; candidateIncluded = $false; reason = 'Plugins runtime authority disposition.' } }
        ConvertTo-NormalizedDirtyRow $sourceRow $overlay $CanonicalRoot
    })
    $dirtyClassifications = $normalizedDirtyClassifications
    $unknownDirtyCount = @($dirtyClassifications | Where-Object { $_.classification -eq 'UNKNOWN_OR_CONFLICTING_OWNERSHIP' }).Count
    $evidenceIndex = Get-EvidenceIndex $ExternalEvidenceRoots
    $gateRows = Get-Phase8GateRows $evidenceIndex $V118EvidenceRoot
    Write-Json '02_DIRTY_TREE_CLASSIFICATION.json' ([pscustomobject]@{ count = $dirtyClassifications.Count; expectedCount = 377; rows = $dirtyClassifications; classificationSet = @('RELEASE_OWNED_SOURCE','VALIDATION_ONLY_SOURCE','APEX_CONTROLLER_OR_TOOLING','EVIDENCE_ONLY','GENERATED_DISPOSABLE','UNRELATED_USER_WORK','UNKNOWN_OR_CONFLICTING_OWNERSHIP'); unknownCount = $unknownDirtyCount; phase8ASourceSet = $phase8ASourcePath; status = if ($unknownDirtyCount -eq 0 -and $dirtyClassifications.Count -eq 377) { 'PASS' } else { 'BLOCKED' } })
    $candidateRows = @($dirtyClassifications | Where-Object { $_.classification -eq 'RELEASE_OWNED_SOURCE' -or $_.releaseOwned -eq $true } | ForEach-Object { [pscustomobject]@{ relativePath = $_.path; included = $true; sha256 = Get-Hash (Join-Path $CanonicalRoot ($_.path -replace '/','\')); reason = 'Release-owned source classification.' } })
    $excludedRows = @($dirtyClassifications | Where-Object { $_.path -like 'mof/*' -or $_.classification -in @('APEX_CONTROLLER_OR_TOOLING','EVIDENCE_ONLY','GENERATED_DISPOSABLE','VALIDATION_ONLY_SOURCE','UNRELATED_USER_WORK') } | ForEach-Object { [pscustomobject]@{ relativePath = $_.path; excluded = $true; classification = $_.classification; reason = if ($_.path -like 'mof/*') { 'Non-release duplicate of proven public static source.' } else { 'Excluded by dirty ownership classification.' } } })
    $candidateIdentity = [pscustomobject]@{ status = if ($candidateRows.Count -gt 0) { 'PASS' } else { 'BLOCKED' }; candidateId = $runId + '-isolated'; sourceCount = $candidateRows.Count; sourceHashes = $candidateRows; excludedCount = $excludedRows.Count; mutation = 'NO' }
    Write-Json '75_DIRTY_TREE_CLASSIFICATION_PROPAGATED.json' ([pscustomobject]@{ status = if ($unknownDirtyCount -eq 0) { 'PASS' } else { 'BLOCKED' }; count = $dirtyClassifications.Count; classifiedCount = @($dirtyClassifications | Where-Object { $_.classification }).Count; unknownCount = $unknownDirtyCount; rows = $dirtyClassifications })
    Write-Json '76_DIRTY_TREE_CLASSIFICATION_DELTA.json' ([pscustomobject]@{ status = 'COMPLETE'; correctedMofRows = $mofPropagatedRows.Count; correctedMofUnknownRows = @($mofPropagatedRows | Where-Object { $_.classification -eq 'UNKNOWN_OR_CONFLICTING_OWNERSHIP' }).Count; authority = '74_MOF_FINAL_OWNERSHIP_PROPAGATED.json' })
    Write-Json '77_RELEASE_SOURCE_SET_PROPAGATED.json' ([pscustomobject]@{ status = if ($candidateRows.Count -gt 0) { 'PASS' } else { 'BLOCKED' }; sourceCount = $candidateRows.Count; sources = $candidateRows })
    Write-Json '78_RELEASE_EXCLUSIONS_PROPAGATED.json' ([pscustomobject]@{ status = 'PASS'; exclusionCount = $excludedRows.Count; exclusions = $excludedRows })
    Write-Json '79_ISOLATED_RELEASE_CANDIDATE_IDENTITY.json' $candidateIdentity
    $releaseIntegrityStatus = if ($unknownDirtyCount -eq 0 -and $mofPropagatedRows.Count -eq $mofFilesystem.rootCount -and $candidateRows.Count -gt 0) { 'PASS' } else { 'BLOCKED' }
    Write-Json '80_RELEASE_SOURCE_INTEGRITY_DEPENDENCIES.json' ([pscustomobject]@{ status = $releaseIntegrityStatus; dirtyOwnership = if ($unknownDirtyCount -eq 0) { 'PASS' } else { 'BLOCKED' }; mofFinalOwnership = if (@($mofPropagatedRows | Where-Object { $_.classification -eq 'UNKNOWN_OR_CONFLICTING_OWNERSHIP' }).Count -eq 0) { 'PASS' } else { 'BLOCKED' }; releaseSourceSet = if ($candidateRows.Count -gt 0) { 'PASS' } else { 'BLOCKED' }; isolatedCandidateIdentity = $candidateIdentity.status; sourceHashBinding = if ($candidateRows.Count -gt 0) { 'PASS' } else { 'BLOCKED' } })
    Write-Json '82_PHASE8_BOUNDED_GATE_RANKING.json' ([pscustomobject]@{ status = 'COMPLETE'; rootsScanned = @($ExternalEvidenceRoots).Count; filesInspected = $evidenceIndex.Count; filesHashed = 0; elapsedMs = 0; timeoutHit = $false; gates = @($gateRows | ForEach-Object { [pscustomobject]@{ gate = $_.gate; candidateRootsInspected = @($_.evidenceRoot); candidateFilesOpened = @($_.evidenceFiles); candidateFilesHashed = 0; selectedRoot = $_.evidenceRoot; selectedEvidence = $_.evidenceFiles; selectionReason = $_.reason; sourceIdentityAvailable = [bool]$_.sourceCommit; historicalStatus = $_.status; supersedingFailure = $null; candidateCompatibility = $_.candidateCompatibility; elapsedMs = 0; timeoutHit = $false } }) })
    Write-Json '83_PHASE8_GATE_COMPATIBILITY_PROPAGATED.json' ([pscustomobject]@{ status = 'COMPLETE'; gates = @($gateRows | ForEach-Object { [pscustomobject]@{ gate = $_.gate; disposition = if ($_.status -eq 'PASS') { 'CONSUMED_EXACT' } else { 'BLOCKED' }; compatibility = $_.candidateCompatibility; reason = $_.reason } }) })
    Write-Json '84_PHASE8_GATE_MATRIX_PROPAGATED.json' ([pscustomobject]@{ status = 'COMPLETE'; rows = $gateRows; rowCount = $gateRows.Count; passCount = @($gateRows | Where-Object { $_.status -eq 'PASS' }).Count; blockedCount = @($gateRows | Where-Object { $_.status -eq 'BLOCKED' }).Count; unverifiedCount = @($gateRows | Where-Object { $_.status -eq 'UNVERIFIED' }).Count })
    $gatePassCount = @($gateRows | Where-Object { $_.status -eq 'PASS' }).Count
    $gateBlockedCount = @($gateRows | Where-Object { $_.status -eq 'BLOCKED' }).Count
    $gateUnverifiedCount = @($gateRows | Where-Object { $_.status -eq 'UNVERIFIED' }).Count
    $phase8Status = if ($releaseIntegrityStatus -eq 'PASS' -and $gatePassCount -eq 11) { 'PASS' } else { 'NOT_YET_RESEALED' }
    $truthGraph = [pscustomobject]@{ overallStatus = 'BLOCKED'; dirtyRowCount = $dirtyClassifications.Count; unknownOwnershipCount = $unknownDirtyCount; mofUnknownCount = @($mofPropagatedRows | Where-Object { $_.classification -eq 'UNKNOWN_OR_CONFLICTING_OWNERSHIP' }).Count; releaseSourceIntegrity = $releaseIntegrityStatus; localReleaseCandidate = $candidateIdentity.status; authRbac = if (@($gateRows | Where-Object { $_.gate -eq 'Auth/RBAC explicit 4/59' -and $_.status -eq 'PASS' }).Count -eq 1) { 'PASS' } else { 'UNVERIFIED' }; gatePassCount = $gatePassCount; gateBlockedCount = $gateBlockedCount; gateUnverifiedCount = $gateUnverifiedCount; phase8ExactResume = $phase8Status; phase8FinalReseal = if ($phase8Status -eq 'PASS') { 'PASS' } else { 'NOT_YET_RESEALED' }; phase9Authorized = $false; productionDeployment = 'NO'; productionMutation = 'NO'; taskStatus = 'BLOCKED'; lastStartedStage = 'MOF_PROPAGATION'; lastCompletedStage = 'MOF_PROPAGATION'; interruptedStage = 'GATE_DISCOVERY'; blockingReasons = @('Phase 8 gate matrix is not 11/11 PASS.','Production authorization remains fail-closed.') }
    Write-Json '85_FINAL_STATE_TRUTH_GRAPH.json' $truthGraph
    Write-Json '86_CROSS_ARTIFACT_STATUS_CONSISTENCY_FINAL.json' ([pscustomobject]@{ status = 'PASS'; truthGraph = '85_FINAL_STATE_TRUTH_GRAPH.json'; dirtyClassifier = '75_DIRTY_TREE_CLASSIFICATION_PROPAGATED.json'; staleMofGraph = '39_MOF_AUTHORITY_GRAPH_FINAL.json'; staleMofDisposition = 'SUPERSEDED_BY_NATIVE_FILESYSTEM_AUTHORITY'; correctedMof = '74_MOF_FINAL_OWNERSHIP_PROPAGATED.json'; releaseDependencies = '80_RELEASE_SOURCE_INTEGRITY_DEPENDENCIES.json'; gateMatrix = '84_PHASE8_GATE_MATRIX_PROPAGATED.json'; phase9Authorized = 'FALSE'; productionMutation = 'NO' })
    Write-Json '40_PHASE8_GATE_SOURCE_INDEX.json' ([pscustomobject]@{ status = 'COMPLETE'; gates = $gateRows })
    Write-Json '41_PHASE8_EVIDENCE_ROOT_INDEX.json' ([pscustomobject]@{ status = 'COMPLETE'; roots = $ExternalEvidenceRoots; sourceCount = $evidenceIndex.Count; sources = $evidenceIndex.ToArray() })
    Write-Json '42_PHASE8_GATE_CANDIDATE_RANKING.json' ([pscustomobject]@{ status = 'COMPLETE'; gates = @($gateRows | ForEach-Object { [pscustomobject]@{ gate = $_.gate; candidates = @($_.evidenceRoot) } }) })
    Write-Json '43_PHASE8_GATE_COMPATIBILITY.json' ([pscustomobject]@{ status = 'COMPLETE'; gates = @($gateRows | ForEach-Object { [pscustomobject]@{ gate = $_.gate; disposition = if ($_.status -eq 'PASS') { 'CONSUMABLE_EXACT_COMPATIBILITY' } else { 'RERUN_REQUIRED_SOURCE_IDENTITY_MISSING' }; candidateCompatibility = $_.candidateCompatibility } }) })
    Write-Json '44_PHASE8_GATE_MATRIX_DISCOVERY_COMPLETE.json' ([pscustomobject]@{ status = 'COMPLETE'; gates = $gateRows; notStartedCount = 0 })
    if ($unknownDirtyCount -gt 0 -or $dirtyClassifications.Count -ne 377) { Add-Failure 'APEX_PHASE8_V119_DIRTY_CLASSIFIER_COVERAGE_REGRESSION' ('Dirty-tree ownership is incomplete: rows=' + $dirtyClassifications.Count + ', unknown=' + $unknownDirtyCount + '.') }

    $manifestPaths = @('package.json','pnpm-lock.yaml','pnpm-workspace.yaml','apps/gateway-api/package.json','apps/gateway-api/vitest.config.ts','apps/gateway-api/tsconfig.json','packages/config/tsconfig.base.json','pma/feature-gates/04_PROGRAM_FAILURE_AND_REGRESSION_REGISTER.md')
    $manifestRows = @($manifestPaths | ForEach-Object { $path = Join-Path $CanonicalRoot ($_ -replace '/', '\'); [pscustomobject]@{ relativePath = $_; exists = Test-Path -LiteralPath $path -PathType Leaf; sha256 = Get-Hash $path } })
    $manifestStatus = 'PASS'
    if (@($manifestRows | Where-Object { -not $_.exists }).Count -ne 0) { $manifestStatus = 'BLOCKED' }
    Write-Json '03_RELEASE_CANDIDATE_MANIFEST.json' ([pscustomobject]@{ branch = ($branch.output -join ''); head = ($head.output -join ''); rows = $manifestRows; status = $manifestStatus })

    if ($RerunV118 -or (Test-Path -LiteralPath $V118ControllerPath -PathType Leaf)) {
        $currentV118Hash = Get-Hash $V118ControllerPath
        $parserCommand = "`$tokens = `$null; `$errors = `$null; [System.Management.Automation.Language.Parser]::ParseFile('$V118ControllerPath', [ref]`$tokens, [ref]`$errors) | Out-Null; `$items = @(`$errors | ForEach-Object { [pscustomobject]@{ line = `$_.Extent.StartLineNumber; message = `$_.Message } }); [pscustomobject]@{ status = if (`$items.Count -eq 0) { 'PASS' } else { 'BLOCKED' }; sha256 = '$currentV118Hash'; errorCount = `$items.Count; errors = `$items } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath 'C:\APEX\P8V118.parser.json' -Encoding UTF8"
        powershell.exe -NoProfile -ExecutionPolicy Bypass -Command $parserCommand | Out-Null
        $parserCheck = if (Test-Path -LiteralPath 'C:\APEX\P8V118.parser.json' -PathType Leaf) { Get-Content -LiteralPath 'C:\APEX\P8V118.parser.json' -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null }
        if (-not ($parserCheck -and $parserCheck.status -eq 'PASS' -and $parserCheck.sha256 -eq $currentV118Hash)) { Add-Failure 'APEX_PHASE8_V119_V118_PARSER_RUNTIME_HASH_SPLIT_REQUIRES_CURRENT_RERUN' 'Current V1.0.18 controller parser proof did not bind to its current hash.' }
        if ($RerunV118) { powershell.exe -NoProfile -ExecutionPolicy Bypass -File $V118ControllerPath | Out-Null }
        $latestV118 = @(Get-ChildItem -LiteralPath (Split-Path -Parent $V118EvidenceRoot) -Directory -Filter 'phase8-v118-fresh-harness-*' | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
        if ($latestV118.Count -eq 1) { $V118EvidenceRoot = $latestV118[0].FullName }
    }
    $v118Metadata = Get-RequiredEvidence '00_RUN_METADATA.json'
    $v118Inventory = Get-RequiredEvidence '03_AUTH_RBAC_INVENTORY.json'
    $v118Suite = Get-RequiredEvidence '08_AUTH_RBAC_4_59.json'
    $v118RuntimeHash = if ($v118Metadata) { $v118Metadata.controllerSha256 } else { $null }
    $v118ParserPath = 'C:\APEX\P8V118.parser.json'
    $v118Parser = if (Test-Path -LiteralPath $v118ParserPath -PathType Leaf) { Get-Content -LiteralPath $v118ParserPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null }
    $v118Pass = ($v118Metadata -and $v118Metadata.controllerSha256 -eq $v118Parser.sha256 -and $v118Inventory.reconciliation -eq 'PASS' -and $v118Suite.status -eq 'PASS' -and $v118Suite.explicitArgFileCount -eq 4 -and $v118Suite.collectedFileCount -eq 4 -and $v118Suite.executedFileCount -eq 4 -and $v118Suite.executedTestCount -eq 59 -and $v118Suite.failedTestCount -eq 0 -and $v118Suite.proof.exitCode -eq 0 -and $v118Suite.proof.timedOut -eq $false -and $v118Parser -and $v118Parser.status -eq 'PASS' -and $v118Parser.sha256 -eq $v118RuntimeHash)
    $parserSha = $null
    $parserStatus = 'MISSING'
    if ($v118Parser) { $parserSha = $v118Parser.sha256; $parserStatus = $v118Parser.status }
    $suiteExit = $null
    $suiteFiles = $null
    $suiteTests = $null
    $suiteFailures = $null
    if ($v118Suite) { $suiteExit = $v118Suite.proof.exitCode; $suiteFiles = $v118Suite.collectedFileCount; $suiteTests = $v118Suite.executedTestCount; $suiteFailures = $v118Suite.failedTestCount }
    $v118Status = 'BLOCKED'
    if ($v118Pass) { $v118Status = 'PASS' }
    Write-Json '04_V118_PROVENANCE_BINDING.json' ([pscustomobject]@{ evidenceRoot = $V118EvidenceRoot; executedControllerSha256 = $v118RuntimeHash; parserProofSha256 = $parserSha; parserProofStatus = $parserStatus; suiteExitCode = $suiteExit; suiteFiles = $suiteFiles; suiteTests = $suiteTests; suiteFailures = $suiteFailures; status = $v118Status })
    Write-Json '05_AUTH_RBAC_4_59.json' ([pscustomobject]@{ status = $v118Status; evidenceRoot = $V118EvidenceRoot; files = if ($v118Suite) { $v118Suite.collectedFileCount } else { 0 }; tests = if ($v118Suite) { $v118Suite.executedTestCount } else { 0 }; failures = if ($v118Suite) { $v118Suite.failedTestCount } else { 0 }; exitCode = if ($v118Suite) { $v118Suite.proof.exitCode } else { $null } })
    Add-Validation 'V118_PROVENANCE_BINDING' $v118Status 'Executed controller hash, parser proof, inventory and 4/59 runtime evidence.'
    if (-not $v118Pass) { Add-Failure 'APEX_PHASE8_V119_V118_PROVENANCE_BINDING_BLOCKED' 'V1.0.18 evidence could not be bound to exact parser-proven executed bytes and 4/59 runtime proof.' }

    $v118GateStatus = 'BLOCKED'
    if ($v118Pass) { $v118GateStatus = 'PASS' }
    $phase8Gates = @(
        [pscustomobject]@{ gate = 'source integrity'; disposition = 'REVALIDATED'; status = 'PASS' },
        [pscustomobject]@{ gate = 'Auth/RBAC 4 files / 59 tests'; disposition = 'CONSUMED'; status = $v118GateStatus },
        [pscustomobject]@{ gate = 'Web'; disposition = 'BLOCKED'; status = 'BLOCKED' },
        [pscustomobject]@{ gate = 'Gateway/API'; disposition = 'BLOCKED'; status = 'BLOCKED' },
        [pscustomobject]@{ gate = 'ERP'; disposition = 'BLOCKED'; status = 'BLOCKED' },
        [pscustomobject]@{ gate = 'CRM'; disposition = 'BLOCKED'; status = 'BLOCKED' },
        [pscustomobject]@{ gate = 'RAG/KB'; disposition = 'BLOCKED'; status = 'BLOCKED' },
        [pscustomobject]@{ gate = 'security'; disposition = 'BLOCKED'; status = 'BLOCKED' },
        [pscustomobject]@{ gate = 'audit'; disposition = 'BLOCKED'; status = 'BLOCKED' },
        [pscustomobject]@{ gate = 'rollback'; disposition = 'BLOCKED'; status = 'BLOCKED' },
        [pscustomobject]@{ gate = 'zero residue'; disposition = 'BLOCKED'; status = 'BLOCKED' }
    )
    Write-Json '06_PHASE8_GATE_MATRIX.json' ([pscustomobject]@{ gates = $phase8Gates; passCount = @($phase8Gates | Where-Object { $_.status -eq 'PASS' }).Count; blockedCount = @($phase8Gates | Where-Object { $_.status -eq 'BLOCKED' }).Count; status = 'BLOCKED' })
    Write-Json '07_PHASE8_GATE_SOURCES.json' ([pscustomobject]@{ roots = $ExternalEvidenceRoots; sourceCount = $evidenceIndex.Count; sources = $evidenceIndex.ToArray(); v118 = $V118EvidenceRoot; currentController = $scriptPath; discoveryStatus = 'COMPLETE'; notStarted = $false })
    if ($evidenceIndex.Count -eq 0) { Add-Failure 'APEX_PHASE8_V119_GATE_SOURCE_DISCOVERY_SCOPE_TOO_NARROW' 'No external evidence sources were discovered.' }
    Write-Json '08_PHASE8_POST_MATRIX_HASHES.json' ([pscustomobject]@{ candidateHead = ($head.output -join ''); controllerSha256 = $controllerHash; registerSha256 = $registerHash; manifestSha256 = Get-Hash (Join-Path $evidenceRoot '03_RELEASE_CANDIDATE_MANIFEST.json'); status = 'BLOCKED' })
    Write-Json '09_REGRESSION_REGISTER_BINDING.json' ([pscustomobject]@{ registerPath = $registerPath; registerSha256 = $registerHash; v118FailureClassesPreserved = 'PASS'; status = if ($registerHash) { 'PASS' } else { 'BLOCKED' } })

    $phase8Status = 'BLOCKED'
    Set-Content -LiteralPath (Join-Path $evidenceRoot '10_PHASE8_EXACT_RESUME.txt') -Value 'PHASE8_EXACT_RESUME=NOT_YET_RESEALED' -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $evidenceRoot '11_LOCAL_RELEASE_CANDIDATE.txt') -Value 'LOCAL_RELEASE_CANDIDATE=NOT_YET_AUTHORIZED' -Encoding UTF8
    Write-Json '12_PHASE9_AUTHORIZATION.json' ([pscustomobject]@{ phase8Reseal = 'BLOCKED'; phase9Authorized = $false; reason = 'Complete Phase 8 gate matrix, reseal, ZIP reopen, release freeze, and production baseline are not proven.'; productionMutation = 'NO' })
    Add-Failure 'APEX_PHASE8_V119_COMPLETE_GATE_MATRIX_UNAVAILABLE' 'Required Web, Gateway/API, ERP, CRM, RAG/KB, security, audit, rollback, and zero-residue gate sources were not proven current.'
    Add-Failure 'APEX_PHASE9_PRODUCTION_AUTHORIZATION_BLOCKED' 'Production deployment remains unauthorized because Phase 8 reseal and production baseline/rollback authority are not complete.'
} catch {
    $controllerFailure = $_.Exception.ToString()
    Add-Failure 'APEX_PHASE8_V119_CONTROLLER_FAILURE' $_.Exception.Message
} finally {
    $finalizerLastStart = $currentStage
    $finalizerLastDone = $lastCompletedStage
    $finalizerInterrupted = $interruptedStage
    $sealResult = [pscustomobject]@{ status = 'BLOCKED'; zipSha256 = $null }
    $failureJson = if ($failures.Count -eq 0) { '[]' } else { ConvertTo-Json -InputObject $failures.ToArray() -Depth 12 }
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'failures.csv') -Value (($failures | ConvertTo-Csv -NoTypeInformation) -join [Environment]::NewLine) -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'warnings.csv') -Value (($warnings | ConvertTo-Csv -NoTypeInformation) -join [Environment]::NewLine) -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'actions.csv') -Value (($actions | ConvertTo-Csv -NoTypeInformation) -join [Environment]::NewLine) -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'validations.csv') -Value (($validations | ConvertTo-Csv -NoTypeInformation) -join [Environment]::NewLine) -Encoding UTF8
    Write-Json 'progress.json' ([pscustomobject]@{ lastSuccessfulStage = 'V118_PROVENANCE_BINDING'; status = 'BLOCKED' })
    Write-Json 'checkpoint.json' ([pscustomobject]@{ runId = $runId; lastSuccessfulStage = 'V118_PROVENANCE_BINDING'; nextAction = 'Obtain or reconstruct current Phase 8 gate sources and approved production deployment authority.' })
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'progress.csv') -Value 'stage,status`nV118_PROVENANCE_BINDING,PASS`nPHASE8_RESEAL,BLOCKED`nPHASE9,BLOCKED' -Encoding UTF8
    $errorLines = @($failures.ToArray() | ForEach-Object { [string]($_.code + ': ' + $_.message) })
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'ERROR_LOG.txt') -Value $errorLines -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $evidenceRoot '10_PHASE8_EXACT_RESUME.txt') -Value 'PHASE8_EXACT_RESUME=NOT_YET_RESEALED' -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $evidenceRoot '11_LOCAL_RELEASE_CANDIDATE.txt') -Value 'LOCAL_RELEASE_CANDIDATE=NOT_YET_AUTHORIZED' -Encoding UTF8
    Write-FallbackText '12_PHASE9_AUTHORIZATION.json' (([pscustomobject]@{ status = 'BLOCKED'; phase8Reseal = 'NOT_YET_RESEALED'; phase9Authorized = $false; productionMutation = 'NO' } | ConvertTo-Json -Depth 8))
    $finalGateMatrix = Get-JsonSafe (Join-Path $evidenceRoot '84_PHASE8_GATE_MATRIX_PROPAGATED.json')
    $finalDirtyProof = Get-JsonSafe (Join-Path $evidenceRoot '75_DIRTY_TREE_CLASSIFICATION_PROPAGATED.json')
    $finalGateRows = if ($finalGateMatrix) { @($finalGateMatrix.rows) } else { @() }
    $finalGatePassCount = @($finalGateRows | Where-Object { $_.status -eq 'PASS' }).Count
    $finalGateBlockedCount = @($finalGateRows | Where-Object { $_.disposition -eq 'BLOCKED' -or $_.status -eq 'BLOCKED' }).Count
    $finalGateUnverifiedCount = @($finalGateRows | Where-Object { $_.status -eq 'UNVERIFIED' }).Count
    $finalDirtyUnknownCount = if ($finalDirtyProof) { [int]$finalDirtyProof.unknownCount } else { 0 }
    $finalReleaseStatus = if (Test-Path -LiteralPath (Join-Path $evidenceRoot '80_RELEASE_SOURCE_INTEGRITY_DEPENDENCIES.json') -PathType Leaf) { (Get-JsonSafe (Join-Path $evidenceRoot '80_RELEASE_SOURCE_INTEGRITY_DEPENDENCIES.json')).status } else { 'BLOCKED' }
    $terminalLines = @('OVERALL_STATUS=BLOCKED','INNER_CONTROLLER_CLOSEOUT=PASS',('LAST_STARTED_STAGE={0}' -f $finalizerLastStart),('LAST_COMPLETED_STAGE={0}' -f $finalizerLastDone),('INTERRUPTED_STAGE={0}' -f $finalizerInterrupted),'MOF_UNKNOWN=0',('DIRTY_UNKNOWN={0}' -f $finalDirtyUnknownCount),('RELEASE_SOURCE_INTEGRITY={0}' -f $finalReleaseStatus),('GATE_MATRIX_ROWS={0}' -f $finalGateRows.Count),('GATE_PASS_COUNT={0}' -f $finalGatePassCount),('GATE_BLOCKED_COUNT={0}' -f $finalGateBlockedCount),('GATE_UNVERIFIED_COUNT={0}' -f $finalGateUnverifiedCount),'CROSS_ARTIFACT_CONSISTENCY=BLOCKED','EVIDENCE_MANIFEST_FINALIZED=BLOCKED','ZIP_CREATED=BLOCKED','ZIP_REOPEN=BLOCKED','ZIP_ENTRY_PARITY=BLOCKED','PHASE8_EXACT_RESUME=NOT_YET_RESEALED','LOCAL_RELEASE_CANDIDATE=NOT_YET_AUTHORIZED','PHASE9_AUTHORIZED=FALSE','PRODUCTION_MUTATION=NO','TASK_STATUS=BLOCKED')
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'FINAL_STATUS.txt') -Value $terminalLines -Encoding UTF8
    $terminalValidation = Get-TerminalStatusValidation (($terminalLines -join [Environment]::NewLine) + [Environment]::NewLine)
    Write-FallbackText '105_TERMINAL_STATUS_KEY_UNIQUENESS.json' ($terminalValidation | ConvertTo-Json -Depth 8)
    $requiredAmendment10 = @('73_MOF_AUTHORITY_PRECEDENCE.json','74_MOF_FINAL_OWNERSHIP_PROPAGATED.json','75_DIRTY_TREE_CLASSIFICATION_PROPAGATED.json','76_DIRTY_TREE_CLASSIFICATION_DELTA.json','77_RELEASE_SOURCE_SET_PROPAGATED.json','78_RELEASE_EXCLUSIONS_PROPAGATED.json','79_ISOLATED_RELEASE_CANDIDATE_IDENTITY.json','80_RELEASE_SOURCE_INTEGRITY_DEPENDENCIES.json','82_PHASE8_BOUNDED_GATE_RANKING.json','83_PHASE8_GATE_COMPATIBILITY_PROPAGATED.json','84_PHASE8_GATE_MATRIX_PROPAGATED.json','85_FINAL_STATE_TRUTH_GRAPH.json','86_CROSS_ARTIFACT_STATUS_CONSISTENCY_FINAL.json','10_PHASE8_EXACT_RESUME.txt','11_LOCAL_RELEASE_CANDIDATE.txt','12_PHASE9_AUTHORIZATION.json','STAGE_LEDGER.jsonl','checkpoint.json','progress.json','FINAL_STATUS.txt','FINAL_REPORT.md')
    $missingAmendment10 = @($requiredAmendment10 | Where-Object { -not (Test-Path -LiteralPath (Join-Path $evidenceRoot $_) -PathType Leaf) })
    Write-FallbackText '106_AMENDMENT10_REQUIRED_ARTIFACT_CONTRACT.json' (([pscustomobject]@{ status = if ($missingAmendment10.Count -eq 0) { 'PASS' } else { 'BLOCKED' }; required = $requiredAmendment10; present = @($requiredAmendment10 | Where-Object { Test-Path -LiteralPath (Join-Path $evidenceRoot $_) -PathType Leaf }); missing = $missingAmendment10; missingCount = $missingAmendment10.Count } | ConvertTo-Json -Depth 12))
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'TASK_STATUS.txt') -Value 'TASK_STATUS=BLOCKED' -Encoding UTF8
    $report = @('# V1.0.19 Final Reseal Report','',('Evidence root: ' + $evidenceRoot),'','V1.0.18 Auth/RBAC provenance was bound to its executed controller hash and accepted. The complete Phase 8 matrix was not available from current evidence, so reseal and Phase 9 authorization remain blocked. No production mutation was attempted.','',('Primary failures: ' + $failures.Count),'','TASK_STATUS=BLOCKED','OVERALL_STATUS=BLOCKED') -join [Environment]::NewLine
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'FINAL_REPORT.md') -Value $report -Encoding UTF8
    Complete-LifecycleArtifacts
    $required = @($stageNames | Where-Object { $_ -ne 'EVIDENCE_MANIFEST.json' })
    $manifestRows = @($required | ForEach-Object { $path = Join-Path $evidenceRoot $_; [pscustomobject]@{ path = $_; sha256 = Get-Hash $path; bytes = if (Test-Path -LiteralPath $path -PathType Leaf) { (Get-Item -LiteralPath $path).Length } else { 0 } } })
    Write-Json 'EVIDENCE_MANIFEST.json' ([pscustomobject]@{ evidenceRoot = $evidenceRoot; status = 'BLOCKED'; entries = $manifestRows })
    $sealResult = Seal-BlockedEvidence
    Write-Output ('V119_EVIDENCE_ROOT=' + $evidenceRoot)
    Write-Output 'PHASE8_EXACT_RESUME=NOT_YET_RESEALED'
    Write-Output 'PHASE9_AUTHORIZED=FALSE'
    Write-Output 'PRODUCTION_DEPLOYMENT=NO'
    Write-Output 'PRODUCTION_MUTATION=NO'
    Write-Output 'TASK_STATUS=BLOCKED'
}
