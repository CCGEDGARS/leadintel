PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_companies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  normalized_domain TEXT,
  company_name TEXT NOT NULL,
  website TEXT,
  country TEXT,
  industry TEXT,

  lifecycle_status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (
      lifecycle_status IN (
        'prospect',
        'customer',
        'archived',
        'suppressed'
      )
    ),

  pipeline_stage TEXT
    CHECK (
      pipeline_stage IS NULL
      OR pipeline_stage IN (
        'Discovered',
        'Qualified',
        'Ready for Outreach',
        'Contacted',
        'Replied',
        'Meeting',
        'Proposal',
        'Won',
        'Lost'
      )
    ),

  opportunity_score INTEGER,
  confidence TEXT,
  source TEXT,

  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  archived_at TEXT,
  suppressed_at TEXT,
  customer_since TEXT,
  deleted_at TEXT,

  UNIQUE(workspace_id, normalized_domain)
);

CREATE INDEX IF NOT EXISTS idx_crm_companies_workspace_lifecycle
  ON crm_companies(workspace_id, lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_crm_companies_workspace_pipeline
  ON crm_companies(workspace_id, pipeline_stage);

CREATE INDEX IF NOT EXISTS idx_crm_companies_workspace_updated
  ON crm_companies(workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_companies_workspace_name
  ON crm_companies(workspace_id, company_name);


CREATE TABLE IF NOT EXISTS crm_contacts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  company_id TEXT NOT NULL,

  name TEXT,
  title TEXT,

  work_email TEXT,
  normalized_email TEXT,

  external_person_id TEXT,

  email_status TEXT,
  linkedin_url TEXT,
  source TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,

  FOREIGN KEY(company_id)
    REFERENCES crm_companies(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contacts_workspace_email
  ON crm_contacts(workspace_id, normalized_email)
  WHERE normalized_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contacts_external_person
  ON crm_contacts(
    workspace_id,
    company_id,
    source,
    external_person_id
  )
  WHERE external_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_company
  ON crm_contacts(company_id);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_workspace_name
  ON crm_contacts(workspace_id, name);


CREATE TABLE IF NOT EXISTS crm_intelligence (
  company_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,

  matched_signals_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',

  opportunity_hypothesis TEXT,
  score_breakdown_json TEXT,
  confidence TEXT,
  research_snapshot_json TEXT,

  intelligence_updated_at TEXT NOT NULL,

  FOREIGN KEY(company_id)
    REFERENCES crm_companies(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_intelligence_workspace
  ON crm_intelligence(workspace_id);


CREATE TABLE IF NOT EXISTS crm_activities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  contact_id TEXT,

  activity_type TEXT NOT NULL,
  channel TEXT,
  direction TEXT,

  subject TEXT,
  summary TEXT,

  metadata_json TEXT NOT NULL DEFAULT '{}',

  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  actor_user_id TEXT,

  FOREIGN KEY(company_id)
    REFERENCES crm_companies(id)
    ON DELETE CASCADE,

  FOREIGN KEY(contact_id)
    REFERENCES crm_contacts(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_company_time
  ON crm_activities(company_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activities_contact
  ON crm_activities(contact_id);

CREATE INDEX IF NOT EXISTS idx_crm_activities_workspace_time
  ON crm_activities(workspace_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activities_workspace_type
  ON crm_activities(workspace_id, activity_type);
