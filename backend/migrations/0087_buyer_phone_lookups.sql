CREATE TABLE buyer_phone_lookups (
 workspace_id TEXT NOT NULL,
 company_id TEXT NOT NULL REFERENCES crm_companies(id) ON DELETE CASCADE,
 apollo_id TEXT NOT NULL,
 person_id TEXT NOT NULL,
 identity_json TEXT NOT NULL,
 website_job TEXT,
 request_id TEXT,
 user_id TEXT NOT NULL,
 session_hash TEXT NOT NULL,
 role TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'waiting',
 lease_until INTEGER NOT NULL DEFAULT 0,
 result_json TEXT,
 PRIMARY KEY (workspace_id,company_id,apollo_id)
);
CREATE INDEX buyer_phone_lookup_queue ON buyer_phone_lookups(state,lease_until);
CREATE TABLE buyer_phone_aliases (
 workspace_id TEXT NOT NULL, company_id TEXT NOT NULL REFERENCES crm_companies(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL, identity_json TEXT NOT NULL, apollo_id TEXT NOT NULL,
 PRIMARY KEY(workspace_id,company_id,person_id,identity_json)
);
