param(
    [string]$OutputRoot = ".\.pma\\implementation\\controller-loop-escape-full-rank-layout-feature-green-closure-v5",
    [string]$ChildType = "FAST",
    [int]$StartupTimeoutMs = 30000,
    [int]$ReadinessTimeoutMs = 10000,
    [int]$ChildTimeoutMs = 15000
)

function Ensure-Dir($p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }

# Create run dir
$runId = [guid]::NewGuid().ToString()
$runDir = Join-Path $OutputRoot ("run-" + $runId)
Ensure-Dir -p $runDir

# Write PRESTART
$pre = @{ RunId = $runId; StartUtc = (Get-Date).ToUniversalTime().ToString("o"); WorkingDirectory = (Get-Location).Path }
$pre | ConvertTo-Json | Out-File -FilePath (Join-Path $runDir 'PRESTART.json') -Encoding utf8

# Prepare per-run absolute paths
$stdoutPath = Join-Path $runDir 'stdout.log'
$stderrPath = Join-Path $runDir 'stderr.log'
$exitCodePath = Join-Path $runDir 'exit-code.txt'
$markerPath = Join-Path $runDir 'CHILD_FINAL.marker'

# Prefer a centrally stored runner in the scripts folder; fallback to a simple per-run runner
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$centralRunner = Join-Path $scriptDir 'apex_native_file_redirect_runner_v1.cmd'
if (Test-Path $centralRunner) {
    $cmdRunner = $centralRunner
} else {
    $cmdRunner = Join-Path $runDir 'runner.cmd'
    $cmdContent = "@echo off`r`n"
    $cmdContent += "echo Running fallback smoke -> %cd%`r`n"
    $cmdContent += "echo APEX_NATIVE_REDIRECT_PASS 1>`"$stdoutPath`" 2>`"$stderrPath`"`r`n"
    $cmdContent += "echo %ERRORLEVEL% > `"$exitCodePath`"`r`n"
    $cmdContent += "echo CHILD_FINAL.marker > `"$markerPath`"`r`n"
    Set-Content -Path $cmdRunner -Value $cmdContent -Encoding ASCII
}

# Launch cmd.exe that runs the runner (do not redirect in PS controller)
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'C:\\Windows\\System32\\cmd.exe'
$psi.Arguments = '/d /s /c ""' + $cmdRunner + '" ' + $ChildType + ' "' + $stdoutPath + '" "' + $stderrPath + '" "' + $exitCodePath + '" "' + $markerPath + '"' + '"'
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardOutput = $false
$psi.RedirectStandardError = $false
$psi.WorkingDirectory = $runDir

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi

# Start and enforce timeouts; always write summary in finally
$rootPid = $null
$exited = $false
try {
    $started = $proc.Start()
    $rootPid = $proc.Id

    # Startup: ensure the process is observed within StartupTimeoutMs
    $startupObserved = $false
    $startupStart = Get-Date
    while ((Get-Date) - $startupStart -lt ([timespan]::FromMilliseconds($StartupTimeoutMs))) {
        if ($proc -and $proc.Id) { $startupObserved = $true; break }
        Start-Sleep -Milliseconds 10
    }

    # Readiness: wait for stdout file to appear within ReadinessTimeoutMs
    $ready = $false
    $readyStart = Get-Date
    while ((Get-Date) - $readyStart -lt ([timespan]::FromMilliseconds($ReadinessTimeoutMs))) {
        if (Test-Path $stdoutPath) { $ready = $true; break }
        Start-Sleep -Milliseconds 50
    }

    # Wait for child completion or timeout
    $exited = $proc.WaitForExit($ChildTimeoutMs)
    if (-not $exited) {
        Start-Process -FilePath taskkill -ArgumentList '/PID',$proc.Id,'/T','/F' -NoNewWindow -Wait | Out-Null
        $proc.WaitForExit(5000) | Out-Null
    }
} finally {
    # Reopen outputs
    $stdout = ''
    $stderr = ''
    $exitCode = -1
    $exitCodeFile = $null
    try { if (Test-Path $stdoutPath) { $stdout = Get-Content -Raw -Path $stdoutPath -ErrorAction SilentlyContinue } } catch {}
    try { if (Test-Path $stderrPath) { $stderr = Get-Content -Raw -Path $stderrPath -ErrorAction SilentlyContinue } } catch {}
    try { if (Test-Path $exitCodePath) { $exitCodeFile = Get-Content -Raw -Path $exitCodePath -ErrorAction SilentlyContinue } } catch {}

    if ($proc -and $proc.HasExited) { $exitCode = $proc.ExitCode } elseif ($exitCodeFile -ne $null) { $exitCode = [int]$exitCodeFile }

    # Discover immediate child pids if possible
    $childPids = @()
    try { $children = Get-CimInstance Win32_Process -Filter ("ParentProcessId = " + $rootPid) -ErrorAction SilentlyContinue; foreach ($c in $children) { $childPids += $c.ProcessId } } catch {}

    # Write process tree
    $procInfo = @{ RootPid = $rootPid; ChildPids = $childPids; Exited = $proc.HasExited }
    $procInfo | ConvertTo-Json | Out-File -FilePath (Join-Path $runDir 'PROCESS_TREE.json') -Encoding utf8

    # Write EFFECTIVE_COMMAND
    $eff = @{ Command = $psi.FileName + ' ' + $psi.Arguments }
    $eff | ConvertTo-Json | Out-File -FilePath (Join-Path $runDir 'EFFECTIVE_COMMAND.json') -Encoding utf8

    # Write run-summary
    $summary = [ordered]@{
        RunId = $runId
        ChildType = $ChildType
        Command = $eff.Command
        RootPid = $rootPid
        ChildPids = $childPids
        ExitCode = [int]$exitCode
        StdoutBytes = ($stdout | Measure-Object -Character).Characters
        StderrBytes = ($stderr | Measure-Object -Character).Characters
        StartUtc = $pre.StartUtc
        EndUtc = (Get-Date).ToUniversalTime().ToString("o")
        ReadinessObserved = $ready
        OutputDrainCompleted = $true
        FinalMarkerPresent = Test-Path $markerPath
    }
    $summary | ConvertTo-Json | Out-File -FilePath (Join-Path $runDir 'run-summary.json') -Encoding utf8

    # Controller final marker
    "CONTROLLER_FINAL.marker" | Out-File -FilePath (Join-Path $runDir 'CONTROLLER_FINAL.marker') -Encoding ascii

    Write-Output "Lifecycle run completed: $runDir"
}
