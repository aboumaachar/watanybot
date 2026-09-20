/**
 * RBAC - Role-Based Access Control.
 *
 * Role hierarchy: public < accredited < driver < moderator < admin < superadmin
 */
import type { UserRole } from "@watany/types";
import type { FastifyRequest, FastifyReply } from "fastify";

const ROLE_LEVEL: Record<UserRole, number> = {
  public: 0,
  accredited: 1,
  driver: 2,
  moderator: 3,
  admin: 4,
  superadmin: 5,
};

export const PERMISSIONS = {
  "chat.send": ["public", "accredited", "moderator", "admin", "superadmin"],
  "chat.history": ["accredited", "moderator", "admin", "superadmin"],
  "cases.create": ["accredited", "driver", "moderator", "admin", "superadmin"],
  "cases.view_all": ["moderator", "admin", "superadmin"],
  "documents.upload": ["accredited", "moderator", "admin", "superadmin"],
  "documents.verify": ["moderator", "admin", "superadmin"],
  "forms.download": ["accredited", "driver", "moderator", "admin", "superadmin"],
  "marketplace.post": ["accredited", "driver", "moderator", "admin", "superadmin"],
  "taxi.driver": ["driver", "admin", "superadmin"],
  "admin.dashboard": ["admin", "superadmin"],
  "admin.users": ["admin", "superadmin"],
  "admin.rules": ["admin", "superadmin"],
  "superadmin.all": ["superadmin"],
  "superadmin.shell.read": ["superadmin"],
  "superadmin.audit.read": ["superadmin"],
  "superadmin.feature_controls.read": ["superadmin"],
  "superadmin.feature_controls.write": ["superadmin"],
  "superadmin.system.read": ["superadmin"],
  "cms.read": ["admin", "superadmin"],
  "cms.create": ["superadmin"],
  "cms.edit": ["superadmin"],
  "cms.publish": ["superadmin"],
  "cms.unpublish": ["superadmin"],
  "cms.archive": ["superadmin"],
  "cms.restore": ["superadmin"],
  "cms.audit.read": ["superadmin"],
  "cms.version.read": ["superadmin"],
  "cms.bulk.manage": ["superadmin"],
  "cms.procedures.read": ["admin", "superadmin"],
  "cms.procedures.attachments.manage": ["superadmin"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
}

export function hasPermission(role: UserRole, perm: Permission): boolean {
  return (PERMISSIONS[perm] as readonly string[]).includes(role);
}

export type CanonicalAdminPrincipal = {
  id: string;
  role: UserRole;
  email: string;
  capabilities: readonly string[];
  authenticated: true;
};

export type AuthorizationDecision = {
  allowed: boolean;
  statusCode: 200 | 401 | 403;
  reason: "ALLOWED" | "NO_AUTHENTICATED_PRINCIPAL" | "INSUFFICIENT_ROLE" | "MISSING_CAPABILITY";
  principal?: CanonicalAdminPrincipal;
};

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && value in ROLE_LEVEL;
}

function capabilitiesForRole(role: UserRole): string[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) => hasPermission(role, permission));
}

export function getCanonicalAdminPrincipal(request: FastifyRequest): CanonicalAdminPrincipal | null {
  const user = request.user;
  if (!user || !user.id || !user.email || !isUserRole(user.role)) {
    return null;
  }

  return { id: user.id, role: user.role, email: user.email, capabilities: capabilitiesForRole(user.role), authenticated: true };
}

export function authorizePrincipal(
  request: FastifyRequest,
  requirement: { minRole?: UserRole; capability?: string },
): AuthorizationDecision {
  const principal = getCanonicalAdminPrincipal(request);
  if (!principal) {
    return { allowed: false, statusCode: 401, reason: "NO_AUTHENTICATED_PRINCIPAL" };
  }
  if (requirement.minRole && !hasMinRole(principal.role, requirement.minRole)) {
    return { allowed: false, statusCode: 403, reason: "INSUFFICIENT_ROLE", principal };
  }
  if (requirement.capability && principal.role !== "superadmin" && !principal.capabilities.includes(requirement.capability)) {
    return { allowed: false, statusCode: 403, reason: "MISSING_CAPABILITY", principal };
  }
  return { allowed: true, statusCode: 200, reason: "ALLOWED", principal };
}

function isDevelopmentAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV === "development"
    && process.env.ALLOW_DEV_ADMIN_FALLBACK === "true"
    && [process.env.DISABLE_AUTH, process.env.AUTH_BYPASS_FOR_TESTING].some((value) => value?.trim().toLowerCase() === "true");
}

function getDevelopmentSuperadminRole(request: FastifyRequest): UserRole | null {
  if (process.env.NODE_ENV === "production") return null;
  const headerRole = request.headers["x-watany-role"];
  return typeof headerRole === "string" && headerRole.trim().toLowerCase() === "superadmin" ? "superadmin" : null;
}

export function requireRole(minRole: UserRole) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (isDevelopmentAuthBypassEnabled() && getDevelopmentSuperadminRole(request)) {
      request.user = {
        id: process.env.DEV_SUPERADMIN_ID || "dev-superadmin",
        role: "superadmin",
        email: process.env.DEV_SUPERADMIN_EMAIL || "admin@koudama.com",
      };
    } else {
      const devRole = getDevelopmentSuperadminRole(request);
      if (devRole && hasMinRole(devRole, minRole)) {
        request.user = {
          id: process.env.DEV_SUPERADMIN_ID || "dev-superadmin",
          role: devRole,
          email: process.env.DEV_SUPERADMIN_EMAIL || "admin@koudama.com",
        };
      }
    }

    const decision = authorizePrincipal(request, { minRole });
    if (!decision.allowed) {
      return reply.code(decision.statusCode).send({
        error: decision.statusCode === 401 ? "غير مصرح - يرجى تسجيل الدخول" : "صلاحيات غير كافية",
      });
    }
  };
}
