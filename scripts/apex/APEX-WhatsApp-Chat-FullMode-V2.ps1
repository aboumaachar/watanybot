[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$FrontendRoot = "",
    [switch]$Apply,
    [bool]$PatchFrontend = $true,
    [bool]$RunValidation = $true,
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
        [string]$Content,
        [switch]$BackupExisting
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
    Write-Step "WORKDIR: $WorkingDirectory"
    Write-Step "COMMAND: $Command"

    $OutputPath = Join-Path $OutputDir ("validation_{0}.log" -f ($Name -replace "[^\w\-]", "_"))

    if (-not $Apply) {
        Set-Content -LiteralPath $OutputPath -Value "# $Name`r`nDRY-RUN: would run $Command in $WorkingDirectory" -Encoding utf8
        return [pscustomobject]@{
            Name = $Name
            Command = $Command
            Workdir = $WorkingDirectory
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

WorkingDirectory:
$WorkingDirectory

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
            Workdir = $WorkingDirectory
            ExitCode = $ExitCode
            Skipped = $false
            OutputPath = $OutputPath
        }
    } finally {
        Pop-Location
    }
}

function Resolve-FrontendRoot {
    param(
        [string]$Root,
        [string]$ExplicitFrontendRoot
    )

    if (-not [string]::IsNullOrWhiteSpace($ExplicitFrontendRoot)) {
        $Resolved = Resolve-Path -LiteralPath $ExplicitFrontendRoot -ErrorAction Stop
        return $Resolved.Path
    }

    # WatanyBot active chat screens are in apps\web-user\src.
    # Prefer web-user before apps\web\src to avoid scaffolding into the wrong app.
    $Candidates = @(
        "apps\web-user\src",
        "apps\web\src",
        "apps\web-public\src",
        "apps\web-admin\src",
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
        "\rc_restore_drill\",
        "\.tmp-mcp-sync\"
    )

    foreach ($Frag in $ExcludeFragments) {
        if ($FullPath -like "*$Frag*") { return $true }
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
    param([string]$TargetFrontendRoot)

    $CreatedFiles = @()
    $ComponentDir = Join-Path $TargetFrontendRoot "components\chat\whatsapp"
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

This scaffold was generated by APEX Full Mode V2.

## Files

- `WhatsAppChatShell.tsx`
- `chat-types.ts`
- `whatsapp-chat.css`
- `index.ts`

## Important

This scaffold does not replace existing chat logic by itself. Integrate it into the real active screens:

- `apps\web-user\src\components\ChatScreen.tsx`
- `apps\web-user\src\components\ChatFirstWindow.tsx`
- `apps\web-user\src\components\ChatMessageView.tsx`
- `apps\web-user\src\components\UniversalChatWidget.tsx`
- `apps\web-user\src\pages\ChatSessionsPage.tsx`
- `apps\web-user\src\pages\GroupChatsPage.tsx`
- `apps\web-user\src\pages\SavedChatsPage.tsx`
- admin monitor pages where relevant

## Minimum Example

```tsx
import { WhatsAppChatShell } from "./components/chat/whatsapp";

<WhatsAppChatShell
  title="موطني"
  messages={messages}
  isTyping={isTyping}
  onSend={sendMessage}
  onRetry={retryMessage}
/>
```

## Required Final Report

After integration, create:

`docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md`
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

function Get-ValidationTargets {
    param([string]$Root)

    $Targets = @()

    $CandidateDirs = @(
        ".",
        "apps\web-user",
        "apps\web",
        "apps\web-admin",
        "apps\gateway-api"
    )

    foreach ($Candidate in $CandidateDirs) {
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

# Resolve repo root
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
    $RunDir = Join-Path $RepoRoot ".apex\whatsapp-chat-fullmode\$RunId"
} else {
    $RunDir = Join-Path $env:TEMP "apex-whatsapp-chat-fullmode-$RunId"
}

$BackupDir = Join-Path $RunDir "backups"
$LogPath = Join-Path $RunDir "execution.log"
$script:BackupDir = $BackupDir
$script:LogPath = $LogPath

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Set-Content -LiteralPath $LogPath -Value "APEX WhatsApp Chat Full Mode V2`r`nRunId: $RunId`r`nRepoRoot: $RepoRoot`r`n" -Encoding utf8

$ReportPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_FULLMODE_REPORT.md"
$ClaudeTaskPath = Join-Path $RunDir "APEX_WHATSAPP_CHAT_FULLMODE_NEXT_CLAUDE_TASK.md"
$InventoryPath = Join-Path $RunDir "ACTIVE_CHAT_FILE_INVENTORY_FILTERED.md"

Write-Step "APEX WhatsApp Chat Full Mode V2 started"
Write-Step "RepoRoot: $RepoRoot"
Write-Step "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"
Write-Step "PatchFrontend default/effective: $PatchFrontend"
Write-Step "RunValidation default/effective: $RunValidation"

# Self-install
try {
    $SelfPath = $PSCommandPath
    $Downloads = Join-Path $env:USERPROFILE "Downloads"
    if (-not $SkipSelfInstall -and $SelfPath -and $SelfPath.StartsWith($Downloads, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ScriptDir = Join-Path $RepoRoot "scripts\apex"
        $DestScript = Join-Path $ScriptDir "APEX-WhatsApp-Chat-FullMode-V2.ps1"
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

$ResolvedFrontendRoot = Resolve-FrontendRoot -Root $RepoRoot -ExplicitFrontendRoot $FrontendRoot
if ([string]::IsNullOrWhiteSpace($ResolvedFrontendRoot)) {
    Write-WarnLine "No frontend root detected. Use -FrontendRoot to specify one."
} else {
    Write-Step "Resolved frontend root: $ResolvedFrontendRoot"
}

# Active scan
Write-Step "Scanning active repository files"
$RepoFiles = Get-ActiveRepoFiles -Root $RepoRoot
$Keywords = @("chat", "conversation", "message", "messages", "support", "assistant", "thread", "whatsapp")
$ChatHits = @()
$LikelyFrontendChatFiles = @()

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

        if ($Relative -like "apps\web-user\src\*" -or $Relative -like "apps\web\src\*" -or $Relative -like "apps\web-admin\src\*") {
            $LikelyFrontendChatFiles += $Hit
        }
    }
}

$ChatHits = $ChatHits | Sort-Object RelativePath -Unique
$LikelyFrontendChatFiles = $LikelyFrontendChatFiles | Sort-Object RelativePath -Unique

Write-Step "Active files scanned: $(@($RepoFiles).Count)"
Write-Step "Active chat-related hits: $(@($ChatHits).Count)"
Write-Step "Likely frontend chat files: $(@($LikelyFrontendChatFiles).Count)"

$ActiveRows = @()
if (@($LikelyFrontendChatFiles).Count -gt 0) {
    foreach ($H in ($LikelyFrontendChatFiles | Select-Object -First 125)) {
        $ActiveRows += "| ``$($H.RelativePath)`` | $($H.Reason) | $($H.SizeBytes) |"
    }
} else {
    $ActiveRows += "| _None found_ | - | - |"
}
$ActiveTable = $ActiveRows -join "`r`n"

$Inventory = @"
# Active Chat File Inventory — Full Mode V2

Run ID: $RunId
Repo Root: ``$RepoRoot``
Resolved Frontend Root: ``$(if ($ResolvedFrontendRoot) { $ResolvedFrontendRoot } else { "NOT DETECTED" })``

## Summary

| Metric | Value |
|---|---:|
| Active files scanned | $(@($RepoFiles).Count) |
| Active chat-related hits | $(@($ChatHits).Count) |
| Likely frontend chat files | $(@($LikelyFrontendChatFiles).Count) |

## Likely Frontend Chat Files

| File | Reason | Size |
|---|---:|---:|
$ActiveTable
"@

Write-Utf8File -Path $InventoryPath -Content $Inventory

# Patch scaffold
$CreatedScaffold = @()
if ($PatchFrontend) {
    if (-not [string]::IsNullOrWhiteSpace($ResolvedFrontendRoot)) {
        Write-Step "PatchFrontend effective=true. Creating reusable WhatsApp scaffold."
        $CreatedScaffold = New-WhatsAppFrontendScaffold -TargetFrontendRoot $ResolvedFrontendRoot
    } else {
        Write-WarnLine "PatchFrontend effective=true, but no frontend root was found."
    }
} else {
    Write-Step "PatchFrontend effective=false. No scaffold created."
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

# Claude task
$ClaudeTask = @"
# Claude/Copilot Task — Integrate WhatsApp Chat Scaffold

Repo:

    $RepoRoot

Resolved frontend root:

    $(if ($ResolvedFrontendRoot) { $ResolvedFrontendRoot } else { "NOT DETECTED" })

Scaffold files:

| File |
|---|
$ScaffoldTable

## Mission

Integrate the generated WhatsApp-style chat shell into the real active chat screens.

## Primary active targets

Start with these files first:

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

- Do not work from archive, backup, .venv, or generated files.
- Preserve existing API calls, auth, roles, and admin flows.
- Do not blindly replace the entire screen.
- Use the scaffold as the shared chat behavior layer.
- Keep existing message data and map it into the scaffold contract.
- Add fallback status mapping to sent.
- Use per-message Arabic RTL direction.
- Keep composer mobile-safe using 100dvh, min-height:0 scroll area, and safe-area padding.
- Implement loading, failed, retry, and typing states where the existing screen supports them.

## Required final report

Create:

    docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md

The report must include:

- files inspected
- files modified
- scaffold files used
- behavior implemented
- validation commands run
- pass/fail evidence
- remaining risks
- manual QA checklist
"@

Write-Utf8File -Path $ClaudeTaskPath -Content $ClaudeTask

# Validation
$ValidationResults = @()
if ($RunValidation) {
    Write-Step "RunValidation effective=true. Discovering package.json targets."
    $Targets = Get-ValidationTargets -Root $RepoRoot

    foreach ($Target in $Targets) {
        $ScriptsToRun = @("typecheck", "lint", "build", "test")
        foreach ($ScriptName in $ScriptsToRun) {
            if (Test-NpmScript -PackageJson $Target.PackageJson -ScriptName $ScriptName) {
                $ValidationResults += (Invoke-ValidationCommand -Name "$($Target.Name)-$ScriptName" -Command "npm run $ScriptName" -WorkingDirectory $Target.Dir -OutputDir $RunDir)
            }
        }
    }

    if (@($ValidationResults).Count -eq 0) {
        Write-WarnLine "No recognized validation scripts found in discovered package.json files."
    }
} else {
    Write-Step "RunValidation effective=false. Validation skipped."
}

$ValidationRows = @()
if (@($ValidationResults).Count -gt 0) {
    foreach ($V in $ValidationResults) {
        $ValidationRows += "| $($V.Name) | ``$($V.Command)`` | ``$($V.Workdir)`` | $($V.ExitCode) | $($V.Skipped) | ``$($V.OutputPath)`` |"
    }
} else {
    $ValidationRows += "| _No validation commands executed_ | - | - | - | - | - |"
}
$ValidationTable = $ValidationRows -join "`r`n"

$Duration = New-TimeSpan -Start $Started -End (Get-Date)

$Report = @"
# APEX WhatsApp Chat Full Mode V2 Report

## Status

$(if ($Apply) { "APPLY mode completed." } else { "DRY-RUN completed." })

## Metadata

| Field | Value |
|---|---|
| Run ID | $RunId |
| Repo Root | ``$RepoRoot`` |
| Resolved Frontend Root | ``$(if ($ResolvedFrontendRoot) { $ResolvedFrontendRoot } else { "NOT DETECTED" })`` |
| Apply | $Apply |
| PatchFrontend effective | $PatchFrontend |
| RunValidation effective | $RunValidation |
| Started | $($Started.ToString("yyyy-MM-dd HH:mm:ss")) |
| Duration | $($Duration.ToString()) |
| Encoding | UTF-8 forced / code page 65001 attempted |

## Generated Files

| File | Purpose |
|---|---|
| ``$InventoryPath`` | Filtered active chat inventory |
| ``$ClaudeTaskPath`` | Next Claude/Copilot integration task |
| ``$LogPath`` | Execution log |

## Scaffold Files

| File |
|---|
$ScaffoldTable

## Active Frontend Chat Files

| File | Reason | Size |
|---|---:|---:|
$ActiveTable

## Validation

| Step | Command | Workdir | Exit Code | Skipped | Output |
|---|---|---|---:|---:|---|
$ValidationTable

## Next Step

Open this file in Claude/Copilot:

    $ClaudeTaskPath

Then require the final implementation report:

    docs/APEX_WHATSAPP_CHAT_BEHAVIOR_IMPLEMENTATION_REPORT.md

## Why this V2 exists

The previous uploaded report showed PatchFrontend=False and RunValidation=False even though Full Mode was intended. This version defaults both behaviors to true and prioritizes apps\web-user\src as the active frontend root.
"@

Write-Utf8File -Path $ReportPath -Content $Report

Write-Step "Full Mode report created: $ReportPath"

if (-not $NoOpenReport) {
    try {
        Invoke-Item -LiteralPath $ReportPath
        Write-Step "Report launched."
    } catch {
        Write-WarnLine "Could not launch report automatically: $($_.Exception.Message)"
    }
}

Write-Step "APEX WhatsApp Chat Full Mode V2 finished."
Write-Host ""
Write-Host "DONE"
Write-Host "Report: $ReportPath"
