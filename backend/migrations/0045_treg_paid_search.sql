ALTER TABLE additional_contact_policies ADD COLUMN provider TEXT NOT NULL DEFAULT 'apollo' CHECK(provider IN ('apollo','treg'));
CREATE TABLE additional_contact_attempts_next (
 workspace_id TEXT NOT NULL, company_id TEXT NOT NULL, person_id TEXT NOT NULL,
 month TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'apollo' CHECK(provider IN ('apollo','hunter','treg')),
 status TEXT NOT NULL DEFAULT 'processing', result_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(workspace_id,company_id,person_id,month,provider)
);
INSERT INTO additional_contact_attempts_next SELECT * FROM additional_contact_attempts;
DROP TABLE additional_contact_attempts;
ALTER TABLE additional_contact_attempts_next RENAME TO additional_contact_attempts;
CREATE INDEX additional_contact_attempt_budget ON additional_contact_attempts(workspace_id,created_at);
CREATE TABLE treg_contact_calls (
 workspace_id TEXT NOT NULL, request_key TEXT NOT NULL, phase TEXT NOT NULL,
 call_id TEXT, poll_count INTEGER NOT NULL DEFAULT 1, cost_micro INTEGER NOT NULL DEFAULT 0, result_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(workspace_id,request_key,phase)
);
