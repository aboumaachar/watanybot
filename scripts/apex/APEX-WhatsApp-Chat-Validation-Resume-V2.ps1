[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [switch]$Apply,
    [int]$TimeoutSeconds = 180,
    [switch]$RunBuild,
    [switch]$RunTests,
    [switch]$OnlyRoot,
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

function Write-Utf8File {
    param(
        [string]$Path,
        [string]$Content
    )
    $Dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    }
    Set-Content -LiteralPath $Path -Value $Content -Encoding utf8
    Write-Step "Wrote: $Path"
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
    $ExitPath = Join-Path $OutputDir ("{0}.exit.txt" -f $BaseName)

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

    # Use cmd redirection instead of live stream capture.
    # This avoids VS Code PowerShell extension / NativeCommandError crashes caused by npm stderr warnings.
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
    Set-Content -LiteralPath $ExitPath -Value ([string]$ExitCode) -Encoding utf8

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

    $Candidates = if ($OnlyRoot) {
        @(".")
    } else {
        @(
            ".",
            "apps\web-user",
            "apps\web",
            "apps\web-admin",
            "apps\gateway-api"
        )
    }

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

function Test-ScaffoldExists {
    param([string]$Root)
    $Expected = @(
        "apps\web-user\src\components\chat\whatsapp\chat-types.ts",
        "apps\web-user\src\components\chat\whatsapp\WhatsAppChatShell.tsx",
        "apps\web-user\src\components\chat\whatsapp\whatsapp-chat.css",
        "apps\web-user\src\components\chat\whatsapp\index.ts",
        "apps\web-user\src\components\chat\whatsapp\README_INTEGRATION.md"
    )

    $Rows = @()
    foreach ($Rel in $Expected) {
        $Full = Join-Path $Root $Rel
        $Rows += [pscustomobject]@{
            RelativePath = $Rel
            FullPath = $Full
            Exists = (Test-Path -LiteralPath $Full)
        }
    }
    return $Rows
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
    $RunDir = Join-Path $RepoRoot ".apex\whatsapp-chat-validation-resume\$RunId"
} else {
    $RunDir = Join-Path $env:TEMP "apex-whatsapp-chat-validation-resume-$RunId"
}

$LogPath = Join-Path $RunDir "execution.log"
$script:LogPath = $LogPath

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null
Set-Content -LiteralPath $LogPath -Value "APEX WhatsApp Chat Validation Resume V2`r`nRunId: $RunId`r`nRepoRoot: $RepoRoot`r`n" -Encoding utf8

$ReportPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_VALIDATION_RESUME_V2_REPORT.md"
$NextTaskPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_INTEGRATION_NEXT_TASK.md"

Write-Step "APEX WhatsApp Chat Validation Resume V2 started"
Write-Step "RepoRoot: $RepoRoot"
Write-Step "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"
Write-Step "TimeoutSeconds: $TimeoutSeconds"
Write-Step "RunBuild: $RunBuild"
Write-Step "RunTests: $RunTests"
Write-Step "OnlyRoot: $OnlyRoot"

# Self-install
try {
    $SelfPath = $PSCommandPath
    $Downloads = Join-Path $env:USERPROFILE "Downloads"
    if (-not $SkipSelfInstall -and $SelfPath -and $SelfPath.StartsWith($Downloads, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ScriptDir = Join-Path $RepoRoot "scripts\apex"
        $DestScript = Join-Path $ScriptDir "APEX-WhatsApp-Chat-Validation-Resume-V2.ps1"
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

$ScaffoldStatus = Test-ScaffoldExists -Root $RepoRoot
$ScaffoldRows = @()
foreach ($S in $ScaffoldStatus) {
    $ScaffoldRows += "| ``$($S.RelativePath)`` | $($S.Exists) |"
}
$ScaffoldTable = $ScaffoldRows -join "`r`n"

$Targets = Find-PackageTargets -Root $RepoRoot
$ValidationResults = @()

foreach ($Target in $Targets) {
    if (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "typecheck") {
        $ValidationResults += (Invoke-NpmCommandStable -Name "$($Target.Name)-typecheck" -Command "npm run typecheck" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds)
    }

    if (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "lint") {
        $ValidationResults += (Invoke-NpmCommandStable -Name "$($Target.Name)-lint" -Command "npm run lint" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds)
    }

    if ($RunBuild -and (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "build")) {
        $ValidationResults += (Invoke-NpmCommandStable -Name "$($Target.Name)-build" -Command "npm run build" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds ([Math]::Max($TimeoutSeconds, 300)))
    }

    if ($RunTests -and (Has-NpmScript -PackageJson $Target.PackageJson -ScriptName "test")) {
        $ValidationResults += (Invoke-NpmCommandStable -Name "$($Target.Name)-test" -Command "set CI=true&& npm run test -- --runInBand" -WorkingDirectory $Target.Dir -OutputDir $RunDir -TimeoutSeconds ([Math]::Max($TimeoutSeconds, 300)))
    }
}

if (@($ValidationResults).Count -eq 0) {
    Write-WarnLine "No validation commands were discovered."
}

$ValidationRows = @()
foreach ($V in $ValidationResults) {
    $ValidationRows += "| $($V.Name) | ``$($V.Command)`` | ``$($V.Workdir)`` | $($V.ExitCode) | $($V.TimedOut) | $($V.Skipped) | ``$($V.OutputPath)`` |"
}
if ($ValidationRows.Count -eq 0) {
    $ValidationRows += "| _No validation commands executed_ | - | - | - | - | - | - |"
}
$ValidationTable = $ValidationRows -join "`r`n"

$NextTask = @"
# Claude/Copilot Task — Integrate WhatsApp Chat Scaffold After Validation Resume V2

Repo:

    $RepoRoot

## Scaffold Status

| File | Exists |
|---|---:|
$ScaffoldTable

## Validation Results

| Step | Command | Workdir | Exit Code | Timed Out | Skipped | Output |
|---|---|---|---:|---:|---:|---|
$ValidationTable

## Mission

The WhatsApp-style reusable scaffold exists in:

    apps\web-user\src\components\chat\whatsapp

Now integrate it into the real active chat surfaces.

Start with:

- apps\web-user\src\components\ChatScreen.tsx
- apps\web-user\src\components\ChatFirstWindow.tsx
- apps\web-user\src\components\ChatMessageView.tsx
- apps\web-user\src\components\ChatPopup.tsx
- apps\web-user\src\components\UniversalChatWidget.tsx
- apps\web-user\src\pages\ChatSessionsPage.tsx
- apps\web-user\src\pages\GroupChatsPage.tsx
- apps\web-user\src\pages\SavedChatsPage.tsx
- apps\web-admin\src\pages\ChatMonitorPage.tsx

## Rules

- Do not use archive/backups/.venv/.apex as source.
- Preserve existing API logic and auth logic.
- Map existing messages into the scaffold contract.
- Use fallback status of "sent" when backend lacks delivery/read states.
- Keep Arabic RTL per message body.
- Keep composer keyboard-safe on mobile.
- Create final report:

    docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md
"@

Write-Utf8File -Path $NextTaskPath -Content $NextTask

$Duration = New-TimeSpan -Start $Started -End (Get-Date)

$Report = @"
# APEX WhatsApp Chat Validation Resume V2 Report

## Status

$(if ($Apply) { "APPLY mode completed." } else { "DRY-RUN completed." })

This V2 avoids live npm output streaming. Each command writes STDOUT/STDERR to files and the script only reads them after the command exits or times out.

## Metadata

| Field | Value |
|---|---|
| Run ID | $RunId |
| Repo Root | ``$RepoRoot`` |
| Apply | $Apply |
| TimeoutSeconds | $TimeoutSeconds |
| RunBuild | $RunBuild |
| RunTests | $RunTests |
| OnlyRoot | $OnlyRoot |
| Started | $($Started.ToString("yyyy-MM-dd HH:mm:ss")) |
| Duration | $($Duration.ToString()) |
| Encoding | UTF-8 forced / code page 65001 attempted |

## Scaffold Status

| File | Exists |
|---|---:|
$ScaffoldTable

## Validation Results

| Step | Command | Workdir | Exit Code | Timed Out | Skipped | Output |
|---|---|---|---:|---:|---:|---|
$ValidationTable

## Generated Files

| File | Purpose |
|---|---|
| ``$NextTaskPath`` | Next Claude/Copilot integration task |
| ``$LogPath`` | Execution log |

## Next Step

Open this file in Claude/Copilot:

    $NextTaskPath

Then integrate the scaffold into active chat screens and produce:

    docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md

## Notes

- Tests are skipped unless ``-RunTests`` is provided.
- Build is skipped unless ``-RunBuild`` is provided.
- Use ``-OnlyRoot`` to validate only the root package.
"@

Write-Utf8File -Path $ReportPath -Content $Report

Write-Step "Validation resume V2 report created: $ReportPath"

if (-not $NoOpenReport) {
    try {
        Invoke-Item -LiteralPath $ReportPath
        Write-Step "Report launched."
    } catch {
        Write-WarnLine "Could not launch report automatically: $($_.Exception.Message)"
    }
}

Write-Step "APEX WhatsApp Chat Validation Resume V2 finished."
Write-Host ""
Write-Host "DONE"
Write-Host "Report: $ReportPath"
