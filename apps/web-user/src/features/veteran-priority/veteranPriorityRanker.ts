import {
  nonVeteranPriorityServiceTerms,
  veteranPriorityCoreCategories,
  veteranPrioritySignals,
  veteranPrioritySourceWeights,
  type VeteranPriorityCategory,
} from './veteranPriorityTaxonomy';

export type VeteranPriorityRecord = Record<string, unknown> & {
  readonly id?: string | number;
  readonly sourceId?: string;
  readonly sourceType?: string;
  readonly sourceTitle?: string;
  readonly title?: string;
  readonly body?: string;
  readonly summary?: string;
  readonly text?: string;
  readonly tags?: readonly string[];
  readonly date?: string;
};

export type VeteranPriorityScore = {
  readonly total: number;
  readonly signalScore: number;
  readonly sourceScore: number;
  readonly queryScore: number;
  readonly matchedCategories: readonly VeteranPriorityCategory[];
  readonly matchedTerms: readonly string[];
  readonly ignoredNeutralServiceTerms: readonly string[];
  readonly isVeteranPriority: boolean;
  readonly explanation: string;
};

export type VeteranPriorityScoredItem<T extends VeteranPriorityRecord = VeteranPriorityRecord> = {
  readonly item: T;
  readonly score: VeteranPriorityScore;
  readonly originalIndex: number;
};

const arabicDiacritics = /[\u064B-\u065F\u0670]/g;

function toSafeString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

function normalizeText(value: unknown): string {
  const normalized = toSafeString(value)
    .normalize('NFKC')
    .replace(arabicDiacritics, '')
    .replace(/[إأآا]/g, 'ا')
    .toLowerCase();

  return normalized.split('ى').join('ي').split('ة').join('ه');
}

// escapeRegExp removed (unused)

function includesNormalizedTerm(haystack: string, normalizedTerm: string): boolean {
  if (!normalizedTerm) {
    return false;
  }
  // Ignore extremely short normalized terms to avoid high false-positive rates
  if (normalizedTerm.length <= 2) {
    return false;
  }

  // For longer terms, match as substring. Tokenization rules are intentionally
  // simplified here because Arabic token boundaries can be noisy in small samples.
  return haystack.includes(normalizedTerm);
}

function collectRecordText(record: VeteranPriorityRecord): string {
  return [
    record.title,
    record.sourceTitle,
    record.summary,
    record.body,
    record.text,
    Array.isArray(record.tags) ? record.tags.join(' ') : '',
  ].map(normalizeText).join(' ');
}

function uniqueValues(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasCoreCategory(categories: readonly VeteranPriorityCategory[]): boolean {
  return categories.some((category) => veteranPriorityCoreCategories.includes(category));
}

export function scoreVeteranPriorityRecord(record: VeteranPriorityRecord, query = ''): VeteranPriorityScore {
  const recordText = collectRecordText(record);
  const queryText = normalizeText(query);
  const matchedCategories: VeteranPriorityCategory[] = [];
  const matchedTerms: string[] = [];
  let signalScore = 0;
  let queryScore = 0;

  for (const signal of veteranPrioritySignals) {
    const normalizedTerms = signal.terms.map(normalizeText);
    const matched = normalizedTerms.filter((term) => includesNormalizedTerm(recordText, term));
    if (matched.length === 0) {
      continue;
    }

    const queryMatched = normalizedTerms.some((term) => includesNormalizedTerm(queryText, term));
    const contextualOnly = Boolean(signal.isContextual);
    const shouldCountSignal = contextualOnly ? queryMatched || hasCoreCategory(matchedCategories) : true;

    if (shouldCountSignal) {
      matchedCategories.push(signal.category);
      matchedTerms.push(...signal.terms.filter((term) => includesNormalizedTerm(recordText, normalizeText(term))));
      signalScore += signal.weight + Math.min(matched.length * 6, 24);
      if (queryMatched) {
        queryScore += Math.round(signal.weight * 0.28);
      }
    }
  }

  const coreMatched = hasCoreCategory(matchedCategories);
  const sourceKey = normalizeText(record.sourceType || 'generic');
  const sourceScore = coreMatched ? veteranPrioritySourceWeights[sourceKey] ?? 0 : 0;
  const ignoredNeutralServiceTerms = nonVeteranPriorityServiceTerms.filter((term) => includesNormalizedTerm(recordText, normalizeText(term)));
  const total = signalScore + sourceScore + queryScore;
  const cleanCategories = Array.from(new Set(matchedCategories.filter(Boolean)));
  const cleanTerms = uniqueValues(matchedTerms);
  const isVeteranPriority = coreMatched && total > 0;

  let explanation = 'No veteran-priority signal matched; result remains below veteran-related records.';
  if (isVeteranPriority) {
    explanation = `Veteran-priority ranking matched ${cleanCategories.join(', ')} using ${cleanTerms.slice(0, 12).join(', ')}.`;
  } else if (ignoredNeutralServiceTerms.length > 0) {
    explanation = 'Neutral service terms such as تعقيب معاملات were detected, but they do not create a veteran-priority boost without veteran/family/benefit signals.';
  }

  return {
    total,
    signalScore,
    sourceScore,
    queryScore,
    matchedCategories: cleanCategories,
    matchedTerms: cleanTerms,
    ignoredNeutralServiceTerms,
    isVeteranPriority,
    explanation,
  };
}

export function rankVeteranPriorityItems<T extends VeteranPriorityRecord>(items: readonly T[], query = ''): VeteranPriorityScoredItem<T>[] {
  return items
    .map((item, originalIndex) => ({ item, originalIndex, score: scoreVeteranPriorityRecord(item, query) }))
    .sort((left, right) => {
      if (right.score.total !== left.score.total) {
        return right.score.total - left.score.total;
      }
      if (Number(right.score.isVeteranPriority) !== Number(left.score.isVeteranPriority)) {
        return Number(right.score.isVeteranPriority) - Number(left.score.isVeteranPriority);
      }
      return left.originalIndex - right.originalIndex;
    });
}

export function summarizeVeteranPriorityRanking(items: readonly VeteranPriorityScoredItem[]): string {
  const priorityCount = items.filter((entry) => entry.score.isVeteranPriority).length;
  return `${priorityCount} veteran-priority records ranked ahead of generic records out of ${items.length} total records.`;
}