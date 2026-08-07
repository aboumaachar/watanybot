export const SUPERADMIN_USER_MANAGEMENT_POLICY = {
  requiredRole: "SUPERADMIN",
  activeWindowMinutes: 15,
  birthdayLookaheadDays: 14,
  ipCollectionEnabled: true,
  ipCollectionPurpose: "security_audit_and_user_management",
  exposeIpToRoles: ["SUPERADMIN"],
  retentionRecommendationDays: 180,
  privacyNoticeAr:
    "يقوم النظام بتسجيل عنوان IP لأغراض الحماية، التدقيق، ومنع إساءة الاستخدام. هذه البيانات تظهر فقط للمشرف العام.",
};

export function isSuperadminLike(value: unknown): boolean {
  if (!value) return false;

  if (typeof value === "string") {
    return value.toUpperCase() === "SUPERADMIN";
  }

  if (Array.isArray(value)) {
    return value.some((role) => isSuperadminLike(role));
  }

  return false;
}
