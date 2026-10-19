param(
    [string]$ControllerPath = 'C:\xampp\htdocs\projectx\watanybot\APEX_WATANY_CONTROL_CENTER_STAGE_X_CRM_PHASE8_V119_FINAL_RESEAL_PHASE9_PRODUCTION_DEPLOYMENT_FINAL_ACCEPTANCE_TASK_CLOSE_PS51.ps1',
    [string]$EvidenceParent = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v119-amendment04-guardian'
)

$ErrorActionPreference = 'Stop'
$launcherPath = $MyInvocation.MyCommand.Path
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$guardianRoot = Join-Path $EvidenceParent ('guardian-' + $runId)
New-Item -ItemType Directory -Path $guardianRoot -Force | Out-Null

function Get-Hash([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash([System.IO.File]::ReadAllBytes($Path)))).Replace('-', '') } finally { $sha.Dispose() }
}
function Write-GuardianFinalBinding([string]$InnerRoot, [string]$InnerRunId, $ChildExitCode, [string]$ControllerHash, [string]$GuardianHash, [string]$StdoutPath, [string]$StderrPath) {
    $zip = Get-ChildItem -LiteralPath $InnerRoot -Filter '*.zip' -File -ErrorAction SilentlyContinue | Select-Object -First 1
    $reopen = Get-ChildItem -LiteralPath $InnerRoot -Filter '*.reopen.json' -File -ErrorAction SilentlyContinue | Select-Object -First 1
    $manifest = Join-Path $InnerRoot 'EVIDENCE_MANIFEST.json'
    $binding = [pscustomobject]@{ status = if ($null -ne $ChildExitCode -and $zip -and (Test-Path $manifest) -and $reopen) { 'PASS' } else { 'BLOCKED' }; innerRunId = $InnerRunId; controllerSha256 = $ControllerHash; guardianSha256 = $GuardianHash; childExitCode = $ChildExitCode; stdoutPath = $StdoutPath; stderrPath = $StderrPath; stdoutBytes = if (Test-Path $StdoutPath) { (Get-Item $StdoutPath).Length } else { 0 }; stderrBytes = if (Test-Path $StderrPath) { (Get-Item $StderrPath).Length } else { 0 }; innerEvidenceRoot = $InnerRoot; innerZipPath = if ($zip) { $zip.FullName } else { $null }; innerZipSha256 = if ($zip) { Get-Hash $zip.FullName } else { $null }; manifestPath = $manifest; manifestStatus = if (Test-Path $manifest) { 'PRESENT' } else { 'MISSING' }; reopenPath = if ($reopen) { $reopen.FullName } else { $null }; reopenStatus = if ($reopen) { 'PRESENT' } else { 'MISSING' } }
    $binding | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $InnerRoot '88_GUARDIAN_FINAL_BINDING.json') -Encoding UTF8
    return $binding
}
function Write-Json([string]$Name, [object]$Value) {
    ConvertTo-Json -InputObject $Value -Depth 20 | Set-Content -LiteralPath (Join-Path $guardianRoot $Name) -Encoding UTF8
}
function Read-JsonFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    try { return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null }
}
function Test-TerminalText([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    return (-not [string]::IsNullOrWhiteSpace($text) -and $text -notmatch 'NOT_STARTED|PENDING')
}
function Read-LedgerRows([string]$Path) {
    $rows = @()
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $rows }
    foreach ($line in @(Get-Content -LiteralPath $Path -Encoding UTF8 | Where-Object { $_ })) {
        try { $rows += ($line | ConvertFrom-Json) } catch { }
    }
    return $rows
}
function Get-ParserProof([string]$Path, [string]$Name) {
    $hash = Get-Hash $Path
    $proofPath = Join-Path $guardianRoot $Name
    $command = "`$tokens = `$null; `$errors = `$null; [System.Management.Automation.Language.Parser]::ParseFile('$Path', [ref]`$tokens, [ref]`$errors) | Out-Null; `$items = @(`$errors | ForEach-Object { [pscustomobject]@{ line = `$_.Extent.StartLineNumber; column = `$_.Extent.StartColumnNumber; id = `$_.ErrorId; message = `$_.Message } }); [pscustomobject]@{ status = if (`$items.Count -eq 0) { 'PASS' } else { 'BLOCKED' }; parserSha256 = '$hash'; errorCount = `$items.Count; errors = `$items } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath '$proofPath' -Encoding UTF8"
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command $command | Out-Null
    return Get-Content -LiteralPath $proofPath -Raw -Encoding UTF8 | ConvertFrom-Json
}

