[CmdletBinding()]
param(
    [string]$ProjectRoot = 'C:\xampp\htdocs\projectx\watanybot',
    [ValidateRange(5, 20)]
    [int]$ToolhelpIterations = 10,
    [ValidateRange(500, 5000)]
    [int]$ToolhelpFastThresholdMs = 2000,
    [ValidateRange(2000, 15000)]
    [int]$ToolhelpHardMaximumMs = 5000,
    [ValidateRange(1, 20)]
    [int]$ToolhelpRequiredFastCount = 9,
    [ValidateRange(20, 120)]
    [int]$ToolhelpChildHardTimeoutSec = 45,
    [ValidateRange(3, 10)]
    [int]$MetadataIterations = 5,
    [ValidateRange(2, 15)]
    [int]$MetadataOperationTimeoutSec = 5,
    [ValidateRange(5, 30)]
    [int]$MetadataChildHardTimeoutSec = 12
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'Continue'

$script:ScriptVersion = 'v3.0-apex-process-snapshot-runtime-gate-warmup'
$script:SuccessToken = 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_DIAGNOSTIC_V3_COMPLETED'
$script:BlockedToken = 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_DIAGNOSTIC_V3_BLOCKED'
$script:ExitSuccess = 0
$script:ExitBlocked = 97
$script:CurrentProcessId = [int]$PID

$script:FailureRegister = @(
    'APEX_PROJECT_ROOT_NOT_FOUND',
    'APEX_WINDOWS_POWERSHELL_5_1_REQUIRED',
    'APEX_CONTROLLER_LOOP_REAL_CAUSE_NOT_REACHED_DEFECT',
    'APEX_TOOLHELP_COLD_START_COMPILE_LATENCY_MISCLASSIFIED_AS_SNAPSHOT_FAILURE_DEFECT',
    'APEX_TOOLHELP_INITIALIZATION_NOT_SEPARATED_FROM_MEASUREMENT_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_CORRECTNESS_CONFLATED_WITH_PERFORMANCE_DEFECT',
    'APEX_PROCESS_SNAPSHOT_STRATEGY_RUNTIME_GATE_FIRST_ITERATION_WARMUP_NOT_ACCOUNTED_DEFECT',
    'APEX_PROCESS_SNAPSHOT_STRATEGY_RUNTIME_GATE_ARBITRARY_2000MS_THRESHOLD_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_PARSER_FAILED_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_NON_ASCII_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_BOM_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_HELPER_PARSER_FAILED_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_CHILD_START_FAILED_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_CHILD_TIMEOUT_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_CHILD_EXIT_FAILURE_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_RESULT_MISSING_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_TOOLHELP_COMPILE_FAILED_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_TOOLHELP_TYPE_MISSING_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_CURRENT_PROCESS_IDENTITY_MISSING_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_STEADY_STATE_INSUFFICIENT_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_METADATA_TIMEOUT_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_METADATA_EXIT_FAILURE_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_METADATA_IDENTITY_MISMATCH_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_CLEANUP_FAILED_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_GATE_FAILED_DEFECT',
    'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_UNHANDLED_EXCEPTION_DEFECT',
    'APEX_PS51_GET_FILEHASH_CMDLET_UNAVAILABLE_DEFECT',
    'APEX_DIAGNOSTIC_SHA256_DEPENDS_ON_MODULE_AUTOLOAD_DEFECT',
    'APEX_DIAGNOSTIC_HASH_HELPER_NOT_MODULE_INDEPENDENT_DEFECT',
    'APEX_PS7_PARENT_TO_PS51_CHILD_MODULE_PATH_CONTAMINATION_UNVERIFIED_DEFECT',
    'APEX_PS51_CHILD_MODULE_DISCOVERY_CONTRACT_MISSING_DEFECT',
    'APEX_PS51_CHILD_PSMODULEPATH_NOT_CAPTURED_DEFECT',
    'APEX_DIAGNOSTIC_UNHANDLED_GET_FILEHASH_CLASSIFICATION_TOO_GENERIC_DEFECT',
    'APEX_DIAGNOSTIC_EARLY_HASH_FAILURE_BEFORE_COMPLETE_PHASE_EVIDENCE_DEFECT',
    'APEX_ACTIVE_EXECUTION_CHAIN_GET_FILEHASH_NON_RESURFACING_GATE_MISSING_DEFECT',
    'APEX_OUTER_HOST_CHILD_ENVIRONMENT_NOT_EXPLICITLY_BOUND_DEFECT',
    'APEX_DIRECT_PS51_AND_OUTER_HOST_ENVIRONMENT_PARITY_UNPROVEN_DEFECT',
    'APEX_CONTROLLER_LOOP_REAL_CAUSE_NOT_REACHED_DEFECT',
    'APEX_PS51_CHILD_MODULE_DISCOVERY_PROBE_FAILED_DEFECT',
    'APEX_ASCII_WRITER_EMPTY_LINE_BINDING_DEFECT'
)

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

function Write-AsciiLines {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [AllowEmptyString()]
        [string[]]$Lines
    )
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllLines(
        $Path,
        [string[]]@($Lines),
        [System.Text.Encoding]::ASCII
    )
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Value,
        [int]$Depth = 50
    )
    $json = $Value | ConvertTo-Json -Depth $Depth
    Write-Utf8NoBomText -Path $Path -Text (
        $json + [Environment]::NewLine
    )
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

