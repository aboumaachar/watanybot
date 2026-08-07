[CmdletBinding()]
param(
    [string]$ProjectRoot = 'C:\xampp\htdocs\projectx\watanybot',
    [string]$DiagnosticScript = 'C:\xampp\htdocs\projectx\watanybot\scripts\diagnose_process_snapshot_runtime_gate_warmup_v3.ps1',
    [string]$DiagnosticValidation = "$env:USERPROFILE\Downloads\diagnose_process_snapshot_runtime_gate_warmup_v2.validation.json"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:RunId = 'outer-host-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$script:SuccessToken = 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_OUTER_HOST_COMPLETED'
$script:BlockedToken = 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_OUTER_HOST_BLOCKED'

function Write-Utf8NoBomText {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text
    )
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $encoding)
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Value,
        [int]$Depth = 20
    )
    Write-Utf8NoBomText -Path $Path -Text (($Value | ConvertTo-Json -Depth $Depth) + [Environment]::NewLine)
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "APEX_SHA256_SOURCE_MISSING: $Path"
    }
    $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha.ComputeHash($stream)
        $builder = New-Object System.Text.StringBuilder
        foreach ($byte in $hashBytes) {
            [void]$builder.Append($byte.ToString('x2'))
        }
        return $builder.ToString()
    }
    finally {
        if ($null -ne $sha) { $sha.Dispose() }
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Copy-FrozenFile {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )
    if (-not (Test-Path -LiteralPath $Source)) {
        throw "APEX_OUTER_HOST_SOURCE_MISSING: $Source"
    }
    $parent = Split-Path -Parent $Destination
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    return [pscustomobject]@{
        Source = $Source
        Destination = $Destination
        SHA256 = Get-Sha256 -Path $Destination
        Length = (Get-Item -LiteralPath $Destination).Length
    }
}

$startedUtc = (Get-Date).ToUniversalTime().ToString('o')
$projectRootFull = [System.IO.Path]::GetFullPath($ProjectRoot)
if (-not (Test-Path -LiteralPath $projectRootFull)) {
    throw "APEX_OUTER_HOST_PROJECT_ROOT_MISSING: $projectRootFull"
}

