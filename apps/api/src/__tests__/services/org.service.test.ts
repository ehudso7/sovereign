import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryOrgService } from "../../services/org.service.js";
import { resetStore, userStore, membershipStore } from "../../store/memory-store.js";
import { initAuditEmitter } from "../../services/audit.service.js";

describe("OrgService", () => {
  let service: InMemoryOrgService;

  beforeEach(() => {
    resetStore();
    initAuditEmitter();
    service = new InMemoryOrgService();
    userStore.create({ email: "test@example.com", name: "Test User" });
  });

  describe("create", () => {
    it("creates an org and adds creator as owner", async () => {
      const user = userStore.getByEmail("test@example.com")!;
      const result = await service.create({ name: "Test Org", slug: "test-org" }, user.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("Test Org");
        expect(result.value.slug).toBe("test-org");
        expect(result.value.plan).toBe("free");

        // Verify owner membership was created
        const membership = membershipStore.getForUser(result.value.id, user.id);
        expect(membership).toBeDefined();
        expect(membership?.role).toBe("org_owner");
      }
    });

    it("rejects duplicate slugs", async () => {
      const user = userStore.getByEmail("test@example.com")!;
      await service.create({ name: "Org 1", slug: "test-org" }, user.id);
      const result = await service.create({ name: "Org 2", slug: "test-org" }, user.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CONFLICT");
      }
    });
  });

  describe("getById", () => {
    it("returns org for a member", async () => {
      const user = userStore.getByEmail("test@example.com")!;
      const createResult = await service.create({ name: "Test Org", slug: "test-org" }, user.id);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await service.getById(createResult.value.id, user.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("Test Org");
      }
    });

    it("returns NOT_FOUND for non-member", async () => {
      const user = userStore.getByEmail("test@example.com")!;
      const createResult = await service.create({ name: "Test Org", slug: "test-org" }, user.id);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const otherUser = userStore.create({ email: "other@example.com", name: "Other" });
      const result = await service.getById(createResult.value.id, otherUser.id);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("update", () => {
    it("updates org name", async () => {
      const user = userStore.getByEmail("test@example.com")!;
      const createResult = await service.create({ name: "Test Org", slug: "test-org" }, user.id);
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await service.update(createResult.value.id, user.id, { name: "New Name" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("New Name");
      }
    });
  });

  describe("listForUser", () => {
    it("returns only orgs the user belongs to", async () => {
      const user = userStore.getByEmail("test@example.com")!;
      await service.create({ name: "Org 1", slug: "org-1" }, user.id);
      await service.create({ name: "Org 2", slug: "org-2" }, user.id);

      // Create an org owned by someone else
      const otherUser = userStore.create({ email: "other@example.com", name: "Other" });
      await service.create({ name: "Other Org", slug: "other-org" }, otherUser.id);

      const result = await service.listForUser(user.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.length).toBe(2);
        expect(result.value.total).toBe(2);
      }
    });
  });

  describe("checkSlugAvailable", () => {
    it("returns true for available slug", async () => {
      const result = await service.checkSlugAvailable("new-slug");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(true);
    });

    it("returns false for taken slug", async () => {
      const user = userStore.getByEmail("test@example.com")!;
      await service.create({ name: "Test", slug: "taken" }, user.id);
      const result = await service.checkSlugAvailable("taken");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(false);
    });
  });
});
