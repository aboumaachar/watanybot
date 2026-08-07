export type WatanyCanonicalFeatureId =
  | 'home'
  | 'salary'
  | 'schoolGrants'
  | 'procedures'
  | 'forms'
  | 'legal'
  | 'jobs'
  | 'marketplace'
  | 'community'
  | 'voting'
  | 'services'
  | 'taxi'
  | 'deathNotices'
  | 'notifications'
  | 'profile'
  | 'settings'
  | 'chat'
  | 'worldCup'
  | 'network'
  | 'documents'
  | 'faq'
  | 'news'
  | 'discovery'
  | 'other';

export type WatanyGuideEngineKind =
  | 'welcome'
  | 'preLanding'
  | 'smartTips'
  | 'profileCompletion'
  | 'journey';

export type WatanyCanonicalFeature = {
  id: WatanyCanonicalFeatureId;
  titleAr: string;
  shortDescriptionAr: string;
  primaryRoute: string;
  routeAliases: string[];
  guideEngines: WatanyGuideEngineKind[];
  iconKey: string;
  priority: 'core' | 'secondary' | 'utility';
};

export const WATANY_CANONICAL_FEATURES: readonly WatanyCanonicalFeature[] = [
  {
    id: 'home',
    titleAr: '\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
    shortDescriptionAr: '\u0645\u062f\u062e\u0644 \u0645\u0648\u062d\u062f \u0644\u0643\u0644 \u062e\u062f\u0645\u0627\u062a \u0645\u0648\u0637\u0646\u064a.',
    primaryRoute: '/',
    routeAliases: ['/'],
    guideEngines: ['welcome', 'preLanding', 'journey'],
    iconKey: 'home',
    priority: 'core',
  },
  {
    id: 'salary',
    titleAr: '\u0627\u0644\u0645\u0639\u0627\u0634 \u0648\u0627\u0644\u0631\u0627\u062a\u0628',
    shortDescriptionAr: '\u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u0639\u0627\u0634 \u0648\u0641\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0639\u062f \u0648\u0627\u0644\u0623\u0645\u062b\u0644\u0629.',
    primaryRoute: '/salary',
    routeAliases: ['/salary', '/pension', '/salary?tab=rules', '/salary?tab=examples'],
    guideEngines: ['welcome', 'preLanding', 'journey'],
    iconKey: 'salary',
    priority: 'core',
  },
  {
    id: 'schoolGrants',
    titleAr: '\u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0627\u062a \u0627\u0644\u0645\u062f\u0631\u0633\u064a\u0629',
    shortDescriptionAr: '\u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0646\u0645\u0627\u0630\u062c \u0648\u0627\u0644\u0622\u0644\u064a\u0627\u062a \u0627\u0644\u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0627\u0644\u0645\u0646\u062d \u0627\u0644\u0645\u062f\u0631\u0633\u064a\u0629.',
    primaryRoute: '/school-grants',
    routeAliases: ['/school-grants', '/school-aid'],
    guideEngines: ['welcome', 'preLanding', 'journey'],
    iconKey: 'school',
    priority: 'core',
  },
  {
    id: 'procedures',
    titleAr: '\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062a \u0648\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a',
    shortDescriptionAr: '\u062f\u0644\u064a\u0644 \u062e\u0637\u0648\u0629 \u0628\u062e\u0637\u0648\u0629 \u0644\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062a.',
    primaryRoute: '/procedures',
    routeAliases: ['/procedures'],
    guideEngines: ['welcome', 'preLanding', 'journey'],
    iconKey: 'procedures',
    priority: 'core',
  },
  {
    id: 'forms',
    titleAr: '\u0627\u0644\u0646\u0645\u0627\u0630\u062c \u0627\u0644\u0631\u0633\u0645\u064a\u0629',
    shortDescriptionAr: '\u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0646\u0645\u0627\u0630\u062c \u0648\u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.',
    primaryRoute: '/forms',
    routeAliases: ['/forms', '/forms/:sourceId', '/forms/source/:sourceId', '/forms/category/:categoryId'],
    guideEngines: ['preLanding', 'journey'],
    iconKey: 'forms',
    priority: 'core',
  },
  {
    id: 'legal',
    titleAr: '\u0627\u0644\u0642\u0648\u0627\u0646\u064a\u0646 \u0648\u0627\u0644\u062d\u0642\u0648\u0642',
    shortDescriptionAr: '\u062a\u0635\u0641\u062d \u0627\u0644\u062d\u0642\u0648\u0642 \u0648\u0627\u0644\u0642\u0648\u0627\u0646\u064a\u0646 \u0627\u0644\u0645\u0647\u0645\u0629.',
    primaryRoute: '/legal',
    routeAliases: ['/legal', '/laws', '/documents?tab=laws'],
    guideEngines: ['preLanding', 'journey'],
    iconKey: 'legal',
    priority: 'core',
  },
  {
    id: 'jobs',
    titleAr: '\u0627\u0644\u0648\u0638\u0627\u0626\u0641 \u0648\u0627\u0644\u0641\u0631\u0635',
    shortDescriptionAr: '\u0641\u0631\u0635 \u0639\u0645\u0644 \u0648\u062a\u0637\u0648\u0639 \u0648\u062e\u062f\u0645\u0627\u062a \u0642\u0631\u064a\u0628\u0629.',
    primaryRoute: '/jobs',
    routeAliases: ['/jobs', '/opportunities', '/recruitment', '/freelance-services', '/services/recruitment'],
    guideEngines: ['welcome', 'preLanding', 'smartTips', 'journey'],
    iconKey: 'jobs',
    priority: 'core',
  },
  {
    id: 'marketplace',
    titleAr: '\u0627\u0644\u0633\u0648\u0642',
    shortDescriptionAr: '\u0625\u0639\u0644\u0627\u0646\u0627\u062a \u0648\u062e\u062f\u0645\u0627\u062a \u0645\u0648\u062b\u0648\u0642\u0629 \u0644\u0645\u062c\u062a\u0645\u0639 \u0645\u0648\u0637\u0646\u064a.',
    primaryRoute: '/marketplace',
    routeAliases: ['/marketplace', '/market'],
    guideEngines: ['welcome', 'preLanding', 'smartTips', 'journey'],
    iconKey: 'marketplace',
    priority: 'core',
  },
  {
    id: 'community',
    titleAr: '\u0627\u0644\u0645\u062c\u062a\u0645\u0639 \u0648\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a',
    shortDescriptionAr: '\u0645\u062d\u0627\u062f\u062b\u0627\u062a \u0648\u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0645\u062d\u0644\u064a\u0629 \u0648\u0645\u0647\u0646\u064a\u0629.',
    primaryRoute: '/community',
    routeAliases: ['/community', '/groups', '/groups/:groupId'],
    guideEngines: ['preLanding', 'journey'],
    iconKey: 'community',
    priority: 'core',
  },
  {
    id: 'voting',
    titleAr: '\u0627\u0644\u062a\u0635\u0648\u064a\u062a \u0648\u0627\u0644\u0627\u0633\u062a\u0637\u0644\u0627\u0639',
    shortDescriptionAr: '\u0634\u0627\u0631\u0643 \u0641\u064a \u0627\u0644\u0627\u0633\u062a\u0637\u0644\u0627\u0639\u0627\u062a \u0648\u0627\u0644\u062a\u0635\u0648\u064a\u062a.',
    primaryRoute: '/voting',
    routeAliases: ['/voting', '/survey', '/survey-results'],
    guideEngines: ['preLanding', 'smartTips', 'journey'],
    iconKey: 'voting',
    priority: 'secondary',
  },
  {
    id: 'services',
    titleAr: '\u0627\u0644\u062e\u062f\u0645\u0627\u062a \u0648\u0627\u0644\u0631\u0648\u0627\u0628\u0637',
    shortDescriptionAr: '\u0631\u0648\u0627\u0628\u0637 \u0631\u0633\u0645\u064a\u0629 \u0648\u062e\u062f\u0645\u0627\u062a \u0645\u0646\u0638\u0645\u0629 \u062d\u0633\u0628 \u0627\u0644\u0641\u0626\u0629.',
    primaryRoute: '/services',
    routeAliases: ['/services', '/services/official', '/useful-links', '/official-services'],
    guideEngines: ['preLanding', 'journey'],
    iconKey: 'services',
    priority: 'core',
  },
  {
    id: 'profile',
    titleAr: '\u0645\u0644\u0641\u064a \u0627\u0644\u0634\u062e\u0635\u064a',
    shortDescriptionAr: '\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u0645\u0644\u0641 \u064a\u062d\u0633\u0646 \u0627\u0644\u062a\u0648\u0635\u064a\u0627\u062a \u0648\u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a.',
    primaryRoute: '/profile',
    routeAliases: ['/profile', '/messages', '/bookmarks', '/saved'],
    guideEngines: ['preLanding', 'profileCompletion', 'journey'],
    iconKey: 'profile',
    priority: 'core',
  },
  {
    id: 'chat',
    titleAr: '\u0645\u062d\u0627\u062f\u062b\u0629 \u0645\u0648\u0637\u0646\u064a',
    shortDescriptionAr: '\u0645\u0633\u0627\u0639\u062f \u0630\u0643\u064a \u0644\u0644\u0623\u0633\u0626\u0644\u0629 \u0648\u0627\u0644\u0625\u0631\u0634\u0627\u062f.',
    primaryRoute: '/chat',
    routeAliases: ['/chat', '/assistant', '/hybrid-kb-chat', '/chat-sessions'],
    guideEngines: ['preLanding', 'journey'],
    iconKey: 'chat',
    priority: 'core',
  },
  {
    id: 'network',
    titleAr: '\u0634\u0628\u0643\u0629 \u0645\u0648\u0637\u0646\u064a',
    shortDescriptionAr: '\u0627\u0646\u0636\u0645 \u0625\u0644\u0649 \u0634\u0628\u0643\u0629 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0648\u0627\u0644\u0628\u0644\u062f\u0629.',
    primaryRoute: '/network',
    routeAliases: ['/network', '/the-network'],
    guideEngines: ['welcome', 'preLanding', 'smartTips', 'journey'],
    iconKey: 'network',
    priority: 'core',
  },
  {
    id: 'worldCup',
    titleAr: '\u0643\u0623\u0633 \u0627\u0644\u0639\u0627\u0644\u0645',
    shortDescriptionAr: '\u0627\u0644\u0645\u0628\u0627\u0631\u064a\u0627\u062a \u0648\u0627\u0644\u0623\u062e\u0628\u0627\u0631 \u0648\u0627\u0644\u0646\u062a\u0627\u0626\u062c.',
    primaryRoute: '/mcp/world-cup',
    routeAliases: ['/mcp/world-cup', '/world-cup', '/world-cup/*'],
    guideEngines: ['preLanding', 'journey'],
    iconKey: 'worldCup',
    priority: 'secondary',
  },
  {
    id: 'news',
    titleAr: '\u0627\u0644\u0623\u062e\u0628\u0627\u0631 \u0648\u0627\u0644\u062a\u0639\u0627\u0645\u064a\u0645',
    shortDescriptionAr: '\u0622\u062e\u0631 \u0627\u0644\u0623\u062e\u0628\u0627\u0631 \u0648\u0627\u0644\u062a\u0639\u0627\u0645\u064a\u0645 \u0648\u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a.',
    primaryRoute: '/news',
    routeAliases: ['/news', '/latest', '/updates', '/ticker', '/media'],
    guideEngines: ['preLanding', 'journey'],
    iconKey: 'news',
    priority: 'core',
  },
  {
    id: 'other',
    titleAr: '\u0645\u064a\u0632\u0629 \u0623\u062e\u0631\u0649',
    shortDescriptionAr: '\u0645\u064a\u0632\u0629 \u062a\u062d\u062a\u0627\u062c \u062a\u0635\u0646\u064a\u0641\u0627\u064b \u0623\u062f\u0642.',
    primaryRoute: '/',
    routeAliases: [],
    guideEngines: ['journey'],
    iconKey: 'default',
    priority: 'utility',
  },
];

