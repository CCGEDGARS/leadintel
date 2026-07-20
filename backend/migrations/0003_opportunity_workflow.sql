ALTER TABLE opportunities ADD COLUMN pipeline_stage TEXT NOT NULL DEFAULT 'Discovered';
ALTER TABLE opportunities ADD COLUMN next_action TEXT NOT NULL DEFAULT '';
ALTER TABLE opportunities ADD COLUMN notes TEXT NOT NULL DEFAULT '';