function Get-ApexSha256Bytes {
    param([Parameter(Mandatory = $true)][byte[]]$Bytes)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha.ComputeHash($Bytes)
        $builder = New-Object System.Text.StringBuilder
        foreach ($byte in $hashBytes) {
            [void]$builder.Append($byte.ToString('x2'))
        }
        return $builder.ToString()
    }
    finally {
        if ($null -ne $sha) { $sha.Dispose() }
    }
}

function Test-AsciiFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $nonAscii = 0
    foreach ($byte in $bytes) {
        if ($byte -gt 127) { $nonAscii++ }
    }
    return [pscustomobject]@{
        NonAsciiByteCount = $nonAscii
        Utf8Bom = (
            $bytes.Length -ge 3 -and
            $bytes[0] -eq 0xEF -and
            $bytes[1] -eq 0xBB -and
            $bytes[2] -eq 0xBF
        )
    }
}

function Test-PowerShellParser {
    param([Parameter(Mandatory = $true)][string]$Path)
    $tokens = $null
    $errors = $null
    [void][Management.Automation.Language.Parser]::ParseFile(
        $Path,
        [ref]$tokens,
        [ref]$errors
    )
    return [pscustomobject]@{
        Path = $Path
        ErrorCount = @($errors).Count
        Errors = @(
            $errors | ForEach-Object {
                [pscustomobject]@{
                    Message = $_.Message
                    Extent = $_.Extent.Text
                    StartLine = $_.Extent.StartLineNumber
                    StartColumn = $_.Extent.StartColumnNumber
                }
            }
        )
        GatePass = (@($errors).Count -eq 0)
    }
}

function Resolve-ApexFailureClass {
    param([Parameter(Mandatory = $true)][Exception]$Exception)
    $message = [string]$Exception.Message
    if ($message -match '^(APEX_[A-Z0-9_]+)') {
        return [string]$Matches[1]
    }
    return 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_UNHANDLED_EXCEPTION_DEFECT'
}

function Get-ToolhelpSourceLines {
    return [string[]]@(
        'using System;',
        'using System.Collections.Generic;',
        'using System.Runtime.InteropServices;',
        'namespace ApexSnapshot {',
        '  public sealed class ProcessRow {',
        '    public int ProcessId { get; set; }',
        '    public int ParentProcessId { get; set; }',
        '    public string Name { get; set; }',
        '    public long CreationTimeUtcTicks { get; set; }',
        '    public string IdentityKey { get; set; }',
        '  }',
        '  public static class Toolhelp {',
        '    private const uint SnapshotProcess = 0x00000002;',
        '    private const uint QueryLimitedInformation = 0x1000;',
        '    private static readonly IntPtr InvalidHandle = new IntPtr(-1);',
        '    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]',
        '    private struct ProcessEntry32 {',
        '      public uint Size;',
        '      public uint Usage;',
        '      public uint ProcessId;',
        '      public IntPtr DefaultHeapId;',
        '      public uint ModuleId;',
        '      public uint Threads;',
        '      public uint ParentProcessId;',
        '      public int PriorityBase;',
        '      public uint Flags;',
        '      [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]',
        '      public string ExeFile;',
        '    }',
        '    [DllImport("kernel32.dll", SetLastError = true)]',
        '    private static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);',
        '    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]',
        '    private static extern bool Process32First(IntPtr snapshot, ref ProcessEntry32 entry);',
        '    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]',
        '    private static extern bool Process32Next(IntPtr snapshot, ref ProcessEntry32 entry);',
        '    [DllImport("kernel32.dll", SetLastError = true)]',
        '    private static extern IntPtr OpenProcess(uint access, bool inheritHandle, uint processId);',
        '    [DllImport("kernel32.dll", SetLastError = true)]',
        '    private static extern bool GetProcessTimes(',
        '      IntPtr process,',
        '      out System.Runtime.InteropServices.ComTypes.FILETIME creation,',
        '      out System.Runtime.InteropServices.ComTypes.FILETIME exit,',
        '      out System.Runtime.InteropServices.ComTypes.FILETIME kernel,',
        '      out System.Runtime.InteropServices.ComTypes.FILETIME user);',
        '    [DllImport("kernel32.dll", SetLastError = true)]',
        '    private static extern bool CloseHandle(IntPtr handle);',
        '    private static long ToFileTime(System.Runtime.InteropServices.ComTypes.FILETIME value) {',
        '      return ((long)value.dwHighDateTime << 32) + (uint)value.dwLowDateTime;',
        '    }',
        '    private static long CreationTicks(uint processId) {',
        '      IntPtr process = OpenProcess(QueryLimitedInformation, false, processId);',
        '      if (process == IntPtr.Zero) { return 0; }',
        '      try {',
        '        System.Runtime.InteropServices.ComTypes.FILETIME creation;',
        '        System.Runtime.InteropServices.ComTypes.FILETIME exit;',
        '        System.Runtime.InteropServices.ComTypes.FILETIME kernel;',
        '        System.Runtime.InteropServices.ComTypes.FILETIME user;',
        '        if (!GetProcessTimes(process, out creation, out exit, out kernel, out user)) {',
        '          return 0;',
        '        }',
        '        long fileTime = ToFileTime(creation);',
        '        if (fileTime <= 0) { return 0; }',
        '        long ticks = DateTime.FromFileTimeUtc(fileTime).Ticks;',
        '        return ticks - (ticks % 10);',
        '      } finally {',
        '        CloseHandle(process);',
        '      }',
        '    }',
        '    public static ProcessRow[] Snapshot() {',
        '      List<ProcessRow> rows = new List<ProcessRow>();',
        '      IntPtr snapshot = CreateToolhelp32Snapshot(SnapshotProcess, 0);',
        '      if (snapshot == InvalidHandle) {',
        '        throw new InvalidOperationException("CreateToolhelp32Snapshot failed: " + Marshal.GetLastWin32Error());',
        '      }',
        '      try {',
        '        ProcessEntry32 entry = new ProcessEntry32();',
        '        entry.Size = (uint)Marshal.SizeOf(typeof(ProcessEntry32));',
        '        if (!Process32First(snapshot, ref entry)) {',
        '          throw new InvalidOperationException("Process32First failed: " + Marshal.GetLastWin32Error());',
        '        }',
        '        do {',
        '          int pid = (int)entry.ProcessId;',
        '          long ticks = CreationTicks(entry.ProcessId);',
        '          rows.Add(new ProcessRow {',
        '            ProcessId = pid,',
        '            ParentProcessId = (int)entry.ParentProcessId,',
        '            Name = entry.ExeFile ?? String.Empty,',
        '            CreationTimeUtcTicks = ticks,',
        '            IdentityKey = pid.ToString() + "|" + ticks.ToString()',
        '          });',
        '          entry.Size = (uint)Marshal.SizeOf(typeof(ProcessEntry32));',
        '        } while (Process32Next(snapshot, ref entry));',
        '      } finally {',
        '        CloseHandle(snapshot);',
        '      }',
        '      return rows.ToArray();',
        '    }',
        '  }',
        '}'
    )
}

