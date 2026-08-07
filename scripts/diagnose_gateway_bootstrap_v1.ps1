function Get-FreeTcpPort {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback,0)
  $listener.Start()
  $port = ($listener.LocalEndpoint).Port
  $listener.Stop()
  return $port
}

function Stop-ProcessTree {
  param([int]$TargetPid)
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$TargetPid" -ErrorAction SilentlyContinue
  foreach ($c in $children) { Stop-ProcessTree -TargetPid $c.ProcessId }
  try { Stop-Process -Id $TargetPid -Force -ErrorAction SilentlyContinue } catch {}
}

function Start-ChildProcess {
  param(
    [string]$FilePath,
    [string]$Arguments,
    [string]$WorkingDirectory,
    [hashtable]$EnvVars,
    [int]$StartupTimeoutMs = 120000,
    [string]$ReadinessUrl = $null,
    [int]$ReadinessTimeoutMs = 30000,
    [int]$OutputDrainTimeoutMs = 5000
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  $psi.Arguments = $Arguments
  $psi.WorkingDirectory = $WorkingDirectory
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true

  # Preserve parent environment; override/add only provided env vars.
  # Clearing the entire environment can remove essential system variables
  # (PATH, SystemRoot, etc.) and cause native binaries like node.exe
  # to fail during startup (observed CSPRNG/OpenSSL assertion).
  foreach ($k in $EnvVars.Keys) { $psi.EnvironmentVariables[$k] = $EnvVars[$k] }

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi

  $started = $proc.Start()
  if (-not $started) { throw "Process failed to start" }
  $startUtc = (Get-Date).ToUniversalTime().ToString('o')

  $readinessOk = $false
  if ($ReadinessUrl) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.ElapsedMilliseconds -lt $ReadinessTimeoutMs) {
      try {
        $wc = New-Object System.Net.WebClient
        $wc.DownloadString($ReadinessUrl) > $null
        $readinessOk = $true
        break
      } catch {}
      Start-Sleep -Milliseconds 500
    }
  }

  $procExited = $proc.WaitForExit($StartupTimeoutMs)
  if (-not $procExited) {
    Start-Sleep -Milliseconds $OutputDrainTimeoutMs
    Stop-ProcessTree -Pid $proc.Id
    $proc.WaitForExit(5000) | Out-Null
  }

  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  $exitCode = $proc.ExitCode

  return [pscustomobject]@{
    pid = $proc.Id
    startUtc = $startUtc
    exitCode = $exitCode
    stdout = $stdout
    stderr = $stderr
    readinessOk = $readinessOk
    startTimeoutOccurred = -not $procExited
  }
}

function Invoke-GatewayDiagnostic {
  param(
    [string]$NodeExe,
    [string]$Args,
    [string]$WorkingDir,
    [hashtable]$Env,
    [int]$StartupTimeoutMs = 120000,
    [string]$ReadinessUrl = $null,
    [int]$ReadinessTimeoutMs = 30000,
    [int]$OutputDrainTimeoutMs = 5000
  )
  return Start-ChildProcess -FilePath $NodeExe -Arguments $Args -WorkingDirectory $WorkingDir -EnvVars $Env -StartupTimeoutMs $StartupTimeoutMs -ReadinessUrl $ReadinessUrl -ReadinessTimeoutMs $ReadinessTimeoutMs -OutputDrainTimeoutMs $OutputDrainTimeoutMs
}

Write-Output "diagnose_gateway_bootstrap_v1.ps1 created. Use Invoke-GatewayDiagnostic to run diagnostics."