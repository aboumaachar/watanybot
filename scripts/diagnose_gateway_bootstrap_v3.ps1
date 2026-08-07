param(
    [Parameter(Mandatory=$true)][string]$NodeExe,
    [Parameter(Mandatory=$true)][string]$Args,
    [Parameter(Mandatory=$true)][string]$WorkingDir,
    [Parameter(Mandatory=$true)][string]$OutputRoot,
    [int]$StartupTimeoutMs = 120000,
    [int]$ReadinessTimeoutMs = 30000,
    [int]$OutputDrainTimeoutMs = 5000,
    [string]$ReadinessUrl = ""
)

$ErrorActionPreference = 'Stop'

function Write-JsonAscii {
    param($Path, $Object)
    $Object | ConvertTo-Json -Depth 10 | Out-File -FilePath $Path -Encoding ascii
}

function SafeGetFileHash {
    param($Path)
    if (Test-Path $Path) { (Get-FileHash -Algorithm SHA256 -Path $Path).Hash } else { $null }
}

function Get-ProcessTreePids {
    param($RootPid)
    $result = New-Object System.Collections.Generic.List[int]
    $queue = New-Object System.Collections.Generic.Queue[int]
    $queue.Enqueue([int]$RootPid)
    while ($queue.Count -gt 0) {
        $curPid = $queue.Dequeue()
        try { $result.Add([int]$curPid) } catch { }
        try {
            $children = Get-WmiObject Win32_Process -Filter ("ParentProcessId={0}" -f $curPid) -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessId -ErrorAction SilentlyContinue
            foreach ($c in $children) { $queue.Enqueue([int]$c) }
        } catch { }
    }
    return $result
}

