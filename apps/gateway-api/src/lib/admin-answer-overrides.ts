export type AdminAnswerOverride = {
  id: string;
  topic: string;
  answerAr: string;
  active: boolean;
  updatedAt: string;
  updatedBy?: string;
};

export function findActiveAnswerOverride(topic: string, overrides: AdminAnswerOverride[] = []) {
  const normalized = topic.trim().toLowerCase();
  return overrides.find((item) => item.active && item.topic.trim().toLowerCase() === normalized) ?? null;
}