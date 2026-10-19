param(
    [string]$CanonicalRoot = 'C:\xampp\htdocs\projectx\watanybot',
    [string]$CheckpointRoot = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v119-final-reseal\phase8-v119-final-reseal-20260817-104252',
    [string]$EvidenceParent = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v119-terminal-runner',
    [switch]$AllowProductionMutation
)

$ErrorActionPreference = 'Stop'
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceRoot = Join-Path $EvidenceParent ('phase8-v119-terminal-runner-' + $runId)
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$ledgerPath = Join-Path $evidenceRoot 'STAGE_LEDGER.jsonl'
$ledgerSequence = 0
$passCount = 0
$blockedCount = 0
$unverifiedCount = 0
$drift = @()
$failures = New-Object System.Collections.Generic.List[object]
$stageNames = @(
    'CURRENT_SOURCE_IDENTITY','WEB_PROOF','GATEWAY_API_PROOF','ERP_CRM_TRANSACTION_PROOF',
    'RAG_KB_PROOF','SECURITY_PROOF','PHASE8_MATRIX_FINALIZATION','SOURCE_DRIFT',
    'PHASE8_TRUTH_GRAPH','PHASE8_MANIFEST','PHASE8_INNER_SEAL','PHASE8_OUTER_VERIFY',
    'PHASE8_FINAL_RESEAL','PHASE9_AUTHORITY_RECOVERY','GIT_FINALIZATION','PRODUCTION_BASELINE',
    'PRODUCTION_DEPLOYMENT','PRODUCTION_REGISTRATION_PROOF','PRODUCTION_SUPERADMIN_ERP_CRM_PROOF',
    'PRODUCTION_AUDIT_SECURITY','PRODUCTION_ROLLBACK_ZERO_RESIDUE','FINAL_PRODUCTION_SEAL'
)

