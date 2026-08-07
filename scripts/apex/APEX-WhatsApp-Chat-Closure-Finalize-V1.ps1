[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [switch]$Apply,
    [bool]$RunTypecheck = $true,
    [bool]$RunLint = $true,
    [bool]$RunBuild = $true,
    [switch]$RunTests,
    [int]$TimeoutSeconds = 600,
    [switch]$NoOpenReport,
    [switch]$SkipSelfInstall
)

$ErrorActionPreference = "Stop"

try { chcp 65001 | Out-Null } catch {}
try {
    $Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = $Utf8NoBom
    [Console]::InputEncoding = $Utf8NoBom
    $script:OutputEncoding = $Utf8NoBom
} catch {}

$PSDefaultParameterValues["Out-File:Encoding"] = "utf8"
$PSDefaultParameterValues["Set-Content:Encoding"] = "utf8"
$PSDefaultParameterValues["Add-Content:Encoding"] = "utf8"

function Write-Step {
    param([string]$Message)
    $Line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $Line
    if ($script:LogPath -and (Test-Path -LiteralPath (Split-Path -Parent $script:LogPath))) {
        Add-Content -LiteralPath $script:LogPath -Value $Line -Encoding utf8
    }
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        if ($Apply) {
            New-Item -ItemType Directory -Path $Path -Force | Out-Null
            Write-Step "Created directory: $Path"
        } else {
            Write-Step "DRY-RUN: would create directory: $Path"
        }
    }
}

function Read-Text {
    param([string]$Path)
    return Get-Content -LiteralPath $Path -Raw -Encoding utf8
}

function Write-Text {
    param([string]$Path, [string]$Content)
    $Dir = Split-Path -Parent $Path
    Ensure-Directory -Path $Dir
    if ($Apply) {
        Set-Content -LiteralPath $Path -Value $Content -Encoding utf8
        Write-Step "Wrote: $Path"
    } else {
        Write-Step "DRY-RUN: would write $Path"
    }
}

function Get-Sha256 {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return "" }
    try { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash } catch { return "" }
}

function Get-PackageJson {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        return Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Has-NpmScript {
    param([object]$PackageJson, [string]$ScriptName)
    if ($null -eq $PackageJson) { return $false }
    if ($null -eq $PackageJson.scripts) { return $false }
    return [bool]($PackageJson.scripts.PSObject.Properties.Name -contains $ScriptName)
}

function Invoke-NpmCommandStable {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WorkingDirectory,
        [string]$OutputDir,
        [int]$TimeoutSeconds
    )

    Write-Step "RUNNING: $Name"
    Write-Step "WORKDIR: $WorkingDirectory"
    Write-Step "COMMAND: $Command"
    Write-Step "TIMEOUT: $TimeoutSeconds seconds"

    $BaseName = ($Name -replace "[^\w\-]", "_")
    $StdoutPath = Join-Path $OutputDir ("{0}.stdout.log" -f $BaseName)
    $StderrPath = Join-Path $OutputDir ("{0}.stderr.log" -f $BaseName)
    $CombinedPath = Join-Path $OutputDir ("validation_{0}.log" -f $BaseName)

    if (-not $Apply) {
        $Text = "# $Name`r`nDRY-RUN: would run $Command in $WorkingDirectory"
        Set-Content -LiteralPath $CombinedPath -Value $Text -Encoding utf8
        return [pscustomobject]@{
            Name = $Name
            Command = $Command
            Workdir = $WorkingDirectory
            ExitCode = 0
            TimedOut = $false
            Skipped = $true
            OutputPath = $CombinedPath
            StdoutPath = $StdoutPath
            StderrPath = $StderrPath
            HasTsError = $false
            HasGenericError = $false
        }
    }

    $WrappedCommand = "$Command > `"$StdoutPath`" 2> `"$StderrPath`""
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/d /s /c `"$WrappedCommand`""
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    $TimedOut = $false
    $ExitCode = 999
    $LaunchError = ""

    try {
        [void]$process.Start()
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            $TimedOut = $true
            $ExitCode = 124
            try { $process.Kill() } catch {}
        } else {
            $ExitCode = $process.ExitCode
        }
    } catch {
        $LaunchError = $_.Exception.ToString()
        $ExitCode = 999
    } finally {
        try { $process.Dispose() } catch {}
    }

    $StdoutText = ""
    $StderrText = ""
    if (Test-Path -LiteralPath $StdoutPath) {
        try { $StdoutText = Get-Content -LiteralPath $StdoutPath -Raw -Encoding utf8 } catch { $StdoutText = "[Could not read stdout log]" }
    }
    if (Test-Path -LiteralPath $StderrPath) {
        try { $StderrText = Get-Content -LiteralPath $StderrPath -Raw -Encoding utf8 } catch { $StderrText = "[Could not read stderr log]" }
    }

    $CombinedOutput = $StdoutText + "`r`n" + $StderrText
    $HasTsError = $CombinedOutput -match "error TS\d+|TypeScript error|Failed to compile"
    $HasGenericError = $CombinedOutput -match "(?i)\berror\b|failed|exception"

    $Combined = @"
