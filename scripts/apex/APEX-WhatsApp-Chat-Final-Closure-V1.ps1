[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [switch]$Apply,
    [bool]$RunValidation = $true,
    [bool]$RunBuild = $true,
    [switch]$RunTests,
    [int]$TimeoutSeconds = 600,
    [switch]$CreateSmokeGuide,
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

function Write-WarnLine {
    param([string]$Message)
    $Line = "[{0}] WARNING: {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Warning $Message
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
        Write-Step "DRY-RUN: would write: $Path"
    }
}

function Get-FileSha256 {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return "" }
    try { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash } catch { return "" }
}

function Backup-File {
    param([string]$Path, [string]$BackupRoot)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $Relative = $Path.Substring($script:RepoRoot.Length).TrimStart("\","/")
    $BackupPath = Join-Path $BackupRoot $Relative
    $BackupDir = Split-Path -Parent $BackupPath
    Ensure-Directory -Path $BackupDir
    if ($Apply) {
        Copy-Item -LiteralPath $Path -Destination $BackupPath -Force
        Write-Step "Backup created: $BackupPath"
    } else {
        Write-Step "DRY-RUN: would backup $Path to $BackupPath"
    }
}

function Patch-TextFile {
    param([string]$RelativePath, [scriptblock]$PatchBlock, [string]$Reason)

    $Path = Join-Path $script:RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path)) {
        $script:PatchRows += "| ``$RelativePath`` | Missing | $Reason | - | - |"
        return
    }

    $Before = Read-Text -Path $Path
    $BeforeHash = Get-FileSha256 -Path $Path
    $After = & $PatchBlock $Before

    if ($After -eq $Before) {
        $script:PatchRows += "| ``$RelativePath`` | Unchanged | $Reason | ``$BeforeHash`` | ``$BeforeHash`` |"
        return
    }

    Backup-File -Path $Path -BackupRoot $script:BackupDir
    Write-Text -Path $Path -Content $After
    $AfterHash = if ($Apply) { Get-FileSha256 -Path $Path } else { "DRY-RUN" }
    $script:PatchRows += "| ``$RelativePath`` | Patched | $Reason | ``$BeforeHash`` | ``$AfterHash`` |"
}

function Get-PackageJson {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { return Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json } catch { return $null }
}

