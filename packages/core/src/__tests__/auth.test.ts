import { describe, it, expect } from "vitest";
import {
  isValidRole,
  roleLevel,
  canManageRole,
  permissionsForRole,
  hasPermission,
  ORG_ROLES,
} from "../auth.js";

describe("auth", () => {
  describe("isValidRole", () => {
    it("accepts all defined roles", () => {
      for (const role of ORG_ROLES) {
        expect(isValidRole(role)).toBe(true);
      }
    });

    it("rejects invalid roles", () => {
      expect(isValidRole("admin")).toBe(false);
      expect(isValidRole("superuser")).toBe(false);
      expect(isValidRole("")).toBe(false);
    });
  });

  describe("roleLevel", () => {
    it("assigns correct hierarchy", () => {
      expect(roleLevel("org_owner")).toBeGreaterThan(roleLevel("org_admin"));
      expect(roleLevel("org_admin")).toBeGreaterThan(roleLevel("org_member"));
      expect(roleLevel("org_billing_admin")).toBeGreaterThan(roleLevel("org_member"));
      expect(roleLevel("org_security_admin")).toBeGreaterThan(roleLevel("org_member"));
    });
  });

  describe("canManageRole", () => {
    it("owner can manage all lower roles", () => {
      expect(canManageRole("org_owner", "org_admin")).toBe(true);
      expect(canManageRole("org_owner", "org_member")).toBe(true);
      expect(canManageRole("org_owner", "org_billing_admin")).toBe(true);
      expect(canManageRole("org_owner", "org_security_admin")).toBe(true);
    });

    it("admin can manage members and specialty admins", () => {
      expect(canManageRole("org_admin", "org_member")).toBe(true);
      expect(canManageRole("org_admin", "org_billing_admin")).toBe(true);
      expect(canManageRole("org_admin", "org_security_admin")).toBe(true);
    });

    it("admin cannot manage owners or other admins", () => {
      expect(canManageRole("org_admin", "org_owner")).toBe(false);
      expect(canManageRole("org_admin", "org_admin")).toBe(false);
    });

    it("member cannot manage anyone", () => {
      expect(canManageRole("org_member", "org_member")).toBe(false);
      expect(canManageRole("org_member", "org_admin")).toBe(false);
    });

    it("owner cannot manage other owners", () => {
      expect(canManageRole("org_owner", "org_owner")).toBe(false);
    });
  });

  describe("permissionsForRole", () => {
    it("owner has all permissions", () => {
      const perms = permissionsForRole("org_owner");
      expect(perms).toContain("org:read");
      expect(perms).toContain("org:update");
      expect(perms).toContain("org:delete");
      expect(perms).toContain("org:manage_members");
      expect(perms).toContain("org:manage_roles");
      expect(perms).toContain("project:create");
      expect(perms).toContain("project:delete");
    });

    it("member has limited permissions", () => {
      const perms = permissionsForRole("org_member");
      expect(perms).toContain("org:read");
      expect(perms).toContain("project:read");
      expect(perms).not.toContain("org:update");
      expect(perms).not.toContain("org:manage_members");
      expect(perms).not.toContain("project:create");
    });

    it("billing admin has billing but not security", () => {
      const perms = permissionsForRole("org_billing_admin");
      expect(perms).toContain("org:manage_billing");
      expect(perms).not.toContain("org:manage_security");
    });

    it("security admin has security but not billing", () => {
      const perms = permissionsForRole("org_security_admin");
      expect(perms).toContain("org:manage_security");
      expect(perms).toContain("org:view_audit");
      expect(perms).not.toContain("org:manage_billing");
    });
  });

  describe("hasPermission", () => {
    it("returns true for granted permission", () => {
      expect(hasPermission("org_owner", "org:delete")).toBe(true);
    });

    it("returns false for denied permission", () => {
      expect(hasPermission("org_member", "org:delete")).toBe(false);
    });
  });
});
