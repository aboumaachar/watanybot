[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [switch]$Apply,
    [switch]$PatchFrontend,
    [switch]$RunValidation,
    [switch]$NoOpenReport,
    [switch]$SkipSelfInstall
)

$ErrorActionPreference = "Stop"

# UTF-8 / Windows console normalization
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

function New-DirSafe {
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

function Write-Utf8File {
    param(
        [string]$Path,
        [string]$Content,
        [switch]$BackupExisting
    )

    $Dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $Dir)) {
        if ($Apply) {
            New-Item -ItemType Directory -Path $Dir -Force | Out-Null
        } else {
            Write-Step "DRY-RUN: would create directory: $Dir"
            return
        }
    }

    if ((Test-Path -LiteralPath $Path) -and $BackupExisting) {
        $BackupName = (Split-Path -Leaf $Path) + "." + (Get-Date -Format "yyyyMMdd-HHmmss") + ".bak"
        $BackupPath = Join-Path $script:BackupDir $BackupName
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

function Test-NpmScript {
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
        Set-Content -LiteralPath $OutputPath -Value "# $Name`r`nDRY-RUN: would run $Command" -Encoding utf8
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
        "apps\web-user\src",
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

function Test-ExcludedPath {
    param([string]$FullPath)

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
        "\.venv\",
        "\venv\",
        "\_archive\",
        "\_apex_backups\",
        "\.apex-backups\",
        "\.apex\",
        "\.tmp-mcp-sync\",
        "\rc_restore_drill\"
    )

    foreach ($Frag in $ExcludeFragments) {
        if ($FullPath -like "*$Frag*") {
            return $true
        }
    }

    return $false
}

function Get-ActiveRepoFiles {
    param([string]$Root)

    $Extensions = @("*.ts","*.tsx","*.js","*.jsx","*.css","*.scss","*.json","*.md","*.prisma")
    $Files = @()

    foreach ($Ext in $Extensions) {
        $Items = Get-ChildItem -LiteralPath $Root -Recurse -File -Filter $Ext -ErrorAction SilentlyContinue
        foreach ($Item in $Items) {
            if (-not (Test-ExcludedPath -FullPath $Item.FullName)) {
                $Files += $Item
            }
        }
    }

    return $Files | Sort-Object FullName -Unique
}

function New-WhatsAppFrontendScaffold {
    param(
        [string]$FrontendRoot
    )

    $CreatedFiles = @()
    $ComponentDir = Join-Path $FrontendRoot "components\chat\whatsapp"
    $TypesPath = Join-Path $ComponentDir "chat-types.ts"
    $ShellPath = Join-Path $ComponentDir "WhatsAppChatShell.tsx"
    $CssPath = Join-Path $ComponentDir "whatsapp-chat.css"
    $IndexPath = Join-Path $ComponentDir "index.ts"
    $ReadmePath = Join-Path $ComponentDir "README_INTEGRATION.md"

    $Types = @'
export type ChatSenderType = "user" | "admin" | "assistant" | "system";

export type ChatMessageStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "retrying";

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

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId?: string;
  senderType: ChatSenderType;
  body: string;
  messageType?: "text" | "system" | "attachment" | "answer_reference" | string;
  status?: ChatMessageStatus;
  metadata?: Record<string, unknown>;
  createdAt: string | Date;
  updatedAt?: string | Date;
  readAt?: string | Date | null;
  senderName?: string;
}

export function normalizeMessageStatus(status?: string | null): ChatMessageStatus {
  if (
    status === "sending" ||
    status === "sent" ||
    status === "delivered" ||
    status === "read" ||
    status === "failed" ||
    status === "retrying"
  ) {
    return status;
  }

  return "sent";
}

export function isProbablyArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}
'@

    $Shell = @'
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./whatsapp-chat.css";
import type { ChatMessage, ChatMessageStatus, ChatSenderType, Conversation } from "./chat-types";
import { isProbablyArabic, normalizeMessageStatus } from "./chat-types";

