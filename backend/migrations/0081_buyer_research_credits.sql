-- What the Firecrawl requests of one Buyers job cost, per explicit start or resume of the job (its run window).
-- `reported` is what Firecrawl reported; `unreported` is the most that the requests without a reported cost can
-- have cost. Counting only: no limit is enforced from this table.
CREATE TABLE buyer_research_credits (
 job_id TEXT NOT NULL REFERENCES buyer_research_jobs(id) ON DELETE CASCADE,
 window_started_at TEXT NOT NULL,
 reported INTEGER NOT NULL DEFAULT 0,
 unreported INTEGER NOT NULL DEFAULT 0,
 requests INTEGER NOT NULL DEFAULT 0,
 unreported_requests INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(job_id,window_started_at)
);
