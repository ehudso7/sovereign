-- Migration: 010_phase11_revenue
-- Phase 11: Revenue Workspace (Accounts, Contacts, Deals, Tasks, Notes, Outreach Drafts)
-- Reversible: YES

-- ============================================================================
-- UP
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CRM Accounts (companies/organizations that are sales targets)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  industry VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  owner_id UUID REFERENCES users(id),
  notes TEXT,
  external_crm_id VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_accounts_org_id ON crm_accounts(org_id);
CREATE INDEX idx_crm_accounts_owner ON crm_accounts(org_id, owner_id);
CREATE INDEX idx_crm_accounts_status ON crm_accounts(org_id, status);
CREATE INDEX idx_crm_accounts_external ON crm_accounts(org_id, external_crm_id) WHERE external_crm_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- CRM Contacts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  title VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  owner_id UUID REFERENCES users(id),
  external_crm_id VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_contacts_org_id ON crm_contacts(org_id);
CREATE INDEX idx_crm_contacts_account ON crm_contacts(org_id, account_id);
CREATE INDEX idx_crm_contacts_owner ON crm_contacts(org_id, owner_id);
CREATE INDEX idx_crm_contacts_email ON crm_contacts(org_id, email);
CREATE INDEX idx_crm_contacts_external ON crm_contacts(org_id, external_crm_id) WHERE external_crm_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- CRM Deals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  stage VARCHAR(100) NOT NULL DEFAULT 'discovery',
  value_cents BIGINT,
  currency VARCHAR(3) DEFAULT 'USD',
  close_date DATE,
  owner_id UUID REFERENCES users(id),
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  notes TEXT,
  external_crm_id VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_deals_org_id ON crm_deals(org_id);
CREATE INDEX idx_crm_deals_account ON crm_deals(org_id, account_id);
CREATE INDEX idx_crm_deals_stage ON crm_deals(org_id, stage);
CREATE INDEX idx_crm_deals_owner ON crm_deals(org_id, owner_id);
CREATE INDEX idx_crm_deals_external ON crm_deals(org_id, external_crm_id) WHERE external_crm_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- CRM Tasks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  due_at TIMESTAMPTZ,
  linked_entity_type VARCHAR(50),
  linked_entity_id UUID,
  owner_id UUID REFERENCES users(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_tasks_org_id ON crm_tasks(org_id);
CREATE INDEX idx_crm_tasks_status ON crm_tasks(org_id, status);
CREATE INDEX idx_crm_tasks_owner ON crm_tasks(org_id, owner_id);
CREATE INDEX idx_crm_tasks_linked ON crm_tasks(org_id, linked_entity_type, linked_entity_id);
CREATE INDEX idx_crm_tasks_due ON crm_tasks(org_id, due_at) WHERE due_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- CRM Notes (meeting notes, revenue notes)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  linked_entity_type VARCHAR(50) NOT NULL,
  linked_entity_id UUID NOT NULL,
  title VARCHAR(500),
  content TEXT NOT NULL,
  note_type VARCHAR(50) NOT NULL DEFAULT 'general',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_notes_org_id ON crm_notes(org_id);
CREATE INDEX idx_crm_notes_linked ON crm_notes(org_id, linked_entity_type, linked_entity_id);

-- ---------------------------------------------------------------------------
-- Outreach Drafts (AI-generated, approval-gated)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS outreach_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  linked_entity_type VARCHAR(50),
  linked_entity_id UUID,
  channel VARCHAR(50) NOT NULL DEFAULT 'email',
  subject VARCHAR(500),
  body TEXT NOT NULL,
  generated_by VARCHAR(50) NOT NULL DEFAULT 'ai',
  approval_status VARCHAR(50) NOT NULL DEFAULT 'draft',
  approval_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outreach_drafts_org_id ON outreach_drafts(org_id);
CREATE INDEX idx_outreach_drafts_linked ON outreach_drafts(org_id, linked_entity_type, linked_entity_id);
CREATE INDEX idx_outreach_drafts_status ON outreach_drafts(org_id, approval_status);

-- ---------------------------------------------------------------------------
-- CRM Sync Log (tracks sync operations with external CRM)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  external_crm_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_crm_sync_log_org_id ON crm_sync_log(org_id);
CREATE INDEX idx_crm_sync_log_entity ON crm_sync_log(org_id, entity_type, entity_id);
CREATE INDEX idx_crm_sync_log_status ON crm_sync_log(org_id, status);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE crm_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY crm_accounts_tenant_isolation ON crm_accounts
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts FORCE ROW LEVEL SECURITY;
CREATE POLICY crm_contacts_tenant_isolation ON crm_contacts
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals FORCE ROW LEVEL SECURITY;
CREATE POLICY crm_deals_tenant_isolation ON crm_deals
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY crm_tasks_tenant_isolation ON crm_tasks
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY crm_notes_tenant_isolation ON crm_notes
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE outreach_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY outreach_drafts_tenant_isolation ON outreach_drafts
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE crm_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sync_log FORCE ROW LEVEL SECURITY;
CREATE POLICY crm_sync_log_tenant_isolation ON crm_sync_log
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================================
-- DOWN
-- ============================================================================

-- DROP POLICY crm_sync_log_tenant_isolation ON crm_sync_log;
-- DROP POLICY outreach_drafts_tenant_isolation ON outreach_drafts;
-- DROP POLICY crm_notes_tenant_isolation ON crm_notes;
-- DROP POLICY crm_tasks_tenant_isolation ON crm_tasks;
-- DROP POLICY crm_deals_tenant_isolation ON crm_deals;
-- DROP POLICY crm_contacts_tenant_isolation ON crm_contacts;
-- DROP POLICY crm_accounts_tenant_isolation ON crm_accounts;
-- DROP TABLE IF EXISTS crm_sync_log CASCADE;
-- DROP TABLE IF EXISTS outreach_drafts CASCADE;
-- DROP TABLE IF EXISTS crm_notes CASCADE;
-- DROP TABLE IF EXISTS crm_tasks CASCADE;
-- DROP TABLE IF EXISTS crm_deals CASCADE;
-- DROP TABLE IF EXISTS crm_contacts CASCADE;
-- DROP TABLE IF EXISTS crm_accounts CASCADE;
