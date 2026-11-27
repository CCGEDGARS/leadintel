-- Short-lived coalescing for the interval before a scan appears in workspace history.
CREATE TABLE website_scan_requests (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url_hash TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  result_json TEXT,
  PRIMARY KEY (workspace_id,url_hash)
);
CREATE INDEX website_scan_requests_expiry ON website_scan_requests(expires_at);
