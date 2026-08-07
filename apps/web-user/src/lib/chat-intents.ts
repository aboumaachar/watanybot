import type { ActionIntent } from "../types/domain";
import type { Mode } from "../store/app";

const MODULE_MODE_MAP: Partial<Record<string, Mode>> = {
  assistant: "chat",
  alerts: "alerts",
  cases: "cases",
  chat: "chat",
  community: "community",
  community_group: "groups",
  documents: "documents",
  forms: "procedures",
  home: "home",
  jobs: "jobs",
  laws: "search",
  marketplace: "marketplace",
  notifications: "notifications",
  payment: "services",
  procedure: "procedures",
  procedures: "procedures",
  profile: "profile",
  recruitment: "services",
  salary: "salary",
  saved: "saved",
  search: "search",
  services: "services",
  superadmin: "superadmin",
  ticker: "ticker",
  updates: "ticker",
  groups: "groups",
};

export function resolveIntentModuleMode(intent: ActionIntent): Mode | null {
  if (intent.type !== "open_module" || !intent.moduleId) {
    return null;
  }

  return MODULE_MODE_MAP[intent.moduleId] ?? null;
}