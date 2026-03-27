-- Migration: 002_row_level_security
-- Phase 3: Row-level security policies for tenant isolation defense-in-depth
-- Reversible: YES (see DOWN section at bottom)

-- ============================================================================
-- UP
-- ============================================================================

-- Enable RLS on org-scoped tables (MUST be done before policies)
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies use the session variable app.current_org_id
-- This variable is set by the application via SET LOCAL in transactions

-- Memberships: SELECT/UPDATE/DELETE only within current org context
CREATE POLICY memberships_tenant_select ON memberships FOR SELECT
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY memberships_tenant_insert ON memberships FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY memberships_tenant_update ON memberships FOR UPDATE
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY memberships_tenant_delete ON memberships FOR DELETE
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Invitations: full CRUD protection within org context
CREATE POLICY invitations_tenant_select ON invitations FOR SELECT
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY invitations_tenant_insert ON invitations FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY invitations_tenant_update ON invitations FOR UPDATE
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY invitations_tenant_delete ON invitations FOR DELETE
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Projects: full CRUD protection within org context
CREATE POLICY projects_tenant_select ON projects FOR SELECT
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY projects_tenant_insert ON projects FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY projects_tenant_update ON projects FOR UPDATE
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY projects_tenant_delete ON projects FOR DELETE
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit events: INSERT and SELECT only within org context
CREATE POLICY audit_events_tenant_select ON audit_events FOR SELECT
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY audit_events_tenant_insert ON audit_events FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- Sessions: full CRUD protection within org context
CREATE POLICY sessions_tenant_select ON sessions FOR SELECT
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY sessions_tenant_insert ON sessions FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY sessions_tenant_update ON sessions FOR UPDATE
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY sessions_tenant_delete ON sessions FOR DELETE
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- IMPORTANT: RLS is enforced for non-superuser roles.
-- The application connection role must NOT be a superuser.
-- RLS policies are bypassed for table owners by default.
-- Force RLS even for table owner for MAXIMUM SECURITY:
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP POLICY IF EXISTS memberships_tenant_select ON memberships;
-- DROP POLICY IF EXISTS memberships_tenant_insert ON memberships;
-- DROP POLICY IF EXISTS memberships_tenant_update ON memberships;
-- DROP POLICY IF EXISTS memberships_tenant_delete ON memberships;
-- DROP POLICY IF EXISTS invitations_tenant_select ON invitations;
-- DROP POLICY IF EXISTS invitations_tenant_insert ON invitations;
-- DROP POLICY IF EXISTS invitations_tenant_update ON invitations;
-- DROP POLICY IF EXISTS invitations_tenant_delete ON invitations;
-- DROP POLICY IF EXISTS projects_tenant_select ON projects;
-- DROP POLICY IF EXISTS projects_tenant_insert ON projects;
-- DROP POLICY IF EXISTS projects_tenant_update ON projects;
-- DROP POLICY IF EXISTS projects_tenant_delete ON projects;
-- DROP POLICY IF EXISTS audit_events_tenant_select ON audit_events;
-- DROP POLICY IF EXISTS audit_events_tenant_insert ON audit_events;
-- DROP POLICY IF EXISTS sessions_tenant_select ON sessions;
-- DROP POLICY IF EXISTS sessions_tenant_insert ON sessions;
-- DROP POLICY IF EXISTS sessions_tenant_update ON sessions;
-- DROP POLICY IF EXISTS sessions_tenant_delete ON sessions;
-- ALTER TABLE memberships DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE invitations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_events DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
