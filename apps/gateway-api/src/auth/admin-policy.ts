import type { UserRole } from "@watany/types";

const DEFAULT_ADMIN_EMAIL = "cdt99@hotmail.com";

function configuredAdminEmails(): Set<string> {
  const configured = process.env.WATANY_ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL;
  return new Set(configured.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export function isConfiguredAdminEmail(email: string | undefined): boolean {
  return Boolean(email && configuredAdminEmails().has(email.trim().toLowerCase()));
}

export function effectiveUserRole(email: string | undefined, role: UserRole): UserRole {
  return isConfiguredAdminEmail(email) ? "superadmin" : role;
}