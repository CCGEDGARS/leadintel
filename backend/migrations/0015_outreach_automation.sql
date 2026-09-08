PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS outreach_automation_policies (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual','automatic')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0,1)),
  emergency_stop INTEGER NOT NULL DEFAULT 0 CHECK (emergency_stop IN (0,1)),
  workspace_daily_limit INTEGER NOT NULL DEFAULT 20 CHECK (workspace_daily_limit BETWEEN 1 AND 500),
  mailbox_daily_limit INTEGER NOT NULL DEFAULT 20 CHECK (mailbox_daily_limit BETWEEN 1 AND 500),
  working_days_json TEXT NOT NULL DEFAULT '[1,2,3,4,5]' CHECK (json_valid(working_days_json)),
  timezone TEXT NOT NULL DEFAULT 'Europe/Riga',
  send_window_start TEXT NOT NULL DEFAULT '09:00',
  send_window_end TEXT NOT NULL DEFAULT '16:30',
  min_delay_minutes INTEGER NOT NULL DEFAULT 8 CHECK (min_delay_minutes BETWEEN 1 AND 1440),
  max_delay_minutes INTEGER NOT NULL DEFAULT 18 CHECK (max_delay_minutes BETWEEN 1 AND 1440 AND max_delay_minutes >= min_delay_minutes),
  max_followups INTEGER NOT NULL DEFAULT 2 CHECK (max_followups BETWEEN 0 AND 10),
  followup_delays_days_json TEXT NOT NULL DEFAULT '[3,7]' CHECK (json_valid(followup_delays_days_json)),
  reply_poll_interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (reply_poll_interval_minutes BETWEEN 60 AND 1440),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outreach_automation_sequences (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  gmail_connection_workspace_id TEXT NOT NULL REFERENCES gmail_connections(workspace_id) ON DELETE CASCADE,
  source_package_key TEXT NOT NULL,
  domain TEXT NOT NULL,
  recipient TEXT NOT NULL COLLATE NOCASE,
  contact_identity TEXT NOT NULL DEFAULT '',
  approved_at TEXT NOT NULL,
  initial_subject TEXT NOT NULL,
  initial_body TEXT NOT NULL,
  followup_body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','stopped_reply','completed','cancelled')),
  stop_reason TEXT NOT NULL DEFAULT '',
  replied_at TEXT,
  last_polled_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,source_package_key)
);
CREATE INDEX IF NOT EXISTS outreach_automation_sequences_workspace_status_idx ON outreach_automation_sequences(workspace_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS outreach_automation_queue (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sequence_id TEXT NOT NULL REFERENCES outreach_automation_sequences(id) ON DELETE CASCADE,
  gmail_connection_workspace_id TEXT NOT NULL REFERENCES gmail_connections(workspace_id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL DEFAULT 0 CHECK (step_index >= 0),
  recipient TEXT NOT NULL COLLATE NOCASE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','waiting_window','sending','sent','cancelled_reply','cancelled_pause','blocked_limit','failed','skipped')),
  earliest_send_at TEXT NOT NULL,
  scheduled_send_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  idempotency_key TEXT NOT NULL,
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  sent_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,idempotency_key),
  UNIQUE(sequence_id,step_index)
);
CREATE INDEX IF NOT EXISTS outreach_automation_queue_workspace_status_schedule_idx ON outreach_automation_queue(workspace_id,status,scheduled_send_at);
CREATE INDEX IF NOT EXISTS outreach_automation_queue_sequence_status_idx ON outreach_automation_queue(sequence_id,status);

CREATE TABLE IF NOT EXISTS outreach_automation_processed_replies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sequence_id TEXT NOT NULL REFERENCES outreach_automation_sequences(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  sender_email TEXT NOT NULL COLLATE NOCASE,
  received_at TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('meeting_request','positive','objection','not_now','referral','unsubscribe','out_of_office','neutral')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,gmail_message_id)
);
CREATE INDEX IF NOT EXISTS outreach_automation_processed_replies_sequence_idx ON outreach_automation_processed_replies(sequence_id,received_at DESC);
