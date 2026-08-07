import fs from 'node:fs';
import path from 'node:path';

export type PaymentOverrideRecord = {
  id: string;
  enabled: boolean;
  topic: string;
  matchPhrases: string[];
  answerEn: string;
  answerAr: string;
  source: string;
  priority: number;
};

export type PaymentOverrideMatch = {
  matched: boolean;
  override?: PaymentOverrideRecord;
  answer?: string;
};

function getOverridePath(): string {
  return path.resolve(process.cwd(), 'data/payment-intelligence/payment-overrides.json');
}

export function loadPaymentOverrides(): PaymentOverrideRecord[] {
  const filePath = getOverridePath();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as { overrides?: PaymentOverrideRecord[] };
  return Array.isArray(parsed.overrides) ? parsed.overrides : [];
}

export function findPaymentOverrideAnswer(query: string, locale: 'ar' | 'en' = 'ar'): PaymentOverrideMatch {
  const normalized = String(query || '').toLowerCase();
  const candidates = loadPaymentOverrides()
    .filter((entry) => entry && entry.enabled)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

  for (const entry of candidates) {
    const phrases = Array.isArray(entry.matchPhrases) ? entry.matchPhrases : [];
    const matched = phrases.some((phrase) => normalized.includes(String(phrase || '').toLowerCase()));
    if (matched) {
      return {
        matched: true,
        override: entry,
        answer: locale === 'en' ? entry.answerEn : entry.answerAr,
      };
    }
  }

  return { matched: false };
}