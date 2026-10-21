-- Preserve existing Apollo attempts while allowing a separately approved Hunter fallback.
CREATE TABLE additional_contact_attempts_by_provider (
 workspace_id TEXT NOT NULL, company_id TEXT NOT NULL, person_id TEXT NOT NULL,
 month TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'apollo' CHECK(provider IN ('apollo','hunter')),
 status TEXT NOT NULL DEFAULT 'processing', result_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(workspace_id,company_id,person_id,month,provider)
);
INSERT INTO additional_contact_attempts_by_provider(workspace_id,company_id,person_id,month,status,result_json,created_at,updated_at)
 SELECT workspace_id,company_id,person_id,month,status,result_json,created_at,updated_at FROM additional_contact_attempts;
DROP TABLE additional_contact_attempts;
ALTER TABLE additional_contact_attempts_by_provider RENAME TO additional_contact_attempts;
CREATE INDEX additional_contact_attempt_budget ON additional_contact_attempts(workspace_id,created_at);
