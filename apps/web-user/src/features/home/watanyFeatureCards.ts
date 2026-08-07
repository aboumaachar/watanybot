export type WatanyFeatureCard = {
  id: string;
  titleAr: string;
  descriptionAr?: string;
  route: string;
  iconKey: string;
  status: 'built' | 'partial';
  priority: number;
};

// Generated from audit: only include CardAllowed = YES entries
const watanyFeatureCards: WatanyFeatureCard[] = [
  {
    id: 'market',
    titleAr: 'السوق',
    descriptionAr: 'تصفح الإعلانات والخدمات في السوق المحلي',
    route: '/market',
    iconKey: 'market',
    status: 'built',
    priority: 7,
  },
  {
    id: 'ask',
    titleAr: 'اسأل موطني',
    descriptionAr: 'ابدأ دردشة مع المساعد للحصول على المساعدة والاستعلامات',
    route: '/chat',
    iconKey: 'chat',
    status: 'built',
    priority: 12,
  },
];

export default watanyFeatureCards;
