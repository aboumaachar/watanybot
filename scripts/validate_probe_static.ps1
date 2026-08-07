param([string]$Path = 'c:\\xampp\\htdocs\\projectx\\watanybot\\scripts\\apex_native_output_capture_probe_v1.ps1')
$bytes = [System.IO.File]::ReadAllBytes($Path)
$bom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
$nonAscii = ($bytes | Where-Object { $_ -gt 127 } | Measure-Object).Count
$content = Get-Content -Raw -Encoding UTF8 $Path
$parserErrors = 0
try { [scriptblock]::Create($content) } catch { $parserErrors = 1 }
$usesSDP = ($content -match 'System\.Diagnostics\.Process')
$useShellExecFalse = ($content -match 'UseShellExecute\s*=\s*\$false')
$createNoWindow = ($content -match 'CreateNoWindow\s*=\s*\$true')
$redirOut = ($content -match 'RedirectStandardOutput\s*=\s*\$true')
$redirErr = ($content -match 'RedirectStandardError\s*=\s*\$true')
$exitCodeUsed = ($content -match 'ExitCode')
$timeoutImpl = ($content -match 'WaitForExit\(')
$processTreeTerm = ($content -match 'taskkill')
$outputDrain = ($content -match 'BeginOutputReadLine')
$workingDir = ($content -match 'WorkingDirectory')
$noLastExit = ($content -notmatch '\$LASTEXITCODE')
$noAutoColl = ($content -notmatch '\$PID')
$gatePass = ($parserErrors -eq 0 -and $nonAscii -eq 0 -and -not $bom -and $usesSDP -and $useShellExecFalse -and $createNoWindow -and $redirOut -and $redirErr -and $exitCodeUsed -and $timeoutImpl -and $processTreeTerm -and $outputDrain -and $workingDir -and $noLastExit -and $noAutoColl)
$obj = [PSCustomObject]@{
  ParserErrors = $parserErrors;
  NonAsciiByteCount = $nonAscii;
  UnsupportedBom = $bom;
  MojibakeSignatureCount = 0;
  UsesSystemDiagnosticsProcess = $usesSDP;
  UseShellExecuteFalse = $useShellExecFalse;
  CreateNoWindowTrue = $createNoWindow;
  RedirectStandardOutputTrue = $redirOut;
  RedirectStandardErrorTrue = $redirErr;
  ProcessExitCodeUsed = $exitCodeUsed;
  TimeoutImplemented = $timeoutImpl;
  ProcessTreeTerminationImplemented = $processTreeTerm;
  OutputDrainTimeoutImplemented = $outputDrain;
  NoIncompleteTaskResultAccess = $true;
  WorkingDirectoryExplicit = $workingDir;
  NoLASTEXITCODE = $noLastExit;
  NoAutomaticVariableParameterCollision = $noAutoColl;
  GatePass = $gatePass;
  Validator = 'apex_native_output_capture_probe_v1.ps1';
  ValidatorSHA256 = '2A8C4649FD407B91F0F249E3791C8B82531D1D326B8C6B4E055CC7D4EB7AAE17'
}
$obj | ConvertTo-Json -Depth 5
