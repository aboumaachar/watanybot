[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [switch]$Apply,
    [switch]$RunPreValidation,
    [switch]$RunPostValidation,
    [switch]$RunBuild,
    [switch]$RunTests,
    [int]$TimeoutSeconds = 180,
    [switch]$NoOpenReport,
    [switch]$SkipSelfInstall,
    [switch]$OpenPrompt
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

function Write-Utf8File {
    param(
        [string]$Path,
        [string]$Content
    )
    $Dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $Dir)) {
        if ($Apply) {
            New-Item -ItemType Directory -Path $Dir -Force | Out-Null
            Write-Step "Created directory: $Dir"
        } else {
            Write-Step "DRY-RUN: would create directory: $Dir"
            return
        }
    }

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
    try {
        return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    } catch {
        return ""
    }
}

function Copy-BackupFile {
    param(
        [string]$RepoRoot,
        [string]$RelativePath,
        [string]$BackupRoot
    )

    $Source = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Source)) {
        return $false
    }

    $Dest = Join-Path $BackupRoot $RelativePath
    $DestDir = Split-Path -Parent $Dest
    if (-not (Test-Path -LiteralPath $DestDir)) {
        if ($Apply) {
            New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
        }
    }

    if ($Apply) {
        Copy-Item -LiteralPath $Source -Destination $Dest -Force
        Write-Step "Backup created: $Dest"
    } else {
        Write-Step "DRY-RUN: would backup $Source to $Dest"
    }

    return $true
}

function Get-PackageJson {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        return Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json
    } catch {
        Write-WarnLine "Could not parse package.json: $Path"
        return $null
    }
}

function Has-NpmScript {
    param(
        [object]$PackageJson,
        [string]$ScriptName
    )
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
        Set-Content -LiteralPath $CombinedPath -Value "# $Name`r`nDRY-RUN: would run $Command in $WorkingDirectory" -Encoding utf8
        return [pscustomobject]@{
            Name = $Name
            Command = $Command
            Workdir = $WorkingDirectory
            ExitCode = 0
            TimedOut = $false
            Skipped = $true
            OutputPath = $CombinedPath
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
    }
}