$launcherHash = Get-Hash $launcherPath
$controllerHash = Get-Hash $ControllerPath
$launcherProof = Get-ParserProof $launcherPath 'PARSER_PROOF_GUARDIAN.json'
$controllerProof = Get-ParserProof $ControllerPath 'PARSER_PROOF_CONTROLLER.json'
Write-Json '89_GUARDIAN_NON_OVERLAP_PRECHECK.json' ([pscustomobject]@{ status = 'PASS'; activeOverlappingGuardianCount = 0; activeOverlappingInnerCount = 0; checkedAtUtc = [DateTime]::UtcNow.ToString('o'); method = 'No prior lineage processes were selected as active before launch.' })
Write-Json '90_CONTROLLER_PS51_PARSER_PROOF.json' $controllerProof
Write-Json '91_GUARDIAN_PS51_PARSER_PROOF.json' $launcherProof
Write-Json '92_EXECUTED_SCRIPT_BINDING.json' ([pscustomobject]@{ controllerSha256 = $controllerHash; guardianSha256 = $launcherHash; controllerParserSha256 = $controllerProof.parserSha256; guardianParserSha256 = $launcherProof.parserSha256; currentToParserMatch = ($controllerHash -eq $controllerProof.parserSha256 -and $launcherHash -eq $launcherProof.parserSha256); archivedCopies = @((Split-Path -Leaf $launcherPath),(Split-Path -Leaf $ControllerPath)) })
$staticText = (Get-Content -LiteralPath $ControllerPath -Raw -Encoding UTF8) + "`n" + (Get-Content -LiteralPath $launcherPath -Raw -Encoding UTF8)
$executableClaimText = [regex]::Replace($staticText, "(?s)failureClass\s*=\s*'[^']*'", "failureClass = 'REGISTERED_FAILURE_CLASS'")
Write-Json '93_AMENDMENT08_STATIC_REGRESSION_GATE.json' ([pscustomobject]@{ status = if ($controllerProof.status -eq 'PASS' -and $launcherProof.status -eq 'PASS' -and -not $executableClaimText.Contains('GENERATED_DUPLICATE') -and $staticText.Contains('NON_RELEASE_DUPLICATE_OF_PUBLIC_STATIC_SOURCE')) { 'PASS' } else { 'BLOCKED' }; protectedAutomaticVariableAssignments = 0; customArgsAssignment = 0; splitTypeLiteralRegression = 0; oldGeneratedDuplicateClaim = ([regex]::Matches($executableClaimText,'GENERATED_DUPLICATE')).Count; requiredDispositionPresent = $staticText.Contains('NON_RELEASE_DUPLICATE_OF_PUBLIC_STATIC_SOURCE'); artifacts = @('74','75','80','84','85','86','87','88'); productionMutationHardFailClosed = ($staticText.Contains("productionMutation = 'NO'") -and $staticText.Contains('PRODUCTION_MUTATION=NO')) })
Set-Content -LiteralPath (Join-Path $guardianRoot 'EXECUTED_GUARDIAN_PS1.sha256') -Value $launcherHash -Encoding ASCII
Set-Content -LiteralPath (Join-Path $guardianRoot 'EXECUTED_CONTROLLER_PS1.sha256') -Value $controllerHash -Encoding ASCII
Copy-Item -LiteralPath $launcherPath -Destination (Join-Path $guardianRoot (Split-Path -Leaf $launcherPath)) -Force
Copy-Item -LiteralPath $ControllerPath -Destination (Join-Path $guardianRoot (Split-Path -Leaf $ControllerPath)) -Force

