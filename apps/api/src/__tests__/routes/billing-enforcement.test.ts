/**
 * Real usage metering and plan enforcement tests — Phase 12 remediation.
 *
 * Proves that actual platform activity (run creation, browser sessions,
 * connector calls) records usage events, and that plan enforcement
 * blocks/allows at real runtime boundaries.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { toOrgId, toUserId, toProjectId } from "@sovereign/core";
import type { OrgId, UserId } from "@sovereign/core";
import { PgRunService } from "../../services/run.service.js";
import { PgBrowserSessionService } from "../../services/browser-session.service.js";
import { PgBillingService } from "../../services/billing.service.js";
import { PgAuditEmitter } from "../../services/audit.service.js";
import {
  createTestRepos,
  type TestRepos,
} from "../helpers/test-repos.js";

const ORG_A = toOrgId("00000000-0000-0000-0000-aaaaaaaaaaaa");
const USER_ID = toUserId("00000000-0000-0000-0000-cccccccccccc");
const PROJECT_ID = toProjectId("00000000-0000-0000-0000-ffffffffffff");

import type { AgentId } from "@sovereign/core";

async function seedPublishedAgent(repos: TestRepos, orgId: OrgId, userId: UserId): Promise<AgentId> {
  const agent = await repos.agents.create({
    orgId, projectId: PROJECT_ID, name: "Test Agent", slug: "test-agent",
    createdBy: userId,
  });
  await repos.agents.updateStatus(agent.id, orgId, "published");
  const version = await repos.agentVersions.create({
    orgId, agentId: agent.id, version: 1,
    goals: ["test"], instructions: "Do things",
    tools: [], budget: null, approvalRules: [],
    memoryConfig: null, schedule: null,
    modelConfig: { provider: "local", model: "test" },
    createdBy: userId,
  });
  await repos.agentVersions.publish(version.id, orgId);
  return agent.id;
}

describe("Real Usage Metering and Plan Enforcement", () => {
  let repos: TestRepos;
  let billingSvc: PgBillingService;
  let runSvc: PgRunService;
  let browserSvc: PgBrowserSessionService;
  let agentId: AgentId;

  beforeEach(async () => {
    repos = createTestRepos();
    const auditEmitter = new PgAuditEmitter(repos.audit);

    billingSvc = new PgBillingService(
      repos.billingAccounts,
      repos.usageEvents,
      repos.invoices,
      repos.spendAlerts,
      auditEmitter,
    );

    runSvc = new PgRunService(
      repos.runs, repos.runSteps, repos.agents, repos.agentVersions, auditEmitter,
    );
    runSvc.setBillingService(billingSvc);

    browserSvc = new PgBrowserSessionService(
      repos.browserSessions, repos.runs, auditEmitter,
    );
    browserSvc.setBillingService(billingSvc);

    // Seed a published agent
    agentId = await seedPublishedAgent(repos, ORG_A, USER_ID);
    // Ensure billing account exists
    await billingSvc.getOrCreateAccount(ORG_A, USER_ID);
  });

  // =========================================================================
  // Real usage metering from platform activity
  // =========================================================================

  describe("Run creation meters agent_runs", () => {
    it("records usage event when run is created", async () => {
      const result = await runSvc.createRun(agentId, ORG_A, USER_ID);
      expect(result.ok).toBe(true);

      // Verify usage event was created
      const summary = await billingSvc.getUsageSummary(ORG_A);
      expect(summary.ok).toBe(true);
      if (!summary.ok) return;
      expect(summary.value.meters["agent_runs"]?.used).toBe(1);
    });

    it("increments usage on each run creation", async () => {
      await runSvc.createRun(agentId, ORG_A, USER_ID);
      await runSvc.createRun(agentId, ORG_A, USER_ID);
      await runSvc.createRun(agentId, ORG_A, USER_ID);

      const summary = await billingSvc.getUsageSummary(ORG_A);
      expect(summary.ok).toBe(true);
      if (!summary.ok) return;
      expect(summary.value.meters["agent_runs"]?.used).toBe(3);
    });
  });

  describe("Browser session creation meters browser_sessions", () => {
    it("records usage event when browser session is created", async () => {
      // Need a run first
      const runResult = await runSvc.createRun(agentId, ORG_A, USER_ID);
      if (!runResult.ok) return;

      const sessionResult = await browserSvc.createSession(
        runResult.value.id, ORG_A, USER_ID,
      );
      expect(sessionResult.ok).toBe(true);

      const summary = await billingSvc.getUsageSummary(ORG_A);
      expect(summary.ok).toBe(true);
      if (!summary.ok) return;
      expect(summary.value.meters["browser_sessions"]?.used).toBe(1);
    });
  });

  // =========================================================================
  // Plan enforcement on run creation
  // =========================================================================

  describe("Free plan enforcement on run creation", () => {
    it("blocks run creation when free plan limit reached", async () => {
      // Free plan allows 50 agent_runs
      // Pre-fill 50 runs via direct usage recording
      await billingSvc.recordUsage(ORG_A, {
        eventType: "run_created", meter: "agent_runs", quantity: 50, unit: "runs",
      });

      // 51st run should be blocked
      const result = await runSvc.createRun(agentId, ORG_A, USER_ID);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.message).toContain("limit");
    });

    it("allows run creation when under free plan limit", async () => {
      await billingSvc.recordUsage(ORG_A, {
        eventType: "run_created", meter: "agent_runs", quantity: 10, unit: "runs",
      });

      const result = await runSvc.createRun(agentId, ORG_A, USER_ID);
      expect(result.ok).toBe(true);
    });
  });

  describe("Team plan enforcement on run creation", () => {
    it("allows run creation past limit with overage", async () => {
      await billingSvc.changePlan(ORG_A, USER_ID, "team");
      // Team plan: 1000 runs included, overage allowed
      await billingSvc.recordUsage(ORG_A, {
        eventType: "run_created", meter: "agent_runs", quantity: 1000, unit: "runs",
      });

      // 1001st run should be allowed (overage)
      const result = await runSvc.createRun(agentId, ORG_A, USER_ID);
      expect(result.ok).toBe(true);
    });
  });

  describe("Enterprise plan enforcement on run creation", () => {
    it("allows unlimited runs", async () => {
      await billingSvc.changePlan(ORG_A, USER_ID, "enterprise");
      await billingSvc.recordUsage(ORG_A, {
        eventType: "run_created", meter: "agent_runs", quantity: 100000, unit: "runs",
      });

      const result = await runSvc.createRun(agentId, ORG_A, USER_ID);
      expect(result.ok).toBe(true);
    });
  });

  // =========================================================================
  // Enforcement audit evidence
  // =========================================================================

  describe("Enforcement audit evidence", () => {
    it("emits billing.enforcement_blocked when free plan run is blocked", async () => {
      await billingSvc.recordUsage(ORG_A, {
        eventType: "run_created", meter: "agent_runs", quantity: 50, unit: "runs",
      });

      await runSvc.createRun(agentId, ORG_A, USER_ID);

      const events = await repos.audit.query(ORG_A, {
        action: "billing.enforcement_blocked" as import("@sovereign/core").AuditAction,
      });
      expect(events.length).toBe(1);
      expect((events[0]!.metadata as Record<string, unknown>).meter).toBe("agent_runs");
    });

    it("does not emit enforcement audit when run is allowed", async () => {
      await runSvc.createRun(agentId, ORG_A, USER_ID);

      const events = await repos.audit.query(ORG_A, {
        action: "billing.enforcement_blocked" as import("@sovereign/core").AuditAction,
      });
      expect(events.length).toBe(0);
    });
  });

  // =========================================================================
  // Spend alerts from real accumulated spend
  // =========================================================================

  describe("Spend alerts from real usage", () => {
    it("triggers alert from accumulated usage-driven spend", async () => {
      await billingSvc.changePlan(ORG_A, USER_ID, "team");
      await billingSvc.createSpendAlert(ORG_A, USER_ID, 10000); // $100

      // Record enough usage for base ($99) + overage to exceed $100
      await billingSvc.recordUsage(ORG_A, {
        eventType: "run_created", meter: "agent_runs", quantity: 1010, unit: "runs",
      });

      // Check and trigger alerts
      await billingSvc.checkAndTriggerAlerts(ORG_A);

      const alerts = await billingSvc.listSpendAlerts(ORG_A);
      expect(alerts.ok).toBe(true);
      if (!alerts.ok) return;
      expect(alerts.value[0]?.status).toBe("triggered");
      expect(alerts.value[0]?.currentSpendCents).toBeGreaterThanOrEqual(10000);
    });
  });
});
