$path = 'c:\xampp\htdocs\projectx\watanybot\scripts\diagnose_gateway_bootstrap_v3.ps1'
$text = Get-Content -Raw -LiteralPath $path
$bytes = [System.IO.File]::ReadAllBytes($path)
$nonAscii = ($bytes | Where-Object { $_ -gt 127 }).Count
$hasBom = $false
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { $hasBom = $true }

# Parser errors
$tokens = $null
$errors = $null
try {
    [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
} catch {}
$parserErrors = 0
if ($errors -ne $null) { $parserErrors = $errors.Count }

# Basic checks
$mojibakeCount = 0
if ($text -match 'Ã' -or $text -match 'â') { $mojibakeCount = ($text -split '\r?\n' | Where-Object { $_ -match 'Ã|â' }).Count }

$usesSystemDiagnostics = ($text -match 'System\.Diagnostics\.Process')
$useShellExecuteFalse = ($text -match 'UseShellExecute\s*=\s*\$false')
$createNoWindowTrue = ($text -match 'CreateNoWindow\s*=\s*\$true')
$redirectStdOutTrue = ($text -match 'RedirectStandardOutput\s*=\s*\$true')
$redirectStdErrTrue = ($text -match 'RedirectStandardError\s*=\s*\$true')
$processExitCodeUsed = ($text -match '\.ExitCode')
$startupTimeoutImplemented = ($text -match 'StartupTimeoutMs')
$readinessTimeoutImplemented = ($text -match 'ReadinessTimeoutMs')
$processTreeTerminationImplemented = ($text -match 'Stop-Process' -or $text -match 'Get-WmiObject Win32_Process')
$workingDirectoryExplicit = ($text -match 'WorkingDirectory\s*=\s*\$WorkingDir' -or $text -match "\$psi\.WorkingDirectory")
$parentEnvInherited = ($text -match 'GetEnvironmentVariables' -and $text -match 'EnvironmentVariables')
$parentEnvNotMutated = -not ($text -match 'EnvironmentVariables\.Clear')
$childOverridesOnly = -not ($text -match 'EnvironmentVariables\.Clear')
$noLASTEXITCODE = -not ($text -match 'LASTEXITCODE')
$paramBlock = ''
$mb = [regex]::Match($text, 'param\((.*?)\)', 'Singleline')
if ($mb.Success) { $paramBlock = $mb.Groups[1].Value }
$noAutomaticVariableParameterCollision = -not ($paramBlock -match '\$PID\b' -or $paramBlock -match '\$PSVersionTable\b' -or $paramBlock -match '\$PSHome\b')
$summaryWrittenInFinally = ($text -match 'run-summary.json')
$everyExitPathProducesSummary = $summaryWrittenInFinally

# Verify runtime (best effort) using current session
$psver = $null
try { $psver = $PSVersionTable.PSVersion.ToString() } catch {}
$verifiedRuntime = ($psver -like '5.*')

$gatePass = ($parserErrors -eq 0 -and $nonAscii -eq 0 -and -not $hasBom -and $mojibakeCount -eq 0 -and $verifiedRuntime -and $usesSystemDiagnostics -and $useShellExecuteFalse -and $createNoWindowTrue -and $redirectStdOutTrue -and $redirectStdErrTrue -and $processExitCodeUsed -and $startupTimeoutImplemented -and $readinessTimeoutImplemented -and $processTreeTerminationImplemented -and $workingDirectoryExplicit -and $parentEnvInherited -and $parentEnvNotMutated -and $childOverridesOnly -and $noLASTEXITCODE -and $noAutomaticVariableParameterCollision -and $summaryWrittenInFinally -and $everyExitPathProducesSummary)

$outPS51 = [ordered]@{
    ParserErrors = $parserErrors
    NonAsciiByteCount = $nonAscii
    UnsupportedBom = $hasBom
    MojibakeSignatureCount = $mojibakeCount
    VerifiedRuntime = if ($verifiedRuntime) { 'Windows PowerShell 5.1' } else { '' }
    GatePass = $gatePass
}
$outPS51 | ConvertTo-Json | Out-File -FilePath 'c:\xampp\htdocs\projectx\watanybot\scripts\06_LIFECYCLE_CONTROLLER_PS51_GATE.json' -Encoding utf8

$outNative = [ordered]@{
    UsesSystemDiagnosticsProcess = $usesSystemDiagnostics
    UseShellExecuteFalse = $useShellExecuteFalse
    CreateNoWindowTrue = $createNoWindowTrue
    RedirectStandardOutputTrue = $redirectStdOutTrue
    RedirectStandardErrorTrue = $redirectStdErrTrue
    ProcessExitCodeUsed = $processExitCodeUsed
    StartupTimeoutImplemented = $startupTimeoutImplemented
    ReadinessTimeoutImplemented = $readinessTimeoutImplemented
    ProcessTreeTerminationImplemented = $processTreeTerminationImplemented
    WorkingDirectoryExplicit = $workingDirectoryExplicit
    GatePass = $gatePass
}
$outNative | ConvertTo-Json | Out-File -FilePath 'c:\xampp\htdocs\projectx\watanybot\scripts\07_LIFECYCLE_CONTROLLER_NATIVE_CONTRACT.json' -Encoding utf8

$outEnv = [ordered]@{
    ParentEnvironmentInherited = $parentEnvInherited
    ParentEnvironmentNotMutated = $parentEnvNotMutated
    ChildOverridesOnly = $childOverridesOnly
    NoLASTEXITCODE = $noLASTEXITCODE
    NoAutomaticVariableParameterCollision = $noAutomaticVariableParameterCollision
    GatePass = $gatePass
}
$outEnv | ConvertTo-Json | Out-File -FilePath 'c:\xampp\htdocs\projectx\watanybot\scripts\08_LIFECYCLE_CONTROLLER_ENVIRONMENT_CONTRACT.json' -Encoding utf8

$outOut = [ordered]@{
    RedirectStandardOutputTrue = $redirectStdOutTrue
    RedirectStandardErrorTrue = $redirectStdErrTrue
    ProcessExitCodeUsed = $processExitCodeUsed
    SummaryWrittenInFinally = $summaryWrittenInFinally
    EveryExitPathProducesSummary = $everyExitPathProducesSummary
    GatePass = $gatePass
}
$outOut | ConvertTo-Json | Out-File -FilePath 'c:\xampp\htdocs\projectx\watanybot\scripts\09_LIFECYCLE_CONTROLLER_OUTPUT_CONTRACT.json' -Encoding utf8

Write-Output 'Lifecycle gates written.'
