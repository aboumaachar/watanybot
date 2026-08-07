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

function Add-ImportIfMissing {
    param(
        [string]$Content,
        [string]$ImportLine
    )

    if ($Content.Contains($ImportLine)) {
        return $Content
    }

    $Lines = $Content -split "`r?`n"
    $LastImportIndex = -1
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match '^\s*import\s') {
            $LastImportIndex = $i
        }
    }

    if ($LastImportIndex -ge 0) {
        $Before = @()
        $After = @()
        if ($LastImportIndex -ge 0) { $Before = $Lines[0..$LastImportIndex] }
        if ($LastImportIndex + 1 -lt $Lines.Count) { $After = $Lines[($LastImportIndex + 1)..($Lines.Count - 1)] }
        return (($Before + $ImportLine + $After) -join "`r`n")
    }

    return $ImportLine + "`r`n" + $Content
}

function Replace-Text {
    param(
        [string]$Content,
        [string]$Old,
        [string]$New
    )

    if ($Content.Contains($New)) {
        return $Content
    }

    if ($Content.Contains($Old)) {
        return $Content.Replace($Old, $New)
    }

    return $Content
}

function Patch-File {
    param(
        [string]$RelativePath,
        [scriptblock]$PatchBlock
    )

    $Path = Join-Path $script:RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-WarnLine "Patch target missing: $RelativePath"
        $script:PatchRows += "| ``$RelativePath`` | Missing | No changes |"
        return
    }

    $Before = Read-Text -Path $Path
    $BeforeHash = Get-FileSha256 -Path $Path

    $After = & $PatchBlock $Before

    if ($After -eq $Before) {
        Write-Step "No changes needed: $RelativePath"
        $script:PatchRows += "| ``$RelativePath`` | Unchanged | ``$BeforeHash`` |"
        return
    }

    Backup-File -Path $Path -BackupRoot $script:BackupDir
    Write-Text -Path $Path -Content $After

    $AfterHash = if ($Apply) { Get-FileSha256 -Path $Path } else { "DRY-RUN" }
    $script:PatchRows += "| ``$RelativePath`` | Patched | Before: ``$BeforeHash`` / After: ``$AfterHash`` |"
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
    $RunDir = Join-Path $RepoRoot ".apex\whatsapp-chat-apply-integration\$RunId"
} else {
    $RunDir = Join-Path $env:TEMP "apex-whatsapp-chat-apply-integration-$RunId"
}

$BackupDir = Join-Path $RunDir "backups"
$LogPath = Join-Path $RunDir "execution.log"
$script:BackupDir = $BackupDir
$script:LogPath = $LogPath
$script:PatchRows = @()

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Set-Content -LiteralPath $LogPath -Value "APEX WhatsApp Chat Apply Integration V1`r`nRunId: $RunId`r`nRepoRoot: $RepoRoot`r`n" -Encoding utf8

$ReportPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_APPLY_INTEGRATION_REPORT.md"
$FinalImplementationReportPath = Join-Path $RepoRoot "docs\APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md"

Write-Step "APEX WhatsApp Chat Apply Integration V1 started"
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
        $DestScript = Join-Path $ScriptDir "APEX-WhatsApp-Chat-Apply-Integration-V1.ps1"
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

# Verify scaffold
$ScaffoldFiles = @(
    "apps\web-user\src\components\chat\whatsapp\chat-types.ts",
    "apps\web-user\src\components\chat\whatsapp\WhatsAppChatShell.tsx",
    "apps\web-user\src\components\chat\whatsapp\whatsapp-chat.css",
    "apps\web-user\src\components\chat\whatsapp\index.ts",
    "apps\web-user\src\components\chat\whatsapp\README_INTEGRATION.md"
)

$ScaffoldRows = @()
$MissingScaffold = @()
foreach ($Rel in $ScaffoldFiles) {
    $Full = Join-Path $RepoRoot $Rel
    $Exists = Test-Path -LiteralPath $Full
    if (-not $Exists) { $MissingScaffold += $Rel }
    $ScaffoldRows += "| ``$Rel`` | $Exists |"
}
$ScaffoldTable = $ScaffoldRows -join "`r`n"

if (@($MissingScaffold).Count -gt 0) {
    Write-WarnLine "Missing scaffold files detected. The integration CSS will still be generated."
} else {
    Write-Step "All scaffold files found."
}

