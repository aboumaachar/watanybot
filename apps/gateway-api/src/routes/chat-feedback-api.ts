import { promises as fs } from "fs";
import path from "path";

type FeedbackValue = "useful" | "not_useful";

type ChatFeedbackPayload = {
  messageId?: string;
  value?: FeedbackValue;
  note?: string;
  source?: string;
};

function isValidFeedbackValue(value: unknown): value is FeedbackValue {
  return value === "useful" || value === "not_useful";
}

async function appendFeedback(payload: Required<Pick<ChatFeedbackPayload, "messageId" | "value">> & Partial<ChatFeedbackPayload>) {
  const dataDir = path.resolve(process.cwd(), "data");
  await fs.mkdir(dataDir, { recursive: true });
  const line = JSON.stringify({
    ...payload,
    feature: "ai_chatbot_core",
    createdAt: new Date().toISOString(),
  });
  await fs.appendFile(path.join(dataDir, "chat-feedback.jsonl"), line + "\n", "utf8");
}

export async function handleChatFeedbackBody(body: ChatFeedbackPayload) {
  const messageId = typeof body.messageId === "string" && body.messageId.trim() ? body.messageId.trim() : "";

  if (!messageId) {
    return { ok: false, status: 400, error: "messageId is required" };
  }

  if (!isValidFeedbackValue(body.value)) {
    return { ok: false, status: 400, error: "value must be useful or not_useful" };
  }

  await appendFeedback({
    messageId,
    value: body.value,
    note: typeof body.note === "string" ? body.note.slice(0, 500) : undefined,
    source: typeof body.source === "string" ? body.source.slice(0, 100) : "web-user",
  });

  return { ok: true, status: 200 };
}