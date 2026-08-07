[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [switch]$Apply,
    [switch]$ForceCallbackWrap,
    [int]$TimeoutSeconds = 300,
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

function Ensure-Dir {
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

function Read-FileText {
    param([string]$Path)
    return Get-Content -LiteralPath $Path -Raw -Encoding utf8
}

function Write-FileText {
    param([string]$Path, [string]$Content)
    $Dir = Split-Path -Parent $Path
    Ensure-Dir -Path $Dir
    if ($Apply) {
        Set-Content -LiteralPath $Path -Value $Content -Encoding utf8
        Write-Step "Wrote: $Path"
    } else {
        Write-Step "DRY-RUN: would write $Path"
    }
}

function Get-Sha {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return "" }
    try { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash } catch { return "" }
}

function Backup-File {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $Rel = $Path.Substring($script:RepoRoot.Length).TrimStart("\","/")
    $Dest = Join-Path $script:BackupDir $Rel
    Ensure-Dir -Path (Split-Path -Parent $Dest)
    if ($Apply) {
        Copy-Item -LiteralPath $Path -Destination $Dest -Force
        Write-Step "Backup created: $Dest"
    } else {
        Write-Step "DRY-RUN: would backup $Path to $Dest"
    }
}

function Invoke-Typecheck {
    param(
        [string]$Root,
        [string]$OutputDir,
        [int]$TimeoutSeconds,
        [string]$Name
    )

    $StdoutPath = Join-Path $OutputDir "$Name.stdout.log"
    $StderrPath = Join-Path $OutputDir "$Name.stderr.log"
    $CombinedPath = Join-Path $OutputDir "$Name.full.log"

    Write-Step "RUNNING: $Name -> npm run typecheck"

    if (-not $Apply) {
        $Text = "DRY-RUN: would run npm run typecheck in $Root"
        Set-Content -LiteralPath $CombinedPath -Value $Text -Encoding utf8
        return [pscustomobject]@{
            ExitCode = 0
            TimedOut = $false
            Stdout = $Text
            Stderr = ""
            CombinedPath = $CombinedPath
        }
    }

    $Command = "npm run typecheck > `"$StdoutPath`" 2> `"$StderrPath`""
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/d /s /c `"$Command`""
    $psi.WorkingDirectory = $Root
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi

    $TimedOut = $false
    $ExitCode = 999

    try {
        [void]$p.Start()
        if (-not $p.WaitForExit($TimeoutSeconds * 1000)) {
            $TimedOut = $true
            $ExitCode = 124
            try { $p.Kill() } catch {}
        } else {
            $ExitCode = $p.ExitCode
        }
    } finally {
        try { $p.Dispose() } catch {}
    }

    $Stdout = ""
    $Stderr = ""
    if (Test-Path -LiteralPath $StdoutPath) { try { $Stdout = Get-Content -LiteralPath $StdoutPath -Raw -Encoding utf8 } catch {} }
    if (Test-Path -LiteralPath $StderrPath) { try { $Stderr = Get-Content -LiteralPath $StderrPath -Raw -Encoding utf8 } catch {} }

    $Combined = @"
# $Name

Command:
npm run typecheck

ExitCode:
$ExitCode

TimedOut:
$TimedOut

STDOUT:
$Stdout

STDERR:
$Stderr
"@
    Set-Content -LiteralPath $CombinedPath -Value $Combined -Encoding utf8

    if ($ExitCode -eq 0 -and -not $TimedOut) {
        Write-Step "$Name passed with exit code 0."
    } else {
        Write-Step "$Name failed or timed out. ExitCode=$ExitCode TimedOut=$TimedOut"
    }

    return [pscustomobject]@{
        ExitCode = $ExitCode
        TimedOut = $TimedOut
        Stdout = $Stdout
        Stderr = $Stderr
        CombinedPath = $CombinedPath
    }
}

function Apply-CallbackWrapRepair {
    param([string]$RelativePath, [string]$Token)

    $Path = Join-Path $script:RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path)) {
        $script:PatchRows += "| ``$RelativePath`` | Missing | - | - |"
        return
    }

    $Before = Read-FileText -Path $Path
    $BeforeHash = Get-Sha -Path $Path
    $After = $Before

    if ($Token -eq "m") {
        $After = $After.Replace(
            'onReport={m.role === "assistant" ? handleReportMessage : undefined}',
            'onReport={m.role === "assistant" ? () => handleReportMessage(m) : undefined}'
        )
    }

    if ($Token -eq "msg") {
        $After = $After.Replace(
            'onReport={msg.role === "assistant" ? handleReportMessage : undefined}',
            'onReport={msg.role === "assistant" ? () => handleReportMessage(msg) : undefined}'
        )
    }

    if ($After -eq $Before) {
        $script:PatchRows += "| ``$RelativePath`` | Unchanged | callback wrapper already applied or target pattern not found | ``$BeforeHash`` | ``$BeforeHash`` |"
        return
    }

    Backup-File -Path $Path
    Write-FileText -Path $Path -Content $After
    $AfterHash = if ($Apply) { Get-Sha -Path $Path } else { "DRY-RUN" }
    $script:PatchRows += "| ``$RelativePath`` | Patched | wrapped onReport callback to remove ambiguous function-type assignment | ``$BeforeHash`` | ``$AfterHash`` |"
}

