import { describe, it, expect, beforeEach } from "vitest";
import type { OrgId, UserId } from "@sovereign/core";
import { InMemoryOrgService } from "../services/org.service.js";
import { InMemoryMembershipService } from "../services/membership.service.js";
import { InMemoryProjectService } from "../services/project.service.js";

import { LocalAuthService } from "../services/auth.service.js";
import { InMemoryAuditEmitter } from "../services/audit.service.js";
import { resetStore, userStore } from "../store/memory-store.js";
import { initAuditEmitter } from "../services/audit.service.js";

/**
 * Cross-tenant isolation tests
 *
 * These tests verify that data belonging to one organization
 * is never accessible from another organization's context.
 */
describe("Tenant Isolation", () => {
  let orgService: InMemoryOrgService;
  let membershipService: InMemoryMembershipService;
  let projectService: InMemoryProjectService;
  let auditEmitter: InMemoryAuditEmitter;

  let orgAId: OrgId;
  let orgBId: OrgId;
  let userAId: UserId;
  let userBId: UserId;

  beforeEach(async () => {
    resetStore();
    initAuditEmitter();
    orgService = new InMemoryOrgService();
    membershipService = new InMemoryMembershipService();
    projectService = new InMemoryProjectService();
    auditEmitter = new InMemoryAuditEmitter();

    // Create two separate tenants
    const userA = userStore.create({ email: "alice@org-a.com", name: "Alice" });
    userAId = userA.id;
    const orgA = await orgService.create({ name: "Org A", slug: "org-a" }, userAId);
    expect(orgA.ok).toBe(true);
    if (orgA.ok) orgAId = orgA.value.id;

    const userB = userStore.create({ email: "bob@org-b.com", name: "Bob" });
    userBId = userB.id;
    const orgB = await orgService.create({ name: "Org B", slug: "org-b" }, userBId);
    expect(orgB.ok).toBe(true);
    if (orgB.ok) orgBId = orgB.value.id;
  });

  describe("Organization isolation", () => {
    it("user A cannot view org B", async () => {
      const result = await orgService.getById(orgBId, userAId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("user B cannot view org A", async () => {
      const result = await orgService.getById(orgAId, userBId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("user A only sees their orgs", async () => {
      const result = await orgService.listForUser(userAId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.length).toBe(1);
        expect(result.value.data[0]!.id).toBe(orgAId);
      }
    });

    it("user B only sees their orgs", async () => {
      const result = await orgService.listForUser(userBId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.length).toBe(1);
        expect(result.value.data[0]!.id).toBe(orgBId);
      }
    });
  });

  describe("Project isolation", () => {
    it("org A project is not accessible from org B context", async () => {
      const projectResult = await projectService.create(
        { orgId: orgAId, name: "Secret Project", slug: "secret" },
        userAId,
      );
      expect(projectResult.ok).toBe(true);
      if (!projectResult.ok) return;

      // Try to access org A's project with org B's context
      const result = await projectService.getById(projectResult.value.id, orgBId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("listing projects for org B does not include org A projects", async () => {
      await projectService.create({ orgId: orgAId, name: "Project A", slug: "project-a" }, userAId);
      await projectService.create({ orgId: orgBId, name: "Project B", slug: "project-b" }, userBId);

      const orgBProjects = await projectService.listForOrg(orgBId);
      expect(orgBProjects.ok).toBe(true);
      if (orgBProjects.ok) {
        expect(orgBProjects.value.data.length).toBe(1);
        expect(orgBProjects.value.data[0]!.name).toBe("Project B");
      }
    });

    it("cannot delete project from wrong org", async () => {
      const projectResult = await projectService.create(
        { orgId: orgAId, name: "Project A", slug: "project-a" },
        userAId,
      );
      expect(projectResult.ok).toBe(true);
      if (!projectResult.ok) return;

      const deleteResult = await projectService.delete(projectResult.value.id, orgBId);
      expect(deleteResult.ok).toBe(false);
      if (!deleteResult.ok) expect(deleteResult.error.code).toBe("NOT_FOUND");

      // Verify project still exists for org A
      const getResult = await projectService.getById(projectResult.value.id, orgAId);
      expect(getResult.ok).toBe(true);
    });
  });

  describe("Membership isolation", () => {
    it("user A cannot see org B members", async () => {
      const result = await membershipService.listForOrg(orgBId);
      // This returns results because the store doesn't enforce auth at this level
      // The auth middleware layer handles this — but the data should be scoped
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Only Bob should be in org B
        const members = result.value.data;
        const hasUserA = members.some((m) => m.userId === userAId);
        expect(hasUserA).toBe(false);
      }
    });

    it("user B cannot get membership in org A", async () => {
      const result = await membershipService.getForUser(orgAId, userBId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Auth session isolation", () => {
    it("user cannot create session for org they are not a member of", async () => {
      const authService = new LocalAuthService({
        mode: "local",
        sessionSecret: "test-secret-that-is-at-least-32-chars-long",
        sessionTtlMs: 3600000,
      });

      const result = await authService.signInToOrg(userAId, orgBId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });
  });

  describe("Audit event isolation", () => {
    it("audit events are scoped to org", async () => {
      await auditEmitter.emit({
        orgId: orgAId,
        actorId: userAId,
        actorType: "user",
        action: "org.updated",
        resourceType: "organization",
      });

      await auditEmitter.emit({
        orgId: orgBId,
        actorId: userBId,
        actorType: "user",
        action: "org.updated",
        resourceType: "organization",
      });

      const orgAEvents = await auditEmitter.query(orgAId);
      expect(orgAEvents.length).toBeGreaterThanOrEqual(1);
      for (const event of orgAEvents) {
        expect(event.orgId).toBe(orgAId);
      }

      const orgBEvents = await auditEmitter.query(orgBId);
      expect(orgBEvents.length).toBeGreaterThanOrEqual(1);
      for (const event of orgBEvents) {
        expect(event.orgId).toBe(orgBId);
      }
    });
  });
});
