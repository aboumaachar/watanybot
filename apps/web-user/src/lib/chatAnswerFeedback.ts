export type ChatAnswerFeedbackValue = "useful" | "not_useful";

export type ChatAnswerFeedbackPayload = {
  messageId: string;
  value: ChatAnswerFeedbackValue;
  note?: string;
};

export async function submitChatAnswerFeedback(payload: ChatAnswerFeedbackPayload) {
  const response = await fetch("/api/chat/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Feedback request failed with status ${response.status}`);
  }

  return response.json().catch(() => ({}));
}