export function getWatanyCanonicalFeature(featureId: WatanyCanonicalFeatureId): WatanyCanonicalFeature {
  return WATANY_CANONICAL_FEATURES.find((feature) => feature.id === featureId) ?? WATANY_CANONICAL_FEATURES[0];
}

export function normalizeWatanyGuideRoute(route: string | undefined | null): string {
  if (!route) return '';
  const withoutQuery = route.split('?')[0]?.split('#')[0] ?? route;
  const normalized = withoutQuery === '/' ? '/' : `/${withoutQuery.replace(/^\/+|\/+$/g, '')}`.toLowerCase();
  switch (normalized) {
    case '/market':
      return '/marketplace';
    case '/school-aid':
      return '/school-grants';
    case '/world-cup':
      return '/mcp/world-cup';
    case '/the-network':
      return '/network';
    case '/death-notices':
      return '/al-wafiyat';
    case '/official-services':
      return '/services/official';
    default:
      return normalized;
  }
}

export function getWatanyFeatureIdForRoute(route: string | undefined | null): WatanyCanonicalFeatureId {
  const normalized = normalizeWatanyGuideRoute(route);
  const direct = WATANY_CANONICAL_FEATURES.find((feature) =>
    feature.routeAliases.map(normalizeWatanyGuideRoute).includes(normalized),
  );
  if (direct) return direct.id;

  if (normalized === '/') return 'home';
  if (/^\/salary|^\/pension/.test(normalized)) return 'salary';
  if (/^\/school-grants/.test(normalized)) return 'schoolGrants';
  if (/^\/procedures/.test(normalized)) return 'procedures';
  if (/^\/forms/.test(normalized)) return 'forms';
  if (/^\/legal|^\/laws/.test(normalized)) return 'legal';
  if (/^\/jobs|^\/opportunities|^\/recruitment|^\/freelance-services|^\/services\/recruitment/.test(normalized)) return 'jobs';
  if (/^\/marketplace/.test(normalized)) return 'marketplace';
  if (/^\/community|^\/groups/.test(normalized)) return 'community';
  if (/^\/voting|^\/survey/.test(normalized)) return 'voting';
  if (/^\/services|^\/useful-links/.test(normalized)) return 'services';
  if (/^\/taxi/.test(normalized)) return 'taxi';
  if (/^\/al-wafiyat|^\/deaths/.test(normalized)) return 'deathNotices';
  if (/^\/notifications|^\/alerts/.test(normalized)) return 'notifications';
  if (/^\/profile|^\/messages|^\/bookmarks|^\/saved/.test(normalized)) return 'profile';
  if (/^\/settings/.test(normalized)) return 'settings';
  if (/^\/chat|^\/assistant|^\/hybrid-kb-chat|^\/chat-sessions/.test(normalized)) return 'chat';
  if (/^\/mcp\/world-cup|^\/world-cup/.test(normalized)) return 'worldCup';
  if (/^\/network/.test(normalized)) return 'network';
  if (/^\/documents/.test(normalized)) return 'documents';
  if (/^\/faq|^\/help/.test(normalized)) return 'faq';
  if (/^\/news|^\/latest|^\/updates|^\/ticker|^\/media/.test(normalized)) return 'news';
  if (/^\/search|^\/for-you|^\/most-requested/.test(normalized)) return 'discovery';
  return 'other';
}