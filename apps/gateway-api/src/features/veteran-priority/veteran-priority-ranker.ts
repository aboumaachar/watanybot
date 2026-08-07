export type VeteranPriorityCategory =
  | 'retiredMilitary'
  | 'veteran'
  | 'martyrFamily'
  | 'disabledOrHandicapped'
  | 'familyDependent'
  | 'pensionSalary'
  | 'compensation'
  | 'healthcare'
  | 'educationSchools'
  | 'nationalDefenseLaw';

export type VeteranPriorityRecord = Record<string, unknown> & {
  id?: string | number;
  sourceType?: string;
  sourceTitle?: string;
  title?: string;
  body?: string;
  summary?: string;
  text?: string;
  tags?: string[];
};

const neutralServiceTerms = ['تعقيب معاملات', 'معقب معاملات', 'مكتب تعقيب', 'تخليص معاملات'];
const coreCategories = new Set<VeteranPriorityCategory>(['retiredMilitary', 'veteran', 'martyrFamily', 'disabledOrHandicapped', 'familyDependent', 'pensionSalary', 'compensation', 'healthcare', 'educationSchools']);

const signals: Array<{ category: VeteranPriorityCategory; weight: number; contextual?: boolean; terms: string[] }> = [
  { category: 'retiredMilitary', weight: 160, terms: ['العسكريين المتقاعدين', 'العسكري المتقاعد', 'عسكري متقاعد', 'الضباط المتقاعدين', 'الرتباء المتقاعدين', 'retired military'] },
  { category: 'veteran', weight: 155, terms: ['قدامى المحاربين', 'محارب قديم', 'veteran', 'veterans'] },
  { category: 'martyrFamily', weight: 150, terms: ['الشهداء وذويهم', 'الشهداء', 'ذوي الشهداء', 'عائلات الشهداء', 'أبناء الشهداء', 'families of martyrs'] },
  { category: 'disabledOrHandicapped', weight: 145, terms: ['ذوي الإعاقة', 'ذوو الإعاقة', 'المعوقين', 'معوق', 'عجز', 'إصابة حربية', 'disabled', 'handicapped'] },
  { category: 'familyDependent', weight: 140, terms: ['العائلة', 'على العاتق', 'ذوو الحقوق', 'ذوي الحقوق', 'الابن', 'الابنة', 'الزوج', 'الزوجة', 'الوالد', 'الوالدة', 'الأرملة', 'الورثة', 'family', 'dependent', 'spouse', 'son', 'daughter', 'father', 'mother'] },
  { category: 'pensionSalary', weight: 120, terms: ['الراتب', 'راتب', 'التقاعد', 'تقاعد', 'راتب تقاعدي', 'معاش', 'pension', 'salary'] },
  { category: 'compensation', weight: 115, terms: ['التعويضات', 'تعويضات', 'تعويض', 'بدل', 'مساعدة', 'compensation', 'allowance'] },
  { category: 'healthcare', weight: 105, terms: ['الطبابة', 'طبابة', 'استشفاء', 'دواء', 'مستشفى', 'healthcare', 'medical'] },
  { category: 'educationSchools', weight: 95, terms: ['المدارس والمنح', 'مدارس', 'مدرسة', 'منح مدرسية', 'تعليم', 'school', 'scholarship'] },
  { category: 'nationalDefenseLaw', weight: 80, contextual: true, terms: ['قانون الدفاع الوطني', 'الدفاع الوطني', 'قانون عسكري', 'national defense law'] },
];

const sourceWeights: Record<string, number> = { laws: 34, law: 34, legal: 34, directive: 32, kb: 30, database: 24, procedure: 22, document: 16, listing: 12, generic: 0 };

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
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .toLowerCase();

  return normalized.split('ى').join('ي').split('ة').join('ه');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function includesNormalizedTerm(haystack: string, normalizedTerm: string): boolean {
  if (!normalizedTerm) {
    return false;
  }

  if (normalizedTerm.length <= 2) {
    const tokenPattern = new RegExp(String.raw`(^|[^\p{L}\p{N}])${escapeRegExp(normalizedTerm)}([^\p{L}\p{N}]|$)`, 'u');
    return tokenPattern.test(haystack);
  }

  return haystack.includes(normalizedTerm);
}

function recordText(record: VeteranPriorityRecord): string {
  return [record.title, record.sourceTitle, record.summary, record.body, record.text, Array.isArray(record.tags) ? record.tags.join(' ') : ''].map(normalizeText).join(' ');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasCore(categories: readonly VeteranPriorityCategory[]): boolean {
  return categories.some((category) => coreCategories.has(category));
}

export function scoreVeteranPriorityRecord(record: VeteranPriorityRecord, query = '') {
  const text = recordText(record);
  const normalizedQuery = normalizeText(query);
  const matchedCategories: VeteranPriorityCategory[] = [];
  const matchedTerms: string[] = [];
  let signalScore = 0;
  let queryScore = 0;

  for (const signal of signals) {
    const matched = signal.terms.filter((term) => includesNormalizedTerm(text, normalizeText(term)));
    if (matched.length === 0) {
      continue;
    }
    const queryMatched = signal.terms.some((term) => includesNormalizedTerm(normalizedQuery, normalizeText(term)));
    matchedCategories.push(signal.category);
    matchedTerms.push(...matched);
    if (!signal.contextual || queryMatched || hasCore(matchedCategories)) {
      signalScore += signal.weight + Math.min(matched.length * 6, 24);
      if (queryMatched) {
        queryScore += Math.round(signal.weight * 0.28);
      }
    }
  }

  const coreMatched = hasCore(matchedCategories);
  const sourceScore = coreMatched ? sourceWeights[normalizeText(record.sourceType || 'generic')] ?? 0 : 0;
  const ignoredNeutralServiceTerms = neutralServiceTerms.filter((term) => includesNormalizedTerm(text, normalizeText(term)));
  const total = signalScore + sourceScore + queryScore;
  return {
    total,
    signalScore,
    sourceScore,
    queryScore,
    matchedCategories: unique(matchedCategories),
    matchedTerms: unique(matchedTerms),
    ignoredNeutralServiceTerms,
    isVeteranPriority: coreMatched && total > 0,
    explanation: coreMatched ? 'Veteran-priority weighted signal matched.' : 'No veteran-priority signal matched.',
  };
}

export function rankVeteranPriorityRecords<T extends VeteranPriorityRecord>(records: T[], query = '') {
  return records
    .map((record, originalIndex) => ({ item: record, originalIndex, score: scoreVeteranPriorityRecord(record, query) }))
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