try {
    $RunId = [guid]::NewGuid().ToString()
    $ScriptPath = $MyInvocation.MyCommand.Path
    $ControllerSHA256 = SafeGetFileHash $ScriptPath

    $OutputDir = Join-Path $OutputRoot ("v3-run-" + $RunId)
    New-Item -Path $OutputDir -ItemType Directory -Force | Out-Null
    Write-Output ("V3: Created output directory: {0}" -f $OutputDir)

    $PRESTART = Join-Path $OutputDir "PRESTART.json"
    $PARENT_ENV_NAMES = Join-Path $OutputDir "PARENT_ENVIRONMENT_NAMES.json"
    $CHILD_ENV_NAMES = Join-Path $OutputDir "CHILD_ENVIRONMENT_NAMES.json"
    $EFFECTIVE_COMMAND = Join-Path $OutputDir "EFFECTIVE_COMMAND.json"
    $StdoutPath = Join-Path $OutputDir "stdout.log"
    $StderrPath = Join-Path $OutputDir "stderr.log"
    $ProcessTreePath = Join-Path $OutputDir "PROCESS_TREE.json"
    $PortMatrixPath = Join-Path $OutputDir "PORT_MATRIX.json"
    $RunSummaryPath = Join-Path $OutputDir "run-summary.json"
    $FinalMarker = Join-Path $OutputDir "FINAL.marker"

    $NodeExeSHA256 = SafeGetFileHash $NodeExe

    $prestartObj = @{
        RunId = $RunId
        ControllerSHA256 = $ControllerSHA256
        PowerShellVersion = $PSVersionTable.PSVersion.ToString()
        StartUtc = [DateTime]::UtcNow.ToString("o")
        NodeExe = $NodeExe
        NodeExeSHA256 = $NodeExeSHA256
        Arguments = $Args
        WorkingDirectory = $WorkingDir
        OutputDirectory = $OutputDir
        StdoutPath = $StdoutPath
        StderrPath = $StderrPath
        SummaryPath = $RunSummaryPath
        StartupTimeoutMs = $StartupTimeoutMs
        ReadinessTimeoutMs = $ReadinessTimeoutMs
        OutputDrainTimeoutMs = $OutputDrainTimeoutMs
    }

    # Required Windows environment names
    $required = @('SystemRoot','WINDIR','ComSpec','PATH','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','ProgramData','ProgramFiles','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS')
    $missing = @()
    foreach ($v in $required) { if (-not [System.Environment]::GetEnvironmentVariable($v)) { $missing += $v } }
    if ($missing.Count -gt 0) {
        Write-Output ("V3: Missing required environment variables: {0}" -f ($missing -join ','))
        exit 92
    } else {
        Write-Output "V3: All required environment variables present"
    }

    # Write PRESTART and supporting prestart artifacts, then re-open to verify
    try {
        Write-Output ("V3: Writing PRESTART to {0}" -f $PRESTART)
        Write-JsonAscii $PRESTART $prestartObj
        Write-Output ("V3: PRESTART written")
        $raw = Get-Content -Path $PRESTART -Encoding ascii -ErrorAction Stop | Out-String
        $null = $raw | ConvertFrom-Json
        Write-Output ("V3: PRESTART parsed OK")
    } catch {
        Write-Output ("V3: PRESTART write/parse failed: {0}" -f $_)
        exit 91
    }

    # Parent env names
    $parentNames = Get-ChildItem Env: | Select-Object -ExpandProperty Name
    Write-JsonAscii $PARENT_ENV_NAMES $parentNames

    # Child env names (will be same prior to overrides)
    Write-JsonAscii $CHILD_ENV_NAMES $parentNames

    # Effective command
    $effective = @{ Command = ("{0} {1}" -f $NodeExe, $Args) }
    Write-JsonAscii $EFFECTIVE_COMMAND $effective

    # Prepare to start child process
    $process = New-Object System.Diagnostics.Process
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $NodeExe
    $psi.Arguments = $Args
    $psi.WorkingDirectory = $WorkingDir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    # Inherit parent environment variables into the child start info
    $envs = [System.Environment]::GetEnvironmentVariables()
    foreach ($k in $envs.Keys) { $psi.EnvironmentVariables[$k] = $envs[$k] }

    $process.StartInfo = $psi

    $startUtc = [DateTime]::UtcNow
    Write-Output ("V3: Starting child process: {0} {1}" -f $NodeExe, $Args)
    $started = $process.Start()
    if ($started) {
        Write-Output ("V3: Child process started, pid={0}" -f $process.Id)
        $rootPid = $process.Id
    } else {
        Write-Output "V3: Child process failed to start"
        $rootPid = $null
    }

    $readinessPassed = $false
    $startupTimedOut = $false

    # Startup wait
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while (-not $process.HasExited -and $sw.ElapsedMilliseconds -lt $StartupTimeoutMs) { Start-Sleep -Milliseconds 200 }
    if (-not $process.HasExited -and $sw.ElapsedMilliseconds -ge $StartupTimeoutMs) { $startupTimedOut = $true }

    # Readiness probe if provided
    if ($ReadinessUrl -ne "" -and -not $process.HasExited) {
        $rSw = [System.Diagnostics.Stopwatch]::StartNew()
        while (-not $process.HasExited -and $rSw.ElapsedMilliseconds -lt $ReadinessTimeoutMs) {
            try { $resp = Invoke-WebRequest -Uri $ReadinessUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue; if ($resp -and $resp.StatusCode -eq 200) { $readinessPassed = $true; break } } catch { }
            Start-Sleep -Milliseconds 500
        }
    }

    $outputDrainCompleted = $true

    # Wait a bounded time for graceful exit or drain output
    if (-not $process.HasExited) {
        $exited = $process.WaitForExit($OutputDrainTimeoutMs)
        if (-not $exited) {
            $outputDrainCompleted = $false
            # Terminate owned process tree
            if ($rootPid) {
                $pids = Get-ProcessTreePids $rootPid
                foreach ($childPid in $pids) { try { Stop-Process -Id $childPid -Force -ErrorAction SilentlyContinue } catch { } }
            }
            # Wait a little after termination
            $process.WaitForExit($OutputDrainTimeoutMs) | Out-Null
        }
    }

    $stdoutText = ""
    $stderrText = ""
    if ($process -ne $null) {
        try {
            $stdoutText = $process.StandardOutput.ReadToEnd()
        } catch { }
        try {
            $stderrText = $process.StandardError.ReadToEnd()
        } catch { }
    }
    $stdoutText | Out-File -FilePath $StdoutPath -Encoding ascii
    $stderrText | Out-File -FilePath $StderrPath -Encoding ascii

    # Process tree snapshot (record and detect alive pids)
    $procTree = @()
    $aliveCount = 0
    if ($rootPid) {
        $children = Get-ProcessTreePids $rootPid
        foreach ($id in $children) {
            $isAlive = $false
            try {
                $pObj = Get-Process -Id $id -ErrorAction SilentlyContinue
                if ($pObj) { $isAlive = $true; $aliveCount++ }
            } catch { }
            $procTree += @{ ProcessId = $id; IsAlive = $isAlive }
        }
    }
    Write-JsonAscii $ProcessTreePath $procTree

    # Port matrix placeholder (no active scan here)
    $ports = @()
    Write-JsonAscii $PortMatrixPath $ports

    # Compute hashes
    $stdoutSHA = SafeGetFileHash $StdoutPath
    $stderrSHA = SafeGetFileHash $StderrPath

    $endUtc = [DateTime]::UtcNow
    $durationMs = [int](([datetime]$endUtc - [datetime]$startUtc).TotalMilliseconds)

    $exitCode = $null
    try { $exitCode = $process.ExitCode } catch { $exitCode = $null }

    $startedBool = $started -eq $true
    $timedOutBool = $startupTimedOut -eq $true

    $statusToken = "APEX_GATEWAY_DIAGNOSTIC_V3_RUN_BLOCKED"
    $successToken = $null
    if ($startedBool -and ($exitCode -eq 0) -and ($ReadinessUrl -eq "" -or $readinessPassed)) { $statusToken = "APEX_GATEWAY_DIAGNOSTIC_V3_RUN_COMPLETED"; $successToken = $statusToken }

    $summary = @{
        RunId = $RunId
        ControllerSHA256 = $ControllerSHA256
        ControllerRuntime = "Windows PowerShell 5.1"
        NodeExe = $NodeExe
        NodeVersion = $null
        Command = ("{0} {1}" -f $NodeExe, $Args)
        WorkingDirectory = $WorkingDir
        RootPid = $rootPid
        ChildPids = ($procTree | ForEach-Object { $_.ProcessId })
        StartUtc = $startUtc.ToString("o")
        EndUtc = $endUtc.ToString("o")
        DurationMs = $durationMs
        Started = $startedBool
        TimedOut = $timedOutBool
        ReadinessChecked = ($ReadinessUrl -ne "")
        ReadinessPassed = $readinessPassed
        ExitCode = $exitCode
        StdoutSHA256 = $stdoutSHA
        StderrSHA256 = $stderrSHA
        StdoutBytes = ([System.Text.Encoding]::ASCII.GetByteCount($stdoutText))
        StderrBytes = ([System.Text.Encoding]::ASCII.GetByteCount($stderrText))
        OutputDrainCompleted = $outputDrainCompleted
        RemainingOwnedProcesses = $aliveCount
        RemainingOwnedListeners = 0
        SuccessToken = $successToken
        FailureTokens = @()
        ControllerException = $null
        Status = $statusToken
    }

    Write-JsonAscii $RunSummaryPath $summary
    Write-Output ("V3: Wrote run-summary to {0}" -f $RunSummaryPath)
    New-Item -Path $FinalMarker -ItemType File -Force | Out-Null
    Write-Output ("V3: Wrote final marker {0}" -f $FinalMarker)

    if ($summary.Status -eq "APEX_GATEWAY_DIAGNOSTIC_V3_RUN_COMPLETED") { exit 0 } else { exit 1 }

} catch {
    # Ensure we write a minimal summary and final marker on any exception
    try {
        $err = $_.ToString()
        $errorSummary = @{ RunId = $RunId; ControllerException = $err; Status = "APEX_GATEWAY_DIAGNOSTIC_V3_RUN_BLOCKED" }
        Write-JsonAscii $RunSummaryPath $errorSummary
        New-Item -Path $FinalMarker -ItemType File -Force | Out-Null
    } catch { }
    exit 1
}