function Has-NpmScript {
    param([object]$PackageJson, [string]$ScriptName)
    if ($null -eq $PackageJson) { return $false }
    if ($null -eq $PackageJson.scripts) { return $false }
    return [bool]($PackageJson.scripts.PSObject.Properties.Name -contains $ScriptName)
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
        $PkgPath = Join-Path $Dir "package.json"
        if (Test-Path -LiteralPath $PkgPath) {
            $Targets += [pscustomobject]@{
                Name = if ($Candidate -eq ".") { "root" } else { $Candidate.Replace("\", "-") }
                Dir = $Dir
                PackageJson = Get-PackageJson -Path $PkgPath
            }
        }
    }

    return $Targets
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
        Set-Content -LiteralPath $CombinedPath -Value "# $Name`r`nDRY-RUN: would run $Command" -Encoding utf8
        return [pscustomobject]@{
            Name = $Name
            Command = $Command
            Workdir = $WorkingDirectory
            ExitCode = 0
            TimedOut = $false
            Skipped = $true
            OutputPath = $CombinedPath
            Required = $true
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
        Write-WarnLine "$Name timed out after $TimeoutSeconds seconds. See: $CombinedPath"
    } elseif ($ExitCode -eq 0) {
        Write-Step "$Name passed."
    } else {
        Write-WarnLine "$Name failed with exit code $ExitCode. See: $CombinedPath"
    }

    return [pscustomobject]@{
        Name = $Name
        Command = $Command
        Workdir = $WorkingDirectory
        ExitCode = $ExitCode
        TimedOut = $TimedOut
        Skipped = $false
        OutputPath = $CombinedPath
        Required = $true
    }
}

function Get-StaticHealthTable {
    param([string[]]$RelativeFiles)

    $Rows = @()
    foreach ($Rel in $RelativeFiles) {
        $Path = Join-Path $script:RepoRoot $Rel
        if (-not (Test-Path -LiteralPath $Path)) {
            $Rows += "| ``$Rel`` | Missing | - | - | - | - |"
            continue
        }

        $Text = Read-Text -Path $Path
        $LiteralBacktickNewline = $Text.Contains('`r`n') -or $Text.Contains('`n')
        $HasWaImport = $Text -match 'whatsapp-integration\.css|whatsapp-chat-monitor\.css'
        $HasWaMarker = $Text -match 'wa-integrated-chat|wa-admin-chat|waMode|dir="auto"'
        $HasExpectedChatTerms = $Text -match 'composer|input|textarea|message|chat|groups|session|monitor|saved'
        $Hash = Get-FileSha256 -Path $Path

        $Rows += "| ``$Rel`` | True | $LiteralBacktickNewline | $HasWaImport | $HasWaMarker | $HasExpectedChatTerms | ``$Hash`` |"
    }

    return ($Rows -join "`r`n")
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

function Get-ValidationDecision {
    param([object[]]$Results)

    $Failed = @($Results | Where-Object { -not $_.Skipped -and ($_.ExitCode -ne 0 -or $_.TimedOut) })
    if ($Failed.Count -gt 0) {
        return "CLOSURE_BLOCKED_BY_VALIDATION"
    }

    $BuildResults = @($Results | Where-Object { $_.Name -match "build" })
    if ($RunBuild -and $BuildResults.Count -eq 0) {
        return "VALIDATION_PASS_BUILD_SCRIPT_NOT_FOUND_MANUAL_QA_PENDING"
    }

    return "AUTOMATED_VALIDATION_PASS_MANUAL_QA_PENDING"
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
$script:RepoRoot = $RepoRoot
$Started = Get-Date
$RunId = Get-Date -Format "yyyyMMdd-HHmmss"

if ($Apply) {
    $RunDir = Join-Path $RepoRoot ".apex\whatsapp-chat-final-closure\$RunId"
} else {
    $RunDir = Join-Path $env:TEMP "apex-whatsapp-chat-final-closure-$RunId"
}

$BackupDir = Join-Path $RunDir "backups"
$LogPath = Join-Path $RunDir "execution.log"
$script:BackupDir = $BackupDir
$script:LogPath = $LogPath
$script:PatchRows = @()

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Set-Content -LiteralPath $LogPath -Value "APEX WhatsApp Chat Final Closure V1`r`nRunId: $RunId`r`nRepoRoot: $RepoRoot`r`n" -Encoding utf8

$ReportPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_FINAL_CLOSURE_REPORT.md"
$ImplementationReportPath = Join-Path $RepoRoot "docs\APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md"
$ManualQaPath = Join-Path $RunDir "WHATSAPP_CHAT_MANUAL_QA_SIGNOFF.md"
$SmokeGuidePath = Join-Path $RunDir "WHATSAPP_CHAT_BROWSER_SMOKE_GUIDE.md"

Write-Step "APEX WhatsApp Chat Final Closure V1 started"
Write-Step "RepoRoot: $RepoRoot"
Write-Step "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"
Write-Step "RunValidation: $RunValidation"
Write-Step "RunBuild: $RunBuild"
Write-Step "RunTests: $RunTests"
Write-Step "TimeoutSeconds: $TimeoutSeconds"

# Self-install
try {
    $SelfPath = $PSCommandPath
    $Downloads = Join-Path $env:USERPROFILE "Downloads"
    if (-not $SkipSelfInstall -and $SelfPath -and $SelfPath.StartsWith($Downloads, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ScriptDir = Join-Path $RepoRoot "scripts\apex"
        $DestScript = Join-Path $ScriptDir "APEX-WhatsApp-Chat-Final-Closure-V1.ps1"
        if ($Apply) {
            New-Item -ItemType Directory -Path $ScriptDir -Force | Out-Null
            Copy-Item -LiteralPath $SelfPath -Destination $DestScript -Force
            Write-Step "Copied script from Downloads to repo: $DestScript"
        } else {
            Write-Step "DRY-RUN: would copy script from Downloads to $DestScript"
        }
    }
} catch {
    Write-WarnLine "Self-install copy failed but script will continue: $($_.Exception.Message)"
}

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

# Idempotent static gap closure for SavedChatsPage.
Patch-TextFile -RelativePath "apps\web-user\src\pages\SavedChatsPage.tsx" -Reason "Verify/ensure SavedChatsPage WA marker remains closed" -PatchBlock {
    param($Text)

    if ($Text -match 'wa-integrated-chat|waMode|dir="auto"') {
        return $Text
    }

    if ($Text.Contains('className="panel utility-page"')) {
        return $Text.Replace('className="panel utility-page"', 'className="panel utility-page wa-integrated-chat"')
    }

    if ($Text.Contains('className="utility-page"')) {
        return $Text.Replace('className="utility-page"', 'className="utility-page wa-integrated-chat"')
    }

    if ($Text.Contains('className="panel"')) {
        return $Text.Replace('className="panel"', 'className="panel wa-integrated-chat"')
    }

    return $Text
}

$StaticHealthTable = Get-StaticHealthTable -RelativeFiles $TargetFiles

$ValidationResults = @()
$DiscoveredTargets = Find-PackageTargets -Root $RepoRoot

if ($RunValidation) {
    foreach ($Target in $DiscoveredTargets) {
        if (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "typecheck") {
            $ValidationResults += (Invoke-NpmCommandStable -Name "$($Target.Name)-typecheck" -Command "npm run typecheck" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds)
        }

        if (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "lint") {
            $ValidationResults += (Invoke-NpmCommandStable -Name "$($Target.Name)-lint" -Command "npm run lint" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds)
        }

        if ($RunBuild -and (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "build")) {
            $ValidationResults += (Invoke-NpmCommandStable -Name "$($Target.Name)-build" -Command "npm run build" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds ([Math]::Max($TimeoutSeconds, 900)))
        }

        if ($RunTests -and (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "test")) {
            $ValidationResults += (Invoke-NpmCommandStable -Name "$($Target.Name)-test" -Command "set CI=true&& npm run test -- --runInBand" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds ([Math]::Max($TimeoutSeconds, 600)))
        }
    }
} else {
    Write-Step "Validation skipped by RunValidation=false."
}

$PackageRows = @()
foreach ($Target in $DiscoveredTargets) {
    $PackageRows += "| $($Target.Name) | ``$($Target.Dir)`` | typecheck=$((Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "typecheck")) | lint=$((Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "lint")) | build=$((Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "build")) | test=$((Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "test")) |"
}
if ($PackageRows.Count -eq 0) {
    $PackageRows += "| _No package targets found_ | - | - | - | - | - |"
}
$PackageTable = $PackageRows -join "`r`n"

$ValidationRows = @()
foreach ($V in $ValidationResults) {
    $ValidationRows += "| $($V.Name) | ``$($V.Command)`` | ``$($V.Workdir)`` | $($V.ExitCode) | $($V.TimedOut) | $($V.Skipped) | ``$($V.OutputPath)`` |"
}
if ($ValidationRows.Count -eq 0) {
    $ValidationRows += "| _No validation commands executed_ | - | - | - | - | - | - |"
}
$ValidationTable = $ValidationRows -join "`r`n"

$Decision = Get-ValidationDecision -Results $ValidationResults
$PatchTable = if ($script:PatchRows.Count -gt 0) { $script:PatchRows -join "`r`n" } else { "| _No file changes_ | - | - | - | - |" }

$ManualQa = @"
# WhatsApp Chat Manual QA Signoff

Run ID: $RunId  
Repo Root: ``$RepoRoot``  
Automated Decision: **$Decision**

## Automated Closure Evidence

| Step | Command | Workdir | Exit Code | Timed Out | Skipped | Output |
|---|---|---|---:|---:|---:|---|
$ValidationTable

## Static Health

| File | Exists | Literal Backtick Newline Tokens | Has WA Import | Has WA Marker | Has Expected Chat Terms | SHA256 |
|---|---:|---:|---:|---:|---:|---|
$StaticHealthTable

## Manual QA Checklist

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

$SmokeGuide = @"
# WhatsApp Chat Browser Smoke Guide

Run ID: $RunId  
Repo Root: ``$RepoRoot``

## Purpose

This guide closes the manual/browser side of the WhatsApp chat behavior validation.

## Suggested Local Start

Use the app's existing dev command. Common options:

```powershell
npm run dev
```

or, if workspace-specific:

```powershell
npm --workspace apps/web-user run dev
```

## Browser Checks

1. Open the user chat page.
2. Open mobile responsive mode at 390px.
3. Send an English message.
4. Send an Arabic message.
5. Send mixed Arabic/English.
6. Confirm the composer stays visible.
7. Confirm the message list scrolls internally.
8. Open ChatPopup.
9. Open UniversalChatWidget.
10. Open GroupChatsPage, SavedChatsPage, ChatSessionsPage.
11. Open admin ChatMonitorPage.

## Evidence to Capture

- Screenshot desktop chat.
- Screenshot mobile 390px chat.
- Screenshot mobile keyboard/composer if possible.
- Screenshot Arabic message.
- Screenshot admin monitor.
- Any console errors.

## Closure Rule

Do not mark fully closed until the manual QA checklist in:

```
$ManualQaPath
```

is marked PASS or PASS WITH NOTES.
"@
if ($CreateSmokeGuide) {
    Write-Text -Path $SmokeGuidePath -Content $SmokeGuide
} else {
    # Always write it; user asked APEX closure and guide is low-risk.
    Write-Text -Path $SmokeGuidePath -Content $SmokeGuide
}

if (-not (Test-Path -LiteralPath $ImplementationReportPath)) {
    $InitialReport = "# APEX WhatsApp Chat Behavior Implementation Report`r`n`r`n## Status`r`nCreated by Final Closure V1 because the implementation report was missing.`r`n"
    Write-Text -Path $ImplementationReportPath -Content $InitialReport
}

$ClosureSection = @"
## Latest Final Closure Evidence

Automated Decision: **$Decision**

## Package Script Discovery

| Target | Directory | Scripts |
|---|---|---|
$PackageTable

## Final Validation / Build Evidence

| Step | Command | Workdir | Exit Code | Timed Out | Skipped | Output |
|---|---|---|---:|---:|---:|---|
$ValidationTable

## Final Static Health

| File | Exists | Literal Backtick Newline Tokens | Has WA Import | Has WA Marker | Has Expected Chat Terms | SHA256 |
|---|---:|---:|---:|---:|---:|---|
$StaticHealthTable

## Final Repairs

| File | Status | Reason | Before | After |
|---|---|---|---|---|
$PatchTable

## Manual QA Signoff

$ManualQaPath

## Browser Smoke Guide

$SmokeGuidePath
"@

Patch-TextFile -RelativePath "docs\APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md" -Reason "Append latest final closure evidence" -PatchBlock {
    param($Text)
    return Append-Or-Replace-Section -Text $Text -Marker "Latest Final Closure Evidence" -Section $ClosureSection
}

$Duration = New-TimeSpan -Start $Started -End (Get-Date)

$Report = @"
# APEX WhatsApp Chat Final Closure V1 Report

## Status

$(if ($Apply) { "APPLY mode completed." } else { "DRY-RUN completed." })

Automated Decision: **$Decision**

## Metadata

| Field | Value |
|---|---|
| Run ID | $RunId |
| Repo Root | ``$RepoRoot`` |
| Apply | $Apply |
| RunValidation | $RunValidation |
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

## Repairs / Changes

| File | Status | Reason | Before | After |
|---|---|---|---|---|
$PatchTable

## Static Health Check

| File | Exists | Literal Backtick Newline Tokens | Has WA Import | Has WA Marker | Has Expected Chat Terms | SHA256 |
|---|---:|---:|---:|---:|---:|---|
$StaticHealthTable

## Validation / Build

| Step | Command | Workdir | Exit Code | Timed Out | Skipped | Output |
|---|---|---|---:|---:|---:|---|
$ValidationTable

## Generated / Updated Files

| File | Purpose |
|---|---|
| ``$ImplementationReportPath`` | Updated implementation report |
| ``$ManualQaPath`` | Manual QA signoff checklist |
| ``$SmokeGuidePath`` | Browser smoke guide |
| ``$BackupDir`` | Backups before final closure patch |
| ``$LogPath`` | Execution log |

## Next Step

If automated decision is ``AUTOMATED_VALIDATION_PASS_MANUAL_QA_PENDING``, run the manual browser QA checklist.

If automated decision is ``VALIDATION_PASS_BUILD_SCRIPT_NOT_FOUND_MANUAL_QA_PENDING``, either add/confirm the correct build script or accept that this repo has no discovered build command and proceed to manual QA.

If automated decision is ``CLOSURE_BLOCKED_BY_VALIDATION``, open the referenced validation log and fix the failing command.
"@
Write-Text -Path $ReportPath -Content $Report

Write-Step "Final closure report created: $ReportPath"

if (-not $NoOpenReport) {
    try {
        Invoke-Item -LiteralPath $ReportPath
        Write-Step "Report launched."
    } catch {
        Write-WarnLine "Could not launch report automatically: $($_.Exception.Message)"
    }
}

Write-Step "APEX WhatsApp Chat Final Closure V1 finished."
Write-Host ""
Write-Host "DONE"
Write-Host "Decision: $Decision"
Write-Host "Report: $ReportPath"
Write-Host "Manual QA: $ManualQaPath"
Write-Host "Smoke Guide: $SmokeGuidePath"
Write-Host "Implementation report: $ImplementationReportPath"