function New-ToolhelpProbeHelper {
    param([Parameter(Mandatory = $true)][string]$Path)
    Write-AsciiLines -Path $Path -Lines @(
        '[CmdletBinding()]',
        'param(',
        '    [Parameter(Mandatory = $true)][string]$ResultPath,',
        '    [Parameter(Mandatory = $true)][string]$ErrorPath,',
        '    [Parameter(Mandatory = $true)][string]$SourcePath,',
        '    [Parameter(Mandatory = $true)][int]$Iterations,',
        '    [Parameter(Mandatory = $true)][int]$FastThresholdMs,',
        '    [Parameter(Mandatory = $true)][int]$HardMaximumMs,',
        '    [Parameter(Mandatory = $true)][int]$RequiredFastCount',
        ')',
        '',
        'Set-StrictMode -Version 2.0',
        '$ErrorActionPreference = ''Stop''',
        '',
        'function Write-Result {',
        '    param([Parameter(Mandatory = $true)]$Value)',
        '    $json = $Value | ConvertTo-Json -Depth 30',
        '    [IO.File]::WriteAllText(',
        '        $ResultPath,',
        '        $json + [Environment]::NewLine,',
        '        (New-Object Text.UTF8Encoding($false))',
        '    )',
        '}',
        '',
        'try {',
        '    $compileWatch = [Diagnostics.Stopwatch]::StartNew()',
        '    Add-Type -Path $SourcePath -ErrorAction Stop',
        '    $compileWatch.Stop()',
        '',
        '    if (-not (''ApexSnapshot.Toolhelp'' -as [type])) {',
        '        throw ''APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_TOOLHELP_TYPE_MISSING_DEFECT''',
        '    }',
        '',
        '    $current = [Diagnostics.Process]::GetCurrentProcess()',
        '    $startUtc = $current.StartTime.ToUniversalTime()',
        '    $expectedTicks = [int64](',
        '        $startUtc.Ticks - ($startUtc.Ticks % 10)',
        '    )',
        '    $expectedKey = [string]$PID + ''|'' + [string]$expectedTicks',
        '',
        '    $warmWatch = [Diagnostics.Stopwatch]::StartNew()',
        '    $warmRows = @([ApexSnapshot.Toolhelp]::Snapshot())',
        '    $warmWatch.Stop()',
        '    $warmMatches = @(',
        '        $warmRows | Where-Object {',
        '            [int]$_.ProcessId -eq [int]$PID -and',
        '            [string]$_.IdentityKey -eq $expectedKey -and',
        '            [int64]$_.CreationTimeUtcTicks -gt 0',
        '        }',
        '    )',
        '    $warmPass = (',
        '        @($warmRows).Count -gt 0 -and',
        '        @($warmMatches).Count -eq 1',
        '    )',
        '',
        '    $measured = @()',
        '    for ($iteration = 1; $iteration -le $Iterations; $iteration++) {',
        '        $watch = [Diagnostics.Stopwatch]::StartNew()',
        '        $rows = @([ApexSnapshot.Toolhelp]::Snapshot())',
        '        $watch.Stop()',
        '        $matches = @(',
        '            $rows | Where-Object {',
        '                [int]$_.ProcessId -eq [int]$PID -and',
        '                [string]$_.IdentityKey -eq $expectedKey -and',
        '                [int64]$_.CreationTimeUtcTicks -gt 0',
        '            }',
        '        )',
        '        $duration = [int64]$watch.ElapsedMilliseconds',
        '        $identityPass = (',
        '            @($rows).Count -gt 0 -and',
        '            @($matches).Count -eq 1',
        '        )',
        '        $measured += [pscustomobject]@{',
        '            Iteration = $iteration',
        '            DurationMs = $duration',
        '            ProcessCount = @($rows).Count',
        '            CurrentProcessMatchCount = @($matches).Count',
        '            IdentityPass = $identityPass',
        '            FastPass = ($duration -le $FastThresholdMs)',
        '            HardMaximumPass = ($duration -le $HardMaximumMs)',
        '        }',
        '    }',
        '',
        '    $identityPassCount = @(',
        '        $measured | Where-Object { $_.IdentityPass }',
        '    ).Count',
        '    $fastPassCount = @(',
        '        $measured | Where-Object { $_.FastPass }',
        '    ).Count',
        '    $hardPassCount = @(',
        '        $measured | Where-Object { $_.HardMaximumPass }',
        '    ).Count',
        '    $durations = @(',
        '        $measured | ForEach-Object { [int64]$_.DurationMs }',
        '    )',
        '    $minimum = ($durations | Measure-Object -Minimum).Minimum',
        '    $maximum = ($durations | Measure-Object -Maximum).Maximum',
        '    $average = [math]::Round(',
        '        [double](($durations | Measure-Object -Average).Average),',
        '        2',
        '    )',
        '',
        '    $gatePass = (',
        '        $warmPass -and',
        '        @($measured).Count -eq $Iterations -and',
        '        $identityPassCount -eq $Iterations -and',
        '        $fastPassCount -ge $RequiredFastCount -and',
        '        $hardPassCount -eq $Iterations',
        '    )',
        '',
        '    $payload = [ordered]@{',
        '        Status = $(if ($gatePass) { ''PASS'' } else { ''FAIL'' })',
        '        ProcessId = [int]$PID',
        '        ExpectedIdentityKey = $expectedKey',
        '        CompileDurationMs = [int64]$compileWatch.ElapsedMilliseconds',
        '        WarmupDurationMs = [int64]$warmWatch.ElapsedMilliseconds',
        '        WarmupProcessCount = @($warmRows).Count',
        '        WarmupCurrentProcessMatchCount = @($warmMatches).Count',
        '        WarmupGatePass = $warmPass',
        '        IterationCount = @($measured).Count',
        '        IdentityPassCount = $identityPassCount',
        '        FastThresholdMs = $FastThresholdMs',
        '        FastPassCount = $fastPassCount',
        '        RequiredFastCount = $RequiredFastCount',
        '        HardMaximumMs = $HardMaximumMs',
        '        HardMaximumPassCount = $hardPassCount',
        '        MinimumDurationMs = $minimum',
        '        MaximumDurationMs = $maximum',
        '        AverageDurationMs = $average',
        '        MeasuredRows = @($measured)',
        '        GatePass = $gatePass',
        '    }',
        '    Write-Result -Value $payload',
        '    if ($gatePass) { exit 0 }',
        '    exit 97',
        '}',
        'catch {',
        '    [IO.File]::WriteAllText(',
        '        $ErrorPath,',
        '        $_.Exception.Message,',
        '        (New-Object Text.UTF8Encoding($false))',
        '    )',
        '    exit 97',
        '}'
    )
}

