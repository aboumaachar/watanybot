import type { ComponentType, SVGProps } from "react";
import {
  CalendarCheckmark24Regular,
  CheckmarkCircle24Regular,
  DataBarVertical24Regular,
  Globe24Regular,
  News24Regular,
  People24Regular,
  TextBulletList24Regular,
  Trophy24Regular,
  Video24Regular,
} from "../../theme/watany-v4/legacyIconBridge";

export type WorldCupFeatureId = "today" | "matches" | "results" | "teams" | "agenda" | "bracket" | "polls" | "live" | "news";

export type WorldCupFeatureDefinition = {
  id: WorldCupFeatureId;
  label: string;
  desc: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  path: string;
};

export const WORLD_CUP_FEATURES: WorldCupFeatureDefinition[] = [
  { id: "today", label: "مباريات اليوم", desc: "نافذة سريعة لأقرب اللقاءات في هذا اليوم.", icon: CalendarCheckmark24Regular, path: "/world-cup/today" },
  { id: "matches", label: "الجدول الكامل", desc: "عرض كامل للمباريات ببطاقات متتابعة.", icon: TextBulletList24Regular, path: "/world-cup/matches" },
  { id: "results", label: "النتائج", desc: "النتائج المنتهية والمواجهات الجارية أولاً بأول.", icon: CheckmarkCircle24Regular, path: "/world-cup/results" },
  { id: "teams", label: "المنتخبات", desc: "استعراض المجموعات والمنتخبات المشاركة.", icon: People24Regular, path: "/world-cup/teams" },
  { id: "agenda", label: "الأجندة", desc: "أبرز المحطات والتنظيم العام للبطولة.", icon: Globe24Regular, path: "/world-cup/agenda" },
  { id: "bracket", label: "شجرة البطولة", desc: "لوحة مسار الأدوار مع قائمة المباريات.", icon: Trophy24Regular, path: "/world-cup/bracket" },
  { id: "polls", label: "التصويتات", desc: "تصويتات كل مباراة عبر نظام التصويت في التطبيق.", icon: DataBarVertical24Regular, path: "/world-cup/polls" },
  { id: "live", label: "البث الرسمي", desc: "روابط البث والمتابعة الرسمية المباشرة.", icon: Video24Regular, path: "/world-cup/live" },
  { id: "news", label: "الأخبار", desc: "آخر الأخبار والعاجل مع مصادر تغذية معتمدة.", icon: News24Regular, path: "/world-cup/news" },
];

export function findWorldCupFeatureByPath(pathname: string): WorldCupFeatureDefinition | undefined {
  return WORLD_CUP_FEATURES.find((feature) => pathname === feature.path);
}