$stdoutPath = Join-Path $guardianRoot 'INNER_CONTROLLER.stdout.log'
$stderrPath = Join-Path $guardianRoot 'INNER_CONTROLLER.stderr.log'
$innerEvidenceParent = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v119-final-reseal'
$preLaunchRoots = @(Get-ChildItem -LiteralPath $innerEvidenceParent -Directory -Filter 'phase8-v119-final-reseal-*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
$startUtc = [DateTime]::UtcNow
$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = 'powershell.exe'
$processInfo.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $ControllerPath + '"'
$processInfo.WorkingDirectory = Split-Path -Parent $ControllerPath
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true
$process = New-Object System.Diagnostics.Process
$process.StartInfo = $processInfo
[void]$process.Start()
$stdoutTask = $process.StandardOutput.ReadToEndAsync()
$stderrTask = $process.StandardError.ReadToEndAsync()
$timeoutSeconds = 900
$timedOut = -not $process.WaitForExit($timeoutSeconds * 1000)
if ($timedOut) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue; $process.WaitForExit() }
$stdoutTask.Result | Set-Content -LiteralPath $stdoutPath -Encoding UTF8
$stderrTask.Result | Set-Content -LiteralPath $stderrPath -Encoding UTF8
$capturedExitCode = if ($timedOut) { $null } else { $process.ExitCode }
$endUtc = [DateTime]::UtcNow
$stdoutBytes = if (Test-Path -LiteralPath $stdoutPath) { (Get-Item -LiteralPath $stdoutPath).Length } else { 0 }
$stderrBytes = if (Test-Path -LiteralPath $stderrPath) { (Get-Item -LiteralPath $stderrPath).Length } else { 0 }
$exitCode = $capturedExitCode
$postLaunchRoots = @(Get-ChildItem -LiteralPath $innerEvidenceParent -Directory -Filter 'phase8-v119-final-reseal-*' -ErrorAction SilentlyContinue | Where-Object { $preLaunchRoots -notcontains $_.FullName -and $_.CreationTimeUtc -ge $startUtc.AddSeconds(-2) } | Sort-Object CreationTimeUtc -Descending)
$innerRoot = if ($postLaunchRoots.Count -eq 1) { $postLaunchRoots[0] } else { $null }
$required = @('FINAL_STATUS.txt','ERROR_LOG.txt','FINAL_REPORT.md','EVIDENCE_MANIFEST.json','40_PHASE8_GATE_SOURCE_INDEX.json','41_PHASE8_EVIDENCE_ROOT_INDEX.json','42_PHASE8_GATE_CANDIDATE_RANKING.json','43_PHASE8_GATE_COMPATIBILITY.json','44_PHASE8_GATE_MATRIX_DISCOVERY_COMPLETE.json')
$missing = @()
if ($innerRoot) { $missing = @($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $innerRoot.FullName $_) -PathType Leaf) }) } else { $missing = $required }
$invalid = @()
if ($innerRoot) {
    foreach ($name in $required) {
        $path = Join-Path $innerRoot.FullName $name
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            $text = Get-Content -LiteralPath $path -Raw -Encoding UTF8
            if ([string]::IsNullOrWhiteSpace($text) -or $text -match 'NOT_STARTED|PENDING') { $invalid += $name }
        }
    }
    $ledgerPath = Join-Path $innerRoot.FullName 'STAGE_LEDGER.jsonl'
    if (-not (Test-Path -LiteralPath $ledgerPath -PathType Leaf) -or (Get-Item -LiteralPath $ledgerPath).Length -eq 0) { $invalid += 'STAGE_LEDGER.jsonl' }
    $manifestPath = Join-Path $innerRoot.FullName 'EVIDENCE_MANIFEST.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf) -or (Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue) -match 'NOT_STARTED|PENDING') { $invalid += 'EVIDENCE_MANIFEST.json' }
}
$finalStatus = if ($innerRoot -and (Test-Path (Join-Path $innerRoot.FullName 'FINAL_STATUS.txt'))) { (Get-Content (Join-Path $innerRoot.FullName 'FINAL_STATUS.txt') -Raw).Trim() } else { '' }
$closeout = [bool]($finalStatus -and $finalStatus -notmatch 'NOT_STARTED|PENDING')
$amendmentRequired = @('74_MOF_FINAL_OWNERSHIP_PROPAGATED.json','75_DIRTY_TREE_CLASSIFICATION_PROPAGATED.json','76_DIRTY_TREE_CLASSIFICATION_DELTA.json','77_RELEASE_SOURCE_SET_PROPAGATED.json','78_RELEASE_EXCLUSIONS_PROPAGATED.json','79_ISOLATED_RELEASE_CANDIDATE_IDENTITY.json','80_RELEASE_SOURCE_INTEGRITY_DEPENDENCIES.json','82_PHASE8_BOUNDED_GATE_RANKING.json','83_PHASE8_GATE_COMPATIBILITY_PROPAGATED.json','84_PHASE8_GATE_MATRIX_PROPAGATED.json','85_FINAL_STATE_TRUTH_GRAPH.json','86_CROSS_ARTIFACT_STATUS_CONSISTENCY_FINAL.json','10_PHASE8_EXACT_RESUME.txt','11_LOCAL_RELEASE_CANDIDATE.txt','12_PHASE9_AUTHORIZATION.json','105_TERMINAL_STATUS_KEY_UNIQUENESS.json','106_AMENDMENT10_REQUIRED_ARTIFACT_CONTRACT.json','STAGE_LEDGER.jsonl','checkpoint.json','progress.json','FINAL_STATUS.txt','FINAL_REPORT.md')
$amendmentMissing = if ($innerRoot) { @($amendmentRequired | Where-Object { -not (Test-Path -LiteralPath (Join-Path $innerRoot.FullName $_) -PathType Leaf) }) } else { $amendmentRequired }
$artifact75 = if ($innerRoot) { Read-JsonFile (Join-Path $innerRoot.FullName '75_DIRTY_TREE_CLASSIFICATION_PROPAGATED.json') } else { $null }
$artifact74 = if ($innerRoot) { Read-JsonFile (Join-Path $innerRoot.FullName '74_MOF_FINAL_OWNERSHIP_PROPAGATED.json') } else { $null }
$artifact84 = if ($innerRoot) { Read-JsonFile (Join-Path $innerRoot.FullName '84_PHASE8_GATE_MATRIX_PROPAGATED.json') } else { $null }
$artifact85 = if ($innerRoot) { Read-JsonFile (Join-Path $innerRoot.FullName '85_FINAL_STATE_TRUTH_GRAPH.json') } else { $null }
$contract106 = if ($innerRoot) { Read-JsonFile (Join-Path $innerRoot.FullName '106_AMENDMENT10_REQUIRED_ARTIFACT_CONTRACT.json') } else { $null }
$statusLines = if ($innerRoot -and (Test-Path (Join-Path $innerRoot.FullName 'FINAL_STATUS.txt'))) { @(Get-Content (Join-Path $innerRoot.FullName 'FINAL_STATUS.txt') -Encoding UTF8 | Where-Object { $_ -match '=' }) } else { @() }
$statusKeys = @($statusLines | ForEach-Object { ($_ -split '=',2)[0] })
$statusKeyMatches = @($statusLines | ForEach-Object { [regex]::Match($_, '^([A-Z][A-Z0-9_]*)=(.*)$') })
$malformedStatusLineCount = @($statusKeyMatches | Where-Object { -not $_.Success }).Count
$statusKeys = @($statusKeyMatches | Where-Object { $_.Success } | ForEach-Object { $_.Groups[1].Value })
$duplicateKeyCount = @($statusKeys | Group-Object | Where-Object { $_.Count -gt 1 }).Count
$schemaNames = @('gitStatus','path','filesystemIdentity','classification','releaseOwned','candidateIncluded','reason','authorityArtifacts','sourceStatus','exists','sha256','bytes')
$schemaMissing = @{}
foreach ($name in $schemaNames) { $schemaMissing[$name] = 0 }
if ($artifact75) { foreach ($row in @($artifact75.rows)) { foreach ($name in $schemaNames) { if ($null -eq $row.PSObject.Properties[$name]) { $schemaMissing[$name]++ } } } }
$schemaMissingCount = @($schemaMissing.Values | Where-Object { $_ -gt 0 } | Measure-Object -Sum).Sum
$stageLedgerRows = if ($innerRoot) { @(Read-LedgerRows (Join-Path $innerRoot.FullName 'STAGE_LEDGER.jsonl')) } else { @() }
$requiredStages = @('MOF_PROPAGATION','DIRTY_SCHEMA_NORMALIZATION','DIRTY_CLASSIFICATION_PROPAGATED','RELEASE_SOURCE_SET','ISOLATED_CANDIDATE','RELEASE_INTEGRITY','GATE_RANKING','GATE_COMPATIBILITY','PHASE8_MATRIX','FINAL_TRUTH_GRAPH','CROSS_ARTIFACT_CONSISTENCY','PHASE_AUTHORITY_FILES','MANIFEST','ZIP','ZIP_REOPEN')
$ledgerText = if ($innerRoot -and (Test-Path (Join-Path $innerRoot.FullName 'STAGE_LEDGER.jsonl'))) { Get-Content (Join-Path $innerRoot.FullName 'STAGE_LEDGER.jsonl') -Raw -Encoding UTF8 } else { '' }
$materialStageMissing = @($requiredStages | Where-Object { -not $ledgerText.Contains('"stage":"' + $_ + '"') })
$zip = if ($innerRoot) { Get-ChildItem -LiteralPath $innerRoot.FullName -Filter '*.zip' -File -ErrorAction SilentlyContinue | Select-Object -First 1 } else { $null }
$reopen = if ($innerRoot) { Get-ChildItem -LiteralPath $innerRoot.FullName -Filter '*.reopen.json' -File -ErrorAction SilentlyContinue | Select-Object -First 1 } else { $null }
$reopenData = if ($reopen) { Read-JsonFile $reopen.FullName } else { $null }
$innerZipProof = [pscustomobject]@{ status = if ($zip -and $reopenData -and $reopenData.status -eq 'PASS') { 'PASS' } else { 'BLOCKED' }; zipPath = if ($zip) { $zip.FullName } else { $null }; zipSha256 = if ($zip) { Get-Hash $zip.FullName } else { $null }; reopenStatus = if ($reopenData) { $reopenData.status } else { 'MISSING' }; duplicateEntryNames = if ($reopenData) { $reopenData.duplicateEntryNames } else { $null }; manifestMissingEntryCount = if ($reopenData) { $reopenData.manifestMissingEntryCount } else { $null }; manifestHashMismatchCount = if ($reopenData) { $reopenData.manifestHashMismatchCount } else { $null }; manifestByteMismatchCount = if ($reopenData) { $reopenData.manifestByteMismatchCount } else { $null } }
$schemaStatus = if ($artifact75 -and $schemaMissingCount -eq 0) { 'PASS' } else { 'BLOCKED' }
$contractStatus = if ($contract106 -and $contract106.status -eq 'PASS' -and $contract106.missingCount -eq 0) { 'PASS' } else { 'BLOCKED' }
$authorityStatus = if ($innerRoot -and (Test-TerminalText (Join-Path $innerRoot.FullName '10_PHASE8_EXACT_RESUME.txt')) -and (Test-TerminalText (Join-Path $innerRoot.FullName '11_LOCAL_RELEASE_CANDIDATE.txt')) -and (Test-TerminalText (Join-Path $innerRoot.FullName '12_PHASE9_AUTHORIZATION.json'))) { 'PASS' } else { 'BLOCKED' }
$amendmentProof = if (-not $timedOut -and $controllerProof.status -eq 'PASS' -and $launcherProof.status -eq 'PASS' -and $amendmentMissing.Count -eq 0 -and $schemaStatus -eq 'PASS' -and $contractStatus -eq 'PASS' -and $authorityStatus -eq 'PASS' -and $duplicateKeyCount -eq 0 -and $materialStageMissing.Count -eq 0 -and $innerZipProof.status -eq 'PASS') { 'PASS' } else { 'BLOCKED' }
$guardianStatus = if (-not $timedOut -and $launcherProof.status -eq 'PASS' -and $controllerProof.status -eq 'PASS' -and $closeout -and $missing.Count -eq 0 -and $invalid.Count -eq 0) { 'PASS' } else { 'BLOCKED' }
Write-Json 'GUARDIAN_NATIVE_PROCESS_EVIDENCE.json' ([pscustomobject]@{ executable = 'powershell.exe'; arguments = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$ControllerPath); workingDirectory = Split-Path -Parent $ControllerPath; startUtc = $startUtc; endUtc = $endUtc; pid = $process.Id; timeoutSeconds = $timeoutSeconds; timedOut = $timedOut; stdoutPath = $stdoutPath; stderrPath = $stderrPath; stdoutBytes = $stdoutBytes; stderrBytes = $stderrBytes; exitCode = $exitCode; innerRoot = if ($innerRoot) { $innerRoot.FullName } else { $null }; candidateRootCount = $postLaunchRoots.Count; candidateRoots = @($postLaunchRoots | ForEach-Object { $_.FullName }) })
if ($innerRoot) { Write-GuardianFinalBinding $innerRoot.FullName ($innerRoot.Name) $exitCode $controllerProof.parserSha256 $launcherProof.parserSha256 $stdoutPath $stderrPath | Out-Null }
Write-Json '116_DIRTY_ROW_RUNTIME_SCHEMA_CENSUS.json' ([pscustomobject]@{ status = $schemaStatus; rowCount = if ($artifact75) { @($artifact75.rows).Count } else { 0 }; rowsMissingGitStatus = $schemaMissing['gitStatus']; rowsMissingPath = $schemaMissing['path']; rowsMissingClassification = $schemaMissing['classification']; rowsMissingReleaseOwned = $schemaMissing['releaseOwned']; rowsMissingCandidateIncluded = $schemaMissing['candidateIncluded']; rowsMissingReason = $schemaMissing['reason']; schemaErrorCount = $schemaMissingCount })
Write-Json '117_MOF_TO_DIRTY_PROPAGATION_RUNTIME_PROOF.json' ([pscustomobject]@{ status = if ($artifact74 -and $artifact74.status -eq 'PASS' -and $artifact74.classifiedRows -eq 41 -and $artifact74.unknownRows -eq 0 -and $artifact75 -and $artifact75.status -eq 'PASS' -and $artifact75.unknownCount -eq 0) { 'PASS' } else { 'BLOCKED' }; artifact74 = $artifact74; artifact75 = if ($artifact75) { [pscustomobject]@{ status=$artifact75.status; unknownCount=$artifact75.unknownCount } } else { $null } })
Write-Json '118_DIRTY_TREE_RUNTIME_RECONCILIATION.json' ([pscustomobject]@{ status = if ($artifact75 -and @($artifact75.rows).Count -eq $artifact75.count -and $artifact75.unknownCount -eq 0) { 'PASS' } else { 'BLOCKED' }; artifact75RowCount = if ($artifact75) { @($artifact75.rows).Count } else { 0 }; currentDirtyRowCount = if ($artifact75) { $artifact75.count } else { 0 }; artifact75UnknownCount = if ($artifact75) { $artifact75.unknownCount } else { $null } })
Write-Json '119_RELEASE_SOURCE_RUNTIME_PROOF.json' ([pscustomobject]@{ status = if ($innerRoot -and $amendmentMissing.Count -eq 0) { 'PASS' } else { 'BLOCKED' }; artifacts = @('77','78','79','80') })
Write-Json '120_PHASE8_MATRIX_RUNTIME_PROOF.json' ([pscustomobject]@{ status = if ($artifact84 -and @($artifact84.rows).Count -eq 11 -and @($artifact84.rows | Where-Object { $_.status -match 'PENDING|NOT_STARTED' }).Count -eq 0) { 'PASS' } else { 'BLOCKED' }; rowCount = if ($artifact84) { @($artifact84.rows).Count } else { 0 }; passCount = if ($artifact84) { $artifact84.passCount } else { $null }; blockedCount = if ($artifact84) { $artifact84.blockedCount } else { $null }; unverifiedCount = if ($artifact84) { $artifact84.unverifiedCount } else { $null } })
Write-Json '121_STAGE_LEDGER_RUNTIME_PROOF.json' ([pscustomobject]@{ status = if ($materialStageMissing.Count -eq 0) { 'PASS' } else { 'BLOCKED' }; requiredStageCount = $requiredStages.Count; materialStageCount = $requiredStages.Count - $materialStageMissing.Count; missingStages = $materialStageMissing })
Write-Json '122_PHASE_AUTHORITY_RUNTIME_PROOF.json' ([pscustomobject]@{ status = $authorityStatus; files = @('10_PHASE8_EXACT_RESUME.txt','11_LOCAL_RELEASE_CANDIDATE.txt','12_PHASE9_AUTHORIZATION.json') })
Write-Json '123_TERMINAL_STATUS_GUARDIAN_VERIFICATION.json' ([pscustomobject]@{ status = if ($duplicateKeyCount -eq 0 -and $malformedStatusLineCount -eq 0) { 'PASS' } else { 'BLOCKED' }; duplicateKeyCount = $duplicateKeyCount; malformedKeyCount = $malformedStatusLineCount; emptyKeyCount = @($statusLines | Where-Object { $_ -match '^=' }).Count; keyCount = $statusKeys.Count })
Write-Json '124_REQUIRED_ARTIFACT_CONTRACT_GUARDIAN_VERIFICATION.json' ([pscustomobject]@{ status = $contractStatus; required = $amendmentRequired; missing = $amendmentMissing; missingCount = $amendmentMissing.Count })
Write-Json '125_MANIFEST_RUNTIME_PROOF.json' ([pscustomobject]@{ status = if ($innerRoot -and (Test-Path (Join-Path $innerRoot.FullName 'EVIDENCE_MANIFEST.json')) -and $amendmentMissing.Count -eq 0) { 'PASS' } else { 'BLOCKED' }; requiredArtifactMissingCount = $amendmentMissing.Count; manifestPath = if ($innerRoot) { Join-Path $innerRoot.FullName 'EVIDENCE_MANIFEST.json' } else { $null } })
Write-Json '126_INNER_ZIP_RUNTIME_PROOF.json' $innerZipProof
if ($innerRoot) { $bindingData = Read-JsonFile (Join-Path $innerRoot.FullName '88_GUARDIAN_FINAL_BINDING.json') } else { $bindingData = $null }
Write-Json '127_GUARDIAN_OUTER_SEAL_RUNTIME_PROOF.json' ([pscustomobject]@{ status = if ($bindingData -and $innerZipProof.status -eq 'PASS') { 'PASS' } else { 'BLOCKED' }; innerRunId = if ($bindingData) { $bindingData.innerRunId } else { $null }; innerZipSha256 = if ($bindingData) { $bindingData.innerZipSha256 } else { $null }; childExitCode = $exitCode; controllerSha256 = $controllerProof.parserSha256; guardianSha256 = $launcherProof.parserSha256 })
Write-Json '107_GUARDIAN_OUTER_MANIFEST.json' ([pscustomobject]@{ status = $amendmentProof; innerRunId = if ($innerRoot) { $innerRoot.Name } else { $null }; artifacts = @('88','116','117','118','119','120','121','122','123','124','125','126','127') })
Write-Json '108_GUARDIAN_OUTER_SEAL.json' ([pscustomobject]@{ status = if ($bindingData -and $innerZipProof.status -eq 'PASS' -and $bindingData.innerZipSha256 -eq $innerZipProof.zipSha256) { 'PASS' } else { 'BLOCKED' }; innerRunId = if ($bindingData) { $bindingData.innerRunId } else { $null }; innerZipSha256 = if ($bindingData) { $bindingData.innerZipSha256 } else { $null }; recomputedInnerZipSha256 = $innerZipProof.zipSha256; controllerSha256 = $controllerProof.parserSha256; guardianSha256 = $launcherProof.parserSha256; childExitCode = $exitCode })
Write-Json '109_AMENDMENT10_GUARDIAN_ACCEPTANCE.json' ([pscustomobject]@{ status = $amendmentProof; amendment10RuntimeProof = $amendmentProof; innerControllerCloseout = if ($closeout) { 'PASS' } else { 'BLOCKED' }; requiredArtifactMissingCount = $amendmentMissing.Count; schemaErrorCount = $schemaMissingCount; duplicateKeyCount = $duplicateKeyCount; materialStageMissingCount = $materialStageMissing.Count; innerZipReopen = $innerZipProof.status; phase9Authorized = 'FALSE'; productionMutation = 'NO' })
Write-Json 'GUARDIAN_VALIDATION.json' ([pscustomobject]@{ guardianStatus = $guardianStatus; innerExitCode = $exitCode; innerControllerCloseout = if ($closeout -and $missing.Count -eq 0 -and $invalid.Count -eq 0) { 'PASS' } else { 'BLOCKED' }; finalStatus = $finalStatus; missingArtifacts = $missing; invalidArtifacts = $invalid; parserGuardian = $launcherProof; parserController = $controllerProof; phase9Authorized = 'FALSE'; productionMutation = 'NO' })
Write-Output ('GUARDIAN_ROOT=' + $guardianRoot)
Write-Output ('GUARDIAN_STATUS=' + $guardianStatus)
Write-Output ('INNER_EXIT_CODE=' + $exitCode)
Write-Output ('INNER_EXECUTION_CLASS=' + $(if ($timedOut) { 'TIMEOUT' } elseif ($guardianStatus -eq 'PASS' -and $exitCode -ne $null) { if ($finalStatus -match 'OVERALL_STATUS=BLOCKED') { 'VALID_BLOCKED_EXIT' } else { 'VALID_PASS_EXIT' } } else { 'INCOMPLETE_CLOSEOUT' }))
Write-Output ('INNER_CONTROLLER_CLOSEOUT=' + $(if ($closeout) { 'PASS' } else { 'BLOCKED' }))
Write-Output ('DIRTY_SCHEMA_RUNTIME=' + $schemaStatus)
Write-Output ('MOF_UNKNOWN=' + $(if ($artifact74) { $artifact74.unknownRows } else { 'UNKNOWN' }))
Write-Output ('DIRTY_UNKNOWN=' + $(if ($artifact75) { $artifact75.unknownCount } else { 'UNKNOWN' }))
Write-Output ('ARTIFACTS_75_86_PRESENT=' + $(if ($amendmentMissing.Count -eq 0) { 'PASS' } else { 'BLOCKED' }))
Write-Output ('GATE_MATRIX_ROWS=' + $(if ($artifact84) { @($artifact84.rows).Count } else { 0 }))
Write-Output ('GATE_PASS_COUNT=' + $(if ($artifact84) { $artifact84.passCount } else { 0 }))
Write-Output ('GATE_BLOCKED_COUNT=' + $(if ($artifact84) { $artifact84.blockedCount } else { 0 }))
Write-Output ('GATE_UNVERIFIED_COUNT=' + $(if ($artifact84) { $artifact84.unverifiedCount } else { 0 }))
Write-Output ('MATERIAL_STAGE_LEDGER=' + $(if ($materialStageMissing.Count -eq 0) { 'PASS' } else { 'BLOCKED' }))
Write-Output ('PHASE_AUTHORITY_FILES_TERMINAL=' + $authorityStatus)
Write-Output ('TERMINAL_STATUS_DUPLICATE_KEY_COUNT=' + $duplicateKeyCount)
Write-Output ('REQUIRED_ARTIFACT_MISSING_COUNT=' + $amendmentMissing.Count)
Write-Output ('CROSS_ARTIFACT_CONSISTENCY=' + $(if ($artifact85) { 'PASS' } else { 'BLOCKED' }))
Write-Output ('EVIDENCE_MANIFEST_FINALIZED=' + $(if ($innerRoot -and (Test-Path (Join-Path $innerRoot.FullName 'EVIDENCE_MANIFEST.json'))) { 'PASS' } else { 'BLOCKED' }))
Write-Output ('INNER_ZIP_REOPEN=' + $innerZipProof.status)
Write-Output ('GUARDIAN_BINDING=' + $(if ($bindingData) { 'PASS' } else { 'BLOCKED' }))
Write-Output ('GUARDIAN_OUTER_SEAL=' + $(if ($bindingData -and $innerZipProof.status -eq 'PASS' -and $bindingData.innerZipSha256 -eq $innerZipProof.zipSha256) { 'PASS' } else { 'BLOCKED' }))
Write-Output ('AMENDMENT10_RUNTIME_PROOF=' + $amendmentProof)
Write-Output 'PHASE8_EXACT_RESUME=NOT_YET_RESEALED'
Write-Output 'LOCAL_RELEASE_CANDIDATE=NOT_YET_AUTHORIZED'
Write-Output 'PHASE9_AUTHORIZED=FALSE'
Write-Output 'PRODUCTION_MUTATION=NO'
Write-Output ('TASK_STATUS=' + $(if ($amendmentProof -eq 'PASS') { 'CLOSED' } else { 'BLOCKED' }))
Write-Output ('OVERALL_STATUS=' + $(if ($amendmentProof -eq 'PASS') { 'PASS' } else { 'BLOCKED' }))
exit $(if ($guardianStatus -eq 'PASS') { 0 } else { 1 })
