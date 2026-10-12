ALTER TABLE writing_reference_sources ADD COLUMN role TEXT NOT NULL DEFAULT 'guidance' CHECK (role IN ('guidance','seller','customer'));
