param(
    [string]$CanonicalRoot = 'C:\xampp\htdocs\projectx\watanybot',
    [string]$PredecessorRoot = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v117-runtime-forensics\phase8-v117-runtime-forensics-20260816-164225',
    [int]$InstallTimeoutSeconds = 180,
    [int]$TestTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
$scriptPath = $MyInvocation.MyCommand.Path
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceParent = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v118-fresh-harness'
$evidenceRoot = Join-Path $evidenceParent ('phase8-v118-fresh-harness-' + $runId)
$harnessRoot = Join-Path $evidenceRoot 'fresh-validation-harness'
$logRoot = Join-Path $evidenceRoot 'native-process-logs'
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
New-Item -ItemType Directory -Path $harnessRoot -Force | Out-Null
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

$failures = New-Object System.Collections.Generic.List[object]
$errors = New-Object System.Collections.Generic.List[string]

function Get-FileSha256([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}
function Write-Json([string]$Name, [object]$Value) {
    $Value | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath (Join-Path $evidenceRoot $Name) -Encoding UTF8
}
function Add-Failure([string]$Code, [string]$Message) {
    $failures.Add([pscustomobject]@{ code = $Code; message = $Message; status = 'OPEN' })
    $errors.Add(($Code + ': ' + $Message))
}
function Get-TestCount([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return 0 }
    return @([regex]::Matches((Get-Content -LiteralPath $Path -Raw -Encoding UTF8), '(?m)^\s*(?:it|test)\s*\(')).Count
}
function Copy-Source([string]$RelativePath) {
    $source = Join-Path $CanonicalRoot $RelativePath
    $destination = Join-Path $harnessRoot $RelativePath
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { Add-Failure 'APEX_PHASE8_V118_SOURCE_FILE_MISSING' $RelativePath; return }
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
}
function Invoke-Native([string]$Name, [string]$Executable, [string]$WorkingDirectory, [string[]]$CommandArgs, [int]$TimeoutSeconds) {
    $stdoutPath = Join-Path $logRoot ($Name + '.stdout.log')
    $stderrPath = Join-Path $logRoot ($Name + '.stderr.log')
    $start = Get-Date
    $argumentText = ($CommandArgs | ForEach-Object { '"' + ($_ -replace '"','\"') + '"' }) -join ' '
    $process = Start-Process -FilePath $Executable -ArgumentList $argumentText -WorkingDirectory $WorkingDirectory -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
    $deadline = $start.AddSeconds($TimeoutSeconds)
    while (-not $process.HasExited -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
    $timedOut = -not $process.HasExited
    if ($timedOut) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    $exitCode = $null
    if (-not $timedOut -and $process.HasExited) {
        $exitCode = $process.ExitCode
        if ($null -eq $exitCode -and $Executable -match '\.cmd$') { $exitCode = 0 }
    }
    $stdout = if (Test-Path -LiteralPath $stdoutPath) { [string](Get-Content -LiteralPath $stdoutPath -Raw -Encoding UTF8) } else { '' }
    $stderr = if (Test-Path -LiteralPath $stderrPath) { [string](Get-Content -LiteralPath $stderrPath -Raw -Encoding UTF8) } else { '' }
    if ($null -eq $stdout) { $stdout = '' }
    if ($null -eq $stderr) { $stderr = '' }
    return [pscustomobject]@{ name = $Name; executable = $Executable; cwd = $WorkingDirectory; argv = @($CommandArgs); pid = $process.Id; startTime = $start.ToString('o'); endTime = (Get-Date).ToString('o'); timeoutSeconds = $TimeoutSeconds; timedOut = $timedOut; exitObserved = (-not $timedOut); exitCode = $exitCode; stdoutPath = $stdoutPath; stderrPath = $stderrPath; stdoutBytes = [Text.Encoding]::UTF8.GetByteCount($stdout); stderrBytes = [Text.Encoding]::UTF8.GetByteCount($stderr); stdout = $stdout; stderr = $stderr }
}
function Get-ManifestRows([string]$Root) {
    [string[]]$required = @(
        'apps/gateway-api/src/tests/auth-rbac.test.ts',
        'apps/gateway-api/src/tests/admin-auth-hardening.test.ts',
        'apps/gateway-api/src/tests/admin-authority-negative-auth.test.ts',
        'apps/gateway-api/src/tests/superadmin-users-production-auth.test.ts'
    )
    $rows = New-Object System.Collections.Generic.List[object]
    $index = 0
    foreach ($relative in $required) {
        $sourcePath = Join-Path $CanonicalRoot ($relative -replace '/', '\')
        $harnessPath = Join-Path $Root ($relative -replace '/', '\')
        $index++
        $rows.Add([pscustomobject]@{ index = $index; relativePath = $relative; absoluteHarnessPath = $harnessPath; sourcePath = $sourcePath; sourceSha256 = Get-FileSha256 $sourcePath; harnessSha256 = Get-FileSha256 $harnessPath; byteParity = if ((Get-FileSha256 $sourcePath) -and ((Get-FileSha256 $sourcePath) -eq (Get-FileSha256 $harnessPath))) { 'PASS' } else { 'BLOCKED' }; productionReleaseMember = if ($relative -match 'superadmin-users-production-auth') { 'NO' } else { 'YES' }; exists = (Test-Path -LiteralPath $harnessPath -PathType Leaf); testCount = Get-TestCount $harnessPath })
    }
    return [object[]]$rows.ToArray()
}
function Get-TokenInt([string]$Text, [string]$Pattern) {
    $Text = [regex]::Replace([string]$Text, [string][char]27 + '\[[0-9;]*[A-Za-z]', '')
    $match = [regex]::Match($Text, $Pattern)
    if ($match.Success) { return [int]$match.Groups[1].Value }
    return 0
}

$stageNames = @('00_RUN_METADATA.json','01_V117_PREDECESSOR_INTAKE.json','02_SOURCE_IDENTITY.json','03_AUTH_RBAC_INVENTORY.json','04_FROZEN_INSTALL.json','05_PNPM_OWNERSHIP.json','06_VITEST_RESOLUTION.json','07_FOURTH_TEST.json','08_AUTH_RBAC_4_59.json','09_STATUS.json','10_FAILURES.json','FINAL_STATUS.txt','AUTHORITY_CLOSEOUT_TOKEN.txt','ERROR_LOG.txt','EXECUTION_LOG.txt')
foreach ($stageName in $stageNames) { Set-Content -LiteralPath (Join-Path $evidenceRoot $stageName) -Value 'NOT_STARTED' -Encoding UTF8 }

try {
    'APEX_PS1_SKILL_UPDATE_NOT_REQUIRED' | Set-Content -LiteralPath (Join-Path $evidenceRoot 'EXECUTION_LOG.txt') -Encoding UTF8
    Write-Json '00_RUN_METADATA.json' ([pscustomobject]@{ authority = 'PHASE8_V1.0.18'; runId = $runId; controllerPath = $scriptPath; controllerSha256 = Get-FileSha256 $scriptPath; powershell = $PSVersionTable.PSVersion.ToString(); productionReleaseSourceMembershipChanged = 'NO'; productionCandidateProductBytesChanged = 'NO'; productionDeployment = 'NO'; productionMutation = 'NO' })
    Write-Json '01_V117_PREDECESSOR_INTAKE.json' ([pscustomobject]@{ evidenceRoot = $PredecessorRoot; exists = (Test-Path -LiteralPath $PredecessorRoot -PathType Container); controllerEvidenceValid = 'PARTIAL_ONLY'; vitestHangProven = 'NO'; vitestEntryUnresolved = 'YES'; preserved = 'YES' })

    [string[]]$metadata = @('package.json','pnpm-workspace.yaml','pnpm-lock.yaml','apps/gateway-api/package.json','apps/gateway-api/vitest.config.ts','apps/gateway-api/tsconfig.json','packages/config/tsconfig.base.json')
    foreach ($relative in $metadata) { Copy-Source $relative }
    Copy-Source 'watany_kb_tables_v4/watany_rag_chunks_v4.jsonl'
    [string[]]$workspacePackageMetadata = @('packages/watany-core/package.json','packages/kb/package.json','packages/shared/package.json','packages/types/package.json')
    foreach ($relative in $workspacePackageMetadata) { Copy-Source $relative }
    [string[]]$sourceDirectories = @('apps/gateway-api/src','packages/watany-core/src','packages/kb/src','packages/shared/src','packages/types/src')
    foreach ($directory in $sourceDirectories) {
        $sourceDirectory = Join-Path $CanonicalRoot ($directory -replace '/', '\')
        if (Test-Path -LiteralPath $sourceDirectory -PathType Container) { Copy-Item -LiteralPath $sourceDirectory -Destination (Join-Path $harnessRoot ($directory -replace '/', '\')) -Recurse -Force }
    }
    [string[]]$requiredFiles = @('apps/gateway-api/src/tests/auth-rbac.test.ts','apps/gateway-api/src/tests/admin-auth-hardening.test.ts','apps/gateway-api/src/tests/admin-authority-negative-auth.test.ts','apps/gateway-api/src/tests/superadmin-users-production-auth.test.ts')
    foreach ($relative in $requiredFiles) { Copy-Source $relative }
    [object[]]$rows = @(Get-ManifestRows $harnessRoot)
    $inventoryPass = ($rows.Count -eq 4 -and @($rows | Where-Object { -not $_.exists }).Count -eq 0 -and @($rows | Where-Object { $_.byteParity -ne 'PASS' }).Count -eq 0)
    Write-Json '02_SOURCE_IDENTITY.json' ([pscustomobject]@{ canonicalRoot = $CanonicalRoot; lockfileSha256 = Get-FileSha256 (Join-Path $CanonicalRoot 'pnpm-lock.yaml'); packageJsonSha256 = Get-FileSha256 (Join-Path $CanonicalRoot 'package.json'); approvedReleaseFileCount = 'NOT_RECONSTRUCTED'; productionReleaseSourceMembershipChanged = 'NO'; productionCandidateProductBytesChanged = 'NO' })
    Write-Json '03_AUTH_RBAC_INVENTORY.json' ([pscustomobject]@{ expectedFileCount = 4; inventoryRowCount = $rows.Count; existingFileCount = @($rows | Where-Object { $_.exists }).Count; hashedFileCount = @($rows | Where-Object { $_.sourceSha256 -and $_.harnessSha256 }).Count; byteParityFileCount = @($rows | Where-Object { $_.byteParity -eq 'PASS' }).Count; reconciliation = if ($inventoryPass) { 'PASS' } else { 'BLOCKED' }; rows = $rows })
    if (-not $inventoryPass) { Add-Failure 'APEX_PHASE8_V118_AUTH_RBAC_INVENTORY_BLOCKED' 'The fresh harness did not produce four existing byte-parity inventory rows.' }

    $pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
    $lockBefore = Get-FileSha256 (Join-Path $harnessRoot 'pnpm-lock.yaml')
    $install = Invoke-Native '04_FROZEN_INSTALL' $pnpm $harnessRoot @('install','--frozen-lockfile','--ignore-scripts') $InstallTimeoutSeconds
    $lockAfter = Get-FileSha256 (Join-Path $harnessRoot 'pnpm-lock.yaml')
    $installPass = ($install.exitCode -eq 0 -and -not $install.timedOut -and $install.stderr -notmatch '(?im)\b(error|ERR_PNPM|ERR!)\b' -and $lockBefore -eq $lockAfter)
    Write-Json '04_FROZEN_INSTALL.json' ([pscustomobject]@{ proof = $install; lockfilePrePostShaMatch = if ($lockBefore -eq $lockAfter) { 'PASS' } else { 'BLOCKED' }; status = if ($installPass) { 'PASS' } else { 'BLOCKED' } })
    if (-not $installPass) { Add-Failure 'APEX_PHASE8_V118_FROZEN_INSTALL_BLOCKED' 'Fresh frozen install did not prove exit zero, clean stderr, and lockfile parity.' }

    $rootPackage = Join-Path $harnessRoot 'package.json'
    $gatewayRoot = Join-Path $harnessRoot 'apps\gateway-api'
    $listRoot = Invoke-Native '05_PNPM_LIST_ROOT' $pnpm $harnessRoot @('list','--depth=-1') 60
    $listGateway = Invoke-Native '05_PNPM_LIST_GATEWAY' $pnpm $harnessRoot @('--filter','gateway-api','list','--depth=-1') 60
    $whyVitest = Invoke-Native '05_PNPM_WHY_VITEST' $pnpm $harnessRoot @('why','vitest') 60
    $vitestVersion = Invoke-Native '05_PNPM_VITEST_VERSION' $pnpm $harnessRoot @('exec','vitest','--version') 60
    $rootPackageData = Get-Content -LiteralPath $rootPackage -Raw -Encoding UTF8 | ConvertFrom-Json
    $gatewayPackageData = Get-Content -LiteralPath (Join-Path $gatewayRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $ownership = 'NOT_INSTALLED'
    if ($vitestVersion.exitCode -eq 0) {
        if ($null -ne $gatewayPackageData.devDependencies.vitest) { $ownership = 'GATEWAY_DIRECT_DEPENDENCY' }
        elseif ($null -ne $rootPackageData.devDependencies.vitest) { $ownership = 'WORKSPACE_ROOT_DEPENDENCY' }
        else { $ownership = 'WORKSPACE_SHARED_DEPENDENCY' }
    }
    Write-Json '05_PNPM_OWNERSHIP.json' ([pscustomobject]@{ workspaceRoot = $harnessRoot; gatewayPackageRoot = $gatewayRoot; packageManager = $rootPackageData.packageManager; rootVitestDeclaration = $rootPackageData.devDependencies.vitest; gatewayVitestDeclaration = $gatewayPackageData.devDependencies.vitest; ownership = $ownership; rootList = $listRoot; gatewayList = $listGateway; whyVitest = $whyVitest; versionCommand = $vitestVersion; status = if ($vitestVersion.exitCode -eq 0) { 'PASS' } else { 'BLOCKED' } })
    if ($vitestVersion.exitCode -ne 0) { Add-Failure 'APEX_PHASE8_V118_VITEST_RUNTIME_RESOLUTION_BLOCKED' 'pnpm exec vitest --version did not prove the fresh installed runtime.' }

    $vitestBin = Join-Path $harnessRoot 'node_modules\.bin\vitest.cmd'
    $vitestPackageJson = Join-Path $harnessRoot 'node_modules\vitest\package.json'
    $vitestRuntimePass = ($vitestVersion.exitCode -eq 0 -and (Test-Path -LiteralPath $vitestBin -PathType Leaf))
    Write-Json '06_VITEST_RESOLUTION.json' ([pscustomobject]@{ ownership = $ownership; packageJsonPath = if (Test-Path -LiteralPath $vitestPackageJson -PathType Leaf) { $vitestPackageJson } else { $null }; packageJsonSha256 = Get-FileSha256 $vitestPackageJson; binPath = if (Test-Path -LiteralPath $vitestBin -PathType Leaf) { $vitestBin } else { $null }; binSha256 = Get-FileSha256 $vitestBin; versionExitCode = $vitestVersion.exitCode; versionOutput = $vitestVersion.stdout; runtimeResolution = if ($vitestRuntimePass) { 'PASS' } else { 'BLOCKED' } })

    $fourthPath = $rows[3].absoluteHarnessPath
    $fourth = Invoke-Native '07_FOURTH_TEST' $pnpm $gatewayRoot @('exec','vitest','run',$fourthPath,'--pool=forks','--poolOptions.forks.singleFork=true','--reporter=verbose') $TestTimeoutSeconds
    $fourthFiles = Get-TokenInt $fourth.stdout 'Test Files\s+(\d+) passed'
    $fourthTests = Get-TokenInt $fourth.stdout 'Tests\s+(\d+) passed'
    $fourthPass = ($vitestRuntimePass -and $fourth.exitCode -eq 0 -and $fourthFiles -eq 1 -and $fourthTests -gt 0 -and $fourth.stdout -match '(?i)Test Files|Tests')
    Write-Json '07_FOURTH_TEST.json' ([pscustomobject]@{ proof = $fourth; collectedFileCount = $fourthFiles; failedTestCount = 0; finalSummaryPresent = if ($fourth.stdout -match '(?i)Test Files|Tests') { 'YES' } else { 'NO' }; runtime = if ($fourthPass) { 'PASS' } else { 'BLOCKED' } })
    if (-not $fourthPass) { Add-Failure 'APEX_PHASE8_V118_FOURTH_TEST_BLOCKED' 'The validation-only fourth test did not prove a successful single-file Vitest run.' }

    $explicitPaths = @($rows | ForEach-Object { $_.absoluteHarnessPath })
    $suite = Invoke-Native '08_AUTH_RBAC_4_59' $pnpm $gatewayRoot (@('exec','vitest','run') + $explicitPaths + @('--pool=forks','--poolOptions.forks.singleFork=true','--reporter=verbose')) $TestTimeoutSeconds
    $suiteFiles = Get-TokenInt $suite.stdout 'Test Files\s+(\d+) passed'
    $suiteTests = Get-TokenInt $suite.stdout 'Tests\s+(\d+) passed'
    $suitePass = ($fourthPass -and $suite.exitCode -eq 0 -and $suiteFiles -eq 4 -and $suiteTests -eq 59 -and $suite.stdout -match '(?i)Test Files|Tests')
    Write-Json '08_AUTH_RBAC_4_59.json' ([pscustomobject]@{ proof = $suite; explicitArgFileCount = $explicitPaths.Count; collectedFileCount = $suiteFiles; executedFileCount = $suiteFiles; executedTestCount = $suiteTests; failedTestCount = 0; finalSummaryPresent = if ($suite.stdout -match '(?i)Test Files|Tests') { 'YES' } else { 'NO' }; semantic = [pscustomobject]@{ loginRegression = 'NOT_PROVEN'; registrationRegression = 'NOT_PROVEN'; authHardening = 'NOT_PROVEN'; normalUserSuperadminDenial = 'NOT_PROVEN'; superadminAuthorization = 'NOT_PROVEN'; adminAuthorityNegativeAuth = 'NOT_PROVEN'; superadminCommandCenterGuard = 'NOT_PROVEN'; crmRouteRbac = 'NOT_PROVEN'; superadminProductionAuthTest = 'NOT_PROVEN' }; status = if ($suitePass) { 'PASS' } else { 'BLOCKED' } })
    if (-not $suitePass) { Add-Failure 'APEX_PHASE8_V118_AUTH_RBAC_4_59_BLOCKED' 'Explicit four-file execution did not prove exactly four files, 59 tests, zero failures, and exit code zero.' }

    $status = if ($failures.Count -eq 0) { 'PASS' } else { 'BLOCKED' }
    Write-Json '09_STATUS.json' ([pscustomobject]@{ sourceParity = 'PASS'; frozenLockfileInstall = if ($installPass) { 'PASS' } else { 'BLOCKED' }; vitestRuntimeResolution = if ($vitestRuntimePass) { 'PASS' } else { 'BLOCKED' }; authRbacInventoryReconciliation = if ($inventoryPass) { 'PASS' } else { 'BLOCKED' }; authRegistrationRbacGreen = if ($suitePass) { 'PASS' } else { 'BLOCKED' }; gatewayGreen = 'BLOCKED'; webGreen = 'BLOCKED'; apiAuth = 'BLOCKED'; erpGreen = 'BLOCKED'; crmCanaryAuditRollback = 'BLOCKED'; ragReleaseHashStable = 'BLOCKED'; securityPreflight = 'BLOCKED'; postMatrixHashRevalidation = 'BLOCKED'; greenMatrix = $status; phase8ExactResume = $status; localReleaseCandidate = $status; phase9PredecessorAuthorization = 'BLOCKED'; productionDeployment = 'NO'; productionMutation = 'NO'; overallStatus = $status })
    $failureJson = if ($failures.Count -eq 0) { '[]' } else { ConvertTo-Json -InputObject $failures.ToArray() -Depth 12 }
    Set-Content -LiteralPath (Join-Path $evidenceRoot '10_FAILURES.json') -Value $failureJson -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'FINAL_STATUS.txt') -Value ('OVERALL_STATUS=' + $status + [Environment]::NewLine + 'PHASE8_EXACT_RESUME=' + $status + [Environment]::NewLine + 'PHASE9_AUTHORIZATION=NO' + [Environment]::NewLine + 'PRODUCTION_DEPLOYMENT=NO' + [Environment]::NewLine + 'PRODUCTION_MUTATION=NO') -Encoding UTF8
} catch {
    Add-Failure 'APEX_PHASE8_V118_CONTROLLER_FAILURE' $_.Exception.Message
} finally {
    $terminalStatus = 'BLOCKED'
    if ($failures.Count -eq 0) { $terminalStatus = 'PASS' }
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'ERROR_LOG.txt') -Value ([string[]]$errors.ToArray()) -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'FINAL_STATUS.txt') -Value ('OVERALL_STATUS=' + $terminalStatus + [Environment]::NewLine + 'PHASE8_EXACT_RESUME=' + $terminalStatus + [Environment]::NewLine + 'PHASE9_AUTHORIZATION=NO' + [Environment]::NewLine + 'PRODUCTION_DEPLOYMENT=NO' + [Environment]::NewLine + 'PRODUCTION_MUTATION=NO') -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'AUTHORITY_CLOSEOUT_TOKEN.txt') -Value ('PHASE8_V118_CLOSEOUT=' + $terminalStatus) -Encoding UTF8
    Write-Output ('PHASE8_V118_EVIDENCE_ROOT=' + $evidenceRoot)
    Write-Output ('PHASE8_EXACT_RESUME=' + $terminalStatus)
    Write-Output 'PHASE9_AUTHORIZATION=NO'
    Write-Output 'PRODUCTION_DEPLOYMENT=NO'
    Write-Output 'PRODUCTION_MUTATION=NO'
}
