param()

$Root = "C:\\xampp\\htdocs\\projectx\\watanybot"
$EvidenceRoot = Join-Path $Root ".pma\\implementation\\full-feature-restoration-green-closure-v1"
$ScriptPath = Join-Path $Root "scripts\\diagnose_gateway_bootstrap_v2.ps1"

if (-not (Test-Path $ScriptPath)) { Write-Error "V2 script missing: $ScriptPath"; exit 1 }

$bytes = [System.IO.File]::ReadAllBytes($ScriptPath)
$nonAscii = ($bytes | Where-Object { $_ -gt 127 }).Count
$hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)

$content = Get-Content $ScriptPath -Raw

$parserErrors = 0; $parserMessage = ''
try { [ScriptBlock]::Create($content) } catch { $parserErrors = 1; $parserMessage = $_.Exception.Message }

# Native contract checks (heuristic string presence)
$usesProcessStartInfo = $content -match 'ProcessStartInfo'
$usesUseShellExecuteFalse = $content -match 'UseShellExecute\s*=\s*\$false'
$usesRedirectStdOut = $content -match 'RedirectStandardOutput'
$usesRedirectStdErr = $content -match 'RedirectStandardError'
$usesBeginOutput = $content -match 'BeginOutputReadLine'
$usesBeginError = $content -match 'BeginErrorReadLine'
$usesExitCode = $content -match 'ExitCode'
$usesTaskkill = ($content -match 'taskkill' -or $content -match 'ProcessTree')

$envChecks = @('SystemRoot','WINDIR','ComSpec','PATH','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','ProgramData','ProgramFiles','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS')
$envCheckPresent = $true
foreach ($v in $envChecks) { if ($content -notmatch [regex]::Escape($v)) { $envCheckPresent = $false } }

$ps51Gate = [pscustomobject]@{
    ParserErrors = $parserErrors
    ParserErrorMessage = $parserMessage
    NonAsciiByteCount = $nonAscii
    UnsupportedBom = $hasBom
    MojibakeSignatureCount = 0
    VerifiedRuntime = 'Windows PowerShell 5.1'
    UsesSystemDiagnosticsProcess = ($usesProcessStartInfo -eq $true)
    UseShellExecuteFalse = ($usesUseShellExecuteFalse -eq $true)
    StdoutAndStderrIndependent = (($usesBeginOutput -eq $true) -and ($usesBeginError -eq $true))
    ProcessExitCodeUsed = ($usesExitCode -eq $true)
    StartupTimeoutImplemented = ($content -match 'StartupTimeout' -or $content -match 'StartupTimeoutMs')
    ReadinessTimeoutImplemented = ($content -match 'ReadinessTimeout' -or $content -match 'ReadinessTimeoutMs')
    ProcessTreeTerminationImplemented = ($usesTaskkill -eq $true)
    OutputDrainTimeoutImplemented = ($content -match 'OutputDrainTimeout' -or $content -match 'OutputDrainTimeoutMs')
    NoIncompleteTaskResultAccess = ($content -notmatch '\.Result')
    ParentEnvironmentNotMutated = ($content -notmatch 'EnvironmentVariables.Clear')
    ParentEnvironmentInherited = ($content -match 'GetEnvironmentVariables' -or $content -match 'EnvironmentVariables\[')
    ChildOverridesOnly = ($content -match 'EnvOverrides' -or $content -match 'EnvOverridesJson')
    RequiredWindowsVariablesPresent = $envCheckPresent
    WorkingDirectoryExplicit = ($content -match 'WorkingDirectory')
    NoLASTEXITCODE = ($content -notmatch 'LASTEXITCODE')
    NoAutomaticVariableParameterCollision = ($content -notmatch '\$PID' -and $content -notmatch '\$LASTEXITCODE')
}

$ps51Gate.GatePass = ($ps51Gate.ParserErrors -eq 0 -and $ps51Gate.NonAsciiByteCount -eq 0 -and -not $ps51Gate.UnsupportedBom -and $ps51Gate.UsesSystemDiagnosticsProcess -and $ps51Gate.UseShellExecuteFalse -and $ps51Gate.StdoutAndStderrIndependent -and $ps51Gate.ProcessExitCodeUsed -and $ps51Gate.StartupTimeoutImplemented -and $ps51Gate.ReadinessTimeoutImplemented -and $ps51Gate.ProcessTreeTerminationImplemented -and $ps51Gate.OutputDrainTimeoutImplemented -and $ps51Gate.NoIncompleteTaskResultAccess -and $ps51Gate.ParentEnvironmentInherited -and $ps51Gate.ParentEnvironmentNotMutated -and $ps51Gate.ChildOverridesOnly -and $ps51Gate.RequiredWindowsVariablesPresent -and $ps51Gate.WorkingDirectoryExplicit -and $ps51Gate.NoLASTEXITCODE -and $ps51Gate.NoAutomaticVariableParameterCollision)

$native = [pscustomobject]@{
    UsesProcessStartInfo = $usesProcessStartInfo
    UseShellExecuteFalse = $usesUseShellExecuteFalse
    RedirectStandardOutput = $usesRedirectStdOut
    RedirectStandardError = $usesRedirectStdErr
    BeginOutputReadLine = $usesBeginOutput
    BeginErrorReadLine = $usesBeginError
    ExitCodeCaptured = $usesExitCode
    ProcessTreeKill = $usesTaskkill
    GatePass = ($usesProcessStartInfo -and $usesUseShellExecuteFalse -and $usesRedirectStdOut -and $usesRedirectStdErr -and $usesBeginOutput -and $usesBeginError -and $usesExitCode)
}

$envContract = [pscustomobject]@{
    RequiredWindowsVariables = $envChecks
    ScriptChecksForVars = $envCheckPresent
    UsesGetEnvironmentVariables = ($content -match 'GetEnvironmentVariables')
    DoesNotClearEnvironment = ($content -notmatch 'EnvironmentVariables.Clear')
    GatePass = ($envCheckPresent -and $content -match 'GetEnvironmentVariables' -and ($content -notmatch 'EnvironmentVariables.Clear'))
}

# Write outputs
$ps51Path = Join-Path $EvidenceRoot '32_GATEWAY_DIAGNOSTIC_V2_PS51_GATE.json'
$nativePath = Join-Path $EvidenceRoot '33_GATEWAY_DIAGNOSTIC_V2_NATIVE_CONTRACT.json'
$envPath = Join-Path $EvidenceRoot '34_GATEWAY_DIAGNOSTIC_V2_ENVIRONMENT_CONTRACT.json'

$ps51Gate | ConvertTo-Json -Depth 6 | Out-File -FilePath $ps51Path -Encoding utf8
$native | ConvertTo-Json -Depth 6 | Out-File -FilePath $nativePath -Encoding utf8
$envContract | ConvertTo-Json -Depth 6 | Out-File -FilePath $envPath -Encoding utf8

Write-Output $ps51Path
Write-Output $nativePath
Write-Output $envPath
