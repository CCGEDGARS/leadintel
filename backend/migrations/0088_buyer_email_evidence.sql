CREATE TABLE additional_contact_attempts_next (
 workspace_id TEXT NOT NULL, company_id TEXT NOT NULL, person_id TEXT NOT NULL,
 month TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'apollo' CHECK(provider IN ('apollo','hunter','treg','firecrawl')),
 status TEXT NOT NULL DEFAULT 'processing', result_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(workspace_id,company_id,person_id,month,provider)
);
INSERT INTO additional_contact_attempts_next SELECT * FROM additional_contact_attempts;
DROP TABLE additional_contact_attempts;
ALTER TABLE additional_contact_attempts_next RENAME TO additional_contact_attempts;
CREATE INDEX additional_contact_attempt_budget ON additional_contact_attempts(workspace_id,created_at);

CREATE TABLE buyer_email_evidence (
 workspace_id TEXT NOT NULL, company_id TEXT NOT NULL, domain TEXT NOT NULL,
 person_name TEXT NOT NULL, person_role TEXT NOT NULL, origin TEXT NOT NULL,
 evidence_json TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(workspace_id,company_id,domain,person_name,person_role,origin)
);

CREATE TABLE additional_contact_policies_next (
 workspace_id TEXT PRIMARY KEY,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 daily_limit INTEGER NOT NULL DEFAULT 3 CHECK(daily_limit BETWEEN 1 AND 50),
 monthly_limit INTEGER NOT NULL DEFAULT 30 CHECK(monthly_limit BETWEEN 1 AND 1000),
 max_per_company INTEGER NOT NULL DEFAULT 2 CHECK(max_per_company BETWEEN 1 AND 10),
 approved_by TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 provider TEXT NOT NULL DEFAULT 'treg' CHECK(provider IN ('apollo','treg','firecrawl')),
 phone_enabled INTEGER NOT NULL DEFAULT 0 CHECK(phone_enabled IN (0,1)),
 automatic_buyer_limit INTEGER NOT NULL DEFAULT 1 CHECK(automatic_buyer_limit BETWEEN 1 AND 4)
);
INSERT INTO additional_contact_policies_next SELECT workspace_id,enabled,daily_limit,monthly_limit,max_per_company,approved_by,updated_at,provider,phone_enabled,automatic_buyer_limit FROM additional_contact_policies;
DROP TABLE additional_contact_policies;
ALTER TABLE additional_contact_policies_next RENAME TO additional_contact_policies;
