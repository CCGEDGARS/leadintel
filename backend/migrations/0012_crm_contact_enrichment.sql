PRAGMA foreign_keys = ON;

ALTER TABLE crm_contacts ADD COLUMN phone_number TEXT;
ALTER TABLE crm_contacts ADD COLUMN phone_status TEXT;
ALTER TABLE crm_contacts ADD COLUMN email_type TEXT;
ALTER TABLE crm_contacts ADD COLUMN match_confidence TEXT;
ALTER TABLE crm_contacts ADD COLUMN verification_provider TEXT;
ALTER TABLE crm_contacts ADD COLUMN verified_at TEXT;

CREATE TABLE IF NOT EXISTS crm_enrichment_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  contact_id TEXT,
  provider TEXT NOT NULL DEFAULT 'apollo',
  person_provider_id TEXT NOT NULL,
  role_requested TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('processing','verified','not_found','pending_phone','failed','cancelled')),
  personal_email_requested INTEGER NOT NULL DEFAULT 0,
  phone_requested INTEGER NOT NULL DEFAULT 0,
  credits_reserved INTEGER NOT NULL DEFAULT 1,
  credits_used INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  response_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(response_summary_json)),
  requested_by TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(company_id) REFERENCES crm_companies(id) ON DELETE CASCADE,
  FOREIGN KEY(contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_enrichment_workspace_created
  ON crm_enrichment_requests(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_enrichment_company_created
  ON crm_enrichment_requests(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_enrichment_person
  ON crm_enrichment_requests(workspace_id, company_id, person_provider_id, created_at DESC);