function Extract-TargetSnippets {
    param([string]$Root)

    $Pairs = @(
        @{ Rel = "apps\web-user\src\components\ChatFirstWindow.tsx"; Pattern = "onReport" },
        @{ Rel = "apps\web-user\src\components\ChatPopup.tsx"; Pattern = "onReport" }
    )

    $Sections = @()
    foreach ($Pair in $Pairs) {
        $Path = Join-Path $Root $Pair.Rel
        if (-not (Test-Path -LiteralPath $Path)) {
            $Sections += "## $($Pair.Rel)`r`n`r`nMissing.`r`n"
            continue
        }

        $Lines = Get-Content -LiteralPath $Path -Encoding utf8
        $Hit = -1
        for ($i = 0; $i -lt $Lines.Count; $i++) {
            if ($Lines[$i] -match $Pair.Pattern) {
                $Hit = $i
                break
            }
        }

        if ($Hit -lt 0) {
            $Sections += "## $($Pair.Rel)`r`n`r`nNo onReport line found.`r`n"
            continue
        }

        $Start = [Math]::Max(0, $Hit - 5)
        $End = [Math]::Min($Lines.Count - 1, $Hit + 5)
        $SnippetLines = @()
        for ($j = $Start; $j -le $End; $j++) {
            $SnippetLines += ("{0,4}: {1}" -f ($j + 1), $Lines[$j])
        }

        $Sections += @"
## $($Pair.Rel)

````tsx
$($SnippetLines -join "`r`n")
````
"@
    }

    return ($Sections -join "`r`n")
}

# Resolve repo
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $Current = (Get-Location).Path
    if ((Test-Path -LiteralPath (Join-Path $Current "package.json")) -or (Test-Path -LiteralPath (Join-Path $Current ".git"))) {
        $RepoRoot = $Current
    }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    throw "RepoRoot is required when not running from the repo root."
}

$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$script:RepoRoot = $RepoRoot

$RunId = Get-Date -Format "yyyyMMdd-HHmmss"
$Started = Get-Date

if ($Apply) {
    $RunDir = Join-Path $RepoRoot ".apex\whatsapp-chat-typescript-closure\$RunId"
} else {
    $RunDir = Join-Path $env:TEMP "apex-whatsapp-chat-typescript-closure-$RunId"
}

$BackupDir = Join-Path $RunDir "backups"
$LogPath = Join-Path $RunDir "execution.log"
$script:BackupDir = $BackupDir
$script:LogPath = $LogPath
$script:PatchRows = @()

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Set-Content -LiteralPath $LogPath -Value "APEX WhatsApp Chat TypeScript Closure Reconcile V1`r`nRunId: $RunId`r`nRepoRoot: $RepoRoot`r`n" -Encoding utf8

$ReportPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_TYPESCRIPT_CLOSURE_RECONCILE_REPORT.md"
$ImplementationReportPath = Join-Path $RepoRoot "docs\APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md"

Write-Step "APEX WhatsApp Chat TypeScript Closure Reconcile V1 started"
Write-Step "RepoRoot: $RepoRoot"
Write-Step "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"
Write-Step "ForceCallbackWrap: $ForceCallbackWrap"
Write-Step "TimeoutSeconds: $TimeoutSeconds"

