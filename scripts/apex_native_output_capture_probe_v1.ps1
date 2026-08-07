param(
    [string]$OutputRoot = ".\\.pma\\implementation\\v3-output-capture-full-rank-salary-green-continuation-v4",
    [int]$TimeoutMs = 10000
)

Write-Output "APEX_CAPTURE_PROBE_START"
Write-Output ("OutputRoot=" + $OutputRoot)

function Ensure-Dir($path) { if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null } }

function Run-Proc([string]$name, [string]$exe, [string]$args) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.Arguments = $args
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WorkingDirectory = (Get-Location).Path

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi

    $stdout = New-Object System.Text.StringBuilder
    $stderr = New-Object System.Text.StringBuilder

    $outputHandler = [System.Diagnostics.DataReceivedEventHandler]{ param($sender,$e) if ($e.Data -ne $null) { [void]$stdout.AppendLine($e.Data) } }
    $errorHandler = [System.Diagnostics.DataReceivedEventHandler]{ param($sender,$e) if ($e.Data -ne $null) { [void]$stderr.AppendLine($e.Data) } }

    $proc.add_OutputDataReceived($outputHandler)
    $proc.add_ErrorDataReceived($errorHandler)

    $proc.Start() | Out-Null
    $proc.BeginOutputReadLine()
    $proc.BeginErrorReadLine()

    $exited = $proc.WaitForExit($TimeoutMs)
    if (-not $exited) {
        Start-Process -FilePath taskkill -ArgumentList '/PID',$proc.Id,'/T','/F' -NoNewWindow -Wait | Out-Null
        $proc.WaitForExit(2000) | Out-Null
    }

    try {
        $rem = $proc.StandardOutput.ReadToEnd()
        if ($rem -ne $null -and $rem -ne '') { $stdout.AppendLine($rem) | Out-Null }
    } catch { }
    try {
        $remErr = $proc.StandardError.ReadToEnd()
        if ($remErr -ne $null -and $remErr -ne '') { $stderr.AppendLine($remErr) | Out-Null }
    } catch { }

    $exitCode = $null
    try { $exitCode = $proc.ExitCode } catch { $exitCode = -1 }

    return [PSCustomObject]@{
        Name = $name
        ExitCode = $exitCode
        Stdout = $stdout.ToString()
        Stderr = $stderr.ToString()
        TimedOut = -not $exited
        Pid = $proc.Id
    }
}

Ensure-Dir -path $OutputRoot

$tests = @()
$tests += @{ Name='A-FastCmd'; Exe='C:\\Windows\\System32\\cmd.exe'; Args='/d /s /c "echo APEX_CAPTURE_CMD_FAST_PASS"' }
$tests += @{ Name='B-PowerShellOutErr'; Exe='powershell.exe'; Args='-NoLogo -NoProfile -Command "Write-Output ''APEX_CAPTURE_PS_OUT_PASS''; [Console]::Error.WriteLine(''APEX_CAPTURE_PS_ERR_PASS'')"' }
$tests += @{ Name='C-DelayedStdout'; Exe='powershell.exe'; Args='-NoLogo -NoProfile -Command "Write-Output ''APEX_CAPTURE_FIRST''; Start-Sleep -Milliseconds 500; Write-Output ''APEX_CAPTURE_LAST''"' }
$tests += @{ Name='D-HighVolume'; Exe='powershell.exe'; Args='-NoLogo -NoProfile -Command "for ($i=1;$i -le 1000;$i++) { Write-Output (''OUT:'' + $i) }; for ($i=1;$i -le 100;$i++) { [Console]::Error.WriteLine((''ERR:'' + $i)) }"' }
$tests += @{ Name='E-NonZeroExit'; Exe='C:\\Windows\\System32\\cmd.exe'; Args='/d /s /c "echo APEX_CAPTURE_FAIL_OUT & echo APEX_CAPTURE_FAIL_ERR 1>&2 & exit /b 7"' }

$results = @()

foreach ($t in $tests) {
    for ($iter=1; $iter -le 2; $iter++) {
        $res = Run-Proc -name $t.Name -exe $t.Exe -args $t.Args
        $runDir = Join-Path $OutputRoot ($t.Name + "-run-" + [guid]::NewGuid().ToString())
        New-Item -ItemType Directory -Path $runDir -Force | Out-Null
        $res.Stdout | Out-File -FilePath (Join-Path $runDir 'stdout.log') -Encoding utf8
        $res.Stderr | Out-File -FilePath (Join-Path $runDir 'stderr.log') -Encoding utf8
        $res | ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $runDir 'run-summary.json') -Encoding utf8
        $results += $res
    }
}

$passCount = 0
foreach ($r in $results) {
    $ok = $true
    switch ($r.Name) {
        'A-FastCmd' { $ok = $r.ExitCode -eq 0 -and $r.Stdout -match 'APEX_CAPTURE_CMD_FAST_PASS' }
        'B-PowerShellOutErr' { $ok = $r.ExitCode -eq 0 -and $r.Stdout -match 'APEX_CAPTURE_PS_OUT_PASS' -and $r.Stderr -match 'APEX_CAPTURE_PS_ERR_PASS' }
        'C-DelayedStdout' { $ok = $r.ExitCode -eq 0 -and $r.Stdout -match 'APEX_CAPTURE_FIRST' -and $r.Stdout -match 'APEX_CAPTURE_LAST' }
        'D-HighVolume' { $ok = $r.ExitCode -eq 0 -and ($r.Stdout -split "`n").Count -ge 1000 -and ($r.Stderr -split "`n").Count -ge 100 }
        'E-NonZeroExit' { $ok = $r.ExitCode -eq 7 -and $r.Stdout -match 'APEX_CAPTURE_FAIL_OUT' -and $r.Stderr -match 'APEX_CAPTURE_FAIL_ERR' }
    }
    if ($ok) { $passCount++ }
}

$matrix = [PSCustomObject]@{
    TotalRuns = $results.Count
    PassedRuns = $passCount
    RequiredPasses = $tests.Count * 2
    Passed = ($passCount -eq $tests.Count * 2)
}

$matrix | ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $OutputRoot '06_NATIVE_OUTPUT_CAPTURE_MATRIX.json') -Encoding utf8

Write-Output "Probe complete. Passed: $($matrix.Passed)"
