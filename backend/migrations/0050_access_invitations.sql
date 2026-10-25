-- Invitation-only sign-in. Existing users keep signing in as before; a NEW identity is admitted only when
-- its e-mail address has an active invitation row. Managed by platform admins through /api/access/invitations.
CREATE TABLE IF NOT EXISTS access_invitations (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  invited_by TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT,
  accepted_user_id TEXT,
  revoked_at TEXT
);
