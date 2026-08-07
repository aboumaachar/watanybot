import type { WatanyCanonicalFeatureId } from './watanyCanonicalFeatureRegistry';

export type WatanyJourneyRecommendation = {
  afterFeatureId: WatanyCanonicalFeatureId;
  nextFeatureId: WatanyCanonicalFeatureId;
  reasonAr: string;
  priority: number;
};

export const WATANY_GUIDED_HELP_JOURNEY_RECOMMENDATIONS: readonly WatanyJourneyRecommendation[] = [
  {
    afterFeatureId: 'salary',
    nextFeatureId: 'procedures',
    reasonAr: '\u0628\u0639\u062f \u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0645\u0639\u0627\u0634\u060c \u0642\u062f \u062a\u062d\u062a\u0627\u062c \u0625\u0644\u0649 \u0645\u0639\u0627\u0645\u0644\u0629 \u0623\u0648 \u0645\u0633\u062a\u0646\u062f.',
    priority: 90,
  },
  {
    afterFeatureId: 'procedures',
    nextFeatureId: 'forms',
    reasonAr: '\u0628\u0639\u062f \u0641\u0647\u0645 \u0627\u0644\u0625\u062c\u0631\u0627\u0621\u060c \u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u0637\u0628\u064a\u0639\u064a\u0629 \u0647\u064a \u0627\u0644\u0646\u0645\u0627\u0630\u062c.',
    priority: 80,
  },
  {
    afterFeatureId: 'jobs',
    nextFeatureId: 'profile',
    reasonAr: '\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u0645\u0644\u0641 \u064a\u0633\u0627\u0639\u062f \u0639\u0644\u0649 \u062a\u062d\u0633\u064a\u0646 \u0641\u0631\u0635 \u0627\u0644\u0639\u0645\u0644.',
    priority: 85,
  },
  {
    afterFeatureId: 'marketplace',
    nextFeatureId: 'profile',
    reasonAr: '\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0645\u0643\u062a\u0645\u0644 \u064a\u0632\u064a\u062f \u0627\u0644\u062b\u0642\u0629 \u0641\u064a \u0627\u0644\u0633\u0648\u0642.',
    priority: 75,
  },
];

export function getWatanyJourneyRecommendations(
  afterFeatureId: WatanyCanonicalFeatureId,
): readonly WatanyJourneyRecommendation[] {
  return WATANY_GUIDED_HELP_JOURNEY_RECOMMENDATIONS
    .filter((item) => item.afterFeatureId === afterFeatureId)
    .sort((a, b) => b.priority - a.priority);
}