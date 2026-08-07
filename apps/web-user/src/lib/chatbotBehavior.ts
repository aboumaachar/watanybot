export type ChatbotBehaviorPreview = {
  behavior: {
    shouldStartWithGreeting: boolean;
    greetingAr: string;
    tone: "LEBANESE_SLANG" | "FORMAL_ARABIC" | "MIXED";
    systemInstruction: string;
  };
  tags: Array<{ tagId: string; labelAr: string; score: number; kbScopes: string[] }>;
  kbScopes: string[];
  answerPreview: string;
};

export async function previewWatanyChatbotBehavior(message: string, sampleAnswer?: string): Promise<ChatbotBehaviorPreview> {
  const response = await fetch("/api/chatbot/behavior/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ message, sampleAnswer })
  });

  if (!response.ok) {
    throw new Error(`CHATBOT_BEHAVIOR_PREVIEW_FAILED_${response.status}`);
  }

  return response.json();
}