export type WatanyVisualIcon = {
  id: string;
  label: string;
  href: string;
  asset: string;
  tone: "green" | "red" | "brown";
};

export const watanyVisualIcons: WatanyVisualIcon[] = [
  { id: "important", label: "ممكن يهمك", href: "/important", asset: "/watany-assets/visual-icons/important.svg", tone: "green" },
  { id: "latest", label: "الحدث", href: "/latest", asset: "/watany-assets/visual-icons/latest.svg", tone: "brown" },
  { id: "popular", label: "الأكثر طلباً", href: "/popular", asset: "/watany-assets/visual-icons/popular.svg", tone: "green" },
  { id: "schools", label: "مدارس", href: "/school-grants", asset: "/watany-assets/visual-icons/schools.svg", tone: "red" },
  { id: "procedures", label: "معاملات", href: "/procedures", asset: "/watany-assets/visual-icons/procedures.svg", tone: "brown" },
  { id: "salary", label: "المعاش", href: "/salary", asset: "/watany-assets/visual-icons/salary.svg", tone: "green" },
  { id: "taxi", label: "تاكسي", href: "/taxi", asset: "/watany-assets/visual-icons/taxi.svg", tone: "red" },
  { id: "market", label: "السوق", href: "/marketplace", asset: "/watany-assets/visual-icons/market.svg", tone: "brown" },
  { id: "jobs", label: "وظائف", href: "/jobs", asset: "/watany-assets/visual-icons/jobs.svg", tone: "green" },
  { id: "network", label: "الشبكة", href: "/network", asset: "/watany-assets/visual-icons/network.svg", tone: "green" },
  { id: "tools", label: "أدوات", href: "/tools", asset: "/watany-assets/visual-icons/tools.svg", tone: "brown" },
  { id: "announcements", label: "التعاميم", href: "/announcements", asset: "/watany-assets/visual-icons/announcements.svg", tone: "green" },
  { id: "deaths", label: "وفيات", href: "/deaths", asset: "/watany-assets/visual-icons/deaths.svg", tone: "red" },
  { id: "community", label: "مجتمعي", href: "/community", asset: "/watany-assets/visual-icons/community.svg", tone: "brown" },
  { id: "vote", label: "صوّت", href: "/vote", asset: "/watany-assets/visual-icons/vote.svg", tone: "green" },
  { id: "requests", label: "خدماتي", href: "/requests", asset: "/watany-assets/visual-icons/requests.svg", tone: "brown" },
  { id: "laws", label: "القوانين", href: "/laws", asset: "/watany-assets/visual-icons/laws.svg", tone: "green" },
  { id: "other", label: "مساعدة", href: "/help", asset: "/watany-assets/visual-icons/other.svg", tone: "red" },
];
