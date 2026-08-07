// Auto-generated from watany_mof_mobile_viewer_v9.html — DO NOT EDIT MANUALLY
// Source: v9 MOF procedures data, salary-statement and TVA office-hours excluded per spec.
import RAW from './watanyMofMobileViewerV9.json';

export type MofV9CtaButton = {
  id: string;
  title: string;
  button_text: string;
  source: string;
  preview_endpoint: string;
  viewer_route: string;
};

export type MofV9RelatedCard = {
  id: string;
  title: string;
  family_label?: string;
};

export type MofV9Card = {
  id: string;
  title: string;
  family: string;
  family_label: string;
  person_tags: string[];
  when_applies: string;
  flow_steps: string[];
  document_ctas: MofV9CtaButton[];
  form_ctas: MofV9CtaButton[];
  related_cards: MofV9RelatedCard[];
  details_blocks: string[];
};

export type MofV9Family = { id: string; label: string; count: number };

export type MofV9Dataset = {
  id: string;
  title: string;
  counts: { cards: number; families: number };
  families: MofV9Family[];
  cards: MofV9Card[];
};

const DIVORCED_DAUGHTER_SOURCE_CARD_ID = 'mof-current-card-01-طلب-تخصيص-معاش-تقاعدي-او-تعويض-صرف';
const DIVORCED_DAUGHTER_TARGET_CARD_ID = 'mof-current-card-07-طلب-اعاده-تخصيص-معاش-تقاعدي-الابنه-المطلقه';
const DIVORCED_DAUGHTER_DETAILS_PREFIX = 'المستندات المطلوبة إلى المالية والى الشؤون في القطعة الإدارية لإضافة الابنة المطلقة';
const FAMILY_STATUS_CARD_ID = 'mof-current-card-15-حالات-تعديل-الوضع-العايلي';
const WORKING_DAUGHTER_STANDALONE_CARD_ID = 'mof-standalone-card-07a-شطب-الابنة-بسبب-مزاولتها-عملا-ماجورا';
const WORKING_DAUGHTER_DETAILS_PREFIX = 'المستندات المطلوبة لشطب الابنة عن عاتق العسكري المتقاعد عند مزاولتها العمل المأجور';

function removeDetailsBlocksByPrefix(card: MofV9Card, prefix: string): MofV9Card {
  return {
    ...card,
    details_blocks: (card.details_blocks ?? []).filter((block) => !block.startsWith(prefix)),
  };
}

function relocateDivorcedDaughterDetails(cards: MofV9Card[]): MofV9Card[] {
  const sourceCard = cards.find((card) => card.id === DIVORCED_DAUGHTER_SOURCE_CARD_ID);
  const targetCard = cards.find((card) => card.id === DIVORCED_DAUGHTER_TARGET_CARD_ID);

  if (!sourceCard || !targetCard) {
    return cards;
  }

  const movedBlocks = (sourceCard.details_blocks ?? []).filter((block) => block.startsWith(DIVORCED_DAUGHTER_DETAILS_PREFIX));
  if (movedBlocks.length === 0) {
    return cards;
  }

  return cards.map((card) => {
    if (card.id === DIVORCED_DAUGHTER_SOURCE_CARD_ID) {
      return removeDetailsBlocksByPrefix(card, DIVORCED_DAUGHTER_DETAILS_PREFIX);
    }

    if (card.id === DIVORCED_DAUGHTER_TARGET_CARD_ID) {
      const existingBlocks = card.details_blocks ?? [];
      const nextBlocks = movedBlocks.filter((block) => !existingBlocks.includes(block));
      return nextBlocks.length > 0
        ? { ...card, details_blocks: [...existingBlocks, ...nextBlocks] }
        : card;
    }

    return card;
  });
}

function createWorkingDaughterStandaloneCard(cards: MofV9Card[]): MofV9Card[] {
  const sourceCard = cards.find((card) => card.id === DIVORCED_DAUGHTER_SOURCE_CARD_ID);
  const familyStatusCard = cards.find((card) => card.id === FAMILY_STATUS_CARD_ID);
  const divorcedDaughterCard = cards.find((card) => card.id === DIVORCED_DAUGHTER_TARGET_CARD_ID);

  if (!sourceCard || !familyStatusCard) {
    return cards;
  }

  const movedBlocks = (sourceCard.details_blocks ?? []).filter((block) => block.startsWith(WORKING_DAUGHTER_DETAILS_PREFIX));
  if (movedBlocks.length === 0) {
    return cards;
  }

  const standaloneCard: MofV9Card = {
    id: WORKING_DAUGHTER_STANDALONE_CARD_ID,
    title: 'شطب الابنة بسبب مزاولتها عملا ماجورا',
    family: familyStatusCard.family,
    family_label: 'تعديل الوضع العائلي',
    person_tags: ['ابنة', 'عمل مأجور'],
    when_applies: 'ينطبق على حالة: ابنة، عمل مأجور.',
    flow_steps: [
      'تحقّق من بدء مزاولة العمل المأجور.',
      'جهّز إفادة صاحب العمل والمستندات المطلوبة.',
      'املأ نموذج تعديل الوضع العائلي والإقرار اللازم.',
      'قدّم الملف إلى دائرة التقاعد في وزارة المالية.',
    ],
    document_ctas: (familyStatusCard.document_ctas ?? []).filter((button) => button.id === 'mof-doc-حالات-تعديل-الوضع-العايلي'),
    form_ctas: (familyStatusCard.form_ctas ?? []).filter((button) => button.id === 'mof-form-t2' || button.id === 'mof-form-t12'),
    related_cards: [
      { id: FAMILY_STATUS_CARD_ID, title: familyStatusCard.title },
      divorcedDaughterCard ? { id: DIVORCED_DAUGHTER_TARGET_CARD_ID, title: divorcedDaughterCard.title } : null,
    ].filter((card): card is MofV9RelatedCard => Boolean(card)),
    details_blocks: movedBlocks,
  };

  const nextCards = cards
    .map((card) => card.id === DIVORCED_DAUGHTER_SOURCE_CARD_ID ? removeDetailsBlocksByPrefix(card, WORKING_DAUGHTER_DETAILS_PREFIX) : card)
    .filter((card) => card.id !== WORKING_DAUGHTER_STANDALONE_CARD_ID);

  const insertAfterIndex = nextCards.findIndex((card) => card.id === DIVORCED_DAUGHTER_TARGET_CARD_ID);
  if (insertAfterIndex === -1) {
    return [...nextCards, standaloneCard];
  }

  return [
    ...nextCards.slice(0, insertAfterIndex + 1),
    standaloneCard,
    ...nextCards.slice(insertAfterIndex + 1),
  ];
}

const rawData = RAW as unknown as MofV9Dataset;
const normalizedCards = createWorkingDaughterStandaloneCard(relocateDivorcedDaughterDetails(rawData.cards ?? []));

export const MOF_V9_DATA: MofV9Dataset = {
  ...rawData,
  counts: {
    ...rawData.counts,
    cards: normalizedCards.length,
  },
  cards: normalizedCards,
};
