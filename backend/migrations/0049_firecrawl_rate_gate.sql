-- Per-workspace gate in front of Firecrawl search/scrape calls. Firecrawl counts rate limits per team per
-- minute per endpoint, so one row per workspace+endpoint kind holds the current and previous minute counts
-- (sliding-window approximation) and the "retry after" announced by an upstream 429.
CREATE TABLE firecrawl_rate_gate (
 workspace_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('search','scrape')),
 window_started_at INTEGER NOT NULL,
 count INTEGER NOT NULL DEFAULT 0,
 prev_count INTEGER NOT NULL DEFAULT 0,
 blocked_until INTEGER,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(workspace_id,kind)
);
