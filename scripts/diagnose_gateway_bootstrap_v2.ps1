param(
    [string]$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source,
    [string]$Args = '',
    [string]$WorkingDir = (Get-Location).Path,
    [string]$EnvOverridesJson = '',
    [int]$StartupTimeoutMs = 120000,
    [string]$ReadinessUrl = '',
    [int]$ReadinessTimeoutMs = 30000,
    [int]$OutputDrainTimeoutMs = 5000,
    [string]$OutputRoot = ''
)

if ([string]::IsNullOrEmpty($NodeExe)) {
    Write-Error "Node executable not found. Provide -NodeExe explicitly."
    exit 2
}

if ([string]::IsNullOrEmpty($OutputRoot)) {
    $OutputRoot = Join-Path $PSScriptRoot "..\.pma\implementation\full-feature-restoration-green-closure-v1"
}

if (-not (Test-Path $OutputRoot)) { New-Item -Path $OutputRoot -ItemType Directory -Force | Out-Null }

$requiredVars = @('SystemRoot','WINDIR','ComSpec','PATH','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','ProgramData','ProgramFiles','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS')
$missing = @()
foreach ($v in $requiredVars) {
    $val = [System.Environment]::GetEnvironmentVariable($v)
    if ([string]::IsNullOrEmpty($val)) { $missing += $v }
}
if ($missing.Count -gt 0) {
    $err = [pscustomobject]@{ Error = 'MissingRequiredWindowsEnvironmentVariables'; Missing = $missing }
    $err | ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $OutputRoot 'diagnose_v2_preflight_error.json') -Encoding utf8
    exit 3
}

$runId = [guid]::NewGuid().ToString('N')
$outDir = Join-Path $OutputRoot ("v2-run-$runId")
New-Item -Path $outDir -ItemType Directory -Force | Out-Null

$stdoutPath = Join-Path $outDir 'stdout.log'
$stderrPath = Join-Path $outDir 'stderr.log'

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $NodeExe
$psi.Arguments = $Args
$psi.WorkingDirectory = $WorkingDir
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

# Inherit parent environment explicitly (do not Clear)
$parentEnv = [System.Environment]::GetEnvironmentVariables()
foreach ($k in $parentEnv.Keys) {
    $v = $parentEnv[$k]
    if ($psi.EnvironmentVariables.ContainsKey($k)) { $psi.EnvironmentVariables[$k] = $v } else { $psi.EnvironmentVariables.Add($k, $v) }
}

# Apply child-only overrides if provided as JSON string
if (-not [string]::IsNullOrEmpty($EnvOverridesJson)) {
    try { $over = $EnvOverridesJson | ConvertFrom-Json -ErrorAction Stop } catch { $over = $null }
    if ($over -ne $null) {
        foreach ($p in $over.PSObject.Properties) {
            $k = $p.Name; $v = [string]$p.Value
            if ($psi.EnvironmentVariables.ContainsKey($k)) { $psi.EnvironmentVariables[$k] = $v } else { $psi.EnvironmentVariables.Add($k,$v) }
        }
    }
}

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi

$outSb = New-Object System.Text.StringBuilder
$errSb = New-Object System.Text.StringBuilder

$stdOutHandler = [System.Diagnostics.DataReceivedEventHandler]{ param($s,$e) if ($e.Data -ne $null) { $outSb.AppendLine($e.Data) | Out-Null } }
$stdErrHandler = [System.Diagnostics.DataReceivedEventHandler]{ param($s,$e) if ($e.Data -ne $null) { $errSb.AppendLine($e.Data) | Out-Null } }

$proc.add_OutputDataReceived($stdOutHandler)
$proc.add_ErrorDataReceived($stdErrHandler)

$startUtc = [DateTime]::UtcNow.ToString('o')

$started = $false
try {
    $started = $proc.Start()
} catch {
    $err = $_.Exception.Message
    $summary = [pscustomobject]@{ RunId=$runId; StartUtc=$startUtc; Error=$err }
    $summary | ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $outDir 'run-summary.json') -Encoding utf8
    exit 4
}

if ($started) {
    $proc.BeginOutputReadLine(); $proc.BeginErrorReadLine()
} else {
    $summary = [pscustomobject]@{ RunId=$runId; StartUtc=$startUtc; Error='ProcessStartFailed' }
    $summary | ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $outDir 'run-summary.json') -Encoding utf8
    exit 5
}

$readinessOk = $false
if (-not [string]::IsNullOrEmpty($ReadinessUrl)) {
    $deadline = (Get-Date).AddMilliseconds($ReadinessTimeoutMs)
    while ((Get-Date) -lt $deadline) {
        if ($proc.HasExited) { break }
        try { $r = Invoke-WebRequest -Uri $ReadinessUrl -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { $readinessOk = $true; break } } catch { }
        Start-Sleep -Milliseconds 500
    }
}

# Wait for process exit up to StartupTimeoutMs
$startDeadline = (Get-Date).AddMilliseconds($StartupTimeoutMs)
while ((Get-Date) -lt $startDeadline) {
    if ($proc.HasExited) { break }
    Start-Sleep -Milliseconds 200
}

$timedOut = $false
if (-not $proc.HasExited) {
    $timedOut = $true
    try { & taskkill /PID $proc.Id /T /F > $null 2>&1 } catch { }
}

# Allow output drain
Start-Sleep -Milliseconds $OutputDrainTimeoutMs

$endUtc = [DateTime]::UtcNow.ToString('o')

# Write captured output to files
[System.IO.File]::WriteAllText($stdoutPath, $outSb.ToString(), [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($stderrPath, $errSb.ToString(), [System.Text.Encoding]::UTF8)

$exitCode = $null
if ($proc.HasExited) { $exitCode = $proc.ExitCode } else { $exitCode = -1 }

$summary = [pscustomobject]@{
    RunId = $runId
    StartUtc = $startUtc
    EndUtc = $endUtc
    Pid = $proc.Id
    ExitCode = $exitCode
    TimedOut = $timedOut
    ReadinessOk = $readinessOk
    StdoutPath = $stdoutPath
    StderrPath = $stderrPath
    StartTimeoutOccurred = $timedOut
    WorkingDirectory = $WorkingDir
    NodePath = $NodeExe
    Args = $Args
}

$summaryPath = Join-Path $outDir 'run-summary.json'
$summary | ConvertTo-Json -Depth 10 | Out-File -FilePath $summaryPath -Encoding utf8

Write-Output $summaryPath
