-- Migration: 012_performance_optimization
-- Purpose: Additional performance indexes and monitoring tables
-- ============================================================================

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Users table
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

-- Organizations table
CREATE INDEX IF NOT EXISTS idx_organizations_slug_lower ON organizations (lower(slug));
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations (created_at DESC);

-- Memberships table
CREATE INDEX IF NOT EXISTS idx_memberships_user_org_accepted ON memberships (user_id, org_id) WHERE accepted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memberships_org_role_accepted ON memberships (org_id, role) WHERE accepted_at IS NOT NULL;

-- Sessions table
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions (user_id, expires_at) WHERE expires_at > NOW();

-- Audit events
CREATE INDEX IF NOT EXISTS idx_audit_events_org_action ON audit_events (org_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created ON audit_events (actor_id, created_at DESC);

-- Runs table
CREATE INDEX IF NOT EXISTS idx_runs_temporal_workflow ON runs (temporal_workflow_id) WHERE temporal_workflow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_runs_active ON runs (org_id, started_at DESC) WHERE status IN ('running', 'paused');

-- Projects table
CREATE INDEX IF NOT EXISTS idx_projects_org_created ON projects (org_id, created_at DESC);

-- Browser sessions
CREATE INDEX IF NOT EXISTS idx_browser_sessions_active ON browser_sessions (org_id, last_activity_at) WHERE status = 'connected';

-- ============================================================================
-- MONITORING TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  response_time_ms NUMERIC,
  details JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks (service_name, checked_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'Core user accounts with secure password storage';
COMMENT ON TABLE organizations IS 'Multi-tenant organizations with complete isolation';
COMMENT ON TABLE memberships IS 'Organization membership with RBAC roles';
COMMENT ON TABLE sessions IS 'User authentication sessions with automatic expiry';
COMMENT ON TABLE audit_events IS 'Comprehensive audit trail for compliance';
COMMENT ON TABLE runs IS 'Workflow execution tracking with Temporal integration';
COMMENT ON TABLE agents IS 'AI agents with versioning and deployment tracking';
COMMENT ON TABLE projects IS 'Organizational projects for grouping resources';

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP INDEX IF EXISTS idx_users_email_lower;
-- DROP INDEX IF EXISTS idx_users_created_at;
-- DROP INDEX IF EXISTS idx_organizations_slug_lower;
-- DROP INDEX IF EXISTS idx_organizations_created_at;
-- DROP INDEX IF EXISTS idx_memberships_user_org_accepted;
-- DROP INDEX IF EXISTS idx_memberships_org_role_accepted;
-- DROP INDEX IF EXISTS idx_sessions_user_active;
-- DROP INDEX IF EXISTS idx_audit_events_org_action;
-- DROP INDEX IF EXISTS idx_audit_events_actor_created;
-- DROP INDEX IF EXISTS idx_runs_temporal_workflow;
-- DROP INDEX IF EXISTS idx_runs_active;
-- DROP INDEX IF EXISTS idx_projects_org_created;
-- DROP INDEX IF EXISTS idx_browser_sessions_active;
-- DROP TABLE IF EXISTS health_checks;
