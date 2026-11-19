-- Optional report snapshots are independent from source evidence and saved flows.
ALTER TABLE workspace_storage_accounts ADD COLUMN auto_report_copies INTEGER NOT NULL DEFAULT 1 CHECK(auto_report_copies IN (0,1));
ALTER TABLE workspace_storage_accounts ADD COLUMN storage_policy_revision INTEGER NOT NULL DEFAULT 0;
