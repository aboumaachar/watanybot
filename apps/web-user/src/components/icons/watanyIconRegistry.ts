export type WatanyIconKey =
  | 'salary'
  | 'schoolAid'
  | 'procedures'
  | 'home'
  | 'jobs'
  | 'market'
  | 'network'
  | 'community'
  | 'chat'
  | 'settings'
  | 'documents'
  | 'laws'
  | 'announcements'
  | 'deathNotices'
  | 'voting'
  | 'profile'
  | 'help'
  | 'default';

export type WatanyIconTone =
  | 'gold'
  | 'blue'
  | 'purple'
  | 'green'
  | 'orange'
  | 'red'
  | 'teal'
  | 'indigo'
  | 'slate'
  | 'navy';

export type WatanyIconRegistryEntry = {
  key: WatanyIconKey;
  featureKey: string;
  labelAr: string;
  labelEn: string;
  meaning: string;
  tone: WatanyIconTone;
  fallbackIconKey: WatanyIconKey;
  route?: string;
};

export const WATANY_ICON_REGISTRY: Record<WatanyIconKey, WatanyIconRegistryEntry> = {
  salary: {
    key: 'salary',
    featureKey: 'salary',
    labelAr: 'المعاش والراتب',
    labelEn: 'Salary and pension',
    meaning: 'wallet-money',
    tone: 'gold',
    fallbackIconKey: 'default',
    route: '/salary'
  },
  schoolAid: {
    key: 'schoolAid',
    featureKey: 'school_aid',
    labelAr: 'المساعدات المدرسية',
    labelEn: 'School aid',
    meaning: 'graduation-cap',
    tone: 'blue',
    fallbackIconKey: 'default',
    route: '/school-aid'
  },
  procedures: {
    key: 'procedures',
    featureKey: 'procedures',
    labelAr: 'المعاملات والإجراءات',
    labelEn: 'Procedures',
    meaning: 'clipboard-check',
    tone: 'purple',
    fallbackIconKey: 'default',
    route: '/procedures'
  },
  home: {
    key: 'home',
    featureKey: 'home',
    labelAr: 'القائمة الرئيسية',
    labelEn: 'Main menu',
    meaning: 'apps-grid',
    tone: 'green',
    fallbackIconKey: 'default',
    route: '/'
  },
  jobs: {
    key: 'jobs',
    featureKey: 'jobs',
    labelAr: 'روابط',
    labelEn: 'Jobs',
    meaning: 'briefcase',
    tone: 'orange',
    fallbackIconKey: 'default',
    route: '/jobs'
  },
  market: {
    key: 'market',
    featureKey: 'market',
    labelAr: 'السوق',
    labelEn: 'Market',
    meaning: 'store',
    tone: 'red',
    fallbackIconKey: 'default',
    route: '/market'
  },
  network: {
    key: 'network',
    featureKey: 'network',
    labelAr: 'الشبكة',
    labelEn: 'The Network',
    meaning: 'network-nodes',
    tone: 'teal',
    fallbackIconKey: 'default',
    route: '/network'
  },
  community: {
    key: 'community',
    featureKey: 'community',
    labelAr: 'المجتمع',
    labelEn: 'Community',
    meaning: 'people-group',
    tone: 'indigo',
    fallbackIconKey: 'default',
    route: '/community'
  },
  chat: {
    key: 'chat',
    featureKey: 'chat',
    labelAr: 'الدردشة',
    labelEn: 'Chat',
    meaning: 'chat-bubble',
    tone: 'green',
    fallbackIconKey: 'default',
    route: '/chat'
  },
  settings: {
    key: 'settings',
    featureKey: 'settings',
    labelAr: 'الإعدادات',
    labelEn: 'Settings',
    meaning: 'gear',
    tone: 'slate',
    fallbackIconKey: 'default',
    route: '/settings'
  },
  documents: {
    key: 'documents',
    featureKey: 'documents',
    labelAr: 'المستندات',
    labelEn: 'Documents',
    meaning: 'document-file',
    tone: 'navy',
    fallbackIconKey: 'default',
    route: '/documents'
  },
  laws: {
    key: 'laws',
    featureKey: 'laws',
    labelAr: 'القوانين',
    labelEn: 'Laws',
    meaning: 'law-book',
    tone: 'gold',
    fallbackIconKey: 'default',
    route: '/laws'
  },
  announcements: {
    key: 'announcements',
    featureKey: 'announcements',
    labelAr: 'التعاميم',
    labelEn: 'Announcements',
    meaning: 'announcement',
    tone: 'gold',
    fallbackIconKey: 'default',
    route: '/announcements'
  },
  deathNotices: {
    key: 'deathNotices',
    featureKey: 'death_notices',
    labelAr: 'الوفيات',
    labelEn: 'Death notices',
    meaning: 'notice-ribbon',
    tone: 'slate',
    fallbackIconKey: 'default',
    route: '/death-notices'
  },
  voting: {
    key: 'voting',
    featureKey: 'voting',
    labelAr: 'التصويت',
    labelEn: 'Voting',
    meaning: 'ballot',
    tone: 'purple',
    fallbackIconKey: 'default',
    route: '/voting'
  },
  profile: {
    key: 'profile',
    featureKey: 'profile',
    labelAr: 'الملف',
    labelEn: 'Profile',
    meaning: 'user-profile',
    tone: 'green',
    fallbackIconKey: 'default',
    route: '/profile'
  },
  help: {
    key: 'help',
    featureKey: 'help',
    labelAr: 'المساعدة',
    labelEn: 'Help',
    meaning: 'help-guide',
    tone: 'blue',
    fallbackIconKey: 'default',
    route: '/help'
  },
  default: {
    key: 'default',
    featureKey: 'default',
    labelAr: 'خدمة',
    labelEn: 'Service',
    meaning: 'apps-grid',
    tone: 'gold',
    fallbackIconKey: 'default'
  }
};

export function getWatanyIconEntry(key?: string): WatanyIconRegistryEntry {
  if (!key) return WATANY_ICON_REGISTRY.default;
  const normalized = key as WatanyIconKey;
  const entry = WATANY_ICON_REGISTRY[normalized];
  if (!entry) {
    if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn(`[WatanyIcon] Missing icon key "${key}". Falling back to default.`);
    }
    return WATANY_ICON_REGISTRY.default;
  }
  return entry;
}