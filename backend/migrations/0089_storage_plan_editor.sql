CREATE TABLE storage_plan_settings (
 id INTEGER PRIMARY KEY CHECK(id=1),
 included_records_limit INTEGER NOT NULL CHECK(included_records_limit>0),
 included_files_limit INTEGER NOT NULL CHECK(included_files_limit>0),
 plus_records_limit INTEGER NOT NULL CHECK(plus_records_limit>=included_records_limit),
 plus_files_limit INTEGER NOT NULL CHECK(plus_files_limit>=included_files_limit),
 monthly_amount_minor INTEGER CHECK(monthly_amount_minor BETWEEN 1 AND 99999999),
 revision INTEGER NOT NULL DEFAULT 0
);
INSERT INTO storage_plan_settings VALUES(1,100000000,1000000000,500000000,10000000000,NULL,0);
ALTER TABLE workspace_storage_accounts ADD COLUMN limits_overridden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspace_storage_accounts ADD COLUMN limits_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspace_storage_accounts ADD COLUMN stripe_checkout_price_id TEXT;
UPDATE workspace_storage_accounts SET limits_overridden=1
 WHERE (included_records_limit,included_files_limit,plus_records_limit,plus_files_limit)
 <> (100000000,1000000000,500000000,10000000000);
CREATE TRIGGER storage_plan_new_account AFTER INSERT ON workspace_storage_accounts
 WHEN NEW.limits_overridden=0
 BEGIN
 UPDATE workspace_storage_accounts SET
 (included_records_limit,included_files_limit,plus_records_limit,plus_files_limit)=
 (SELECT included_records_limit,included_files_limit,plus_records_limit,plus_files_limit FROM storage_plan_settings WHERE id=1)
 WHERE workspace_id=NEW.workspace_id;
 END;
CREATE TRIGGER storage_plan_apply_defaults AFTER UPDATE OF included_records_limit,included_files_limit,plus_records_limit,plus_files_limit ON storage_plan_settings
 BEGIN
 UPDATE workspace_storage_accounts SET included_records_limit=NEW.included_records_limit,
 included_files_limit=NEW.included_files_limit,plus_records_limit=NEW.plus_records_limit,
 plus_files_limit=NEW.plus_files_limit WHERE limits_overridden=0;
 END;
CREATE TABLE storage_plan_stripe_prices (
 merchant TEXT NOT NULL, livemode INTEGER NOT NULL, base_price TEXT NOT NULL, amount INTEGER NOT NULL,
 price_id TEXT NOT NULL, PRIMARY KEY(merchant,livemode,base_price,amount), UNIQUE(merchant,livemode,price_id)
);
