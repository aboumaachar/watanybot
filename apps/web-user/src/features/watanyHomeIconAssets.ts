export type WatanyHomeIconKey =
  | "login"
  | "bookmarks"
  | "saved-chats"
  | "settings"
  | "documents"
  | "news"
  | "fake-fact"
  | "circulars"
  | "marketplace"
  | "jobs"
  | "salary"
  | "forms"
  | "schools"
  | "network"
  | "taxi"
  | "voting"
  | "faq"
  | "laws"
  | "procedures"
  | "world-cup"
  | "community"
  | "voice"
  | "chat-sessions"
  | "deaths"
  | "health"
  | "profile";

const HOME_ICON_ASSETS: Record<WatanyHomeIconKey, string> = {
  login: "/watany-assets/raster-icons/other.png",
  bookmarks: "/watany-assets/raster-icons/requests.png",
  "saved-chats": "/watany-assets/raster-icons/other.png",
  settings: "/watany-assets/raster-icons/tools.png",
  documents: "/watany-assets/raster-icons/procedures.png",
  news: "/watany-assets/raster-icons/latest.png",
  "fake-fact": "/watany-assets/raster-icons/important.png",
  circulars: "/watany-assets/raster-icons/announcements.png",
  marketplace: "/watany-assets/raster-icons/market.png",
  jobs: "/watany-assets/raster-icons/jobs.png",
  salary: "/watany-assets/raster-icons/salary.png",
  forms: "/watany-assets/raster-icons/requests.png",
  schools: "/watany-assets/raster-icons/schools.png",
  network: "/watany-assets/raster-icons/network.png",
  taxi: "/watany-assets/raster-icons/taxi.png",
  voting: "/watany-assets/raster-icons/vote.png",
  faq: "/watany-assets/raster-icons/other.png",
  laws: "/watany-assets/raster-icons/laws.png",
  procedures: "/watany-assets/raster-icons/procedures.png",
  "world-cup": "/watany-assets/raster-icons/popular.png",
  community: "/watany-assets/raster-icons/community.png",
  voice: "/watany-assets/raster-icons/other.png",
  "chat-sessions": "/watany-assets/raster-icons/other.png",
  deaths: "/watany-assets/raster-icons/deaths.png",
  health: "/watany-assets/raster-icons/other.png",
  profile: "/watany-assets/raster-icons/other.png",
};

export function getWatanyHomeIconAsset(key: string): string | undefined {
  return HOME_ICON_ASSETS[key as WatanyHomeIconKey];
}