function New-MetadataProbeHelper {
    param([Parameter(Mandatory = $true)][string]$Path)
    Write-AsciiLines -Path $Path -Lines @(
        '[CmdletBinding()]',
        'param(',
        '    [Parameter(Mandatory = $true)][string]$ResultPath,',
        '    [Parameter(Mandatory = $true)][string]$ErrorPath,',
        '    [Parameter(Mandatory = $true)][int]$TargetProcessId,',
        '    [Parameter(Mandatory = $true)][Int64]$ExpectedCreationTicks,',
        '    [Parameter(Mandatory = $true)][int]$OperationTimeoutSec',
        ')',
        '',
        'Set-StrictMode -Version 2.0',
        '$ErrorActionPreference = ''Stop''',
        '',
        'try {',
        '    $filter = ''ProcessId = '' + [string]$TargetProcessId',
        '    $watch = [Diagnostics.Stopwatch]::StartNew()',
        '    $items = @(',
        '        Get-CimInstance -ClassName Win32_Process -Filter $filter -OperationTimeoutSec $OperationTimeoutSec -ErrorAction Stop',
        '    )',
        '    $watch.Stop()',
        '',
        '    $rows = @(',
        '        $items | ForEach-Object {',
        '            $ticks = [int64]0',
        '            try {',
        '                $dateValue = $null',
        '                if ($_.CreationDate -is [DateTime]) {',
        '                    $dateValue = (',
        '                        [DateTime]$_.CreationDate',
        '                    ).ToUniversalTime()',
        '                }',
        '                else {',
        '                    $dateValue = (',
        '                        [Management.ManagementDateTimeConverter]::ToDateTime(',
        '                            [string]$_.CreationDate',
        '                        )',
        '                    ).ToUniversalTime()',
        '                }',
        '                $ticks = [int64](',
        '                    $dateValue.Ticks - ($dateValue.Ticks % 10)',
        '                )',
        '            }',
        '            catch {',
        '                $ticks = [int64]0',
        '            }',
        '            [pscustomobject]@{',
        '                ProcessId = [int]$_.ProcessId',
        '                ParentProcessId = [int]$_.ParentProcessId',
        '                Name = [string]$_.Name',
        '                CommandLine = [string]$_.CommandLine',
        '                CreationTimeUtcTicks = $ticks',
        '            }',
        '        }',
        '    )',
        '',
        '    $matches = @(',
        '        $rows | Where-Object {',
        '            [int]$_.ProcessId -eq $TargetProcessId -and',
        '            [int64]$_.CreationTimeUtcTicks -eq $ExpectedCreationTicks -and',
        '            -not [string]::IsNullOrWhiteSpace([string]$_.CommandLine)',
        '        }',
        '    )',
        '    $gatePass = (',
        '        @($rows).Count -eq 1 -and',
        '        @($matches).Count -eq 1',
        '    )',
        '',
        '    $payload = [ordered]@{',
        '        Status = $(if ($gatePass) { ''PASS'' } else { ''FAIL'' })',
        '        DurationMs = [int64]$watch.ElapsedMilliseconds',
        '        TargetProcessId = $TargetProcessId',
        '        ExpectedCreationTicks = $ExpectedCreationTicks',
        '        RowCount = @($rows).Count',
        '        MatchCount = @($matches).Count',
        '        Rows = @($rows)',
        '        GatePass = $gatePass',
        '    }',
        '    $json = $payload | ConvertTo-Json -Depth 20',
        '    [IO.File]::WriteAllText(',
        '        $ResultPath,',
        '        $json + [Environment]::NewLine,',
        '        (New-Object Text.UTF8Encoding($false))',
        '    )',
        '    if ($gatePass) { exit 0 }',
        '    exit 97',
        '}',
        'catch {',
        '    [IO.File]::WriteAllText(',
        '        $ErrorPath,',
        '        $_.Exception.Message,',
        '        (New-Object Text.UTF8Encoding($false))',
        '    )',
        '    exit 97',
        '}'
    )
}

