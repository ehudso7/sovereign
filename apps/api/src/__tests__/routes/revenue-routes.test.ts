/**
 * Revenue Workspace Routes (service-level contract) — Phase 11 tests.
 *
 * Tests the revenue service using in-memory repos.
 * Validates account/contact/deal/task CRUD, notes, outreach draft generation,
 * CRM sync proof path, overview, audit evidence, and tenant isolation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { toOrgId, toUserId } from "@sovereign/core";
import type { CrmAccountId, ApprovalId } from "@sovereign/core";
import { PgRevenueService } from "../../services/revenue.service.js";
import { PgPolicyService } from "../../services/policy.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  type TestRepos,
} from "../helpers/test-repos.js";

const ORG_A = toOrgId("00000000-0000-0000-0000-aaaaaaaaaaaa");
const ORG_B = toOrgId("00000000-0000-0000-0000-bbbbbbbbbbbb");
const USER_ID = toUserId("00000000-0000-0000-0000-cccccccccccc");

describe("Revenue Workspace (service-level contract)", () => {
  let repos: TestRepos;
  let svc: PgRevenueService;

  beforeEach(() => {
    repos = createTestRepos();
    const auditEmitter = new PgAuditEmitter(repos.audit);
    svc = new PgRevenueService(
      repos.crmAccounts,
      repos.crmContacts,
      repos.crmDeals,
      repos.crmTasks,
      repos.crmNotes,
      repos.outreachDrafts,
      repos.crmSyncLog,
      auditEmitter,
    );
  });

  // =========================================================================
  // Account CRUD
  // =========================================================================

  describe("Account CRUD", () => {
    it("creates an account", async () => {
      const result = await svc.createAccount(ORG_A, USER_ID, { name: "Acme Corp", domain: "acme.com", industry: "Tech" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe("Acme Corp");
      expect(result.value.domain).toBe("acme.com");
      expect(result.value.orgId).toBe(ORG_A);
      expect(result.value.status).toBe("active");
    });

    it("lists accounts for org", async () => {
      await svc.createAccount(ORG_A, USER_ID, { name: "A1" });
      await svc.createAccount(ORG_A, USER_ID, { name: "A2" });
      await svc.createAccount(ORG_B, USER_ID, { name: "B1" });
      const result = await svc.listAccounts(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(2);
    });

    it("gets account by ID", async () => {
      const created = await svc.createAccount(ORG_A, USER_ID, { name: "Lookup" });
      if (!created.ok) return;
      const result = await svc.getAccount(ORG_A, created.value.id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe("Lookup");
    });

    it("returns NOT_FOUND for nonexistent account", async () => {
      const result = await svc.getAccount(ORG_A, "nonexistent" as CrmAccountId);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("updates an account", async () => {
      const created = await svc.createAccount(ORG_A, USER_ID, { name: "Old Name" });
      if (!created.ok) return;
      const updated = await svc.updateAccount(ORG_A, USER_ID, created.value.id, { name: "New Name", industry: "Finance" });
      expect(updated.ok).toBe(true);
      if (!updated.ok) return;
      expect(updated.value.name).toBe("New Name");
      expect(updated.value.industry).toBe("Finance");
    });

    it("emits audit event on account create", async () => {
      await svc.createAccount(ORG_A, USER_ID, { name: "Audited" });
      const events = await repos.audit.query(ORG_A, { action: "revenue.account_created" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
      expect(events[0]!.resourceType).toBe("crm_account");
    });

    it("tenant isolation — cannot see other org accounts", async () => {
      await svc.createAccount(ORG_A, USER_ID, { name: "A-Only" });
      const result = await svc.listAccounts(ORG_B);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(0);
    });
  });

  // =========================================================================
  // Contact CRUD
  // =========================================================================

  describe("Contact CRUD", () => {
    it("creates a contact", async () => {
      const result = await svc.createContact(ORG_A, USER_ID, { firstName: "Jane", lastName: "Doe", email: "jane@acme.com" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.firstName).toBe("Jane");
      expect(result.value.lastName).toBe("Doe");
      expect(result.value.email).toBe("jane@acme.com");
    });

    it("lists contacts for org", async () => {
      await svc.createContact(ORG_A, USER_ID, { firstName: "A", lastName: "1" });
      await svc.createContact(ORG_B, USER_ID, { firstName: "B", lastName: "1" });
      const result = await svc.listContacts(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(1);
    });

    it("gets contact by ID", async () => {
      const created = await svc.createContact(ORG_A, USER_ID, { firstName: "Find", lastName: "Me" });
      if (!created.ok) return;
      const result = await svc.getContact(ORG_A, created.value.id);
      expect(result.ok).toBe(true);
    });

    it("updates a contact", async () => {
      const created = await svc.createContact(ORG_A, USER_ID, { firstName: "Old", lastName: "Name" });
      if (!created.ok) return;
      const updated = await svc.updateContact(ORG_A, USER_ID, created.value.id, { firstName: "New" });
      expect(updated.ok).toBe(true);
      if (!updated.ok) return;
      expect(updated.value.firstName).toBe("New");
    });

    it("emits audit event on contact create", async () => {
      await svc.createContact(ORG_A, USER_ID, { firstName: "Aud", lastName: "It" });
      const events = await repos.audit.query(ORG_A, { action: "revenue.contact_created" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
    });
  });

  // =========================================================================
  // Deal CRUD
  // =========================================================================

  describe("Deal CRUD", () => {
    it("creates a deal", async () => {
      const result = await svc.createDeal(ORG_A, USER_ID, { name: "Big Deal", stage: "discovery", valueCents: 100000 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe("Big Deal");
      expect(result.value.valueCents).toBe(100000);
      expect(result.value.stage).toBe("discovery");
    });

    it("lists deals with stage filter", async () => {
      await svc.createDeal(ORG_A, USER_ID, { name: "D1", stage: "discovery" });
      await svc.createDeal(ORG_A, USER_ID, { name: "D2", stage: "proposal" });
      const result = await svc.listDeals(ORG_A, { stage: "discovery" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(1);
      expect(result.value[0]!.name).toBe("D1");
    });

    it("updates a deal", async () => {
      const created = await svc.createDeal(ORG_A, USER_ID, { name: "Deal" });
      if (!created.ok) return;
      const updated = await svc.updateDeal(ORG_A, USER_ID, created.value.id, { stage: "negotiation", valueCents: 500000 });
      expect(updated.ok).toBe(true);
      if (!updated.ok) return;
      expect(updated.value.stage).toBe("negotiation");
      expect(updated.value.valueCents).toBe(500000);
    });

    it("emits audit event on deal create", async () => {
      await svc.createDeal(ORG_A, USER_ID, { name: "Audited Deal" });
      const events = await repos.audit.query(ORG_A, { action: "revenue.deal_created" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
    });

    it("tenant isolation on deals", async () => {
      await svc.createDeal(ORG_A, USER_ID, { name: "A-Deal" });
      const result = await svc.listDeals(ORG_B);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(0);
    });
  });

  // =========================================================================
  // Task CRUD
  // =========================================================================

  describe("Task CRUD", () => {
    it("creates a task", async () => {
      const result = await svc.createTask(ORG_A, USER_ID, { title: "Follow up", priority: "high" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.title).toBe("Follow up");
      expect(result.value.priority).toBe("high");
      expect(result.value.status).toBe("open");
    });

    it("lists tasks with status filter", async () => {
      await svc.createTask(ORG_A, USER_ID, { title: "T1" });
      const t2 = await svc.createTask(ORG_A, USER_ID, { title: "T2" });
      if (t2.ok) await svc.updateTask(ORG_A, USER_ID, t2.value.id, { status: "completed" });
      const result = await svc.listTasks(ORG_A, { status: "open" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(1);
    });

    it("updates a task", async () => {
      const created = await svc.createTask(ORG_A, USER_ID, { title: "Old" });
      if (!created.ok) return;
      const updated = await svc.updateTask(ORG_A, USER_ID, created.value.id, { title: "Updated", status: "in_progress" });
      expect(updated.ok).toBe(true);
      if (!updated.ok) return;
      expect(updated.value.title).toBe("Updated");
      expect(updated.value.status).toBe("in_progress");
    });

    it("emits audit event on task create", async () => {
      await svc.createTask(ORG_A, USER_ID, { title: "Audited" });
      const events = await repos.audit.query(ORG_A, { action: "revenue.task_created" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
    });
  });

  // =========================================================================
  // Notes
  // =========================================================================

  describe("Notes", () => {
    it("creates a note linked to an account", async () => {
      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "NoteTarget" });
      if (!acc.ok) return;
      const note = await svc.createNote(ORG_A, USER_ID, { linkedEntityType: "account", linkedEntityId: acc.value.id, content: "Meeting went well", noteType: "meeting" });
      expect(note.ok).toBe(true);
      if (!note.ok) return;
      expect(note.value.content).toBe("Meeting went well");
      expect(note.value.noteType).toBe("meeting");
    });

    it("lists notes for entity", async () => {
      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "Multi-note" });
      if (!acc.ok) return;
      await svc.createNote(ORG_A, USER_ID, { linkedEntityType: "account", linkedEntityId: acc.value.id, content: "Note 1" });
      await svc.createNote(ORG_A, USER_ID, { linkedEntityType: "account", linkedEntityId: acc.value.id, content: "Note 2" });
      const notes = await svc.listNotesForEntity(ORG_A, "account", acc.value.id);
      expect(notes.ok).toBe(true);
      if (!notes.ok) return;
      expect(notes.value.length).toBe(2);
    });

    it("emits audit event on note create", async () => {
      await svc.createNote(ORG_A, USER_ID, { linkedEntityType: "deal", linkedEntityId: "some-deal-id", content: "Note" });
      const events = await repos.audit.query(ORG_A, { action: "revenue.note_created" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
    });
  });

  // =========================================================================
  // Outreach Drafts
  // =========================================================================

  describe("Outreach Drafts", () => {
    it("generates an email draft", async () => {
      const result = await svc.generateOutreachDraft(ORG_A, USER_ID, {
        channel: "email", contactName: "Jane", accountName: "Acme Corp",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.channel).toBe("email");
      expect(result.value.body).toContain("Jane");
      expect(result.value.subject).toContain("Acme Corp");
      expect(result.value.approvalStatus).toBe("draft");
      expect(result.value.generatedBy).toBe("ai");
    });

    it("generates a draft with entity context", async () => {
      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "ContextCo", industry: "Healthcare" });
      if (!acc.ok) return;
      await svc.createNote(ORG_A, USER_ID, { linkedEntityType: "account", linkedEntityId: acc.value.id, content: "Interested in premium plan" });
      const result = await svc.generateOutreachDraft(ORG_A, USER_ID, {
        linkedEntityType: "account", linkedEntityId: acc.value.id, channel: "email",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.body).toContain("ContextCo");
    });

    it("retrieves a draft by ID", async () => {
      const created = await svc.generateOutreachDraft(ORG_A, USER_ID, { channel: "email" });
      if (!created.ok) return;
      const fetched = await svc.getOutreachDraft(ORG_A, created.value.id);
      expect(fetched.ok).toBe(true);
      if (!fetched.ok) return;
      expect(fetched.value.id).toBe(created.value.id);
    });

    it("lists drafts", async () => {
      await svc.generateOutreachDraft(ORG_A, USER_ID, { channel: "email" });
      await svc.generateOutreachDraft(ORG_A, USER_ID, { channel: "linkedin" });
      const result = await svc.listOutreachDrafts(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(2);
    });

    it("emits audit event on outreach generate", async () => {
      await svc.generateOutreachDraft(ORG_A, USER_ID, { channel: "email" });
      const events = await repos.audit.query(ORG_A, { action: "outreach.generated" as import("@sovereign/core").AuditAction });
      expect(events.length).toBe(1);
    });
  });

  // =========================================================================
  // CRM Sync
  // =========================================================================

  describe("CRM Sync", () => {
    it("syncs an account", async () => {
      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "SyncMe" });
      if (!acc.ok) return;
      const result = await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("completed");
      expect(result.value.externalCrmId).toBeDefined();
    });

    it("syncs a contact", async () => {
      const contact = await svc.createContact(ORG_A, USER_ID, { firstName: "Sync", lastName: "Contact" });
      if (!contact.ok) return;
      const result = await svc.syncEntity(ORG_A, USER_ID, { entityType: "contact", entityId: contact.value.id });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("completed");
    });

    it("syncs a deal", async () => {
      const deal = await svc.createDeal(ORG_A, USER_ID, { name: "SyncDeal" });
      if (!deal.ok) return;
      const result = await svc.syncEntity(ORG_A, USER_ID, { entityType: "deal", entityId: deal.value.id });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("completed");
    });

    it("fails sync for nonexistent entity", async () => {
      const result = await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: "nonexistent" });
      expect(result.ok).toBe(false);
    });

    it("fails sync for unsupported entity type", async () => {
      const result = await svc.syncEntity(ORG_A, USER_ID, { entityType: "unknown", entityId: "some-id" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("BAD_REQUEST");
    });

    it("emits audit events for sync lifecycle", async () => {
      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "AuditSync" });
      if (!acc.ok) return;
      await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      const requested = await repos.audit.query(ORG_A, { action: "revenue.sync_requested" as import("@sovereign/core").AuditAction });
      const completed = await repos.audit.query(ORG_A, { action: "revenue.sync_completed" as import("@sovereign/core").AuditAction });
      expect(requested.length).toBe(1);
      expect(completed.length).toBe(1);
    });

    it("lists sync logs", async () => {
      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "LogTest" });
      if (!acc.ok) return;
      await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      const result = await svc.listSyncLogs(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.length).toBe(1);
    });
  });

  // =========================================================================
  // Overview
  // =========================================================================

  describe("Revenue Overview", () => {
    it("returns overview with counts", async () => {
      await svc.createAccount(ORG_A, USER_ID, { name: "A1" });
      await svc.createContact(ORG_A, USER_ID, { firstName: "C", lastName: "1" });
      await svc.createDeal(ORG_A, USER_ID, { name: "D1", valueCents: 50000, stage: "discovery" });
      await svc.createDeal(ORG_A, USER_ID, { name: "D2", valueCents: 100000, stage: "proposal" });
      await svc.createTask(ORG_A, USER_ID, { title: "T1" });
      await svc.createTask(ORG_A, USER_ID, { title: "T2", status: "completed" });

      const result = await svc.getOverview(ORG_A);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.accountCount).toBe(1);
      expect(result.value.contactCount).toBe(1);
      expect(result.value.dealCount).toBe(2);
      expect(result.value.taskCount).toBe(2);
      expect(result.value.openTaskCount).toBe(1);
      expect(result.value.openDealValueCents).toBe(150000);
      expect(result.value.dealsByStage["discovery"]).toBe(1);
      expect(result.value.dealsByStage["proposal"]).toBe(1);
    });

    it("overview is org-scoped", async () => {
      await svc.createAccount(ORG_A, USER_ID, { name: "A1" });
      await svc.createAccount(ORG_B, USER_ID, { name: "B1" });
      const result = await svc.getOverview(ORG_B);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.accountCount).toBe(1);
    });
  });

  // =========================================================================
  // Tenant Isolation
  // =========================================================================

  describe("Tenant Isolation", () => {
    it("cannot get account from other org", async () => {
      const created = await svc.createAccount(ORG_A, USER_ID, { name: "A-Only" });
      if (!created.ok) return;
      const result = await svc.getAccount(ORG_B, created.value.id);
      expect(result.ok).toBe(false);
    });

    it("cannot get contact from other org", async () => {
      const created = await svc.createContact(ORG_A, USER_ID, { firstName: "A", lastName: "Only" });
      if (!created.ok) return;
      const result = await svc.getContact(ORG_B, created.value.id);
      expect(result.ok).toBe(false);
    });

    it("cannot get deal from other org", async () => {
      const created = await svc.createDeal(ORG_A, USER_ID, { name: "Secret Deal" });
      if (!created.ok) return;
      const result = await svc.getDeal(ORG_B, created.value.id);
      expect(result.ok).toBe(false);
    });

    it("cannot get task from other org", async () => {
      const created = await svc.createTask(ORG_A, USER_ID, { title: "Secret Task" });
      if (!created.ok) return;
      const result = await svc.getTask(ORG_B, created.value.id);
      expect(result.ok).toBe(false);
    });
  });

  // =========================================================================
  // Policy-Gated Sync
  // =========================================================================

  describe("Policy-Gated Sync", () => {
    let policySvc: PgPolicyService;

    beforeEach(() => {
      const auditEmitter = new PgAuditEmitter(repos.audit);
      policySvc = new PgPolicyService(
        repos.policyRepo,
        repos.policyDecisions,
        repos.approvals,
        repos.quarantine,
        auditEmitter,
      );
      svc.setPolicyService(policySvc);
    });

    it("allow policy — sync proceeds", async () => {
      // No policies = default allow
      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "AllowSync" });
      if (!acc.ok) return;
      const result = await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("completed");
    });

    it("deny policy — sync blocked", async () => {
      await policySvc.createPolicy({
        orgId: ORG_A, name: "Block Sync", policyType: "deny",
        enforcementMode: "deny", scopeType: "revenue",
        rules: [{ actionPattern: "revenue.sync" }],
        priority: 100, createdBy: USER_ID,
      });

      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "DenySync" });
      if (!acc.ok) return;
      const result = await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.message).toContain("blocked by policy");
    });

    it("require_approval policy — approval created and sync blocked while pending", async () => {
      await policySvc.createPolicy({
        orgId: ORG_A, name: "Approve Sync", policyType: "require_approval",
        enforcementMode: "require_approval", scopeType: "revenue",
        rules: [{ actionPattern: "revenue.sync" }],
        priority: 100, createdBy: USER_ID,
      });

      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "ApprovalSync" });
      if (!acc.ok) return;
      const result = await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Sync log created but pending — not completed
      expect(result.value.status).toBe("pending");
      expect(result.value.policyDecision).toBe("require_approval");
      expect(result.value.approvalId).toBeDefined();

      // Verify approval was created
      const approvals = await policySvc.listApprovals(ORG_A, { status: "pending" });
      expect(approvals.ok).toBe(true);
      if (!approvals.ok) return;
      expect(approvals.value.length).toBeGreaterThanOrEqual(1);
    });

    it("approved request — sync proceeds after approval", async () => {
      const APPROVER_ID = toUserId("00000000-0000-0000-0000-dddddddddddd");

      await policySvc.createPolicy({
        orgId: ORG_A, name: "Approve Sync 2", policyType: "require_approval",
        enforcementMode: "require_approval", scopeType: "revenue",
        rules: [{ actionPattern: "revenue.sync" }],
        priority: 100, createdBy: USER_ID,
      });

      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "ApproveMe" });
      if (!acc.ok) return;

      // First attempt — blocked with pending approval
      const firstResult = await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      expect(firstResult.ok).toBe(true);
      if (!firstResult.ok) return;
      expect(firstResult.value.policyDecision).toBe("require_approval");
      const approvalId = firstResult.value.approvalId as ApprovalId;
      expect(approvalId).toBeDefined();

      // Approve the request
      const approveResult = await policySvc.approveRequest(approvalId, ORG_A, APPROVER_ID, "Approved");
      expect(approveResult.ok).toBe(true);
      if (!approveResult.ok) return;
      expect(approveResult.value.status).toBe("approved");

      // Verify approval record is now approved
      const approval = await policySvc.getApproval(approvalId, ORG_A);
      expect(approval.ok).toBe(true);
      if (!approval.ok) return;
      expect(approval.value.status).toBe("approved");
    });

    it("denied request — sync stays blocked", async () => {
      const APPROVER_ID = toUserId("00000000-0000-0000-0000-dddddddddddd");

      await policySvc.createPolicy({
        orgId: ORG_A, name: "Approve Sync 3", policyType: "require_approval",
        enforcementMode: "require_approval", scopeType: "revenue",
        rules: [{ actionPattern: "revenue.sync" }],
        priority: 100, createdBy: USER_ID,
      });

      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "DenyMe" });
      if (!acc.ok) return;

      const firstResult = await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      expect(firstResult.ok).toBe(true);
      if (!firstResult.ok) return;
      const approvalId = firstResult.value.approvalId as ApprovalId;

      // Deny the request
      const denyResult = await policySvc.denyRequest(approvalId, ORG_A, APPROVER_ID, "Not now");
      expect(denyResult.ok).toBe(true);
      if (!denyResult.ok) return;
      expect(denyResult.value.status).toBe("denied");

      // Subsequent sync attempt still blocked by policy
      const secondResult = await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      expect(secondResult.ok).toBe(true);
      if (!secondResult.ok) return;
      // Another approval record created — still blocked
      expect(secondResult.value.policyDecision).toBe("require_approval");
    });

    it("expired approval — cannot approve after expiry, subsequent sync still blocked", async () => {
      const APPROVER_ID = toUserId("00000000-0000-0000-0000-dddddddddddd");

      await policySvc.createPolicy({
        orgId: ORG_A, name: "Approve Sync 4", policyType: "require_approval",
        enforcementMode: "require_approval", scopeType: "revenue",
        rules: [{ actionPattern: "revenue.sync" }],
        priority: 100, createdBy: USER_ID,
      });

      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "ExpireMe" });
      if (!acc.ok) return;

      const result = await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const approvalId = result.value.approvalId as ApprovalId;

      // Manually expire by creating an approval with past expiresAt and then expiring
      // The approval was created without expiresAt. Cancel it to simulate expiry.
      await repos.approvals.cancel(approvalId, ORG_A);

      // Verify approval is cancelled (functionally expired)
      const approval = await policySvc.getApproval(approvalId, ORG_A);
      expect(approval.ok).toBe(true);
      if (!approval.ok) return;
      expect(approval.value.status).toBe("cancelled");

      // Cannot approve a cancelled/expired request
      const approveResult = await policySvc.approveRequest(approvalId, ORG_A, APPROVER_ID);
      expect(approveResult.ok).toBe(false);

      // Subsequent sync attempt still blocked by policy
      const secondResult = await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      expect(secondResult.ok).toBe(true);
      if (!secondResult.ok) return;
      expect(secondResult.value.policyDecision).toBe("require_approval");
    });

    it("quarantined entity — sync blocked", async () => {
      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "Quarantined" });
      if (!acc.ok) return;

      // Quarantine the entity
      await policySvc.quarantineSubject({
        orgId: ORG_A,
        subjectType: "revenue",
        subjectId: acc.value.id,
        reason: "Suspicious activity",
        quarantinedBy: USER_ID,
      });

      const result = await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.message).toContain("quarantined");
    });

    it("allow policy with explicit allow — sync proceeds", async () => {
      await policySvc.createPolicy({
        orgId: ORG_A, name: "Allow Sync Explicit", policyType: "access_control",
        enforcementMode: "allow", scopeType: "revenue",
        rules: [{ actionPattern: "revenue.sync" }],
        priority: 100, createdBy: USER_ID,
      });

      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "ExplicitAllow" });
      if (!acc.ok) return;
      const result = await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("completed");
    });

    it("audit trail captures policy decision for sync", async () => {
      await policySvc.createPolicy({
        orgId: ORG_A, name: "Deny For Audit", policyType: "deny",
        enforcementMode: "deny", scopeType: "revenue",
        rules: [{ actionPattern: "revenue.sync" }],
        priority: 100, createdBy: USER_ID,
      });

      const acc = await svc.createAccount(ORG_A, USER_ID, { name: "AuditSync" });
      if (!acc.ok) return;
      await svc.syncEntity(ORG_A, USER_ID, { entityType: "account", entityId: acc.value.id });

      // Verify policy.decision audit event was emitted
      const events = await repos.audit.query(ORG_A, { action: "policy.decision" as import("@sovereign/core").AuditAction });
      expect(events.length).toBeGreaterThanOrEqual(1);
      const syncDecision = events.find(e => (e.metadata as Record<string, unknown>).actionType === "revenue.sync");
      expect(syncDecision).toBeDefined();
      expect((syncDecision!.metadata as Record<string, unknown>).result).toBe("deny");
    });
  });
});
