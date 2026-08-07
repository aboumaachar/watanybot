[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [switch]$Apply,
    [switch]$PatchScaffold,
    [switch]$RunValidation,
    [switch]$NoOpenReport,
    [switch]$SkipSelfInstall,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -----------------------------
# UTF-8 / Console normalization
# -----------------------------
try { chcp 65001 | Out-Null } catch {}
try {
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = $utf8NoBom
    [Console]::InputEncoding = $utf8NoBom
    $script:OutputEncoding = $utf8NoBom
} catch {}

$PSDefaultParameterValues["Out-File:Encoding"] = "utf8"
$PSDefaultParameterValues["Set-Content:Encoding"] = "utf8"
$PSDefaultParameterValues["Add-Content:Encoding"] = "utf8"
$PSDefaultParameterValues["Export-Csv:Encoding"] = "utf8"

# -----------------------------
# Helpers
# -----------------------------
function Write-Step {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    if ($script:LogPath) { Add-Content -Path $script:LogPath -Value $line -Encoding utf8 }
}

function Write-Warn {
    param([string]$Message)
    $line = "[{0}] WARNING: {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Warning $Message
    if ($script:LogPath) { Add-Content -Path $script:LogPath -Value $line -Encoding utf8 }
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        if ($Apply) {
            New-Item -ItemType Directory -Path $Path -Force | Out-Null
        }
    }
}

function Write-TextFile {
    param(
        [string]$Path,
        [string]$Content,
        [switch]$CreateBackup
    )

    $dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $dir)) {
        if ($Apply) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        } else {
            Write-Step "DRY-RUN: would create directory $dir"
            return
        }
    }

    if ((Test-Path -LiteralPath $Path) -and $CreateBackup) {
        $backupName = (Split-Path -Leaf $Path) + ".bak"
        $backupPath = Join-Path $script:BackupDir $backupName
        if ($Apply) {
            Copy-Item -LiteralPath $Path -Destination $backupPath -Force
            Write-Step "Backup created: $backupPath"
        } else {
            Write-Step "DRY-RUN: would backup $Path to $backupPath"
        }
    }

    if ($Apply) {
        Set-Content -Path $Path -Value $Content -Encoding utf8
        Write-Step "Wrote: $Path"
    } else {
        Write-Step "DRY-RUN: would write $Path"
    }
}

function Invoke-LoggedCommand {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WorkingDirectory
    )

    Write-Step "RUNNING: $Name"
    Write-Step "COMMAND: $Command"

    if (-not $Apply) {
        Write-Step "DRY-RUN: would run command '$Command'"
        return @{
            Name = $Name
            Command = $Command
            ExitCode = 0
            Skipped = $true
            OutputPath = $null
        }
    }

    $outputFile = Join-Path $script:RunDir ("validation_{0}.log" -f ($Name -replace "[^\w\-]", "_"))
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "powershell.exe"
    $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$WorkingDirectory'; $Command`""
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi
    [void]$p.Start()
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $p.WaitForExit()

    $combined = @"
# $Name

COMMAND:
$Command

EXIT CODE:
$($p.ExitCode)

STDOUT:
$stdout

STDERR:
$stderr
"@
    Set-Content -Path $outputFile -Value $combined -Encoding utf8

    if ($p.ExitCode -ne 0) {
        Write-Warn "$Name failed with exit code $($p.ExitCode). See: $outputFile"
    } else {
        Write-Step "$Name passed. See: $outputFile"
    }

    return @{
        Name = $Name
        Command = $Command
        ExitCode = $p.ExitCode
        Skipped = $false
        OutputPath = $outputFile
    }
}

