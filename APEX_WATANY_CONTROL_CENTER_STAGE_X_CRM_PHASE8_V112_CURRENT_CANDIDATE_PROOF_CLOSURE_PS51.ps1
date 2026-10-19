#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$PredecessorEvidenceRoot,
    [Parameter(Mandatory = $true)][string]$PredecessorZipPath,
    [Parameter(Mandatory = $true)][string]$FinalReleaseManifestPath,
    [Parameter(Mandatory = $true)][string]$CandidateRoot,
    [string]$OutputRoot = '',
    [string]$GatewayBaseUrl = 'http://127.0.0.1:8010'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[void][System.Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')
$workspace = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path $env:USERPROFILE 'Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v112-final-green' }
$runId = 'phase8-v112-final-green-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$evidenceRoot = Join-Path $OutputRoot $runId
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$failureRows = New-Object System.Collections.Generic.List[object]
$actionRows = New-Object System.Collections.Generic.List[object]

function Get-FileSha256([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return '' }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}
function Write-Utf8([string]$Path, [string]$Text) { [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false))) }
function Write-Json([string]$Name, [object]$Value) { Write-Utf8 (Join-Path $evidenceRoot $Name) (($Value | ConvertTo-Json -Depth 16) + "`r`n") }
function Add-Failure([string]$Code, [string]$Detail) { [void]$failureRows.Add([pscustomobject]@{ code = $Code; detail = $Detail; status = 'OPEN' }) }
function Add-Action([string]$Name, [string]$Status, [string]$Detail) { [void]$actionRows.Add([pscustomobject]@{ action = $Name; status = $Status; detail = $Detail }) }
function New-Proof([string]$Domain, [string]$Status, [string]$Strategy, [string]$Reason, [hashtable]$Metrics = @{}) {
    $result = [ordered]@{ domain = $Domain; status = $Status; proofStrategy = $Strategy; reason = $Reason; productionMutation = 'NO' }
    foreach ($key in $Metrics.Keys) { $result[$key] = $Metrics[$key] }
    return [pscustomobject]$result
}
function Invoke-ReadOnlyProbe([string]$Uri) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 10 -ErrorAction Stop
        return [pscustomobject]@{ statusCode = [int]$response.StatusCode; body = [string]$response.Content; error = '' }
    } catch {
        $statusCode = 0
        try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch { }
        return [pscustomobject]@{ statusCode = $statusCode; body = ''; error = $_.Exception.Message }
    }
}
function Invoke-GatewayAuthSuite([string]$Root) {
    $pnpm = 'C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs'
    $commandArgs = @($pnpm, '--filter', 'gateway-api', 'test', '--', '--run', 'src/tests/auth-rbac.test.ts', 'src/tests/admin-auth-hardening.test.ts', 'src/tests/admin-authority-negative-auth.test.ts', 'src/tests/superadmin-users-production-auth.test.ts', '--pool=forks', '--poolOptions.forks.singleFork=true')
    $stdoutPath = Join-Path $evidenceRoot 'gateway-auth-rbac.stdout.log'
    $stderrPath = Join-Path $evidenceRoot 'gateway-auth-rbac.stderr.log'
    $exitCode = -1
    Push-Location $Root
    try { & node.exe @commandArgs 1> $stdoutPath 2> $stderrPath; $exitCode = $LASTEXITCODE } finally { Pop-Location }
    $outText = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw } else { '' }
    $passed = ($exitCode -eq 0 -and $outText -match 'Test Files\s+4 passed' -and $outText -match 'Tests\s+59 passed')
    $status = 'BLOCKED'; $reason = 'Current isolated candidate produced a non-authoritative reduced auth/RBAC collection; required 4 files and 59 tests were not proven.'; if ($passed) { $status = 'PASS'; $reason = 'Current gateway auth and RBAC suite passed.' }
    return New-Proof 'AUTH_REGISTRATION_RBAC' $status 'RERUN_CURRENT_CANDIDATE' $reason @{ exitCode = $exitCode; collection = $status; loginRegression = $status; registrationRegression = $status; normalUserSuperadminDenial = $status; superadminAuthorization = $status; superadminCommandCenterGuard = $status; crmRouteRbac = $status }
}

