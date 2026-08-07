export type SmartPopupFeature =
  | "login"
  | "jobs"
  | "market"
  | "network"
  | "install"
  | "voting"
  | "announcement";

export type SmartPopupCampaign = {
  id: string;
  feature: SmartPopupFeature;
  titleAr: string;
  bodyAr: string;
  applyLabelAr: string;
  cancelLabelAr: string;
  actionRoute?: string;
  priority: number;
  active: boolean;
  showOnLogin: boolean;
  repeatIfCanceled: boolean;
  cooldownDaysIfCanceled: number;
  stopAfterApplied: boolean;
};

export const SMART_POPUP_CAMPAIGNS: SmartPopupCampaign[] = [
  {
    id: "network-join-village",
    feature: "network",
    titleAr: "انضم إلى شبكة موطني في بلدتك",
    bodyAr: "المشاركة اختيارية وتساعد على بناء حضور موطني في القرى والأقضية والمحافظات.",
    applyLabelAr: "الانضمام للشبكة",
    cancelLabelAr: "ليس الآن",
    actionRoute: "/network",
    priority: 95,
    active: true,
    showOnLogin: true,
    repeatIfCanceled: true,
    cooldownDaysIfCanceled: 0,
    stopAfterApplied: true,
  },
  {
    id: "jobs-local-opportunities",
    feature: "jobs",
    titleAr: "فرص عمل قريبة منك",
    bodyAr: "تابع فرص العمل المتاحة والمناسبة لك من خلال موطني.",
    applyLabelAr: "عرض فرص العمل",
    cancelLabelAr: "لاحقا",
    actionRoute: "/jobs",
    priority: 90,
    active: true,
    showOnLogin: true,
    repeatIfCanceled: true,
    cooldownDaysIfCanceled: 0,
    stopAfterApplied: true,
  },
  {
    id: "install-watany-app",
    feature: "install",
    titleAr: "ثبّت موطني على هاتفك",
    bodyAr: "استخدم موطني كتطبيق سريع على هاتفك للوصول إلى الخدمات بسهولة.",
    applyLabelAr: "طريقة التثبيت",
    cancelLabelAr: "لاحقا",
    actionRoute: "/mobile-os",
    priority: 80,
    active: true,
    showOnLogin: true,
    repeatIfCanceled: true,
    cooldownDaysIfCanceled: 0,
    stopAfterApplied: true,
  },
  {
    id: "market-local-services",
    feature: "market",
    titleAr: "شارك في السوق المحلي",
    bodyAr: "اكتشف الخدمات والمنتجات المتاحة ضمن مجتمع موطني.",
    applyLabelAr: "فتح السوق",
    cancelLabelAr: "لاحقا",
    actionRoute: "/market",
    priority: 70,
    active: true,
    showOnLogin: true,
    repeatIfCanceled: true,
    cooldownDaysIfCanceled: 0,
    stopAfterApplied: true,
  },
  {
    id: "latest-voting-participation",
    feature: "voting",
    titleAr: "شارك في التصويت الأخير",
    bodyAr: "يمكنك المشاركة في التصويتات المتاحة عند فتحها ضمن موطني.",
    applyLabelAr: "عرض التصويت",
    cancelLabelAr: "لاحقا",
    actionRoute: "/voting",
    priority: 60,
    active: true,
    showOnLogin: true,
    repeatIfCanceled: true,
    cooldownDaysIfCanceled: 0,
    stopAfterApplied: true,
  },
];

export function selectEligibleSmartPopupCampaign(
  campaigns: SmartPopupCampaign[],
  isEligible: (campaign: SmartPopupCampaign) => boolean
): SmartPopupCampaign | null {
  const eligible = campaigns.filter((campaign) => campaign.active && campaign.showOnLogin && isEligible(campaign));
  if (eligible.length === 0) return null;
  const totalWeight = eligible.reduce((sum, item) => sum + Math.max(1, item.priority), 0);
  let pick = Math.random() * totalWeight;
  for (const item of eligible) {
    pick -= Math.max(1, item.priority);
    if (pick <= 0) return item;
  }
  return eligible[0] ?? null;
}