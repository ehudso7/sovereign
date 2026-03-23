# SOVEREIGN — Tasks

## Current Sprint: Phase 2

### Phase 0 — Control Documents ✅
- [x] Create PRD.md
- [x] Create ROADMAP.md
- [x] Create ARCHITECTURE.md
- [x] Create CLAUDE.md
- [x] Create AGENTS.md
- [x] Create TASKS.md (this file)
- [x] Create DB_SCHEMA.md
- [x] Create API_SPEC.md
- [x] Create SECURITY.md
- [x] Create TEST_STRATEGY.md
- [x] Create RUNBOOKS/
- [x] Create ADR/0001-system-architecture.md

### Phase 1 — Monorepo Foundation ✅
- [x] Initialize pnpm workspace
- [x] Configure Turborepo
- [x] Set up shared TypeScript config
- [x] Set up shared ESLint config
- [x] Scaffold apps/web (Next.js + App Router)
- [x] Scaffold apps/api
- [x] Scaffold apps/worker-orchestrator
- [x] Scaffold apps/worker-browser
- [x] Scaffold apps/gateway-mcp
- [x] Scaffold apps/docs
- [x] Scaffold packages/ui
- [x] Scaffold packages/config
- [x] Scaffold packages/db
- [x] Scaffold packages/core
- [x] Scaffold packages/agents
- [x] Scaffold packages/connectors
- [x] Scaffold packages/policies
- [x] Scaffold packages/observability
- [x] Scaffold packages/billing
- [x] Scaffold packages/crm
- [x] Scaffold packages/testing
- [x] Set up infra/docker
- [x] Set up infra/terraform
- [x] Set up infra/scripts
- [x] Create CI/CD workflows
- [x] Environment validation
- [x] Verify local dev boots

### Phase 2 — Identity, Orgs, Tenancy ✅
- [x] Auth abstraction layer (local dev + WorkOS provider interface)
- [x] Auth types: roles, permissions, sessions, provider abstraction
- [x] Entity types: User, Organization, Membership, Invitation, Project
- [x] Audit event types and emitter interface
- [x] Service interfaces (AuthService, UserService, OrgService, MembershipService, InvitationService, ProjectService)
- [x] In-memory store for local/dev mode
- [x] Auth service with session management (create, validate, expire, revoke)
- [x] Organization CRUD service with creator-as-owner
- [x] Membership service with role management and last-owner protection
- [x] Invitation service with email-based invite flow
- [x] Project/workspace service with org-scoped boundaries
- [x] Audit event emission on all auth-sensitive actions
- [x] Auth middleware (authenticate, requirePermission, requireRole, enforceOrgScope)
- [x] API routes: auth (login, logout, me, switch-org, sessions, revoke)
- [x] API routes: organizations (list, create, get, update)
- [x] API routes: members (list, update role, remove)
- [x] API routes: invitations (create, list, accept, revoke)
- [x] API routes: projects (list, create, get, update, delete)
- [x] Dev bootstrap route for local development
- [x] SQL migration for Phase 2 tables (users, organizations, memberships, invitations, sessions, projects, audit_events)
- [x] Web UI: auth context and session management
- [x] Web UI: sign-in page with bootstrap for first-time setup
- [x] Web UI: dashboard with org/project overview
- [x] Web UI: org settings page
- [x] Web UI: members listing with role management
- [x] Web UI: invitation page
- [x] Web UI: app shell with navigation
- [x] Web UI: unauthorized/forbidden state
- [x] Cross-tenant isolation tests (org, project, membership, auth session, audit)
- [x] Role enforcement tests
- [x] Session management tests (create, validate, expire, revoke)
- [x] Org CRUD tests with membership check
- [x] Membership tests (add, remove, role change, last-owner protection)
- [x] Invitation tests (create, accept, email verification)
- [x] Project tests (CRUD with org-scoping, cross-tenant denial)
- [x] Audit emission tests
- [x] Update docs (TASKS.md, DB_SCHEMA.md, API_SPEC.md, SECURITY.md)

## Backlog

### Phase 3 — Data Layer and Storage
_Not started. Tasks will be expanded when Phase 3 begins._

### Phase 4–14
_See ROADMAP.md for full phase details._
