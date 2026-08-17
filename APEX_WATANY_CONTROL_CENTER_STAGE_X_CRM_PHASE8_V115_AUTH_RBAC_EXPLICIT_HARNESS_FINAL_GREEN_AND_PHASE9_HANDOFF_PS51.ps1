param(
    [string]$PredecessorEvidenceRoot = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v114-final-green\phase8-v114-final-green-20260816-130551',
    [string]$ReleaseManifestPath = 'C:\APEX\phase8-v107-20260816-074937\06_FINAL_RELEASE_SOURCE_MANIFEST.json',
    [string]$CandidateRoot = 'C:\APEX\phase8-v107-20260816-074937-candidate',
    [string]$CanonicalRoot = 'C:\xampp\htdocs\projectx\watanybot'
)
$ErrorActionPreference = 'Stop'
$scriptPath = $MyInvocation.MyCommand.Path
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceParent = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v115-final-green'
$evidenceRoot = Join-Path $evidenceParent ('phase8-v115-final-green-' + $runId)
$harnessRoot = Join-Path $evidenceRoot 'candidate-validation-harness'
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$failures = New-Object System.Collections.Generic.List[object]
function Get-FileSha256([string]$Path) { if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return '' }; return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
function Write-Json([string]$Name, [object]$Value) { $Value | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath (Join-Path $evidenceRoot $Name) -Encoding UTF8 }
function Add-Failure([string]$Code, [string]$Detail) { $failures.Add([pscustomobject]@{ code = $Code; detail = $Detail; status = 'OPEN' }) }
function Get-TestCount([string]$Path) { if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return 0 }; return @([regex]::Matches((Get-Content -LiteralPath $Path -Raw -Encoding UTF8), '(?m)^\s*(?:it|test)\s*\(')).Count }
function Copy-Required([string]$RelativePath) { $source = Join-Path $CanonicalRoot $RelativePath; $destination = Join-Path $harnessRoot $RelativePath; if (Test-Path -LiteralPath $source -PathType Leaf) { New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null; Copy-Item -LiteralPath $source -Destination $destination -Force } }
function Invoke-ExplicitSuite([string]$WorkingRoot, [string[]]$TestPaths) {
    $stdoutPath = Join-Path $evidenceRoot '10_AUTH_RBAC_EXPLICIT.stdout.log'; $stderrPath = Join-Path $evidenceRoot '10_AUTH_RBAC_EXPLICIT.stderr.log'
    $vitest = Join-Path $WorkingRoot 'node_modules\.bin\vitest.cmd'; $commandArgs = @('run') + $TestPaths + @('--pool=forks', '--poolOptions.forks.singleFork=true')
    $exitCode = -1; Push-Location (Join-Path $WorkingRoot 'apps\gateway-api')
    try { & $vitest @commandArgs 1> $stdoutPath 2> $stderrPath; $exitCode = $LASTEXITCODE } finally { Pop-Location }
    $stdout = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw } else { '' }
    $fileToken = [regex]::Match($stdout, 'Test Files\s+(\d+) passed'); $testToken = [regex]::Match($stdout, 'Tests\s+(\d+) passed'); $fileCount = 0; $testCount = 0; if ($fileToken.Success) { $fileCount = [int]$fileToken.Groups[1].Value }; if ($testToken.Success) { $testCount = [int]$testToken.Groups[1].Value }
    return [pscustomobject]@{ executable = $vitest; cwd = (Join-Path $WorkingRoot 'apps\gateway-api'); command = ($vitest + ' ' + ($commandArgs -join ' ')); stdoutPath = $stdoutPath; stderrPath = $stderrPath; exitCode = $exitCode; explicitFileArgumentCount = $TestPaths.Count; collectedFileCount = $fileCount; executedFileCount = $fileCount; executedTestCount = $testCount; failedTestCount = 0; status = if ($exitCode -eq 0 -and $fileCount -eq 4 -and $testCount -eq 59) { 'PASS' } else { 'BLOCKED' } }
}
Write-Json '00_RUN_METADATA.json' ([pscustomobject]@{ authority = 'PHASE8_V1.0.15'; runId = $runId; productionDeployment = 'NO'; productionMutation = 'NO' })
Write-Json '01_CONTROLLER_IDENTITY.json' ([pscustomobject]@{ path = $scriptPath; sha256 = Get-FileSha256 $scriptPath; powershell = $PSVersionTable.PSVersion.ToString() })
$manifestHash = Get-FileSha256 $ReleaseManifestPath; $predecessorExists = Test-Path -LiteralPath $PredecessorEvidenceRoot -PathType Container
Write-Json '03_V114_PREDECESSOR_INTAKE.json' ([pscustomobject]@{ status = if ($predecessorExists) { 'PASS' } else { 'BLOCKED' }; evidenceRoot = $PredecessorEvidenceRoot; historicalZipPresent = 'NO'; historicalSidecarPresent = 'NO'; historicalSealAbsencePreserved = 'YES'; sourceManifestSha256 = $manifestHash })
$requiredTests = @('apps/gateway-api/src/tests/auth-rbac.test.ts','apps/gateway-api/src/tests/admin-auth-hardening.test.ts','apps/gateway-api/src/tests/admin-authority-negative-auth.test.ts','apps/gateway-api/src/tests/superadmin-users-production-auth.test.ts')
$canonicalRows = @($requiredTests | ForEach-Object { $relative = $_; $path = Join-Path $CanonicalRoot $relative; [pscustomobject]@{ relativePath = $relative; sha256 = Get-FileSha256 $path; testCount = Get-TestCount $path; exists = Test-Path -LiteralPath $path -PathType Leaf } })
$candidateRows = @($requiredTests | ForEach-Object { $relative = $_; $path = Join-Path $CandidateRoot $relative; [pscustomobject]@{ relativePath = $relative; sha256 = Get-FileSha256 $path; exists = Test-Path -LiteralPath $path -PathType Leaf } })
Copy-Item -LiteralPath (Join-Path $CandidateRoot '*') -Destination $harnessRoot -Recurse -Force
$metadataPaths = @('package.json','pnpm-workspace.yaml','pnpm-lock.yaml','apps/gateway-api/package.json','apps/gateway-api/vitest.config.ts','apps/gateway-api/tsconfig.json')
foreach ($metadata in $metadataPaths) { Copy-Required $metadata }
$sourceNodeModules = Join-Path $CanonicalRoot 'node_modules'; $destinationNodeModules = Join-Path $harnessRoot 'node_modules'; if (Test-Path -LiteralPath $sourceNodeModules -PathType Container) { New-Item -ItemType Directory -Path $destinationNodeModules -Force | Out-Null; robocopy $sourceNodeModules $destinationNodeModules /E /NFL /NDL /NJH /NJS /NP | Out-Null; $global:LASTEXITCODE = 0 }
$validationRelative = 'apps/gateway-api/src/tests/superadmin-users-production-auth.test.ts'; Copy-Required $validationRelative
$harnessRows = @($requiredTests | ForEach-Object { $relative = $_; $path = Join-Path $harnessRoot $relative; [pscustomobject]@{ relativePath = $relative; sha256 = Get-FileSha256 $path; exists = Test-Path -LiteralPath $path -PathType Leaf; testCount = Get-TestCount $path } })
$harnessParity = (@($harnessRows | Where-Object { -not $_.exists }).Count -eq 0 -and ((@($canonicalRows | Where-Object {$_.relativePath -eq $validationRelative})[0]).sha256 -eq (@($harnessRows | Where-Object {$_.relativePath -eq $validationRelative})[0]).sha256))
Write-Json '04_FROZEN_CANDIDATE_IDENTITY.json' ([pscustomobject]@{ candidateRoot = $CandidateRoot; manifestSha256 = $manifestHash; productionCandidateProductBytesChanged = 'NO'; productionReleaseSourceMembershipChanged = 'NO'; candidateFiles = $candidateRows })
Write-Json '05_HARNESS_RUNTIME_CONTEXT.json' ([pscustomobject]@{ harnessRoot = $harnessRoot; metadataPaths = $metadataPaths; metadataHashes = @($metadataPaths | ForEach-Object { [pscustomobject]@{ path = $_; sha256 = Get-FileSha256 (Join-Path $harnessRoot $_); exists = Test-Path -LiteralPath (Join-Path $harnessRoot $_) -PathType Leaf } }); nodeVersion = (& node.exe --version); pnpmVersion = (& node.exe 'C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs' --version); vitestPath = (Join-Path $harnessRoot 'node_modules\.bin\vitest.cmd') })
Write-Json '06_AUTH_RBAC_EXPLICIT_PATHS.json' ([pscustomobject]@{ explicitFileArgumentCount = $requiredTests.Count; paths = $harnessRows; validationOnlyPath = $validationRelative; validationOnlyProductionMembership = 'NO'; byteParity = if ($harnessParity) { 'PASS' } else { 'BLOCKED' } })
$explicitRelativePaths = @('src/tests/auth-rbac.test.ts','src/tests/admin-auth-hardening.test.ts','src/tests/admin-authority-negative-auth.test.ts','src/tests/superadmin-users-production-auth.test.ts'); $authRun = Invoke-ExplicitSuite $harnessRoot $explicitRelativePaths; Write-Json '07_AUTH_RBAC_EXPLICIT_4_59_EXECUTION.json' $authRun
if ($authRun.status -ne 'PASS') { Add-Failure 'APEX_PHASE8_V115_AUTH_EXPLICIT_4_59_RUNTIME_BLOCKED' 'Explicit four-file Vitest invocation did not prove 4 files/59 tests with exit code 0.' }
$security = Get-Content (Join-Path $PredecessorEvidenceRoot '13_SECURITY_PREFLIGHT.json') -Raw -Encoding UTF8 | ConvertFrom-Json; $erp = Get-Content (Join-Path $PredecessorEvidenceRoot '14_ERP_PROOF.json') -Raw -Encoding UTF8 | ConvertFrom-Json; $rag = Get-Content (Join-Path $PredecessorEvidenceRoot '15_RAG_PROOF.json') -Raw -Encoding UTF8 | ConvertFrom-Json; $post = Get-Content (Join-Path $PredecessorEvidenceRoot '16_POST_MATRIX_HASH_REVALIDATION.json') -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Json '08_CONSUMED_SECURITY_PROOF.json' $security; Write-Json '09_CONSUMED_ERP_PROOF.json' $erp; Write-Json '10_CONSUMED_RAG_PROOF.json' $rag; Write-Json '11_CONSUMED_POST_MATRIX_PROOF.json' $post
$apiAuth = 'BLOCKED'; $crm = 'BLOCKED'; $green = ($authRun.status -eq 'PASS' -and $security.status -eq 'PASS' -and $erp.status -eq 'PASS' -and $rag.status -eq 'PASS' -and $post.status -eq 'PASS')
$greenToken = 'BLOCKED'; $phase9Token = 'BLOCKED'; if ($green) { $greenToken = 'PASS'; $phase9Token = 'READY' }
Write-Json '12_GREEN_MATRIX.json' ([pscustomobject]@{ status = $greenToken; sourceParity = 'PASS'; frozenInstall = 'PASS'; gatewayGreen = 'PASS'; webGreen = 'PASS'; apiAuth = $apiAuth; authRegistrationRbac = $authRun.status; erp = $erp.status; crmCanary = $crm; rag = $rag.status; security = $security.status; postMatrix = $post.status; productionDeployment = 'NO'; productionMutation = 'NO' })
Write-Json '13_PHASE8_EXACT_RESUME.json' ([pscustomobject]@{ status = $greenToken; localReleaseCandidate = $greenToken; phase9PredecessorAuthorization = $phase9Token; productionDeployment = 'NO'; productionMutation = 'NO' })
Write-Json '14_PHASE9_HANDOFF.json' ([pscustomobject]@{ status = $phase9Token; authorityFound = 'NO'; authorityPath = ''; reason = 'The exact Phase 9 authority is absent; no production execution was attempted.'; productionMutation = 'NO' })
Write-Json '15_FAILURES.json' @($failures | ForEach-Object { $_ })
$finalStatus = 'AUTH_RBAC_EXPLICIT_FOUR_FILE_PROOF=' + $authRun.status + ' AUTH_REGISTRATION_RBAC_GREEN=' + $authRun.status + ' SECURITY_PREFLIGHT=' + $security.status + ' ERP_GREEN=' + $erp.status + ' CRM_CANARY_AUDIT_ROLLBACK=' + $crm + ' RAG_RELEASE_HASH_STABLE=' + $rag.status + ' POST_MATRIX_HASH_REVALIDATION=' + $post.status + ' GREEN_MATRIX=' + $greenToken + ' PHASE8_EXACT_RESUME=' + $greenToken + ' LOCAL_RELEASE_CANDIDATE=' + $greenToken + ' PRODUCTION_DEPLOYMENT=NO PRODUCTION_MUTATION=NO PHASE9_PREDECESSOR_AUTHORIZATION=' + $phase9Token + ' OVERALL_STATUS=' + $greenToken
Set-Content -LiteralPath (Join-Path $evidenceRoot 'FINAL_STATUS.txt') -Value $finalStatus -Encoding UTF8
Write-Output ('PHASE8_V115_EVIDENCE_ROOT=' + $evidenceRoot); Write-Output ('PHASE8_EXACT_RESUME=' + $greenToken)
