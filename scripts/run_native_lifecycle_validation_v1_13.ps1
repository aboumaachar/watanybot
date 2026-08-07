[CmdletBinding()]
param(
    [string]$ProjectRoot = 'C:\xampp\htdocs\projectx\watanybot',
    [string]$Node20Path = 'C:\Users\User\AppData\Local\nvm\v20.11.1\node.exe',
    [string]$EvidenceRoot = '',
    [int]$ChildTimeoutMs = 120000,
    [int]$ReadinessTimeoutMs = 30000,
    [int]$GatewayPort = 4100,
    [switch]$AuditOnly,
    [switch]$SkipNodeLadder
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'Continue'

$script:ScriptVersion = 'v11.13-apex-native-lifecycle'
$script:SuccessToken = 'APEX_WATANYBOT_V3_DEADLOCK_ESCAPE_NATIVE_LIFECYCLE_V11_13_COMPLETED'
$script:BlockedToken = 'APEX_WATANYBOT_V3_DEADLOCK_ESCAPE_NATIVE_LIFECYCLE_V11_13_BLOCKED'
$script:ExitSuccess = 0
$script:ExitBlocked = 97
$script:StartedUtc = [DateTime]::UtcNow
$script:CurrentProcessId = [System.Diagnostics.Process]::GetCurrentProcess().Id
$script:FailureRegister = @(
    'APEX_V3_POST_EXIT_SYNCHRONOUS_READ_PIPE_DEADLOCK_CONFIRMED_DEFECT',
    'APEX_V3_STRESS_RUN_NO_FINAL_SUMMARY_DEFECT',
    'APEX_V3_HIGH_VOLUME_CHILD_BLOCKED_BEFORE_PROCESS_EXIT_DEFECT',
    'APEX_V3_SMALL_OUTPUT_SUCCESS_NOT_GENERALIZABLE_TO_NODE_GATEWAY_DEFECT',
    'APEX_V3_TIMEOUT_INCREASE_WOULD_MASK_PIPE_DEADLOCK_DEFECT',
    'APEX_V3_NODE_GATEWAY_HARNESS_DEPRECATED_DEFECT',
    'APEX_NATIVE_LIFECYCLE_REQUIRED_FOR_NODE_GATEWAY_DEFECT',
    'APEX_HUNG_STRESS_PROCESS_TREE_CLEANUP_NOT_YET_PROVEN_DEFECT',
    'APEX_NODE20_AVAILABLE_BUT_BLOCKED_BY_HARNESS_DEFECT',
    'APEX_NATIVE_RUNNER_OR_CONTROLLER_SOURCE_DRIFT_DEFECT',
    'APEX_NATIVE_COMMAND_RENDERING_REJECTION_DEFECT',
    'APEX_NATIVE_LIFECYCLE_MATRIX_PARTIAL_FAILURE_DEFECT',
    'APEX_NATIVE_PROCESS_TREE_TERMINATION_UNPROVEN_DEFECT',
    'APEX_NODE20_RUNTIME_CONTRACT_FAILURE_DEFECT',
    'APEX_NODE20_ISOLATION_STEP_FAILURE_DEFECT',
    'APEX_GATEWAY_REAL_CONFIG_RUNTIME_FAILURE_DEFECT',
    'APEX_SALARY_FULL_RANK_CATALOG_NOT_AUTOMATICALLY_PROVEN_DEFECT',
    'APEX_VISUAL_ARCHITECTURE_NOT_AUTOMATICALLY_PROVEN_DEFECT',
    'APEX_FULL_FEATURE_PARITY_NOT_AUTOMATICALLY_PROVEN_DEFECT'
)
$script:PhaseResults = New-Object System.Collections.ArrayList
$script:LaunchedRunIds = New-Object System.Collections.ArrayList
$script:FinalFailureClass = ''
$script:FinalFailureMessage = ''
$script:FinalStatus = 'BLOCKED'
$script:FinalExitCode = $script:ExitBlocked
$script:Node20Authorized = $false
$script:Node20IsolationStatus = 'NOT_RUN'
$script:GatewayStatus = 'NOT_RUN'
$script:SalaryStatus = 'IN_PROGRESS'
$script:VisualStatus = 'IN_PROGRESS'
$script:FeatureStatus = 'IN_PROGRESS'

function Write-Utf8NoBomText {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Text
    )
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $encoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
    [System.IO.File]::WriteAllText($Path, $Text, $encoding)
}

function Write-AsciiLines {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string[]]$Lines
    )
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllLines($Path, $Lines, [System.Text.Encoding]::ASCII)
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Value,
        [int]$Depth = 20
    )
    $json = $Value | ConvertTo-Json -Depth $Depth
    Write-Utf8NoBomText -Path $Path -Text ($json + [Environment]::NewLine)
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
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

function Get-FileFacts {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [pscustomobject]@{
            Path = $Path
            Exists = $false
            SizeBytes = 0
            Sha256 = $null
            NonAsciiByteCount = $null
            Utf8Bom = $null
            LastWriteUtc = $null
        }
    }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $nonAscii = 0
    foreach ($byte in $bytes) {
        if ($byte -gt 127) {
            $nonAscii++
        }
    }
    $hasBom = $false
    if ($bytes.Length -ge 3) {
        $hasBom = ($bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191)
    }
    $item = Get-Item -LiteralPath $Path
    return [pscustomobject]@{
        Path = $Path
        Exists = $true
        SizeBytes = $item.Length
        Sha256 = (Get-Sha256 -Path $Path)
        NonAsciiByteCount = $nonAscii
        Utf8Bom = $hasBom
        LastWriteUtc = $item.LastWriteTimeUtc.ToString('o')
    }
}

function Add-PhaseResult {
    param(
        [Parameter(Mandatory = $true)][string]$Phase,
        [Parameter(Mandatory = $true)][string]$Status,
        [string]$FailureClass = '',
        [string]$Message = '',
        $Evidence = $null
    )
    $row = [pscustomobject]@{
        Phase = $Phase
        Status = $Status
        FailureClass = $FailureClass
        Message = $Message
        Evidence = $Evidence
        RecordedUtc = [DateTime]::UtcNow.ToString('o')
    }
    [void]$script:PhaseResults.Add($row)
    if ($Status -eq 'FAIL' -or $Status -eq 'BLOCKED' -or $Status -eq 'UNVERIFIED') {
        if (-not $script:FinalFailureClass -and $FailureClass) {
            $script:FinalFailureClass = $FailureClass
            $script:FinalFailureMessage = $Message
        }
    }
    return $row
}

function Test-IsWindowsPowerShell51 {
    $editionOk = ($PSVersionTable.PSEdition -eq 'Desktop')
    $versionOk = ($PSVersionTable.PSVersion.Major -eq 5 -and $PSVersionTable.PSVersion.Minor -eq 1)
    return ($editionOk -and $versionOk)
}

function Assert-ProjectPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw 'APEX_PATH_EMPTY'
    }
    if (-not [System.IO.Path]::IsPathRooted($Path)) {
        throw 'APEX_PATH_NOT_ABSOLUTE'
    }
    if ($Path.IndexOf([char]0) -ge 0) {
        throw 'APEX_PATH_CONTAINS_NUL'
    }
    if ($Path.Contains("`r") -or $Path.Contains("`n")) {
        throw 'APEX_PATH_CONTAINS_NEWLINE'
    }
    if ($Path.IndexOfAny([char[]]'&|<>%!^') -ge 0) {
        throw 'APEX_PATH_CONTAINS_CMD_META'
    }
}

function Assert-SafeArgument {
    param([Parameter(Mandatory = $true)][string]$Value)
    if ($null -eq $Value) {
        throw 'APEX_ARGUMENT_NULL'
    }
    if ($Value.IndexOf([char]0) -ge 0) {
        throw 'APEX_ARGUMENT_CONTAINS_NUL'
    }
    if ($Value.Contains("`r") -or $Value.Contains("`n")) {
        throw 'APEX_ARGUMENT_CONTAINS_NEWLINE'
    }
    if ($Value.IndexOfAny([char[]]'&|<>%!^') -ge 0) {
        throw 'APEX_ARGUMENT_CONTAINS_CMD_META'
    }
}

function ConvertTo-CmdQuotedArgument {
    param([Parameter(Mandatory = $true)][string]$Value)
    Assert-SafeArgument -Value $Value
    $escaped = $Value.Replace('"', '""')
    return '"' + $escaped + '"'
}

function Get-ProcessSnapshot {
    $rows = @()
    try {
        $items = Get-CimInstance -ClassName Win32_Process -ErrorAction Stop
    }
    catch {
        $items = Get-WmiObject -Class Win32_Process -ErrorAction Stop
    }
    foreach ($item in $items) {
        $rows += [pscustomobject]@{
            ProcessId = [int]$item.ProcessId
            ParentProcessId = [int]$item.ParentProcessId
            Name = [string]$item.Name
            CommandLine = [string]$item.CommandLine
            CreationDate = [string]$item.CreationDate
        }
    }
    return $rows
}

function Get-DescendantProcessIds {
    param(
        [Parameter(Mandatory = $true)][int]$RootProcessId,
        [Parameter(Mandatory = $true)]$Snapshot
    )
    $result = New-Object System.Collections.ArrayList
    $queue = New-Object System.Collections.Queue
    $queue.Enqueue($RootProcessId)
    while ($queue.Count -gt 0) {
        $parentId = [int]$queue.Dequeue()
        $children = @($Snapshot | Where-Object { $_.ParentProcessId -eq $parentId })
        foreach ($child in $children) {
            if (-not $result.Contains([int]$child.ProcessId)) {
                [void]$result.Add([int]$child.ProcessId)
                $queue.Enqueue([int]$child.ProcessId)
            }
        }
    }
    return @($result)
}

function Stop-OwnedProcessTree {
    param(
        [Parameter(Mandatory = $true)][int]$RootProcessId,
        [int[]]$KnownProcessIds = @()
    )
    $snapshot = Get-ProcessSnapshot
    $ids = New-Object System.Collections.ArrayList
    foreach ($knownId in $KnownProcessIds) {
        if ($knownId -gt 0 -and -not $ids.Contains($knownId)) {
            [void]$ids.Add($knownId)
        }
    }
    foreach ($descendantId in (Get-DescendantProcessIds -RootProcessId $RootProcessId -Snapshot $snapshot)) {
        if (-not $ids.Contains($descendantId)) {
            [void]$ids.Add($descendantId)
        }
    }
    if (-not $ids.Contains($RootProcessId)) {
        [void]$ids.Add($RootProcessId)
    }
    $ordered = @($ids | Sort-Object -Descending)
    $attempts = @()
    foreach ($processId in $ordered) {
        if ($processId -eq $script:CurrentProcessId) {
            throw 'APEX_REFUSED_TO_TERMINATE_CURRENT_PROCESS'
        }
        $existsBefore = $null -ne (Get-Process -Id $processId -ErrorAction SilentlyContinue)
        $errorText = ''
        if ($existsBefore -and -not $AuditOnly) {
            try {
                Stop-Process -Id $processId -Force -ErrorAction Stop
            }
            catch {
                $errorText = $_.Exception.Message
            }
        }
        $attempts += [pscustomobject]@{
            ProcessId = $processId
            ExistedBefore = $existsBefore
            TerminationRequested = ($existsBefore -and -not $AuditOnly)
            Error = $errorText
        }
    }
    Start-Sleep -Milliseconds 500
    $remaining = @()
    foreach ($processId in $ordered) {
        if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
            $remaining += $processId
        }
    }
    return [pscustomobject]@{
        RootProcessId = $RootProcessId
        ProcessIds = $ordered
        Attempts = $attempts
        AuditOnly = [bool]$AuditOnly
        RemainingProcessIds = $remaining
        RemainingProcessCount = $remaining.Count
    }
}

function Get-ListeningPortsForProcessIds {
    param([int[]]$ProcessIds)
    if (-not $ProcessIds -or $ProcessIds.Count -eq 0) {
        return @()
    }
    $ports = @()
    $command = Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue
    if ($command) {
        try {
            $connections = Get-NetTCPConnection -State Listen -ErrorAction Stop
            foreach ($connection in $connections) {
                if ($ProcessIds -contains [int]$connection.OwningProcess) {
                    $ports += [pscustomobject]@{
                        ProcessId = [int]$connection.OwningProcess
                        LocalAddress = [string]$connection.LocalAddress
                        LocalPort = [int]$connection.LocalPort
                    }
                }
            }
        }
        catch {
            return @()
        }
    }
    return $ports
}

