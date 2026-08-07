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
