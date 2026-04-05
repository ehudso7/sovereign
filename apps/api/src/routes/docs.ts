// ---------------------------------------------------------------------------
// Documentation routes — /api/v1/docs
// Serves static documentation content for the web app
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/auth.js";

function meta(requestId: string) {
  return { request_id: requestId, timestamp: new Date().toISOString() };
}

const DOCS_CATEGORIES = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Learn the basics of SOVEREIGN and set up your first agent",
    articleCount: 3,
    articles: [
      {
        slug: "quickstart",
        title: "Quickstart Guide",
        summary: "Get up and running with SOVEREIGN in under 5 minutes",
        content:
          "# Quickstart Guide\n\nWelcome to SOVEREIGN! Follow these steps to create and deploy your first AI agent.\n\n## Step 1: Create a Project\nNavigate to **Projects** in the sidebar and click **New Project**. Give it a name and description.\n\n## Step 2: Create an Agent\nGo to **Agents** and click **New Agent**. Select your project, name your agent, and provide a description.\n\n## Step 3: Create a Version\nOn the agent detail page, click **New Version**. Configure your agent's instructions, goals, and model settings.\n\n## Step 4: Publish\nOnce you're happy with the version, click **Publish** to make the agent live.\n\n## Step 5: Run\nClick **Run Agent** to start an execution. Monitor progress in **Mission Control**.",
        category: "getting-started",
      },
      {
        slug: "concepts",
        title: "Core Concepts",
        summary: "Understand agents, connectors, skills, and the agent lifecycle",
        content:
          "# Core Concepts\n\n## Agents\nAgents are autonomous AI workers that execute tasks. Each agent has versioned configurations including instructions, goals, model settings, and tool access.\n\n## Connectors\nConnectors integrate external services (APIs, databases, SaaS tools) into your agents via the MCP standard.\n\n## Skills\nSkills bundle connectors into reusable capabilities that agents can leverage.\n\n## Runs\nA run is a single execution of an agent. Runs are tracked in Mission Control with full observability.\n\n## Policies\nPolicies enforce access control, approval workflows, and budget limits across your organization.",
        category: "getting-started",
      },
      {
        slug: "architecture",
        title: "Architecture Overview",
        summary: "How SOVEREIGN's multi-tenant agent OS works under the hood",
        content:
          "# Architecture Overview\n\nSOVEREIGN is a production-grade multi-tenant agent operating system.\n\n## Components\n- **API Server**: Fastify-based REST API with tenant-scoped access\n- **Web Dashboard**: Next.js app for managing agents, connectors, and observability\n- **Worker**: Temporal-based orchestration for agent execution\n- **Browser Worker**: Playwright-based browser automation\n- **Gateway**: MCP-compatible connector gateway\n\n## Multi-Tenancy\nAll data is scoped to organizations. Row-level security ensures complete tenant isolation.\n\n## Security\nAuthentication via WorkOS (SSO, SCIM). Authorization via OPA policies. All secrets managed through the secret broker.",
        category: "getting-started",
      },
    ],
  },
  {
    id: "agents",
    title: "Agents",
    description: "Create, configure, and manage AI agents",
    articleCount: 2,
    articles: [
      {
        slug: "creating-agents",
        title: "Creating Agents",
        summary: "Step-by-step guide to creating and configuring agents",
        content:
          "# Creating Agents\n\n## Prerequisites\n- A project to organize your agents\n- org_owner or org_admin role\n\n## Steps\n1. Navigate to **Agents > New Agent**\n2. Select a project\n3. Enter a name (auto-generates a slug)\n4. Add an optional description\n5. Click **Create Agent**\n\n## Next Steps\nAfter creation, your agent is in **draft** status. Create a version to define its behavior, then publish to make it live.",
        category: "agents",
      },
      {
        slug: "agent-versions",
        title: "Agent Versions",
        summary: "Manage versions, publish, and rollback agent configurations",
        content:
          "# Agent Versions\n\nEach agent can have multiple versions. Only one version can be published (live) at a time.\n\n## Creating a Version\nFrom the agent detail page, click **New Version**. Configure:\n- **Goals**: What the agent should achieve\n- **Instructions**: System prompt and behavioral guidelines\n- **Model Config**: Provider, model, temperature, max tokens\n- **Tools**: Which connectors and tools the agent can access\n- **Budget**: Token and cost limits\n\n## Publishing\nClick **Publish** on a draft version to make it the active version. The agent status changes to `published`.\n\n## Immutability\nPublished versions are immutable. To make changes, create a new version.",
        category: "agents",
      },
    ],
  },
  {
    id: "connectors",
    title: "Connectors",
    description: "Integrate external services and APIs",
    articleCount: 1,
    articles: [
      {
        slug: "using-connectors",
        title: "Using Connectors",
        summary: "Install and configure connectors to extend agent capabilities",
        content:
          "# Using Connectors\n\nConnectors bring external tools and services into SOVEREIGN using the MCP (Model Context Protocol) standard.\n\n## Installing Connectors\n1. Go to **Connectors > Add Connector**\n2. Browse the connector catalog\n3. Click **Install** on the connector you want\n4. Configure any required credentials (API keys, etc.)\n\n## Connector Types\n- **Utility**: Simple tools like echo and time\n- **Data**: Weather, search, and information services\n- **Integration**: CRM, email, and business tools\n\n## Trust Tiers\n- **Verified**: Audited and maintained by SOVEREIGN\n- **Community**: Community-contributed connectors",
        category: "connectors",
      },
    ],
  },
  {
    id: "mission-control",
    title: "Mission Control",
    description: "Monitor and observe your agent fleet",
    articleCount: 1,
    articles: [
      {
        slug: "observability",
        title: "Observability & Monitoring",
        summary: "Track runs, view metrics, and manage alerts",
        content:
          "# Observability & Monitoring\n\nMission Control provides real-time observability for your agent fleet.\n\n## Overview Dashboard\nView key metrics at a glance:\n- Run counts by status\n- Error rate and system health\n- Token usage and estimated costs\n- Feature adoption (tools, browser, memory)\n\n## Run Details\nDrill into individual runs to see:\n- Step-by-step execution timeline\n- Tool usage and latency\n- Browser sessions\n- Memory operations\n\n## Alerts\nAutomatic alerts for:\n- Failed runs\n- Stuck runs (queued/running > 30 minutes)\n- Failed browser sessions\n\nAcknowledge alerts to track resolution.",
        category: "mission-control",
      },
    ],
  },
];

export async function docsRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/v1/docs — list categories with article counts
  server.get(
    "/api/v1/docs",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const categories = DOCS_CATEGORIES.map(({ articles: _a, ...cat }) => cat);
      return reply.status(200).send({ data: categories, meta: meta(request.id) });
    },
  );

  // GET /api/v1/docs/:slug — get article by slug
  server.get<{ Params: { slug: string } }>(
    "/api/v1/docs/:slug",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { slug } = request.params;

      for (const category of DOCS_CATEGORIES) {
        const article = category.articles.find((a) => a.slug === slug);
        if (article) {
          return reply.status(200).send({ data: article, meta: meta(request.id) });
        }
      }

      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: `Article "${slug}" not found` },
        meta: meta(request.id),
      });
    },
  );
}
