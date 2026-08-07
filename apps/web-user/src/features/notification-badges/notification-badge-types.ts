export type NotificationBadgeSeverity = 'info' | 'warning' | 'urgent';

export type NotificationBadgeItem = {
  featureKey: string;
  count: number;
  label?: string;
  severity?: NotificationBadgeSeverity;
  updatedAt?: string;
};

export type NotificationBadgeMap = Record<string, NotificationBadgeItem>;

export type NotificationBadgeResponse = {
  badges?: NotificationBadgeMap;
  items?: NotificationBadgeItem[];
  counts?: Record<string, number>;
};

export function normalizeFeatureKey(featureKey: string): string {
  return String(featureKey || '').trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, '-');
}

const FEATURE_KEY_ALIASES: Record<string, string> = {
  market: 'market',
  marketplace: 'market',
  jobs: 'jobs',
  opportunities: 'opportunities',
  alerts: 'alerts',
  procedures: 'procedures',
  forms: 'forms',
  legal: 'legal',
  laws: 'legal',
  recruitment: 'recruitment',
  worldcup: 'worldcup',
  'world-cup': 'worldcup',
  salary: 'salary',
  community: 'community',
  media: 'media',
  taxi: 'taxi',
  services: 'services',
  'official-tools': 'official-services',
  'official-services': 'official-services',
  'useful-links': 'useful-links',
  messages: 'messages',
  notifications: 'notifications',
  tickets: 'tickets',
  cases: 'cases',
  profile: 'profile',
  saved: 'saved',
  'my-requests': 'my-requests',
  admin: 'admin',
  superadmin: 'superadmin',
  'admin-import-review': 'admin-import-review',
  'admin-opportunities': 'admin-opportunities',
  'admin-users': 'admin-users',
  'admin-kb': 'admin-kb',
  moderation: 'moderation',
};

export function resolveNotificationBadgeFeatureKey(featureKey: string): string {
  const normalized = normalizeFeatureKey(featureKey);
  return FEATURE_KEY_ALIASES[normalized] ?? normalized;
}

export function clampBadgeCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), 999);
}