export interface WhatsAppChatShellProps {
  title: string;
  subtitle?: string;
  conversation?: Conversation;
  messages: ChatMessage[];
  currentUserSenderTypes?: ChatSenderType[];
  isTyping?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyLabel?: string;
  onSend: (body: string) => Promise<void> | void;
  onRetry?: (message: ChatMessage) => Promise<void> | void;
  onBack?: () => void;
  onLoadOlder?: () => Promise<void> | void;
  hasOlderMessages?: boolean;
}

function formatMessageTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: ChatMessageStatus): string {
  if (status === "sending") return "Sending";
  if (status === "sent") return "Sent";
  if (status === "delivered") return "Delivered";
  if (status === "read") return "Read";
  if (status === "failed") return "Failed";
  if (status === "retrying") return "Retrying";
  return "Sent";
}

function MessageStatusView({ status }: { status?: string | null }) {
  const normalized = normalizeMessageStatus(status);

  if (normalized === "sending" || normalized === "retrying") {
    return <span className="wa-message-status" aria-label={statusLabel(normalized)}>…</span>;
  }

  if (normalized === "sent") {
    return <span className="wa-message-status" aria-label="Sent">✓</span>;
  }

  if (normalized === "delivered") {
    return <span className="wa-message-status" aria-label="Delivered">✓✓</span>;
  }

  if (normalized === "read") {
    return <span className="wa-message-status wa-message-status-read" aria-label="Read">✓✓</span>;
  }

  if (normalized === "failed") {
    return <span className="wa-message-status wa-message-status-failed" aria-label="Failed">!</span>;
  }

  return null;
}