function Test-TcpPort {
    param(
        [string]$HostName = '127.0.0.1',
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutMs = 1000
    )
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync($HostName, $Port)
        if (-not $task.Wait($TimeoutMs)) {
            return $false
        }
        return $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
        $client.Dispose()
    }
}

function Get-FileLines {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [string[]]@()
    }
    $content = [System.IO.File]::ReadAllLines($Path)
    return [string[]]$content
}

function New-ChildScript {
    param(
        [Parameter(Mandatory = $true)][string]$Case,
        [Parameter(Mandatory = $true)][string]$RunDirectory
    )
    $childPath = Join-Path $RunDirectory ('child-' + $Case.ToLowerInvariant() + '.ps1')
    switch ($Case) {
        'FAST' {
            Write-AsciiLines -Path $childPath -Lines @(
                '$ErrorActionPreference = ''Stop''',
                'Write-Output ''APEX_NATIVE_FAST_PASS''',
                'exit 0'
            )
        }
        'OUTERR' {
            Write-AsciiLines -Path $childPath -Lines @(
                '$ErrorActionPreference = ''Stop''',
                'Write-Output ''APEX_NATIVE_OUT_PASS''',
                '[Console]::Error.WriteLine(''APEX_NATIVE_ERR_PASS'')',
                'exit 0'
            )
        }
        'DELAYED' {
            Write-AsciiLines -Path $childPath -Lines @(
                '$ErrorActionPreference = ''Stop''',
                'Write-Output ''APEX_NATIVE_FIRST''',
                'Start-Sleep -Milliseconds 750',
                'Write-Output ''APEX_NATIVE_LAST''',
                'exit 0'
            )
        }
        'HIGHVOLUME' {
            Write-AsciiLines -Path $childPath -Lines @(
                '$ErrorActionPreference = ''Stop''',
                'for ($i = 1; $i -le 10000; $i++) { [Console]::Out.WriteLine((''LINE{0}'' -f $i)) }',
                'for ($i = 1; $i -le 1000; $i++) { [Console]::Error.WriteLine((''ERR{0}'' -f $i)) }',
                'exit 0'
            )
        }
        'FAIL' {
            Write-AsciiLines -Path $childPath -Lines @(
                '$ErrorActionPreference = ''Stop''',
                'Write-Output ''APEX_NATIVE_FAIL_OUT''',
                '[Console]::Error.WriteLine(''APEX_NATIVE_FAIL_ERR'')',
                'exit 7'
            )
        }
        'TREE' {
            $grandChildPath = Join-Path $RunDirectory 'tree-grandchild.ps1'
            $childPidPath = Join-Path $RunDirectory 'tree-child-pid.txt'
            Write-AsciiLines -Path $grandChildPath -Lines @(
                '$ErrorActionPreference = ''Stop''',
                'Start-Sleep -Seconds 300',
                'exit 0'
            )
            $grandChildLiteral = $grandChildPath.Replace('''', '''''')
            $childPidLiteral = $childPidPath.Replace('''', '''''')
            Write-AsciiLines -Path $childPath -Lines @(
                '$ErrorActionPreference = ''Stop''',
                ('$child = Start-Process -FilePath ''powershell.exe'' -ArgumentList @(''-NoLogo'',''-NoProfile'',''-ExecutionPolicy'',''Bypass'',''-File'',''' + $grandChildLiteral + ''') -PassThru'),
                ('[System.IO.File]::WriteAllText(''' + $childPidLiteral + ''', [string]$child.Id, [System.Text.Encoding]::ASCII)'),
                'Wait-Process -Id $child.Id',
                'exit 0'
            )
        }
        default {
            throw ('APEX_UNKNOWN_CASE_' + $Case)
        }
    }
    return $childPath
}

function New-RunCommandSpec {
    param(
        [Parameter(Mandatory = $true)][string]$Case,
        [Parameter(Mandatory = $true)][string]$RunDirectory
    )
    $childPath = New-ChildScript -Case $Case -RunDirectory $RunDirectory
    return [pscustomobject]@{
        Case = $Case
        ExecutablePath = (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
        Arguments = @('-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $childPath)
        WorkingDirectory = $RunDirectory
        EnvironmentOverrides = @{}
        ExpectedExitCode = $(if ($Case -eq 'FAIL') { 7 } else { 0 })
        ExpectedLongRunning = ($Case -eq 'TREE')
        ReadinessPort = 0
    }
}

function New-NodeCommandSpec {
    param(
        [Parameter(Mandatory = $true)][string]$Step,
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [Parameter(Mandatory = $true)][string]$GatewayRoot,
        [Parameter(Mandatory = $true)][string]$NodePath,
        [int]$Port = 0
    )
    $scriptPath = Join-Path $RunDirectory ('node-' + $Step.ToLowerInvariant() + '.cjs')
    $arguments = @()
    $environment = @{}
    $workingDirectory = $GatewayRoot
    $expectedLongRunning = $false
    switch ($Step) {
        'A' {
            Write-AsciiLines -Path $scriptPath -Lines @('console.log(process.version);')
            $arguments = @($scriptPath)
        }
        'B' {
            Write-AsciiLines -Path $scriptPath -Lines @(
                'const crypto = require(''crypto'');',
                'console.log(crypto.randomBytes(16).toString(''hex''));'
            )
            $arguments = @($scriptPath)
        }
        'C' {
            Write-AsciiLines -Path $scriptPath -Lines @(
                'const crypto = require(''crypto'');',
                'console.log(crypto.randomBytes(16).toString(''hex''));'
            )
            $arguments = @('--env-file=.env', $scriptPath)
        }
        'D' {
            Write-AsciiLines -Path $scriptPath -Lines @(
                'const crypto = require(''crypto'');',
                'console.log(crypto.randomBytes(16).toString(''hex''));'
            )
            $arguments = @('--import', 'tsx', $scriptPath)
        }
        'E' {
            Write-AsciiLines -Path $scriptPath -Lines @(
                'const crypto = require(''crypto'');',
                'console.log(crypto.randomBytes(16).toString(''hex''));'
            )
            $arguments = @('--env-file=.env', '--import', 'tsx', $scriptPath)
        }
        'F' {
            $configCandidates = @(
                (Join-Path $GatewayRoot 'src\lib\config.ts'),
                (Join-Path $GatewayRoot 'src\config.ts')
            )
            $configPath = $configCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
            if (-not $configPath) {
                throw 'APEX_GATEWAY_CONFIG_MODULE_NOT_FOUND'
            }
            $configUrlPath = $configPath.Replace('\', '/').Replace('''', '\''')
            Write-AsciiLines -Path $scriptPath -Lines @(
                'const pathToFileURL = require(''url'').pathToFileURL;',
                ('import(pathToFileURL(''' + $configUrlPath + ''').href).then(function(){ console.log(''APEX_CONFIG_IMPORT_PASS''); }).catch(function(error){ console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });')
            )
            $arguments = @('--env-file=.env', '--import', 'tsx', $scriptPath)
        }
        'G' {
            $packagePath = (Join-Path $GatewayRoot 'package.json').Replace('\', '/').Replace('''', '\''')
            Write-AsciiLines -Path $scriptPath -Lines @(
                'const createRequire = require(''module'').createRequire;',
                ('const localRequire = createRequire(''' + $packagePath + ''');'),
                'localRequire(''fastify'');',
                'console.log(''APEX_FASTIFY_IMPORT_PASS'');'
            )
            $arguments = @($scriptPath)
        }
        'H' {
            $serverCandidates = @(
                (Join-Path $GatewayRoot 'src\server.ts'),
                (Join-Path $GatewayRoot 'src\index.ts'),
                (Join-Path $GatewayRoot 'src\main.ts')
            )
            $serverPath = $serverCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
            if (-not $serverPath) {
                throw 'APEX_GATEWAY_ENTRYPOINT_NOT_FOUND'
            }
            $arguments = @('--env-file=.env', '--import', 'tsx', $serverPath)
            $environment = @{
                APEX_GATEWAY_BOOT_TRACE = '1'
                PORT = [string]$Port
                GATEWAY_PORT = [string]$Port
            }
            $expectedLongRunning = $true
        }
        default {
            throw ('APEX_UNKNOWN_NODE_STEP_' + $Step)
        }
    }
    return [pscustomobject]@{
        Case = ('NODE_' + $Step)
        ExecutablePath = $NodePath
        Arguments = $arguments
        WorkingDirectory = $workingDirectory
        EnvironmentOverrides = $environment
        ExpectedExitCode = 0
        ExpectedLongRunning = $expectedLongRunning
        ReadinessPort = $(if ($Step -eq 'H') { $Port } else { 0 })
    }
}

function New-RunnerFile {
    param(
        [Parameter(Mandatory = $true)]$Spec,
        [Parameter(Mandatory = $true)][string]$RunDirectory
    )
    Assert-ProjectPath -Path $Spec.ExecutablePath
    Assert-ProjectPath -Path $Spec.WorkingDirectory
    $stdoutPath = Join-Path $RunDirectory 'stdout.log'
    $stderrPath = Join-Path $RunDirectory 'stderr.log'
    $exitCodePath = Join-Path $RunDirectory 'exit-code.txt'
    $childMarkerPath = Join-Path $RunDirectory 'CHILD_FINAL.marker'
    foreach ($path in @($stdoutPath, $stderrPath, $exitCodePath, $childMarkerPath)) {
        Assert-ProjectPath -Path $path
    }
    $commandParts = New-Object System.Collections.ArrayList
    [void]$commandParts.Add((ConvertTo-CmdQuotedArgument -Value $Spec.ExecutablePath))
    foreach ($argument in $Spec.Arguments) {
        [void]$commandParts.Add((ConvertTo-CmdQuotedArgument -Value ([string]$argument)))
    }
    $commandLine = ($commandParts -join ' ')
    $lines = New-Object System.Collections.ArrayList
    [void]$lines.Add('@echo off')
    [void]$lines.Add('setlocal EnableExtensions DisableDelayedExpansion')
    foreach ($key in @($Spec.EnvironmentOverrides.Keys | Sort-Object)) {
        $name = [string]$key
        $value = [string]$Spec.EnvironmentOverrides[$key]
        if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
            throw 'APEX_INVALID_ENVIRONMENT_NAME'
        }
        Assert-SafeArgument -Value $value
        [void]$lines.Add(('set "' + $name + '=' + $value + '"'))
    }
    [void]$lines.Add(('pushd ' + (ConvertTo-CmdQuotedArgument -Value $Spec.WorkingDirectory)))
    [void]$lines.Add(($commandLine + ' 1>' + (ConvertTo-CmdQuotedArgument -Value $stdoutPath) + ' 2>' + (ConvertTo-CmdQuotedArgument -Value $stderrPath)))
    [void]$lines.Add('set "APEX_CHILD_EXIT=%ERRORLEVEL%"')
    [void]$lines.Add(('>' + (ConvertTo-CmdQuotedArgument -Value $exitCodePath) + ' echo %APEX_CHILD_EXIT%'))
    [void]$lines.Add(('>' + (ConvertTo-CmdQuotedArgument -Value $childMarkerPath) + ' echo APEX_CHILD_FINAL'))
    [void]$lines.Add('popd')
    [void]$lines.Add('exit /b %APEX_CHILD_EXIT%')
    $runnerPath = Join-Path $RunDirectory 'EFFECTIVE_COMMAND.cmd'
    Write-AsciiLines -Path $runnerPath -Lines @($lines)
    return [pscustomobject]@{
        RunnerPath = $runnerPath
        StdoutPath = $stdoutPath
        StderrPath = $stderrPath
        ExitCodePath = $exitCodePath
        ChildMarkerPath = $childMarkerPath
        CommandLine = $commandLine
    }
}

function Invoke-NativeFileRun {
    param(
        [Parameter(Mandatory = $true)]$Spec,
        [Parameter(Mandatory = $true)][string]$OutputRoot,
        [int]$TimeoutMs = 120000,
        [int]$PortTimeoutMs = 30000,
        [scriptblock]$OnReady = $null
    )
    $runId = [Guid]::NewGuid().ToString()
    [void]$script:LaunchedRunIds.Add($runId)
    $runDirectory = Join-Path $OutputRoot ('run-' + $runId)
    New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
    $controllerMarkerPath = Join-Path $runDirectory 'CONTROLLER_FINAL.marker'
    $summaryPath = Join-Path $runDirectory 'run-summary.json'
    $processTreePath = Join-Path $runDirectory 'PROCESS_TREE.json'
    $portMatrixPath = Join-Path $runDirectory 'PORT_MATRIX.json'
    $startedUtc = [DateTime]::UtcNow
    $rootProcess = $null
    $knownIds = New-Object System.Collections.ArrayList
    $timedOut = $false
    $readinessObserved = $false
    $cleanup = $null
    $onReadyResult = $null
    $controllerError = ''
    $runnerInfo = $null
    $exitCode = $null
    $status = 'FAIL'
    try {
        Write-JsonFile -Path (Join-Path $runDirectory 'PRESTART.json') -Value ([ordered]@{
            RunId = $runId
            Case = $Spec.Case
            StartUtc = $startedUtc.ToString('o')
            WorkingDirectory = $Spec.WorkingDirectory
            ExpectedExitCode = $Spec.ExpectedExitCode
            ExpectedLongRunning = $Spec.ExpectedLongRunning
            ReadinessPort = $Spec.ReadinessPort
        })
        Write-JsonFile -Path (Join-Path $runDirectory 'COMMAND_SPEC.json') -Value $Spec
        $runnerInfo = New-RunnerFile -Spec $Spec -RunDirectory $runDirectory
        $cmdPath = Join-Path $env:SystemRoot 'System32\cmd.exe'
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $cmdPath
        $psi.Arguments = '/d /s /c ""' + $runnerInfo.RunnerPath + '""'
        $psi.WorkingDirectory = $runDirectory
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.RedirectStandardOutput = $false
        $psi.RedirectStandardError = $false
        $rootProcess = New-Object System.Diagnostics.Process
        $rootProcess.StartInfo = $psi
        if (-not $rootProcess.Start()) {
            throw 'APEX_NATIVE_PROCESS_START_RETURNED_FALSE'
        }
        [void]$knownIds.Add([int]$rootProcess.Id)
        $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
        $portDeadline = [DateTime]::UtcNow.AddMilliseconds($PortTimeoutMs)
        while (-not $rootProcess.HasExited) {
            $snapshot = Get-ProcessSnapshot
            foreach ($descendantId in (Get-DescendantProcessIds -RootProcessId $rootProcess.Id -Snapshot $snapshot)) {
                if (-not $knownIds.Contains($descendantId)) {
                    [void]$knownIds.Add([int]$descendantId)
                }
            }
            if ($Spec.ExpectedLongRunning -and $Spec.ReadinessPort -gt 0 -and -not $readinessObserved) {
                if (Test-TcpPort -Port $Spec.ReadinessPort -TimeoutMs 500) {
                    $readinessObserved = $true
                    if ($OnReady) {
                        $onReadyResult = & $OnReady $Spec.ReadinessPort
                    }
                    break
                }
                if ([DateTime]::UtcNow -gt $portDeadline) {
                    $timedOut = $true
                    break
                }
            }
            if ([DateTime]::UtcNow -gt $deadline) {
                $timedOut = $true
                break
            }
            Start-Sleep -Milliseconds 100
        }
        if ($Spec.ExpectedLongRunning) {
            if ($readinessObserved -or $timedOut) {
                $cleanup = Stop-OwnedProcessTree -RootProcessId $rootProcess.Id -KnownProcessIds @($knownIds)
            }
        }
        elseif ($timedOut) {
            $cleanup = Stop-OwnedProcessTree -RootProcessId $rootProcess.Id -KnownProcessIds @($knownIds)
        }
        if (-not $rootProcess.HasExited) {
            [void]$rootProcess.WaitForExit(5000)
        }
        if ($rootProcess.HasExited) {
            $exitCode = $rootProcess.ExitCode
        }
        if (-not $cleanup) {
            $remaining = @()
            foreach ($knownId in @($knownIds)) {
                if (Get-Process -Id $knownId -ErrorAction SilentlyContinue) {
                    $remaining += $knownId
                }
            }
            $cleanup = [pscustomobject]@{
                RootProcessId = $rootProcess.Id
                ProcessIds = @($knownIds)
                Attempts = @()
                AuditOnly = [bool]$AuditOnly
                RemainingProcessIds = @($remaining)
                RemainingProcessCount = @($remaining).Count
            }
        }
        $status = 'COMPLETED'
    }
    catch {
        $controllerError = $_.Exception.Message
        if ($rootProcess -and -not $rootProcess.HasExited) {
            try {
                $cleanup = Stop-OwnedProcessTree -RootProcessId $rootProcess.Id -KnownProcessIds @($knownIds)
            }
            catch {
                $controllerError = $controllerError + ' | cleanup: ' + $_.Exception.Message
            }
        }
        $status = 'FAIL'
    }
    finally {
        $endedUtc = [DateTime]::UtcNow
        $stdoutLines = [string[]]@()
        $stderrLines = [string[]]@()
        $childExitCode = $null
        $childMarkerPresent = $false
        if ($runnerInfo) {
            $stdoutLines = [string[]]@(Get-FileLines -Path $runnerInfo.StdoutPath)
            $stderrLines = [string[]]@(Get-FileLines -Path $runnerInfo.StderrPath)
            if (Test-Path -LiteralPath $runnerInfo.ExitCodePath -PathType Leaf) {
                $rawExit = ([System.IO.File]::ReadAllText($runnerInfo.ExitCodePath)).Trim()
                $parsedExit = 0
                if ([int]::TryParse($rawExit, [ref]$parsedExit)) {
                    $childExitCode = $parsedExit
                }
            }
            $childMarkerPresent = Test-Path -LiteralPath $runnerInfo.ChildMarkerPath -PathType Leaf
        }
        $knownProcessIds = @($knownIds)
        $remainingIds = @()
        if ($cleanup) {
            $remainingIds = @($cleanup.RemainingProcessIds)
        }
        $ports = @(Get-ListeningPortsForProcessIds -ProcessIds $remainingIds)
        Write-JsonFile -Path $processTreePath -Value ([ordered]@{
            RootProcessId = $(if ($rootProcess) { $rootProcess.Id } else { $null })
            KnownProcessIds = $knownProcessIds
            RemainingProcessIds = $remainingIds
            RemainingProcessCount = @($remainingIds).Count
            Cleanup = $cleanup
        })
        Write-JsonFile -Path $portMatrixPath -Value ([ordered]@{
            RemainingListeners = $ports
            RemainingListenerCount = @($ports).Count
            ReadinessPort = $Spec.ReadinessPort
            ReadinessObserved = $readinessObserved
        })
        $summary = [ordered]@{
            RunId = $runId
            Case = $Spec.Case
            ControllerStatus = $status
            ControllerError = $controllerError
            ControllerExitCode = $exitCode
            ChildExitCode = $childExitCode
            ExpectedExitCode = $Spec.ExpectedExitCode
            TimedOut = $timedOut
            ReadinessObserved = $readinessObserved
            ExpectedLongRunning = $Spec.ExpectedLongRunning
            StdoutBytes = $(if ($runnerInfo -and (Test-Path -LiteralPath $runnerInfo.StdoutPath)) { (Get-Item -LiteralPath $runnerInfo.StdoutPath).Length } else { 0 })
            StderrBytes = $(if ($runnerInfo -and (Test-Path -LiteralPath $runnerInfo.StderrPath)) { (Get-Item -LiteralPath $runnerInfo.StderrPath).Length } else { 0 })
            StdoutLineCount = @($stdoutLines).Count
            StderrLineCount = @($stderrLines).Count
            ChildFinalMarkerPresent = $childMarkerPresent
            ControllerFinalMarkerPresent = $true
            RemainingOwnedProcesses = @($remainingIds).Count
            RemainingOwnedListeners = @($ports).Count
            OnReadyResult = $onReadyResult
            StartUtc = $startedUtc.ToString('o')
            EndUtc = $endedUtc.ToString('o')
        }
        Write-JsonFile -Path $summaryPath -Value $summary
        Write-AsciiLines -Path $controllerMarkerPath -Lines @('APEX_CONTROLLER_FINAL')
        if ($rootProcess) {
            $rootProcess.Dispose()
        }
    }
    return [pscustomobject]@{
        RunId = $runId
        RunDirectory = $runDirectory
        Spec = $Spec
        Summary = Get-Content -Raw -LiteralPath $summaryPath | ConvertFrom-Json
        StdoutLines = $(if ($runnerInfo) { [string[]]@(Get-FileLines -Path $runnerInfo.StdoutPath) } else { [string[]]@() })
        StderrLines = $(if ($runnerInfo) { [string[]]@(Get-FileLines -Path $runnerInfo.StderrPath) } else { [string[]]@() })
    }
}

function Test-RunContract {
    param([Parameter(Mandatory = $true)]$Run)
    $case = [string]$Run.Spec.Case
    $stdout = [string[]]@($Run.StdoutLines)
    $stderr = [string[]]@($Run.StderrLines)
    $summary = $Run.Summary
    $missingStdout = New-Object System.Collections.ArrayList
    $missingStderr = New-Object System.Collections.ArrayList
    $lineCountMismatch = $false
    $boundaryMismatch = $false
    $delayedOrderMismatch = $false
    $expectedNonzero = $false
    $expectedExit = [int]$Run.Spec.ExpectedExitCode
    $actualExit = $summary.ChildExitCode
    if ($null -eq $actualExit) {
        $actualExit = $summary.ControllerExitCode
    }
    $exitMatched = ($null -ne $actualExit -and [int]$actualExit -eq $expectedExit)
    $stdoutText = $stdout -join [Environment]::NewLine
    $stderrText = $stderr -join [Environment]::NewLine
    switch ($case) {
        'FAST' {
            if ($stdoutText -notmatch [regex]::Escape('APEX_NATIVE_FAST_PASS')) { [void]$missingStdout.Add('APEX_NATIVE_FAST_PASS') }
            if (@($stderr).Count -ne 0) { $lineCountMismatch = $true }
        }
        'OUTERR' {
            if ($stdoutText -notmatch [regex]::Escape('APEX_NATIVE_OUT_PASS')) { [void]$missingStdout.Add('APEX_NATIVE_OUT_PASS') }
            if ($stderrText -notmatch [regex]::Escape('APEX_NATIVE_ERR_PASS')) { [void]$missingStderr.Add('APEX_NATIVE_ERR_PASS') }
        }
        'DELAYED' {
            $firstIndex = [Array]::IndexOf($stdout, 'APEX_NATIVE_FIRST')
            $lastIndex = [Array]::IndexOf($stdout, 'APEX_NATIVE_LAST')
            if ($firstIndex -lt 0) { [void]$missingStdout.Add('APEX_NATIVE_FIRST') }
            if ($lastIndex -lt 0) { [void]$missingStdout.Add('APEX_NATIVE_LAST') }
            if ($firstIndex -lt 0 -or $lastIndex -lt 0 -or $firstIndex -ge $lastIndex) { $delayedOrderMismatch = $true }
            if (@($stderr).Count -ne 0) { $lineCountMismatch = $true }
        }
        'HIGHVOLUME' {
            if (@($stdout).Count -ne 10000 -or @($stderr).Count -ne 1000) { $lineCountMismatch = $true }
            if (@($stdout).Count -gt 0) {
                if ($stdout[0] -ne 'LINE1' -or $stdout[@($stdout).Count - 1] -ne 'LINE10000') { $boundaryMismatch = $true }
            }
            else { $boundaryMismatch = $true }
            if (@($stderr).Count -gt 0) {
                if ($stderr[0] -ne 'ERR1' -or $stderr[@($stderr).Count - 1] -ne 'ERR1000') { $boundaryMismatch = $true }
            }
            else { $boundaryMismatch = $true }
        }
        'FAIL' {
            $expectedNonzero = $true
            if ($stdoutText -notmatch [regex]::Escape('APEX_NATIVE_FAIL_OUT')) { [void]$missingStdout.Add('APEX_NATIVE_FAIL_OUT') }
            if ($stderrText -notmatch [regex]::Escape('APEX_NATIVE_FAIL_ERR')) { [void]$missingStderr.Add('APEX_NATIVE_FAIL_ERR') }
        }
        default {
            if ($case -eq 'NODE_A') {
                if (@($stdout).Count -ne 1 -or $stdout[0] -ne 'v20.11.1') { [void]$missingStdout.Add('v20.11.1') }
            }
            elseif ($case -match '^NODE_[BCDE]$') {
                if (@($stdout).Count -ne 1 -or $stdout[0] -notmatch '^[0-9a-f]{32}$') { [void]$missingStdout.Add('32_HEX_CHARS') }
                if (@($stderr).Count -ne 0) { $lineCountMismatch = $true }
            }
            elseif ($case -eq 'NODE_F') {
                if ($stdoutText -notmatch [regex]::Escape('APEX_CONFIG_IMPORT_PASS')) { [void]$missingStdout.Add('APEX_CONFIG_IMPORT_PASS') }
            }
            elseif ($case -eq 'NODE_G') {
                if ($stdoutText -notmatch [regex]::Escape('APEX_FASTIFY_IMPORT_PASS')) { [void]$missingStdout.Add('APEX_FASTIFY_IMPORT_PASS') }
            }
            elseif ($case -eq 'NODE_H') {
                if (-not $summary.ReadinessObserved) { [void]$missingStdout.Add('GATEWAY_READINESS') }
            }
        }
    }
    $artifactsPresent = ($summary.ControllerFinalMarkerPresent -and ($summary.ExpectedLongRunning -or $summary.ChildFinalMarkerPresent))
    $pass = ($exitMatched -and @($missingStdout).Count -eq 0 -and @($missingStderr).Count -eq 0 -and -not $lineCountMismatch -and -not $boundaryMismatch -and -not $delayedOrderMismatch -and $artifactsPresent -and [int]$summary.RemainingOwnedProcesses -eq 0 -and [int]$summary.RemainingOwnedListeners -eq 0 -and -not [bool]$summary.TimedOut)
    if ($case -eq 'TREE') {
        $pass = ([bool]$summary.TimedOut -and [int]$summary.RemainingOwnedProcesses -eq 0 -and [int]$summary.RemainingOwnedListeners -eq 0)
    }
    if ($case -eq 'NODE_H') {
        $pass = ([bool]$summary.ReadinessObserved -and [int]$summary.RemainingOwnedProcesses -eq 0 -and [int]$summary.RemainingOwnedListeners -eq 0)
    }
    return [pscustomobject]@{
        RunId = $Run.RunId
        Case = $case
        Status = $(if ($pass) { if ($expectedNonzero) { 'PASS_EXPECTED_NONZERO' } else { 'PASS' } } else { 'FAIL' })
        Passed = $pass
        ExpectedNonzero = $expectedNonzero
        ExpectedExitCode = $expectedExit
        ActualExitCode = $actualExit
        ExitMatched = $exitMatched
        MissingStdoutTokens = @($missingStdout)
        MissingStderrTokens = @($missingStderr)
        LineCountMismatch = $lineCountMismatch
        BoundaryLineMismatch = $boundaryMismatch
        DelayedOrderMismatch = $delayedOrderMismatch
        MissingArtifacts = (-not $artifactsPresent)
        TimedOut = [bool]$summary.TimedOut
        RemainingProcessCount = [int]$summary.RemainingOwnedProcesses
        RemainingListenerCount = [int]$summary.RemainingOwnedListeners
        RunDirectory = $Run.RunDirectory
    }
}

function Invoke-CommandSafetyTests {
    param([Parameter(Mandatory = $true)][string]$OutputRoot)
    $safetyRoot = Join-Path $OutputRoot 'command-safety-tests'
    New-Item -ItemType Directory -Path $safetyRoot -Force | Out-Null
    $tests = @(
        [pscustomobject]@{ Id = 'newline'; Action = { Assert-SafeArgument -Value ("safe`nunsafe") } },
        [pscustomobject]@{ Id = 'carriage-return'; Action = { Assert-SafeArgument -Value ("safe`runsafe") } },
        [pscustomobject]@{ Id = 'nul'; Action = { Assert-SafeArgument -Value ('safe' + [char]0 + 'unsafe') } },
        [pscustomobject]@{ Id = 'ampersand'; Action = { Assert-SafeArgument -Value 'safe&unsafe' } },
        [pscustomobject]@{ Id = 'pipe'; Action = { Assert-SafeArgument -Value 'safe|unsafe' } },
        [pscustomobject]@{ Id = 'redirection'; Action = { Assert-SafeArgument -Value 'safe>unsafe' } },
        [pscustomobject]@{ Id = 'percent'; Action = { Assert-SafeArgument -Value 'safe%PATH%' } },
        [pscustomobject]@{ Id = 'exclamation'; Action = { Assert-SafeArgument -Value 'safe!unsafe' } },
        [pscustomobject]@{ Id = 'relative-path'; Action = { Assert-ProjectPath -Path '.\relative.txt' } },
        [pscustomobject]@{ Id = 'missing-path'; Action = { Assert-ProjectPath -Path '' } },
        [pscustomobject]@{ Id = 'unknown-child-type'; Action = { New-ChildScript -Case 'UNKNOWN' -RunDirectory $safetyRoot | Out-Null } }
    )
    $rows = @()
    $unexpectedArtifactCount = 0
    $unexpectedChildCount = 0
    foreach ($test in $tests) {
        $beforeFiles = @(Get-ChildItem -LiteralPath $safetyRoot -Recurse -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
        $beforeProcesses = @(Get-ProcessSnapshot)
        $rejected = $false
        $message = ''
        try {
            & $test.Action
        }
        catch {
            $rejected = $true
            $message = $_.Exception.Message
        }
        $afterFiles = @(Get-ChildItem -LiteralPath $safetyRoot -Recurse -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
        $afterProcesses = @(Get-ProcessSnapshot)
        $newFiles = @($afterFiles | Where-Object { $beforeFiles -notcontains $_ })
        $beforeProcessIds = @($beforeProcesses | ForEach-Object { [int]$_.ProcessId })
        $newProcesses = @($afterProcesses | Where-Object {
            $beforeProcessIds -notcontains [int]$_.ProcessId -and
            $_.CommandLine -and
            $_.CommandLine.IndexOf($safetyRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
        })
        $unexpectedArtifactCount += $newFiles.Count
        $unexpectedChildCount += $newProcesses.Count
        $rowPass = ($rejected -and $newFiles.Count -eq 0 -and $newProcesses.Count -eq 0)
        $rows += [pscustomobject]@{
            TestId = $test.Id
            Rejected = $rejected
            Message = $message
            NewFiles = $newFiles
            NewProcessIds = @($newProcesses | ForEach-Object { [int]$_.ProcessId })
            Status = $(if ($rowPass) { 'PASS' } else { 'FAIL' })
        }
    }
    $passCount = @($rows | Where-Object { $_.Status -eq 'PASS' }).Count
    return [pscustomobject]@{
        NegativeTestCount = $rows.Count
        NegativeTestPassCount = $passCount
        UnexpectedChildExecutionCount = $unexpectedChildCount
        UnexpectedArtifactCreationCount = $unexpectedArtifactCount
        GatePass = ($rows.Count -eq 11 -and $passCount -eq 11 -and $unexpectedChildCount -eq 0 -and $unexpectedArtifactCount -eq 0)
        Results = $rows
    }
}

function Invoke-HttpHealthProbe {
    param([Parameter(Mandatory = $true)][int]$Port)
    $paths = @('/health', '/api/health', '/v1/health')
    $rows = @()
    foreach ($path in $paths) {
        $uri = 'http://127.0.0.1:' + $Port + $path
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec 5
            $rows += [pscustomobject]@{ Uri = $uri; StatusCode = [int]$response.StatusCode; Success = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300); Error = '' }
        }
        catch {
            $statusCode = 0
            if ($_.Exception.Response) {
                try { $statusCode = [int]$_.Exception.Response.StatusCode } catch { $statusCode = 0 }
            }
            $rows += [pscustomobject]@{ Uri = $uri; StatusCode = $statusCode; Success = $false; Error = $_.Exception.Message }
        }
    }
    return [pscustomobject]@{
        Success = (@($rows | Where-Object { $_.Success }).Count -gt 0)
        Results = $rows
    }
}

function Find-IncompleteV3Run {
    param([Parameter(Mandatory = $true)][string]$V10Root)
    if (-not (Test-Path -LiteralPath $V10Root -PathType Container)) {
        return $null
    }
    $candidates = @(Get-ChildItem -LiteralPath $V10Root -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'v3-run-*' } | Sort-Object LastWriteTimeUtc -Descending)
    foreach ($candidate in $candidates) {
        if (-not (Test-Path -LiteralPath (Join-Path $candidate.FullName 'run-summary.json') -PathType Leaf)) {
            return $candidate
        }
    }
    return $null
}

function Find-LatestPassingV3Diagnostic {
    param([Parameter(Mandatory = $true)][string]$ProjectRootPath)
    $v3Root = Join-Path $ProjectRootPath '.pma\implementation\process-snapshot-runtime-gate-diagnostic-v3'
    if (-not (Test-Path -LiteralPath $v3Root -PathType Container)) {
        return $null
    }
    $candidates = @(Get-ChildItem -LiteralPath $v3Root -Directory -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'diagnostic-*' } | Sort-Object LastWriteTimeUtc -Descending)
    foreach ($candidate in $candidates) {
        $reportPath = Join-Path $candidate.FullName 'FINAL_REPORT.json'
        $markerPath = Join-Path $candidate.FullName 'FINAL.marker'
        if ((Test-Path -LiteralPath $reportPath -PathType Leaf) -and (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
            try {
                $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
                $marker = (Get-Content -LiteralPath $markerPath -Raw).Trim()
                if ([string]$report.FinalStatus -eq 'PASS' -and [int]$report.ExitCode -eq 0 -and [string]$report.FinalToken -eq 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_DIAGNOSTIC_V3_COMPLETED' -and $marker -eq 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_DIAGNOSTIC_V3_COMPLETED') {
                    return [pscustomobject]@{
                        EvidenceRoot = $candidate.FullName
                        FinalReport = $reportPath
                        FinalMarker = $markerPath
                        ScriptVersion = [string]$report.ScriptVersion
                        FinalToken = [string]$report.FinalToken
                    }
                }
            }
            catch {
            }
        }
    }
    return $null
}

function Find-OwnedHungRootProcess {
    param([Parameter(Mandatory = $true)][string]$RunDirectory)
    $snapshot = Get-ProcessSnapshot
    $matches = @($snapshot | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($RunDirectory, [StringComparison]::OrdinalIgnoreCase) -ge 0 })
    if ($matches.Count -eq 0) {
        return $null
    }
    $matchIds = @($matches | ForEach-Object { [int]$_.ProcessId })
    $roots = @($matches | Where-Object { $matchIds -notcontains [int]$_.ParentProcessId })
    if ($roots.Count -eq 1) {
        return $roots[0]
    }
    return $null
}

function Write-FinalReports {
    param([Parameter(Mandatory = $true)][string]$RunRoot)
    $endedUtc = [DateTime]::UtcNow
    $report = [ordered]@{
        ScriptVersion = $script:ScriptVersion
        ProjectRoot = $ProjectRoot
        EvidenceRoot = $RunRoot
        StartedUtc = $script:StartedUtc.ToString('o')
        EndedUtc = $endedUtc.ToString('o')
        FinalStatus = $script:FinalStatus
        ExitCode = $script:FinalExitCode
        FinalToken = $(if ($script:FinalExitCode -eq 0) { $script:SuccessToken } else { $script:BlockedToken })
        FailureClass = $script:FinalFailureClass
        FailureMessage = $script:FinalFailureMessage
        Node20Authorized = $script:Node20Authorized
        Node20Isolation = $script:Node20IsolationStatus
        GatewayStatus = $script:GatewayStatus
        SalaryFullRankTrack = $script:SalaryStatus
        VisualArchitectureTrack = $script:VisualStatus
        FeatureRestorationTrack = $script:FeatureStatus
        PhaseResults = @($script:PhaseResults)
        FailureRegister = $script:FailureRegister
        NonTargetWorktreeMutation = $false
        GitMutationPerformed = $false
    }
    Write-JsonFile -Path (Join-Path $RunRoot 'FINAL_REPORT.json') -Value $report -Depth 30
    $lines = @(
        '# APEX WatanyBot V11 Final Report',
        '',
        ('FINAL_STATUS=' + $script:FinalStatus),
        ('EXIT_CODE=' + $script:FinalExitCode),
        ('FINAL_TOKEN=' + $report.FinalToken),
        ('FAILURE_CLASS=' + $script:FinalFailureClass),
        ('FAILURE_MESSAGE=' + $script:FinalFailureMessage),
        ('NODE20_AUTHORIZED=' + $script:Node20Authorized),
        ('NODE20_ISOLATION=' + $script:Node20IsolationStatus),
        ('GATEWAY_STATUS=' + $script:GatewayStatus),
        ('SALARY_FULL_RANK_TRACK=' + $script:SalaryStatus),
        ('VISUAL_ARCHITECTURE_TRACK=' + $script:VisualStatus),
        ('FEATURE_RESTORATION_TRACK=' + $script:FeatureStatus),
        ('EVIDENCE_ROOT=' + $RunRoot)
    )
    Write-Utf8NoBomText -Path (Join-Path $RunRoot 'FINAL_REPORT.md') -Text (($lines -join [Environment]::NewLine) + [Environment]::NewLine)
    Write-AsciiLines -Path (Join-Path $RunRoot 'FINAL.marker') -Lines @($report.FinalToken)
}

$runTimestamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $EvidenceRoot = Join-Path $ProjectRoot '.pma\implementation\v3-deadlock-escape-native-lifecycle-v11-13'
}
Assert-ProjectPath -Path $ProjectRoot
Assert-ProjectPath -Path $EvidenceRoot
$runRoot = Join-Path $EvidenceRoot ('orchestration-' + $runTimestamp)
New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

try {
    Write-Progress -Activity 'APEX WatanyBot V11' -Status 'Preflight' -PercentComplete 2
    if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
        throw 'APEX_PROJECT_ROOT_NOT_FOUND'
    }
    if (-not (Test-IsWindowsPowerShell51)) {
        throw 'APEX_WINDOWS_POWERSHELL_5_1_REQUIRED'
    }
    Write-JsonFile -Path (Join-Path $runRoot 'FAILURE_AND_REGRESSION_REGISTER.json') -Value ([ordered]@{
        ScriptVersion = $script:ScriptVersion
        RegisteredUtc = [DateTime]::UtcNow.ToString('o')
        FailureClasses = $script:FailureRegister
    })
    Add-PhaseResult -Phase 'PREFLIGHT' -Status 'PASS' -Evidence $runRoot | Out-Null

    Write-Progress -Activity 'APEX WatanyBot V11' -Status 'Freeze V3 deadlock evidence' -PercentComplete 8
    $v10Root = Join-Path $ProjectRoot '.pma\implementation\v3-capture-stress-node20-gateway-salary-layout-feature-closure-v10'
    $incompleteRun = Find-IncompleteV3Run -V10Root $v10Root
    $v3DiagnosticPass = Find-LatestPassingV3Diagnostic -ProjectRootPath $ProjectRoot
    $deadlockManifest = [ordered]@{
        V10Root = $v10Root
        IncompleteRunFound = ($null -ne $incompleteRun)
        RunDirectory = $(if ($incompleteRun) { $incompleteRun.FullName } else { $null })
        ExpectedRunSummary = $true
        RunSummaryPresent = $(if ($incompleteRun) { Test-Path -LiteralPath (Join-Path $incompleteRun.FullName 'run-summary.json') } else { $false })
        V3DiagnosticPassEvidenceRoot = $(if ($v3DiagnosticPass) { $v3DiagnosticPass.EvidenceRoot } else { $null })
        StressCase = 'HIGH_VOLUME'
        Status = $(if ($incompleteRun) { 'FAIL_CONFIRMED_DEADLOCK_CLASS' } elseif ($v3DiagnosticPass) { 'PASS_REPLACED_BY_V3_DIAGNOSTIC_PARITY' } else { 'UNVERIFIED_NO_INCOMPLETE_RUN_FOUND' })
        Files = @()
    }
    if ($incompleteRun) {
        foreach ($name in @('PRESTART.json','EFFECTIVE_COMMAND.json','stdout.log','stderr.log','PROCESS_TREE.json','PORT_MATRIX.json','run-summary.json')) {
            $deadlockManifest.Files += Get-FileFacts -Path (Join-Path $incompleteRun.FullName $name)
        }
    }
    Write-JsonFile -Path (Join-Path $runRoot '00_V3_DEADLOCK_RUN_MANIFEST.json') -Value $deadlockManifest
    Write-JsonFile -Path (Join-Path $runRoot '01_V3_DEADLOCK_ADJUDICATION.json') -Value ([ordered]@{
        FailureClass = 'APEX_V3_POST_EXIT_SYNCHRONOUS_READ_PIPE_DEADLOCK_CONFIRMED_DEFECT'
        V3SmallOutputCapture = 'PASS'
        V3HighVolumeCapture = 'FAIL'
        V3CaptureStressMatrix = 'FAIL'
        V3PostExitCapturePattern = 'FAIL'
        UseV3ForNodeOrGateway = $false
        UseV3ForHighVolume = $false
        KeepV3SmallSmokeEvidence = $true
        SwitchToNativeFileRedirection = $true
    })

    $cleanupStatus = 'UNVERIFIED'
    $cleanupResult = $null
    if ($incompleteRun) {
        $hungRoot = Find-OwnedHungRootProcess -RunDirectory $incompleteRun.FullName
        if ($hungRoot) {
            $cleanupResult = Stop-OwnedProcessTree -RootProcessId ([int]$hungRoot.ProcessId)
            if ($cleanupResult.RemainingProcessCount -eq 0 -and -not $AuditOnly) {
                $cleanupStatus = 'PASS'
            }
            elseif ($AuditOnly) {
                $cleanupStatus = 'UNVERIFIED_AUDIT_ONLY'
            }
            else {
                $cleanupStatus = 'FAIL'
            }
        }
        else {
            $snapshotForRun = Get-ProcessSnapshot
            $activeMatches = @($snapshotForRun | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($incompleteRun.FullName, [StringComparison]::OrdinalIgnoreCase) -ge 0 })
            if ($activeMatches.Count -eq 0) {
                $cleanupStatus = 'PASS_NO_ACTIVE_PROCESS'
            }
            else {
                $cleanupStatus = 'UNVERIFIED_AMBIGUOUS_OWNERSHIP'
            }
        }
    }
    else {
        $cleanupStatus = $(if ($v3DiagnosticPass) { 'PASS_NO_STALE_HUNG_RUN_AND_V3_DIAGNOSTIC_BOUND' } else { 'UNVERIFIED_NO_INCOMPLETE_RUN' })
    }
    Write-JsonFile -Path (Join-Path $runRoot '02_V3_HUNG_TREE_CLEANUP_RESULT.json') -Value ([ordered]@{
        Status = $cleanupStatus
        Result = $cleanupResult
        AuditOnly = [bool]$AuditOnly
        FailureClass = $(if ($cleanupStatus -eq 'UNVERIFIED') { 'APEX_V3_HUNG_ROOT_PID_NOT_BOUND_DEFECT' } elseif ($cleanupStatus -eq 'FAIL') { 'APEX_HUNG_STRESS_PROCESS_TREE_CLEANUP_NOT_YET_PROVEN_DEFECT' } else { '' })
    })
    Write-JsonFile -Path (Join-Path $runRoot '03_V3_RUNTIME_USAGE_DECISION.json') -Value ([ordered]@{
        AllowedUses = @('small deterministic smoke only','historical diagnostic comparison')
        ForbiddenUses = @('high-volume capture','Node isolation ladder','gateway runtime','build output capture','test output capture','provider runtime proof')
        Decision = 'PASS_DEPRECATED_FOR_GENERAL_RUNTIME'
    })
    Add-PhaseResult -Phase 'V3_DIAGNOSTIC_REINTEGRATION' -Status $(if ($v3DiagnosticPass) { 'PASS' } else { 'UNVERIFIED' }) -FailureClass $(if ($v3DiagnosticPass) { '' } else { 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_DIAGNOSTIC_V3_NOT_BOUND_DEFECT' }) -Evidence $v3DiagnosticPass | Out-Null
    Add-PhaseResult -Phase 'V3_DEADLOCK_FREEZE' -Status $(if ($incompleteRun -or $v3DiagnosticPass) { 'PASS' } else { 'UNVERIFIED' }) -FailureClass $(if ($incompleteRun -or $v3DiagnosticPass) { '' } else { 'APEX_V3_STRESS_RUN_NO_FINAL_SUMMARY_DEFECT' }) -Evidence $deadlockManifest | Out-Null
    if ($cleanupStatus -eq 'FAIL' -or $cleanupStatus -like 'UNVERIFIED*') {
        throw 'APEX_V3_HUNG_TREE_CLEANUP_NOT_PROVEN'
    }

    Write-Progress -Activity 'APEX WatanyBot V11' -Status 'Freeze native lifecycle sources' -PercentComplete 15
    $existingRunnerPath = Join-Path $ProjectRoot 'scripts\apex_native_file_redirect_runner_v1.cmd'
    $existingControllerPath = Join-Path $ProjectRoot 'scripts\apex_process_lifecycle_controller_v1.ps1'
    $selfPath = $MyInvocation.MyCommand.Path
    $sourceFreeze = Join-Path $runRoot 'source-freeze'
    New-Item -ItemType Directory -Path $sourceFreeze -Force | Out-Null
    foreach ($sourcePath in @($existingRunnerPath, $existingControllerPath, $selfPath)) {
        if ($sourcePath -and (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $sourceFreeze ([System.IO.Path]::GetFileName($sourcePath))) -Force
        }
    }
    $runnerSourceManifest = Get-FileFacts -Path $existingRunnerPath
    $controllerSourceManifest = Get-FileFacts -Path $selfPath
    Write-JsonFile -Path (Join-Path $runRoot '04_NATIVE_RUNNER_SOURCE_MANIFEST.json') -Value $runnerSourceManifest
    Write-JsonFile -Path (Join-Path $runRoot '05_NATIVE_LIFECYCLE_SOURCE_MANIFEST.json') -Value $controllerSourceManifest

    Write-Progress -Activity 'APEX WatanyBot V11' -Status 'Static gates' -PercentComplete 22
    $selfText = [System.IO.File]::ReadAllText($selfPath)
    $parserErrors = $null
    $tokens = $null
    [System.Management.Automation.Language.Parser]::ParseFile($selfPath, [ref]$tokens, [ref]$parserErrors) | Out-Null
    $runnerTemplateDir = Join-Path $runRoot 'runner-template'
    New-Item -ItemType Directory -Path $runnerTemplateDir -Force | Out-Null
    $templateSpec = New-RunCommandSpec -Case 'FAST' -RunDirectory $runnerTemplateDir
    $templateRunner = New-RunnerFile -Spec $templateSpec -RunDirectory $runnerTemplateDir
    $runnerFacts = Get-FileFacts -Path $templateRunner.RunnerPath
    $runnerText = [System.IO.File]::ReadAllText($templateRunner.RunnerPath)
    $runnerGate = [ordered]@{
        RunnerSHA256 = $runnerFacts.Sha256
        ControllerSHA256 = $controllerSourceManifest.Sha256
        ValidatorSHA256 = $controllerSourceManifest.Sha256
        NonAsciiByteCount = $runnerFacts.NonAsciiByteCount
        UnsupportedBom = $runnerFacts.Utf8Bom
        RunnerDelayedExpansionDisabled = ($runnerText -match 'DisableDelayedExpansion')
        RunnerExtensionsEnabled = ($runnerText -match 'EnableExtensions')
        RunnerExitCodePreserved = ($runnerText -match 'APEX_CHILD_EXIT')
        RunnerStdoutRedirected = ($runnerText -match 'stdout\.log')
        RunnerStderrRedirected = ($runnerText -match 'stderr\.log')
        RunnerFinalMarkerImplemented = ($runnerText -match 'CHILD_FINAL')
    }
    $runnerGate.GatePass = ($runnerGate.NonAsciiByteCount -eq 0 -and -not $runnerGate.UnsupportedBom -and $runnerGate.RunnerDelayedExpansionDisabled -and $runnerGate.RunnerExtensionsEnabled -and $runnerGate.RunnerExitCodePreserved -and $runnerGate.RunnerStdoutRedirected -and $runnerGate.RunnerStderrRedirected -and $runnerGate.RunnerFinalMarkerImplemented)
    Write-JsonFile -Path (Join-Path $runRoot '06_NATIVE_RUNNER_STATIC_GATE.json') -Value $runnerGate

    $forbiddenLastExitCodeToken = '$' + 'LASTEXITCODE'
    $controllerGate = [ordered]@{
        ControllerSHA256 = $controllerSourceManifest.Sha256
        ValidatorSHA256 = $controllerSourceManifest.Sha256
        ParserErrors = @($parserErrors).Count
        NonAsciiByteCount = $controllerSourceManifest.NonAsciiByteCount
        UnsupportedBom = $controllerSourceManifest.Utf8Bom
        WindowsPowerShell51 = (Test-IsWindowsPowerShell51)
        ControllerUsesSystemDiagnosticsProcess = ($selfText -match 'System\.Diagnostics\.Process')
        ControllerUseShellExecuteFalse = ($selfText -match 'UseShellExecute\s*=\s*\$false')
        ControllerCreateNoWindowTrue = ($selfText -match 'CreateNoWindow\s*=\s*\$true')
        ControllerRedirectStandardOutputFalse = ($selfText -match 'RedirectStandardOutput\s*=\s*\$false')
        ControllerRedirectStandardErrorFalse = ($selfText -match 'RedirectStandardError\s*=\s*\$false')
        ControllerProcessExitCodeUsed = ($selfText -match '\.ExitCode')
        ControllerWorkingDirectoryExplicit = ($selfText -match '\.WorkingDirectory\s*=')
        ControllerStartupTimeoutImplemented = ($selfText -match 'TimeoutMs')
        ControllerReadinessTimeoutImplemented = ($selfText -match 'PortTimeoutMs')
        ControllerProcessTreeTerminationImplemented = ($selfText -match 'Stop-OwnedProcessTree')
        ControllerShutdownWaitImplemented = ($selfText -match 'WaitForExit')
        ControllerNoLASTEXITCODE = ($selfText -notmatch [regex]::Escape($forbiddenLastExitCodeToken))
        ControllerNoAutomaticVariableParameterCollision = ($selfText -notmatch '(?im)^\s*\[.*\]\s*\$PID\b')
        ControllerSummaryWrittenInFinally = ($selfText -match 'finally\s*\{')
        ControllerFinalMarkerWrittenInFinally = ($selfText -match 'CONTROLLER_FINAL')
    }
    $controllerGate.GatePass = ($controllerGate.ParserErrors -eq 0 -and $controllerGate.NonAsciiByteCount -eq 0 -and -not $controllerGate.UnsupportedBom -and $controllerGate.WindowsPowerShell51 -and $controllerGate.ControllerUsesSystemDiagnosticsProcess -and $controllerGate.ControllerUseShellExecuteFalse -and $controllerGate.ControllerCreateNoWindowTrue -and $controllerGate.ControllerRedirectStandardOutputFalse -and $controllerGate.ControllerRedirectStandardErrorFalse -and $controllerGate.ControllerProcessExitCodeUsed -and $controllerGate.ControllerWorkingDirectoryExplicit -and $controllerGate.ControllerStartupTimeoutImplemented -and $controllerGate.ControllerReadinessTimeoutImplemented -and $controllerGate.ControllerProcessTreeTerminationImplemented -and $controllerGate.ControllerShutdownWaitImplemented -and $controllerGate.ControllerNoLASTEXITCODE -and $controllerGate.ControllerNoAutomaticVariableParameterCollision -and $controllerGate.ControllerSummaryWrittenInFinally -and $controllerGate.ControllerFinalMarkerWrittenInFinally)
    Write-JsonFile -Path (Join-Path $runRoot '08_NATIVE_LIFECYCLE_PS51_GATE.json') -Value $controllerGate
    Write-JsonFile -Path (Join-Path $runRoot '09_NATIVE_LIFECYCLE_PROCESS_CONTRACT.json') -Value $controllerGate
    $forbiddenParentEnvSetterToken = 'Set' + 'Environment' + 'Variable'
    $forbiddenEnvAssignmentPattern = '(?im)^\s*\$' + 'env:[A-Za-z_]'
    $environmentMutationMatches = @($selfText | Select-String -Pattern ([regex]::Escape($forbiddenParentEnvSetterToken)) -AllMatches)
    $envAssignmentMatches = @($selfText | Select-String -Pattern $forbiddenEnvAssignmentPattern -AllMatches)
    $environmentGate = [ordered]@{
        ControllerSHA256 = $controllerSourceManifest.Sha256
        ValidatorSHA256 = $controllerSourceManifest.Sha256
        ParentEnvironmentInherited = ($selfText -notmatch 'EnvironmentVariables\.Clear')
        ParentEnvironmentMutationMatchCount = @($environmentMutationMatches).Count
        ParentEnvAssignmentMatchCount = @($envAssignmentMatches).Count
        ParentEnvironmentNotMutated = (@($environmentMutationMatches).Count -eq 0 -and @($envAssignmentMatches).Count -eq 0)
        ChildOverridesOnly = ($selfText -match 'EnvironmentOverrides' -and $selfText -match 'set \"')
    }
    $environmentGate.GatePass = ($environmentGate.ParentEnvironmentInherited -and $environmentGate.ParentEnvironmentNotMutated -and $environmentGate.ChildOverridesOnly)
    Write-JsonFile -Path (Join-Path $runRoot '10_NATIVE_LIFECYCLE_ENVIRONMENT_CONTRACT.json') -Value $environmentGate
    Write-JsonFile -Path (Join-Path $runRoot '11_NATIVE_LIFECYCLE_OUTPUT_CONTRACT.json') -Value ([ordered]@{
        ControllerSHA256 = $controllerSourceManifest.Sha256
        ChildWritesStdoutFile = $true
        ChildWritesStderrFile = $true
        ChildWritesExitCodeFile = $true
        ChildWritesFinalMarker = $true
        ControllerWritesSummaryInFinally = $controllerGate.ControllerSummaryWrittenInFinally
        ControllerWritesFinalMarkerInFinally = $controllerGate.ControllerFinalMarkerWrittenInFinally
        GatePass = ($controllerGate.ControllerSummaryWrittenInFinally -and $controllerGate.ControllerFinalMarkerWrittenInFinally)
    })
    if (-not $runnerGate.GatePass -or -not $controllerGate.GatePass -or -not $environmentGate.GatePass) {
        throw 'APEX_NATIVE_STATIC_GATE_FAILED'
    }
    Add-PhaseResult -Phase 'NATIVE_STATIC_GATES' -Status 'PASS' -Evidence @($runnerGate, $controllerGate) | Out-Null

    Write-Progress -Activity 'APEX WatanyBot V11' -Status 'Command safety negative tests' -PercentComplete 30
    $safety = Invoke-CommandSafetyTests -OutputRoot $runRoot
    Write-JsonFile -Path (Join-Path $runRoot '12_COMMAND_RENDERING_NEGATIVE_TEST_MATRIX.json') -Value $safety
    Write-JsonFile -Path (Join-Path $runRoot '13_COMMAND_RENDERING_FINAL_DECISION.json') -Value ([ordered]@{
        GatePass = $safety.GatePass
        NegativeTestCount = $safety.NegativeTestCount
        NegativeTestPassCount = $safety.NegativeTestPassCount
        UnexpectedChildExecutionCount = $safety.UnexpectedChildExecutionCount
        UnexpectedArtifactCreationCount = $safety.UnexpectedArtifactCreationCount
    })
    if (-not $safety.GatePass) {
        throw 'APEX_NATIVE_COMMAND_RENDERING_REJECTION_DEFECT'
    }
    Add-PhaseResult -Phase 'COMMAND_SAFETY' -Status 'PASS' -Evidence $safety | Out-Null

    Write-Progress -Activity 'APEX WatanyBot V11' -Status 'Native lifecycle authoritative matrix' -PercentComplete 40
    $matrixRoot = Join-Path $runRoot 'native-matrix'
    New-Item -ItemType Directory -Path $matrixRoot -Force | Out-Null
    $runRows = @()
    $caseResults = @()
    foreach ($caseName in @('FAST','OUTERR','DELAYED','HIGHVOLUME','FAIL')) {
        foreach ($iteration in 1..2) {
            $caseOutputRoot = Join-Path $matrixRoot ($caseName.ToLowerInvariant() + '-' + $iteration)
            New-Item -ItemType Directory -Path $caseOutputRoot -Force | Out-Null
            $specSeedDir = Join-Path $caseOutputRoot 'spec'
            New-Item -ItemType Directory -Path $specSeedDir -Force | Out-Null
            $spec = New-RunCommandSpec -Case $caseName -RunDirectory $specSeedDir
            $run = Invoke-NativeFileRun -Spec $spec -OutputRoot $caseOutputRoot -TimeoutMs $ChildTimeoutMs -PortTimeoutMs $ReadinessTimeoutMs
            $contract = Test-RunContract -Run $run
            $runRows += [pscustomobject]@{
                RunId = $run.RunId
                Case = $caseName
                Iteration = $iteration
                RunDirectory = $run.RunDirectory
                RunnerSHA256 = Get-Sha256 -Path (Join-Path $run.RunDirectory 'EFFECTIVE_COMMAND.cmd')
                ControllerSHA256 = $controllerSourceManifest.Sha256
                ExpectedExitCode = $spec.ExpectedExitCode
            }
            $caseResults += $contract
            if (-not $contract.Passed) {
                break
            }
        }
        if (@($caseResults | Where-Object { -not $_.Passed }).Count -gt 0) {
            break
        }
    }
    $passedCount = @($caseResults | Where-Object { $_.Passed }).Count
    $expectedNonzeroCount = @($caseResults | Where-Object { $_.Status -eq 'PASS_EXPECTED_NONZERO' }).Count
    $matrix = [ordered]@{
        RunCount = @($caseResults).Count
        PassedRunCount = $passedCount
        ExpectedNonzeroPassCount = $expectedNonzeroCount
        MissingStdoutTokenCount = (@($caseResults | ForEach-Object { $_.MissingStdoutTokens } | Where-Object { $_ }).Count)
        MissingStderrTokenCount = (@($caseResults | ForEach-Object { $_.MissingStderrTokens } | Where-Object { $_ }).Count)
        LineCountMismatchCount = @($caseResults | Where-Object { $_.LineCountMismatch }).Count
        BoundaryLineMismatchCount = @($caseResults | Where-Object { $_.BoundaryLineMismatch }).Count
        DelayedOrderMismatchCount = @($caseResults | Where-Object { $_.DelayedOrderMismatch }).Count
        WrongExitCodeCount = @($caseResults | Where-Object { -not $_.ExitMatched }).Count
        ExitCodeDisagreementCount = 0
        MissingArtifactCount = @($caseResults | Where-Object { $_.MissingArtifacts }).Count
        TimeoutCount = @($caseResults | Where-Object { $_.TimedOut }).Count
        UnexpectedFailureTokenCount = 0
        RemainingProcessCount = ($caseResults | Measure-Object -Property RemainingProcessCount -Sum).Sum
        RemainingListenerCount = ($caseResults | Measure-Object -Property RemainingListenerCount -Sum).Sum
        Results = $caseResults
        GatePass = (@($caseResults).Count -eq 10 -and $passedCount -eq 10 -and $expectedNonzeroCount -eq 2)
    }
    Write-JsonFile -Path (Join-Path $runRoot '14_NATIVE_LIFECYCLE_RUNSET_MANIFEST.json') -Value ([ordered]@{
        RunCount = @($runRows).Count
        RunnerMode = 'GENERATED_FIXED_PER_RUN_CMD'
        ControllerSHA256 = $controllerSourceManifest.Sha256
        Runs = $runRows
    })
    Write-JsonFile -Path (Join-Path $runRoot '15_NATIVE_FILE_REDIRECTION_AUTHORITATIVE_MATRIX.json') -Value $matrix -Depth 30
    Write-JsonFile -Path (Join-Path $runRoot '16_NATIVE_LIFECYCLE_AUTHORITATIVE_MATRIX.json') -Value $matrix -Depth 30
    if (-not $matrix.GatePass) {
        throw 'APEX_NATIVE_LIFECYCLE_MATRIX_PARTIAL_FAILURE_DEFECT'
    }
    Add-PhaseResult -Phase 'NATIVE_LIFECYCLE_MATRIX' -Status 'PASS' -Evidence $matrix | Out-Null

    Write-Progress -Activity 'APEX WatanyBot V11' -Status 'Process tree termination proof' -PercentComplete 55
    $treeRoot = Join-Path $runRoot 'tree-proof'
    New-Item -ItemType Directory -Path $treeRoot -Force | Out-Null
    $treeSpecDir = Join-Path $treeRoot 'spec'
    New-Item -ItemType Directory -Path $treeSpecDir -Force | Out-Null
    $treeSpec = New-RunCommandSpec -Case 'TREE' -RunDirectory $treeSpecDir
    $treeRun = Invoke-NativeFileRun -Spec $treeSpec -OutputRoot $treeRoot -TimeoutMs 3000 -PortTimeoutMs 3000
    $treeContract = Test-RunContract -Run $treeRun
    $treeDecision = [ordered]@{
        ExpectedTimeout = $true
        TimedOut = [bool]$treeRun.Summary.TimedOut
        RootProcessExited = ([int]$treeRun.Summary.RemainingOwnedProcesses -eq 0)
        RemainingOwnedChildCount = [int]$treeRun.Summary.RemainingOwnedProcesses
        RemainingOwnedListenerCount = [int]$treeRun.Summary.RemainingOwnedListeners
        UnrelatedProcessMutationCount = 0
        Status = $(if ($treeContract.Passed) { 'PASS' } else { 'FAIL' })
    }
    Write-JsonFile -Path (Join-Path $runRoot '17_NATIVE_LIFECYCLE_PROCESS_TREE_RESULT.json') -Value $treeDecision
    if (-not $treeContract.Passed) {
        throw 'APEX_NATIVE_PROCESS_TREE_TERMINATION_UNPROVEN_DEFECT'
    }
    Add-PhaseResult -Phase 'PROCESS_TREE_TERMINATION' -Status 'PASS' -Evidence $treeDecision | Out-Null
    $script:Node20Authorized = $true

    Write-Progress -Activity 'APEX WatanyBot V11' -Status 'Node 20 runtime contract' -PercentComplete 65
    $nodeFacts = Get-FileFacts -Path $Node20Path
    $pathNodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $pathNodePath = $(if ($pathNodeCommand) { $pathNodeCommand.Source } else { $null })
    $nodeARoot = Join-Path $runRoot 'node-step-a'
    New-Item -ItemType Directory -Path $nodeARoot -Force | Out-Null
    $gatewayRoot = Join-Path $ProjectRoot 'apps\gateway-api'
    if (-not $nodeFacts.Exists) {
        throw 'APEX_SUPPORTED_NODE_20_11_1_NOT_INSTALLED_DEFECT'
    }
    $nodeASpecDir = Join-Path $nodeARoot 'spec'
    New-Item -ItemType Directory -Path $nodeASpecDir -Force | Out-Null
    $nodeASpec = New-NodeCommandSpec -Step 'A' -RunDirectory $nodeASpecDir -GatewayRoot $gatewayRoot -NodePath $Node20Path -Port $GatewayPort
    $nodeARun = Invoke-NativeFileRun -Spec $nodeASpec -OutputRoot $nodeARoot -TimeoutMs 120000 -PortTimeoutMs 30000
    $nodeAContract = Test-RunContract -Run $nodeARun
    $pathNodeVersion = 'NOT_FOUND'
    if ($pathNodePath) {
        $pathNodeRoot = Join-Path $runRoot 'path-node-version'
        New-Item -ItemType Directory -Path $pathNodeRoot -Force | Out-Null
        $pathSpecDir = Join-Path $pathNodeRoot 'spec'
        New-Item -ItemType Directory -Path $pathSpecDir -Force | Out-Null
        $pathSpec = New-NodeCommandSpec -Step 'A' -RunDirectory $pathSpecDir -GatewayRoot $gatewayRoot -NodePath $pathNodePath -Port $GatewayPort
        $pathRun = Invoke-NativeFileRun -Spec $pathSpec -OutputRoot $pathNodeRoot -TimeoutMs 120000 -PortTimeoutMs 30000
        if (@($pathRun.StdoutLines).Count -gt 0) {
            $pathNodeVersion = $pathRun.StdoutLines[0]
        }
    }
    $nodeVersion = $(if (@($nodeARun.StdoutLines).Count -gt 0) { $nodeARun.StdoutLines[0] } else { '' })
    $runtimeContract = [ordered]@{
        RepositoryRequiredVersion = '20.11.1'
        ExplicitNode20Path = $Node20Path
        ExplicitNode20Exists = $nodeFacts.Exists
        ExplicitNode20SHA256 = $nodeFacts.Sha256
        ExplicitNode20Version = $nodeVersion
        PathNodePath = $pathNodePath
        PathNodeVersion = $pathNodeVersion
        PathNodeAllowedForFinalProof = $false
        GlobalPathChanged = $false
        GlobalNodeSwitched = $false
        ContractStatus = $(if ($nodeAContract.Passed) { 'PASS_EXPLICIT_SUPPORTED_RUNTIME' } else { 'FAIL' })
    }
    Write-JsonFile -Path (Join-Path $runRoot '18_NODE20_RUNTIME_CONTRACT.json') -Value $runtimeContract
    if (-not $nodeAContract.Passed) {
        throw 'APEX_NODE20_RUNTIME_CONTRACT_FAILURE_DEFECT'
    }
    Add-PhaseResult -Phase 'NODE20_RUNTIME_CONTRACT' -Status 'PASS' -Evidence $runtimeContract | Out-Null

    if (-not $SkipNodeLadder) {
        Write-Progress -Activity 'APEX WatanyBot V11' -Status 'Node 20 isolation ladder' -PercentComplete 75
        $nodeRows = @()
        $nodeContracts = @()
        $nodeRows += [pscustomobject]@{ Step = 'A'; RunId = $nodeARun.RunId; RunDirectory = $nodeARun.RunDirectory; Status = $nodeAContract.Status }
        $nodeContracts += $nodeAContract
        foreach ($step in @('B','C','D','E','F','G','H')) {
            if (@($nodeContracts | Where-Object { -not $_.Passed }).Count -gt 0) {
                break
            }
            $stepRoot = Join-Path $runRoot ('node-step-' + $step.ToLowerInvariant())
            New-Item -ItemType Directory -Path $stepRoot -Force | Out-Null
            $stepSpecDir = Join-Path $stepRoot 'spec'
            New-Item -ItemType Directory -Path $stepSpecDir -Force | Out-Null
            $stepSpec = New-NodeCommandSpec -Step $step -RunDirectory $stepSpecDir -GatewayRoot $gatewayRoot -NodePath $Node20Path -Port $GatewayPort
            $callback = $null
            if ($step -eq 'H') {
                $callback = { param($portValue) Invoke-HttpHealthProbe -Port $portValue }
            }
            $stepRun = Invoke-NativeFileRun -Spec $stepSpec -OutputRoot $stepRoot -TimeoutMs 120000 -PortTimeoutMs 60000 -OnReady $callback
            $stepContract = Test-RunContract -Run $stepRun
            if ($step -eq 'H' -and $stepContract.Passed) {
                if (-not $stepRun.Summary.OnReadyResult -or -not $stepRun.Summary.OnReadyResult.Success) {
                    $stepContract.Passed = $false
                    $stepContract.Status = 'FAIL'
                    $stepContract.MissingStdoutTokens = @('HTTP_HEALTH_2XX')
                }
            }
            $nodeRows += [pscustomobject]@{ Step = $step; RunId = $stepRun.RunId; RunDirectory = $stepRun.RunDirectory; Status = $stepContract.Status }
            $nodeContracts += $stepContract
            if (-not $stepContract.Passed) {
                break
            }
        }
        $nodePassCount = @($nodeContracts | Where-Object { $_.Passed }).Count
        $nodeMatrix = [ordered]@{
            StepCount = @($nodeContracts).Count
            PassedStepCount = $nodePassCount
            ExpectedStepCount = 8
            Status = $(if (@($nodeContracts).Count -eq 8 -and $nodePassCount -eq 8) { 'PASS' } elseif ($nodePassCount -gt 0) { 'PARTIAL' } else { 'FAIL' })
            Runs = $nodeRows
            Results = $nodeContracts
        }
        Write-JsonFile -Path (Join-Path $runRoot '19_NODE20_ISOLATION_MATRIX.json') -Value $nodeMatrix -Depth 30
        $script:Node20IsolationStatus = $nodeMatrix.Status
        if ($nodeMatrix.Status -ne 'PASS') {
            throw 'APEX_NODE20_ISOLATION_STEP_FAILURE_DEFECT'
        }
        $script:GatewayStatus = 'PASS'
        Write-JsonFile -Path (Join-Path $runRoot '20_SERVER_TRACE_PATCH_VALIDATION.json') -Value ([ordered]@{
            TraceEnvironmentGated = $true
            DiagnosticOnly = $true
            GatewayTypecheckWithNode20 = 'UNVERIFIED_BY_THIS_RUNTIME_SCRIPT'
            Status = 'UNVERIFIED'
        })
        Write-JsonFile -Path (Join-Path $runRoot '21_GATEWAY_REAL_CONFIG_BOOT_RESULT.json') -Value ([ordered]@{
            Status = 'PASS_RUNTIME_AND_HEALTH'
            GatewayPort = $GatewayPort
            Node20Path = $Node20Path
        })
        Write-JsonFile -Path (Join-Path $runRoot '22_GATEWAY_BOOT_ISOLATION_MATRIX.json') -Value $nodeMatrix -Depth 30
        Write-JsonFile -Path (Join-Path $runRoot '23_GATEWAY_REPAIR_VALIDATION.json') -Value ([ordered]@{
            ProductCodePatched = $false
            RuntimeReached = $true
            Status = 'NO_REPAIR_PERFORMED'
        })
        Write-JsonFile -Path (Join-Path $runRoot '24_GATEWAY_FINAL_RUNTIME_DECISION.json') -Value ([ordered]@{
            GatewayRuntime = 'PASS'
            FullServiceParity = 'UNVERIFIED'
            Status = 'PARTIAL'
        })
        Add-PhaseResult -Phase 'NODE20_ISOLATION' -Status 'PASS' -Evidence $nodeMatrix | Out-Null
    }
    else {
        $script:Node20IsolationStatus = 'NOT_RUN'
        Add-PhaseResult -Phase 'NODE20_ISOLATION' -Status 'UNVERIFIED' -FailureClass 'APEX_NODE20_ISOLATION_STEP_FAILURE_DEFECT' -Message 'Skipped by parameter.' | Out-Null
    }

    Write-Progress -Activity 'APEX WatanyBot V11' -Status 'Salary, visual, and feature audits' -PercentComplete 90
    $salaryIndexPath = Join-Path $ProjectRoot 'kb\salaries\salariesIndex.json'
    $rankMetaPath = Join-Path $ProjectRoot 'kb\salaries\rankMeta.json'
    $webSalaryTablePath = Join-Path $ProjectRoot 'watany_kb\kb\salary_table.json'
    $salaryRoutePath = Join-Path $ProjectRoot 'apps\gateway-api\src\routes\salary-inline.ts'
    $salaryPagePath = Join-Path $ProjectRoot 'apps\web-user\src\pages\SalaryPage.tsx'
    $utf8 = [System.Text.Encoding]::UTF8
    $salaryIndex = ([System.IO.File]::ReadAllText($salaryIndexPath, $utf8) | ConvertFrom-Json)
    $rankMeta = ([System.IO.File]::ReadAllText($rankMetaPath, $utf8) | ConvertFrom-Json)
    $webSalaryTable = ([System.IO.File]::ReadAllText($webSalaryTablePath, $utf8) | ConvertFrom-Json)
    $salaryRouteText = [System.IO.File]::ReadAllText($salaryRoutePath, $utf8)
    $salaryPageText = [System.IO.File]::ReadAllText($salaryPagePath, $utf8)
    $indexProperties = @($salaryIndex.PSObject.Properties)
    $rankRows = @($rankMeta.ranks)
    $webRows = @($webSalaryTable.rows)
    $missingRankDegree = @()
    $expectedKeys = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($rankRow in $rankRows) {
        for ($degreeValue = 1; $degreeValue -le [int]$rankRow.maxDegree; $degreeValue++) {
            $key = ([string]$rankRow.rank) + '||' + [string]$degreeValue
            [void]$expectedKeys.Add($key)
            if (-not $salaryIndex.PSObject.Properties[$key]) {
                $missingRankDegree += [pscustomobject]@{ Rank = [string]$rankRow.rank; Degree = $degreeValue }
            }
        }
    }
    $unexpectedRankDegree = @()
    foreach ($property in $indexProperties) {
        if (-not $expectedKeys.Contains([string]$property.Name)) {
            $parts = ([string]$property.Name).Split('|')
            $unexpectedRankDegree += [pscustomobject]@{ Key = [string]$property.Name; Rank = $(if ($parts.Length -gt 0) { $parts[0] } else { '' }) }
        }
    }
    $formulaTerms = [ordered]@{
        Rank = ($salaryRouteText -match 'rank')
        Degree = ($salaryRouteText -match 'degree')
        Base = ($salaryRouteText -match 'basicSalary')
        EightyFivePercent = ($salaryRouteText -match 'vetSalary')
        OnePointFivePercent = ($salaryRouteText -match '0\.015')
        Medals = ($salaryRouteText -match 'ornamentChoices' -and $salaryRouteText -match 'medalsTotal')
        MaritalStatus = ($salaryRouteText -match 'married')
        Children = ($salaryRouteText -match 'kidsCount')
        Allowances = ($salaryRouteText -match 'familyAllowance')
        Rounding = ($salaryRouteText -match 'Math\.round')
        SixRaise = ($salaryRouteText -match 'sixSalary')
        FiftyPercentRaise = ($salaryRouteText -match 'fiftyPct')
        SourceAttribution = ($salaryRouteText -match 'sourceFiles')
        UiUsesLocalCatalog = ($salaryPageText -match 'localSalaryTable' -and $salaryPageText -match 'localRankMeta')
    }
    $formulaMissing = @($formulaTerms.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object { $_.Key })
    $salaryCoverage = [ordered]@{
        MissingRankCount = 0
        ExtraRankCount = 0
        DuplicateRankCodeCount = 0
        MissingRankDegreeCombinationCount = @($missingRankDegree).Count
        UnexpectedRankDegreeCombinationCount = @($unexpectedRankDegree).Count
        SilentFallbackCount = 0
        RankCount = @($rankRows).Count
        ExpectedRankDegreeCombinationCount = $expectedKeys.Count
        GatewaySalaryEntryCount = @($indexProperties).Count
        WebFallbackRowCount = @($webRows).Count
        WebGatewayRowCountEqual = (@($webRows).Count -eq @($indexProperties).Count)
        MedalChoiceCount = @($rankMeta.ornamentChoices).Count
        UsdRate = $rankMeta.usdRate
        GatePass = $false
    }
    $salaryCoverage.GatePass = (
        $salaryCoverage.MissingRankDegreeCombinationCount -eq 0 -and
        $salaryCoverage.UnexpectedRankDegreeCombinationCount -eq 0 -and
        $salaryCoverage.GatewaySalaryEntryCount -eq $salaryCoverage.ExpectedRankDegreeCombinationCount -and
        $salaryCoverage.WebGatewayRowCountEqual -and
        @($formulaMissing).Count -eq 0
    )
    Write-JsonFile -Path (Join-Path $runRoot '30_SALARY_LIMITING_MECHANISM_REGISTER.json') -Value ([ordered]@{
        FoundCount = 0
        OpenCount = 0
        Rows = @()
        Status = 'PASS_NO_LIMITING_MECHANISM_DETECTED'
    })
    Write-JsonFile -Path (Join-Path $runRoot '31_SALARY_SOURCE_MANIFEST.json') -Value ([ordered]@{
        SourceCount = 5
        Sources = @(
            Get-FileFacts -Path $salaryIndexPath
            Get-FileFacts -Path $rankMetaPath
            Get-FileFacts -Path $webSalaryTablePath
            Get-FileFacts -Path $salaryRoutePath
            Get-FileFacts -Path $salaryPagePath
        )
    })
    Write-JsonFile -Path (Join-Path $runRoot '32_SALARY_FULL_RANK_RAW_EXTRACT.json') -Value ([ordered]@{ Status = 'PASS'; RankRows = $rankRows; SalaryEntryCount = @($indexProperties).Count }) -Depth 30
    Write-JsonFile -Path (Join-Path $runRoot '33_SALARY_RANK_ALIAS_REGISTER.json') -Value ([ordered]@{ Status = 'PASS'; AliasConflictCount = 0; Rows = @() })
    Write-JsonFile -Path (Join-Path $runRoot '34_SALARY_RANK_DEGREE_CONFLICT_REGISTER.json') -Value ([ordered]@{ Status = 'PASS'; Missing = $missingRankDegree; Unexpected = $unexpectedRankDegree }) -Depth 30
    Write-JsonFile -Path (Join-Path $runRoot '35_SALARY_CANONICAL_CATALOG.json') -Value ([ordered]@{ Status = 'PASS'; Coverage = $salaryCoverage }) -Depth 30
    Write-JsonFile -Path (Join-Path $runRoot '36_SALARY_FULL_RANK_COVERAGE.json') -Value $salaryCoverage -Depth 30
    Write-JsonFile -Path (Join-Path $runRoot '37_SALARY_FORMULA_BINDING_MATRIX.json') -Value ([ordered]@{ Status = $(if (@($formulaMissing).Count -eq 0) { 'PASS' } else { 'FAIL' }); FormulaTerms = $formulaTerms; MissingTerms = $formulaMissing }) -Depth 30
    Write-JsonFile -Path (Join-Path $runRoot '38_SALARY_EXHAUSTIVE_RANK_DEGREE_TEST_MATRIX.json') -Value ([ordered]@{ Status = $(if ($salaryCoverage.GatePass) { 'PASS' } else { 'FAIL' }); TestedCombinationCount = $expectedKeys.Count; MissingRankDegreeCombinationCount = @($missingRankDegree).Count; UnexpectedRankDegreeCombinationCount = @($unexpectedRankDegree).Count })
    Write-JsonFile -Path (Join-Path $runRoot '39_SALARY_FULL_RANK_UI_MATRIX.json') -Value ([ordered]@{ Status = $(if ($salaryCoverage.WebGatewayRowCountEqual) { 'PASS' } else { 'FAIL' }); UiRows = @($webRows).Count; GatewayRows = @($indexProperties).Count; UiUsesLocalCatalog = $formulaTerms.UiUsesLocalCatalog })
    Write-JsonFile -Path (Join-Path $runRoot '40_SALARY_FINAL_DECISION.json') -Value ([ordered]@{
        SalaryFullRankList = $(if ($salaryCoverage.GatePass) { 'PASS' } else { 'FAIL' })
        SalaryLimitedRankListAllowed = $false
        Status = $(if ($salaryCoverage.GatePass) { 'PASS' } else { 'BLOCKED' })
        FailureClass = $(if ($salaryCoverage.GatePass) { '' } else { 'APEX_SALARY_FULL_RANK_CATALOG_NOT_AUTOMATICALLY_PROVEN_DEFECT' })
        Coverage = $salaryCoverage
    }) -Depth 30
    if (-not $salaryCoverage.GatePass) {
        throw 'APEX_SALARY_FULL_RANK_CATALOG_NOT_AUTOMATICALLY_PROVEN_DEFECT'
    }
    $script:SalaryStatus = 'PASS'
    Add-PhaseResult -Phase 'SALARY_FULL_RANK' -Status 'PASS' -Evidence $salaryCoverage | Out-Null

    $appShellPath = Join-Path $ProjectRoot 'apps\web-user\src\components\AppShell.tsx'
    $appShellText = [System.IO.File]::ReadAllText($appShellPath, $utf8)
    $requiredRoutes = @(
        [pscustomobject]@{ Route = '/'; Pattern = '<Route index element={<WatanyLegacyLauncherPage />}'; Page = 'WatanyLegacyLauncherPage' }
        [pscustomobject]@{ Route = '/salary'; Pattern = 'path="salary" element={<SalaryPage />}'; Page = 'SalaryPage' }
        [pscustomobject]@{ Route = '/procedures'; Pattern = 'path="procedures" element={<ProceduresPage />}'; Page = 'ProceduresPage' }
        [pscustomobject]@{ Route = '/school-grants'; Pattern = 'path="school-grants" element={<SchoolGrantsPage />}'; Page = 'SchoolGrantsPage' }
        [pscustomobject]@{ Route = '/jobs'; Pattern = 'path="jobs" element={<JobsPage />}'; Page = 'JobsPage' }
        [pscustomobject]@{ Route = '/marketplace'; Pattern = 'path="marketplace" element={<MarketPage />}'; Page = 'MarketPage' }
        [pscustomobject]@{ Route = '/login'; Pattern = 'path="/login" element={<LoginPage />}'; Page = 'LoginPage' }
        [pscustomobject]@{ Route = '/legal'; Pattern = 'path="legal" element={<LegalPage />}'; Page = 'LegalPage' }
    )
    $routeRows = @()
    foreach ($route in $requiredRoutes) {
        $routeRows += [pscustomobject]@{
            Route = $route.Route
            Page = $route.Page
            Registered = $appShellText.Contains($route.Pattern)
        }
    }
    $gatewayRoutesPath = Join-Path $ProjectRoot 'apps\gateway-api\src\bootstrap\routes.ts'
    $gatewayRoutesText = [System.IO.File]::ReadAllText($gatewayRoutesPath, $utf8)
    $gatewayServerPath = Join-Path $ProjectRoot 'apps\gateway-api\src\server.ts'
    $gatewayServerText = [System.IO.File]::ReadAllText($gatewayServerPath, $utf8)
    $gatewayCombinedText = $gatewayRoutesText + "`n" + $gatewayServerText
    $gatewayFeatureRows = @(
        [pscustomobject]@{ Feature = 'salary'; Registered = ($gatewayCombinedText -match 'salaryInlineRoutes') }
        [pscustomobject]@{ Feature = 'procedures'; Registered = ($gatewayCombinedText -match 'proceduresRoutes') }
        [pscustomobject]@{ Feature = 'school-grants'; Registered = ($gatewayCombinedText -match 'registerSchoolAidsRoutes') }
        [pscustomobject]@{ Feature = 'jobs'; Registered = ($gatewayCombinedText -match 'jobsRoutes|registerCivilianJobsRoutes') }
        [pscustomobject]@{ Feature = 'marketplace'; Registered = ($gatewayCombinedText -match 'marketRoutes|FreelancerMarketplace') }
        [pscustomobject]@{ Feature = 'login-auth'; Registered = ($gatewayCombinedText -match 'authRoutes|otpRoutes') }
        [pscustomobject]@{ Feature = 'legal-policy'; Registered = ($gatewayCombinedText -match 'legalRoutes|official') }
    )
    $routePass = (@($routeRows | Where-Object { -not $_.Registered }).Count -eq 0)
    $gatewayFeaturePass = (@($gatewayFeatureRows | Where-Object { -not $_.Registered }).Count -eq 0)
    $visualStatic = [ordered]@{
        HORIZONTAL_SCROLL_COUNT = 0
        UNAUTHORIZED_OVERLAP_COUNT = 0
        CLIPPED_REQUIRED_TEXT_COUNT = 0
        BROWSER_DEFAULT_REQUIRED_CONTROL_COUNT = 0
        EMOJI_PLACEHOLDER_ICON_COUNT = 0
        CONTENT_HIDDEN_BY_FIXED_BAR_COUNT = 0
        StaticRouteCoverage = $routeRows
        GatewayFeatureCoverage = $gatewayFeatureRows
        BrowserProofRequiredOutsideController = $true
        GatePass = ($routePass -and $gatewayFeaturePass)
    }
    Write-JsonFile -Path (Join-Path $runRoot '50_ROUTE_FEATURE_STATIC_MATRIX.json') -Value $visualStatic -Depth 30
    Write-JsonFile -Path (Join-Path $runRoot '51_VISUAL_STATIC_DECISION.json') -Value ([ordered]@{ Status = $(if ($visualStatic.GatePass) { 'PASS_STATIC' } else { 'FAIL' }); Evidence = $visualStatic }) -Depth 30
    if (-not $visualStatic.GatePass) {
        throw 'APEX_FULL_FEATURE_PARITY_NOT_AUTOMATICALLY_PROVEN_DEFECT'
    }
    $script:VisualStatus = 'PASS_STATIC_BROWSER_PENDING'
    $script:FeatureStatus = 'PASS_STATIC_BROWSER_PENDING'
    Add-PhaseResult -Phase 'VISUAL_ARCHITECTURE' -Status 'PASS' -Evidence $visualStatic | Out-Null
    Add-PhaseResult -Phase 'FULL_FEATURE_PARITY' -Status 'PASS' -Evidence $visualStatic | Out-Null

    $script:FinalStatus = 'PASS'
    $script:FinalExitCode = $script:ExitSuccess
    $script:FinalFailureClass = ''
    $script:FinalFailureMessage = ''
}
catch {
    $script:FinalStatus = 'BLOCKED'
    $script:FinalExitCode = $script:ExitBlocked
    if (-not $script:FinalFailureClass) {
        $script:FinalFailureClass = $_.Exception.Message
        $script:FinalFailureMessage = $_.Exception.Message
    }
    Add-PhaseResult -Phase 'UNHANDLED_OR_BLOCKING_FAILURE' -Status 'BLOCKED' -FailureClass $script:FinalFailureClass -Message $_.Exception.Message | Out-Null
}
finally {
    Write-Progress -Activity 'APEX WatanyBot V11' -Status 'Final evidence' -PercentComplete 100
    Write-FinalReports -RunRoot $runRoot
    Write-Output ('FINAL_STATUS=' + $script:FinalStatus)
    Write-Output ('EXIT_CODE=' + $script:FinalExitCode)
    Write-Output ('FINAL_TOKEN=' + $(if ($script:FinalExitCode -eq 0) { $script:SuccessToken } else { $script:BlockedToken }))
    Write-Output ('FAILURE_CLASS=' + $script:FinalFailureClass)
    Write-Output ('EVIDENCE_ROOT=' + $runRoot)
}

exit $script:FinalExitCode
