export type NavItem = {
  id: string;
  icon: string;
  label: string;
  badge?: number;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "chat",          icon: "chat",      label: "المحادثة" },
  { id: "search",        icon: "search",    label: "بحث القاعدة" },
  { id: "salary",        icon: "calculator", label: "الرواتب" },
  { id: "pension",       icon: "document",  label: "افادة المعاش" },
  { id: "cases",         icon: "folder",    label: "قضاياي" },
  { id: "documents",     icon: "document",  label: "المستندات" },
  { id: "notifications", icon: "alert",     label: "التنبيهات" },
  { id: "alerts",        icon: "warning",   label: "الطوارئ" },
  { id: "saved",         icon: "pin",       label: "المحفوظات" },
  { id: "bookmarks",     icon: "bookmark",  label: "المرجعيات" },
  { id: "procedures",    icon: "document",  label: "المعاملات" },
];

// Bottom tab bar shows only 5 main items; the rest are in "more"
export const BOTTOM_TAB_IDS = ["chat", "search", "salary", "notifications"];
