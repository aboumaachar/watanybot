export type WatanyGuideStatus =
  | 'not_seen'
  | 'seen'
  | 'later'
  | 'clicked_cta'
  | 'completed'
  | 'dismissed';

export type WatanyGuideItem = {
  guideKey: string;
  featureKey: string;
  titleAr: string;
  bodyAr: string;
  ctaLabelAr: string;
  targetRoute: string;
  priority: number;
  firstEntry?: boolean;
};

export const WATANY_WELCOME_GUIDES: WatanyGuideItem[] = [
  {
    guideKey: 'welcome_salary',
    featureKey: 'salary',
    titleAr: 'المعاش والراتب',
    bodyAr: 'ابدأ بالاستعلام عن المعاش أو الراتب وحقوقك.',
    ctaLabelAr: 'المعاش والراتب',
    targetRoute: '/salary',
    priority: 10,
    firstEntry: true
  },
  {
    guideKey: 'welcome_school_aid',
    featureKey: 'school_aid',
    titleAr: 'المساعدات المدرسية',
    bodyAr: 'اعرف شروط وأوراق المساعدات المدرسية.',
    ctaLabelAr: 'المساعدات المدرسية',
    targetRoute: '/school-aid',
    priority: 9,
    firstEntry: true
  },
  {
    guideKey: 'welcome_procedures',
    featureKey: 'procedures',
    titleAr: 'المعاملات والإجراءات',
    bodyAr: 'اعرف خطوات المعاملة والأوراق المطلوبة.',
    ctaLabelAr: 'المعاملات والإجراءات',
    targetRoute: '/procedures',
    priority: 8,
    firstEntry: true
  },
  {
    guideKey: 'welcome_home',
    featureKey: 'home',
    titleAr: 'القائمة الرئيسية',
    bodyAr: 'افتح جميع خدمات موطني من الصفحة الرئيسية.',
    ctaLabelAr: 'القائمة الرئيسية',
    targetRoute: '/',
    priority: 7,
    firstEntry: true
  }
];

export const WATANY_FEATURE_TIPS: WatanyGuideItem[] = [
  {
    guideKey: 'tip_jobs',
    featureKey: 'jobs',
    titleAr: 'هل تعلم؟',
    bodyAr: 'يمكنك البحث عن فرص عمل مناسبة للمتقاعدين والعائلة.',
    ctaLabelAr: 'ابحث عن وظيفة',
    targetRoute: '/jobs',
    priority: 6
  },
  {
    guideKey: 'tip_market',
    featureKey: 'market',
    titleAr: 'هل تعلم؟',
    bodyAr: 'يمكنك عرض أو طلب خدمات ومنتجات من خلال السوق.',
    ctaLabelAr: 'افتح السوق',
    targetRoute: '/market',
    priority: 5
  },
  {
    guideKey: 'tip_network',
    featureKey: 'network',
    titleAr: 'هل تعلم؟',
    bodyAr: 'يمكنك استخدام الشبكة للوصول إلى الخدمات والفرص المرتبطة بمنطقتك.',
    ctaLabelAr: 'افتح الشبكة',
    targetRoute: '/network',
    priority: 5
  }
];

export const WATANY_GUIDE_DEFAULTS = {
  maxTipsPerSession: 1,
  laterCooldownHours: 24,
  dismissedCooldownHours: 168,
  firstEntryGuideKey: 'watany_first_entry_welcome'
};