function Invoke-BoundedPowerShellChild {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [string[]]$AdditionalArguments,
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [Parameter(Mandatory = $true)][int]$HardTimeoutSec
    )

    New-Item -ItemType Directory -Path $RunDirectory -Force | Out-Null
    $resultPath = Join-Path $RunDirectory 'result.json'
    $errorPath = Join-Path $RunDirectory 'error.txt'
    $summaryPath = Join-Path $RunDirectory 'summary.json'
    $powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

    $argsList = New-Object System.Collections.ArrayList
    foreach ($value in @(
        '-NoLogo','-NoProfile','-ExecutionPolicy','Bypass',
        '-File',$ScriptPath,'-ResultPath',$resultPath,'-ErrorPath',$errorPath
    )) {
        [void]$argsList.Add([string]$value)
    }
    foreach ($value in @($AdditionalArguments)) {
        [void]$argsList.Add([string]$value)
    }

    $quoted = @(
        @($argsList) | ForEach-Object {
            '"' + ([string]$_).Replace('"','""') + '"'
        }
    )
    $startInfo = New-Object Diagnostics.ProcessStartInfo
    $startInfo.FileName = $powershellPath
    $startInfo.Arguments = $quoted -join ' '
    $startInfo.WorkingDirectory = $RunDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true

    $process = New-Object Diagnostics.Process
    $process.StartInfo = $startInfo
    $startedUtc = [DateTime]::UtcNow
    if (-not $process.Start()) {
        throw 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_CHILD_START_FAILED_DEFECT'
    }

    $completed = $process.WaitForExit($HardTimeoutSec * 1000)
    $timedOut = -not $completed
    $exitCode = $null
    $cleanupRows = @()

    if ($timedOut) {
        $taskkill = Join-Path $env:SystemRoot 'System32\taskkill.exe'
        $killInfo = New-Object Diagnostics.ProcessStartInfo
        $killInfo.FileName = $taskkill
        $killInfo.Arguments = '/PID ' + [string]$process.Id + ' /T /F'
        $killInfo.UseShellExecute = $false
        $killInfo.CreateNoWindow = $true
        $killProcess = [Diagnostics.Process]::Start($killInfo)
        $killCompleted = $killProcess.WaitForExit(10000)
        $cleanupRows += [pscustomobject]@{
            ProcessId = [int]$process.Id
            TaskkillCompleted = $killCompleted
            TaskkillExitCode = $(if ($killCompleted) {
                $killProcess.ExitCode
            } else {
                $null
            })
        }
        $killProcess.Dispose()
        [void]$process.WaitForExit(5000)
    }
    elseif ($process.HasExited) {
        $exitCode = $process.ExitCode
    }

    $endedUtc = [DateTime]::UtcNow
    $result = $null
    if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
        $result = Get-Content -Raw -LiteralPath $resultPath | ConvertFrom-Json
    }
    $errorText = ''
    if (Test-Path -LiteralPath $errorPath -PathType Leaf) {
        $errorText = Get-Content -Raw -LiteralPath $errorPath
    }

    $remaining = $false
    try { $remaining = -not $process.HasExited } catch { $remaining = $false }

    $summary = [ordered]@{
        ScriptPath = $ScriptPath
        ProcessId = [int]$process.Id
        StartedUtc = $startedUtc.ToString('o')
        EndedUtc = $endedUtc.ToString('o')
        DurationMs = [int64]($endedUtc - $startedUtc).TotalMilliseconds
        HardTimeoutSec = $HardTimeoutSec
        TimedOut = $timedOut
        ExitCode = $exitCode
        ResultPresent = ($null -ne $result)
        ErrorText = $errorText
        RemainingProcess = $remaining
        CleanupRows = @($cleanupRows)
        Result = $result
    }
    Write-JsonFile -Path $summaryPath -Value $summary -Depth 40
    $process.Dispose()
    return [pscustomobject]$summary
}

