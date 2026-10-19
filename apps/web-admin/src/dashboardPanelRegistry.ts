export type DashboardPanel = {
  id: string;
  title: string;
  featureId: string;
  panelType: "KPI" | "QUEUE" | "HEALTH" | "SHORTCUT";
  dataSource: string;
  route?: string;
  priority: number;
  state: "live" | "unavailable";
};

export const DASHBOARD_PANELS: DashboardPanel[] = [
  { id: "gateway-health", title: "Gateway API", featureId: "audit", panelType: "HEALTH", dataSource: "/api/admin/overview", priority: 1, state: "live" },
  { id: "job-applications", title: "Job applications", featureId: "marketplace-jobs", panelType: "KPI", dataSource: "/api/admin/plugins", route: "/jobs", priority: 2, state: "live" },
  { id: "marketplace-listings", title: "Marketplace listings", featureId: "marketplace-jobs", panelType: "KPI", dataSource: "/api/admin/plugins", route: "/market", priority: 3, state: "live" },
  { id: "kb-transactions", title: "KB transactions", featureId: "knowledge-base", panelType: "KPI", dataSource: "/api/admin/overview", route: "/kb", priority: 4, state: "unavailable" },
  { id: "manage-users", title: "Manage users", featureId: "authentication-users", panelType: "SHORTCUT", dataSource: "route", route: "/users", priority: 5, state: "live" },
  { id: "manage-content", title: "Manage content", featureId: "news-cms", panelType: "SHORTCUT", dataSource: "route", route: "/cms", priority: 6, state: "live" },
];