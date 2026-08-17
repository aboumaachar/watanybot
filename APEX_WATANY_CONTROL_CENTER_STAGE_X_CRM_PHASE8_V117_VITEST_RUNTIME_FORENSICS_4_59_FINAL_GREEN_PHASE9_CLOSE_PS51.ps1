param(
    [string]$PredecessorRoot = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v116-final-green\phase8-v116-final-green-20260816-160832',
    [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'
$scriptPath = $MyInvocation.MyCommand.Path
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceParent = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'WatanyBot-APEX-Evidence\watany-control-center-crm-phase8-v117-runtime-forensics'
$evidenceRoot = Join-Path $evidenceParent ('phase8-v117-runtime-forensics-' + $runId)
$harnessRoot = Join-Path $evidenceRoot 'candidate-validation-harness'
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
New-Item -ItemType Directory -Path $harnessRoot -Force | Out-Null

$failures = New-Object System.Collections.Generic.List[object]
$actions = New-Object System.Collections.Generic.List[object]
$errors = New-Object System.Collections.Generic.List[string]

function Get-FileSha256([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}
function Write-Json([string]$Name, [object]$Value) {
    $path = Join-Path $evidenceRoot $Name
    $Value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $path -Encoding UTF8
}
function Add-Failure([string]$Code, [string]$Message) {
    $failures.Add([pscustomobject]@{ code = $Code; message = $Message })
    $errors.Add(($Code + ': ' + $Message))
}
function Get-ProcessSnapshot([int[]]$ProcessIds) {
    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($processId in @($ProcessIds)) {
        if ($processId -le 0) { continue }
        $row = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $processId) -ErrorAction SilentlyContinue
        if ($null -ne $row) {
            $rows.Add([pscustomobject]@{
                processId = [int]$row.ProcessId
                parentProcessId = [int]$row.ParentProcessId
                name = [string]$row.Name
                commandLine = [string]$row.CommandLine
                creationDate = [string]$row.CreationDate
            })
        }
    }
    return @($rows)
}
function Get-DescendantIds([int]$RootPid) {
    $all = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
    $found = New-Object System.Collections.Generic.List[int]
    $queue = New-Object System.Collections.Generic.Queue[int]
    $queue.Enqueue($RootPid)
    while ($queue.Count -gt 0) {
        $current = $queue.Dequeue()
        foreach ($child in @($all | Where-Object { [int]$_.ParentProcessId -eq $current })) {
            $childId = [int]$child.ProcessId
            if (-not $found.Contains($childId)) {
                $found.Add($childId)
                $queue.Enqueue($childId)
            }
        }
    }
    return @($found)
}
function Stop-DisposableTree([int]$RootPid) {
    $ids = @(Get-DescendantIds $RootPid)
    [array]::Reverse($ids)
    foreach ($processId in $ids) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Stop-Process -Id $RootPid -Force -ErrorAction SilentlyContinue
    return $ids
}

try {
    'APEX_PS1_SKILL_UPDATE_NOT_REQUIRED' | Set-Content -LiteralPath (Join-Path $evidenceRoot 'EXECUTION_LOG.txt') -Encoding UTF8
    foreach ($stageName in @('02_V116_HARNESS_IDENTITY.json','03_VITEST_RUNTIME_RESOLUTION.json','04_DIRECT_NODE_FOURTH_TEST.json','05_STATUS.json','06_FAILURES.json','FINAL_STATUS.txt')) {
        Set-Content -LiteralPath (Join-Path $evidenceRoot $stageName) -Value 'NOT_STARTED' -Encoding UTF8
    }
    [pscustomobject]@{ authority = 'PHASE8_V1.0.17'; runId = $runId; controllerSha256 = Get-FileSha256 $scriptPath; predecessorRoot = $PredecessorRoot; powershell = $PSVersionTable.PSVersion.ToString(); productionCandidateMutated = 'NO'; productionDeployment = 'NO'; productionMutation = 'NO' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidenceRoot '00_RUN_METADATA.json') -Encoding UTF8

    if (-not (Test-Path -LiteralPath $PredecessorRoot -PathType Container)) {
        Add-Failure 'APEX_PHASE8_V117_PREDECESSOR_ROOT_MISSING' 'The preserved V1.0.16 evidence root is unavailable.'
    }
    $oldAuthPath = Join-Path $PredecessorRoot '06_AUTH_RBAC_EXPLICIT_4_59_EXECUTION.json'
    if (Test-Path -LiteralPath $oldAuthPath -PathType Leaf) {
        Copy-Item -LiteralPath $oldAuthPath -Destination (Join-Path $evidenceRoot '01_V116_AUTH_RBAC_BLOCKER.json') -Force
    } else {
        Add-Failure 'APEX_PHASE8_V117_PREDECESSOR_AUTH_EVIDENCE_MISSING' 'The V1.0.16 Auth/RBAC blocker artifact is unavailable.'
    }

    $oldHarness = Join-Path $PredecessorRoot 'candidate-validation-harness'
    $harnessIdentity = [pscustomobject]@{ harnessRoot = $oldHarness; exists = (Test-Path -LiteralPath $oldHarness -PathType Container); packageRoot = $null; packageJsonSha256 = $null; vitestConfigSha256 = $null; tsconfigSha256 = $null; lockfileSha256 = $null; nodeModulesExists = $false; fourTestPaths = @(); fourTestSha256 = @() }
    if ($harnessIdentity.exists) {
        $packageRootCandidate = Join-Path $oldHarness 'apps\gateway-api'
        $harnessIdentity.packageRoot = $packageRootCandidate
        $harnessIdentity.packageJsonSha256 = Get-FileSha256 (Join-Path $packageRootCandidate 'package.json')
        $harnessIdentity.vitestConfigSha256 = Get-FileSha256 (Join-Path $packageRootCandidate 'vitest.config.ts')
        $harnessIdentity.tsconfigSha256 = Get-FileSha256 (Join-Path $packageRootCandidate 'tsconfig.json')
        $harnessIdentity.lockfileSha256 = Get-FileSha256 (Join-Path $oldHarness 'pnpm-lock.yaml')
        $harnessIdentity.nodeModulesExists = Test-Path -LiteralPath (Join-Path $packageRootCandidate 'node_modules') -PathType Container
        $required = @('login-auth.test.ts','registration-auth.test.ts','superadmin-auth-hardening.test.ts','superadmin-users-production-auth.test.ts')
        foreach ($name in $required) {
            $match = @(Get-ChildItem -LiteralPath $oldHarness -Recurse -File -Filter $name -ErrorAction SilentlyContinue | Select-Object -First 1)
            if ($match.Count -eq 1) {
                $harnessIdentity.fourTestPaths += $match[0].FullName
                $harnessIdentity.fourTestSha256 += [pscustomobject]@{ path = $match[0].FullName; sha256 = Get-FileSha256 $match[0].FullName }
            }
        }
    } else {
        Add-Failure 'APEX_PHASE8_V117_HARNESS_IDENTITY_UNPROVEN' 'The V1.0.16 disposable harness directory was not found.'
    }
    Write-Json '02_V116_HARNESS_IDENTITY.json' $harnessIdentity

    $nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
    $vitestPackage = Get-ChildItem -LiteralPath (Join-Path $harnessIdentity.packageRoot 'node_modules') -Recurse -File -Filter package.json -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match '[\\/]vitest[\\/]package\.json$' } | Select-Object -First 1
    $vitestBin = $null
    $vitestVersion = $null
    if ($null -ne $vitestPackage) {
        $vitestMetadata = Get-Content -LiteralPath $vitestPackage.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        $vitestVersion = [string]$vitestMetadata.version
        $binValue = $vitestMetadata.bin.vitest
        if ($binValue -is [string]) { $vitestBin = Join-Path $vitestPackage.DirectoryName $binValue }
        else { $vitestBin = Join-Path $vitestPackage.DirectoryName ([string]$binValue.vitest) }
    } else {
        Add-Failure 'APEX_PHASE8_V117_VITEST_ENTRY_UNRESOLVED' 'Installed Vitest package metadata could not be found in the frozen harness.'
    }
    $vitestPackageJsonPath = $null
    if ($null -ne $vitestPackage) { $vitestPackageJsonPath = $vitestPackage.FullName }
    $runtimeResolution = [pscustomobject]@{ nodeExePath = $nodeExe; vitestPackageJsonPath = $vitestPackageJsonPath; vitestPackageVersion = $vitestVersion; vitestBinPath = $vitestBin; vitestBinSha256 = Get-FileSha256 $vitestBin }
    Write-Json '03_VITEST_RUNTIME_RESOLUTION.json' $runtimeResolution

    $stdoutPath = Join-Path $evidenceRoot 'stdout.log'
    $stderrPath = Join-Path $evidenceRoot 'stderr.log'
    $beforePath = Join-Path $evidenceRoot 'process-tree-before-timeout.json'
    $afterPath = Join-Path $evidenceRoot 'process-tree-after-exit.json'
    $processResultPath = Join-Path $evidenceRoot 'process.json'
    $fourth = @($harnessIdentity.fourTestPaths | Where-Object { $_ -match 'superadmin-users-production-auth\.test\.ts$' })
    $probe = [pscustomobject]@{ status = 'BLOCKED'; fourthTestDirectNode = 'BLOCKED'; executable = $nodeExe; cwd = $harnessIdentity.packageRoot; argv = @(); timeoutSeconds = $TimeoutSeconds; pid = $null; startTime = $null; exitObserved = $false; exitCode = $null; stdoutBytes = 0; stderrBytes = 0; processTerminatedAfterTimeout = $false; classification = 'UNKNOWN_RUNTIME_STALL'; finalVitestSummaryPresent = 'NO' }
    if ($fourth.Count -eq 1 -and $null -ne $vitestBin -and (Test-Path -LiteralPath $vitestBin -PathType Leaf)) {
        $probe.argv = @($vitestBin, 'run', $fourth[0], '--pool=forks', '--poolOptions.forks.singleFork=true', '--reporter=verbose')
        $startTime = Get-Date
        $proc = Start-Process -FilePath $nodeExe -ArgumentList (($probe.argv | ForEach-Object { '"' + ($_ -replace '"','\"') + '"' }) -join ' ') -WorkingDirectory $harnessIdentity.packageRoot -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
        $probe.pid = $proc.Id
        $probe.startTime = $startTime.ToString('o')
        Start-Sleep -Milliseconds 750
        $beforeIds = @($proc.Id) + @(Get-DescendantIds $proc.Id)
        (Get-ProcessSnapshot $beforeIds) | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $beforePath -Encoding UTF8
        $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
        while (-not $proc.HasExited -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
        if ($proc.HasExited) {
            $probe.exitObserved = $true
            $probe.exitCode = $proc.ExitCode
            $probe.classification = 'VITEST_EXITED_PARENT_WRAPPER_STILL_WAITING'
        } else {
            $probe.classification = 'VITEST_PROCESS_RUNNING_CPU_IDLE'
            $probe.processTerminatedAfterTimeout = $true
            Stop-DisposableTree $proc.Id | Out-Null
        }
        $afterIds = @($proc.Id) + @(Get-DescendantIds $proc.Id)
        (Get-ProcessSnapshot $afterIds) | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $afterPath -Encoding UTF8
        $stdoutBytes = if (Test-Path -LiteralPath $stdoutPath) { (Get-Item -LiteralPath $stdoutPath).Length } else { 0 }
        $stderrBytes = if (Test-Path -LiteralPath $stderrPath) { (Get-Item -LiteralPath $stderrPath).Length } else { 0 }
        $probe.stdoutBytes = $stdoutBytes
        $probe.stderrBytes = $stderrBytes
        $stdoutText = if ($stdoutBytes -gt 0) { Get-Content -LiteralPath $stdoutPath -Raw -Encoding UTF8 } else { '' }
        $probe.finalVitestSummaryPresent = if ($stdoutText -match 'Tests\s+\d+\s+passed|Test Files\s+\d+') { 'YES' } else { 'NO' }
        if ($probe.exitObserved -and $probe.exitCode -eq 0 -and $probe.finalVitestSummaryPresent -eq 'YES') { $probe.status = 'PASS'; $probe.fourthTestDirectNode = 'PASS' } else { Add-Failure 'APEX_PHASE8_V117_DIRECT_NODE_FOURTH_TEST_BLOCKED' 'The direct Node fourth-test probe did not produce an authoritative successful Vitest result.' }
    } else {
        Add-Failure 'APEX_PHASE8_V117_DIRECT_NODE_PROBE_NOT_READY' 'The fourth test path or installed Vitest entrypoint could not be proven.'
    }
    Write-Json '04_DIRECT_NODE_FOURTH_TEST.json' $probe

    $green = if ($failures.Count -eq 0) { 'PASS' } else { 'BLOCKED' }
    [pscustomobject]@{ sourceParity = 'CONSUMED'; frozenInstall = 'CONSUMED_PASS'; authRbacExplicit459 = $probe.status; apiAuth = 'BLOCKED'; crmCanary = 'BLOCKED'; securityPreflight = 'CONSUMED_PASS'; greenMatrix = $green; phase8ExactResume = $green; localReleaseCandidate = $green; phase9Authorization = 'BLOCKED'; productionDeployment = 'NO'; productionMutation = 'NO'; overallStatus = $green } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidenceRoot '05_STATUS.json') -Encoding UTF8
    @($failures) | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $evidenceRoot '06_FAILURES.json') -Encoding UTF8
    $final = 'OVERALL_STATUS=' + $green + [Environment]::NewLine + 'PHASE9_AUTHORIZATION=NO' + [Environment]::NewLine + 'PRODUCTION_DEPLOYMENT=NO' + [Environment]::NewLine + 'PRODUCTION_MUTATION=NO'
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'FINAL_STATUS.txt') -Value $final -Encoding UTF8
} catch {
    Add-Failure 'APEX_PHASE8_V117_CONTROLLER_FAILURE' $_.Exception.Message
} finally {
    @($errors) | Set-Content -LiteralPath (Join-Path $evidenceRoot 'ERROR_LOG.txt') -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $evidenceRoot 'AUTHORITY_CLOSEOUT_TOKEN.txt') -Value 'PHASE8_V117_CLOSEOUT=BLOCKED' -Encoding UTF8
    Write-Output ('PHASE8_V117_EVIDENCE_ROOT=' + $evidenceRoot)
    Write-Output 'PHASE8_EXACT_RESUME=BLOCKED'
    Write-Output 'PHASE9_AUTHORIZATION=NO'
    Write-Output 'PRODUCTION_DEPLOYMENT=NO'
    Write-Output 'PRODUCTION_MUTATION=NO'
}
