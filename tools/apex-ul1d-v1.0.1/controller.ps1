[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][ValidateSet('audit', 'install')][string]$Mode,
    [Parameter(Mandatory = $true)][string]$OwnerApprovalToken
)

$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sessionId = 'ul1d-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + ([guid]::NewGuid().ToString('N').Substring(0, 8))
$evidenceRoot = Join-Path $packageRoot ('evidence\' + $sessionId)
New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null
$commands = New-Object System.Collections.Generic.List[object]
$failures = New-Object System.Collections.Generic.List[string]

function Write-Json([string]$Name, [object]$Value) {
    $Value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $evidenceRoot $Name) -Encoding UTF8
}

function Add-Failure([string]$Message) { $failures.Add($Message) }

function Quote-Arg([string]$Value) {
    return '"' + ($Value -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"'
}

function Invoke-Captured([string]$FilePath, [string[]]$ArgumentList, [string]$Name, [string]$WorkingDirectory) {
    $stdoutPath = Join-Path $evidenceRoot ($Name + '.stdout.log')
    $stderrPath = Join-Path $evidenceRoot ($Name + '.stderr.log')
    $arguments = ($ArgumentList | ForEach-Object { Quote-Arg $_ }) -join ' '
    $start = [DateTime]::UtcNow
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = New-Object System.Diagnostics.ProcessStartInfo
    $process.StartInfo.FileName = $FilePath
    $process.StartInfo.Arguments = $arguments
    $process.StartInfo.WorkingDirectory = $WorkingDirectory
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    $process.StartInfo.CreateNoWindow = $true
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    $stdout | Set-Content -LiteralPath $stdoutPath -Encoding UTF8
    $stderr | Set-Content -LiteralPath $stderrPath -Encoding UTF8
    $record = [pscustomobject]@{ name = $Name; command = $FilePath; args = $ArgumentList; exitCode = $process.ExitCode; stdout = $stdoutPath; stderr = $stderrPath; startedAtUtc = $start.ToString('o'); durationMs = ([DateTime]::UtcNow - $start).TotalMilliseconds }
    $commands.Add($record)
    return $record
}

$workspace = (Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop).Path
$powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$preflight = Invoke-Captured $powershellExe @('-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $packageRoot 'preflight.ps1'), '-ProjectRoot', $workspace, '-PackageRoot', $packageRoot, '-Mode', $Mode) 'preflight' $workspace
if ($preflight.exitCode -ne 0) { Add-Failure 'preflight' }

$tokenOk = -not [string]::IsNullOrWhiteSpace($OwnerApprovalToken)
if (-not $tokenOk) { Add-Failure 'owner approval token is empty' }
$modeOk = $Mode -in @('audit', 'install')
if (-not $modeOk) { Add-Failure 'mode is invalid' }

if ($failures.Count -eq 0 -and $Mode -eq 'install') {
    $runtimeZip = Join-Path $packageRoot 'runtime\ul1d-canonical-runtime.zip'
    $extractRoot = Join-Path $evidenceRoot 'runtime-extracted'
    Expand-Archive -LiteralPath $runtimeZip -DestinationPath $extractRoot -Force
    $canonicalRoot = Join-Path $workspace 'apps\web-user\public\data\location\canonical'
    $docsRoot = Join-Path $workspace 'docs\location\canonical-dataset'
    New-Item -ItemType Directory -Force -Path $canonicalRoot, $docsRoot | Out-Null
    Copy-Item -LiteralPath (Join-Path $extractRoot 'public\data\location\canonical\*') -Destination $canonicalRoot -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $extractRoot 'docs\location\canonical-dataset\*') -Destination $docsRoot -Recurse -Force
}

if ($failures.Count -eq 0) {
    $typecheck = Invoke-Captured 'pnpm.cmd' @('--dir', (Join-Path $workspace 'apps\web-user'), 'exec', 'tsc', '--noEmit') 'typecheck' $workspace
    if ($typecheck.exitCode -ne 0) { Add-Failure 'typecheck' }
    $build = Invoke-Captured 'pnpm.cmd' @('--dir', (Join-Path $workspace 'apps\web-user'), 'build') 'build' $workspace
    if ($build.exitCode -ne 0) { Add-Failure 'build' }
} else {
    Add-Failure 'installation and project validation skipped because a required gate failed'
}

$commandsArray = $commands.ToArray()
$hashes = [pscustomobject]@{ generatedAtUtc = [DateTime]::UtcNow.ToString('o'); files = @() }
$summary = [pscustomobject]@{
    schema = 'ul1d-summary-v1'
    package = 'APEX WATANYBOT UL1D V1.0.1'
    sessionId = $sessionId
    mode = $Mode
    status = if ($failures.Count -eq 0) { 'PASS' } else { 'BLOCKED' }
    failures = @($failures)
    evidenceRoot = $evidenceRoot
    generatedAtUtc = [DateTime]::UtcNow.ToString('o')
}
Write-Json 'commands.json' $commandsArray
Write-Json 'hashes.json' $hashes
Write-Json 'summary.json' $summary
Write-Json 'runtime-validation.json' ([pscustomobject]@{ status = if ($failures.Count -eq 0) { 'UNVERIFIED' } else { 'BLOCKED' }; reason = 'Runtime validation requires an approved canonical dataset and browser harness.' })
Write-Json 'locator-validation.json' ([pscustomobject]@{ status = if ($failures.Count -eq 0) { 'UNVERIFIED' } else { 'BLOCKED' }; required = @{ governorates = 8; officialDistricts = 25; beirutEquivalent = 1; uiDistrictNodes = 26; localities = 1546 } })
Write-Json 'browser-validation.json' ([pscustomobject]@{ status = 'UNVERIFIED'; reason = 'No browser child process is executed before installation and runtime gates pass.' })
'status,component,detail' | Set-Content -LiteralPath (Join-Path $evidenceRoot 'migration-register.csv') -Encoding UTF8
('BLOCKED,canonical-dataset,approved runtime ZIP is missing') | Add-Content -LiteralPath (Join-Path $evidenceRoot 'migration-register.csv') -Encoding UTF8
'status,consumer,detail' | Set-Content -LiteralPath (Join-Path $evidenceRoot 'consumer-validation.csv') -Encoding UTF8
('BLOCKED,application-consumers,consumer validation is deferred until canonical runtime is installed') | Add-Content -LiteralPath (Join-Path $evidenceRoot 'consumer-validation.csv') -Encoding UTF8

$evidenceZip = Join-Path $packageRoot ('evidence\' + $sessionId + '.zip')
Compress-Archive -Path (Join-Path $evidenceRoot '*') -DestinationPath $evidenceZip -Force

$status = $summary.status
Write-Output ('UL1D_STATUS=' + $status)
Write-Output ('UL1D_EVIDENCE_ROOT=' + $evidenceRoot)
if ($status -ne 'PASS') { exit 61 }
exit 0
