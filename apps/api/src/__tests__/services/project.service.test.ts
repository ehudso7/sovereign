import { describe, it, expect, beforeEach } from "vitest";
import type { OrgId, UserId } from "@sovereign/core";
import { InMemoryProjectService } from "../../services/project.service.js";
import { InMemoryOrgService } from "../../services/org.service.js";
import { resetStore, userStore } from "../../store/memory-store.js";
import { initAuditEmitter } from "../../services/audit.service.js";

describe("ProjectService", () => {
  let service: InMemoryProjectService;
  let ownerId: UserId;
  let orgId: OrgId;

  beforeEach(async () => {
    resetStore();
    initAuditEmitter();
    service = new InMemoryProjectService();

    const owner = userStore.create({ email: "owner@example.com", name: "Owner" });
    ownerId = owner.id;

    const orgService = new InMemoryOrgService();
    const orgResult = await orgService.create({ name: "Test Org", slug: "test-org" }, ownerId);
    expect(orgResult.ok).toBe(true);
    if (orgResult.ok) orgId = orgResult.value.id;
  });

  describe("create", () => {
    it("creates a project", async () => {
      const result = await service.create({
        orgId,
        name: "My Project",
        slug: "my-project",
        description: "A test project",
      }, ownerId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("My Project");
        expect(result.value.slug).toBe("my-project");
        expect(result.value.orgId).toBe(orgId);
      }
    });

    it("rejects duplicate slugs within org", async () => {
      await service.create({ orgId, name: "Project 1", slug: "my-project" }, ownerId);
      const result = await service.create({ orgId, name: "Project 2", slug: "my-project" }, ownerId);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("CONFLICT");
    });
  });

  describe("getById", () => {
    it("returns project for correct org", async () => {
      const createResult = await service.create({ orgId, name: "Project", slug: "project" }, ownerId);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await service.getById(createResult.value.id, orgId);
      expect(result.ok).toBe(true);
    });

    it("returns NOT_FOUND for wrong org (cross-tenant protection)", async () => {
      const createResult = await service.create({ orgId, name: "Project", slug: "project" }, ownerId);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const otherUser = userStore.create({ email: "other@example.com", name: "Other" });
      const orgService = new InMemoryOrgService();
      const otherOrgResult = await orgService.create({ name: "Other Org", slug: "other-org" }, otherUser.id);
      expect(otherOrgResult.ok).toBe(true);
      if (!otherOrgResult.ok) return;

      const result = await service.getById(createResult.value.id, otherOrgResult.value.id);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  describe("listForOrg", () => {
    it("returns only projects for the specified org", async () => {
      await service.create({ orgId, name: "Project 1", slug: "p1" }, ownerId);
      await service.create({ orgId, name: "Project 2", slug: "p2" }, ownerId);

      const result = await service.listForOrg(orgId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.length).toBe(2);
      }
    });
  });

  describe("delete", () => {
    it("deletes a project", async () => {
      const createResult = await service.create({ orgId, name: "Project", slug: "project" }, ownerId);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const deleteResult = await service.delete(createResult.value.id, orgId);
      expect(deleteResult.ok).toBe(true);

      const getResult = await service.getById(createResult.value.id, orgId);
      expect(getResult.ok).toBe(false);
    });

    it("returns NOT_FOUND for wrong org", async () => {
      const createResult = await service.create({ orgId, name: "Project", slug: "project" }, ownerId);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const otherUser = userStore.create({ email: "other@example.com", name: "Other" });
      const orgService = new InMemoryOrgService();
      const otherOrgResult = await orgService.create({ name: "Other Org", slug: "other-org" }, otherUser.id);
      expect(otherOrgResult.ok).toBe(true);
      if (!otherOrgResult.ok) return;

      const deleteResult = await service.delete(createResult.value.id, otherOrgResult.value.id);
      expect(deleteResult.ok).toBe(false);
    });
  });
});