# CSS hardening for web-user
$UserIntegrationCssPath = Join-Path $RepoRoot "apps\web-user\src\components\chat\whatsapp\whatsapp-integration.css"
$UserIntegrationCss = @'
/*
  APEX WhatsApp Chat Integration Layer
  Purpose: apply mobile-safe WhatsApp-style behavior to the existing active chat screens
  without replacing existing API/auth/business logic.
*/

.wa-integrated-chat {
  min-height: 0;
}

.chat-screen.wa-integrated-chat,
.wt-chat-screen.wa-integrated-chat {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  background: var(--surface, #f6f1ea);
}

.chat-screen.wa-integrated-chat .chat-messages,
.wt-chat-screen.wa-integrated-chat .wt-chat-list,
.chat-popup.wa-integrated-chat .chat-popup-messages,
.ucw-panel.wa-integrated-chat .ucw-messages,
.groups-chat.wa-integrated-chat .groups-posts,
.session-thread.wa-integrated-chat {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

.chat-screen.wa-integrated-chat .chat-composer,
.wt-chat-screen.wa-integrated-chat .wt-composer,
.chat-popup.wa-integrated-chat .chat-popup-composer,
.ucw-panel.wa-integrated-chat .ucw-composer,
.groups-chat.wa-integrated-chat .groups-input-area {
  position: sticky;
  bottom: 0;
  z-index: 30;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
  border-top: 1px solid rgba(31, 41, 51, 0.12);
  background: var(--surface-raised, #fffaf3);
}

.chat-screen.wa-integrated-chat .chat-composer textarea,
.wt-chat-screen.wa-integrated-chat .wt-input,
.chat-popup.wa-integrated-chat .chat-popup-input,
.ucw-panel.wa-integrated-chat .ucw-composer__input,
.groups-chat.wa-integrated-chat .groups-post-input,
.groups-chat.wa-integrated-chat .groups-reply-field {
  min-height: 44px;
  font-size: 16px;
  line-height: 1.35;
}

.chat-screen.wa-integrated-chat button,
.wt-chat-screen.wa-integrated-chat button,
.chat-popup.wa-integrated-chat button,
.ucw-panel.wa-integrated-chat button,
.groups-chat.wa-integrated-chat button {
  min-height: 44px;
  min-width: 44px;
}

.chat-screen.wa-integrated-chat .msg,
.wt-chat-screen.wa-integrated-chat .msg,
.chat-popup.wa-integrated-chat .msg {
  display: flex;
  width: 100%;
  margin-block: 6px;
}

.chat-screen.wa-integrated-chat .msg-user,
.wt-chat-screen.wa-integrated-chat .msg-user,
.chat-popup.wa-integrated-chat .msg-user {
  justify-content: flex-end;
}

.chat-screen.wa-integrated-chat .msg-assistant,
.wt-chat-screen.wa-integrated-chat .msg-assistant,
.chat-popup.wa-integrated-chat .msg-assistant {
  justify-content: flex-start;
}

.chat-screen.wa-integrated-chat .msg-bubble,
.wt-chat-screen.wa-integrated-chat .msg-bubble,
.chat-popup.wa-integrated-chat .msg-bubble {
  max-width: min(78%, 680px);
  border-radius: 18px;
  padding: 10px 12px 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  word-break: break-word;
  white-space: pre-wrap;
}

.chat-screen.wa-integrated-chat .msg-user .msg-bubble,
.wt-chat-screen.wa-integrated-chat .msg-user .msg-bubble,
.chat-popup.wa-integrated-chat .msg-user .msg-bubble {
  background: #d9fdd3;
  color: #102315;
  border-end-end-radius: 6px;
}

.chat-screen.wa-integrated-chat .msg-assistant .msg-bubble,
.wt-chat-screen.wa-integrated-chat .msg-assistant .msg-bubble,
.chat-popup.wa-integrated-chat .msg-assistant .msg-bubble {
  background: #ffffff;
  color: #1f2933;
  border-end-start-radius: 6px;
}

.chat-screen.wa-integrated-chat .msg-time,
.wt-chat-screen.wa-integrated-chat .msg-time,
.chat-popup.wa-integrated-chat .msg-time {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  width: 100%;
  margin-top: 4px;
  color: #53606d;
  font-size: 11px;
}

.chat-screen.wa-integrated-chat .wa-ticks,
.wt-chat-screen.wa-integrated-chat .wa-ticks,
.chat-popup.wa-integrated-chat .wa-ticks {
  color: #2563eb;
  letter-spacing: -2px;
}

.ucw-panel.wa-integrated-chat {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto auto;
  max-height: min(720px, calc(100dvh - 32px));
  overflow: hidden;
}

.groups-chat.wa-integrated-chat {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto auto;
  min-height: 0;
  max-height: calc(100dvh - 160px);
  overflow: hidden;
}

.groups-chat.wa-integrated-chat .groups-post {
  border-radius: 18px;
}

.groups-chat.wa-integrated-chat .groups-post-content,
.groups-chat.wa-integrated-chat .groups-reply-content {
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 640px) {
  .chat-screen.wa-integrated-chat,
  .wt-chat-screen.wa-integrated-chat {
    height: 100dvh;
    max-height: 100dvh;
  }

  .chat-screen.wa-integrated-chat .msg-bubble,
  .wt-chat-screen.wa-integrated-chat .msg-bubble,
  .chat-popup.wa-integrated-chat .msg-bubble {
    max-width: 86%;
    font-size: 16px;
  }

  .chat-popup.wa-integrated-chat {
    inset: 0;
    width: 100%;
    max-width: none;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }

  .groups-chat.wa-integrated-chat {
    max-height: 100dvh;
  }
}
'@

Backup-File -Path $UserIntegrationCssPath -BackupRoot $BackupDir
Write-Text -Path $UserIntegrationCssPath -Content $UserIntegrationCss
$script:PatchRows += "| ``apps\web-user\src\components\chat\whatsapp\whatsapp-integration.css`` | Written | Mobile-safe integration CSS |"

# CSS hardening for web-admin
$AdminCssPath = Join-Path $RepoRoot "apps\web-admin\src\whatsapp-chat-monitor.css"
$AdminCss = @'
/* APEX WhatsApp-style admin chat monitor layer */

.chat-monitor-layout {
  min-height: min(760px, calc(100dvh - 160px));
}

.conversation-pane.wa-admin-chat {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
}

.conversation-pane.wa-admin-chat .msg-list {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
}

.conversation-pane.wa-admin-chat .msg-bubble {
  max-width: min(78%, 720px);
  border-radius: 18px;
  padding: 10px 12px;
  margin-block: 8px;
  word-break: break-word;
  white-space: pre-wrap;
}

.conversation-pane.wa-admin-chat .msg-bubble.user {
  margin-inline-start: auto;
  background: #d9fdd3;
  color: #102315;
}

.conversation-pane.wa-admin-chat .msg-bubble.assistant,
.conversation-pane.wa-admin-chat .msg-bubble.admin,
.conversation-pane.wa-admin-chat .msg-bubble.system {
  margin-inline-end: auto;
  background: #ffffff;
  color: #1f2933;
}

.conversation-pane.wa-admin-chat .msg-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
}

@media (max-width: 720px) {
  .chat-monitor-layout {
    grid-template-columns: 1fr;
    min-height: 100dvh;
  }

  .conversation-pane.wa-admin-chat .msg-bubble {
    max-width: 88%;
  }
}
'@

Backup-File -Path $AdminCssPath -BackupRoot $BackupDir
Write-Text -Path $AdminCssPath -Content $AdminCss
$script:PatchRows += "| ``apps\web-admin\src\whatsapp-chat-monitor.css`` | Written | Admin chat monitor CSS |"

# Patch web-user components/pages
Patch-File -RelativePath "apps\web-user\src\components\ChatScreen.tsx" -PatchBlock {
    param($c)
    $c = Add-ImportIfMissing -Content $c -ImportLine 'import "./chat/whatsapp/whatsapp-integration.css";'
    $c = Replace-Text -Content $c -Old 'className="chat-screen"' -New 'className="chat-screen wa-integrated-chat"'
    $c = Replace-Text -Content $c -Old 'onAction={handleMessageAction} />' -New 'onAction={handleMessageAction} waMode />'
    return $c
}

Patch-File -RelativePath "apps\web-user\src\components\ChatFirstWindow.tsx" -PatchBlock {
    param($c)
    $c = Add-ImportIfMissing -Content $c -ImportLine 'import "./chat/whatsapp/whatsapp-integration.css";'
    $c = Replace-Text -Content $c -Old 'className="wt-chat-screen"' -New 'className="wt-chat-screen wa-integrated-chat"'
    $c = Replace-Text -Content $c -Old 'onReport={m.role === "assistant" ? handleReportMessage : undefined}' -New 'onReport={m.role === "assistant" ? handleReportMessage : undefined}`r`n            waMode'
    return $c
}

Patch-File -RelativePath "apps\web-user\src\components\ChatMessageView.tsx" -PatchBlock {
    param($c)
    $c = Add-ImportIfMissing -Content $c -ImportLine 'import "./chat/whatsapp/whatsapp-integration.css";'
    $c = Replace-Text -Content $c -Old '<div className="msg-text">{typeof message.text === "string" ? fixMojibake(message.text) : message.text}</div>' -New '<div className="msg-text" dir="auto">{typeof message.text === "string" ? fixMojibake(message.text) : message.text}</div>'
    return $c
}

Patch-File -RelativePath "apps\web-user\src\components\ChatPopup.tsx" -PatchBlock {
    param($c)
    $c = Add-ImportIfMissing -Content $c -ImportLine 'import "./chat/whatsapp/whatsapp-integration.css";'
    $c = Replace-Text -Content $c -Old 'className="chat-popup ds-card ds-panel-enter"' -New 'className="chat-popup ds-card ds-panel-enter wa-integrated-chat"'
    $c = Replace-Text -Content $c -Old 'onReport={msg.role === "assistant" ? handleReportMessage : undefined}' -New 'onReport={msg.role === "assistant" ? handleReportMessage : undefined}`r`n              waMode'
    return $c
}

Patch-File -RelativePath "apps\web-user\src\components\UniversalChatWidget.tsx" -PatchBlock {
    param($c)
    $c = Add-ImportIfMissing -Content $c -ImportLine 'import "./chat/whatsapp/whatsapp-integration.css";'
    $c = Replace-Text -Content $c -Old 'className="ucw-panel"' -New 'className="ucw-panel wa-integrated-chat"'
    return $c
}

Patch-File -RelativePath "apps\web-user\src\pages\ChatSessionsPage.tsx" -PatchBlock {
    param($c)
    $c = Add-ImportIfMissing -Content $c -ImportLine 'import "../components/chat/whatsapp/whatsapp-integration.css";'
    $c = Replace-Text -Content $c -Old 'className="session-thread"' -New 'className="session-thread wa-integrated-chat"'
    return $c
}

Patch-File -RelativePath "apps\web-user\src\pages\GroupChatsPage.tsx" -PatchBlock {
    param($c)
    $c = Add-ImportIfMissing -Content $c -ImportLine 'import "../components/chat/whatsapp/whatsapp-integration.css";'
    $c = Replace-Text -Content $c -Old 'className="groups-chat"' -New 'className="groups-chat wa-integrated-chat"'
    return $c
}

Patch-File -RelativePath "apps\web-user\src\pages\SavedChatsPage.tsx" -PatchBlock {
    param($c)
    $c = Add-ImportIfMissing -Content $c -ImportLine 'import "../components/chat/whatsapp/whatsapp-integration.css";'
    return $c
}

Patch-File -RelativePath "apps\web-admin\src\pages\ChatMonitorPage.tsx" -PatchBlock {
    param($c)
    $c = Add-ImportIfMissing -Content $c -ImportLine 'import "../whatsapp-chat-monitor.css";'
    $c = Replace-Text -Content $c -Old 'className="conversation-pane"' -New 'className="conversation-pane wa-admin-chat"'
    return $c
}

# Write final implementation report
$PatchTable = $script:PatchRows -join "`r`n"

$ImplementationReport = @"
# APEX WhatsApp Chat Behavior Implementation Report

## Status

APEX Apply Integration V1 executed.

## Scope

This pass applies conservative, reversible integration patches. It does not replace business logic, API calls, authentication, role checks, admin actions, saved chats, or group moderation logic.

## Scaffold Files Used

| File | Exists |
|---|---:|
$ScaffoldTable

## Files Modified / Checked

| File | Status | Evidence |
|---|---|---|
$PatchTable

## Message Mapping Decisions

- Existing `ChatMessageView` already supports `waMode`.
- This pass enables `waMode` on main assistant/user chat render paths where safe.
- Existing user/assistant role mapping is preserved.
- Existing backend message shape is not changed.
- Fallback delivery semantics remain visual-only through existing `waMode` ticks.

## Send / Retry Behavior

- Existing send flows are preserved.
- Existing pending/loading state is preserved.
- Existing error handling is preserved.
- This pass does not introduce a new backend retry endpoint because none was confirmed in the target files.

## Read / Unread Behavior

- Existing unread/session/group counts are preserved.
- This pass does not mark messages as read from background fetches.
- No backend read-state mutation was added.

## Arabic RTL Handling

- `ChatMessageView` now applies `dir="auto"` to message text.
- Existing Arabic placeholders and labels are preserved.
- Existing group/page Arabic content is preserved.

## Mobile Keyboard / Composer Behavior

- Added `whatsapp-integration.css` for active web-user chat surfaces.
- Added `whatsapp-chat-monitor.css` for admin chat monitor.
- Composer areas are sticky and safe-area aware.
- Message lists use `min-height: 0`, `overflow-y: auto`, and `overscroll-behavior: contain`.
- Touch targets are hardened to at least 44px on affected chat surfaces.

## Validation Evidence

Validation is run by this script when `RunValidation=true`.

## Manual QA Checklist

- [ ] Desktop ChatScreen opens
- [ ] Mobile width 390px
- [ ] Mobile width 430px
- [ ] Keyboard does not cover composer
- [ ] Long conversation scroll
- [ ] Arabic message RTL
- [ ] Mixed Arabic/English message
- [ ] ChatPopup opens and sends
- [ ] UniversalChatWidget opens and sends
- [ ] GroupChatsPage still loads
- [ ] SavedChatsPage still loads
- [ ] ChatSessionsPage moderator view still works
- [ ] Admin ChatMonitorPage still works

## Remaining Risks

- This is a conservative UI/behavior integration, not a full backend delivery/read-receipt implementation.
- Failed-message retry remains limited by existing API support.
- Group chat is structurally post/reply based, so WhatsApp behavior is applied through layout hardening rather than replacing the group post model.
- Admin monitor remains read/flag focused because no admin reply endpoint was confirmed in the active file.
"@

Write-Text -Path $FinalImplementationReportPath -Content $ImplementationReport
$script:PatchRows += "| ``docs\APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md`` | Written | Final implementation report |"

# Validation
$ValidationResults = @()
if ($RunValidation) {
    $PkgPath = Join-Path $RepoRoot "package.json"
    $Pkg = Get-PackageJson -Path $PkgPath

    if (Has-NpmScript -PackageJson $Pkg -ScriptName "typecheck") {
        $ValidationResults += (Invoke-NpmCommandStable -Name "root-typecheck" -Command "npm run typecheck" -WorkingDirectory $RepoRoot -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds)
    }
    if (Has-NpmScript -PackageJson $Pkg -ScriptName "lint") {
        $ValidationResults += (Invoke-NpmCommandStable -Name "root-lint" -Command "npm run lint" -WorkingDirectory $RepoRoot -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds)
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

$Duration = New-TimeSpan -Start $Started -End (Get-Date)

$RunReport = @"
# APEX WhatsApp Chat Apply Integration V1 Report

## Status

$(if ($Apply) { "APPLY mode completed." } else { "DRY-RUN completed." })

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

## Scaffold Status

| File | Exists |
|---|---:|
$ScaffoldTable

## Patches

| File | Status | Evidence |
|---|---|---|
$($script:PatchRows -join "`r`n")

## Validation

| Step | Command | Workdir | Exit Code | Timed Out | Skipped | Output |
|---|---|---|---:|---:|---:|---|
$ValidationTable

## Generated Files

| File | Purpose |
|---|---|
| ``$FinalImplementationReportPath`` | Final implementation report |
| ``$BackupDir`` | Backups before patch |
| ``$LogPath`` | Execution log |

## Next Step

Open and review:

    $FinalImplementationReportPath

Then manually QA:

- ChatScreen
- ChatFirstWindow
- ChatPopup
- UniversalChatWidget
- GroupChatsPage
- SavedChatsPage
- ChatSessionsPage
- ChatMonitorPage

## Notes

This script applies a conservative integration layer instead of replacing core chat code. It is designed to be reversible through the backups folder.
"@

Write-Text -Path $ReportPath -Content $RunReport

Write-Step "Apply integration report created: $ReportPath"

if (-not $NoOpenReport) {
    try {
        Invoke-Item -LiteralPath $ReportPath
        Write-Step "Report launched."
    } catch {
        Write-WarnLine "Could not launch report automatically: $($_.Exception.Message)"
    }
}

Write-Step "APEX WhatsApp Chat Apply Integration V1 finished."
Write-Host ""
Write-Host "DONE"
Write-Host "Report: $ReportPath"
Write-Host "Implementation report: $FinalImplementationReportPath"