export default function WhatsAppChatShell({
  title,
  subtitle,
  conversation,
  messages,
  currentUserSenderTypes = ["user"],
  isTyping = false,
  disabled = false,
  placeholder = "Type a message…",
  emptyLabel = "No messages yet.",
  onSend,
  onRetry,
  onBack,
  onLoadOlder,
  hasOlderMessages = false,
}: WhatsAppChatShellProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastMessageCountRef = useRef(0);

  const visibleMessages = useMemo(() => messages ?? [], [messages]);
  const canSend = draft.trim().length > 0 && !sending && !disabled;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const previousCount = lastMessageCountRef.current;
    lastMessageCountRef.current = visibleMessages.length;

    if (visibleMessages.length >= previousCount) {
      list.scrollTop = list.scrollHeight;
    }
  }, [visibleMessages.length, isTyping]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
  }, [draft]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending || disabled) return;

    setSending(true);
    try {
      await onSend(body);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  async function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    if (!hasOlderMessages || !onLoadOlder || loadingOlder) return;

    if (target.scrollTop <= 48) {
      const beforeHeight = target.scrollHeight;
      setLoadingOlder(true);
      try {
        await onLoadOlder();
        requestAnimationFrame(() => {
          const list = listRef.current;
          if (!list) return;
          list.scrollTop = list.scrollHeight - beforeHeight;
        });
      } finally {
        setLoadingOlder(false);
      }
    }
  }

  return (
    <section className="wa-chat-shell" aria-label={conversation?.title ?? title}>
      <header className="wa-chat-header">
        {onBack ? (
          <button className="wa-chat-back" type="button" onClick={onBack} aria-label="Back to conversations">
            ‹
          </button>
        ) : null}

        <div className="wa-chat-avatar" aria-hidden="true">
          {(title || "W").slice(0, 1).toUpperCase()}
        </div>

        <div className="wa-chat-titleblock">
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      </header>

      <div className="wa-message-list" ref={listRef} onScroll={handleScroll}>
        {loadingOlder ? <div className="wa-load-older">Loading older messages…</div> : null}

        {visibleMessages.length === 0 ? (
          <div className="wa-empty-state">{emptyLabel}</div>
        ) : null}

        {visibleMessages.map((message) => {
          const mine = currentUserSenderTypes.includes(message.senderType);
          const rtl = isProbablyArabic(message.body);
          const normalizedStatus = normalizeMessageStatus(message.status);

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
                  <time dateTime={new Date(message.createdAt).toISOString()}>{formatMessageTime(message.createdAt)}</time>
                  {mine ? <MessageStatusView status={normalizedStatus} /> : null}
                  {normalizedStatus === "failed" && onRetry ? (
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
            <div className="wa-bubble wa-bubble-other wa-typing" aria-live="polite">
              typing…
            </div>
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
          aria-label="Message"
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
  min-height: 64px;
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
  font: inherit;
}

.wa-chat-back {
  background: transparent;
  color: #263238;
  font-size: 30px;
  line-height: 1;
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
  flex: 0 0 auto;
}

.wa-chat-titleblock {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.wa-chat-titleblock strong {
  font-size: 16px;
  line-height: 1.2;
  color: #172126;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wa-chat-titleblock span {
  font-size: 13px;
  color: #53606d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.wa-load-older,
.wa-empty-state {
  align-self: center;
  color: #53606d;
  background: rgba(255,255,255,0.78);
  padding: 10px 14px;
  border-radius: 999px;
  font-size: 14px;
}

.wa-empty-state {
  margin: auto;
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

.wa-message-body {
  white-space: pre-wrap;
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

.wa-message-status-read {
  color: #2563eb;
}

.wa-message-status-failed {
  color: #b91c1c;
  font-weight: 700;
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

    $Index = @'
export { default as WhatsAppChatShell } from "./WhatsAppChatShell";
export type {
  ChatMessage,
  ChatMessageStatus,
  ChatSenderType,
  Conversation,
} from "./chat-types";
export {
  isProbablyArabic,
  normalizeMessageStatus,
} from "./chat-types";
'@

    $Readme = @'
# WhatsApp Chat Scaffold Integration

This folder contains a reusable WhatsApp-style chat shell.

## Files

- `WhatsAppChatShell.tsx`
- `chat-types.ts`
- `whatsapp-chat.css`
- `index.ts`

## Integration Rule

Do not blindly replace existing chat files. First inspect the active chat screens, then adapt their message-fetch/send logic into `WhatsAppChatShell`.

## Minimum Integration Example

```tsx
import { WhatsAppChatShell } from "@/components/chat/whatsapp";

<WhatsAppChatShell
  title="موطني"
  messages={messages}
  isTyping={isTyping}
  onSend={sendMessage}
  onRetry={retryMessage}
/>
```

## Required Follow-Up

After integration, create:

```txt
docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md
```

Include files modified, validation results, manual QA, and remaining risks.
'@

    Write-Utf8File -Path $TypesPath -Content $Types -BackupExisting
    Write-Utf8File -Path $ShellPath -Content $Shell -BackupExisting
    Write-Utf8File -Path $CssPath -Content $Css -BackupExisting
    Write-Utf8File -Path $IndexPath -Content $Index -BackupExisting
    Write-Utf8File -Path $ReadmePath -Content $Readme -BackupExisting

    $CreatedFiles += $TypesPath
    $CreatedFiles += $ShellPath
    $CreatedFiles += $CssPath
    $CreatedFiles += $IndexPath
    $CreatedFiles += $ReadmePath

    return $CreatedFiles
}

# Resolve repo
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $Current = (Get-Location).Path
    if ((Test-Path -LiteralPath (Join-Path $Current "package.json")) -or (Test-Path -LiteralPath (Join-Path $Current ".git"))) {
        $RepoRoot = $Current
    }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    throw "RepoRoot is required when not running from a repo folder."
}

$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$RunId = Get-Date -Format "yyyyMMdd-HHmmss"
$Started = Get-Date

if ($Apply) {
    $RunDir = Join-Path $RepoRoot ".apex\whatsapp-chat-implementation\$RunId"
} else {
    $RunDir = Join-Path $env:TEMP "apex-whatsapp-chat-implementation-$RunId"
}

$BackupDir = Join-Path $RunDir "backups"
$LogPath = Join-Path $RunDir "execution.log"
$script:BackupDir = $BackupDir
$script:LogPath = $LogPath

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Set-Content -LiteralPath $LogPath -Value "APEX WhatsApp Chat Implementation V1`r`nRunId: $RunId`r`nRepoRoot: $RepoRoot`r`n" -Encoding utf8

$ReportPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_IMPLEMENTATION_REPORT.md"
$InventoryPath = Join-Path $RunDir "ACTIVE_CHAT_FILE_INVENTORY.md"
$TaskPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_IMPLEMENTATION_CLAUDE_TASK.md"
$ChecklistPath = Join-Path $RunDir "WHATSAPP_CHAT_QA_CHECKLIST.md"

Write-Step "APEX WhatsApp Chat Implementation V1 started"
Write-Step "RepoRoot: $RepoRoot"
Write-Step "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"

# Self-install
try {
    $SelfPath = $PSCommandPath
    $Downloads = Join-Path $env:USERPROFILE "Downloads"
    if (-not $SkipSelfInstall -and $SelfPath -and $SelfPath.StartsWith($Downloads, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ScriptDir = Join-Path $RepoRoot "scripts\apex"
        $DestScript = Join-Path $ScriptDir "APEX-WhatsApp-Chat-Implementation-V1.ps1"
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

$FrontendRoot = Find-FrontendRoot -Root $RepoRoot
$PackageJsonPath = Join-Path $RepoRoot "package.json"
$PackageJson = Get-PackageJson -Path $PackageJsonPath

Write-Step "Scanning active repository files only"
$RepoFiles = Get-ActiveRepoFiles -Root $RepoRoot

$ChatHits = @()
$LikelyActiveChatFiles = @()
$Keywords = @("chat", "conversation", "message", "messages", "support", "assistant", "thread", "whatsapp")

foreach ($File in $RepoFiles) {
    $Relative = $File.FullName.Substring($RepoRoot.Length).TrimStart("\","/")
    $Reason = ""

    foreach ($Keyword in $Keywords) {
        if ($Relative -match $Keyword) {
            $Reason = "path"
            break
        }
    }

    if ([string]::IsNullOrWhiteSpace($Reason) -and $File.Length -lt 400000) {
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
        $Hit = [pscustomobject]@{
            RelativePath = $Relative
            FullPath = $File.FullName
            Reason = $Reason
            SizeBytes = $File.Length
        }
        $ChatHits += $Hit

        if ($Relative -like "apps\web\src\*" -or $Relative -like "apps\web-user\src\*" -or $Relative -like "src\*") {
            $LikelyActiveChatFiles += $Hit
        }
    }
}

$ChatHits = $ChatHits | Sort-Object RelativePath -Unique
$LikelyActiveChatFiles = $LikelyActiveChatFiles | Sort-Object RelativePath -Unique

Write-Step "Active files scanned: $(@($RepoFiles).Count)"
Write-Step "Active chat-related hits: $(@($ChatHits).Count)"
if (-not [string]::IsNullOrWhiteSpace($FrontendRoot)) {
    Write-Step "Detected frontend source root: $FrontendRoot"
} else {
    Write-WarnLine "Could not detect frontend source root"
}

$HitRows = @()
if (@($ChatHits).Count -gt 0) {
    foreach ($H in ($ChatHits | Select-Object -First 250)) {
        $HitRows += "| ``$($H.RelativePath)`` | $($H.Reason) | $($H.SizeBytes) |"
    }
} else {
    $HitRows += "| _None found_ | - | - |"
}
$HitTable = $HitRows -join "`r`n"

$ActiveRows = @()
if (@($LikelyActiveChatFiles).Count -gt 0) {
    foreach ($H in ($LikelyActiveChatFiles | Select-Object -First 100)) {
        $ActiveRows += "| ``$($H.RelativePath)`` | $($H.Reason) | $($H.SizeBytes) |"
    }
} else {
    $ActiveRows += "| _None found_ | - | - |"
}
$ActiveTable = $ActiveRows -join "`r`n"

$CreatedScaffold = @()
if ($PatchFrontend) {
    if (-not [string]::IsNullOrWhiteSpace($FrontendRoot)) {
        Write-Step "PatchFrontend enabled: creating reusable WhatsApp chat scaffold"
        $CreatedScaffold = New-WhatsAppFrontendScaffold -FrontendRoot $FrontendRoot
    } else {
        Write-WarnLine "PatchFrontend requested but no frontend root was found."
    }
} else {
    Write-Step "PatchFrontend not enabled. No frontend files were created."
}

$ScaffoldRows = @()
if (@($CreatedScaffold).Count -gt 0) {
    foreach ($S in $CreatedScaffold) {
        $ScaffoldRows += "| ``$S`` |"
    }
} else {
    $ScaffoldRows += "| _No scaffold files created_ |"
}
$ScaffoldTable = $ScaffoldRows -join "`r`n"

$Inventory = @"
# Active Chat File Inventory

Run ID: $RunId  
Repo Root: ``$RepoRoot``  
Frontend Root: ``$(if ($FrontendRoot) { $FrontendRoot } else { "NOT DETECTED" })``

## Active Repository Scan

| Metric | Value |
|---|---:|
| Active files scanned | $(@($RepoFiles).Count) |
| Active chat-related hits | $(@($ChatHits).Count) |
| Likely frontend active chat files | $(@($LikelyActiveChatFiles).Count) |

## Likely Active Frontend Chat Files

| File | Reason | Size |
|---|---:|---:|
$ActiveTable

## All Active Chat Hits

| File | Reason | Size |
|---|---:|---:|
$HitTable

## Exclusions Applied

The scan intentionally excluded:

- node_modules
- .next
- dist/build/coverage
- .git
- .venv / venv
- _archive
- _apex_backups
- .apex-backups
- .apex
- rc_restore_drill
- temp MCP sync folders
"@

$ClaudeTask = @"
# Claude/Copilot Task — Active Implementation of WhatsApp Chat Behavior

You are inside:

```txt
$RepoRoot
```

Use this task to implement the WhatsApp-style behavior in the active app. Do not work from archived, backup, `.venv`, or generated files.

## Baseline

Previous APEX V5 completed successfully and generated a high-level report, contract, plan, and prompt. This implementation pass narrows scope to active files only and optionally creates a reusable frontend scaffold.

Detected frontend root:

```txt
$(if ($FrontendRoot) { $FrontendRoot } else { "NOT DETECTED" })
```

## Required Contract

Use the generated chat contract:

- Conversation fields: id, type, title, participantIds, lastMessagePreview, lastMessageAt, unreadCount, status, createdAt, updatedAt.
- Message fields: id, conversationId, senderType, body, messageType, status, metadata, createdAt, updatedAt, readAt.
- Status values: sending, sent, delivered, read, failed, retrying.
- Sender values: user, admin, assistant, system.

## Created Scaffold

| File |
|---|
$ScaffoldTable

## Likely Active Frontend Chat Files

| File | Reason | Size |
|---|---:|---:|
$ActiveTable

## Implementation Instructions

1. Inspect the active files listed above.
2. Identify the real user chat, admin chat, support chat, AI chat, group chat, saved chat, and procedure chat screens.
3. Integrate or adapt the reusable WhatsApp chat scaffold if created.
4. Do not blindly replace logic.
5. Preserve existing API calls, auth, role checks, and admin flows.
6. Make the layout mobile-safe:
   - 100dvh
   - sticky/fixed header
   - sticky/fixed composer
   - min-height: 0 scroll area
   - env(safe-area-inset-bottom)
7. Implement message status mapping with fallback to sent.
8. Implement send loading state, failed state, and retry hook.
9. Implement typing indicator for AI/support wait states.
10. Implement read/unread logic only on open/visible conversation, not background fetch.
11. Support Arabic RTL per message body.
12. Ensure touch targets are at least 44px.
13. Create a final implementation report at:

```txt
docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md
```

## Acceptance Criteria

- Every chat-like screen uses the same shared behavior or an equivalent wrapper.
- Composer stays visible on mobile.
- Header remains fixed.
- Long conversations scroll correctly.
- Messages align by sender.
- Arabic messages render RTL.
- Send supports Enter and Shift+Enter.
- Failed messages can be retried.
- Unread counts do not clear from background fetch.
- Admin can view and reply in a chat-like flow.
- Build/typecheck/lint pass where available.

## Validation

Run only scripts that exist:

```powershell
npm run typecheck
npm run lint
npm run build
npm test
```

Then update the final implementation report with evidence.
"@

$Checklist = @'
# WhatsApp Chat QA Checklist

## Desktop

- [ ] Open each chat screen.
- [ ] Verify fixed header.
- [ ] Verify scrollable message list.
- [ ] Verify fixed composer.
- [ ] Send text message.
- [ ] Press Enter to send.
- [ ] Press Shift+Enter for newline.
- [ ] Check timestamps.
- [ ] Check sender alignment.
- [ ] Check failed-send retry if possible.

## Mobile

- [ ] Open at 390px width.
- [ ] Open at 430px width.
- [ ] Open on real mobile if available.
- [ ] Confirm keyboard does not cover composer.
- [ ] Confirm full page does not awkwardly scroll.
- [ ] Confirm long conversation scroll.
- [ ] Confirm back-to-conversation-list behavior if applicable.
- [ ] Confirm touch targets are comfortable.

## Arabic / RTL

- [ ] Send Arabic message.
- [ ] Send mixed Arabic/English message.
- [ ] Confirm Arabic bubble direction.
- [ ] Confirm punctuation looks correct.
- [ ] Confirm long Arabic messages wrap correctly.

## Admin

- [ ] Admin can see conversations.
- [ ] Admin can filter new/unanswered/flagged if implemented.
- [ ] Admin can reply.
- [ ] Admin reply appears in user conversation.
- [ ] Admin can identify repeated questions if implemented.

## Read / Unread

- [ ] New incoming message increments unread count.
- [ ] Opening conversation marks visible messages read.
- [ ] Background fetch does not clear unread count.
- [ ] Conversation list sorts by last activity.

## Validation

- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm run build
- [ ] npm test
'@

Write-Utf8File -Path $InventoryPath -Content $Inventory
Write-Utf8File -Path $TaskPath -Content $ClaudeTask
Write-Utf8File -Path $ChecklistPath -Content $Checklist

$ValidationResults = @()
if ($RunValidation) {
    if (Test-Path -LiteralPath $PackageJsonPath) {
        if (Test-NpmScript -PackageJson $PackageJson -ScriptName "typecheck") {
            $ValidationResults += (Invoke-ValidationCommand -Name "TYPECHECK" -Command "npm run typecheck" -WorkingDirectory $RepoRoot -OutputDir $RunDir)
        }
        if (Test-NpmScript -PackageJson $PackageJson -ScriptName "lint") {
            $ValidationResults += (Invoke-ValidationCommand -Name "LINT" -Command "npm run lint" -WorkingDirectory $RepoRoot -OutputDir $RunDir)
        }
        if (Test-NpmScript -PackageJson $PackageJson -ScriptName "build") {
            $ValidationResults += (Invoke-ValidationCommand -Name "BUILD" -Command "npm run build" -WorkingDirectory $RepoRoot -OutputDir $RunDir)
        }
        if (Test-NpmScript -PackageJson $PackageJson -ScriptName "test") {
            $ValidationResults += (Invoke-ValidationCommand -Name "TEST" -Command "npm test" -WorkingDirectory $RepoRoot -OutputDir $RunDir)
        }
        if (@($ValidationResults).Count -eq 0) {
            Write-WarnLine "RunValidation enabled, but no recognized npm scripts were found."
        }
    } else {
        Write-WarnLine "RunValidation enabled, but package.json was not found."
    }
} else {
    Write-Step "RunValidation not enabled."
}

$ValidationRows = @()
if (@($ValidationResults).Count -gt 0) {
    foreach ($V in $ValidationResults) {
        $ValidationRows += "| $($V.Name) | ``$($V.Command)`` | $($V.ExitCode) | $($V.Skipped) | ``$($V.OutputPath)`` |"
    }
} else {
    $ValidationRows += "| _No validation commands executed_ | - | - | - | - |"
}
$ValidationTable = $ValidationRows -join "`r`n"

$Duration = New-TimeSpan -Start $Started -End (Get-Date)

$Report = @"
# APEX WhatsApp Chat Implementation V1 Report

## Status

$(if ($Apply) { "APPLY mode completed." } else { "DRY-RUN completed." })

## Run Metadata

| Field | Value |
|---|---|
| Run ID | $RunId |
| Repo Root | ``$RepoRoot`` |
| Frontend Root | ``$(if ($FrontendRoot) { $FrontendRoot } else { "NOT DETECTED" })`` |
| Apply | $Apply |
| PatchFrontend | $PatchFrontend |
| RunValidation | $RunValidation |
| Started | $($Started.ToString("yyyy-MM-dd HH:mm:ss")) |
| Duration | $($Duration.ToString()) |
| Encoding | UTF-8 forced / code page 65001 attempted |

## Generated Files

| File | Purpose |
|---|---|
| ``$InventoryPath`` | Active file inventory excluding archives/backups/venv |
| ``$TaskPath`` | Claude/Copilot active implementation task |
| ``$ChecklistPath`` | Manual QA checklist |
| ``$LogPath`` | Execution log |

## Scaffold Files

| File |
|---|
$ScaffoldTable

## Active Scan Summary

| Metric | Value |
|---|---:|
| Active files scanned | $(@($RepoFiles).Count) |
| Active chat-related hits | $(@($ChatHits).Count) |
| Likely active frontend chat files | $(@($LikelyActiveChatFiles).Count) |

## Likely Active Frontend Chat Files

| File | Reason | Size |
|---|---:|---:|
$ActiveTable

## Validation

| Step | Command | Exit Code | Skipped | Output |
|---|---|---:|---:|---|
$ValidationTable

## Next Step

Open and execute this task with Claude/Copilot inside VS Code:

```txt
$TaskPath
```

After implementation, require this final report:

```txt
docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md
```

## Important Notes

- This script focuses on active files only.
- It excludes archives, backups, `.venv`, `.apex`, and generated folders.
- It does not blindly modify existing chat screens.
- Use `-PatchFrontend` to create a reusable WhatsApp chat scaffold.
- Use `-RunValidation` after scaffold creation or after actual integration.
"@

Write-Utf8File -Path $ReportPath -Content $Report

Write-Step "Final implementation report created: $ReportPath"

if (-not $NoOpenReport) {
    try {
        Invoke-Item -LiteralPath $ReportPath
        Write-Step "Report launched."
    } catch {
        Write-WarnLine "Could not launch report automatically: $($_.Exception.Message)"
    }
}

Write-Step "APEX WhatsApp Chat Implementation V1 finished."
Write-Host ""
Write-Host "DONE"
Write-Host "Report: $ReportPath"
