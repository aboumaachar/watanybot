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

export type VeteranPrioritySignal = {
  readonly category: VeteranPriorityCategory;
  readonly weight: number;
  readonly isContextual?: boolean;
  readonly labelAr: string;
  readonly terms: readonly string[];
};

export const nonVeteranPriorityServiceTerms: readonly string[] = [
  'تعقيب معاملات',
  'معقب معاملات',
  'مكتب تعقيب',
  'تخليص معاملات',
  'paperwork runner',
  'transaction follow-up',
  'public institution paperwork service',
];

export const veteranPrioritySignals: readonly VeteranPrioritySignal[] = [
  {
    category: 'retiredMilitary',
    weight: 160,
    labelAr: 'العسكريين المتقاعدين',
    terms: [
      'العسكريين المتقاعدين', 'العسكريون المتقاعدون', 'العسكري المتقاعد', 'متقاعد عسكري', 'عسكري متقاعد',
      'الضباط المتقاعدين', 'الرتباء المتقاعدين', 'المتقاعدين العسكريين', 'retired military', 'military retiree',
    ],
  },
  {
    category: 'veteran',
    weight: 155,
    labelAr: 'قدامى المحاربين',
    terms: [
      'قدامى المحاربين', 'محارب قديم', 'المحاربين القدامى', 'veteran', 'veterans', 'war veteran',
    ],
  },
  {
    category: 'martyrFamily',
    weight: 150,
    labelAr: 'الشهداء وذويهم',
    terms: [
      'الشهداء وذويهم', 'الشهداء', 'ذوي الشهداء', 'ذوو الشهداء', 'عائلات الشهداء', 'أبناء الشهداء',
      'زوجة الشهيد', 'والد الشهيد', 'والدة الشهيد', 'martyr', 'martyrs', 'families of martyrs',
    ],
  },
  {
    category: 'disabledOrHandicapped',
    weight: 145,
    labelAr: 'ذوي الإعاقة / المعوقين',
    terms: [
      'ذوي الإعاقة', 'ذوو الإعاقة', 'المعوقين', 'معوق', 'إعاقة', 'اعاقة', 'عجز', 'نسبة عجز',
      'جريح', 'جرحى', 'مصاب', 'إصابة حربية', 'تعويض عجز', 'disabled', 'handicapped', 'war injury',
    ],
  },
  {
    category: 'familyDependent',
    weight: 140,
    labelAr: 'العائلة / على العاتق',
    terms: [
      'العائلة', 'عائلة', 'على العاتق', 'ذوو الحقوق', 'ذوي الحقوق', 'أصحاب الحق', 'صاحب الحق',
      'الابن', 'ابن', 'الإبن', 'إبن', 'الابنة', 'ابنة', 'البنت', 'بنت',
      'الزوج', 'زوج', 'الزوجة', 'زوجة', 'الوالد', 'والد', 'الأب', 'أب',
      'الوالدة', 'والدة', 'الأم', 'أم', 'الأرملة', 'أرملة', 'الورثة', 'ورثة',
      'تعويض عائلي', 'family', 'dependent', 'eligible family member', 'spouse', 'wife', 'husband', 'son', 'daughter', 'father', 'mother',
    ],
  },
  {
    category: 'pensionSalary',
    weight: 120,
    labelAr: 'الراتب / التقاعد',
    terms: [
      'الراتب', 'راتب', 'التقاعد', 'تقاعد', 'راتب تقاعدي', 'معاش تقاعدي', 'معاش', 'محسومات',
      'رتبة', 'درجة', 'سلسلة الرتب والرواتب', 'pension', 'salary', 'retirement salary',
    ],
  },
  {
    category: 'compensation',
    weight: 115,
    labelAr: 'التعويضات',
    terms: [
      'التعويضات', 'تعويضات', 'تعويض', 'بدل', 'بدلات', 'مساعدة', 'مساعدات', 'منحة', 'منح',
      'تعويض نهاية الخدمة', 'compensation', 'allowance', 'indemnity', 'benefit',
    ],
  },
  {
    category: 'healthcare',
    weight: 105,
    labelAr: 'الطبابة',
    terms: [
      'الطبابة', 'طبابة', 'استشفاء', 'طبي', 'دواء', 'أدوية', 'مستشفى', 'تغطية صحية', 'ضمان صحي',
      'healthcare', 'medical', 'hospital', 'medicine', 'coverage',
    ],
  },
  {
    category: 'educationSchools',
    weight: 95,
    labelAr: 'المدارس والمنح',
    terms: [
      'المدارس والمنح', 'مدارس', 'مدرسة', 'منح مدرسية', 'منح', 'تعليم', 'قسط', 'أقساط مدرسية',
      'جامعة', 'منح جامعية', 'school', 'education', 'tuition', 'scholarship',
    ],
  },
  {
    category: 'nationalDefenseLaw',
    weight: 80,
    isContextual: true,
    labelAr: 'قانون الدفاع الوطني',
    terms: [
      'قانون الدفاع الوطني', 'الدفاع الوطني', 'مواد قانون الدفاع', 'مادة قانونية', 'قانون عسكري',
      'مرسوم', 'تعميم', 'قرار', 'national defense law', 'defense law', 'military law',
    ],
  },
];

export const veteranPriorityCoreCategories: readonly VeteranPriorityCategory[] = [
  'retiredMilitary',
  'veteran',
  'martyrFamily',
  'disabledOrHandicapped',
  'familyDependent',
  'pensionSalary',
  'compensation',
  'healthcare',
  'educationSchools',
];

export const veteranPrioritySourceWeights: Readonly<Record<string, number>> = {
  laws: 34,
  law: 34,
  legal: 34,
  directive: 32,
  directives: 32,
  kb: 30,
  knowledgeBase: 30,
  database: 24,
  procedure: 22,
  procedures: 22,
  document: 16,
  documents: 16,
  listing: 12,
  generic: 0,
};