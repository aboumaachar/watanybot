export type DashboardModuleStatus = "ACTIVE" | "NOT_CONFIGURED";
export type DashboardModuleCategory = "CONTENT" | "SERVICES" | "OPERATIONS" | "SYSTEM";

export type DashboardModule = {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  route: string;
  requiredCapability: string;
  category: DashboardModuleCategory;
  statusOwner: string;
  dataAuthority: string;
  status: DashboardModuleStatus;
};

export const DASHBOARD_MODULES: readonly DashboardModule[] = [
  { id: "procedures", labelAr: "الإجراءات", labelEn: "Procedures", icon: "folder", route: "/admin/procedures", requiredCapability: "cms.procedures.read", category: "CONTENT", statusOwner: "Ops control plane → Gateway CMS → Payload editor", dataAuthority: "Payload canonical editor; Gateway runtime projection (kb_vnext until safe first Payload activation)", status: "ACTIVE" },
  { id: "knowledge-base", labelAr: "قاعدة المعرفة", labelEn: "Knowledge Base", icon: "knowledge", route: "/kb", requiredCapability: "cms.read", category: "CONTENT", statusOwner: "Gateway KB APIs", dataAuthority: "Gateway hybrid KB", status: "ACTIVE" },
  { id: "documents", labelAr: "المستندات", labelEn: "Documents", icon: "document", route: "/admin/documents", requiredCapability: "cms.read", category: "CONTENT", statusOwner: "Gateway CMS / Payload", dataAuthority: "Payload editorial data via Gateway", status: "ACTIVE" },
  { id: "announcements", labelAr: "التعاميم", labelEn: "Announcements", icon: "news", route: "/news", requiredCapability: "cms.read", category: "CONTENT", statusOwner: "Gateway announcements adapter", dataAuthority: "Gateway announcements owner", status: "ACTIVE" },
  { id: "jobs", labelAr: "الفرص والوظائف", labelEn: "Jobs & Opportunities", icon: "briefcase", route: "/jobs", requiredCapability: "admin.dashboard", category: "SERVICES", statusOwner: "Gateway opportunity APIs", dataAuthority: "Gateway opportunity owner", status: "ACTIVE" },
  { id: "marketplace", labelAr: "السوق", labelEn: "Marketplace", icon: "apps", route: "/market", requiredCapability: "admin.dashboard", category: "SERVICES", statusOwner: "Gateway marketplace APIs", dataAuthority: "Gateway marketplace owner", status: "ACTIVE" },
  { id: "salary", labelAr: "الراتب", labelEn: "Salary", icon: "document", route: "/salary", requiredCapability: "admin.dashboard", category: "SERVICES", statusOwner: "Gateway salary authority", dataAuthority: "Gateway salary metadata", status: "ACTIVE" },
  { id: "school-grants", labelAr: "المنح المدرسية", labelEn: "School Grants", icon: "document", route: "/school-grants", requiredCapability: "admin.dashboard", category: "SERVICES", statusOwner: "Gateway school-aids authority", dataAuthority: "Gateway school-aids inventory", status: "ACTIVE" },
  { id: "crm", labelAr: "إدارة العملاء", labelEn: "CRM", icon: "users", route: "/crm", requiredCapability: "admin.dashboard", category: "OPERATIONS", statusOwner: "Gateway CRM authority", dataAuthority: "ERPNext contacts via Gateway", status: "ACTIVE" },
  { id: "erm", labelAr: "إدارة الموارد", labelEn: "ERM", icon: "briefcase", route: "/erm", requiredCapability: "admin.dashboard", category: "OPERATIONS", statusOwner: "Gateway ERM asset authority", dataAuthority: "Gateway file asset inventory", status: "ACTIVE" },
  { id: "ads", labelAr: "الإعلانات", labelEn: "Ads Gateway", icon: "apps", route: "/ads", requiredCapability: "admin.dashboard", category: "OPERATIONS", statusOwner: "Gateway Ads Authority", dataAuthority: "Provider status and placement authority", status: "ACTIVE" },
  { id: "health", labelAr: "صحة النظام", labelEn: "System Health", icon: "settings", route: "/system/health", requiredCapability: "admin.dashboard", category: "SYSTEM", statusOwner: "Gateway health/readiness", dataAuthority: "Gateway operational state", status: "ACTIVE" },
  { id: "integrations", labelAr: "التكاملات", labelEn: "Integrations", icon: "network", route: "/system/integrations", requiredCapability: "admin.dashboard", category: "SYSTEM", statusOwner: "Gateway integration state", dataAuthority: "Gateway integration owners", status: "ACTIVE" },
  { id: "audit", labelAr: "سجل التدقيق", labelEn: "Audit", icon: "audit", route: "/audit", requiredCapability: "superadmin.audit.read", category: "SYSTEM", statusOwner: "Gateway admin audit events", dataAuthority: "Gateway audit authority", status: "ACTIVE" },
  { id: "plugins", labelAr: "الإضافات", labelEn: "Plugins", icon: "apps", route: "/features", requiredCapability: "superadmin.feature_controls.read", category: "SYSTEM", statusOwner: "Gateway feature controls", dataAuthority: "Gateway feature authority", status: "ACTIVE" },
  { id: "analytics", labelAr: "التحليلات", labelEn: "Analytics", icon: "dashboard", route: "/analytics", requiredCapability: "admin.dashboard", category: "SYSTEM", statusOwner: "Gateway analytics authority", dataAuthority: "Gateway session analytics", status: "ACTIVE" },
  { id: "diagnostics", labelAr: "التشخيص", labelEn: "Diagnostics", icon: "shield", route: "/diagnostics", requiredCapability: "admin.dashboard", category: "SYSTEM", statusOwner: "Gateway diagnostics", dataAuthority: "Gateway health/readiness APIs", status: "ACTIVE" },
];

export function dashboardModulesByCategory(category: DashboardModuleCategory): DashboardModule[] {
  return DASHBOARD_MODULES.filter((module) => module.category === category);
}