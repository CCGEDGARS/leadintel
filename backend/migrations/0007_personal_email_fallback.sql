ALTER TABLE contacts ADD COLUMN email_type TEXT NOT NULL DEFAULT 'work';
ALTER TABLE contacts ADD COLUMN match_confidence TEXT;
ALTER TABLE enrichment_policies ADD COLUMN allow_personal_email INTEGER NOT NULL DEFAULT 1;
ALTER TABLE enrichment_policies ADD COLUMN phone_lookup_mode TEXT NOT NULL DEFAULT 'on_request';

UPDATE contacts SET email_type='work' WHERE email_type IS NULL OR email_type='';
UPDATE enrichment_policies SET allow_personal_email=1,phone_lookup_mode='on_request';
