import { describe, expect, it } from 'vitest';
import { rankVeteranPriorityItems } from './veteranPriorityRanker';

const records = [
  {
    id: 'general-law-first',
    sourceType: 'laws',
    sourceTitle: 'قانون الدفاع الوطني',
    title: 'تنظيم عام',
    body: 'مادة عامة في قانون الدفاع الوطني لا تذكر العسكريين المتقاعدين أو العائلة.',
  },
  {
    id: 'neutral-taqib',
    sourceType: 'listing',
    title: 'تعقيب معاملات',
    body: 'خدمة عامة لمتابعة الأوراق في المؤسسات العامة.',
  },
  {
    id: 'late-family-veteran-law',
    sourceType: 'laws',
    sourceTitle: 'قانون الدفاع الوطني',
    title: 'حقوق العائلة للعسكريين المتقاعدين',
    body: 'تتناول هذه المادة حقوق الابن والابنة والزوج والزوجة والوالد والوالدة على العاتق، وتعويضات وطبابة العسكريين المتقاعدين وذوي الشهداء.',
  },
];

describe('veteran-priority weighted signals', () => {
  it('ranks late veteran and family law records ahead of earlier generic law records', () => {
    const ranked = rankVeteranPriorityItems(records, 'قانون الدفاع الوطني');
    expect(ranked[0]?.item.id).toBe('late-family-veteran-law');
  });

  it('does not boost تعقيب معاملات by itself', () => {
    const ranked = rankVeteranPriorityItems(records, 'تعقيب معاملات');
    const neutral = ranked.find((entry) => entry.item.id === 'neutral-taqib');
    expect(neutral?.score.isVeteranPriority).toBe(false);
    expect(neutral?.score.ignoredNeutralServiceTerms.length).toBeGreaterThan(0);
  });
});