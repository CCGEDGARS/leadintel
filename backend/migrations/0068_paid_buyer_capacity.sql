-- Allow an owner-selected limit for the existing bounded ten-person buyer pool.
-- Preserve every prior permission, approval, timestamp and spending limit.
CREATE TABLE additional_contact_policies_next (
 workspace_id TEXT PRIMARY KEY,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 daily_limit INTEGER NOT NULL DEFAULT 3 CHECK(daily_limit BETWEEN 1 AND 50),
 monthly_limit INTEGER NOT NULL DEFAULT 30 CHECK(monthly_limit BETWEEN 1 AND 1000),
 max_per_company INTEGER NOT NULL DEFAULT 2 CHECK(max_per_company BETWEEN 1 AND 10),
 approved_by TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 provider TEXT NOT NULL DEFAULT 'treg' CHECK(provider IN ('apollo','treg')),
 phone_enabled INTEGER NOT NULL DEFAULT 0 CHECK(phone_enabled IN (0,1))
);
INSERT INTO additional_contact_policies_next SELECT workspace_id,enabled,daily_limit,monthly_limit,max_per_company,approved_by,updated_at,provider,phone_enabled FROM additional_contact_policies;
DROP TABLE additional_contact_policies;
ALTER TABLE additional_contact_policies_next RENAME TO additional_contact_policies;
