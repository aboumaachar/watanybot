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