# Self-install
try {
    $SelfPath = $PSCommandPath
    $Downloads = Join-Path $env:USERPROFILE "Downloads"
    if (-not $SkipSelfInstall -and $SelfPath -and $SelfPath.StartsWith($Downloads, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ScriptDir = Join-Path $RepoRoot "scripts\apex"
        $DestScript = Join-Path $ScriptDir "APEX-WhatsApp-Chat-TypeScript-Closure-Reconcile-V1.ps1"
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

$Initial = Invoke-Typecheck -Root $RepoRoot -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds -Name "initial-typecheck"
$InitialCombined = ($Initial.Stdout + "`r`n" + $Initial.Stderr)

$MentionsTargets = (
    $InitialCombined -match "ChatFirstWindow\.tsx" -or
    $InitialCombined -match "ChatPopup\.tsx" -or
    $InitialCombined -match "onReport"
)

$ShouldPatch = $ForceCallbackWrap -or (($Initial.ExitCode -ne 0 -or $Initial.TimedOut) -and $MentionsTargets)

if ($ShouldPatch) {
    Write-Step "Applying callback wrapper repair."
    Apply-CallbackWrapRepair -RelativePath "apps\web-user\src\components\ChatFirstWindow.tsx" -Token "m"
    Apply-CallbackWrapRepair -RelativePath "apps\web-user\src\components\ChatPopup.tsx" -Token "msg"
    $Final = Invoke-Typecheck -Root $RepoRoot -OutputDir $RunDir -TimeoutSeconds $TimeoutSeconds -Name "final-typecheck-after-repair"
} else {
    Write-Step "No callback repair needed. Typecheck output did not justify code patch."
    $Final = $Initial
}

$Snippets = Extract-TargetSnippets -Root $RepoRoot

$Decision = "WATANYBOT — CLOSURE_BLOCKED_BY_TYPESCRIPT"
$Reason = ""

if ($Final.ExitCode -eq 0 -and -not $Final.TimedOut -and [string]::IsNullOrWhiteSpace(($Final.Stdout + $Final.Stderr).Trim())) {
    $Decision = "WATANYBOT — TYPESCRIPT_CLOSED"
    $Reason = "Typecheck exit code is 0 and TypeScript output is empty. The earlier closure-blocked diagnostic is stale or internally inconsistent."
} elseif ($Final.ExitCode -eq 0 -and -not $Final.TimedOut) {
    $Decision = "WATANYBOT — TYPESCRIPT_CLOSED_WITH_WARNINGS"
    $Reason = "Typecheck exit code is 0. Non-empty output should be reviewed, but TypeScript closure is not blocked by tsc."
} else {
    $Decision = "WATANYBOT — CLOSURE_BLOCKED_BY_TYPESCRIPT"
    $Reason = "Typecheck did not complete with exit code 0. Review the final typecheck log."
}

$PatchTable = if ($script:PatchRows.Count -gt 0) { $script:PatchRows -join "`r`n" } else { "| _No code patches applied_ | - | - | - | - |" }
$Duration = New-TimeSpan -Start $Started -End (Get-Date)

$Report = @"
# APEX WhatsApp Chat TypeScript Closure Reconcile V1

## Decision

$Decision

## Reason

$Reason

## Metadata

| Field | Value |
|---|---|
| Run ID | $RunId |
| Repo Root | ``$RepoRoot`` |
| Apply | $Apply |
| ForceCallbackWrap | $ForceCallbackWrap |
| Started | $($Started.ToString("yyyy-MM-dd HH:mm:ss")) |
| Duration | $($Duration.ToString()) |
| Encoding | UTF-8 forced / code page 65001 attempted |

## Diagnostic Reconciliation

The supplied diagnostic claimed:

```txt
WATANYBOT — CLOSURE_BLOCKED_BY_TYPESCRIPT
```

But it also showed:

```txt
Full TypeScript Output: empty
Typecheck exit code: 0
```

This script treats the actual ``tsc``/typecheck exit code and output as the source of truth.

## Typecheck Evidence

| Stage | Exit Code | Timed Out | Log |
|---|---:|---:|---|
| Initial | $($Initial.ExitCode) | $($Initial.TimedOut) | ``$($Initial.CombinedPath)`` |
| Final | $($Final.ExitCode) | $($Final.TimedOut) | ``$($Final.CombinedPath)`` |

## Patch Evidence

| File | Status | Reason | Before | After |
|---|---|---|---|---|
$PatchTable

## Current Target Snippets

$Snippets

## Closure Rule

- If final typecheck exit code is ``0`` and output is empty, close TypeScript blocker.
- If final typecheck exit code is ``0`` but output contains warnings, TypeScript is still closed unless warnings are policy-blocking.
- If final typecheck exit code is non-zero or timeout occurs, closure remains blocked.

## Next Step

If decision is ``WATANYBOT — TYPESCRIPT_CLOSED`` or ``WATANYBOT — TYPESCRIPT_CLOSED_WITH_WARNINGS``, update the project closure report and proceed to build/manual QA closure.

If decision remains blocked, give the final typecheck log to Claude/Copilot and patch the exact reported errors.
"@

Write-FileText -Path $ReportPath -Content $Report

if (Test-Path -LiteralPath $ImplementationReportPath) {
    $Existing = Read-FileText -Path $ImplementationReportPath
    $Marker = "## Latest TypeScript Closure Reconciliation"
    if ($Existing.Contains($Marker)) {
        $Existing = $Existing.Substring(0, $Existing.IndexOf($Marker)).TrimEnd()
    }
    $Append = @"

$Marker

Decision: **$Decision**

Reason: $Reason

| Stage | Exit Code | Timed Out | Log |
|---|---:|---:|---|
| Initial | $($Initial.ExitCode) | $($Initial.TimedOut) | ``$($Initial.CombinedPath)`` |
| Final | $($Final.ExitCode) | $($Final.TimedOut) | ``$($Final.CombinedPath)`` |

Report:

``txt
$ReportPath
``

"@
    Write-FileText -Path $ImplementationReportPath -Content ($Existing.TrimEnd() + $Append)
}

Write-Step "TypeScript closure reconcile report created: $ReportPath"

if (-not $NoOpenReport) {
    try {
        Invoke-Item -LiteralPath $ReportPath
        Write-Step "Report launched."
    } catch {
        Write-Step "Could not launch report automatically: $($_.Exception.Message)"
    }
}

Write-Step "APEX WhatsApp Chat TypeScript Closure Reconcile V1 finished."
Write-Host ""
Write-Host "DONE"
Write-Host "Decision: $Decision"
Write-Host "Report: $ReportPath"