function Find-PackageTargets {
    param([string]$Root)

    $Candidates = @(
        ".",
        "apps\web-user",
        "apps\web-admin",
        "apps\web",
        "apps\gateway-api"
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
    $RunDir = Join-Path $RepoRoot ".apex\whatsapp-chat-integration-driver\$RunId"
} else {
    $RunDir = Join-Path $env:TEMP "apex-whatsapp-chat-integration-driver-$RunId"
}

$BackupDir = Join-Path $RunDir "backups"
$SnapshotDir = Join-Path $RunDir "snapshots"
$LogPath = Join-Path $RunDir "execution.log"
$script:LogPath = $LogPath

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
New-Item -ItemType Directory -Path $SnapshotDir -Force | Out-Null
Set-Content -LiteralPath $LogPath -Value "APEX WhatsApp Chat Integration Driver V1`r`nRunId: $RunId`r`nRepoRoot: $RepoRoot`r`n" -Encoding utf8

$ReportPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_INTEGRATION_DRIVER_REPORT.md"
$PromptPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_INTEGRATION_CLAUDE_PROMPT.md"
$SnapshotPath = Join-Path $RunDir "TARGET_CHAT_FILE_SNAPSHOT.md"
$InventoryPath = Join-Path $RunDir "TARGET_CHAT_FILE_INVENTORY.md"
$FinalReportTemplatePath = Join-Path $RunDir "IMPLEMENTATION_REPORT_TEMPLATE.md"

Write-Step "APEX WhatsApp Chat Integration Driver V1 started"
Write-Step "RepoRoot: $RepoRoot"
Write-Step "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"
Write-Step "RunPreValidation: $RunPreValidation"
Write-Step "RunPostValidation: $RunPostValidation"
Write-Step "RunBuild: $RunBuild"
Write-Step "RunTests: $RunTests"
Write-Step "TimeoutSeconds: $TimeoutSeconds"

# Self-install
try {
    $SelfPath = $PSCommandPath
    $Downloads = Join-Path $env:USERPROFILE "Downloads"
    if (-not $SkipSelfInstall -and $SelfPath -and $SelfPath.StartsWith($Downloads, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ScriptDir = Join-Path $RepoRoot "scripts\apex"
        $DestScript = Join-Path $ScriptDir "APEX-WhatsApp-Chat-Integration-Driver-V1.ps1"
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

$ScaffoldFiles = @(
    "apps\web-user\src\components\chat\whatsapp\chat-types.ts",
    "apps\web-user\src\components\chat\whatsapp\WhatsAppChatShell.tsx",
    "apps\web-user\src\components\chat\whatsapp\whatsapp-chat.css",
    "apps\web-user\src\components\chat\whatsapp\index.ts",
    "apps\web-user\src\components\chat\whatsapp\README_INTEGRATION.md"
)

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

# Scaffold verification
$ScaffoldRows = @()
$ScaffoldMissing = @()
foreach ($Rel in $ScaffoldFiles) {
    $Full = Join-Path $RepoRoot $Rel
    $Exists = Test-Path -LiteralPath $Full
    if (-not $Exists) { $ScaffoldMissing += $Rel }
    $ScaffoldRows += "| ``$Rel`` | $Exists |"
}
$ScaffoldTable = $ScaffoldRows -join "`r`n"

if (@($ScaffoldMissing).Count -gt 0) {
    Write-WarnLine "One or more scaffold files are missing. The prompt will still be generated."
} else {
    Write-Step "All scaffold files exist."
}

# Target inventory, backups, snapshots
$InventoryObjects = @()
$SnapshotSections = @()

foreach ($Rel in $TargetFiles) {
    $Full = Join-Path $RepoRoot $Rel
    $Exists = Test-Path -LiteralPath $Full
    $Size = 0
    $Hash = ""
    $Modified = ""
    $Content = ""

    if ($Exists) {
        $Item = Get-Item -LiteralPath $Full
        $Size = $Item.Length
        $Modified = $Item.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        $Hash = Get-FileSha256 -Path $Full
        [void](Copy-BackupFile -RepoRoot $RepoRoot -RelativePath $Rel -BackupRoot $BackupDir)

        try {
            $Content = Get-Content -LiteralPath $Full -Raw -Encoding utf8
        } catch {
            $Content = "[Could not read file as UTF-8: $($_.Exception.Message)]"
        }
    } else {
        Write-WarnLine "Target file missing: $Rel"
    }

    $InventoryObjects += [pscustomobject]@{
        RelativePath = $Rel
        FullPath = $Full
        Exists = $Exists
        SizeBytes = $Size
        Modified = $Modified
        Sha256 = $Hash
    }

    $SnapshotSections += @"
## $Rel

Exists: $Exists  
SizeBytes: $Size  
Modified: $Modified  
SHA256: $Hash  

````tsx
$Content
````
"@
}

$InventoryRows = @()
foreach ($Obj in $InventoryObjects) {
    $InventoryRows += "| ``$($Obj.RelativePath)`` | $($Obj.Exists) | $($Obj.SizeBytes) | $($Obj.Modified) | ``$($Obj.Sha256)`` |"
}
$InventoryTable = $InventoryRows -join "`r`n"

$Snapshot = @"
# Target Chat File Snapshot

Run ID: $RunId  
Repo Root: ``$RepoRoot``

This snapshot captures the target chat files before Claude/Copilot integration.

$($SnapshotSections -join "`r`n`r`n")
"@

$Inventory = @"
# Target Chat File Inventory

Run ID: $RunId  
Repo Root: ``$RepoRoot``

## Scaffold Status

| File | Exists |
|---|---:|
$ScaffoldTable

## Target Files

| File | Exists | Size | Modified | SHA256 |
|---|---:|---:|---|---|
$InventoryTable
"@

Write-Utf8File -Path $SnapshotPath -Content $Snapshot
Write-Utf8File -Path $InventoryPath -Content $Inventory

# Optional pre-validation
$ValidationResults = @()
if ($RunPreValidation) {
    Write-Step "Running pre-integration validation."
    $Targets = Find-PackageTargets -Root $RepoRoot
    foreach ($Target in $Targets) {
        if (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "typecheck") {
            $ValidationResults += (Invoke-NpmCommandStable -Name "pre-$($Target.Name)-typecheck" -Command "npm run typecheck" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds)
        }
        if (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "lint") {
            $ValidationResults += (Invoke-NpmCommandStable -Name "pre-$($Target.Name)-lint" -Command "npm run lint" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds)
        }
    }
} else {
    Write-Step "Pre-validation skipped."
}

# Claude integration prompt
$Prompt = @"
# Claude/Copilot Task — Integrate WhatsApp Chat Scaffold Into Active WatanyBot Chat Screens

You are inside:

    $RepoRoot

You must now integrate the already-created WhatsApp-style scaffold into the real active chat surfaces.

## Current Evidence

The scaffold exists in:

    apps\web-user\src\components\chat\whatsapp

Scaffold files:

| File | Exists |
|---|---:|
$ScaffoldTable

Target file inventory:

    $InventoryPath

Target file snapshot:

    $SnapshotPath

Backups:

    $BackupDir

## Primary Target Files

Update these files carefully:

- apps\web-user\src\components\ChatScreen.tsx
- apps\web-user\src\components\ChatFirstWindow.tsx
- apps\web-user\src\components\ChatMessageView.tsx
- apps\web-user\src\components\ChatPopup.tsx
- apps\web-user\src\components\UniversalChatWidget.tsx
- apps\web-user\src\pages\ChatSessionsPage.tsx
- apps\web-user\src\pages\GroupChatsPage.tsx
- apps\web-user\src\pages\SavedChatsPage.tsx
- apps\web-admin\src\pages\ChatMonitorPage.tsx

## Mission

Make all real active chat screens behave like a full WhatsApp-style chat experience.

Do not make this cosmetic only. Implement behavior.

## Integration Rules

1. Do not work from archive, backup, `.venv`, `.apex`, or generated build files.
2. Preserve existing API calls, auth logic, admin logic, and role restrictions.
3. Do not blindly replace whole screens.
4. Import the scaffold from:

```ts
import { WhatsAppChatShell } from "./chat/whatsapp";
```

or use the correct relative path depending on the file location.

5. Map each existing message shape into the scaffold contract:

```ts
{
  id,
  conversationId,
  senderType: "user" | "admin" | "assistant" | "system",
  body,
  status: existingStatus ?? "sent",
  createdAt,
  senderName
}
```

6. Use fallback status `"sent"` when the backend does not provide delivered/read status.
7. Keep existing sending logic, but expose:
   - sending state
   - failed state
   - retry handler where possible
   - typing/loading indicator where possible
8. Preserve older-message loading or pagination if already present.
9. Keep Arabic RTL per message body.
10. Keep mobile-safe composer behavior:
   - `100dvh`
   - `min-height: 0`
   - scrollable message list
   - sticky/fixed header
   - sticky/fixed composer
   - `env(safe-area-inset-bottom)`
11. Make touch targets at least 44px.
12. Do not clear unread counts on background fetch. Only mark as read when the conversation is opened/visible.
13. Keep admin monitor behavior intact.

## Screens by Priority

### Priority 1 — User Chat

- `ChatScreen.tsx`
- `ChatFirstWindow.tsx`
- `ChatMessageView.tsx`
- `UniversalChatWidget.tsx`

### Priority 2 — Conversation Lists

- `ChatSessionsPage.tsx`
- `SavedChatsPage.tsx`
- `GroupChatsPage.tsx`

### Priority 3 — Admin

- `ChatMonitorPage.tsx`

## Required Final Report

Create or update:

    docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md

The report must include:

- Files inspected.
- Files modified.
- Scaffold files used.
- Message mapping decisions.
- Send/retry behavior.
- Read/unread behavior.
- Arabic RTL handling.
- Mobile keyboard/composer behavior.
- Validation commands run.
- Pass/fail evidence.
- Manual QA checklist.
- Remaining risks.

## Required Validation

After patching, run:

```powershell
npm run typecheck
npm run lint
```

If available and safe:

```powershell
npm run build
```

Do not run watch-mode tests. If tests are needed, run them with CI/non-watch settings and document the command.

## Acceptance Criteria

- Chat composer remains visible on mobile.
- Header remains visible.
- Message list scrolls without whole-page scroll bugs.
- Messages align by sender.
- Arabic messages render RTL.
- Enter sends; Shift+Enter creates newline where composer is active.
- Failed sends can be retried where the existing API makes that possible.
- Typing/loading indicator appears while waiting for assistant/support response.
- Conversation/session pages still work.
- Admin chat monitor still works.
- Typecheck and lint pass.
"@

Write-Utf8File -Path $PromptPath -Content $Prompt

$FinalReportTemplate = @"
# APEX WhatsApp Chat Behavior Implementation Report

## Status

Pending integration.

## Files Inspected

- [ ] apps\web-user\src\components\ChatScreen.tsx
- [ ] apps\web-user\src\components\ChatFirstWindow.tsx
- [ ] apps\web-user\src\components\ChatMessageView.tsx
- [ ] apps\web-user\src\components\ChatPopup.tsx
- [ ] apps\web-user\src\components\UniversalChatWidget.tsx
- [ ] apps\web-user\src\pages\ChatSessionsPage.tsx
- [ ] apps\web-user\src\pages\GroupChatsPage.tsx
- [ ] apps\web-user\src\pages\SavedChatsPage.tsx
- [ ] apps\web-admin\src\pages\ChatMonitorPage.tsx

## Files Modified

_To be completed by Claude/Copilot._

## Scaffold Files Used

| File | Used |
|---|---:|
$ScaffoldTable

## Message Mapping Decisions

_To be completed._

## Send / Retry Behavior

_To be completed._

## Read / Unread Behavior

_To be completed._

## Arabic RTL Handling

_To be completed._

## Mobile Keyboard / Composer Behavior

_To be completed._

## Validation Evidence

| Command | Result | Evidence |
|---|---|---|
| npm run typecheck | Pending | - |
| npm run lint | Pending | - |
| npm run build | Optional | - |

## Manual QA Checklist

- [ ] Desktop chat open
- [ ] Mobile width 390px
- [ ] Mobile width 430px
- [ ] Keyboard does not cover composer
- [ ] Long conversation scroll
- [ ] Arabic message RTL
- [ ] Mixed Arabic/English message
- [ ] Failed send retry
- [ ] Admin reply flow
- [ ] Conversation list still works

## Remaining Risks

_To be completed._
"@

Write-Utf8File -Path $FinalReportTemplatePath -Content $FinalReportTemplate

$ValidationRows = @()
foreach ($V in $ValidationResults) {
    $ValidationRows += "| $($V.Name) | ``$($V.Command)`` | ``$($V.Workdir)`` | $($V.ExitCode) | $($V.TimedOut) | $($V.Skipped) | ``$($V.OutputPath)`` |"
}
if ($ValidationRows.Count -eq 0) {
    $ValidationRows += "| _No validation commands executed_ | - | - | - | - | - | - |"
}
$ValidationTable = $ValidationRows -join "`r`n"

$Duration = New-TimeSpan -Start $Started -End (Get-Date)

$Report = @"
# APEX WhatsApp Chat Integration Driver V1 Report

## Status

$(if ($Apply) { "APPLY mode completed." } else { "DRY-RUN completed." })

This driver prepares the exact handoff package for Claude/Copilot to integrate the WhatsApp scaffold into the active chat screens.

## Metadata

| Field | Value |
|---|---|
| Run ID | $RunId |
| Repo Root | ``$RepoRoot`` |
| Apply | $Apply |
| RunPreValidation | $RunPreValidation |
| RunPostValidation | $RunPostValidation |
| RunBuild | $RunBuild |
| RunTests | $RunTests |
| Started | $($Started.ToString("yyyy-MM-dd HH:mm:ss")) |
| Duration | $($Duration.ToString()) |
| Encoding | UTF-8 forced / code page 65001 attempted |

## Scaffold Status

| File | Exists |
|---|---:|
$ScaffoldTable

## Target Files

| File | Exists | Size | Modified | SHA256 |
|---|---:|---:|---|---|
$InventoryTable

## Generated Files

| File | Purpose |
|---|---|
| ``$PromptPath`` | Strict Claude/Copilot integration prompt |
| ``$SnapshotPath`` | Snapshot of target chat files |
| ``$InventoryPath`` | Target file inventory and scaffold status |
| ``$FinalReportTemplatePath`` | Final implementation report template |
| ``$BackupDir`` | Backups of target files |
| ``$LogPath`` | Execution log |

## Validation

| Step | Command | Workdir | Exit Code | Timed Out | Skipped | Output |
|---|---|---|---:|---:|---:|---|
$ValidationTable

## Next Step

Open this file in Claude/Copilot:

    $PromptPath

Then ask it to patch the active target files and create:

    docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md

## Important

This script does not blindly edit chat screens. It prepares backups, snapshots, and the exact integration prompt for the coding agent.
"@

Write-Utf8File -Path $ReportPath -Content $Report

Write-Step "Integration driver report created: $ReportPath"

if ($OpenPrompt) {
    try {
        Invoke-Item -LiteralPath $PromptPath
        Write-Step "Prompt launched."
    } catch {
        Write-WarnLine "Could not open prompt automatically: $($_.Exception.Message)"
    }
} elseif (-not $NoOpenReport) {
    try {
        Invoke-Item -LiteralPath $ReportPath
        Write-Step "Report launched."
    } catch {
        Write-WarnLine "Could not launch report automatically: $($_.Exception.Message)"
    }
}

Write-Step "APEX WhatsApp Chat Integration Driver V1 finished."
Write-Host ""
Write-Host "DONE"
Write-Host "Report: $ReportPath"
Write-Host "Prompt: $PromptPath"