# $Name

WorkingDirectory:
$WorkingDirectory

Command:
$Command

ExitCode:
$ExitCode

TimedOut:
$TimedOut

LaunchError:
$LaunchError

HasTsError:
$HasTsError

HasGenericError:
$HasGenericError

STDOUT LOG:
$StdoutPath

STDERR LOG:
$StderrPath

STDOUT:
$StdoutText

STDERR:
$StderrText
"@
    Set-Content -LiteralPath $CombinedPath -Value $Combined -Encoding utf8

    if ($TimedOut) {
        Write-Step "$Name timed out after $TimeoutSeconds seconds."
    } elseif ($ExitCode -eq 0) {
        Write-Step "$Name passed with exit code 0."
    } else {
        Write-Step "$Name failed with exit code $ExitCode."
    }

    return [pscustomobject]@{
        Name = $Name
        Command = $Command
        Workdir = $WorkingDirectory
        ExitCode = $ExitCode
        TimedOut = $TimedOut
        Skipped = $false
        OutputPath = $CombinedPath
        StdoutPath = $StdoutPath
        StderrPath = $StderrPath
        HasTsError = $HasTsError
        HasGenericError = $HasGenericError
    }
}

function Find-PackageTargets {
    param([string]$Root)

    $Candidates = @(
        ".",
        "apps\web-user",
        "apps\web-admin",
        "apps\web",
        "apps\gateway-api",
        "apps\api"
    )

    $Targets = @()
    foreach ($Candidate in $Candidates) {
        $Dir = if ($Candidate -eq ".") { $Root } else { Join-Path $Root $Candidate }
        $Pkg = Join-Path $Dir "package.json"
        if (Test-Path -LiteralPath $Pkg) {
            $Targets += [pscustomobject]@{
                Name = if ($Candidate -eq ".") { "root" } else { $Candidate.Replace("\", "-") }
                Dir = $Dir
                PackageJson = Get-PackageJson -Path $Pkg
            }
        }
    }

    return $Targets
}

function Get-StaticHealthTable {
    param([string]$Root)

    $TargetFiles = @(
        "apps\web-user\src\components\ChatScreen.tsx",
        "apps\web-user\src\components\ChatFirstWindow.tsx",
        "apps\web-user\src\components\ChatMessageView.tsx",
        "apps\web-user\src\components\ChatPopup.tsx",
        "apps\web-user\src\components\UniversalChatWidget.tsx",
        "apps\web-user\src\pages\ChatSessionsPage.tsx",
        "apps\web-user\src\pages\GroupChatsPage.tsx",
        "apps\web-user\src\pages\SavedChatsPage.tsx",
        "apps\web-admin\src\pages\ChatMonitorPage.tsx"
    )

    $Rows = @()
    foreach ($Rel in $TargetFiles) {
        $Path = Join-Path $Root $Rel
        if (-not (Test-Path -LiteralPath $Path)) {
            $Rows += "| ``$Rel`` | Missing | - | - | - | - |"
            continue
        }

        $Text = Read-Text -Path $Path
        $LiteralBacktickNewline = $Text.Contains('`r`n') -or $Text.Contains('`n')
        $HasWaImport = $Text -match 'whatsapp-integration\.css|whatsapp-chat-monitor\.css'
        $HasWaMarker = $Text -match 'wa-integrated-chat|wa-admin-chat|waMode|dir="auto"'
        $HasExpectedChatTerms = $Text -match 'composer|input|textarea|message|chat|groups|session|monitor|saved'
        $Hash = Get-Sha256 -Path $Path

        $Rows += "| ``$Rel`` | True | $LiteralBacktickNewline | $HasWaImport | $HasWaMarker | $HasExpectedChatTerms | ``$Hash`` |"
    }

    return ($Rows -join "`r`n")
}

function Get-Decision {
    param([object[]]$Results)

    $Failed = @($Results | Where-Object { -not $_.Skipped -and ($_.ExitCode -ne 0 -or $_.TimedOut) })
    if ($Failed.Count -gt 0) {
        return "WATANYBOT_WHATSAPP_CHAT_CLOSURE_BLOCKED_BY_VALIDATION"
    }

    $Typecheck = @($Results | Where-Object { $_.Name -match "typecheck" })
    $Lint = @($Results | Where-Object { $_.Name -match "lint" })
    $Build = @($Results | Where-Object { $_.Name -match "build" })

    if ($RunTypecheck -and $Typecheck.Count -eq 0) {
        return "WATANYBOT_WHATSAPP_CHAT_CLOSURE_BLOCKED_NO_TYPECHECK_SCRIPT"
    }

    if ($RunLint -and $Lint.Count -eq 0) {
        return "WATANYBOT_WHATSAPP_CHAT_CLOSURE_BLOCKED_NO_LINT_SCRIPT"
    }

    if ($RunBuild -and $Build.Count -eq 0) {
        return "WATANYBOT_WHATSAPP_CHAT_AUTOMATED_PARTIAL_NO_BUILD_SCRIPT_MANUAL_QA_PENDING"
    }

    return "WATANYBOT_WHATSAPP_CHAT_AUTOMATED_CLOSED_MANUAL_QA_PENDING"
}

function Append-Or-Replace-Section {
    param([string]$Text, [string]$Marker, [string]$Section)

    $Heading = "## $Marker"
    if ($Text.Contains($Heading)) {
        $Index = $Text.IndexOf($Heading)
        $Text = $Text.Substring(0, $Index).TrimEnd()
    }

    return $Text.TrimEnd() + [Environment]::NewLine + [Environment]::NewLine + $Section.TrimEnd() + [Environment]::NewLine
}

# Resolve repo
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $Current = (Get-Location).Path
    if ((Test-Path -LiteralPath (Join-Path $Current "package.json")) -or (Test-Path -LiteralPath (Join-Path $Current ".git"))) {
        $RepoRoot = $Current
    }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    throw "RepoRoot is required when not running from repo root."
}

$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$Started = Get-Date
$RunId = Get-Date -Format "yyyyMMdd-HHmmss"

if ($Apply) {
    $RunDir = Join-Path $RepoRoot ".apex\whatsapp-chat-closure-finalize\$RunId"
} else {
    $RunDir = Join-Path $env:TEMP "apex-whatsapp-chat-closure-finalize-$RunId"
}

$LogPath = Join-Path $RunDir "execution.log"
$script:LogPath = $LogPath

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null
Set-Content -LiteralPath $LogPath -Value "APEX WhatsApp Chat Closure Finalize V1`r`nRunId: $RunId`r`nRepoRoot: $RepoRoot`r`n" -Encoding utf8

$ReportPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_CLOSURE_FINALIZE_REPORT.md"
$ManualQaPath = Join-Path $RunDir "WHATSAPP_CHAT_MANUAL_QA_SIGNOFF.md"
$ImplementationReportPath = Join-Path $RepoRoot "docs\APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md"

Write-Step "APEX WhatsApp Chat Closure Finalize V1 started"
Write-Step "RepoRoot: $RepoRoot"
Write-Step "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"
Write-Step "RunTypecheck: $RunTypecheck"
Write-Step "RunLint: $RunLint"
Write-Step "RunBuild: $RunBuild"
Write-Step "RunTests: $RunTests"
Write-Step "TimeoutSeconds: $TimeoutSeconds"

# Self-install
try {
    $SelfPath = $PSCommandPath
    $Downloads = Join-Path $env:USERPROFILE "Downloads"
    if (-not $SkipSelfInstall -and $SelfPath -and $SelfPath.StartsWith($Downloads, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ScriptDir = Join-Path $RepoRoot "scripts\apex"
        $DestScript = Join-Path $ScriptDir "APEX-WhatsApp-Chat-Closure-Finalize-V1.ps1"
        if ($Apply) {
            New-Item -ItemType Directory -Path $ScriptDir -Force | Out-Null
            Copy-Item -LiteralPath $SelfPath -Destination $DestScript -Force
            Write-Step "Copied script from Downloads to repo: $DestScript"
        } else {
            Write-Step "DRY-RUN: would copy script from Downloads to $DestScript"
        }
    }
} catch {
    Write-Step "Self-install copy failed but script will continue: $($_.Exception.Message)"
}

$Targets = Find-PackageTargets -Root $RepoRoot
$PackageRows = @()
foreach ($Target in $Targets) {
    $PackageRows += "| $($Target.Name) | ``$($Target.Dir)`` | typecheck=$((Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "typecheck")) | lint=$((Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "lint")) | build=$((Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "build")) | test=$((Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "test")) |"
}
if ($PackageRows.Count -eq 0) {
    $PackageRows += "| _No package targets discovered_ | - | - | - | - | - |"
}
$PackageTable = $PackageRows -join "`r`n"

$Results = @()

foreach ($Target in $Targets) {
    if ($RunTypecheck -and (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "typecheck")) {
        $Results += (Invoke-NpmCommandStable -Name "$($Target.Name)-typecheck" -Command "npm run typecheck" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds)
    }

    if ($RunLint -and (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "lint")) {
        $Results += (Invoke-NpmCommandStable -Name "$($Target.Name)-lint" -Command "npm run lint" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds)
    }

    if ($RunBuild -and (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "build")) {
        $Results += (Invoke-NpmCommandStable -Name "$($Target.Name)-build" -Command "npm run build" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds ([Math]::Max($TimeoutSeconds, 900)))
    }

    if ($RunTests -and (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "test")) {
        $Results += (Invoke-NpmCommandStable -Name "$($Target.Name)-test" -Command "set CI=true&& npm run test -- --runInBand" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds ([Math]::Max($TimeoutSeconds, 600)))
    }
}

$ValidationRows = @()
foreach ($R in $Results) {
    $ValidationRows += "| $($R.Name) | ``$($R.Command)`` | ``$($R.Workdir)`` | $($R.ExitCode) | $($R.TimedOut) | $($R.Skipped) | $($R.HasTsError) | $($R.HasGenericError) | ``$($R.OutputPath)`` |"
}
if ($ValidationRows.Count -eq 0) {
    $ValidationRows += "| _No validation commands executed_ | - | - | - | - | - | - | - | - |"
}
$ValidationTable = $ValidationRows -join "`r`n"

$StaticHealthTable = Get-StaticHealthTable -Root $RepoRoot
$Decision = Get-Decision -Results $Results

$ManualQa = @"
# WhatsApp Chat Manual QA Signoff

Run ID: $RunId  
Repo Root: ``$RepoRoot``  
Automated Decision: **$Decision**

## Automated Validation Evidence

| Step | Command | Workdir | Exit Code | Timed Out | Skipped | Has TS Error | Has Generic Error Text | Output |
|---|---|---|---:|---:|---:|---:|---:|---|
$ValidationTable

## Static Health

| File | Exists | Literal Backtick Newline Tokens | Has WA Import | Has WA Marker | Has Expected Chat Terms | SHA256 |
|---|---:|---:|---:|---:|---:|---|
$StaticHealthTable

## Required Manual QA

- [ ] User chat opens on desktop.
- [ ] User chat opens at mobile width 390px.
- [ ] User chat opens at mobile width 430px.
- [ ] Composer stays visible when mobile keyboard opens.
- [ ] Long conversation scrolls inside the chat area.
- [ ] Arabic message direction is correct.
- [ ] Mixed Arabic/English message direction is acceptable.
- [ ] ChatPopup opens and sends.
- [ ] UniversalChatWidget opens and sends.
- [ ] GroupChatsPage loads and input is usable.
- [ ] SavedChatsPage loads.
- [ ] ChatSessionsPage moderator view works.
- [ ] Admin ChatMonitorPage works.
- [ ] Admin flag/read monitor actions still work.

## Manual QA Result

- [ ] PASS
- [ ] PASS WITH NOTES
- [ ] FAIL

Notes:

"@
Write-Text -Path $ManualQaPath -Content $ManualQa

$Duration = New-TimeSpan -Start $Started -End (Get-Date)

$ClosureSection = @"
## Latest WhatsApp Chat Closure Finalization

Automated Decision: **$Decision**

## Package Script Discovery

| Target | Directory | Scripts |
|---|---|---|
$PackageTable

## Final Validation Evidence

| Step | Command | Workdir | Exit Code | Timed Out | Skipped | Has TS Error | Has Generic Error Text | Output |
|---|---|---|---:|---:|---:|---:|---:|---|
$ValidationTable

## Final Static Health

| File | Exists | Literal Backtick Newline Tokens | Has WA Import | Has WA Marker | Has Expected Chat Terms | SHA256 |
|---|---:|---:|---:|---:|---:|---|
$StaticHealthTable

## Manual QA Signoff

$ManualQaPath
"@

if (Test-Path -LiteralPath $ImplementationReportPath) {
    $Existing = Read-Text -Path $ImplementationReportPath
    $Updated = Append-Or-Replace-Section -Text $Existing -Marker "Latest WhatsApp Chat Closure Finalization" -Section $ClosureSection
    Write-Text -Path $ImplementationReportPath -Content $Updated
} else {
    Write-Text -Path $ImplementationReportPath -Content ("# APEX WhatsApp Chat Behavior Implementation Report`r`n`r`n" + $ClosureSection)
}

$Report = @"
# APEX WhatsApp Chat Closure Finalize V1 Report

## Decision

$Decision

## Meaning

- ``WATANYBOT_WHATSAPP_CHAT_AUTOMATED_CLOSED_MANUAL_QA_PENDING`` means typecheck/lint/build passed where discovered; only manual browser QA remains.
- ``WATANYBOT_WHATSAPP_CHAT_AUTOMATED_PARTIAL_NO_BUILD_SCRIPT_MANUAL_QA_PENDING`` means typecheck/lint passed but no build script was discovered.
- ``WATANYBOT_WHATSAPP_CHAT_CLOSURE_BLOCKED_BY_VALIDATION`` means at least one command failed or timed out.

## Metadata

| Field | Value |
|---|---|
| Run ID | $RunId |
| Repo Root | ``$RepoRoot`` |
| Apply | $Apply |
| RunTypecheck | $RunTypecheck |
| RunLint | $RunLint |
| RunBuild | $RunBuild |
| RunTests | $RunTests |
| TimeoutSeconds | $TimeoutSeconds |
| Started | $($Started.ToString("yyyy-MM-dd HH:mm:ss")) |
| Duration | $($Duration.ToString()) |
| Encoding | UTF-8 forced / code page 65001 attempted |

## Package Script Discovery

| Target | Directory | Scripts |
|---|---|---|
$PackageTable

## Validation Evidence

| Step | Command | Workdir | Exit Code | Timed Out | Skipped | Has TS Error | Has Generic Error Text | Output |
|---|---|---|---:|---:|---:|---:|---:|---|
$ValidationTable

## Static Health

| File | Exists | Literal Backtick Newline Tokens | Has WA Import | Has WA Marker | Has Expected Chat Terms | SHA256 |
|---|---:|---:|---:|---:|---:|---|
$StaticHealthTable

## Generated / Updated Files

| File | Purpose |
|---|---|
| ``$ImplementationReportPath`` | Updated implementation report |
| ``$ManualQaPath`` | Manual QA signoff checklist |
| ``$LogPath`` | Execution log |

## Next Step

If decision is automated closed/manual QA pending, complete the manual browser QA checklist and mark PASS or PASS WITH NOTES.

If decision is blocked, open the failing validation log listed above and patch the exact failure.
"@

Write-Text -Path $ReportPath -Content $Report

Write-Step "Closure finalization report created: $ReportPath"

if (-not $NoOpenReport) {
    try {
        Invoke-Item -LiteralPath $ReportPath
        Write-Step "Report launched."
    } catch {
        Write-Step "Could not launch report automatically: $($_.Exception.Message)"
    }
}

Write-Step "APEX WhatsApp Chat Closure Finalize V1 finished."
Write-Host ""
Write-Host "DONE"
Write-Host "Decision: $Decision"
Write-Host "Report: $ReportPath"
Write-Host "Manual QA: $ManualQaPath"
Write-Host "Implementation report: $ImplementationReportPath"
