import { randomUUID } from "node:crypto";
import { readStore, writeStore } from "./store.js";
import type {
  AdminPaymentsDashboard,
  Announcement,
  PaymentAnswer,
  PaymentFaqOverride,
  PaymentQuestion,
  ResolvedPaymentAnswer,
} from "./types.js";

const NOW = () => new Date().toISOString();
const OVERRIDE_SCORE_THRESHOLD = 0.45;

const STOP_WORDS = new Set([
  "ال",
  "الى",
  "إلى",
  "في",
  "عن",
  "من",
  "على",
  "هل",
  "ما",
  "متى",
  "شو",
  "كيف",
  "اذا",
  "إذا",
  "تم",
  "بعد",
  "قبل",
]);

function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function normalizeText(value: string): string {
  return value
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function effectiveSortTs(answer: PaymentAnswer): number {
  return parseTimestamp(answer.activateAt) ?? parseTimestamp(answer.createdAt) ?? 0;
}

function isAnswerEffective(answer: PaymentAnswer, nowMs: number): boolean {
  if (!answer.isActive) return false;

  const activateMs = parseTimestamp(answer.activateAt);
  const expiresMs = parseTimestamp(answer.expiresAt);

  if (activateMs !== null && activateMs > nowMs) return false;
  if (expiresMs !== null && expiresMs <= nowMs) return false;
  return true;
}

function isAnswerScheduled(answer: PaymentAnswer, nowMs: number): boolean {
  if (!answer.isActive) return false;
  const activateMs = parseTimestamp(answer.activateAt);
  return activateMs !== null && activateMs > nowMs;
}

function compareAnswers(left: PaymentAnswer, right: PaymentAnswer): number {
  return effectiveSortTs(right) - effectiveSortTs(left) || right.createdAt.localeCompare(left.createdAt);
}

function getEnabledAnnouncements(): Announcement[] {
  return readStore().announcements.filter((announcement) => announcement.enabled);
}

function getCurrentAnswers(answers: PaymentAnswer[], nowMs: number): PaymentAnswer[] {
  const byQuestion = new Map<string, PaymentAnswer[]>();

  for (const answer of answers) {
    if (!isAnswerEffective(answer, nowMs)) continue;
    const current = byQuestion.get(answer.questionId);
    if (current) {
      current.push(answer);
    } else {
      byQuestion.set(answer.questionId, [answer]);
    }
  }

  return Array.from(byQuestion.values())
    .map((entries) => {
      const sortedEntries = [...entries].sort(compareAnswers);
      return sortedEntries[0];
    })
    .filter((entry): entry is PaymentAnswer => Boolean(entry))
    .sort(compareAnswers);
}

function resolveSchedule(activateAt: string | null = null, expiresAt: string | null = null): { activateAt: string | null; expiresAt: string | null } {
  const activateMs = parseTimestamp(activateAt);
  const expiresMs = parseTimestamp(expiresAt);

  if (activateAt && activateMs === null) {
    throw new Error("invalid_activate_at");
  }
  if (expiresAt && expiresMs === null) {
    throw new Error("invalid_expires_at");
  }
  if (activateMs !== null && expiresMs !== null && expiresMs <= activateMs) {
    throw new Error("invalid_schedule_window");
  }

  return { activateAt, expiresAt };
}

function matchScore(query: string, question: PaymentQuestion): number {
  const queryNorm = normalizeText(query);
  const questionNorm = normalizeText(question.text);
  if (!queryNorm || !questionNorm) return 0;
  if (queryNorm === questionNorm) return 1;

  let score = 0;
  if (queryNorm.includes(questionNorm) || questionNorm.includes(queryNorm)) {
    score = Math.max(score, 0.82);
  }

  const queryTokens = tokenize(query);
  const questionTokens = tokenize(question.text);
  if (queryTokens.length > 0 && questionTokens.length > 0) {
    const questionSet = new Set(questionTokens);
    const sharedTokens = queryTokens.filter((token) => questionSet.has(token));
    const overlap = sharedTokens.length / Math.max(queryTokens.length, questionTokens.length);
    score = Math.max(score, overlap);
  }

  const normalizedTags = question.tags.map((tag) => normalizeText(tag)).filter(Boolean);
  const tagHits = normalizedTags.filter((tag) => queryNorm.includes(tag));
  if (tagHits.length > 0) {
    const tagScore = 0.45 + (tagHits.length / normalizedTags.length) * 0.35;
    score = Math.max(score, Math.min(tagScore, 0.9));
  }

  return score;
}

export function createQuestion(text: string, tags: string[]): PaymentQuestion {
  const store = readStore();
  const timestamp = NOW();

  const question: PaymentQuestion = {
    id: randomUUID(),
    text: text.trim(),
    tags: normalizeTags(tags),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.questions.push(question);
  writeStore(store);

  return question;
}

export function listQuestions(): PaymentQuestion[] {
  return readStore().questions;
}

export function updateQuestion(id: string, patch: { text?: string; tags?: string[] }): PaymentQuestion | null {
  const store = readStore();
  const question = store.questions.find((entry) => entry.id === id);
  if (!question) {
    return null;
  }

  if (patch.text !== undefined) {
    question.text = patch.text.trim();
  }
  if (patch.tags !== undefined) {
    question.tags = normalizeTags(patch.tags);
  }
  question.updatedAt = NOW();
  writeStore(store);

  return question;
}

export function deleteQuestion(id: string): boolean {
  const store = readStore();
  const nextQuestions = store.questions.filter((entry) => entry.id !== id);
  if (nextQuestions.length === store.questions.length) {
    return false;
  }

  store.questions = nextQuestions;
  store.answers = store.answers.filter((entry) => entry.questionId !== id);
  writeStore(store);
  return true;
}

export function createAnswer(
  questionId: string,
  value: string,
  adminId: string,
  options?: { activateAt?: string | null; expiresAt?: string | null },
): PaymentAnswer {
  const store = readStore();
  const question = store.questions.find((entry) => entry.id === questionId);
  if (!question) {
    throw new Error("question_not_found");
  }

  const schedule = resolveSchedule(options?.activateAt, options?.expiresAt);
  const nowMs = Date.now();
  const activateMs = parseTimestamp(schedule.activateAt);
  const activatesInFuture = activateMs !== null && activateMs > nowMs;

  if (!activatesInFuture) {
    store.answers.forEach((answer) => {
      if (answer.questionId === questionId) {
        answer.isActive = false;
      }
    });
  }

  const answer: PaymentAnswer = {
    id: randomUUID(),
    questionId,
    value: value.trim(),
    isActive: true,
    activateAt: schedule.activateAt,
    expiresAt: schedule.expiresAt,
    createdAt: NOW(),
    createdBy: adminId,
  };

  store.answers.push(answer);
  writeStore(store);

  return answer;
}

export function listAnswers(options?: { questionId?: string; activeOnly?: boolean; scheduledOnly?: boolean }): PaymentAnswer[] {
  const store = readStore();
  const nowMs = Date.now();
  return store.answers.filter((answer) => {
    if (options?.questionId && answer.questionId !== options.questionId) return false;
    if (options?.activeOnly && !isAnswerEffective(answer, nowMs)) return false;
    if (options?.scheduledOnly && !isAnswerScheduled(answer, nowMs)) return false;
    return true;
  }).sort(compareAnswers);
}

export function updateAnswer(
  id: string,
  patch: { questionId?: string; value?: string; activateAt?: string | null; expiresAt?: string | null },
): PaymentAnswer | null {
  const store = readStore();
  const answer = store.answers.find((entry) => entry.id === id);
  if (!answer) {
    return null;
  }

  const targetQuestionId = patch.questionId ?? answer.questionId;
  const question = store.questions.find((entry) => entry.id === targetQuestionId);
  if (!question) {
    throw new Error("question_not_found");
  }

  const schedule = resolveSchedule(
    patch.activateAt ?? answer.activateAt,
    patch.expiresAt ?? answer.expiresAt,
  );

  answer.questionId = targetQuestionId;
  if (patch.value !== undefined) {
    answer.value = patch.value.trim();
  }
  answer.activateAt = schedule.activateAt;
  answer.expiresAt = schedule.expiresAt;

  const nowMs = Date.now();
  const activateMs = parseTimestamp(answer.activateAt);
  const activatesInFuture = activateMs !== null && activateMs > nowMs;

  if (!activatesInFuture && answer.isActive) {
    store.answers.forEach((entry) => {
      if (entry.id !== answer.id && entry.questionId === answer.questionId) {
        entry.isActive = false;
      }
    });
  }

  writeStore(store);
  return answer;
}

export function deleteAnswer(id: string): boolean {
  const store = readStore();
  const nextAnswers = store.answers.filter((entry) => entry.id !== id);
  if (nextAnswers.length === store.answers.length) {
    return false;
  }

  store.answers = nextAnswers;
  writeStore(store);
  return true;
}

export function createAnnouncement(text: string): Announcement {
  const store = readStore();
  const announcement: Announcement = {
    id: randomUUID(),
    text: text.trim(),
    enabled: true,
    createdAt: NOW(),
  };

  store.announcements.unshift(announcement);
  writeStore(store);
  return announcement;
}

export function listAnnouncements(options?: { enabledOnly?: boolean }): Announcement[] {
  return readStore().announcements.filter((announcement) => {
    if (options?.enabledOnly && !announcement.enabled) return false;
    return true;
  });
}

export function toggleAnnouncement(id: string, enabled: boolean): Announcement | null {
  const store = readStore();
  const announcement = store.announcements.find((entry) => entry.id === id);
  if (!announcement) {
    return null;
  }

  announcement.enabled = enabled;
  writeStore(store);
  return announcement;
}

export function getDashboard(): AdminPaymentsDashboard {
  const store = readStore();
  const nowMs = Date.now();

  const activeAnswers = getCurrentAnswers(store.answers, nowMs);
  const scheduledAnswers = store.answers.filter((answer) => isAnswerScheduled(answer, nowMs)).sort(compareAnswers);
  const answers = [...store.answers].sort(compareAnswers);
  const activeAnnouncements = getEnabledAnnouncements();

  return {
    questions: store.questions,
    activeAnswers,
    scheduledAnswers,
    answers,
    announcements: store.announcements,
    activeAnnouncements,
  };
}

export function getActiveAnswer(questionId: string): PaymentAnswer | null {
  const nowMs = Date.now();
  const answers = readStore().answers
    .filter((answer) => answer.questionId === questionId && isAnswerEffective(answer, nowMs))
    .sort(compareAnswers);
  return answers[0] || null;
}

export function resolvePaymentAnswer(query: string): ResolvedPaymentAnswer | null {
  const store = readStore();
  const nowMs = Date.now();
  const currentAnswers = getCurrentAnswers(store.answers, nowMs);

  let bestMatch: { question: PaymentQuestion; answer: PaymentAnswer; score: number } | null = null;

  for (const question of store.questions) {
    const answer = currentAnswers.find((entry) => entry.questionId === question.id);
    if (!answer) continue;

    const score = matchScore(query, question);
    if (score < OVERRIDE_SCORE_THRESHOLD) continue;

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { question, answer, score };
    }
  }

  if (!bestMatch) return null;

  return {
    question: bestMatch.question,
    answer: bestMatch.answer,
    announcements: getEnabledAnnouncements(),
    score: bestMatch.score,
  };
}

export function listPaymentFaqOverrides(): PaymentFaqOverride[] {
  const dashboard = getDashboard();
  const questionById = new Map(dashboard.questions.map((question) => [question.id, question]));

  return dashboard.activeAnswers
    .map((answer) => {
      const question = questionById.get(answer.questionId);
      if (!question) return null;

      return {
        id: answer.id,
        questionId: question.id,
        question: question.text,
        answer: answer.value,
        tags: question.tags,
      };
    })
    .filter((entry): entry is PaymentFaqOverride => entry !== null);
}