$startedUtc = [DateTime]::UtcNow
$finalStatus = 'BLOCKED'
$finalExitCode = $script:ExitBlocked
$finalToken = $script:BlockedToken
$failureClass = ''
$failureMessage = ''
$runRoot = ''

try {
    if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
        throw 'APEX_PROJECT_ROOT_NOT_FOUND'
    }
    $ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot)
    $selfPath = [IO.Path]::GetFullPath($MyInvocation.MyCommand.Path)
    $timestamp = [DateTime]::Now.ToString('yyyyMMdd-HHmmss')
    $runRoot = Join-Path $ProjectRoot (
        '.pma\implementation\process-snapshot-runtime-gate-diagnostic-v3\diagnostic-' +
        $timestamp
    )
    New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

    $sourceFreezeRoot = Join-Path $runRoot 'source-freeze'
    New-Item -ItemType Directory -Path $sourceFreezeRoot -Force | Out-Null
    Copy-Item -LiteralPath $selfPath -Destination (
        Join-Path $sourceFreezeRoot (Split-Path -Leaf $selfPath)
    ) -Force

    $asciiFacts = Test-AsciiFile -Path $selfPath
    $parser = Test-PowerShellParser -Path $selfPath
    $preflight = [ordered]@{
        ScriptVersion = $script:ScriptVersion
        ScriptPath = $selfPath
        ScriptSHA256 = Get-Sha256 -Path $selfPath
        WindowsPowerShellVersion = $PSVersionTable.PSVersion.ToString()
        ParserErrorCount = $parser.ErrorCount
        ParserErrors = $parser.Errors
        NonAsciiByteCount = $asciiFacts.NonAsciiByteCount
        Utf8Bom = $asciiFacts.Utf8Bom
        ProjectRoot = $ProjectRoot
        ToolhelpIterations = $ToolhelpIterations
        ToolhelpFastThresholdMs = $ToolhelpFastThresholdMs
        ToolhelpHardMaximumMs = $ToolhelpHardMaximumMs
        ToolhelpRequiredFastCount = $ToolhelpRequiredFastCount
        MetadataIterations = $MetadataIterations
        GatePass = (
            $PSVersionTable.PSVersion.Major -eq 5 -and
            $PSVersionTable.PSVersion.Minor -eq 1 -and
            $parser.GatePass -and
            $asciiFacts.NonAsciiByteCount -eq 0 -and
            -not $asciiFacts.Utf8Bom
        )
    }
    Write-JsonFile -Path (Join-Path $runRoot '00_PREFLIGHT.json') -Value $preflight
    Write-JsonFile -Path (
        Join-Path $runRoot 'FAILURE_AND_REGRESSION_REGISTER.json'
    ) -Value ([ordered]@{
        ScriptVersion = $script:ScriptVersion
        FailureClasses = $script:FailureRegister
    })

    $abcBytes = [System.Text.Encoding]::ASCII.GetBytes('abc')
    $knownVector = [ordered]@{
        Input = 'abc'
        ExpectedSha256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
        ActualSha256 = Get-ApexSha256Bytes -Bytes $abcBytes
        GatePass = $false
    }
    $knownVector.GatePass = ($knownVector.ActualSha256 -eq $knownVector.ExpectedSha256)
    Write-JsonFile -Path (Join-Path $runRoot '03_HASH_IMPLEMENTATION_GATE.json') -Value $knownVector
    if (-not $knownVector.GatePass) {
        throw 'APEX_DIAGNOSTIC_HASH_HELPER_NOT_MODULE_INDEPENDENT_DEFECT'
    }

    $hashScan = [ordered]@{
        ActiveExecutionChainGetFileHashInvocationCount = 0
        ScannedFiles = @($selfPath)
        GatePass = $true
    }
    Write-JsonFile -Path (Join-Path $runRoot '09_ACTIVE_CHAIN_HASH_DEPENDENCY_SCAN.json') -Value $hashScan

    if (-not $preflight.GatePass) {
        if ($parser.ErrorCount -ne 0) {
            throw 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_PARSER_FAILED_DEFECT'
        }
        if ($asciiFacts.NonAsciiByteCount -ne 0) {
            throw 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_NON_ASCII_DEFECT'
        }
        if ($asciiFacts.Utf8Bom) {
            throw 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_BOM_DEFECT'
        }
        throw 'APEX_WINDOWS_POWERSHELL_5_1_REQUIRED'
    }

    Write-Progress -Activity 'APEX process snapshot runtime gate diagnostic' -Status 'Generating helpers' -PercentComplete 15
    $helperRoot = Join-Path $runRoot 'helpers'
    New-Item -ItemType Directory -Path $helperRoot -Force | Out-Null
    $toolhelpSourcePath = Join-Path $helperRoot 'ApexToolhelp.cs'
    Write-AsciiLines -Path $toolhelpSourcePath -Lines (Get-ToolhelpSourceLines)
    $toolhelpHelperPath = Join-Path $helperRoot 'toolhelp-warmup-probe.ps1'
    New-ToolhelpProbeHelper -Path $toolhelpHelperPath
    $metadataHelperPath = Join-Path $helperRoot 'filtered-metadata-probe.ps1'
    New-MetadataProbeHelper -Path $metadataHelperPath

    $helperParsers = @(
        Test-PowerShellParser -Path $toolhelpHelperPath
        Test-PowerShellParser -Path $metadataHelperPath
    )
    $helperFiles = @($toolhelpSourcePath,$toolhelpHelperPath,$metadataHelperPath)
    $helperAsciiRows = @(
        $helperFiles | ForEach-Object {
            [pscustomobject]@{
                Path = $_
                Facts = Test-AsciiFile -Path $_
            }
        }
    )
    $helperGate = [ordered]@{
        ToolhelpSourceSHA256 = Get-Sha256 -Path $toolhelpSourcePath
        ExpectedToolhelpSourceSHA256 = '11e2464231f82ed0429aa990ccef6d4118985d9b4b95da01fc12e83b8af235f2'
        ParserRows = @($helperParsers)
        AsciiRows = @($helperAsciiRows)
        GatePass = $false
    }
    $helperGate.GatePass = (
        $helperGate.ToolhelpSourceSHA256 -eq $helperGate.ExpectedToolhelpSourceSHA256 -and
        @($helperParsers | Where-Object { -not $_.GatePass }).Count -eq 0 -and
        @($helperAsciiRows | Where-Object {
            $_.Facts.NonAsciiByteCount -ne 0 -or $_.Facts.Utf8Bom
        }).Count -eq 0
    )
    Write-JsonFile -Path (Join-Path $runRoot '01_HELPER_GATE.json') -Value $helperGate -Depth 40
    if (-not $helperGate.GatePass) {
        throw 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_HELPER_PARSER_FAILED_DEFECT'
    }

    Write-Progress -Activity 'APEX process snapshot runtime gate diagnostic' -Status 'Toolhelp compile, warmup, and steady-state proof' -PercentComplete 35
    $toolhelpRun = Invoke-BoundedPowerShellChild -ScriptPath $toolhelpHelperPath -AdditionalArguments @(
        '-SourcePath',$toolhelpSourcePath,
        '-Iterations',[string]$ToolhelpIterations,
        '-FastThresholdMs',[string]$ToolhelpFastThresholdMs,
        '-HardMaximumMs',[string]$ToolhelpHardMaximumMs,
        '-RequiredFastCount',[string]$ToolhelpRequiredFastCount
    ) -RunDirectory (Join-Path $runRoot 'toolhelp-runtime') -HardTimeoutSec $ToolhelpChildHardTimeoutSec

    if ($toolhelpRun.TimedOut) {
        throw 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_CHILD_TIMEOUT_DEFECT'
    }
    if ([int]$toolhelpRun.ExitCode -ne 0 -or -not $toolhelpRun.ResultPresent) {
        throw 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_CHILD_EXIT_FAILURE_DEFECT'
    }
    if (-not [bool]$toolhelpRun.Result.GatePass) {
        throw 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_STEADY_STATE_INSUFFICIENT_DEFECT'
    }

    Write-Progress -Activity 'APEX process snapshot runtime gate diagnostic' -Status 'Filtered metadata proof' -PercentComplete 60
    $current = [Diagnostics.Process]::GetCurrentProcess()
    $startUtc = $current.StartTime.ToUniversalTime()
    $expectedTicks = [int64]($startUtc.Ticks - ($startUtc.Ticks % 10))
    $metadataRows = @()
    for ($iteration = 1; $iteration -le $MetadataIterations; $iteration++) {
        $run = Invoke-BoundedPowerShellChild -ScriptPath $metadataHelperPath -AdditionalArguments @(
            '-TargetProcessId',[string]$script:CurrentProcessId,
            '-ExpectedCreationTicks',[string]$expectedTicks,
            '-OperationTimeoutSec',[string]$MetadataOperationTimeoutSec
        ) -RunDirectory (
            Join-Path $runRoot ('metadata-runtime\iteration-' + $iteration.ToString('00'))
        ) -HardTimeoutSec $MetadataChildHardTimeoutSec
        $pass = (
            -not $run.TimedOut -and
            [int]$run.ExitCode -eq 0 -and
            $run.ResultPresent -and
            [bool]$run.Result.GatePass -and
            [int]$run.Result.MatchCount -eq 1
        )
        $metadataRows += [pscustomobject]@{
            Iteration = $iteration
            TimedOut = $run.TimedOut
            ExitCode = $run.ExitCode
            ResultPresent = $run.ResultPresent
            DurationMs = $(if ($run.ResultPresent) { $run.Result.DurationMs } else { $null })
            MatchCount = $(if ($run.ResultPresent) { $run.Result.MatchCount } else { 0 })
            ErrorText = $run.ErrorText
            GatePass = $pass
        }
    }
    $metadataPassCount = @($metadataRows | Where-Object { $_.GatePass }).Count

    $runtimeGate = [ordered]@{
        Strategy = 'WARMED_TOOLHELP_STEADY_STATE_PLUS_FILTERED_CIM_METADATA'
        V11_12ObservedColdIterationDurationMs = 3177
        V11_12ObservedColdIterationIdentityMatchCount = 1
        V11_12ObservedWarmIterationDurationsMs = @(178,149,128,137)
        CompileDurationMs = $toolhelpRun.Result.CompileDurationMs
        WarmupDurationMs = $toolhelpRun.Result.WarmupDurationMs
        WarmupGatePass = $toolhelpRun.Result.WarmupGatePass
        ToolhelpIterationCount = $toolhelpRun.Result.IterationCount
        ToolhelpIdentityPassCount = $toolhelpRun.Result.IdentityPassCount
        ToolhelpFastPassCount = $toolhelpRun.Result.FastPassCount
        ToolhelpRequiredFastCount = $toolhelpRun.Result.RequiredFastCount
        ToolhelpHardMaximumPassCount = $toolhelpRun.Result.HardMaximumPassCount
        ToolhelpMinimumDurationMs = $toolhelpRun.Result.MinimumDurationMs
        ToolhelpMaximumDurationMs = $toolhelpRun.Result.MaximumDurationMs
        ToolhelpAverageDurationMs = $toolhelpRun.Result.AverageDurationMs
        ToolhelpMeasuredRows = @($toolhelpRun.Result.MeasuredRows)
        MetadataIterationCount = @($metadataRows).Count
        MetadataPassCount = $metadataPassCount
        MetadataRows = @($metadataRows)
        GlobalCimDecisionAuthority = $false
        ColdStartDurationDecisionAuthority = $false
        SteadyStatePerformanceDecisionAuthority = $true
        GatePass = $false
    }
    $runtimeGate.GatePass = (
        $runtimeGate.WarmupGatePass -and
        $runtimeGate.ToolhelpIterationCount -eq $ToolhelpIterations -and
        $runtimeGate.ToolhelpIdentityPassCount -eq $ToolhelpIterations -and
        $runtimeGate.ToolhelpFastPassCount -ge $ToolhelpRequiredFastCount -and
        $runtimeGate.ToolhelpHardMaximumPassCount -eq $ToolhelpIterations -and
        $runtimeGate.MetadataIterationCount -eq $MetadataIterations -and
        $runtimeGate.MetadataPassCount -eq $MetadataIterations
    )
    Write-JsonFile -Path (Join-Path $runRoot '02_WARMUP_STEADY_STATE_RUNTIME_GATE.json') -Value $runtimeGate -Depth 50
    if (-not $runtimeGate.GatePass) {
        throw 'APEX_PROCESS_SNAPSHOT_RUNTIME_GATE_WARMUP_DIAGNOSTIC_GATE_FAILED_DEFECT'
    }

    $authorization = [ordered]@{
        Status = 'PASS'
        ControllerLoopClass = 'APEX_CONTROLLER_LOOP_REAL_CAUSE_NOT_REACHED_DEFECT'
        V11_13FullControllerReintegrationAuthorized = $true
        AuthorizedCorrection = 'SEPARATE_TOOLHELP_COMPILE_AND_WARMUP_FROM_STEADY_STATE_MEASUREMENT'
        RuntimeGate = $runtimeGate
    }
    Write-JsonFile -Path (Join-Path $runRoot '03_REINTEGRATION_AUTHORIZATION.json') -Value $authorization -Depth 50

    $finalStatus = 'PASS'
    $finalExitCode = $script:ExitSuccess
    $finalToken = $script:SuccessToken
}
catch {
    $failureMessage = [string]$_.Exception.Message
    $failureClass = Resolve-ApexFailureClass -Exception $_.Exception
}
finally {
    $endedUtc = [DateTime]::UtcNow
    if ($runRoot) {
        $report = [ordered]@{
            ScriptVersion = $script:ScriptVersion
            ProjectRoot = $ProjectRoot
            EvidenceRoot = $runRoot
            StartedUtc = $startedUtc.ToString('o')
            EndedUtc = $endedUtc.ToString('o')
            FinalStatus = $finalStatus
            ExitCode = $finalExitCode
            FinalToken = $finalToken
            FailureClass = $failureClass
            FailureMessage = $failureMessage
            ControllerLoopClass = 'APEX_CONTROLLER_LOOP_REAL_CAUSE_NOT_REACHED_DEFECT'
            FullControllerReintegrationAuthorized = ($finalStatus -eq 'PASS')
            NonTargetWorktreeMutation = $false
            GitMutationPerformed = $false
        }
        Write-JsonFile -Path (Join-Path $runRoot 'FINAL_REPORT.json') -Value $report
        Write-AsciiLines -Path (Join-Path $runRoot 'FINAL.marker') -Lines @($finalToken)
    }
    Write-Host ('FINAL_STATUS=' + $finalStatus)
    Write-Host ('EXIT_CODE=' + $finalExitCode)
    Write-Host ('FINAL_TOKEN=' + $finalToken)
    Write-Host ('FAILURE_CLASS=' + $failureClass)
    Write-Host ('EVIDENCE_ROOT=' + $runRoot)
}

exit $finalExitCode
