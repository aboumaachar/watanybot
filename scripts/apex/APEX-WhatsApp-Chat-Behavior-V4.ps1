[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [switch]$Apply,
    [switch]$PatchScaffold,
    [switch]$RunValidation,
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

function Backup-And-Write {
    param(
        [string]$Path,
        [string]$Content,
        [string]$BackupDir
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

    if (Test-Path -LiteralPath $Path) {
        $BackupName = (Split-Path -Leaf $Path) + "." + (Get-Date -Format "yyyyMMdd-HHmmss") + ".bak"
        $BackupPath = Join-Path $BackupDir $BackupName
        if ($Apply) {
            Copy-Item -LiteralPath $Path -Destination $BackupPath -Force
            Write-Step "Backup created: $BackupPath"
        } else {
            Write-Step "DRY-RUN: would backup $Path to $BackupPath"
        }
    }

    if ($Apply) {
        Set-Content -LiteralPath $Path -Value $Content -Encoding utf8
        Write-Step "Wrote: $Path"
    } else {
        Write-Step "DRY-RUN: would write: $Path"
    }
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

function Invoke-ValidationCommand {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WorkingDirectory,
        [string]$OutputDir
    )

    Write-Step "RUNNING: $Name"
    Write-Step "COMMAND: $Command"

    $OutputPath = Join-Path $OutputDir ("validation_{0}.log" -f ($Name -replace "[^\w\-]", "_"))

    if (-not $Apply) {
        $Dry = "# $Name`r`nDRY-RUN: would run $Command in $WorkingDirectory"
        Set-Content -LiteralPath $OutputPath -Value $Dry -Encoding utf8
        return [pscustomobject]@{
            Name = $Name
            Command = $Command
            ExitCode = 0
            Skipped = $true
            OutputPath = $OutputPath
        }
    }

    Push-Location $WorkingDirectory
    try {
        $Output = & powershell -NoProfile -ExecutionPolicy Bypass -Command $Command 2>&1
        $ExitCode = $LASTEXITCODE
        if ($null -eq $ExitCode) { $ExitCode = 0 }

        $Text = @"
# $Name

Command:
$Command

ExitCode:
$ExitCode

Output:
$($Output | Out-String)
"@
        Set-Content -LiteralPath $OutputPath -Value $Text -Encoding utf8

        if ($ExitCode -eq 0) {
            Write-Step "$Name passed."
        } else {
            Write-WarnLine "$Name failed with exit code $ExitCode. See: $OutputPath"
        }

        return [pscustomobject]@{
            Name = $Name
            Command = $Command
            ExitCode = $ExitCode
            Skipped = $false
            OutputPath = $OutputPath
        }
    } finally {
        Pop-Location
    }
}

function Find-FrontendRoot {
    param([string]$Root)

    $Candidates = @(
        "apps\web\src",
        "apps\web\app",
        "src",
        "app",
        "frontend\src",
        "web\src",
        "client\src"
    )

    foreach ($Candidate in $Candidates) {
        $Full = Join-Path $Root $Candidate
        if (Test-Path -LiteralPath $Full) {
            return $Full
        }
    }

    return ""
}

function Get-RepoFiles {
    param([string]$Root)

    $ExcludeFragments = @(
        "\node_modules\",
        "\.next\",
        "\dist\",
        "\build\",
        "\coverage\",
        "\.git\",
        "\.turbo\",
        "\.vercel\",
        "\vendor\",
        "\.apex\"
    )

    $Extensions = @("*.ts","*.tsx","*.js","*.jsx","*.css","*.scss","*.json","*.md","*.prisma")
    $All = @()

    foreach ($Ext in $Extensions) {
        $Items = Get-ChildItem -LiteralPath $Root -Recurse -File -Filter $Ext -ErrorAction SilentlyContinue
        foreach ($Item in $Items) {
            $Full = $Item.FullName
            $Skip = $false
            foreach ($Frag in $ExcludeFragments) {
                if ($Full -like "*$Frag*") {
                    $Skip = $true
                    break
                }
            }
            if (-not $Skip) {
                $All += $Item
            }
        }
    }

    return $All | Sort-Object FullName -Unique
}

function New-ChatScaffold {
    param(
        [string]$FrontendRoot,
        [string]$BackupDir
    )

    $Created = @()
    $ComponentDir = Join-Path $FrontendRoot "components\chat"
    $TsxPath = Join-Path $ComponentDir "WhatsAppChatShell.tsx"
    $CssPath = Join-Path $ComponentDir "chat-whatsapp.css"
    $IndexPath = Join-Path $ComponentDir "index.ts"

    $Tsx = @'
"use client";

import React, { useEffect, useRef, useState } from "react";
import "./chat-whatsapp.css";

export type ChatSenderType = "user" | "admin" | "assistant" | "system";
export type ChatMessageStatus = "sending" | "sent" | "delivered" | "read" | "failed" | "retrying";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: ChatSenderType;
  body: string;
  createdAt: string | Date;
  status?: ChatMessageStatus;
  senderName?: string;
}

export interface WhatsAppChatShellProps {
  title: string;
  subtitle?: string;
  messages: ChatMessage[];
  currentUserSenderTypes?: ChatSenderType[];
  isTyping?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onSend: (body: string) => Promise<void> | void;
  onRetry?: (message: ChatMessage) => Promise<void> | void;
  onBack?: () => void;
}

function hasArabic(text: string): boolean {
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
  messages,
  currentUserSenderTypes = ["user"],
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

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, isTyping]);

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
        {messages.length === 0 ? <div className="wa-empty-state">No messages yet.</div> : null}

        {messages.map((message) => {
          const mine = currentUserSenderTypes.includes(message.senderType);
          const rtl = hasArabic(message.body);

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
        <button className="wa-composer-action" type="button" disabled={disabled} aria-label="Attachment placeholder">
          +
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
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

    $Css = @'
.wa-chat-shell {
  display: grid;
  grid-template-rows: 64px minmax(0, 1fr) auto;
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
  }

  .wa-bubble {
    max-width: 86%;
    font-size: 16px;
  }
}
'@

    $Index = @'
export { default as WhatsAppChatShell } from "./WhatsAppChatShell";
export type {
  ChatMessage,
  ChatMessageStatus,
  ChatSenderType,
  WhatsAppChatShellProps,
} from "./WhatsAppChatShell";
'@

    Backup-And-Write -Path $TsxPath -Content $Tsx -BackupDir $BackupDir
    Backup-And-Write -Path $CssPath -Content $Css -BackupDir $BackupDir
    Backup-And-Write -Path $IndexPath -Content $Index -BackupDir $BackupDir

    $Created += $TsxPath
    $Created += $CssPath
    $Created += $IndexPath
    return $Created
}

# -----------------------------
# Resolve repository
# -----------------------------
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $Current = (Get-Location).Path
    if ((Test-Path -LiteralPath (Join-Path $Current "package.json")) -or (Test-Path -LiteralPath (Join-Path $Current ".git"))) {
        $RepoRoot = $Current
    }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    throw "RepoRoot is required when not running from a repo folder. Example: powershell -NoProfile -ExecutionPolicy Bypass -File `$env:USERPROFILE\Downloads\APEX-WhatsApp-Chat-Behavior-V4.ps1 -RepoRoot C:\xampp\htdocs\projectx\watanybot -Apply"
}

$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$RunId = Get-Date -Format "yyyyMMdd-HHmmss"
$StartTime = Get-Date

if ($Apply) {
    $RunDir = Join-Path $RepoRoot ".apex\whatsapp-chat-behavior\$RunId"
} else {
    $RunDir = Join-Path $env:TEMP "apex-whatsapp-chat-behavior-$RunId"
}

$BackupDir = Join-Path $RunDir "backups"
$LogPath = Join-Path $RunDir "execution.log"
$script:LogPath = $LogPath

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Set-Content -LiteralPath $LogPath -Value "APEX WhatsApp Chat Behavior V4`r`nRunId: $RunId`r`nRepoRoot: $RepoRoot`r`n" -Encoding utf8

$ReportPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_BEHAVIOR_REPORT.md"
$PlanPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_BEHAVIOR_PLAN.md"
$PromptPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_BEHAVIOR_CLAUDE_PROMPT.md"
$ContractPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_CONTRACT.md"

Write-Step "APEX WhatsApp Chat Behavior V4 started"
Write-Step "RepoRoot: $RepoRoot"
Write-Step "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"

# -----------------------------
# Copy self from Downloads to repo
# -----------------------------
try {
    $SelfPath = $PSCommandPath
    $Downloads = Join-Path $env:USERPROFILE "Downloads"

    if (-not $SkipSelfInstall -and $SelfPath -and $SelfPath.StartsWith($Downloads, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ScriptDir = Join-Path $RepoRoot "scripts\apex"
        $DestScript = Join-Path $ScriptDir "APEX-WhatsApp-Chat-Behavior-V4.ps1"

        if ($Apply) {
            New-Item -ItemType Directory -Path $ScriptDir -Force | Out-Null
            Copy-Item -LiteralPath $SelfPath -Destination $DestScript -Force
            Write-Step "Copied script from Downloads to repo: $DestScript"
        } else {
            Write-Step "DRY-RUN: would copy script from Downloads to: $DestScript"
        }
    }
} catch {
    Write-WarnLine "Self-install copy failed but script will continue: $($_.Exception.Message)"
}

# -----------------------------
# Scan repo
# -----------------------------
Write-Step "Scanning repository files"
$RepoFiles = Get-RepoFiles -Root $RepoRoot
$FrontendRoot = Find-FrontendRoot -Root $RepoRoot
$PackageJsonPath = Join-Path $RepoRoot "package.json"
$PackageJson = Get-PackageJson -Path $PackageJsonPath

$Keywords = @("chat", "conversation", "message", "messages", "support", "assistant", "thread", "whatsapp", "admin")
$Matches = @()

foreach ($File in $RepoFiles) {
    $Relative = $File.FullName.Substring($RepoRoot.Length).TrimStart("\","/")
    $Reason = ""

    foreach ($Keyword in $Keywords) {
        if ($Relative -match $Keyword) {
            $Reason = "path"
            break
        }
    }

    if ([string]::IsNullOrWhiteSpace($Reason) -and $File.Length -lt 500000) {
        try {
            $Text = Get-Content -LiteralPath $File.FullName -Raw -Encoding utf8
            foreach ($Keyword in $Keywords) {
                if ($Text -match $Keyword) {
                    $Reason = "content"
                    break
                }
            }
        } catch {}
    }

    if (-not [string]::IsNullOrWhiteSpace($Reason)) {
        $Matches += [pscustomobject]@{
            RelativePath = $Relative
            Reason = $Reason
            SizeBytes = $File.Length
        }
    }
}

$Matches = $Matches | Sort-Object RelativePath -Unique

Write-Step "Repository files scanned: $($RepoFiles.Count)"
Write-Step "Potential chat-related files found: $($Matches.Count)"
if (-not [string]::IsNullOrWhiteSpace($FrontendRoot)) {
    Write-Step "Detected frontend source root: $FrontendRoot"
} else {
    Write-WarnLine "Frontend source root was not detected"
}

$MatchedRows = @()
if ($Matches.Count -gt 0) {
    foreach ($M in ($Matches | Select-Object -First 250)) {
        $MatchedRows += "| ``$($M.RelativePath)`` | $($M.Reason) | $($M.SizeBytes) |"
    }
} else {
    $MatchedRows += "| _None found_ | - | - |"
}
$MatchedTable = $MatchedRows -join "`r`n"

# -----------------------------
# Generate plan / prompt / contract
# -----------------------------
$PlanTemplate = @'
# APEX Plan — WhatsApp-Style Chat Behavior

Run ID: {{RUN_ID}}  
Repo Root: `{{REPO_ROOT}}`  
Mode: {{MODE}}  
Generated: {{GENERATED_AT}}

## Objective

Upgrade all chat screens so they behave like full WhatsApp-style smartphone conversations, not static forms.

## Required Behavior

- Fixed chat header.
- Scrollable message list.
- Fixed composer at bottom.
- Mobile keyboard-safe behavior.
- Sender-aligned bubbles.
- Timestamps.
- Message states: sending, sent, delivered, read, failed, retrying.
- Failed-send retry.
- Typing indicator.
- Conversation list with unread count and last message.
- Admin reply flow.
- Abuse/repeated-question monitoring hooks.
- Arabic RTL and English LTR support.
- Elderly-friendly readable contrast and touch targets.

## Detected Frontend Root

```txt
{{FRONTEND_ROOT}}
```

## Repository Scan

| Metric | Value |
|---|---:|
| Files scanned | {{FILES_SCANNED}} |
| Potential chat-related files | {{MATCH_COUNT}} |

## Potential Chat-Related Files

| File | Reason | Size |
|---|---:|---:|
{{MATCHED_TABLE}}

## Implementation Waves

### Wave 1 — Shared Chat Shell

Create or consolidate:

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

### Wave 2 — Mobile and Keyboard Behavior

Use `100dvh`, safe-area padding, fixed/sticky header, fixed/sticky composer, and a middle scroll area with `min-height: 0`.

### Wave 3 — Composer Behavior

Support Enter to send, Shift+Enter newline, auto-growing textarea, disabled empty send, sending state, error state, retry state, and attachment placeholder.

### Wave 4 — Message Contract

Normalize sender and message status types. If backend has no delivered/read support, fallback to `sent`.

### Wave 5 — Conversation List

Support last message preview, last activity, unread badge, search, sort, selected state, and mobile list-to-thread navigation.

### Wave 6 — Read/Unread

Mark messages as read only when conversation is opened/visible. Do not mark read on background fetch.

### Wave 7 — Realtime or Polling

Use available stack: WebSocket, SSE, or polling fallback. Avoid duplicates after reconnect.

### Wave 8 — Admin Support

Admin can view, filter, reply, and convert repeated questions into official answers.

### Wave 9 — Logging and Abuse Hooks

Log inputs/responses, abuse flags, repeated questions, failed answers, and audit trail. Do not expose logs to users.

### Wave 10 — Arabic RTL and Accessibility

Support Arabic, English, mixed text, clear touch targets, and readable contrast.

## Validation

Run only available scripts:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```
'@

$PromptTemplate = @'
# Claude/Copilot Task — Implement WhatsApp-Style Chat Behavior

You are inside this repository:

```txt
{{REPO_ROOT}}
```

Implement a full WhatsApp-style chat behavior upgrade across the app.

## Do Not

- Do not make this only a cosmetic redesign.
- Do not blindly replace existing logic.
- Do not invent file paths.
- Do not break auth, roles, admin flows, or existing chat APIs.

## Must Implement

- Fixed chat header.
- Scrollable message area.
- Fixed bottom composer.
- Mobile keyboard-safe layout.
- Sender-aligned bubbles.
- Timestamps.
- Message states: sending, sent, delivered, read, failed, retrying.
- Retry failed messages.
- Typing indicator.
- Conversation list with last message, unread count, selected state, search/filter, latest sorting.
- Mobile list-first behavior and back-to-list behavior.
- Read/unread logic.
- Admin conversation panel.
- Admin filters: new, unanswered, most recent, most asked/repeated, flagged/abusive.
- Admin direct reply flow.
- Official answer creation from repeated questions.
- Input/response logging.
- Abuse flag hooks.
- Repeated question analytics.
- Failed answer tracking.
- Arabic RTL and mixed Arabic/English input.
- Elderly-friendly readable contrast and touch targets.

## Detected Frontend Root

```txt
{{FRONTEND_ROOT}}
```

## Potential Chat Files From Scan

| File | Reason | Size |
|---|---:|---:|
{{MATCHED_TABLE}}

## Required Report

After implementation, create:

```txt
docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md
```

Include:

- Files inspected.
- Files modified.
- Components created.
- Backend/API/database changes.
- Validation commands run.
- Pass/fail results.
- Manual QA checklist.
- Known limitations.
- Remaining risks.
- Next steps.

## Acceptance Criteria

The work is complete only when all chats behave like a proper mobile chat system with persistence, mobile-safe composer, shared components, message states, unread logic, admin support, logging hooks, Arabic RTL, and passing validation.
'@

$ContractTemplate = @'
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

## CSS Layout Contract

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
'@

$Plan = $PlanTemplate.
    Replace("{{RUN_ID}}", $RunId).
    Replace("{{REPO_ROOT}}", $RepoRoot).
    Replace("{{MODE}}", $(if ($Apply) { "APPLY" } else { "DRY-RUN" })).
    Replace("{{GENERATED_AT}}", (Get-Date -Format "yyyy-MM-dd HH:mm:ss")).
    Replace("{{FRONTEND_ROOT}}", $(if ($FrontendRoot) { $FrontendRoot } else { "NOT DETECTED" })).
    Replace("{{FILES_SCANNED}}", [string]$RepoFiles.Count).
    Replace("{{MATCH_COUNT}}", [string]$Matches.Count).
    Replace("{{MATCHED_TABLE}}", $MatchedTable)

$Prompt = $PromptTemplate.
    Replace("{{REPO_ROOT}}", $RepoRoot).
    Replace("{{FRONTEND_ROOT}}", $(if ($FrontendRoot) { $FrontendRoot } else { "NOT DETECTED" })).
    Replace("{{MATCHED_TABLE}}", $MatchedTable)

$Contract = $ContractTemplate

Write-Utf8File -Path $PlanPath -Content $Plan
Write-Utf8File -Path $PromptPath -Content $Prompt
Write-Utf8File -Path $ContractPath -Content $Contract

# -----------------------------
# Optional scaffold
# -----------------------------
$ScaffoldFiles = @()

if ($PatchScaffold) {
    if (-not [string]::IsNullOrWhiteSpace($FrontendRoot)) {
        Write-Step "PatchScaffold enabled"
        $CreatedFiles = New-ChatScaffold -FrontendRoot $FrontendRoot -BackupDir $BackupDir
        foreach ($C in $CreatedFiles) { $ScaffoldFiles += $C }
    } else {
        Write-WarnLine "PatchScaffold requested, but no frontend root was detected."
    }
} else {
    Write-Step "PatchScaffold not enabled. No app code files were changed."
}

# -----------------------------
# Optional validation
# -----------------------------
$ValidationResults = @()

if ($RunValidation) {
    if (Test-Path -LiteralPath $PackageJsonPath) {
        if (Has-NpmScript -PackageJson $PackageJson -ScriptName "typecheck") {
            $ValidationResults += (Invoke-ValidationCommand -Name "TYPECHECK" -Command "npm run typecheck" -WorkingDirectory $RepoRoot -OutputDir $RunDir)
        }
        if (Has-NpmScript -PackageJson $PackageJson -ScriptName "lint") {
            $ValidationResults += (Invoke-ValidationCommand -Name "LINT" -Command "npm run lint" -WorkingDirectory $RepoRoot -OutputDir $RunDir)
        }
        if (Has-NpmScript -PackageJson $PackageJson -ScriptName "build") {
            $ValidationResults += (Invoke-ValidationCommand -Name "BUILD" -Command "npm run build" -WorkingDirectory $RepoRoot -OutputDir $RunDir)
        }
        if (Has-NpmScript -PackageJson $PackageJson -ScriptName "test") {
            $ValidationResults += (Invoke-ValidationCommand -Name "TEST" -Command "npm test" -WorkingDirectory $RepoRoot -OutputDir $RunDir)
        }

        if ($ValidationResults.Count -eq 0) {
            Write-WarnLine "RunValidation enabled, but no recognized npm scripts were found."
        }
    } else {
        Write-WarnLine "RunValidation enabled, but package.json was not found."
    }
} else {
    Write-Step "RunValidation not enabled. Validation commands were not executed."
}

$ValidationRows = @()
if ($ValidationResults.Count -gt 0) {
    foreach ($V in $ValidationResults) {
        $ValidationRows += "| $($V.Name) | ``$($V.Command)`` | $($V.ExitCode) | $($V.Skipped) | ``$($V.OutputPath)`` |"
    }
} else {
    $ValidationRows += "| _No validation commands executed_ | - | - | - | - |"
}
$ValidationTable = $ValidationRows -join "`r`n"

$ScaffoldRows = @()
if ($ScaffoldFiles.Count -gt 0) {
    foreach ($S in $ScaffoldFiles) {
        $ScaffoldRows += "| ``$S`` |"
    }
} else {
    $ScaffoldRows += "| _No scaffold files created_ |"
}
$ScaffoldTable = $ScaffoldRows -join "`r`n"

$Duration = New-TimeSpan -Start $StartTime -End (Get-Date)

$ReportTemplate = @'
# APEX WhatsApp Chat Behavior V4 Report

## Status

{{STATUS}}

## Run Metadata

| Field | Value |
|---|---|
| Run ID | {{RUN_ID}} |
| Repo Root | `{{REPO_ROOT}}` |
| Apply | {{APPLY}} |
| PatchScaffold | {{PATCH_SCAFFOLD}} |
| RunValidation | {{RUN_VALIDATION}} |
| Started | {{STARTED}} |
| Duration | {{DURATION}} |
| Encoding | UTF-8 forced / code page 65001 attempted |

## Generated Files

| File | Purpose |
|---|---|
| `{{PLAN_PATH}}` | APEX implementation plan |
| `{{PROMPT_PATH}}` | Claude/Copilot execution prompt |
| `{{CONTRACT_PATH}}` | Chat data/component contract |
| `{{LOG_PATH}}` | Execution log |

## Optional Scaffold Files

| File |
|---|
{{SCAFFOLD_TABLE}}

## Repository Scan

| Metric | Value |
|---|---:|
| Files scanned | {{FILES_SCANNED}} |
| Potential chat-related files | {{MATCH_COUNT}} |
| Frontend root | `{{FRONTEND_ROOT}}` |

## Potential Chat-Related Files

| File | Reason | Size |
|---|---:|---:|
{{MATCHED_TABLE}}

## Validation

| Step | Command | Exit Code | Skipped | Output |
|---|---|---:|---:|---|
{{VALIDATION_TABLE}}

## Next Step

Give this file to Claude/Copilot inside VS Code:

```txt
{{PROMPT_PATH}}
```

Ask it to implement the actual code changes and create:

```txt
docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md
```

## Notes

- V4 avoids StrictMode variable-expansion failures and PowerShell generic List .Add() overload issues.
- It writes all report/planning files after variables are assigned.
- It does not blindly rewrite existing chat behavior.
- Use `-PatchScaffold` only for starter reusable frontend components.
- Use `-RunValidation` after scaffolding or after actual implementation.
'@

$Report = $ReportTemplate.
    Replace("{{STATUS}}", $(if ($Apply) { "APPLY mode completed." } else { "DRY-RUN completed." })).
    Replace("{{RUN_ID}}", $RunId).
    Replace("{{REPO_ROOT}}", $RepoRoot).
    Replace("{{APPLY}}", [string]$Apply).
    Replace("{{PATCH_SCAFFOLD}}", [string]$PatchScaffold).
    Replace("{{RUN_VALIDATION}}", [string]$RunValidation).
    Replace("{{STARTED}}", $StartTime.ToString("yyyy-MM-dd HH:mm:ss")).
    Replace("{{DURATION}}", $Duration.ToString()).
    Replace("{{PLAN_PATH}}", $PlanPath).
    Replace("{{PROMPT_PATH}}", $PromptPath).
    Replace("{{CONTRACT_PATH}}", $ContractPath).
    Replace("{{LOG_PATH}}", $LogPath).
    Replace("{{SCAFFOLD_TABLE}}", $ScaffoldTable).
    Replace("{{FILES_SCANNED}}", [string]$RepoFiles.Count).
    Replace("{{MATCH_COUNT}}", [string]$Matches.Count).
    Replace("{{FRONTEND_ROOT}}", $(if ($FrontendRoot) { $FrontendRoot } else { "NOT DETECTED" })).
    Replace("{{MATCHED_TABLE}}", $MatchedTable).
    Replace("{{VALIDATION_TABLE}}", $ValidationTable)

Write-Utf8File -Path $ReportPath -Content $Report

Write-Step "Final report created: $ReportPath"

if (-not $NoOpenReport) {
    try {
        Invoke-Item -LiteralPath $ReportPath
        Write-Step "Report launched."
    } catch {
        Write-WarnLine "Could not launch report automatically: $($_.Exception.Message)"
    }
}

Write-Step "APEX WhatsApp Chat Behavior V4 finished."
Write-Host ""
Write-Host "DONE"
Write-Host "Report: $ReportPath"