$evidenceRoot = Join-Path $projectRootFull ('.pma\implementation\process-snapshot-runtime-gate-diagnostic-v3\' + $script:RunId)
$sourceFreezeRoot = Join-Path $evidenceRoot 'source-freeze'
New-Item -ItemType Directory -Path $sourceFreezeRoot -Force | Out-Null

$stdoutPath = Join-Path $evidenceRoot 'stdout.txt'
$stderrPath = Join-Path $evidenceRoot 'stderr.txt'
$transcriptPath = Join-Path $evidenceRoot 'outer-host-transcript.txt'
$runnerContextPath = Join-Path $evidenceRoot '00_OUTER_HOST_CONTEXT.json'
$failureRegisterPath = Join-Path $evidenceRoot 'FAILURE_AND_REGRESSION_REGISTER.json'
$finalReportPath = Join-Path $evidenceRoot 'FINAL_REPORT.json'
$markerPath = Join-Path $evidenceRoot 'FINAL.marker'
$shaPath = Join-Path $evidenceRoot 'SHA256SUMS.json'
$summaryPath = Join-Path $evidenceRoot '99_EXECUTE_MD_SUMMARY.md'

$frozenScript = Copy-FrozenFile -Source $DiagnosticScript -Destination (Join-Path $sourceFreezeRoot (Split-Path -Leaf $DiagnosticScript))
$frozenValidation = Copy-FrozenFile -Source $DiagnosticValidation -Destination (Join-Path $sourceFreezeRoot 'diagnose_process_snapshot_runtime_gate_warmup_v2.validation.json')

$validationObject = Get-Content -LiteralPath $DiagnosticValidation -Raw | ConvertFrom-Json
$failureClasses = @(
    'APEX_OUTER_HOST_PROJECT_ROOT_MISSING',
    'APEX_OUTER_HOST_SOURCE_MISSING',
    'APEX_OUTER_HOST_CHILD_START_FAILED',
    'APEX_OUTER_HOST_CHILD_BLOCKED',
    'APEX_OUTER_HOST_CHILD_EXIT_NONZERO',
    'APEX_OUTER_HOST_STDOUT_TOKEN_MISSING',
    'APEX_OUTER_HOST_STDERR_CAPTURE_MISSING',
    'APEX_OUTER_HOST_UNHANDLED_EXCEPTION'
)
if ($validationObject.regressionChecks) {
    $validationObject.regressionChecks.PSObject.Properties.Name | ForEach-Object {
        $failureClasses += ('APEX_REGRESSION_CHECK_' + $_.ToUpperInvariant())
    }
}

Write-JsonFile -Path $failureRegisterPath -Value ([pscustomobject]@{
    ScriptVersion = 'v1-apex-process-snapshot-runtime-gate-outer-host'
    FailureClasses = @($failureClasses | Select-Object -Unique)
    SourceDiagnosticSHA256 = $frozenScript.SHA256
    SourceValidationSHA256 = $frozenValidation.SHA256
})

Write-JsonFile -Path $runnerContextPath -Value ([pscustomobject]@{
    ScriptVersion = 'v1-apex-process-snapshot-runtime-gate-outer-host'
    RunId = $script:RunId
    ProjectRoot = $projectRootFull
    EvidenceRoot = $evidenceRoot
    DiagnosticScript = $DiagnosticScript
    DiagnosticValidation = $DiagnosticValidation
    StartedUtc = $startedUtc
    HostPowerShellVersion = $PSVersionTable.PSVersion.ToString()
    StaticGatePass = [bool]$validationObject.staticGatePass
    RuntimeStatusBeforeOuterHost = [string]$validationObject.runtimeStatus
    FrozenScript = $frozenScript
    FrozenValidation = $frozenValidation
})

try {
    $commandLine = 'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "{0}" -ProjectRoot "{1}"' -f $DiagnosticScript, $projectRootFull
    Write-Utf8NoBomText -Path $transcriptPath -Text ((@(
        'APEX OUTER HOST COMMAND',
        $commandLine,
        'STARTED_UTC=' + $startedUtc
    ) -join [Environment]::NewLine) + [Environment]::NewLine)

    $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoLogo',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        $DiagnosticScript,
        '-ProjectRoot',
        $projectRootFull
    ) -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

    $exitCode = [int]$process.ExitCode
    $stdoutRaw = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw } else { '' }
    $stderrRaw = if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw } else { '' }
    $stdoutText = if ($null -eq $stdoutRaw) { '' } else { [string]$stdoutRaw }
    $stderrText = if ($null -eq $stderrRaw) { '' } else { [string]$stderrRaw }
    $stdoutHasSuccess = $stdoutText -like '*APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_DIAGNOSTIC_V3_COMPLETED*'
    $stdoutHasBlocked = $stdoutText -like '*APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_DIAGNOSTIC_V3_BLOCKED*'
    $diagnosticEvidenceRoot = $null
    $diagnosticFailureClass = $null
    $diagnosticFailureMessage = $null
    if ($stdoutText -match '(?m)^EVIDENCE_ROOT=(.+)$') {
        $diagnosticEvidenceRoot = [string]$Matches[1].Trim()
    }
    if ($diagnosticEvidenceRoot -and (Test-Path -LiteralPath $diagnosticEvidenceRoot)) {
        $childFreezeRoot = Join-Path $evidenceRoot 'child-evidence'
        New-Item -ItemType Directory -Path $childFreezeRoot -Force | Out-Null
        $childFinalSource = Join-Path $diagnosticEvidenceRoot 'FINAL_REPORT.json'
        $childMarkerSource = Join-Path $diagnosticEvidenceRoot 'FINAL.marker'
        if (Test-Path -LiteralPath $childFinalSource) {
            Copy-FrozenFile -Source $childFinalSource -Destination (Join-Path $childFreezeRoot 'FINAL_REPORT.json') | Out-Null
            $childFinal = Get-Content -LiteralPath $childFinalSource -Raw | ConvertFrom-Json
            $diagnosticFailureClass = if ($childFinal.FailureClass) { [string]$childFinal.FailureClass } else { $null }
            $diagnosticFailureMessage = if ($childFinal.FailureMessage) { [string]$childFinal.FailureMessage } else { $null }
        }
        if (Test-Path -LiteralPath $childMarkerSource) {
            Copy-FrozenFile -Source $childMarkerSource -Destination (Join-Path $childFreezeRoot 'FINAL.marker') | Out-Null
        }
    }
    $finalStatus = if ($exitCode -eq 0 -and $stdoutHasSuccess) { 'PASS' } else { 'BLOCKED' }
    $failureClass = if ($finalStatus -eq 'PASS') { $null } elseif ($stdoutHasBlocked) { 'APEX_OUTER_HOST_CHILD_BLOCKED' } elseif ($exitCode -ne 0) { 'APEX_OUTER_HOST_CHILD_EXIT_NONZERO' } else { 'APEX_OUTER_HOST_STDOUT_TOKEN_MISSING' }
    $finalToken = if ($finalStatus -eq 'PASS') { $script:SuccessToken } else { $script:BlockedToken }

    $endedUtc = (Get-Date).ToUniversalTime().ToString('o')
    Add-Content -LiteralPath $transcriptPath -Value ('ENDED_UTC=' + $endedUtc)
    Add-Content -LiteralPath $transcriptPath -Value ('EXIT_CODE=' + $exitCode)

    $finalReport = [pscustomobject]@{
        ScriptVersion = 'v1-apex-process-snapshot-runtime-gate-outer-host'
        ProjectRoot = $projectRootFull
        EvidenceRoot = $evidenceRoot
        StartedUtc = $startedUtc
        EndedUtc = $endedUtc
        FinalStatus = $finalStatus
        ExitCode = $exitCode
        FinalToken = $finalToken
        FailureClass = $failureClass
        DiagnosticStdoutHasSuccessToken = $stdoutHasSuccess
        DiagnosticStdoutHasBlockedToken = $stdoutHasBlocked
        DiagnosticEvidenceRoot = $diagnosticEvidenceRoot
        DiagnosticFailureClass = $diagnosticFailureClass
        DiagnosticFailureMessage = $diagnosticFailureMessage
        StdoutLength = $stdoutText.Length
        StderrLength = $stderrText.Length
        StaticGatePass = [bool]$validationObject.staticGatePass
        DiagnosticRuntimeStatusBeforeOuterHost = [string]$validationObject.runtimeStatus
        FullControllerReintegrationAuthorized = $false
        Node20OrGatewayRun = $false
        GitMutationPerformed = $false
    }
    Write-JsonFile -Path $finalReportPath -Value $finalReport
    Write-Utf8NoBomText -Path $markerPath -Text ($finalToken + [Environment]::NewLine)
    $summaryLines = @(
        '# Process Snapshot Runtime Gate Outer Host',
        '',
        ('- FinalStatus: {0}' -f $finalStatus),
        ('- ExitCode: {0}' -f $exitCode),
        ('- FinalToken: {0}' -f $finalToken),
        ('- FailureClass: {0}' -f $(if ($failureClass) { $failureClass } else { 'NONE' })),
        ('- DiagnosticEvidenceRoot: {0}' -f $(if ($diagnosticEvidenceRoot) { $diagnosticEvidenceRoot } else { 'NONE' })),
        ('- DiagnosticFailureClass: {0}' -f $(if ($diagnosticFailureClass) { $diagnosticFailureClass } else { 'NONE' })),
        ('- StaticGatePass: {0}' -f ([bool]$validationObject.staticGatePass)),
        '- FullControllerReintegrationAuthorized: False',
        '- Node20OrGatewayRun: False',
        '- GitMutationPerformed: False',
        '',
        '## Evidence Files',
        '',
        '- 00_OUTER_HOST_CONTEXT.json',
        '- FAILURE_AND_REGRESSION_REGISTER.json',
        '- FINAL_REPORT.json',
        '- FINAL.marker',
        '- stdout.txt',
        '- stderr.txt',
        '- child-evidence/FINAL_REPORT.json when the child emits a final report',
        '- SHA256SUMS.json'
    )
    Write-Utf8NoBomText -Path $summaryPath -Text (($summaryLines -join [Environment]::NewLine) + [Environment]::NewLine)

    $hashes = Get-ChildItem -LiteralPath $evidenceRoot -File -Recurse | Sort-Object FullName | ForEach-Object {
        [pscustomobject]@{
            RelativePath = $_.FullName.Substring($evidenceRoot.Length + 1)
            SHA256 = Get-Sha256 -Path $_.FullName
            Length = $_.Length
        }
    }
    Write-JsonFile -Path $shaPath -Value ([pscustomobject]@{ Files = @($hashes) }) -Depth 30

    Write-Output $finalToken
    Write-Output $evidenceRoot
    exit $exitCode
}
catch {
    $endedUtc = (Get-Date).ToUniversalTime().ToString('o')
    $message = [string]$_.Exception.Message
    $finalReport = [pscustomobject]@{
        ScriptVersion = 'v1-apex-process-snapshot-runtime-gate-outer-host'
        ProjectRoot = $projectRootFull
        EvidenceRoot = $evidenceRoot
        StartedUtc = $startedUtc
        EndedUtc = $endedUtc
        FinalStatus = 'BLOCKED'
        ExitCode = 98
        FinalToken = $script:BlockedToken
        FailureClass = 'APEX_OUTER_HOST_UNHANDLED_EXCEPTION'
        FailureMessage = $message
        FullControllerReintegrationAuthorized = $false
        Node20OrGatewayRun = $false
        GitMutationPerformed = $false
    }
    Write-JsonFile -Path $finalReportPath -Value $finalReport
    Write-Utf8NoBomText -Path $markerPath -Text ($script:BlockedToken + [Environment]::NewLine)
    Write-Output $script:BlockedToken
    Write-Output $evidenceRoot
    Write-Error $message
    exit 98
}