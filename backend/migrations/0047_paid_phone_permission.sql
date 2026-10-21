-- Email approval remains intact. A new paid phone service is off until explicitly approved.
ALTER TABLE additional_contact_policies ADD COLUMN phone_enabled INTEGER NOT NULL DEFAULT 0 CHECK(phone_enabled IN (0,1));
