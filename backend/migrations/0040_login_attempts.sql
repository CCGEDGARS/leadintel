-- Sign-in attempt throttle for the owner login. One row per client+email key; rows are short-lived.
CREATE TABLE login_attempts (
 key TEXT PRIMARY KEY,
 failures INTEGER NOT NULL DEFAULT 0,
 window_started_at TEXT NOT NULL,
 locked_until TEXT
);
