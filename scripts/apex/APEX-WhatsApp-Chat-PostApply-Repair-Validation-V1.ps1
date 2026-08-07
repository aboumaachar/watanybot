[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [switch]$Apply,
    [bool]$RunValidation = $true,
    [switch]$RunBuild,
    [int]$TimeoutSeconds = 180,
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
    param(
        [string]$Path,
        [string]$Content
    )
    $Dir = Split-Path -Parent $Path
    Ensure-Directory -Path $Dir
    if ($Apply) {
        Set-Content -LiteralPath $Path -Value $Content -Encoding utf8
        Write-Step "Wrote: $Path"
    } else {
        Write-Step "DRY-RUN: would write: $Path"
    }
}

function Backup-File {
    param(
        [string]$Path,
        [string]$BackupRoot
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        Write-WarnLine "Cannot backup missing file: $Path"
        return
    }

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

function Get-FileSha256 {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return "" }
    try { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash } catch { return "" }
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
        return [pscustomobject]@{ Name=$Name; Command=$Command; Workdir=$WorkingDirectory; ExitCode=0; TimedOut=$false; Skipped=$true; OutputPath=$CombinedPath }
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
    if (Test-Path -LiteralPath $StdoutPath) { try { $StdoutText = Get-Content -LiteralPath $StdoutPath -Raw -Encoding utf8 } catch {} }
    if (Test-Path -LiteralPath $StderrPath) { try { $StderrText = Get-Content -LiteralPath $StderrPath -Raw -Encoding utf8 } catch {} }

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

    return [pscustomobject]@{ Name=$Name; Command=$Command; Workdir=$WorkingDirectory; ExitCode=$ExitCode; TimedOut=$TimedOut; Skipped=$false; OutputPath=$CombinedPath }
}

function Patch-TextFile {
    param(
        [string]$RelativePath,
        [scriptblock]$PatchBlock,
        [string]$Reason
    )

    $Path = Join-Path $script:RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-WarnLine "Target missing: $RelativePath"
        $script:PatchRows += "| ``$RelativePath`` | Missing | $Reason | - | - |"
        return
    }

    $Before = Read-Text -Path $Path
    $BeforeHash = Get-FileSha256 -Path $Path
    $After = & $PatchBlock $Before

    if ($After -eq $Before) {
        Write-Step "No changes needed: $RelativePath"
        $script:PatchRows += "| ``$RelativePath`` | Unchanged | $Reason | ``$BeforeHash`` | ``$BeforeHash`` |"
        return
    }

    Backup-File -Path $Path -BackupRoot $script:BackupDir
    Write-Text -Path $Path -Content $After
    $AfterHash = if ($Apply) { Get-FileSha256 -Path $Path } else { "DRY-RUN" }
    $script:PatchRows += "| ``$RelativePath`` | Patched | $Reason | ``$BeforeHash`` | ``$AfterHash`` |"
}

function Get-StaticHealthRows {
    param([string[]]$RelativeFiles)

    $Rows = @()
    foreach ($Rel in $RelativeFiles) {
        $Path = Join-Path $script:RepoRoot $Rel
        if (-not (Test-Path -LiteralPath $Path)) {
            $Rows += "| ``$Rel`` | Missing | - | - | - |"
            continue
        }

        $Text = Read-Text -Path $Path
        $LiteralBacktickNewline = $Text.Contains('`r`n') -or $Text.Contains('`n')
        $HasWaImport = $Text -match 'whatsapp-integration\.css|whatsapp-chat-monitor\.css'
        $HasWaMarker = $Text -match 'wa-integrated-chat|wa-admin-chat|waMode|dir="auto"'
        $Hash = Get-FileSha256 -Path $Path

        $Rows += "| ``$Rel`` | True | $LiteralBacktickNewline | $HasWaImport | $HasWaMarker | ``$Hash`` |"
    }

    return ($Rows -join "`r`n")
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
    $RunDir = Join-Path $RepoRoot ".apex\whatsapp-chat-postapply-repair\$RunId"
} else {
    $RunDir = Join-Path $env:TEMP "apex-whatsapp-chat-postapply-repair-$RunId"
}

$BackupDir = Join-Path $RunDir "backups"
$LogPath = Join-Path $RunDir "execution.log"
$script:BackupDir = $BackupDir
$script:LogPath = $LogPath
$script:PatchRows = @()

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Set-Content -LiteralPath $LogPath -Value "APEX WhatsApp Chat Post-Apply Repair Validation V1`r`nRunId: $RunId`r`nRepoRoot: $RepoRoot`r`n" -Encoding utf8

$ReportPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_POSTAPPLY_REPAIR_VALIDATION_REPORT.md"
$ImplementationReportPath = Join-Path $RepoRoot "docs\APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md"

