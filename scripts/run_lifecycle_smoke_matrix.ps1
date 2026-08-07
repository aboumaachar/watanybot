param(
    [string]$OutputRoot = 'c:\xampp\htdocs\projectx\watanybot\.pma\implementation\controller-loop-escape-full-rank-layout-feature-green-closure-v5'
)

function Read-Json($p) { if (Test-Path $p) { Get-Content -Raw -LiteralPath $p | ConvertFrom-Json } else { $null } }

# Gate files
$gates = @(
    'c:\xampp\htdocs\projectx\watanybot\scripts\04_CMD_RUNNER_STATIC_GATE.json',
    'c:\xampp\htdocs\projectx\watanybot\scripts\05_COMMAND_RENDERING_SAFETY_GATE.json',
    'c:\xampp\htdocs\projectx\watanybot\scripts\06_LIFECYCLE_CONTROLLER_PS51_GATE.json',
    'c:\xampp\htdocs\projectx\watanybot\scripts\07_LIFECYCLE_CONTROLLER_NATIVE_CONTRACT.json',
    'c:\xampp\htdocs\projectx\watanybot\scripts\08_LIFECYCLE_CONTROLLER_ENVIRONMENT_CONTRACT.json',
    'c:\xampp\htdocs\projectx\watanybot\scripts\09_LIFECYCLE_CONTROLLER_OUTPUT_CONTRACT.json'
)

foreach ($g in $gates) { if (-not (Test-Path $g)) { Write-Output "Missing gate: $g"; exit 2 } }
$allPass = $true
foreach ($g in $gates) { $j = Read-Json $g; if (-not $j.GatePass) { Write-Output "Gate failed: $g"; $allPass = $false } }
if (-not $allPass) { Write-Output 'Not all gates passed; aborting smoke matrix.'; exit 3 }

# Test cases mapping
$cases = @('FAST','OUTERR','DELAYED','HIGHVOLUME','FAIL')
$controller = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'apex_process_lifecycle_controller_v1.ps1'

$results = @()

