import { WATANY_V4_ICONS, type WatanyV4IconName } from "../../theme/watany-v4/iconRegistry";

export type WatanyIconName =
  | "add" | "alert" | "apps" | "bookmark" | "bot" | "briefcase" | "building"
  | "calculator" | "calendar" | "chat" | "check" | "clock" | "delete"
  | "dismiss" | "document" | "download" | "edit" | "education" | "faq"
  | "folder" | "health" | "home" | "law" | "list" | "location" | "mail"
  | "megaphone" | "mic" | "money" | "news" | "people" | "person" | "phone"
  | "pin" | "poll" | "search" | "settings" | "shield" | "star" | "store"
  | "taxi" | "upload" | "video" | "vote" | "warning";

export const WATANY_FLUENT_ICON_MAP: Record<WatanyIconName, string> = {
  add: "services",
  alert: "alerts",
  apps: "services",
  bookmark: "bookmarks",
  bot: "assistant",
  briefcase: "jobs",
  building: "services",
  calculator: "calculator",
  calendar: "forms",
  chat: "assistant",
  check: "admin",
  clock: "payment",
  delete: "logout",
  dismiss: "logout",
  document: "documents",
  download: "documents",
  edit: "forms",
  education: "assistance",
  faq: "questions",
  folder: "documents",
  health: "assistance",
  home: "home",
  law: "laws",
  list: "forms",
  location: "services",
  mail: "documents",
  megaphone: "news",
  mic: "assistant",
  money: "payment",
  news: "news",
  people: "community",
  person: "profile",
  phone: "phone",
  pin: "home",
  poll: "forms",
  search: "search",
  settings: "admin",
  shield: "admin",
  star: "saved",
  store: "market",
  taxi: "taxi",
  upload: "documents",
  video: "news",
  vote: "forms",
  warning: "fake_alerts",
};

export function WatanyFluentIcon({
  name,
  className,
  "aria-hidden": _ariaHidden = true,
}: Readonly<{
  name: WatanyIconName;
  className?: string;
  "aria-hidden"?: boolean;
}>) {
  const featureId = WATANY_FLUENT_ICON_MAP[name] ?? "services";
  const aliases: Record<string, WatanyV4IconName> = {
    services: "most-requested", alerts: "notifications", bookmarks: "profile", assistant: "ask-watany",
    jobs: "jobs", calculator: "salary", forms: "forms", assistance: "schools", documents: "documents",
    news: "news", fake_alerts: "fake-fact", market: "marketplace", laws: "laws", admin: "administration",
    saved: "profile", payment: "salary", phone: "messages", search: "latest", home: "most-requested",
  };
  const iconName = aliases[featureId] || (featureId in WATANY_V4_ICONS ? featureId as WatanyV4IconName : "most-requested");
  return <img src={WATANY_V4_ICONS[iconName]} alt="" aria-hidden={_ariaHidden} className={["watany-v4-icon", className].filter(Boolean).join(" ")} data-watany-icon-authority="v4" />;
}