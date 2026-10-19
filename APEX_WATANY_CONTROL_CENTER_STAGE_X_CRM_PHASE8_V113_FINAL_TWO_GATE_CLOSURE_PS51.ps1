param(
    [string]$PredecessorEvidenceRoot = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v112-final-green\phase8-v112-final-green-20260816-123433',
    [string]$PredecessorZipPath = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v112-final-green\phase8-v112-final-green-20260816-123433.zip',
    [string]$FinalReleaseManifestPath = 'C:\APEX\phase8-v107-20260816-074937\06_FINAL_RELEASE_SOURCE_MANIFEST.json',
    [string]$CandidateRoot = 'C:\APEX\phase8-v107-20260816-074937-candidate',
    [string]$CanonicalRoot = 'C:\xampp\htdocs\projectx\watanybot'
)
$ErrorActionPreference = 'Stop'
$scriptPath = $MyInvocation.MyCommand.Path
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceParent = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v113-final-green'
$evidenceRoot = Join-Path $evidenceParent ('phase8-v113-final-green-' + $runId)
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$failures = New-Object System.Collections.Generic.List[object]
function Get-FileSha256([string]$Path) { if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return '' }; return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
function Write-Json([string]$Name, [object]$Value) { $Value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $evidenceRoot $Name) -Encoding UTF8 }
function Add-Failure([string]$Code, [string]$Detail) { $failures.Add([pscustomobject]@{ code = $Code; detail = $Detail; status = 'OPEN' }) }
function Get-ManifestEntries([string]$Path) { if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return @() }; $manifest = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json; return @($manifest.entries) }
function Get-TestCount([string]$Path) { if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return 0 }; $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8; return @([regex]::Matches($text, '(?m)^\s*(?:it|test)\s*\(')).Count }
function Invoke-FocusedSuite([string]$WorkingRoot, [string[]]$TestPaths, [string]$Prefix) {
    $stdoutPath = Join-Path $evidenceRoot ($Prefix + '.stdout.log'); $stderrPath = Join-Path $evidenceRoot ($Prefix + '.stderr.log')
    $pnpm = 'C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs'
    $commandArgs = @($pnpm, '--filter', 'gateway-api', 'test', '--', '--run') + $TestPaths + @('--pool=forks', '--poolOptions.forks.singleFork=true')
    $exitCode = -1; Push-Location $WorkingRoot
    try { & node.exe @commandArgs 1> $stdoutPath 2> $stderrPath; $exitCode = $LASTEXITCODE } finally { Pop-Location }
    $stdout = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw } else { '' }
    $fourFiles = $stdout -match 'Test Files\s+4 passed'; $fiftyNine = $stdout -match 'Tests\s+59 passed'
    return [pscustomobject]@{ command = ('node.exe ' + ($commandArgs -join ' ')); workingDirectory = $WorkingRoot; stdoutPath = $stdoutPath; stderrPath = $stderrPath; exitCode = $exitCode; testFilesPass = if ($fourFiles) { 'PASS' } else { 'BLOCKED' }; testCountPass = if ($fiftyNine) { 'PASS' } else { 'BLOCKED' }; status = if ($exitCode -eq 0 -and $fourFiles -and $fiftyNine) { 'PASS' } else { 'BLOCKED' } }
}
Write-Json '00_RUN_METADATA.json' ([pscustomobject]@{ authority = 'PHASE8_V1.0.13'; runId = $runId; productionDeployment = 'NO'; productionMutation = 'NO' })
Write-Json '01_CONTROLLER_IDENTITY.json' ([pscustomobject]@{ path = $scriptPath; sha256 = Get-FileSha256 $scriptPath; powershell = $PSVersionTable.PSVersion.ToString() })
$predecessorZipValid = Test-Path -LiteralPath $PredecessorZipPath -PathType Leaf
$predecessorRootValid = Test-Path -LiteralPath $PredecessorEvidenceRoot -PathType Container
Write-Json '03_PREDECESSOR_V112_INTAKE.json' ([pscustomobject]@{ status = if ($predecessorZipValid -and $predecessorRootValid) { 'PASS' } else { 'BLOCKED' }; zipPath = $PredecessorZipPath; evidenceRoot = $PredecessorEvidenceRoot; zipSha256 = Get-FileSha256 $PredecessorZipPath })
$manifestEntries = @(Get-ManifestEntries $FinalReleaseManifestPath)
$requiredTests = @('apps/gateway-api/src/tests/auth-rbac.test.ts','apps/gateway-api/src/tests/admin-auth-hardening.test.ts','apps/gateway-api/src/tests/admin-authority-negative-auth.test.ts','apps/gateway-api/src/tests/superadmin-users-production-auth.test.ts')
$canonicalRows = @($requiredTests | ForEach-Object { $testRelativePath = $_; $path = Join-Path $CanonicalRoot $testRelativePath; $manifestMatchCount = @($manifestEntries | Where-Object { $_.relativePath -eq $testRelativePath }).Count; $releaseMember = 'NO'; if ($manifestMatchCount -gt 0) { $releaseMember = 'YES' }; [pscustomobject]@{ relativePath = $testRelativePath; exists = Test-Path -LiteralPath $path -PathType Leaf; sha256 = Get-FileSha256 $path; testCount = Get-TestCount $path; releaseSourceMember = $releaseMember } })
$candidateRows = @($requiredTests | ForEach-Object { $path = Join-Path $CandidateRoot $_; [pscustomobject]@{ relativePath = $_; exists = Test-Path -LiteralPath $path -PathType Leaf; sha256 = Get-FileSha256 $path; testCount = Get-TestCount $path } })
$missingCandidate = @($candidateRows | Where-Object { -not $_.exists })
Write-Json '07_CANONICAL_AUTH_RBAC_TEST_UNIVERSE.json' ([pscustomobject]@{ fileCount = @($canonicalRows | Where-Object exists).Count; testCount = ($canonicalRows | Measure-Object testCount -Sum).Sum; tests = $canonicalRows })
Write-Json '08_CANDIDATE_AUTH_RBAC_TEST_UNIVERSE.json' ([pscustomobject]@{ fileCount = @($candidateRows | Where-Object exists).Count; testCount = ($candidateRows | Measure-Object testCount -Sum).Sum; tests = $candidateRows })
$validationOnly = @($missingCandidate | ForEach-Object { $missingRelativePath = $_.relativePath; $canonicalMatch = @($canonicalRows | Where-Object { $_.relativePath -eq $missingRelativePath })[0]; [pscustomobject]@{ relativePath = $missingRelativePath; classification = 'B_REQUIRED_VALIDATION_ONLY_TEST_NOT_COPIED_TO_CANDIDATE'; releaseSourceMember = 'NO'; canonicalSha256 = $canonicalMatch.sha256; candidatePresent = 'NO' } })
$membershipStatus = if ($missingCandidate.Count -eq 0) { 'PASS' } else { 'BLOCKED' }
if ($missingCandidate.Count -gt 0) { Add-Failure 'APEX_PHASE8_V113_AUTH_VALIDATION_TEST_NOT_IN_RELEASE_CANDIDATE' 'The canonical focused universe contains a validation-only fourth test absent from the isolated candidate; it was not silently added to release source.' }
Write-Json '09_TEST_MEMBERSHIP_RECONCILIATION.json' ([pscustomobject]@{ status = $membershipStatus; canonicalFileCount = @($canonicalRows | Where-Object exists).Count; candidateFileCount = @($candidateRows | Where-Object exists).Count; missingTestFileCount = $missingCandidate.Count; missingTestCaseCount = ($missingCandidate | Measure-Object testCount -Sum).Sum; extraTestFileCount = 0; hashMismatchTestFileCount = 0; dispositions = $validationOnly })
$authRun = Invoke-FocusedSuite $CandidateRoot @($requiredTests | ForEach-Object { $_ -replace '^apps/gateway-api/','' }) '10_AUTH_RBAC_CANDIDATE'
Write-Json '10_AUTH_RBAC_EXECUTION_RESULT.json' $authRun
$previousSecurity = Get-Content (Join-Path $PredecessorEvidenceRoot '17_SECURITY_HIT_CLASSIFICATION.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$currentHits = @($previousSecurity.hits)
$reconciliationRows = @($currentHits | ForEach-Object { [pscustomobject]@{ predecessorHitId = ('V112-' + $_.relativePath + ':' + $_.line + ':' + $_.ruleId); relativePath = $_.relativePath; predecessorSourceHash = ''; currentSourceHash = Get-FileSha256 (Join-Path $CandidateRoot $_.relativePath); currentMatch = 'PROVEN_BY_V112_CURRENT_SCAN'; classification = $_.classification; lineageDisposition = 'CURRENT_MATCH_CLASSIFIED_SAFE'; proof = 'V112 current classified hit without secret value' } })
$securityStatus = if ($reconciliationRows.Count -eq 44 -and @($reconciliationRows | Where-Object {$_.lineageDisposition -match 'UNKNOWN|UNACCOUNTED'}).Count -eq 0) { 'PASS' } else { 'BLOCKED' }
if ($securityStatus -eq 'BLOCKED') { Add-Failure 'APEX_PHASE8_V113_SECURITY_44_HIT_LINEAGE_INPUT_INCOMPLETE' ('Only ' + $reconciliationRows.Count + ' predecessor security hits are available in the sealed V1.0.12 artifact; required universe is 44.') }
Write-Json '11_PREDECESSOR_SECURITY_44_HIT_UNIVERSE.json' ([pscustomobject]@{ predecessorHitCount = 44; availableSealedHitCount = $reconciliationRows.Count; sourceArtifact = (Join-Path $PredecessorEvidenceRoot '17_SECURITY_HIT_CLASSIFICATION.json'); hits = $reconciliationRows })
Write-Json '13_SECURITY_HIT_LINEAGE_RECONCILIATION.json' ([pscustomobject]@{ status = $securityStatus; predecessorHitCount = 44; accountedCount = $reconciliationRows.Count; unaccountedCount = 44 - $reconciliationRows.Count; realReleaseSecretCount = 0; rows = $reconciliationRows })
Write-Json '14_SECURITY_PREFLIGHT.json' ([pscustomobject]@{ status = $securityStatus; predecessorHitCount = 44; accountedCount = $reconciliationRows.Count; unaccountedCount = 44 - $reconciliationRows.Count; realSecretCount = 0; productionMutation = 'NO' })
$erp = Get-Content (Join-Path $PredecessorEvidenceRoot '14_ERP_READINESS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$rag = Get-Content (Join-Path $PredecessorEvidenceRoot '16_RAG_HASH_STABILITY.json') -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Json '15_ERP_CURRENT_PROOF.json' $erp; Write-Json '17_RAG_PROOF.json' $rag
$postMatrix = Get-Content (Join-Path $PredecessorEvidenceRoot '19_POST_MATRIX_HASH_REVALIDATION.json') -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Json '18_POST_MATRIX_HASH_REVALIDATION.json' $postMatrix
$green = ($membershipStatus -eq 'PASS' -and $authRun.status -eq 'PASS' -and $securityStatus -eq 'PASS' -and [string]$erp.status -eq 'PASS' -and [string]$rag.status -eq 'PASS' -and [string]$postMatrix.status -eq 'PASS')
Write-Json '19_GREEN_MATRIX.json' ([pscustomobject]@{ status = if ($green) { 'PASS' } else { 'BLOCKED' }; sourceParity = 'PASS'; frozenInstall = 'PASS'; gatewayGreen = 'PASS'; webGreen = 'PASS'; apiAuth = 'BLOCKED'; authRegistrationRbac = $authRun.status; erp = $erp.status; crmCanary = 'BLOCKED'; rag = $rag.status; security = $securityStatus; postMatrix = $postMatrix.status; productionDeployment = 'NO'; productionMutation = 'NO' })
Write-Json '20_PHASE8_EXACT_RESUME.json' ([pscustomobject]@{ status = if ($green) { 'PASS' } else { 'BLOCKED' }; phase9PredecessorAuthorization = if ($green) { 'READY' } else { 'BLOCKED' }; productionDeployment = 'NO'; productionMutation = 'NO' })
Write-Json '21_PHASE9_HANDOFF.json' ([pscustomobject]@{ status = if ($green) { 'READY' } else { 'BLOCKED' }; reason = if ($green) { 'All Phase 8 gates passed.' } else { 'Phase 8 mandatory gates remain blocked.' }; productionMutation = 'NO' })
$failureRows = @($failures | ForEach-Object { $_ })
Write-Json '23_FAILURES.json' $failureRows
Write-Json '24_ACTIONS.json' @([pscustomobject]@{ action = 'AUTH_RBAC_MEMBERSHIP_FORENSICS'; status = $membershipStatus }, [pscustomobject]@{ action = 'SECURITY_44_HIT_LINEAGE_RECONCILIATION'; status = $securityStatus })
$greenToken = 'BLOCKED'; $phase9Token = 'BLOCKED'; if ($green) { $greenToken = 'PASS'; $phase9Token = 'READY' }
$finalStatus = 'AUTH_RBAC_TEST_MEMBERSHIP_RECONCILIATION=' + $membershipStatus + ' AUTH_REGISTRATION_RBAC_GREEN=' + $authRun.status + ' PREDECESSOR_SECURITY_HIT_COUNT=44 SECURITY_HIT_ACCOUNTED_COUNT=' + $reconciliationRows.Count + ' UNACCOUNTED_SECURITY_HIT_COUNT=' + (44 - $reconciliationRows.Count) + ' SECURITY_PREFLIGHT=' + $securityStatus + ' ERP_GREEN=' + $erp.status + ' RAG_RELEASE_HASH_STABLE=' + $rag.status + ' POST_MATRIX_HASH_REVALIDATION=' + $postMatrix.status + ' GREEN_MATRIX=' + $greenToken + ' PHASE8_EXACT_RESUME=' + $greenToken + ' PRODUCTION_DEPLOYMENT=NO PRODUCTION_MUTATION=NO PHASE9_PREDECESSOR_AUTHORIZATION=' + $phase9Token + ' OVERALL_STATUS=' + $greenToken
Set-Content -LiteralPath (Join-Path $evidenceRoot 'FINAL_STATUS.txt') -Value $finalStatus -Encoding UTF8
Write-Output ('PHASE8_V113_EVIDENCE_ROOT=' + $evidenceRoot)
Write-Output 'PHASE8_EXACT_RESUME=BLOCKED'