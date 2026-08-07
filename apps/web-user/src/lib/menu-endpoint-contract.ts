import { MODE_PATHS } from "./routes";

export type MenuEndpointContractItem = Readonly<{
  id: string;
  title: string;
  endpoint: string;
}>;

export const TOP_HEADER_ICON_ENDPOINT_CONTRACT: readonly MenuEndpointContractItem[] = [
  { id: "menu", title: "القائمة", endpoint: "/services" },
  { id: "search", title: "بحث", endpoint: MODE_PATHS.search },
  { id: "help", title: "المساعدة", endpoint: MODE_PATHS.faq },
  { id: "notifications", title: "الإشعارات", endpoint: MODE_PATHS.notifications },
  { id: "profile", title: "الحساب", endpoint: MODE_PATHS.profile },
  { id: "login", title: "تسجيل الدخول", endpoint: "/login" },
] as const;

export function getTopHeaderEndpointById(id: string): string {
  const found = TOP_HEADER_ICON_ENDPOINT_CONTRACT.find((item) => item.id === id);
  return found?.endpoint || "/";
}

export function resolveTopHeaderHelpEndpoint(faqEnabled: boolean): string {
  return faqEnabled ? MODE_PATHS.faq : MODE_PATHS.chat;
}
