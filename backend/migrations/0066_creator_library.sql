-- Creator-only source drafts. Active patterns remain in core_script_registry.
CREATE TABLE IF NOT EXISTS creator_script_library (
 id TEXT PRIMARY KEY,
 payload_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_by TEXT NOT NULL REFERENCES users(id),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