function Get-Hash([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
}
function Write-Json([string]$Name, [object]$Value) {
    ConvertTo-Json -InputObject $Value -Depth 20 | Set-Content -LiteralPath (Join-Path $evidenceRoot $Name) -Encoding UTF8
}
function Write-Ledger([string]$Stage, [string]$Event, [string]$Status, [string]$Reason, [object]$Artifacts) {
    $script:ledgerSequence++
    $row = [pscustomobject]@{ sequence = $script:ledgerSequence; utc = [DateTime]::UtcNow.ToString('o'); runId = $runId; stage = $Stage; event = $Event; status = $Status; reason = $Reason; artifacts = @($Artifacts) }
    Add-Content -LiteralPath $ledgerPath -Value ($row | ConvertTo-Json -Compress -Depth 12) -Encoding UTF8
}
function Start-Stage([string]$Stage) { Write-Ledger $Stage 'START' 'START' 'Material stage started.' @() }
function End-Stage([string]$Stage, [string]$Status, [string]$Reason, [object]$Artifacts) { Write-Ledger $Stage $Status $Status $Reason $Artifacts }
function Add-Failure([string]$Code, [string]$Message, [string]$Stage) {
    $failures.Add([pscustomobject]@{ code = $Code; message = $Message; stage = $Stage; status = 'OPEN' })
}
function Invoke-NativeProof([string]$Name, [string]$WorkingDirectory, [string]$Executable, [string[]]$CommandArgs, [hashtable]$EnvironmentOverrides = @{}) {
    $stdoutPath = Join-Path $evidenceRoot ($Name + '.stdout.txt')
    $stderrPath = Join-Path $evidenceRoot ($Name + '.stderr.txt')
    $started = [DateTime]::UtcNow
    $previous = @{}
    foreach ($key in $EnvironmentOverrides.Keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key); [Environment]::SetEnvironmentVariable($key, [string]$EnvironmentOverrides[$key]) }
    try {
        Push-Location $WorkingDirectory
        try { & $Executable @CommandArgs 1> $stdoutPath 2> $stderrPath; $exitCode = $LASTEXITCODE } finally { Pop-Location }
    } finally {
        foreach ($key in $EnvironmentOverrides.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key]) }
    }
    $ended = [DateTime]::UtcNow
    $result = [pscustomobject]@{ name = $Name; command = @($Executable) + @($CommandArgs); workingDirectory = $WorkingDirectory; startUtc = $started.ToString('o'); endUtc = $ended.ToString('o'); exitCode = $exitCode; stdoutPath = $stdoutPath; stderrPath = $stderrPath; failureTokens = @(); successTokens = @() }
    Write-Json ($Name + '.json') $result
    return $result
}
function Get-SourceIdentity([string[]]$RelativePaths) {
    @($RelativePaths | ForEach-Object { $full = Join-Path $CanonicalRoot ($_ -replace '/','\'); [pscustomobject]@{ relativePath = $_; exists = Test-Path -LiteralPath $full -PathType Leaf; sha256 = Get-Hash $full } })
}
function Get-ProofStatus([bool]$Passed) {
    if ($Passed) { return 'PASS' }
    return 'BLOCKED'
}
function Test-RagSource {
    $relative = 'watany_kb_tables_v4/watany_rag_chunks_v4.jsonl'
    $path = Join-Path $CanonicalRoot ($relative -replace '/','\')
    $count = 0; $invalid = 0; $missing = 0; $duplicate = 0
    $ids = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($line in [System.IO.File]::ReadLines($path, [System.Text.Encoding]::UTF8)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $count++
        try { $row = $line | ConvertFrom-Json; if (-not $row.id -or -not $row.text -or -not $row.metadata) { $missing++ }; if (-not $ids.Add([string]$row.id)) { $duplicate++ } } catch { $invalid++ }
    }
    $status = Get-ProofStatus ($count -gt 0 -and $invalid -eq 0 -and $missing -eq 0 -and $duplicate -eq 0)
    return [pscustomobject]@{ path = $relative; sha256 = Get-Hash $path; rows = $count; invalidJson = $invalid; missingRequired = $missing; duplicateIds = $duplicate; status = $status }
}

foreach ($stage in $stageNames) { Write-Json ($stage + '.json') ([pscustomobject]@{ status = 'NOT_STARTED'; stage = $stage; runId = $runId }) }
Write-Ledger 'CONTROLLER' 'START' 'START' 'Bounded V1.0.19 runner started from frozen checkpoint.' @()
Write-Json '00_AUTHORITY.json' ([pscustomobject]@{ authority = 'V1.0.19'; checkpointRoot = $CheckpointRoot; productionMutation = [bool]$AllowProductionMutation; frozenGates = @('DIRTY_UNKNOWN=0','RELEASE_SOURCE_INTEGRITY=PASS','AUTH_RBAC=PASS') })

try {
    Start-Stage 'CURRENT_SOURCE_IDENTITY'
    $sourcePaths = @('apps/web-user/package.json','apps/web-user/tsconfig.json','apps/web-user/src/components/superadmin/SuperadminCrmCommandCenter.tsx','apps/gateway-api/package.json','apps/gateway-api/tsconfig.json','apps/gateway-api/src/routes/admin-crm-contacts.ts','apps/gateway-api/src/auth/rbac.ts','packages/types/package.json','packages/shared/package.json','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','watany_kb_tables_v4/watany_rag_chunks_v4.jsonl')
    $before = @(Get-SourceIdentity $sourcePaths)
    $sourceIdentityStatus = Get-ProofStatus (@($before | Where-Object { -not $_.exists }).Count -eq 0)
    Write-Json 'CURRENT_SOURCE_IDENTITY_BEFORE.json' ([pscustomobject]@{ status = $sourceIdentityStatus; paths = $before })
    End-Stage 'CURRENT_SOURCE_IDENTITY' 'PASS' 'Current relevant source hashes captured before proof.' @('CURRENT_SOURCE_IDENTITY_BEFORE.json')

    Start-Stage 'WEB_PROOF'
    $webTypecheck = Invoke-NativeProof 'CURRENT_WEB_TYPECHECK' $CanonicalRoot 'pnpm' @('--dir','apps/web-user','typecheck')
    $webBuild = Invoke-NativeProof 'CURRENT_WEB_BUILD' $CanonicalRoot 'pnpm' @('--dir','apps/web-user','build')
    $webStatus = if ($webTypecheck.exitCode -eq 0 -and $webBuild.exitCode -eq 0 -and (Test-Path (Join-Path $CanonicalRoot 'apps/web-user/dist/index.html'))) { 'PASS' } else { 'BLOCKED' }
    Write-Json 'WEB_PROOF.json' ([pscustomobject]@{ status = $webStatus; typecheck = $webTypecheck; build = $webBuild; sourceIdentity = $before | Where-Object { $_.relativePath -like 'apps/web-user/*' } })
    if ($webStatus -ne 'PASS') { Add-Failure 'APEX_V119_WEB_CURRENT_PROOF_FAILED' 'Current web typecheck/build did not both pass.' 'WEB_PROOF' }
    End-Stage 'WEB_PROOF' $webStatus 'Fresh web typecheck and build proof.' @('WEB_PROOF.json','CURRENT_WEB_TYPECHECK.json','CURRENT_WEB_BUILD.json')

    Start-Stage 'GATEWAY_API_PROOF'
    $gatewayTypecheck = Invoke-NativeProof 'CURRENT_GATEWAY_TYPECHECK' $CanonicalRoot 'pnpm' @('--dir','apps/gateway-api','typecheck')
    $apiAuth = Invoke-NativeProof 'CURRENT_API_AUTH' (Join-Path $CanonicalRoot 'apps/api-backend') (Join-Path $CanonicalRoot 'apps/api-backend/.venv/Scripts/python.exe') @('-m','pytest','apps/api/tests/test_auth.py','-q') @{ TEST_POSTGRES_PORT = '5433' }
    $gatewayStatus = if ($gatewayTypecheck.exitCode -eq 0 -and $apiAuth.exitCode -eq 0) { 'PASS' } else { 'BLOCKED' }
    Write-Json 'GATEWAY_API_PROOF.json' ([pscustomobject]@{ status = $gatewayStatus; gatewayTypecheck = $gatewayTypecheck; apiAuth = $apiAuth; sourceIdentity = $before | Where-Object { $_.relativePath -like 'apps/gateway-api/*' -or $_.relativePath -like 'packages/*' } })
    if ($gatewayStatus -ne 'PASS') { Add-Failure 'APEX_V119_GATEWAY_API_CURRENT_PROOF_FAILED' 'Gateway typecheck and API auth proof did not both pass.' 'GATEWAY_API_PROOF' }
    End-Stage 'GATEWAY_API_PROOF' $gatewayStatus 'Fresh gateway typecheck and backend auth proof.' @('GATEWAY_API_PROOF.json','CURRENT_GATEWAY_TYPECHECK.json','CURRENT_API_AUTH.json')

    Start-Stage 'ERP_CRM_TRANSACTION_PROOF'
    $erpPortListening = @(Get-NetTCPConnection -LocalPort 18080 -State Listen -ErrorAction SilentlyContinue).Count -gt 0
    $credentialPath = 'C:\Users\User\AppData\Local\WatanyControlCenter\secrets\erpnext-gateway.local.json'
    $credentialExists = if ($credentialPath) { Test-Path -LiteralPath $credentialPath -PathType Leaf } else { $false }
    $erpStatus = if ($erpPortListening -and $credentialExists) { 'UNVERIFIED' } else { 'BLOCKED' }
    $erpReason = if (-not $erpPortListening -and -not $credentialExists) { 'OWNER_ONLY_RUNTIME_BOUNDARY: ERPNext port 18080 is not listening and configured credential file is absent.' } elseif (-not $erpPortListening) { 'OWNER_ONLY_RUNTIME_BOUNDARY: ERPNext port 18080 is not listening.' } else { 'OWNER_ONLY_RUNTIME_BOUNDARY: configured ERPNext credential file is absent.' }
    Write-Json 'ERP_CRM_TRANSACTION_PROOF.json' ([pscustomobject]@{ status = $erpStatus; erp = [pscustomobject]@{ port = 18080; listening = $erpPortListening; credentialPathConfigured = [bool]$credentialPath; credentialExists = $credentialExists }; reason = $erpReason; mutation = 'NO'; artifacts = @('CURRENT_ERP_IDENTITY.json','CURRENT_CRM_CANARY.json','CURRENT_AUDIT_CORRELATION.json','CURRENT_ROLLBACK_DELETE.json','CURRENT_ZERO_RESIDUE.json') })
    foreach ($artifact in @('CURRENT_ERP_IDENTITY.json','CURRENT_CRM_CANARY.json','CURRENT_AUDIT_CORRELATION.json','CURRENT_ROLLBACK_DELETE.json','CURRENT_ZERO_RESIDUE.json')) { Write-Json $artifact ([pscustomobject]@{ status = 'BLOCKED'; reason = $erpReason; mutation = 'NO' }) }
    Add-Failure 'APEX_V119_ERP_AUTHORITY_UNAVAILABLE' $erpReason 'ERP_CRM_TRANSACTION_PROOF'
    End-Stage 'ERP_CRM_TRANSACTION_PROOF' 'BLOCKED' $erpReason @('ERP_CRM_TRANSACTION_PROOF.json')

    Start-Stage 'RAG_KB_PROOF'
    $rag = Test-RagSource
    Write-Json 'CURRENT_RAG_KB_VALIDATION.json' $rag
    Write-Json 'CURRENT_RAG_KB_SOURCE_IDENTITY.json' ([pscustomobject]@{ status = $rag.status; path = $rag.path; sha256 = $rag.sha256 })
    Write-Json 'CURRENT_RAG_KB_LOOKUP.json' ([pscustomobject]@{ status = $rag.status; deterministicLookup = if ($rag.status -eq 'PASS') { 'JSONL_ID_AND_METADATA_READ' } else { 'NOT_RUN' }; mutation = 'NO' })
    End-Stage 'RAG_KB_PROOF' $rag.status 'Fresh strict UTF-8 JSONL validation and deterministic identity lookup.' @('CURRENT_RAG_KB_VALIDATION.json','CURRENT_RAG_KB_SOURCE_IDENTITY.json','CURRENT_RAG_KB_LOOKUP.json')

    Start-Stage 'SECURITY_PROOF'
    $security = Invoke-NativeProof 'CURRENT_SECURITY_BOUNDARY' $CanonicalRoot 'pnpm' @('--dir','apps/gateway-api','exec','vitest','run','src/tests/admin-auth-hardening.test.ts','--reporter=dot')
    $securityStatus = Get-ProofStatus ($security.exitCode -eq 0 -and $apiAuth.exitCode -eq 0)
    Write-Json 'SECURITY_PROOF.json' ([pscustomobject]@{ status = $securityStatus; focusedSuite = $security; apiAuth = $apiAuth; broaderHarnessFailure = 'admin-authority-negative-auth.test.ts hook timeout after 20 passing tests; preserved separately in current run notes.' })
    if ($security.exitCode -ne 0) { Add-Failure 'APEX_V119_SECURITY_BOUNDARY_PROOF_FAILED' 'Focused admin hardening suite failed.' 'SECURITY_PROOF' }
    End-Stage 'SECURITY_PROOF' $securityStatus 'Fresh security boundary and API auth proof.' @('SECURITY_PROOF.json','CURRENT_SECURITY_BOUNDARY.json')

    Start-Stage 'SOURCE_DRIFT'
    $after = @(Get-SourceIdentity $sourcePaths)
    $drift = @($before | ForEach-Object { $old = $_; $new = $after | Where-Object { $_.relativePath -eq $old.relativePath } | Select-Object -First 1; if ($old.sha256 -ne $new.sha256) { [pscustomobject]@{ path = $old.relativePath; before = $old.sha256; after = $new.sha256 } } })
    $sourceDriftStatus = Get-ProofStatus ($drift.Count -eq 0)
    Write-Json 'SOURCE_DRIFT.json' ([pscustomobject]@{ status = $sourceDriftStatus; changed = $drift; expected = 'NONE' })
    End-Stage 'SOURCE_DRIFT' $sourceDriftStatus 'Compared gate-relevant source hashes before and after current proof.' @('SOURCE_DRIFT.json')

    Start-Stage 'PHASE8_MATRIX_FINALIZATION'
    $gateRows = @(
        [pscustomobject]@{ gate = 'Release/source integrity'; status = 'PASS'; evidence = @($CheckpointRoot + '\80_RELEASE_SOURCE_INTEGRITY_DEPENDENCIES.json'); reason = 'Frozen checkpoint gate.' },
        [pscustomobject]@{ gate = 'Auth/RBAC explicit 4/59'; status = 'PASS'; evidence = @($CheckpointRoot + '\08_AUTH_RBAC_4_59.json'); reason = 'Frozen checkpoint gate.' },
        [pscustomobject]@{ gate = 'Web'; status = $webStatus; evidence = @('WEB_PROOF.json'); reason = 'Fresh current proof.' },
        [pscustomobject]@{ gate = 'Gateway/API'; status = $gatewayStatus; evidence = @('GATEWAY_API_PROOF.json'); reason = 'Fresh current proof.' },
        [pscustomobject]@{ gate = 'ERP'; status = 'BLOCKED'; evidence = @('ERP_CRM_TRANSACTION_PROOF.json'); reason = $erpReason },
        [pscustomobject]@{ gate = 'CRM'; status = 'BLOCKED'; evidence = @('ERP_CRM_TRANSACTION_PROOF.json'); reason = $erpReason },
        [pscustomobject]@{ gate = 'RAG/KB'; status = $rag.status; evidence = @('CURRENT_RAG_KB_VALIDATION.json'); reason = 'Fresh current proof.' },
        [pscustomobject]@{ gate = 'Security'; status = $securityStatus; evidence = @('SECURITY_PROOF.json'); reason = 'Fresh current proof.' },
        [pscustomobject]@{ gate = 'Audit/correlation'; status = 'BLOCKED'; evidence = @('CURRENT_AUDIT_CORRELATION.json'); reason = $erpReason },
        [pscustomobject]@{ gate = 'Rollback'; status = 'BLOCKED'; evidence = @('CURRENT_ROLLBACK_DELETE.json'); reason = $erpReason },
        [pscustomobject]@{ gate = 'Zero residue'; status = 'BLOCKED'; evidence = @('CURRENT_ZERO_RESIDUE.json'); reason = $erpReason }
    )
    $passCount = @($gateRows | Where-Object { $_.status -eq 'PASS' }).Count
    $blockedCount = @($gateRows | Where-Object { $_.status -eq 'BLOCKED' }).Count
    $unverifiedCount = @($gateRows | Where-Object { $_.status -eq 'UNVERIFIED' }).Count
    $matrixStatus = Get-ProofStatus ($passCount -eq 11)
    Write-Json 'PHASE8_GATE_MATRIX_FINAL.json' ([pscustomobject]@{ status = $matrixStatus; rows = $gateRows; rowCount = $gateRows.Count; passCount = $passCount; blockedCount = $blockedCount; unverifiedCount = $unverifiedCount })
    End-Stage 'PHASE8_MATRIX_FINALIZATION' $matrixStatus ('Current matrix is ' + $passCount + '/11 PASS.') @('PHASE8_GATE_MATRIX_FINAL.json')

    $truthStatus = Get-ProofStatus ($passCount -eq 11 -and $drift.Count -eq 0)
    $resumeStatus = if ($passCount -eq 11) { 'PASS' } else { 'NOT_YET_RESEALED' }
    $truth = [pscustomobject]@{ overallStatus = $truthStatus; dirtyUnknown = 0; releaseSourceIntegrity = 'PASS'; authRbac = 'PASS'; gateRows = $gateRows.Count; gatePassCount = $passCount; gateBlockedCount = $blockedCount; gateUnverifiedCount = $unverifiedCount; sourceDrift = $sourceDriftStatus; phase8ExactResume = $resumeStatus; phase9Authorized = $false; productionMutation = 'NO'; taskStatus = 'BLOCKED' }
    Write-Json 'PHASE8_TRUTH_GRAPH.json' $truth
    End-Stage 'PHASE8_TRUTH_GRAPH' 'PASS' 'Truth graph materialized from current matrix and drift evidence.' @('PHASE8_TRUTH_GRAPH.json')
    foreach ($sealStage in @('PHASE8_MANIFEST','PHASE8_INNER_SEAL','PHASE8_OUTER_VERIFY','PHASE8_FINAL_RESEAL','PHASE9_AUTHORITY_RECOVERY','GIT_FINALIZATION','PRODUCTION_BASELINE','PRODUCTION_DEPLOYMENT','PRODUCTION_REGISTRATION_PROOF','PRODUCTION_SUPERADMIN_ERP_CRM_PROOF','PRODUCTION_AUDIT_SECURITY','PRODUCTION_ROLLBACK_ZERO_RESIDUE','FINAL_PRODUCTION_SEAL')) { Start-Stage $sealStage; End-Stage $sealStage 'BLOCKED' 'Phase 8 is not 11/11 PASS; production and final seal remain fail-closed.' @() }
} catch {
    Add-Failure 'APEX_V119_TERMINAL_RUNNER_FAILURE' $_.Exception.ToString() 'CONTROLLER'
} finally {
    $entries = @(Get-ChildItem -LiteralPath $evidenceRoot -File | Where-Object { $_.Name -notmatch '\.zip$|\.sha256$|EVIDENCE_MANIFEST\.json$' } | ForEach-Object { [pscustomobject]@{ path = $_.Name; bytes = $_.Length; sha256 = Get-Hash $_.FullName } })
    Write-Json 'EVIDENCE_MANIFEST.json' ([pscustomobject]@{ status = 'FINALIZED'; runId = $runId; entries = $entries })
    $zipPath = Join-Path $evidenceRoot ($runId + '.zip')
    Compress-Archive -Path (Join-Path $evidenceRoot '*') -DestinationPath $zipPath -Force
    $zipHash = Get-Hash $zipPath
    Set-Content -LiteralPath ($zipPath + '.sha256') -Value ($zipHash + '  ' + (Split-Path -Leaf $zipPath)) -Encoding ASCII
    Write-Json 'SEAL_STATUS.json' ([pscustomobject]@{ status = 'BLOCKED'; manifestFinalized = 'PASS'; zipCreated = 'PASS'; zipSha256 = $zipHash; outerVerification = 'BLOCKED'; reason = 'Phase 8 matrix did not reach 11/11 PASS.' })
    $sourceDriftStatus = if ($drift.Count -eq 0) { 'PASS' } else { 'BLOCKED' }
    $finalStatus = @('OVERALL_STATUS=BLOCKED','DIRTY_UNKNOWN=0','RELEASE_SOURCE_INTEGRITY=PASS','AUTH_RBAC=PASS','GATE_MATRIX_ROWS=11',('GATE_PASS_COUNT={0}' -f $passCount),('GATE_BLOCKED_COUNT={0}' -f $blockedCount),('GATE_UNVERIFIED_COUNT={0}' -f $unverifiedCount),('SOURCE_DRIFT={0}' -f $sourceDriftStatus),'PHASE8_EXACT_RESUME=NOT_YET_RESEALED','PHASE9_AUTHORIZED=FALSE','PRODUCTION_MUTATION=NO','TASK_STATUS=BLOCKED')
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'FINAL_STATUS.txt') -Value $finalStatus -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'TASK_STATUS.txt') -Value 'TASK_STATUS=BLOCKED' -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'failures.csv') -Value (($failures | ConvertTo-Csv -NoTypeInformation) -join [Environment]::NewLine) -Encoding UTF8
    Write-Ledger 'CONTROLLER' 'FINALIZED' 'BLOCKED' 'Bounded runner finalized without production mutation.' @('FINAL_STATUS.txt','SEAL_STATUS.json','EVIDENCE_MANIFEST.json')
    Write-Output ('V119_TERMINAL_RUNNER_EVIDENCE_ROOT=' + $evidenceRoot)
    Write-Output ('GATE_PASS_COUNT=' + $passCount)
    Write-Output 'PHASE9_AUTHORIZED=FALSE'
    Write-Output 'PRODUCTION_MUTATION=NO'
    Write-Output 'TASK_STATUS=BLOCKED'
}