function Get-PackageJsonObject {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        return Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json
    } catch {
        Write-Warn "Could not parse package.json: $Path"
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

function Get-RepoFiles {
    param([string]$Root)

    $excludeDirs = @(
        "\node_modules\",
        "\.next\",
        "\dist\",
        "\build\",
        "\coverage\",
        "\.git\",
        "\.turbo\",
        "\.vercel\",
        "\vendor\"
    )

    $extensions = @("*.ts","*.tsx","*.js","*.jsx","*.css","*.scss","*.json","*.md","*.prisma")
    $files = @()
    foreach ($ext in $extensions) {
        $items = Get-ChildItem -Path $Root -Recurse -File -Filter $ext -ErrorAction SilentlyContinue | Where-Object {
            $full = $_.FullName
            $skip = $false
            foreach ($d in $excludeDirs) {
                if ($full -like "*$d*") { $skip = $true; break }
            }
            -not $skip
        }
        $files += $items
    }

    return $files | Sort-Object FullName -Unique
}

function Find-FrontendSourceRoot {
    param([string]$Root)

    $candidates = @(
        "apps\web\src",
        "apps\web\app",
        "src",
        "app",
        "frontend\src",
        "web\src",
        "client\src"
    )

    foreach ($relative in $candidates) {
        $full = Join-Path $Root $relative
        if (Test-Path -LiteralPath $full) { return $full }
    }

    return $null
}

function New-ReactComponentScaffold {
    param([string]$FrontendRoot)

    $componentDir = Join-Path $FrontendRoot "components\chat"
    $cssPath = Join-Path $componentDir "chat-whatsapp.css"
    $tsxPath = Join-Path $componentDir "WhatsAppChatShell.tsx"
    $indexPath = Join-Path $componentDir "index.ts"

    $tsx = @'
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./chat-whatsapp.css";

export type ChatSenderType = "user" | "admin" | "assistant" | "system";
export type ChatMessageStatus = "sending" | "sent" | "delivered" | "read" | "failed" | "retrying";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId?: string;
  senderType: ChatSenderType;
  body: string;
  createdAt: string | Date;
  status?: ChatMessageStatus;
  senderName?: string;
}

export interface WhatsAppChatShellProps {
  title: string;
  subtitle?: string;
  currentUserSenderTypes?: ChatSenderType[];
  messages: ChatMessage[];
  isTyping?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onSend: (body: string) => Promise<void> | void;
  onRetry?: (message: ChatMessage) => Promise<void> | void;
  onBack?: () => void;
}

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function formatTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageStatus({ status }: { status?: ChatMessageStatus }) {
  if (!status || status === "sent") return <span aria-label="sent">✓</span>;
  if (status === "sending" || status === "retrying") return <span aria-label={status}>…</span>;
  if (status === "delivered") return <span aria-label="delivered">✓✓</span>;
  if (status === "read") return <span aria-label="read">✓✓</span>;
  if (status === "failed") return <span aria-label="failed">!</span>;
  return null;
}

export default function WhatsAppChatShell({
  title,
  subtitle,
  currentUserSenderTypes = ["user"],
  messages,
  isTyping = false,
  disabled = false,
  placeholder = "Type a message…",
  onSend,
  onRetry,
  onBack,
}: WhatsAppChatShellProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = draft.trim().length > 0 && !sending && !disabled;

  const normalized = useMemo(() => messages ?? [], [messages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [normalized.length, isTyping]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [draft]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await onSend(body);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="wa-chat-shell" aria-label="Chat conversation">
      <header className="wa-chat-header">
        {onBack ? (
          <button className="wa-chat-back" type="button" onClick={onBack} aria-label="Back to conversations">
            ‹
          </button>
        ) : null}
        <div className="wa-chat-avatar" aria-hidden="true">{title.slice(0, 1).toUpperCase()}</div>
        <div className="wa-chat-titleblock">
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      </header>

      <div className="wa-message-list" ref={listRef}>
        {normalized.length === 0 ? (
          <div className="wa-empty-state">No messages yet.</div>
        ) : null}

        {normalized.map((message) => {
          const mine = currentUserSenderTypes.includes(message.senderType);
          const rtl = isArabic(message.body);
          return (
            <article
              key={message.id}
              className={`wa-message-row ${mine ? "wa-message-row-mine" : "wa-message-row-other"}`}
              dir={rtl ? "rtl" : "ltr"}
            >
              <div className={`wa-bubble ${mine ? "wa-bubble-mine" : "wa-bubble-other"}`}>
                {message.senderName && !mine ? <div className="wa-sender-name">{message.senderName}</div> : null}
                <div className="wa-message-body">{message.body}</div>
                <div className="wa-message-meta">
                  <time>{formatTime(message.createdAt)}</time>
                  {mine ? <MessageStatus status={message.status} /> : null}
                  {message.status === "failed" && onRetry ? (
                    <button className="wa-retry" type="button" onClick={() => onRetry(message)}>
                      Retry
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}

        {isTyping ? (
          <div className="wa-message-row wa-message-row-other">
            <div className="wa-bubble wa-bubble-other wa-typing">typing…</div>
          </div>
        ) : null}
      </div>

      <footer className="wa-composer">
        <button className="wa-composer-action" type="button" aria-label="Attachment placeholder" disabled={disabled}>
          +
        </button>
        <textarea
          ref={textareaRef}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
        />
        <button className="wa-send" type="button" disabled={!canSend} onClick={() => void handleSend()}>
          {sending ? "…" : "Send"}
        </button>
      </footer>
    </section>
  );
}
'@

    $css = @'
.wa-chat-shell {
  --wa-header-height: 64px;
  --wa-composer-min-height: 64px;
  display: grid;
  grid-template-rows: var(--wa-header-height) minmax(0, 1fr) auto;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  background: #f6f1ea;
  color: #1f2933;
  border-radius: 24px;
}

.wa-chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #fffaf3;
  border-bottom: 1px solid rgba(31, 41, 51, 0.12);
  position: sticky;
  top: 0;
  z-index: 10;
}

.wa-chat-back,
.wa-composer-action,
.wa-send,
.wa-retry {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.wa-chat-avatar {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #d8e7d3;
  color: #16331f;
  font-weight: 700;
}

.wa-chat-titleblock {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.wa-chat-titleblock strong {
  font-size: 16px;
  line-height: 1.2;
}

.wa-chat-titleblock span {
  font-size: 13px;
  color: #53606d;
}

.wa-message-list {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wa-empty-state {
  margin: auto;
  color: #53606d;
  background: rgba(255,255,255,0.72);
  padding: 12px 16px;
  border-radius: 999px;
}

.wa-message-row {
  display: flex;
  width: 100%;
}

.wa-message-row-mine {
  justify-content: flex-end;
}

.wa-message-row-other {
  justify-content: flex-start;
}

.wa-bubble {
  max-width: min(78%, 620px);
  border-radius: 18px;
  padding: 9px 11px 7px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  word-break: break-word;
  line-height: 1.45;
  font-size: 15px;
}

.wa-bubble-mine {
  background: #d9fdd3;
  color: #102315;
  border-end-end-radius: 6px;
}

.wa-bubble-other {
  background: #ffffff;
  color: #1f2933;
  border-end-start-radius: 6px;
}

.wa-sender-name {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 3px;
  color: #34515e;
}

.wa-message-meta {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  font-size: 11px;
  color: #53606d;
}

.wa-typing {
  font-style: italic;
  color: #53606d;
}

.wa-retry {
  min-height: 28px;
  min-width: auto;
  padding: 0 8px;
  font-size: 12px;
  background: #ffe3e3;
  color: #7f1d1d;
}

.wa-composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
  background: #fffaf3;
  border-top: 1px solid rgba(31, 41, 51, 0.12);
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.wa-composer textarea {
  flex: 1;
  resize: none;
  border: 1px solid rgba(31, 41, 51, 0.18);
  border-radius: 22px;
  padding: 12px 14px;
  min-height: 44px;
  max-height: 132px;
  font: inherit;
  line-height: 1.35;
  background: #fff;
  color: #1f2933;
  outline: none;
}

.wa-composer textarea:focus {
  border-color: rgba(22, 101, 52, 0.55);
}

.wa-composer-action {
  background: #eef2f1;
  color: #263238;
}

.wa-send {
  background: #166534;
  color: #ffffff;
  padding-inline: 16px;
}

.wa-send:disabled,
.wa-composer-action:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .wa-chat-shell {
    border-radius: 0;
    height: 100dvh;
    max-height: 100dvh;
  }

  .wa-bubble {
    max-width: 86%;
    font-size: 16px;
  }
}
'@

    $index = @'
export { default as WhatsAppChatShell } from "./WhatsAppChatShell";
export type {
  ChatMessage,
  ChatMessageStatus,
  ChatSenderType,
  WhatsAppChatShellProps,
} from "./WhatsAppChatShell";
'@

    Write-TextFile -Path $tsxPath -Content $tsx -CreateBackup
    Write-TextFile -Path $cssPath -Content $css -CreateBackup
    Write-TextFile -Path $indexPath -Content $index -CreateBackup

    return @($tsxPath, $cssPath, $indexPath)
}

# -----------------------------
# Resolve repo root
# -----------------------------
$script:LogPath = $null
$startTime = Get-Date
$selfPath = $PSCommandPath

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $candidate = (Get-Location).Path
    if ((Test-Path (Join-Path $candidate "package.json")) -or (Test-Path (Join-Path $candidate ".git"))) {
        $RepoRoot = $candidate
    } else {
        $RepoRoot = ""
    }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    throw "RepoRoot is required when running from Downloads. Example: powershell -NoProfile -ExecutionPolicy Bypass -File `"$env:USERPROFILE\Downloads\APEX-WhatsApp-Chat-Behavior.ps1`" -RepoRoot `"C:\path\to\repo`" -Apply"
}

$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    throw "RepoRoot does not exist: $RepoRoot"
}

$runId = Get-Date -Format "yyyyMMdd-HHmmss"
if ($Apply) {
    $script:RunDir = Join-Path $RepoRoot ".apex\whatsapp-chat-behavior\$runId"
} else {
    $script:RunDir = Join-Path $env:TEMP "apex-whatsapp-chat-behavior-$runId"
}

$script:BackupDir = Join-Path $script:RunDir "backups"
$script:LogPath = Join-Path $script:RunDir "execution.log"

New-Item -ItemType Directory -Path $script:RunDir -Force | Out-Null
New-Item -ItemType Directory -Path $script:BackupDir -Force | Out-Null
Set-Content -Path $script:LogPath -Value "APEX WhatsApp Chat Behavior Automation Log`nRunId: $runId`nRepoRoot: $RepoRoot`nApply: $Apply`n" -Encoding utf8

Write-Step "APEX WhatsApp Chat Behavior Automation started"
Write-Step "RepoRoot: $RepoRoot"
Write-Step "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"

# -----------------------------
# Self-install from Downloads
# -----------------------------
try {
    $downloads = Join-Path $env:USERPROFILE "Downloads"
    if (-not $SkipSelfInstall -and $selfPath -and $selfPath.StartsWith($downloads, [System.StringComparison]::OrdinalIgnoreCase)) {
        $scriptDir = Join-Path $RepoRoot "scripts\apex"
        $destScript = Join-Path $scriptDir "APEX-WhatsApp-Chat-Behavior.ps1"

        if ($Apply) {
            New-Item -ItemType Directory -Path $scriptDir -Force | Out-Null
            Copy-Item -LiteralPath $selfPath -Destination $destScript -Force
            Write-Step "Copied script from Downloads to repo: $destScript"
        } else {
            Write-Step "DRY-RUN: would copy script from Downloads to $destScript"
        }
    }
} catch {
    Write-Warn "Self-install step did not complete: $($_.Exception.Message)"
}

# -----------------------------
# Scan repository
# -----------------------------
Write-Step "Scanning repository files"
$repoFiles = Get-RepoFiles -Root $RepoRoot
$packageJsonPath = Join-Path $RepoRoot "package.json"
$packageJson = Get-PackageJsonObject -Path $packageJsonPath
$frontendRoot = Find-FrontendSourceRoot -Root $RepoRoot

$chatKeywords = @("chat", "conversation", "message", "messages", "support", "assistant", "admin", "thread", "whatsapp")
$matchedFiles = @()

foreach ($file in $repoFiles) {
    $relative = $file.FullName.Substring($RepoRoot.Length).TrimStart("\","/")
    $pathHit = $false
    foreach ($kw in $chatKeywords) {
        if ($relative -match $kw) { $pathHit = $true; break }
    }

    $contentHit = $false
    if (-not $pathHit -and $file.Length -lt 500000) {
        try {
            $text = Get-Content -LiteralPath $file.FullName -Raw -Encoding utf8 -ErrorAction Stop
            foreach ($kw in $chatKeywords) {
                if ($text -match $kw) { $contentHit = $true; break }
            }
        } catch {}
    }

    if ($pathHit -or $contentHit) {
        $matchedFiles += [pscustomobject]@{
            RelativePath = $relative
            SizeBytes = $file.Length
            Reason = if ($pathHit) { "path" } else { "content" }
        }
    }
}

$matchedFiles = $matchedFiles | Sort-Object RelativePath -Unique

Write-Step "Repository files scanned: $($repoFiles.Count)"
Write-Step "Potential chat-related files found: $($matchedFiles.Count)"
if ($frontendRoot) {
    Write-Step "Detected frontend source root: $frontendRoot"
} else {
    Write-Warn "Could not confidently detect frontend source root"
}

# -----------------------------
# Generate APEX plan and prompts
# -----------------------------
$matchedTable = if ($matchedFiles.Count -gt 0) {
    ($matchedFiles | Select-Object -First 200 | ForEach-Object {
        "| `$($_.RelativePath)` | $($_.Reason) | $($_.SizeBytes) |"
    }) -join "`n"
} else {
    "| _None found_ | - | - |"
}

$reportPath = Join-Path $script:RunDir "APEX_WHATSAPP_CHAT_BEHAVIOR_REPORT.md"
$planPath = Join-Path $script:RunDir "APEX_WHATSAPP_CHAT_BEHAVIOR_PLAN.md"
$promptPath = Join-Path $script:RunDir "APEX_WHATSAPP_CHAT_BEHAVIOR_CLAUDE_PROMPT.md"
$contractPath = Join-Path $script:RunDir "APEX_WHATSAPP_CHAT_CONTRACT.md"

$plan = @"
# APEX Plan — WhatsApp-Style Chat Behavior

Run ID: $runId  
Repo Root: `$RepoRoot`  
Mode: $(if ($Apply) { "APPLY" } else { "DRY-RUN" })  
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## 1. Objective

Upgrade all chat experiences in the app so they behave like full WhatsApp-style smartphone conversations, including:

- Fixed header.
- Scrollable message list.
- Fixed bottom composer.
- Mobile keyboard-safe behavior.
- Sender-aligned bubbles.
- Message timestamps.
- Message status abstraction.
- Retry on failed send.
- Read/unread logic.
- Conversation list behavior.
- Admin/support reply flow.
- Logging, abuse flags, and repeated-question analytics.
- Arabic RTL and English LTR support.
- Elderly-friendly readability and contrast.

## 2. Safety Model

This APEX automation does not blindly rewrite existing business logic.

Default behavior:
- Scan repository.
- Generate source-of-truth implementation plan.
- Generate Claude/Copilot execution prompt.
- Generate final report.
- Copy this PS1 into `scripts/apex` when run from Downloads.
- Open the report at the end.

Optional behavior:
- `-PatchScaffold` creates starter reusable frontend chat components only when a frontend source root is detected.
- Existing files are backed up under `.apex/whatsapp-chat-behavior/<runId>/backups`.

## 3. Repository Detection

Frontend source root detected:

```txt
$(if ($frontendRoot) { $frontendRoot } else { "NOT DETECTED" })
```

Total scanned files: $($repoFiles.Count)  
Potential chat-related files: $($matchedFiles.Count)

## 4. Potential Chat-Related Files

| File | Match Reason | Size |
|---|---:|---:|
$matchedTable

## 5. Implementation Waves

### Wave 1 — Chat Shell Contract

Create or consolidate shared chat components:

- ChatShell
- ChatHeader
- ConversationList
- MessageList
- MessageBubble
- MessageComposer
- TypingIndicator
- MessageStatus
- DateSeparator
- UnreadBadge
- AdminConversationPanel

Acceptance:
- All chat screens use the same shell or compatible wrapper.
- No screen-specific hacks for composer/header positioning.

### Wave 2 — Mobile Behavior

Implement:

- `height: 100dvh`
- fixed/sticky header and composer
- middle message list with `min-height: 0` and `overflow-y: auto`
- `env(safe-area-inset-bottom)`
- dynamic textarea height
- keyboard-safe layout
- no whole-page awkward scrolling inside chat

Acceptance:
- iPhone/Android viewport does not hide composer behind keyboard.
- Long conversations scroll properly.

### Wave 3 — Message Composer

Implement:

- Enter to send on desktop.
- Shift+Enter newline.
- auto-growing textarea.
- disabled send when empty.
- sending state.
- failed state.
- retry failed message.
- optional attachment placeholder.

Acceptance:
- No duplicate messages.
- Input clears only after successful send.

### Wave 4 — Message Data Contract

Normalize frontend/backend message shape:

```ts
type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed" | "retrying";

type SenderType = "user" | "admin" | "assistant" | "system";
```

Backend fallback:
- If delivered/read are unsupported, map all successful persisted messages to `sent`.

### Wave 5 — Conversation List

Implement:

- last message preview.
- last activity time.
- unread count.
- selected highlight.
- mobile list-to-thread navigation.
- back button to conversations.
- sort by latest activity.

### Wave 6 — Read/Unread Logic

Rules:

- Do not mark messages read merely because they were fetched.
- Mark read when the conversation is opened/visible.
- Admin dashboard should show unread and unanswered conversations.

### Wave 7 — Realtime / Near-Realtime

Choose available stack:

1. WebSocket / Socket.IO
2. SSE
3. polling fallback

Acceptance:
- New messages appear without refresh or with safe polling fallback.
- Reconnect does not duplicate messages.

### Wave 8 — Admin Support Behavior

Admin dashboard should support:

- New
- Unanswered
- Most recent
- Most asked / repeated
- Flagged / abusive
- direct reply
- official answer creation from recent/repeated questions

### Wave 9 — Abuse Monitoring and Logs

Implement server-side hooks for:

- user input logging.
- assistant/admin response logging.
- abuse flags.
- repeated question tracking.
- failed answer tracking.
- admin review queue.
- audit trail.

Security:
- Do not expose sensitive logs to normal users.

### Wave 10 — Arabic / RTL / Accessibility

Implement:

- Arabic RTL bubbles.
- mixed Arabic-English input support.
- readable contrast.
- large enough type.
- touch targets >= 44px.
- clear icon labels.
- no low-contrast gray text.

## 6. Validation

Run after implementation:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

Only run commands that exist in package.json.

## 7. Next-Agent Instruction

Open the generated Claude prompt:

```txt
$script:RunDir\APEX_WHATSAPP_CHAT_BEHAVIOR_CLAUDE_PROMPT.md
```

Give it to Claude/Copilot inside VS Code at the repo root.
"@

$claudePrompt = @"
# Claude/Copilot Task — Implement WhatsApp-Style Chat Behavior Across the App

You are inside this repository:

```txt
$RepoRoot
```

You must implement the WhatsApp-style chat behavior described below. Do not treat this as a visual-only redesign. This is a behavior upgrade.

## Source Requirement Summary

All user, admin, support, AI, procedure, and messaging screens must behave like a full smartphone chat system.

Core behavior required:

- Fixed chat header.
- Scrollable message area.
- Fixed bottom message composer.
- Sender-aligned bubbles.
- Timestamp and sender identity where needed.
- Message states: sending, sent, delivered, read, failed, retrying.
- Mobile keyboard-safe behavior.
- Enter to send, Shift+Enter newline.
- Auto-growing textarea.
- Failed send retry.
- Conversation list with last message preview, unread count, last activity time, selected state.
- Read/unread logic that only marks as read when opened/visible.
- Admin dashboard filters: new, unanswered, most recent, most asked/repeated, flagged/abusive.
- Admin direct replies.
- Admin official answer creation from recent/repeated questions.
- Input/output logging.
- Abuse monitoring hooks.
- Repeated question analytics.
- Arabic RTL and English LTR support.
- Elderly-friendly readability and contrast.
- PWA/home-screen shortcut prompt where appropriate.

## Repository Findings From APEX Scan

Potential chat-related files:

| File | Match Reason | Size |
|---|---:|---:|
$matchedTable

Detected frontend root:

```txt
$(if ($frontendRoot) { $frontendRoot } else { "NOT DETECTED" })
```

## Execution Rules

1. Inspect the real codebase first.
2. Do not invent file paths.
3. Do not replace existing chat logic blindly.
4. Refactor toward reusable shared chat components.
5. Preserve existing routes, APIs, auth, and role logic.
6. Add backend fields only through the project’s existing migration/database pattern.
7. Add frontend fallback status mapping when backend delivered/read states are missing.
8. Ensure Arabic RTL and mixed-language messages render correctly.
9. Ensure mobile composer is never hidden behind keyboard.
10. Create or update tests where the project already has testing structure.
11. After changes, run validation commands that exist in package.json.

## Required Output Files

Create a final implementation report:

```txt
docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md
```

The report must include:

- Files inspected.
- Files modified.
- Components created.
- Backend/API changes.
- Database/migration changes.
- Validation commands run.
- Pass/fail results.
- Screens requiring manual QA.
- Known limitations.
- Remaining risks.
- Next steps.

## Acceptance Criteria

The task is complete only when:

- All chat screens use the shared WhatsApp-style chat shell or equivalent reusable pattern.
- Mobile layout is keyboard-safe.
- Header and composer stay fixed.
- Long conversations scroll correctly.
- Message composer supports Enter/Shift+Enter.
- Message send has loading/success/failure/retry behavior.
- New messages can appear via realtime, SSE, or polling fallback.
- Conversation list supports unread counts and recent sorting.
- Admin can view and reply to conversations.
- Admin can identify recent/repeated/flagged questions.
- Abuse/logging hooks exist.
- Arabic RTL support is implemented.
- Elderly-friendly contrast is improved.
- No duplicate messages are created.
- Build/lint/typecheck pass.

## Important

Do not stop at creating components. Wire them into the actual chat screens after inspecting how the app currently handles chat, support, admin, AI, and procedure conversations.
"@

$contract = @"
# Chat System Contract — WhatsApp Behavior

## Conversation

```ts
export interface Conversation {
  id: string;
  type: "user_support" | "ai_chat" | "admin_chat" | "procedure_chat" | string;
  title: string;
  participantIds?: string[];
  lastMessageId?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string | Date;
  unreadCount?: number;
  status?: "open" | "pending" | "resolved" | "flagged" | string;
  createdAt: string | Date;
  updatedAt: string | Date;
}
```

## Message

```ts
export type MessageStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "retrying";

export type SenderType =
  | "user"
  | "admin"
  | "assistant"
  | "system";

export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  senderType: SenderType;
  body: string;
  messageType?: "text" | "system" | "attachment" | "answer_reference" | string;
  status?: MessageStatus;
  metadata?: Record<string, unknown>;
  createdAt: string | Date;
  updatedAt?: string | Date;
  readAt?: string | Date | null;
}
```

## Frontend Fallback Rule

If backend has no delivered/read status:

```ts
const normalizedStatus = message.status ?? "sent";
```

## Mobile Layout Contract

```css
.chat-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
}

.message-list {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.composer {
  position: sticky;
  bottom: 0;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
}
```
"@

Write-TextFile -Path $planPath -Content $plan
Write-TextFile -Path $promptPath -Content $claudePrompt
Write-TextFile -Path $contractPath -Content $contract

# -----------------------------
# Optional component scaffold
# -----------------------------
$scaffoldedFiles = @()
if ($PatchScaffold) {
    if ($frontendRoot) {
        Write-Step "PatchScaffold enabled: creating starter reusable chat components"
        $scaffoldedFiles = New-ReactComponentScaffold -FrontendRoot $frontendRoot
    } else {
        Write-Warn "PatchScaffold requested, but no frontend source root was detected. No component files created."
    }
} else {
    Write-Step "PatchScaffold not enabled. No app code files will be created."
}

# -----------------------------
# Validation
# -----------------------------
$validationResults = @()
if ($RunValidation) {
    if (Test-Path -LiteralPath $packageJsonPath) {
        if (Has-NpmScript -PackageJson $packageJson -ScriptName "typecheck") {
            $validationResults += Invoke-LoggedCommand -Name "TYPECHECK" -Command "npm run typecheck" -WorkingDirectory $RepoRoot
        }
        if (Has-NpmScript -PackageJson $packageJson -ScriptName "lint") {
            $validationResults += Invoke-LoggedCommand -Name "LINT" -Command "npm run lint" -WorkingDirectory $RepoRoot
        }
        if (Has-NpmScript -PackageJson $packageJson -ScriptName "build") {
            $validationResults += Invoke-LoggedCommand -Name "BUILD" -Command "npm run build" -WorkingDirectory $RepoRoot
        }
        if (Has-NpmScript -PackageJson $packageJson -ScriptName "test") {
            $validationResults += Invoke-LoggedCommand -Name "TEST" -Command "npm test" -WorkingDirectory $RepoRoot
        }
        if ($validationResults.Count -eq 0) {
            Write-Warn "RunValidation enabled, but no recognized package.json scripts were found."
        }
    } else {
        Write-Warn "RunValidation enabled, but package.json was not found at repo root."
    }
} else {
    Write-Step "RunValidation not enabled. Validation commands were not executed."
}

$validationTable = if ($validationResults.Count -gt 0) {
    ($validationResults | ForEach-Object {
        "| $($_.Name) | $($_.Command) | $($_.ExitCode) | $($_.Skipped) | $($_.OutputPath) |"
    }) -join "`n"
} else {
    "| _No validation commands executed_ | - | - | - | - |"
}

$scaffoldTable = if ($scaffoldedFiles.Count -gt 0) {
    ($scaffoldedFiles | ForEach-Object { "| `$_` |" }) -join "`n"
} else {
    "| _No scaffold files created_ |"
}

$duration = New-TimeSpan -Start $startTime -End (Get-Date)

$finalReport = @"
# APEX WhatsApp Chat Behavior Automation Report

## Status

$(if ($Apply) { "APPLY mode completed." } else { "DRY-RUN completed. Re-run with `-Apply` to write outputs into the repo." })

## Run Metadata

| Field | Value |
|---|---|
| Run ID | $runId |
| Repo Root | `$RepoRoot` |
| Apply | $Apply |
| PatchScaffold | $PatchScaffold |
| RunValidation | $RunValidation |
| Started | $($startTime.ToString("yyyy-MM-dd HH:mm:ss")) |
| Duration | $($duration.ToString()) |
| Encoding | UTF-8 forced / code page 65001 attempted |

## Generated Files

| File | Purpose |
|---|---|
| `$planPath` | APEX implementation plan |
| `$promptPath` | Claude/Copilot execution prompt |
| `$contractPath` | Chat data/component contract |
| `$script:LogPath` | Execution log |

## Optional Scaffold Files

| File |
|---|
$scaffoldTable

## Repository Scan

| Metric | Value |
|---|---:|
| Files scanned | $($repoFiles.Count) |
| Potential chat-related files | $($matchedFiles.Count) |

## Potential Chat-Related Files

| File | Match Reason | Size |
|---|---:|---:|
$matchedTable

## Validation

| Step | Command | Exit Code | Skipped | Output |
|---|---|---:|---:|---|
$validationTable

## Recommended Next Step

Open this prompt in Claude/Copilot from the repo root:

```txt
$promptPath
```

Then ask it to implement the requirements and produce:

```txt
docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md
```

## Notes

- This script is intentionally production-safe.
- It does not blindly rewrite all chat screens.
- Use `-PatchScaffold` only when you want starter reusable frontend chat files created.
- Use `-RunValidation` after scaffolding or after Claude/Copilot implements the actual app integration.
"@

Write-TextFile -Path $reportPath -Content $finalReport

Write-Step "Final report created: $reportPath"

if (-not $NoOpenReport) {
    try {
        if ($Apply -and (Test-Path -LiteralPath $reportPath)) {
            Invoke-Item -LiteralPath $reportPath
            Write-Step "Report launched."
        } elseif (-not $Apply -and (Test-Path -LiteralPath $reportPath)) {
            Invoke-Item -LiteralPath $reportPath
            Write-Step "Dry-run report launched."
        }
    } catch {
        Write-Warn "Could not launch report automatically: $($_.Exception.Message)"
    }
}

Write-Step "APEX automation finished."
Write-Host ""
Write-Host "DONE."
Write-Host "Report: $reportPath"
Write-Host ""
