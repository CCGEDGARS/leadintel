-- Shared public-language guidance only. Sponsor scope lives in the private job,
-- never in public pack documents. No customer text is accepted or stored.
CREATE TABLE language_packs (
 language TEXT PRIMARY KEY,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','preparing','ai_tested','unavailable')),
 revision INTEGER NOT NULL DEFAULT 1,
 rules_json TEXT NOT NULL DEFAULT '[]',
 sources_json TEXT NOT NULL DEFAULT '[]',
 checks_json TEXT NOT NULL DEFAULT '{}',
 error TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE language_pack_jobs (
 language TEXT PRIMARY KEY REFERENCES language_packs(language) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','preparing','done','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL DEFAULT 0,
 lease_id TEXT NOT NULL DEFAULT '',
 lease_until INTEGER NOT NULL DEFAULT 0,
 source_text_json TEXT NOT NULL DEFAULT '[]',
 read_attempted_json TEXT NOT NULL DEFAULT '[]',
 discovery_json TEXT NOT NULL DEFAULT '',
 candidate_rules_json TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX language_pack_jobs_due ON language_pack_jobs(status,next_at,lease_until);
