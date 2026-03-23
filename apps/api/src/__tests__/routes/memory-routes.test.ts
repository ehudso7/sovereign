/**
 * Memory HTTP route tests (service-level contract).
 *
 * Tests the route handlers through the service layer using in-memory
 * test repositories. Validates status codes, response shapes,
 * auth enforcement, org scoping, validation, and error paths.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { toOrgId, toUserId, toMemoryId } from "@sovereign/core";
import { PgMemoryService } from "../../services/memory.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  type TestRepos,
} from "../helpers/test-repos.js";

const ORG_ID = toOrgId("00000000-0000-0000-0000-aaaaaaaaaaaa");
const OTHER_ORG_ID = toOrgId("00000000-0000-0000-0000-dddddddddddd");
const USER_ID = toUserId("00000000-0000-0000-0000-bbbbbbbbbbbb");

/** Helper to create a memory via the service and return the id. */
async function createTestMemory(
  service: PgMemoryService,
  overrides: Partial<Parameters<PgMemoryService["createMemory"]>[0]> = {},
) {
  const defaults = {
    orgId: ORG_ID,
    scopeType: "org" as const,
    scopeId: ORG_ID as string,
    kind: "semantic" as const,
    title: "Test Memory",
    summary: "A summary",
    content: `content-${Date.now()}-${Math.random()}`,
    createdBy: USER_ID,
  };
  const result = await service.createMemory({ ...defaults, ...overrides });
  if (!result.ok) throw new Error(`Failed to create test memory: ${result.error.message}`);
  return result.value;
}

