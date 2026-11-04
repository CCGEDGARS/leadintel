-- Default to the owner-approved single automatic buyer without changing
-- existing email/phone permissions, budgets or retained legacy capacity.
ALTER TABLE additional_contact_policies ADD COLUMN automatic_buyer_limit INTEGER NOT NULL DEFAULT 1 CHECK(automatic_buyer_limit BETWEEN 1 AND 4);
