export type WatanyHomeIcon = {
  id: string;
  label: string;
  href: string;
  asset: string;
  tone: 'green' | 'red' | 'brown' | 'blue';
};

export const watanyHomeIcons: WatanyHomeIcon[] = [
  { id: 'important', label: 'ممكن يهمك', href: '/important', asset: '/watany-assets/icons/important.svg', tone: 'green' },
  { id: 'latest', label: 'الحدث', href: '/latest', asset: '/watany-assets/icons/latest.svg', tone: 'green' },
  { id: 'popular', label: 'الأكثر طلباً', href: '/popular', asset: '/watany-assets/icons/popular.svg', tone: 'green' },
  { id: 'schools', label: 'مدارس', href: '/school-grants', asset: '/watany-assets/icons/schools.svg', tone: 'red' },
  { id: 'procedures', label: 'معاملات', href: '/procedures', asset: '/watany-assets/icons/procedures.svg', tone: 'brown' },
  { id: 'salary', label: 'المعاش', href: '/salary', asset: '/watany-assets/icons/salary.svg', tone: 'green' },
  { id: 'taxi', label: 'تاكسي', href: '/taxi', asset: '/watany-assets/icons/taxi.svg', tone: 'red' },
  { id: 'market', label: 'السوق', href: '/marketplace', asset: '/watany-assets/icons/market.svg', tone: 'brown' },
  { id: 'jobs', label: 'وظائف', href: '/jobs', asset: '/watany-assets/icons/jobs.svg', tone: 'green' },
  { id: 'network', label: 'الشبكة', href: '/network', asset: '/watany-assets/icons/network.svg', tone: 'blue' },
  { id: 'tools', label: 'أدوات', href: '/tools', asset: '/watany-assets/icons/tools.svg', tone: 'brown' },
  { id: 'announcements', label: 'التعاميم', href: '/announcements', asset: '/watany-assets/icons/announcements.svg', tone: 'blue' },
  { id: 'deaths', label: 'وفيات', href: '/deaths', asset: '/watany-assets/icons/deaths.svg', tone: 'red' },
  { id: 'community', label: 'مجتمعي', href: '/community', asset: '/watany-assets/icons/community.svg', tone: 'brown' },
  { id: 'vote', label: 'صوّت', href: '/vote', asset: '/watany-assets/icons/vote.svg', tone: 'blue' },
  { id: 'requests', label: 'طلباتي', href: '/requests', asset: '/watany-assets/icons/requests.svg', tone: 'brown' },
  { id: 'laws', label: 'القوانين', href: '/laws', asset: '/watany-assets/icons/laws.svg', tone: 'green' },
  { id: 'other', label: 'مساعدة', href: '/help', asset: '/watany-assets/icons/other.svg', tone: 'red' },
  { id: 'files', label: 'الملفات', href: '/files', asset: '/watany-assets/icons/files.svg', tone: 'green' },
  { id: 'downloads', label: 'التنزيلات', href: '/downloads', asset: '/watany-assets/icons/downloads.svg', tone: 'green' },
  { id: 'notifications', label: 'الإشعارات', href: '/notifications', asset: '/watany-assets/icons/notifications.svg', tone: 'green' },
  { id: 'login', label: 'تسجيل الدخول', href: '/login', asset: '/watany-assets/icons/login.svg', tone: 'green' },
];