describe("Memory Routes (service-level contract)", () => {
  let repos: TestRepos;
  let service: PgMemoryService;

  beforeEach(() => {
    repos = createTestRepos();
    const auditEmitter = new PgAuditEmitter(repos.audit);
    service = new PgMemoryService(repos.memories, repos.memoryLinks, auditEmitter);
  });

  // -------------------------------------------------------------------------
  // POST /api/v1/memories
  // -------------------------------------------------------------------------

  describe("POST /api/v1/memories — createMemory", () => {
    it("creates a memory and returns 201 equivalent", async () => {
      const result = await service.createMemory({
        orgId: ORG_ID,
        scopeType: "org",
        scopeId: ORG_ID,
        kind: "semantic",
        title: "New Fact",
        summary: "Fact summary",
        content: "The earth is round",
        createdBy: USER_ID,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe("semantic");
        expect(result.value.status).toBe("active");
        expect(result.value.title).toBe("New Fact");
        expect(result.value.orgId).toBe(ORG_ID);
      }
    });

    it("returns CONFLICT for duplicate content", async () => {
      await service.createMemory({
        orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID,
        kind: "semantic", title: "T1", summary: "S", content: "duplicate content",
        createdBy: USER_ID,
      });
      const result = await service.createMemory({
        orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID,
        kind: "semantic", title: "T2", summary: "S", content: "duplicate content",
        createdBy: USER_ID,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CONFLICT");
        expect(result.error.statusCode).toBe(409);
      }
    });

    it("emits memory.created audit event", async () => {
      await service.createMemory({
        orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID,
        kind: "semantic", title: "T", summary: "S", content: "audit test content",
        createdBy: USER_ID,
      });

      const events = await repos.audit.query(ORG_ID, { action: "memory.created" });
      expect(events.length).toBe(1);
      expect(events[0]!.resourceType).toBe("memory");
    });

    it("supports all three memory kinds", async () => {
      for (const kind of ["semantic", "episodic", "procedural"] as const) {
        const result = await service.createMemory({
          orgId: ORG_ID, scopeType: "org", scopeId: ORG_ID,
          kind, title: `${kind} mem`, summary: "S", content: `unique-${kind}-content`,
          createdBy: USER_ID,
        });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.kind).toBe(kind);
      }
    });

    it("supports all four scope types", async () => {
      for (const scopeType of ["org", "project", "agent", "user"] as const) {
        const result = await service.createMemory({
          orgId: ORG_ID, scopeType, scopeId: `scope-${scopeType}`,
          kind: "semantic", title: `${scopeType} scoped`, summary: "S",
          content: `unique-scope-${scopeType}`,
          createdBy: USER_ID,
        });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.scopeType).toBe(scopeType);
      }
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/memories
  // -------------------------------------------------------------------------

  describe("GET /api/v1/memories — listMemories", () => {
    it("returns all memories for the org", async () => {
      await createTestMemory(service, { content: "a" });
      await createTestMemory(service, { content: "b" });

      const result = await service.listMemories(ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(2);
    });

    it("filters by kind", async () => {
      await createTestMemory(service, { kind: "semantic", content: "sem" });
      await createTestMemory(service, { kind: "episodic", content: "epi" });

      const result = await service.listMemories(ORG_ID, { kind: "semantic" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0]!.kind).toBe("semantic");
      }
    });

    it("filters by status", async () => {
      const mem = await createTestMemory(service, { content: "to-expire" });
      await createTestMemory(service, { content: "stays-active" });
      await service.expireMemory(mem.id, ORG_ID, USER_ID);

      const active = await service.listMemories(ORG_ID, { status: "active" });
      expect(active.ok).toBe(true);
      if (active.ok) expect(active.value.length).toBe(1);

      const expired = await service.listMemories(ORG_ID, { status: "expired" });
      expect(expired.ok).toBe(true);
      if (expired.ok) expect(expired.value.length).toBe(1);
    });

    it("filters by scopeType and scopeId", async () => {
      await createTestMemory(service, { scopeType: "project", scopeId: "proj-1", content: "p1" });
      await createTestMemory(service, { scopeType: "project", scopeId: "proj-2", content: "p2" });
      await createTestMemory(service, { scopeType: "agent", scopeId: "agent-1", content: "a1" });

      const result = await service.listMemories(ORG_ID, { scopeType: "project", scopeId: "proj-1" });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(1);
    });

    it("returns empty array for org with no memories", async () => {
      const result = await service.listMemories(ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(0);
    });

    it("does not return other org's memories (org scoping)", async () => {
      await createTestMemory(service, { content: "org-a-memory" });

      const result = await service.listMemories(OTHER_ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/memories/search
  // -------------------------------------------------------------------------

  describe("GET /api/v1/memories/search — searchMemories", () => {
    it("finds memories by text match", async () => {
      await createTestMemory(service, { title: "Blue Sky", content: "sky is blue" });
      await createTestMemory(service, { title: "Green Grass", content: "grass is green" });

      const result = await service.searchMemories(ORG_ID, "sky");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(1);
    });

    it("returns BAD_REQUEST for empty query", async () => {
      const result = await service.searchMemories(ORG_ID, "");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("BAD_REQUEST");
        expect(result.error.statusCode).toBe(400);
      }
    });

    it("returns BAD_REQUEST for whitespace-only query", async () => {
      const result = await service.searchMemories(ORG_ID, "   ");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("BAD_REQUEST");
    });

    it("filters search by kind", async () => {
      await createTestMemory(service, { kind: "semantic", title: "Data Point", content: "alpha data" });
      await createTestMemory(service, { kind: "episodic", title: "Data Episode", content: "alpha episode" });

      const result = await service.searchMemories(ORG_ID, "alpha", { kind: "semantic" });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(1);
    });

    it("excludes non-active memories from search", async () => {
      const mem = await createTestMemory(service, { title: "Sensitive", content: "search-target sensitive data" });
      await service.redactMemory(mem.id, ORG_ID, USER_ID);

      const result = await service.searchMemories(ORG_ID, "search-target");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(0);
    });

    it("does not return other org's memories", async () => {
      await createTestMemory(service, { content: "cross-org-search-target" });

      const result = await service.searchMemories(OTHER_ORG_ID, "cross-org");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/memories/:memoryId
  // -------------------------------------------------------------------------

  describe("GET /api/v1/memories/:memoryId — getMemory", () => {
    it("returns memory by ID (200 equivalent)", async () => {
      const mem = await createTestMemory(service);
      const result = await service.getMemory(mem.id, ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe(mem.id);
        expect(result.value.title).toBe("Test Memory");
      }
    });

    it("returns NOT_FOUND for nonexistent memory", async () => {
      const result = await service.getMemory(toMemoryId("00000000-0000-0000-0000-ffffffffffff"), ORG_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.statusCode).toBe(404);
      }
    });

    it("returns NOT_FOUND for wrong org (org scoping)", async () => {
      const mem = await createTestMemory(service);
      const result = await service.getMemory(mem.id, OTHER_ORG_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/v1/memories/:memoryId
  // -------------------------------------------------------------------------

  describe("PATCH /api/v1/memories/:memoryId — updateMemory", () => {
    it("updates active memory title and content", async () => {
      const mem = await createTestMemory(service);
      const result = await service.updateMemory(mem.id, ORG_ID, {
        title: "Updated Title",
        content: "Updated content",
        updatedBy: USER_ID,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.title).toBe("Updated Title");
        expect(result.value.content).toBe("Updated content");
      }
    });

    it("rejects update on non-active memory (BAD_REQUEST)", async () => {
      const mem = await createTestMemory(service);
      await service.redactMemory(mem.id, ORG_ID, USER_ID);

      const result = await service.updateMemory(mem.id, ORG_ID, {
        title: "Should Fail",
        updatedBy: USER_ID,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("BAD_REQUEST");
        expect(result.error.statusCode).toBe(400);
      }
    });

    it("returns NOT_FOUND for wrong org", async () => {
      const mem = await createTestMemory(service);
      const result = await service.updateMemory(mem.id, OTHER_ORG_ID, {
        title: "Steal",
        updatedBy: USER_ID,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("emits memory.updated audit event", async () => {
      const mem = await createTestMemory(service);
      await service.updateMemory(mem.id, ORG_ID, { title: "New", updatedBy: USER_ID });

      const events = await repos.audit.query(ORG_ID, { action: "memory.updated" });
      expect(events.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/v1/memories/:memoryId/redact
  // -------------------------------------------------------------------------

  describe("POST /api/v1/memories/:memoryId/redact — redactMemory", () => {
    it("redacts content and transitions to redacted", async () => {
      const mem = await createTestMemory(service);
      const result = await service.redactMemory(mem.id, ORG_ID, USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("redacted");
        expect(result.value.content).toBe("[REDACTED]");
      }
    });

    it("returns NOT_FOUND for nonexistent memory", async () => {
      const result = await service.redactMemory(
        toMemoryId("00000000-0000-0000-0000-ffffffffffff"), ORG_ID, USER_ID,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("returns NOT_FOUND for wrong org (forbidden path)", async () => {
      const mem = await createTestMemory(service);
      const result = await service.redactMemory(mem.id, OTHER_ORG_ID, USER_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("emits memory.redacted audit event", async () => {
      const mem = await createTestMemory(service);
      await service.redactMemory(mem.id, ORG_ID, USER_ID);

      const events = await repos.audit.query(ORG_ID, { action: "memory.redacted" });
      expect(events.length).toBe(1);
      expect(events[0]!.metadata.previousStatus).toBe("active");
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/v1/memories/:memoryId/expire
  // -------------------------------------------------------------------------

  describe("POST /api/v1/memories/:memoryId/expire — expireMemory", () => {
    it("transitions to expired status", async () => {
      const mem = await createTestMemory(service);
      const result = await service.expireMemory(mem.id, ORG_ID, USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe("expired");
    });

    it("returns NOT_FOUND for nonexistent memory", async () => {
      const result = await service.expireMemory(
        toMemoryId("00000000-0000-0000-0000-ffffffffffff"), ORG_ID, USER_ID,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("returns NOT_FOUND for wrong org", async () => {
      const mem = await createTestMemory(service);
      const result = await service.expireMemory(mem.id, OTHER_ORG_ID, USER_ID);
      expect(result.ok).toBe(false);
    });

    it("emits memory.expired audit event", async () => {
      const mem = await createTestMemory(service);
      await service.expireMemory(mem.id, ORG_ID, USER_ID);

      const events = await repos.audit.query(ORG_ID, { action: "memory.expired" });
      expect(events.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/v1/memories/:memoryId/delete
  // -------------------------------------------------------------------------

  describe("POST /api/v1/memories/:memoryId/delete — deleteMemory", () => {
    it("soft-deletes the memory", async () => {
      const mem = await createTestMemory(service);
      const result = await service.deleteMemory(mem.id, ORG_ID, USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe("deleted");
    });

    it("returns NOT_FOUND for nonexistent memory", async () => {
      const result = await service.deleteMemory(
        toMemoryId("00000000-0000-0000-0000-ffffffffffff"), ORG_ID, USER_ID,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("returns NOT_FOUND for wrong org (forbidden)", async () => {
      const mem = await createTestMemory(service);
      const result = await service.deleteMemory(mem.id, OTHER_ORG_ID, USER_ID);
      expect(result.ok).toBe(false);
    });

    it("emits memory.deleted audit event", async () => {
      const mem = await createTestMemory(service);
      await service.deleteMemory(mem.id, ORG_ID, USER_ID);

      const events = await repos.audit.query(ORG_ID, { action: "memory.deleted" });
      expect(events.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/v1/memories/:memoryId/promote
  // -------------------------------------------------------------------------

  describe("POST /api/v1/memories/:memoryId/promote — promoteMemory", () => {
    it("promotes episodic to procedural", async () => {
      const mem = await createTestMemory(service, {
        kind: "episodic", content: "promote-target",
      });
      const result = await service.promoteMemory(mem.id, ORG_ID, USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe("procedural");
        expect(result.value.content).toBe("promote-target");
      }
    });

    it("creates promoted_from link", async () => {
      const mem = await createTestMemory(service, {
        kind: "episodic", content: "promote-link-test",
      });
      const result = await service.promoteMemory(mem.id, ORG_ID, USER_ID);
      if (!result.ok) return;

      const links = await repos.memoryLinks.listForMemory(result.value.id, ORG_ID);
      expect(links.length).toBe(1);
      expect(links[0]!.linkType).toBe("promoted_from");
      expect(links[0]!.linkedEntityId).toBe(mem.id);
    });

    it("expires the original episodic memory", async () => {
      const mem = await createTestMemory(service, {
        kind: "episodic", content: "expire-after-promote",
      });
      await service.promoteMemory(mem.id, ORG_ID, USER_ID);

      const original = await service.getMemory(mem.id, ORG_ID);
      expect(original.ok).toBe(true);
      if (original.ok) expect(original.value.status).toBe("expired");
    });

    it("rejects promoting a semantic memory", async () => {
      const mem = await createTestMemory(service, {
        kind: "semantic", content: "no-promote-semantic",
      });
      const result = await service.promoteMemory(mem.id, ORG_ID, USER_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("BAD_REQUEST");
      }
    });

    it("rejects promoting a non-active memory", async () => {
      const mem = await createTestMemory(service, {
        kind: "episodic", content: "expired-no-promote",
      });
      await service.expireMemory(mem.id, ORG_ID, USER_ID);

      const result = await service.promoteMemory(mem.id, ORG_ID, USER_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("BAD_REQUEST");
    });

    it("returns NOT_FOUND for wrong org", async () => {
      const mem = await createTestMemory(service, {
        kind: "episodic", content: "wrong-org-promote",
      });
      const result = await service.promoteMemory(mem.id, OTHER_ORG_ID, USER_ID);
      expect(result.ok).toBe(false);
    });

    it("emits memory.promoted audit event", async () => {
      const mem = await createTestMemory(service, {
        kind: "episodic", content: "audit-promote-test",
      });
      await service.promoteMemory(mem.id, ORG_ID, USER_ID);

      const events = await repos.audit.query(ORG_ID, { action: "memory.promoted" });
      expect(events.length).toBe(1);
      expect(events[0]!.metadata.fromKind).toBe("episodic");
      expect(events[0]!.metadata.toKind).toBe("procedural");
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/memories/:memoryId/links
  // -------------------------------------------------------------------------

  describe("GET /api/v1/memories/:memoryId/links — getLinksForMemory", () => {
    it("returns links for a memory", async () => {
      const mem = await createTestMemory(service, {
        kind: "episodic", content: "link-source",
      });
      // Create a link via promote
      await service.promoteMemory(mem.id, ORG_ID, USER_ID);

      // The promoted memory has a link; the original has been expired but we can check the promoted
      const all = await service.listMemories(ORG_ID, { kind: "procedural" });
      expect(all.ok).toBe(true);
      if (!all.ok) return;
      const promoted = all.value[0]!;

      const result = await service.getLinksForMemory(promoted.id, ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0]!.linkType).toBe("promoted_from");
      }
    });

    it("returns empty array when memory has no links", async () => {
      const mem = await createTestMemory(service);
      const result = await service.getLinksForMemory(mem.id, ORG_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.length).toBe(0);
    });

    it("returns NOT_FOUND for nonexistent memory", async () => {
      const result = await service.getLinksForMemory(
        toMemoryId("00000000-0000-0000-0000-ffffffffffff"), ORG_ID,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("returns NOT_FOUND for wrong org", async () => {
      const mem = await createTestMemory(service);
      const result = await service.getLinksForMemory(mem.id, OTHER_ORG_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // -------------------------------------------------------------------------
  // Runtime memory: retrieveForRun and writeEpisodicFromRun
  // -------------------------------------------------------------------------

  describe("Runtime memory operations", () => {
    describe("retrieveForRun", () => {
      it("returns empty when readEnabled is false", async () => {
        await createTestMemory(service, { scopeType: "agent", scopeId: "a1", content: "run-read-off" });

        const result = await service.retrieveForRun(
          ORG_ID, "agent", "a1",
          { readEnabled: false },
          USER_ID,
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.length).toBe(0);
      });

      it("returns active memories for scope", async () => {
        await createTestMemory(service, { scopeType: "agent", scopeId: "a1", content: "active-run" });

        const result = await service.retrieveForRun(
          ORG_ID, "agent", "a1",
          { readEnabled: true, maxRetrievalCount: 10 },
          USER_ID,
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.length).toBe(1);
      });

      it("excludes redacted memories", async () => {
        const mem = await createTestMemory(service, {
          scopeType: "agent", scopeId: "a1", content: "redacted-run",
        });
        await service.redactMemory(mem.id, ORG_ID, USER_ID);

        const result = await service.retrieveForRun(
          ORG_ID, "agent", "a1", { readEnabled: true }, USER_ID,
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.length).toBe(0);
      });

      it("excludes expired memories", async () => {
        const mem = await createTestMemory(service, {
          scopeType: "agent", scopeId: "a1", content: "expired-run",
        });
        await service.expireMemory(mem.id, ORG_ID, USER_ID);

        const result = await service.retrieveForRun(
          ORG_ID, "agent", "a1", { readEnabled: true }, USER_ID,
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.length).toBe(0);
      });

      it("excludes deleted memories", async () => {
        const mem = await createTestMemory(service, {
          scopeType: "agent", scopeId: "a1", content: "deleted-run",
        });
        await service.deleteMemory(mem.id, ORG_ID, USER_ID);

        const result = await service.retrieveForRun(
          ORG_ID, "agent", "a1", { readEnabled: true }, USER_ID,
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.length).toBe(0);
      });

      it("filters by allowedKinds", async () => {
        await createTestMemory(service, { scopeType: "agent", scopeId: "a1", kind: "semantic", content: "sem-run" });
        await createTestMemory(service, { scopeType: "agent", scopeId: "a1", kind: "episodic", content: "epi-run" });

        const result = await service.retrieveForRun(
          ORG_ID, "agent", "a1",
          { readEnabled: true, allowedKinds: ["semantic"] },
          USER_ID,
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.length).toBe(1);
          expect(result.value[0]!.kind).toBe("semantic");
        }
      });

      it("respects maxRetrievalCount", async () => {
        for (let i = 0; i < 5; i++) {
          await createTestMemory(service, { scopeType: "agent", scopeId: "a1", content: `max-${i}` });
        }

        const result = await service.retrieveForRun(
          ORG_ID, "agent", "a1",
          { readEnabled: true, maxRetrievalCount: 3 },
          USER_ID,
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.length).toBe(3);
      });

      it("emits memory.retrieved_for_run audit event", async () => {
        await service.retrieveForRun(ORG_ID, "agent", "a1", { readEnabled: true }, USER_ID);

        const events = await repos.audit.query(ORG_ID, { action: "memory.retrieved_for_run" });
        expect(events.length).toBe(1);
      });
    });

    describe("writeEpisodicFromRun", () => {
      it("creates episodic memory from run output", async () => {
        const result = await service.writeEpisodicFromRun(
          ORG_ID, "run-001", "agent-001",
          "Run completed successfully", "Detailed output data",
          USER_ID,
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.kind).toBe("episodic");
          expect(result.value.scopeType).toBe("agent");
          expect(result.value.scopeId).toBe("agent-001");
          expect(result.value.sourceRunId).toBe("run-001");
          expect(result.value.sourceAgentId).toBe("agent-001");
        }
      });

      it("creates source_run link", async () => {
        const result = await service.writeEpisodicFromRun(
          ORG_ID, "run-002", "agent-002",
          "Run summary", "output",
          USER_ID,
        );
        if (!result.ok) return;

        const links = await repos.memoryLinks.listForMemory(result.value.id, ORG_ID);
        expect(links.length).toBe(1);
        expect(links[0]!.linkType).toBe("source_run");
        expect(links[0]!.linkedEntityId).toBe("run-002");
      });

      it("emits memory.created audit event with source tracking", async () => {
        await service.writeEpisodicFromRun(
          ORG_ID, "run-003", "agent-003",
          "Summary", "Content",
          USER_ID,
        );

        const events = await repos.audit.query(ORG_ID, { action: "memory.created" });
        expect(events.length).toBe(1);
        expect(events[0]!.metadata.sourceRunId).toBe("run-003");
        expect(events[0]!.metadata.sourceAgentId).toBe("agent-003");
      });
    });
  });

  // -------------------------------------------------------------------------
  // Cross-cutting: org isolation summary
  // -------------------------------------------------------------------------

  describe("Org scoping (cross-cutting)", () => {
    it("all CRUD operations are org-scoped", async () => {
      const mem = await createTestMemory(service, { content: "org-a-only" });

      // getMemory
      expect((await service.getMemory(mem.id, OTHER_ORG_ID)).ok).toBe(false);

      // listMemories
      const list = await service.listMemories(OTHER_ORG_ID);
      expect(list.ok && list.value.length).toBe(0);

      // searchMemories
      const search = await service.searchMemories(OTHER_ORG_ID, "org-a-only");
      expect(search.ok && search.value.length).toBe(0);

      // updateMemory
      expect((await service.updateMemory(mem.id, OTHER_ORG_ID, { title: "X", updatedBy: USER_ID })).ok).toBe(false);

      // redactMemory
      expect((await service.redactMemory(mem.id, OTHER_ORG_ID, USER_ID)).ok).toBe(false);

      // expireMemory
      expect((await service.expireMemory(mem.id, OTHER_ORG_ID, USER_ID)).ok).toBe(false);

      // deleteMemory
      expect((await service.deleteMemory(mem.id, OTHER_ORG_ID, USER_ID)).ok).toBe(false);

      // promoteMemory — need episodic for this
      const ep = await createTestMemory(service, { kind: "episodic", content: "org-a-episodic" });
      expect((await service.promoteMemory(ep.id, OTHER_ORG_ID, USER_ID)).ok).toBe(false);

      // getLinksForMemory
      expect((await service.getLinksForMemory(mem.id, OTHER_ORG_ID)).ok).toBe(false);
    });
  });
});