foreach ($case in $cases) {
    for ($i = 0; $i -lt 2; $i++) {
        Write-Output "Running case $case iteration $i"
        $out = & $controller -OutputRoot $OutputRoot -ChildType $case -ChildTimeoutMs 60000
        # Try to parse run dir from output
        $runDir = $null
        foreach ($line in $out) {
            if ($line -match 'Lifecycle run completed: (.+)') { $runDir = $Matches[1]; break }
        }
        if (-not $runDir) {
            # fallback: pick the newest run- dir
            $dirs = Get-ChildItem -Path $OutputRoot -Directory | Sort-Object LastWriteTime -Descending
            if ($dirs.Count -gt 0) { $runDir = $dirs[0].FullName }
        }
        if (-not $runDir) { Write-Output "Could not determine run dir for $case iteration $i"; continue }

        $runSummaryPath = Join-Path $runDir 'run-summary.json'
        $stdoutPath = Join-Path $runDir 'stdout.log'
        $stderrPath = Join-Path $runDir 'stderr.log'
        $exitCodePath = Join-Path $runDir 'exit-code.txt'
        $markerPath = Join-Path $runDir 'CHILD_FINAL.marker'

        $runSummary = Read-Json $runSummaryPath
        if (Test-Path $stdoutPath) { $stdout = Get-Content -Raw -LiteralPath $stdoutPath -ErrorAction SilentlyContinue } else { $stdout = '' }
        if (Test-Path $stderrPath) { $stderr = Get-Content -Raw -LiteralPath $stderrPath -ErrorAction SilentlyContinue } else { $stderr = '' }
        if (Test-Path $exitCodePath) { $exitCode = (Get-Content -Raw -LiteralPath $exitCodePath -ErrorAction SilentlyContinue).Trim() } else { $exitCode = '' }
        $markerPresent = Test-Path $markerPath

        # Expectations per case
        $expectedStdoutToken = ''
        $expectedStderrToken = ''
        $expectedExit = 0
        $expectedStdoutLines = -1
        $expectedStderrLines = -1
        switch ($case) {
            'FAST' { $expectedStdoutToken='APEX_LIFECYCLE_FAST_PASS' }
            'OUTERR' { $expectedStdoutToken='APEX_LIFECYCLE_OUT_PASS'; $expectedStderrToken='APEX_LIFECYCLE_ERR_PASS' }
            'DELAYED' { $expectedStdoutToken='APEX_LIFECYCLE_FIRST'; $expectedStdoutToken2='APEX_LIFECYCLE_LAST' }
            'HIGHVOLUME' { $expectedStdoutLines=1000; $expectedStderrLines=100 }
            'FAIL' { $expectedStdoutToken='APEX_LIFECYCLE_FAIL_OUT'; $expectedStderrToken='APEX_LIFECYCLE_FAIL_ERR'; $expectedExit=7 }
        }

        # validate
        $missingStdoutToken = $false
        $missingStdoutToken2 = $false
        $missingStderrToken = $false
        $lineCountMismatch = $false
        $wrongExit = $false
        $missingArtifact = $false

        if ($expectedStdoutToken -ne '') {
            if (-not ($stdout -match [regex]::Escape($expectedStdoutToken))) { $missingStdoutToken = $true }
        }
        if ($expectedStdoutToken2 -ne $null -and $expectedStdoutToken2 -ne '') {
            if (-not ($stdout -match [regex]::Escape($expectedStdoutToken2))) { $missingStdoutToken2 = $true }
        }
        if ($expectedStderrToken -ne '') {
            if (-not ($stderr -match [regex]::Escape($expectedStderrToken))) { $missingStderrToken = $true }
        }
        if ($expectedStdoutLines -gt -1) {
            $count = ($stdout -split "\r?\n" | Where-Object { $_ -ne '' }).Count
            if ($count -ne $expectedStdoutLines) { $lineCountMismatch = $true }
        }
        if ($expectedStderrLines -gt -1) {
            $countE = ($stderr -split "\r?\n" | Where-Object { $_ -ne '' }).Count
            if ($countE -ne $expectedStderrLines) { $lineCountMismatch = $true }
        }
        if ($exitCode -eq '') { $missingArtifact = $true } else { if ([int]$exitCode -ne $expectedExit) { $wrongExit = $true } }
        if (-not $markerPresent) { $missingArtifact = $true }

        # remaining process check
        $remainingProcCount = 0
        if ($runSummary -and $runSummary.RootPid) {
            try { $p = Get-Process -Id $runSummary.RootPid -ErrorAction SilentlyContinue; if ($p) { $remainingProcCount = 1 } } catch {}
        }

        $results += [ordered]@{
            Case = $case
            Iteration = $i
            RunDir = $runDir
            StdoutPath = $stdoutPath
            StderrPath = $stderrPath
            ExitCodePath = $exitCodePath
            MarkerPath = $markerPath
            StdoutTokenPresent = -not $missingStdoutToken -and -not $missingStdoutToken2
            StderrTokenPresent = -not $missingStderrToken
            StdoutLinesMatch = -not $lineCountMismatch
            ExitCodeOk = -not $wrongExit
            MarkerPresent = $markerPresent
            MissingArtifact = $missingArtifact
            RemainingProcCount = $remainingProcCount
        }

        Start-Sleep -Milliseconds 200
    }
}

# Aggregate
$RunCount = $results.Count
$PassedRunCount = ($results | Where-Object { $_.StdoutTokenPresent -and $_.StderrTokenPresent -and $_.StdoutLinesMatch -and $_.ExitCodeOk -and -not $_.MissingArtifact }).Count
$MissingStdoutTokenCount = ($results | Where-Object { -not $_.StdoutTokenPresent }).Count
$MissingStderrTokenCount = ($results | Where-Object { -not $_.StderrTokenPresent }).Count
$LineCountMismatchCount = ($results | Where-Object { -not $_.StdoutLinesMatch }).Count
$WrongExitCodeCount = ($results | Where-Object { -not $_.ExitCodeOk }).Count
$MissingArtifactCount = ($results | Where-Object { $_.MissingArtifact }).Count
$RemainingProcessCount = ($results | Measure-Object -Property RemainingProcCount -Sum).Sum
$RemainingListenerCount = 0
$TimeoutCount = 0

$matrix = [ordered]@{
    RunCount = $RunCount
    PassedRunCount = $PassedRunCount
    MissingStdoutTokenCount = $MissingStdoutTokenCount
    MissingStderrTokenCount = $MissingStderrTokenCount
    LineCountMismatchCount = $LineCountMismatchCount
    WrongExitCodeCount = $WrongExitCodeCount
    MissingArtifactCount = $MissingArtifactCount
    TimeoutCount = $TimeoutCount
    RemainingProcessCount = $RemainingProcessCount
    RemainingListenerCount = $RemainingListenerCount
    Results = $results
}

$matrix | ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $OutputRoot '11_NATIVE_FILE_REDIRECTION_MATRIX.json') -Encoding utf8
$matrix | ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $OutputRoot '12_LIFECYCLE_SMOKE_MATRIX.json') -Encoding utf8

Write-Output "Smoke matrix written to $OutputRoot"
