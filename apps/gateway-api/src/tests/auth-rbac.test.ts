import { describe, it, expect } from "vitest";
import { hasMinRole, hasPermission } from "../auth/rbac";

// Role numeric levels (mirrored from rbac.ts for test assertions)
const ROLE_LEVEL: Record<string, number> = {
  public: 0,
  accredited: 1,
  moderator: 2,
  admin: 3,
  superadmin: 4,
};

describe("RBAC", () => {
  describe("ROLE_LEVEL", () => {
    it("defines correct hierarchy", () => {
      expect(ROLE_LEVEL.public).toBe(0);
      expect(ROLE_LEVEL.accredited).toBe(1);
      expect(ROLE_LEVEL.moderator).toBe(2);
      expect(ROLE_LEVEL.admin).toBe(3);
      expect(ROLE_LEVEL.superadmin).toBe(4);
    });
  });

  describe("hasMinRole", () => {
    it("superadmin has all roles", () => {
      expect(hasMinRole("superadmin", "public")).toBe(true);
      expect(hasMinRole("superadmin", "admin")).toBe(true);
      expect(hasMinRole("superadmin", "superadmin")).toBe(true);
    });

    it("public cannot access admin", () => {
      expect(hasMinRole("public", "admin")).toBe(false);
      expect(hasMinRole("public", "moderator")).toBe(false);
    });

    it("admin can access moderator", () => {
      expect(hasMinRole("admin", "moderator")).toBe(true);
      expect(hasMinRole("admin", "admin")).toBe(true);
    });

    it("admin cannot access superadmin", () => {
      expect(hasMinRole("admin", "superadmin")).toBe(false);
    });
  });

  describe("hasPermission", () => {
    it("superadmin has all permissions", () => {
      expect(hasPermission("superadmin", "admin.dashboard")).toBe(true);
      expect(hasPermission("superadmin", "admin.users")).toBe(true);
      expect(hasPermission("superadmin", "superadmin.all")).toBe(true);
      expect(hasPermission("superadmin", "admin.rules")).toBe(true);
    });

    it("admin can manage users and dashboard but not superadmin.all", () => {
      expect(hasPermission("admin", "admin.users")).toBe(true);
      expect(hasPermission("admin", "admin.dashboard")).toBe(true);
      expect(hasPermission("admin", "superadmin.all")).toBe(false);
    });

    it("moderator can view cases and verify documents", () => {
      expect(hasPermission("moderator", "cases.view_all")).toBe(true);
      expect(hasPermission("moderator", "documents.verify")).toBe(true);
    });

    it("public can only send chat", () => {
      expect(hasPermission("public", "chat.send")).toBe(true);
      expect(hasPermission("public", "admin.users")).toBe(false);
      expect(hasPermission("public", "admin.dashboard")).toBe(false);
      expect(hasPermission("public", "superadmin.all")).toBe(false);
    });
  });
});
