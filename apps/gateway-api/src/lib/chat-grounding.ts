export type ChatGroundingSource = {
  id: string;
  title: string;
  url?: string;
  excerpt?: string;
};

export type ChatGroundingAssessment = {
  grounded: boolean;
  confidence: "low" | "medium" | "high";
  sources: ChatGroundingSource[];
  warnings: string[];
};

export function assessChatGrounding(answerText: string, sources: ChatGroundingSource[] = []): ChatGroundingAssessment {
  const trimmed = (answerText || "").trim();
  const warnings: string[] = [];

  if (trimmed.length === 0) warnings.push("EMPTY_ANSWER");
  if (sources.length === 0) warnings.push("NO_SOURCES_ATTACHED");

  return {
    grounded: sources.length > 0 && trimmed.length > 0,
    confidence: sources.length >= 2 ? "high" : sources.length === 1 ? "medium" : "low",
    sources,
    warnings,
  };
}