Write-Step "APEX WhatsApp Chat Post-Apply Repair Validation V1 started"
Write-Step "RepoRoot: $RepoRoot"
Write-Step "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"
Write-Step "RunValidation: $RunValidation"
Write-Step "RunBuild: $RunBuild"
Write-Step "TimeoutSeconds: $TimeoutSeconds"

# Self-install
try {
    $SelfPath = $PSCommandPath
    $Downloads = Join-Path $env:USERPROFILE "Downloads"
    if (-not $SkipSelfInstall -and $SelfPath -and $SelfPath.StartsWith($Downloads, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ScriptDir = Join-Path $RepoRoot "scripts\apex"
        $DestScript = Join-Path $ScriptDir "APEX-WhatsApp-Chat-PostApply-Repair-Validation-V1.ps1"
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

# Repair likely literal `r`n / `n sequence that came from generated prop insertions.
foreach ($Rel in $TargetFiles) {
    Patch-TextFile -RelativePath $Rel -Reason "Normalize accidental literal backtick newline tokens" -PatchBlock {
        param($Text)
        $NewLine = [Environment]::NewLine
        $Text = $Text.Replace('`r`n', $NewLine)
        $Text = $Text.Replace('`n', $NewLine)
        return $Text
    }
}

# Targeted formatting repair for ChatFirstWindow and ChatPopup if waMode was placed awkwardly.
Patch-TextFile -RelativePath "apps\web-user\src\components\ChatFirstWindow.tsx" -Reason "Ensure ChatMessageView waMode prop formatting" -PatchBlock {
    param($Text)
    $Text = $Text -replace 'onReport=\{m\.role === "assistant" \? handleReportMessage : undefined\}\s+waMode', 'onReport={m.role === "assistant" ? handleReportMessage : undefined}`r`n            waMode'
    return $Text
}

Patch-TextFile -RelativePath "apps\web-user\src\components\ChatPopup.tsx" -Reason "Ensure ChatMessageView waMode prop formatting" -PatchBlock {
    param($Text)
    $Text = $Text -replace 'onReport=\{msg\.role === "assistant" \? handleReportMessage : undefined\}\s+waMode', 'onReport={msg.role === "assistant" ? handleReportMessage : undefined}`r`n              waMode'
    return $Text
}

# The previous replacement used literal `r`n above intentionally within replacement string expansion.
# Normalize it again after regex replacement.
foreach ($Rel in @("apps\web-user\src\components\ChatFirstWindow.tsx", "apps\web-user\src\components\ChatPopup.tsx")) {
    Patch-TextFile -RelativePath $Rel -Reason "Final newline normalization after waMode formatting" -PatchBlock {
        param($Text)
        return $Text.Replace('`r`n', [Environment]::NewLine).Replace('`n', [Environment]::NewLine)
    }
}

# Ensure implementation report exists and gets updated with post-apply validation section.
if (Test-Path -LiteralPath $ImplementationReportPath) {
    Patch-TextFile -RelativePath "docs\APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md" -Reason "Append post-apply repair validation section" -PatchBlock {
        param($Text)
        if ($Text.Contains("## Post-Apply Repair / Validation")) {
            return $Text
        }
        $Append = @"

## Post-Apply Repair / Validation

APEX Post-Apply Repair Validation V1 was generated to confirm the conservative integration patch, normalize any accidental literal newline tokens in TSX props, and run safe validation.

Validation result details are stored in the `.apex/whatsapp-chat-postapply-repair/` run folder.

"@
        return $Text + $Append
    }
} else {
    $ImplementationReport = @"
# APEX WhatsApp Chat Behavior Implementation Report

## Status

Post-apply repair validation script created this report because the prior implementation report was not found.

## Notes

- WhatsApp integration scaffold should exist under apps\web-user\src\components\chat\whatsapp.
- This report should be updated after validation.
"@
    Write-Text -Path $ImplementationReportPath -Content $ImplementationReport
    $script:PatchRows += "| ``docs\APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md`` | Written | Created missing implementation report | - | - |"
}

# Static health after repair
$StaticHealthTable = Get-StaticHealthRows -RelativeFiles $TargetFiles

# Validation
$ValidationResults = @()
if ($RunValidation) {
    $PkgPath = Join-Path $RepoRoot "package.json"
    $Pkg = Get-PackageJson -Path $PkgPath

    if (Has-NpmScript -PackageJson $Pkg -ScriptName "typecheck") {
        $ValidationResults += (Invoke-NpmCommandStable -Name "root-typecheck" -Command "npm run typecheck" -WorkingDirectory $RepoRoot -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds)
    } else {
        Write-WarnLine "No root typecheck script found."
    }

    if (Has-NpmScript -PackageJson $Pkg -ScriptName "lint") {
        $ValidationResults += (Invoke-NpmCommandStable -Name "root-lint" -Command "npm run lint" -WorkingDirectory $RepoRoot -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds)
    } else {
        Write-WarnLine "No root lint script found."
    }

    if ($RunBuild -and (Has-NpmScript -PackageJson $Pkg -ScriptName "build")) {
        $ValidationResults += (Invoke-NpmCommandStable -Name "root-build" -Command "npm run build" -WorkingDirectory $RepoRoot -OutputDir $RunDir -TimeoutSeconds ([Math]::Max($TimeoutSeconds, 300)))
    }
} else {
    Write-Step "Validation skipped by RunValidation=false."
}

$ValidationRows = @()
foreach ($V in $ValidationResults) {
    $ValidationRows += "| $($V.Name) | ``$($V.Command)`` | ``$($V.Workdir)`` | $($V.ExitCode) | $($V.TimedOut) | $($V.Skipped) | ``$($V.OutputPath)`` |"
}
if ($ValidationRows.Count -eq 0) {
    $ValidationRows += "| _No validation commands executed_ | - | - | - | - | - | - |"
}
$ValidationTable = $ValidationRows -join "`r`n"

# Update implementation report with validation evidence if possible.
if (Test-Path -LiteralPath $ImplementationReportPath) {
    Patch-TextFile -RelativePath "docs\APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md" -Reason "Append latest validation evidence" -PatchBlock {
        param($Text)
        $Marker = "## Latest Post-Apply Validation Evidence"
        $Section = @"

$Marker

| Step | Command | Workdir | Exit Code | Timed Out | Skipped | Output |
|---|---|---|---:|---:|---:|---|
$ValidationTable

## Latest Static Health Check

| File | Exists | Literal Backtick Newline Tokens | Has WA Import | Has WA Marker | SHA256 |
|---|---:|---:|---:|---:|---|
$StaticHealthTable

"@
        if ($Text.Contains($Marker)) {
            $Text = $Text.Substring(0, $Text.IndexOf($Marker) - 3).TrimEnd()
        }
        return $Text + $Section
    }
}

$PatchTable = $script:PatchRows -join "`r`n"
$Duration = New-TimeSpan -Start $Started -End (Get-Date)

$Report = @"
# APEX WhatsApp Chat Post-Apply Repair Validation V1 Report

## Status

$(if ($Apply) { "APPLY mode completed." } else { "DRY-RUN completed." })

This script validates and repairs the conservative WhatsApp chat integration pass.

## Metadata

| Field | Value |
|---|---|
| Run ID | $RunId |
| Repo Root | ``$RepoRoot`` |
| Apply | $Apply |
| RunValidation | $RunValidation |
| RunBuild | $RunBuild |
| TimeoutSeconds | $TimeoutSeconds |
| Started | $($Started.ToString("yyyy-MM-dd HH:mm:ss")) |
| Duration | $($Duration.ToString()) |
| Encoding | UTF-8 forced / code page 65001 attempted |

## Repairs / Changes

| File | Status | Reason | Before | After |
|---|---|---|---|---|
$PatchTable

## Static Health Check

| File | Exists | Literal Backtick Newline Tokens | Has WA Import | Has WA Marker | SHA256 |
|---|---:|---:|---:|---:|---|
$StaticHealthTable

## Validation

| Step | Command | Workdir | Exit Code | Timed Out | Skipped | Output |
|---|---|---|---:|---:|---:|---|
$ValidationTable

## Generated / Updated Files

| File | Purpose |
|---|---|
| ``$ImplementationReportPath`` | Updated implementation report |
| ``$BackupDir`` | Backups before repair |
| ``$LogPath`` | Execution log |

## Next Step

If typecheck and lint pass, perform manual QA:

- ChatScreen
- ChatFirstWindow
- ChatPopup
- UniversalChatWidget
- GroupChatsPage
- SavedChatsPage
- ChatSessionsPage
- ChatMonitorPage

If typecheck fails, open the relevant validation log and give it to Claude/Copilot with this report.
"@

Write-Text -Path $ReportPath -Content $Report

Write-Step "Post-apply repair validation report created: $ReportPath"

if (-not $NoOpenReport) {
    try {
        Invoke-Item -LiteralPath $ReportPath
        Write-Step "Report launched."
    } catch {
        Write-WarnLine "Could not launch report automatically: $($_.Exception.Message)"
    }
}

Write-Step "APEX WhatsApp Chat Post-Apply Repair Validation V1 finished."
Write-Host ""
Write-Host "DONE"
Write-Host "Report: $ReportPath"
Write-Host "Implementation report: $ImplementationReportPath"
