export type WatanyFeatureGraphCategory =
  | 'core'
  | 'services'
  | 'benefits'
  | 'community'
  | 'information'
  | 'account'
  | 'support'
  | 'admin';

export type WatanyFeatureGraphStatus = 'active' | 'redirect' | 'planned' | 'legacy';

export type WatanyFeatureGraphEntry = Readonly<{
  id: string;
  labelAr: string;
  labelEn: string;
  route: string;
  canonicalRoute: string;
  aliases: readonly string[];
  iconKey: string;
  category: WatanyFeatureGraphCategory;
  status: WatanyFeatureGraphStatus;
  featureId?: string;
  descriptionAr: string;
  keywordsAr: readonly string[];
  priority: number;
  guidedHelpEligible: boolean;
  pilotEligible: boolean;
}>;

export type WatanyFeatureGraphRouteMatch = Readonly<{
  entry: WatanyFeatureGraphEntry;
  normalizedRoute: string;
  matchedBy: 'canonical' | 'route' | 'alias' | 'descendant';
}>;

export function normalizeWatanyFeatureRoute(route: string): string {
  const raw = route && route.trim() ? route.trim() : '/';
  let normalized = raw;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      normalized = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      normalized = raw;
    }
  }

  normalized = normalized.replace(/^\/worldcup(?=$|[/?#])/, '/mcp/world-cup');
  normalized = normalized.replace(/^\/world-cup(?=$|[/?#])/, '/mcp/world-cup');
  normalized = normalized.replace(/^\/mcp\/worldcup(?=$|[/?#])/, '/mcp/world-cup');

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  return normalized;
}

function routePathOnly(route: string): string {
  const hashless = route.split('#')[0] || '/';
  return hashless.split('?')[0] || '/';
}

function sameOrDescendant(candidate: string, base: string): boolean {
  const candidatePath = routePathOnly(normalizeWatanyFeatureRoute(candidate));
  const basePath = routePathOnly(normalizeWatanyFeatureRoute(base));
  return candidatePath === basePath || candidatePath.startsWith(`${basePath}/`);
}

export const WATANY_FEATURE_GRAPH = [
  {
    id: 'salary',
    labelAr: 'حاسبة المعاش',
    labelEn: 'Salary calculator',
    route: '/salary',
    canonicalRoute: '/salary',
    aliases: ['/pension?from=salary'],
    iconKey: 'calculator',
    category: 'benefits',
    status: 'active',
    featureId: 'salary',
    descriptionAr: 'تقدير المعاش أو الراتب بحسب الرتبة والدرجة والوضع العائلي.',
    keywordsAr: ['معاش', 'راتب', 'حاسبة', 'رتبة', 'درجة'],
    priority: 10,
    guidedHelpEligible: true,
    pilotEligible: true,
  },
  {
    id: 'procedures',
    labelAr: 'المعاملات',
    labelEn: 'Procedures',
    route: '/procedures',
    canonicalRoute: '/procedures',
    aliases: [],
    iconKey: 'document',
    category: 'services',
    status: 'active',
    featureId: 'procedures',
    descriptionAr: 'خطوات المعاملات والأوراق المطلوبة والنماذج المرتبطة.',
    keywordsAr: ['معاملة', 'إجراء', 'طلب', 'مستندات'],
    priority: 20,
    guidedHelpEligible: true,
    pilotEligible: true,
  },
  {
    id: 'school-grants',
    labelAr: 'المساعدات المدرسية',
    labelEn: 'School grants',
    route: '/school-grants',
    canonicalRoute: '/school-grants',
    aliases: ['/school-aid'],
    iconKey: 'education',
    category: 'benefits',
    status: 'active',
    featureId: 'school-grants',
    descriptionAr: 'الشروط والنماذج والمستندات المرتبطة بالمساعدات المدرسية.',
    keywordsAr: ['مدرسة', 'جامعة', 'مساعدة', 'منحة'],
    priority: 30,
    guidedHelpEligible: true,
    pilotEligible: true,
  },
  {
    id: 'jobs',
    labelAr: 'الوظائف',
    labelEn: 'Jobs',
    route: '/jobs',
    canonicalRoute: '/jobs',
    aliases: ['/opportunities', '/freelance-services'],
    iconKey: 'briefcase',
    category: 'services',
    status: 'active',
    featureId: 'jobs',
    descriptionAr: 'فرص عمل وطلبات وفرص مهنية للمجتمع.',
    keywordsAr: ['وظائف', 'عمل', 'فرص', 'توظيف'],
    priority: 40,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'marketplace',
    labelAr: 'السوق',
    labelEn: 'Marketplace',
    route: '/marketplace',
    canonicalRoute: '/marketplace',
    aliases: ['/market'],
    iconKey: 'store',
    category: 'services',
    status: 'active',
    featureId: 'marketplace',
    descriptionAr: 'إعلانات وخدمات وسوق مجتمعي داخل موطني.',
    keywordsAr: ['سوق', 'إعلان', 'بيع', 'شراء'],
    priority: 50,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'taxi',
    labelAr: 'التاكسي الموثوق',
    labelEn: 'Trusted taxi',
    route: '/taxi',
    canonicalRoute: '/taxi',
    aliases: ['/taxi/driver'],
    iconKey: 'taxi',
    category: 'services',
    status: 'active',
    descriptionAr: 'خيارات تنقل وسائقين موثوقين ضمن تجربة موطني.',
    keywordsAr: ['تاكسي', 'تنقل', 'سائق', 'مشوار'],
    priority: 60,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'recruitment',
    labelAr: 'التطويع',
    labelEn: 'Recruitment',
    route: '/services/recruitment',
    canonicalRoute: '/services/recruitment',
    aliases: ['/recruitment', '/services/official/army-volunteering-conditions'],
    iconKey: 'megaphone',
    category: 'services',
    status: 'active',
    featureId: 'jobs',
    descriptionAr: 'إعلانات وشروط التطويع والانتساب.',
    keywordsAr: ['تطويع', 'تجنيد', 'إعلان', 'شروط'],
    priority: 70,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'official-services',
    labelAr: 'روابط مفيدة',
    labelEn: 'Official services',
    route: '/services/official',
    canonicalRoute: '/services/official',
    aliases: ['/services'],
    iconKey: 'building',
    category: 'services',
    status: 'active',
    featureId: 'govservices',
    descriptionAr: 'روابط وخدمات رسمية أو إرشادية موثوقة.',
    keywordsAr: ['رسمية', 'روابط', 'خدمات', 'استعلام'],
    priority: 80,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'network',
    labelAr: 'الشبكة',
    labelEn: 'Network',
    route: '/network',
    canonicalRoute: '/network',
    aliases: ['/the-network'],
    iconKey: 'network',
    category: 'community',
    status: 'active',
    descriptionAr: 'دليل الجهات والخدمات والمناطق ضمن شبكة موطني.',
    keywordsAr: ['شبكة', 'دليل', 'مناطق', 'جهات'],
    priority: 90,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'voting',
    labelAr: 'الاستطلاع',
    labelEn: 'Voting',
    route: '/voting',
    canonicalRoute: '/voting',
    aliases: ['/survey'],
    iconKey: 'poll',
    category: 'community',
    status: 'active',
    descriptionAr: 'استطلاعات وتصويتات ونتائج ضمن موطني.',
    keywordsAr: ['تصويت', 'استطلاع', 'نتائج'],
    priority: 100,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'community',
    labelAr: 'مجتمعي',
    labelEn: 'Community',
    route: '/community',
    canonicalRoute: '/community',
    aliases: ['/groups'],
    iconKey: 'people',
    category: 'community',
    status: 'active',
    featureId: 'groups',
    descriptionAr: 'مساحة المجتمع والمجموعات والتواصل.',
    keywordsAr: ['مجتمع', 'مجموعات', 'دردشة'],
    priority: 110,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'al-wafiyat',
    labelAr: 'الوفيات الرسمية',
    labelEn: 'Official death notices',
    route: '/al-wafiyat',
    canonicalRoute: '/al-wafiyat',
    aliases: ['/deaths', '/death-notices'],
    iconKey: 'document',
    category: 'information',
    status: 'active',
    descriptionAr: 'إعلانات الوفيات الرسمية أو المعتمدة.',
    keywordsAr: ['وفيات', 'وفاة', 'تعازي'],
    priority: 120,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'faq',
    labelAr: 'الأسئلة الشائعة',
    labelEn: 'FAQ',
    route: '/faq',
    canonicalRoute: '/faq',
    aliases: [],
    iconKey: 'faq',
    category: 'support',
    status: 'active',
    featureId: 'ticker_faq',
    descriptionAr: 'أسئلة متكررة وإجابات سريعة.',
    keywordsAr: ['أسئلة', 'FAQ', 'مساعدة'],
    priority: 130,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'legal',
    labelAr: 'قانوني',
    labelEn: 'Legal',
    route: '/legal',
    canonicalRoute: '/legal',
    aliases: ['/laws', '/documents?tab=laws'],
    iconKey: 'law',
    category: 'information',
    status: 'active',
    descriptionAr: 'قوانين وحقوق وتوجيهات قانونية.',
    keywordsAr: ['قانون', 'حقوق', 'مرسوم'],
    priority: 140,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'forms',
    labelAr: 'النماذج',
    labelEn: 'Forms',
    route: '/forms',
    canonicalRoute: '/forms',
    aliases: [],
    iconKey: 'list',
    category: 'services',
    status: 'active',
    featureId: 'forms',
    descriptionAr: 'نماذج ومعاملات جاهزة للاستخدام.',
    keywordsAr: ['نموذج', 'استمارة', 'طلب'],
    priority: 150,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'news',
    labelAr: 'الأخبار',
    labelEn: 'News',
    route: '/news',
    canonicalRoute: '/news',
    aliases: ['/updates', '/ticker'],
    iconKey: 'news',
    category: 'information',
    status: 'active',
    featureId: 'news',
    descriptionAr: 'أخبار وتحديثات وتعاميم.',
    keywordsAr: ['أخبار', 'تعاميم', 'تحديثات'],
    priority: 160,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'fake-news',
    labelAr: 'زائف أم صحيح',
    labelEn: 'Fake news',
    route: '/fake-news',
    canonicalRoute: '/fake-news',
    aliases: [],
    iconKey: 'warning',
    category: 'information',
    status: 'active',
    featureId: 'news',
    descriptionAr: 'تمييز الأخبار الزائفة أو غير المؤكدة.',
    keywordsAr: ['زائف', 'شائعة', 'تحقق'],
    priority: 170,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'world-cup',
    labelAr: 'كأس العالم',
    labelEn: 'World Cup',
    route: '/mcp/world-cup',
    canonicalRoute: '/mcp/world-cup',
    aliases: ['/world-cup', '/worldcup', '/mcp/worldcup'],
    iconKey: 'star',
    category: 'information',
    status: 'active',
    descriptionAr: 'تجربة ترفيهية لمتابعة كأس العالم.',
    keywordsAr: ['كأس العالم', 'مونديال', 'مباريات'],
    priority: 180,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'documents',
    labelAr: 'المستندات',
    labelEn: 'Documents',
    route: '/documents',
    canonicalRoute: '/documents',
    aliases: [],
    iconKey: 'document',
    category: 'services',
    status: 'active',
    featureId: 'documents',
    descriptionAr: 'مستندات وملفات قابلة للفتح أو التنزيل.',
    keywordsAr: ['مستندات', 'ملفات', 'تنزيل'],
    priority: 190,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'chat',
    labelAr: 'محادثة موطني',
    labelEn: 'Chat',
    route: '/chat',
    canonicalRoute: '/chat',
    aliases: ['/hybrid-kb-chat', '/assistant', '/mobile-os/chat'],
    iconKey: 'chat',
    category: 'core',
    status: 'active',
    descriptionAr: 'محادثة موطني للمساعدة والإرشاد.',
    keywordsAr: ['محادثة', 'سؤال', 'مساعدة'],
    priority: 200,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'search',
    labelAr: 'البحث',
    labelEn: 'Search',
    route: '/search',
    canonicalRoute: '/search',
    aliases: [],
    iconKey: 'search',
    category: 'core',
    status: 'redirect',
    featureId: 'search',
    descriptionAr: 'بحث في الخدمات والمعلومات مع تحويل إلى محادثة المعرفة.',
    keywordsAr: ['بحث', 'استعلام'],
    priority: 210,
    guidedHelpEligible: false,
    pilotEligible: false,
  },
  {
    id: 'profile',
    labelAr: 'ملفي',
    labelEn: 'Profile',
    route: '/profile',
    canonicalRoute: '/profile',
    aliases: [],
    iconKey: 'person',
    category: 'account',
    status: 'active',
    featureId: 'profile',
    descriptionAr: 'إدارة المعلومات الشخصية والتفضيلات.',
    keywordsAr: ['ملف', 'حساب', 'بيانات'],
    priority: 220,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'settings',
    labelAr: 'الإعدادات',
    labelEn: 'Settings',
    route: '/settings',
    canonicalRoute: '/settings',
    aliases: [],
    iconKey: 'settings',
    category: 'account',
    status: 'active',
    featureId: 'profile',
    descriptionAr: 'إعدادات العرض والتفضيلات.',
    keywordsAr: ['إعدادات', 'خيارات'],
    priority: 230,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
  {
    id: 'notifications',
    labelAr: 'الإشعارات',
    labelEn: 'Notifications',
    route: '/notifications',
    canonicalRoute: '/notifications',
    aliases: ['/alerts'],
    iconKey: 'megaphone',
    category: 'core',
    status: 'active',
    descriptionAr: 'التنبيهات والتحديثات المهمة.',
    keywordsAr: ['إشعارات', 'تنبيهات'],
    priority: 240,
    guidedHelpEligible: true,
    pilotEligible: false,
  },
] as const satisfies readonly WatanyFeatureGraphEntry[];

export function getWatanyFeatureGraph(): readonly WatanyFeatureGraphEntry[] {
  return WATANY_FEATURE_GRAPH;
}

export function getWatanyFeatureGraphByPriority(): readonly WatanyFeatureGraphEntry[] {
  return [...WATANY_FEATURE_GRAPH].sort((left, right) => left.priority - right.priority);
}

export function getWatanyFeatureGraphPilotEntries(): readonly WatanyFeatureGraphEntry[] {
  return WATANY_FEATURE_GRAPH.filter((entry) => entry.pilotEligible);
}

export function findWatanyFeatureById(id: string): WatanyFeatureGraphEntry | null {
  return WATANY_FEATURE_GRAPH.find((entry) => entry.id === id) || null;
}

export function findWatanyFeatureByRoute(route: string): WatanyFeatureGraphRouteMatch | null {
  const normalizedRoute = normalizeWatanyFeatureRoute(route);

  for (const entry of WATANY_FEATURE_GRAPH) {
    if (normalizeWatanyFeatureRoute(entry.canonicalRoute) === normalizedRoute) {
      return { entry, normalizedRoute, matchedBy: 'canonical' };
    }

    if (normalizeWatanyFeatureRoute(entry.route) === normalizedRoute) {
      return { entry, normalizedRoute, matchedBy: 'route' };
    }

    if (entry.aliases.some((alias) => normalizeWatanyFeatureRoute(alias) === normalizedRoute)) {
      return { entry, normalizedRoute, matchedBy: 'alias' };
    }

    if (sameOrDescendant(normalizedRoute, entry.canonicalRoute)) {
      return { entry, normalizedRoute, matchedBy: 'descendant' };
    }
  }

  return null;
}

export function isWatanyFeatureRouteGuidedHelpEligible(route: string): boolean {
  const match = findWatanyFeatureByRoute(route);
  return match ? match.entry.guidedHelpEligible : false;
}

export function isWatanyFeatureRoutePilotEligible(route: string): boolean {
  const match = findWatanyFeatureByRoute(route);
  return match ? match.entry.pilotEligible : false;
}