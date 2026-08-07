export type TopHeaderTickerItem = {
  id: string;
  titleAr: string;
  category: "latest_info" | "latest_news" | "update" | "service" | "notification";
  originLandingUrl?: string;
  href?: string;
  sourceUrl?: string;
  priority: number;
  active: boolean;
  publishedAt: string;
};

export const topHeaderTickerItems: TopHeaderTickerItem[] = [
  {
    id: "official-services",
    titleAr: "الخدمات الرسمية متاحة كرابط مباشر للمصدر الرسمي.",
    category: "service",
    href: "/services/official",
    priority: 80,
    active: true,
    publishedAt: new Date().toISOString()
  },
  {
    id: "al-wafiyat",
    titleAr: "صفحة الوفيات تعرض الاسم والتاريخ مع تفاصيل قابلة للتوسيع.",
    category: "latest_info",
    href: "/al-wafiyat",
    priority: 70,
    active: true,
    publishedAt: new Date().toISOString()
  }
];

export function getTopHeaderTickerItems() {
  return topHeaderTickerItems
    .filter((item) => item.active)
    .sort((a, b) => b.priority - a.priority);
}