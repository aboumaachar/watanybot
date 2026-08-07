import type { SeasonalAppleJobApplicationInput } from './seasonalAppleJob.types';

function yes(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim().toLowerCase();
  return ['yes', 'true', '1', 'نعم', 'اي', 'إي'].includes(text);
}

export function calculateSeasonalAppleJobScore(input: SeasonalAppleJobApplicationInput): number {
  let score = 0;

  // First-come-first-served is handled by createdAt ordering.
  // A base 30 points is kept so score remains comparable in the dashboard.
  score += 30;

  if (input.caza === 'جبيل' || input.caza === 'البترون') score += 25;

  if (
    input.availability === 'أسبوع واحد' ||
    input.availability === 'أسبوعان' ||
    input.availability === 'كامل الموسم'
  ) {
    score += 20;
  }

  if (yes(input.canArrive6am)) score += 15;
  if (yes(input.hasAgriExperience)) score += 10;

  return score;
}