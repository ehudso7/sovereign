/**
 * Permission enforcement tests for Agent Studio.
 *
 * Verifies that the permission model correctly gates agent actions
 * by role: org_owner and org_admin can create/update/publish/archive,
 * org_member can only read.
 */

import { describe, it, expect } from "vitest";
import {
  hasPermission,
  permissionsForRole,
  type Permission,
  type OrgRole,
} from "@sovereign/core";

describe("Agent Studio permission model", () => {
  const agentPermissions: Permission[] = [
    "agent:create",
    "agent:read",
    "agent:update",
    "agent:publish",
    "agent:archive",
  ];

  describe("org_owner", () => {
    const role: OrgRole = "org_owner";

    it("has all agent permissions", () => {
      const perms = permissionsForRole(role);
      for (const p of agentPermissions) {
        expect(perms).toContain(p);
        expect(hasPermission(role, p)).toBe(true);
      }
    });
  });

  describe("org_admin", () => {
    const role: OrgRole = "org_admin";

    it("has all agent permissions", () => {
      const perms = permissionsForRole(role);
      for (const p of agentPermissions) {
        expect(perms).toContain(p);
        expect(hasPermission(role, p)).toBe(true);
      }
    });
  });

  describe("org_member", () => {
    const role: OrgRole = "org_member";

    it("can only read agents", () => {
      expect(hasPermission(role, "agent:read")).toBe(true);
    });

    it("cannot create agents", () => {
      expect(hasPermission(role, "agent:create")).toBe(false);
    });

    it("cannot update agents", () => {
      expect(hasPermission(role, "agent:update")).toBe(false);
    });

    it("cannot publish agents", () => {
      expect(hasPermission(role, "agent:publish")).toBe(false);
    });

    it("cannot archive agents", () => {
      expect(hasPermission(role, "agent:archive")).toBe(false);
    });
  });

  describe("org_billing_admin", () => {
    const role: OrgRole = "org_billing_admin";

    it("can only read agents", () => {
      expect(hasPermission(role, "agent:read")).toBe(true);
      expect(hasPermission(role, "agent:create")).toBe(false);
      expect(hasPermission(role, "agent:update")).toBe(false);
      expect(hasPermission(role, "agent:publish")).toBe(false);
      expect(hasPermission(role, "agent:archive")).toBe(false);
    });
  });

  describe("org_security_admin", () => {
    const role: OrgRole = "org_security_admin";

    it("can read agents but not mutate", () => {
      expect(hasPermission(role, "agent:read")).toBe(true);
      expect(hasPermission(role, "agent:create")).toBe(false);
      expect(hasPermission(role, "agent:update")).toBe(false);
      expect(hasPermission(role, "agent:publish")).toBe(false);
      expect(hasPermission(role, "agent:archive")).toBe(false);
    });
  });

  describe("permission mapping summary", () => {
    it("only org_owner and org_admin have write permissions", () => {
      const writePerms: Permission[] = [
        "agent:create",
        "agent:update",
        "agent:publish",
        "agent:archive",
      ];

      const allRoles: OrgRole[] = [
        "org_owner",
        "org_admin",
        "org_member",
        "org_billing_admin",
        "org_security_admin",
      ];

      for (const perm of writePerms) {
        const rolesWithPerm = allRoles.filter((r) => hasPermission(r, perm));
        expect(rolesWithPerm).toEqual(["org_owner", "org_admin"]);
      }
    });

    it("all roles can read agents", () => {
      const allRoles: OrgRole[] = [
        "org_owner",
        "org_admin",
        "org_member",
        "org_billing_admin",
        "org_security_admin",
      ];

      for (const role of allRoles) {
        expect(hasPermission(role, "agent:read")).toBe(true);
      }
    });
  });
});
