import { getDefaultApiBaseUrl } from "./api-base";

const API = getDefaultApiBaseUrl();

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type ReviewTargetType = "job_employer" | "market_listing";

export type ReviewRecord = {
  id: string;
  targetType: ReviewTargetType;
  targetId: string;
  userId?: string;
  score: number;
  note?: string;
  createdAt: string;
};

export async function listReviews(targetType: ReviewTargetType, targetId?: string) {
  const params = new URLSearchParams({ targetType });
  if (targetId) params.set("targetId", targetId);
  return apiFetch<{ ok: boolean; reviews: ReviewRecord[] }>(`/api/reviews?${params.toString()}`);
}

export async function createReview(input: { targetType: ReviewTargetType; targetId: string; score: number; note?: string; userId?: string }) {
  return apiFetch<{ ok: boolean; review: ReviewRecord }>("/api/reviews", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