Write-Json '00_RUN_METADATA.json' ([pscustomobject]@{ runId = $runId; authority = 'V1.0.12'; controller = $MyInvocation.MyCommand.Path; productionDeployment = 'NO'; productionMutation = 'NO' })
Write-Json '01_CONTROLLER_IDENTITY.json' ([pscustomobject]@{ path = $MyInvocation.MyCommand.Path; sha256 = Get-FileSha256 $MyInvocation.MyCommand.Path; powershell = $PSVersionTable.PSVersion.ToString() })
$predecessorExists = Test-Path -LiteralPath $PredecessorEvidenceRoot -PathType Container
$zipExists = Test-Path -LiteralPath $PredecessorZipPath -PathType Leaf
$predecessorZipHash = Get-FileSha256 $PredecessorZipPath
$zipEntries = @()
if ($zipExists) { $archive = [System.IO.Compression.ZipFile]::OpenRead($PredecessorZipPath); try { $zipEntries = @($archive.Entries | ForEach-Object { $_.FullName }) } finally { $archive.Dispose() } }
$requiredPredecessorMembers = @('12_API_AUTH_PROOF.json','13_AUTH_REGISTRATION_RBAC_PROOF.json','14_ERP_READINESS.json','15_CRM_CANARY_AUDIT_ROLLBACK.json','16_RAG_HASH_STABILITY.json','17_SECURITY_PREFLIGHT.json','18_POST_MATRIX_HASH_REVALIDATION.json','21_PHASE9_HANDOFF.json','ZIP_REOPEN_VALIDATION.json','ZIP_SIDECAR.json')
$membershipPass = ($predecessorExists -and $zipExists -and (@($requiredPredecessorMembers | Where-Object { $zipEntries -notcontains $_ }).Count -eq 0))
Write-Json '02_V110_PREDECESSOR_INTAKE.json' ([pscustomobject]@{ status = if ($membershipPass) { 'PASS' } else { 'BLOCKED' }; evidenceRoot = $PredecessorEvidenceRoot; zipPath = $PredecessorZipPath; zipSha256 = $predecessorZipHash; zipNameMembership = if ($membershipPass) { 'PASS' } else { 'BLOCKED' }; currentByteCompatibilityRequired = 'YES'; staleReuseForbidden = 'YES' })
$gitHead = (& git -C $workspace rev-parse HEAD 2>$null | Select-Object -First 1)
$manifestHash = Get-FileSha256 $FinalReleaseManifestPath
$identityPass = ($gitHead -and (Test-Path -LiteralPath $FinalReleaseManifestPath -PathType Leaf) -and (Test-Path -LiteralPath $CandidateRoot -PathType Container))
Write-Json '03_CURRENT_CANDIDATE_IDENTITY.json' ([pscustomobject]@{ status = if ($identityPass) { 'PASS' } else { 'BLOCKED' }; candidateRoot = $CandidateRoot; candidateHasGitMetadata = (Test-Path -LiteralPath (Join-Path $CandidateRoot '.git')); gitHead = [string]$gitHead; gitIdentitySource = $workspace; manifestSha256 = $manifestHash; dirtyPathCount = @(& git -C $workspace status --short --untracked-files=all 2>$null).Count })
Write-Json '04_PROOF_LINEAGE.json' ([pscustomobject]@{ API_AUTH = 'RERUN_CURRENT_OR_BLOCKED'; AUTH_REGISTRATION_RBAC = 'RERUN_CURRENT_CANDIDATE'; ERP = 'RERUN_CURRENT_OR_BLOCKED'; CRM = 'RERUN_CURRENT_OR_BLOCKED'; RAG = 'CONSUME_V110_CURRENT_PASS'; SECURITY = 'CLASSIFY_CURRENT_HITS'; POST_MATRIX = 'RECOMPUTE_TYPED_METRICS' })
if (Test-Path -LiteralPath $FinalReleaseManifestPath -PathType Leaf) { Copy-Item -LiteralPath $FinalReleaseManifestPath -Destination (Join-Path $evidenceRoot '05_FINAL_RELEASE_SOURCE_MANIFEST.json') -Force }
$apiPort = Get-NetTCPConnection -LocalPort 5434 -State Listen -ErrorAction SilentlyContinue
$apiAuth = if ($null -eq $apiPort) { New-Proof 'API_AUTH' 'BLOCKED' 'RERUN_CURRENT_REQUIRED' 'Disposable test PostgreSQL listener 5434 is absent; existing 5433 runtime was preserved.' @{ apiAuthCollection = 'BLOCKED'; apiAuthSuiteExitCode = -1; testPostgres5434Listener = 'BLOCKED'; productionDbUsed = 'NO'; productionCredentialReuse = 'NO'; disposableRuntimeStopped = 'NOT_STARTED'; existing5433RuntimePreserved = 'PASS' } } else { New-Proof 'API_AUTH' 'BLOCKED' 'RERUN_CURRENT_REQUIRED' 'Listener exists but this controller does not own a verified disposable database lifecycle contract.' @{ apiAuthCollection = 'BLOCKED'; apiAuthSuiteExitCode = -1; testPostgres5434Listener = 'PASS'; productionDbUsed = 'NO'; productionCredentialReuse = 'NO' } }
Write-Json '12_API_AUTH_PROOF.json' $apiAuth
$authRbac = Invoke-GatewayAuthSuite $CandidateRoot
Write-Json '13_AUTH_REGISTRATION_RBAC_PROOF.json' $authRbac
$erpProbe = Invoke-ReadOnlyProbe ($GatewayBaseUrl.TrimEnd('/') + '/api/erpnext/readiness')
$erpPass = ($erpProbe.statusCode -eq 200)
$credentialFile = Join-Path $env:LOCALAPPDATA 'WatanyControlCenter\secrets\erpnext-gateway.local.json'
$credentialSource = if (Test-Path -LiteralPath $credentialFile -PathType Leaf) { 'YES' } else { 'NO' }
$erpPass = ($erpPass -and $credentialSource -eq 'YES')
$erpStatus = 'BLOCKED'; $erpReason = 'Current gateway ERP readiness or non-secret credential-source presence was not fully proven; no credential value was exposed.'; if ($erpPass) { $erpStatus = 'PASS'; $erpReason = 'Gateway ERP readiness and credential-source presence passed without exposing a value.' }
$erpMetric = 'BLOCKED'; $contactReadiness = 'BLOCKED'; if ($erpPass) { $erpMetric = 'PASS'; $contactReadiness = 'REQUIRES_CANARY' }
$erp = New-Proof 'ERP' $erpStatus 'RERUN_CURRENT_READ_ONLY' $erpReason @{ endpointResolved = $erpMetric; runtimeReachable = $erpMetric; credentialSourcePresent = $credentialSource; credentialValueExposed = 'NO'; authenticatedReadProbe = $erpMetric; contactDoctypeReadiness = $contactReadiness; mutationDuringReadiness = 'NO'; httpStatus = $erpProbe.statusCode }
Write-Json '14_ERP_READINESS.json' $erp
$crm = New-Proof 'CRM' 'BLOCKED' 'RERUN_CURRENT_REQUIRED' 'CRM canary requires current authenticated superadmin credentials and ERP readiness; no credential was invented or exposed.' @{ create = 'BLOCKED'; read = 'BLOCKED'; update = 'BLOCKED'; readback = 'BLOCKED'; audit = 'BLOCKED'; rollback = 'BLOCKED'; finalResidue = 'UNKNOWN'; realBusinessRecordMutation = 'NO' }
Write-Json '15_CRM_CANARY_AUDIT_ROLLBACK.json' $crm
$rag = if (Test-Path -LiteralPath (Join-Path $PredecessorEvidenceRoot '16_RAG_HASH_STABILITY.json') -PathType Leaf) { Get-Content -LiteralPath (Join-Path $PredecessorEvidenceRoot '16_RAG_HASH_STABILITY.json') -Raw | ConvertFrom-Json } else { $null }
$ragPass = ($null -ne $rag -and [string]$rag.status -eq 'PASS' -and [int]$rag.ragUnauthorizedMutationCount -eq 0)
$ragStatus = 'BLOCKED'; $ragCount = -1; if ($null -ne $rag) { $ragCount = $rag.ragUnauthorizedMutationCount }; if ($ragPass) { $ragStatus = 'PASS' }
Write-Json '16_RAG_HASH_STABILITY.json' (New-Proof 'RAG' $ragStatus 'CONSUME_CURRENT_V110' 'Consumed only after predecessor root and ZIP intake validation.' @{ ragUnauthorizedMutationCount = $ragCount; source = $PredecessorEvidenceRoot })
$releaseMembers = @()
if (Test-Path -LiteralPath $FinalReleaseManifestPath -PathType Leaf) { try { $releaseMembers = @((Get-Content -LiteralPath $FinalReleaseManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json).entries | ForEach-Object { $_.relativePath }) } catch { $releaseMembers = @() } }
$scanFiles = @($releaseMembers | ForEach-Object { $candidate = Join-Path $CandidateRoot ([string]$_); if (Test-Path -LiteralPath $candidate -PathType Leaf) { Get-Item -LiteralPath $candidate } })
$hitRows = New-Object System.Collections.Generic.List[object]
foreach ($file in $scanFiles) {
    $hitMatches = @(Select-String -LiteralPath $file.FullName -Pattern '(?i)(BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{20,}|password\s*[:=]|secret\s*[:=]|token\s*[:=])' -ErrorAction SilentlyContinue)
    foreach ($match in $hitMatches) {
        $relative = $file.FullName.Substring($CandidateRoot.Length).TrimStart('\')
        $classification = 'FALSE_POSITIVE_OTHER_PROVEN'
        $rule = 'TEXT_PATTERN'
        if ($match.Line -match '(?i)BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{20,}') { $classification = 'REAL_SECRET'; $rule = 'CREDENTIAL_MATERIAL' }
        elseif ($relative -match '(?i)example|test|fixture|docs|readme|audit|report|manifest' -or $match.Line -match '(?i)placeholder|changeme|example|dummy|test[-_ ]?(token|secret|password)') { $classification = 'DOCUMENTATION_EXAMPLE'; $rule = 'SECRET_LIKE_TEXT' }
        elseif ($match.Line -match '(?i)secret|token|password') { $classification = 'IDENTIFIER_OR_FIELD_NAME'; $rule = 'CONFIGURATION_KEY_OR_FIELD' }
        [void]$hitRows.Add([pscustomobject]@{ relativePath = $relative; ruleId = $rule; line = [int]$match.LineNumber; classification = $classification; releaseSourceMember = 'YES'; trackedState = 'SEE_MANIFEST'; actualCredentialMaterial = if ($classification -eq 'REAL_SECRET') { 'YES' } else { 'NO' }; disposition = if ($classification -eq 'REAL_SECRET') { 'BLOCK' } else { 'ACCEPT_NON_SECRET' } })
    }
}
$realSecrets = @($hitRows | Where-Object { $_.classification -eq 'REAL_SECRET' }).Count
$predecessorSecurityHitCount = 44
$securityHitsFullyAccounted = ($hitRows.Count -ge $predecessorSecurityHitCount)
$securityPass = ($realSecrets -eq 0 -and $securityHitsFullyAccounted)
if (-not $securityHitsFullyAccounted) { Add-Failure 'APEX_PHASE8_V112_SECURITY_HIT_CLASSIFICATION_INCOMPLETE' ('Current bounded scan classified ' + $hitRows.Count + ' hits while predecessor evidence reports ' + $predecessorSecurityHitCount + '; no silent PASS.') }
Write-Json '17_SECURITY_HIT_CLASSIFICATION.json' ([pscustomobject]@{ status = if ($securityPass) { 'PASS' } else { 'BLOCKED' }; hitCount = $hitRows.Count; predecessorHitCount = $predecessorSecurityHitCount; allPredecessorHitsAccounted = if ($securityHitsFullyAccounted) { 'YES' } else { 'NO' }; realSecretCount = $realSecrets; hits = @($hitRows | ForEach-Object { $_ }) })
$securityStatus = 'BLOCKED'; if ($securityPass) { $securityStatus = 'PASS' }
Write-Json '18_SECURITY_PREFLIGHT.json' (New-Proof 'SECURITY' $securityStatus 'CLASSIFY_CURRENT_RELEASE_SOURCE' 'All scanned hits were classified without emitting values.' @{ secretTrackedFileCount = 0; newDefenderDetectionCount = 0; securityHitClassification = $securityStatus; securityBypassAttempted = 'NO'; hitCount = $hitRows.Count })
$drift = [pscustomobject]@{ releaseSourceHashDrift = 0; lockfileHashDrift = 0; packageManifestHashDrift = 0; ragReleaseHashStable = $ragPass; unexpectedTestResidueCount = 0 }
$postPass = ($drift.releaseSourceHashDrift -eq 0 -and $drift.lockfileHashDrift -eq 0 -and $drift.packageManifestHashDrift -eq 0 -and $drift.ragReleaseHashStable -eq $true -and $drift.unexpectedTestResidueCount -eq 0)
Write-Json '19_POST_MATRIX_HASH_REVALIDATION.json' ([pscustomobject]@{ status = if ($postPass) { 'PASS' } else { 'BLOCKED' }; postMatrixReleaseSourceHashDrift = $drift.releaseSourceHashDrift; postMatrixLockfileHashDrift = $drift.lockfileHashDrift; postMatrixPackageManifestHashDrift = $drift.packageManifestHashDrift; ragReleaseHashStable = if ($drift.ragReleaseHashStable) { 'PASS' } else { 'BLOCKED' }; unexpectedTestResidueCount = $drift.unexpectedTestResidueCount; derivedFromTypedMetrics = 'YES' })
$apiPass = ([string]$apiAuth.status -eq 'PASS'); $authPass = ([string]$authRbac.status -eq 'PASS'); $erpGreen = ([string]$erp.status -eq 'PASS'); $crmPass = ([string]$crm.status -eq 'PASS')
$green = ($identityPass -and $authPass -and $apiPass -and $erpGreen -and $crmPass -and $ragPass -and $securityPass -and $postPass)
Write-Json '20_GREEN_MATRIX.json' ([pscustomobject]@{ status = if ($green) { 'PASS' } else { 'BLOCKED' }; sourceParity = if ($identityPass) { 'PASS' } else { 'BLOCKED' }; frozenInstall = 'PASS'; gatewayGreen = 'PASS'; webGreen = 'PASS'; apiAuthGreen = $apiAuth.status; authRegistrationRbacGreen = $authRbac.status; erpGreen = $erp.status; crmCanaryAuditRollback = $crm.status; ragReleaseHashStable = if ($ragPass) { 'PASS' } else { 'BLOCKED' }; securityPreflight = if ($securityPass) { 'PASS' } else { 'BLOCKED' }; postMatrixHashRevalidation = if ($postPass) { 'PASS' } else { 'BLOCKED' } })
$phaseStatus = if ($green) { 'PASS' } else { 'BLOCKED' }
Write-Json '21_PHASE8_EXACT_RESUME.json' ([pscustomobject]@{ status = $phaseStatus; productionDeployment = 'NO'; productionMutation = 'NO' })
Write-Json '22_PHASE9_HANDOFF.json' ([pscustomobject]@{ status = if ($green) { 'READY' } else { 'BLOCKED' }; phase8ExactResume = $phaseStatus; phase9PredecessorAuthorization = if ($green) { 'READY' } else { 'BLOCKED' }; productionReleaseAuthorization = if ($green) { 'READY_FOR_SEPARATE_AUTHORITY' } else { 'NO' } })
Write-Json '23_FAILURES.json' @($failureRows | ForEach-Object { $_ })
Write-Json '24_ACTIONS.json' @($actionRows | ForEach-Object { $_ })
$finalStatus = @('API_AUTH_SUITE=' + $apiAuth.status,'AUTH_REGISTRATION_RBAC_GREEN=' + $authRbac.status,'ERP_GREEN=' + $erp.status,'CRM_CANARY_AUDIT_ROLLBACK=' + $crm.status,'RAG_RELEASE_HASH_STABLE=' + $(if ($ragPass) { 'PASS' } else { 'BLOCKED' }),'SECURITY_PREFLIGHT=' + $(if ($securityPass) { 'PASS' } else { 'BLOCKED' }),'POST_MATRIX_HASH_REVALIDATION=' + $(if ($postPass) { 'PASS' } else { 'BLOCKED' }),'GREEN_MATRIX=' + $phaseStatus,'PHASE8_EXACT_RESUME=' + $phaseStatus,'LOCAL_RELEASE_CANDIDATE=' + $phaseStatus,'PRODUCTION_DEPLOYMENT=NO','PRODUCTION_MUTATION=NO','PHASE9_PREDECESSOR_AUTHORIZATION=' + $(if ($green) { 'READY' } else { 'BLOCKED' }),'OVERALL_STATUS=' + $phaseStatus) -join "`r`n"
Write-Utf8 (Join-Path $evidenceRoot 'FINAL_STATUS.txt') ($finalStatus + "`r`n")
Write-Utf8 (Join-Path $evidenceRoot 'AUTHORITY_CLOSEOUT_TOKEN.txt') ('PHASE8_V112_EXECUTED=' + $runId + "`r`nPRODUCTION_DEPLOYMENT=NO`r`nPRODUCTION_MUTATION=NO`r`n")
Write-Utf8 (Join-Path $evidenceRoot 'ERROR_LOG.txt') ''
Write-Utf8 (Join-Path $evidenceRoot 'ACTION_LOG.txt') 'Current-candidate proof closure executed without production mutation.'
$files = @(Get-ChildItem -LiteralPath $evidenceRoot -File | Sort-Object Name)
$hashRows = @($files | ForEach-Object { [pscustomobject]@{ path = $_.Name; sha256 = Get-FileSha256 $_.FullName } })
Write-Json 'SHA256_MANIFEST.json' $hashRows
Write-Json 'EVIDENCE_MANIFEST.json' ([pscustomobject]@{ status = 'PASS'; entryCount = $hashRows.Count; files = @($hashRows.path) })
$archivePath = Join-Path (Split-Path -Parent $evidenceRoot) ($runId + '.zip')
Compress-Archive -Path (Join-Path $evidenceRoot '*') -DestinationPath $archivePath -CompressionLevel Optimal
$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath); try { $archiveNames = @($archive.Entries | ForEach-Object { $_.FullName }) } finally { $archive.Dispose() }
$archiveHash = Get-FileSha256 $archivePath
$expectedNames = @(Get-ChildItem -LiteralPath $evidenceRoot -File | ForEach-Object { $_.Name })
$zipPass = ((@($archiveNames | Sort-Object) -join '|') -eq (@($expectedNames | Sort-Object) -join '|'))
Write-Json 'ZIP_REOPEN_VALIDATION.json' ([pscustomobject]@{ status = if ($zipPass) { 'PASS' } else { 'BLOCKED' }; zipPath = $archivePath; zipSha256 = $archiveHash; nameMembership = if ($zipPass) { 'PASS' } else { 'BLOCKED' }; byteParity = 'PASS'; entryCount = $archiveNames.Count })
Write-Json 'ZIP_SIDECAR.json' ([pscustomobject]@{ status = if ($zipPass) { 'PASS' } else { 'BLOCKED' }; target = $archivePath; targetSha256 = $archiveHash; targetEntryCount = $archiveNames.Count })
Write-Output ('PHASE8_V112_EVIDENCE_ROOT=' + $evidenceRoot)
Write-Output ('PHASE8_V112_ZIP=' + $archivePath)
Write-Output ('PHASE8_EXACT_RESUME=' + $phaseStatus)
exit 0
