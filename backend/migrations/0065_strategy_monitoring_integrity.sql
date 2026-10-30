-- Monitoring writes and provider results belong to one approved Strategy and
-- one configuration revision. Existing schedules require explicit reapproval.
ALTER TABLE market_monitoring_configs ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE market_monitoring_configs ADD COLUMN strategy_signature TEXT NOT NULL DEFAULT '';
ALTER TABLE market_monitoring_configs ADD COLUMN lease_id TEXT;
ALTER TABLE market_monitoring_configs ADD COLUMN lease_expires_at TEXT;
-- Preserve all publisher URLs as evidence while issuing one alert per substantial
-- identical named-company event. NULL retains independent generic/short snippets.
ALTER TABLE market_monitoring_alerts ADD COLUMN event_fingerprint TEXT;
CREATE UNIQUE INDEX market_monitoring_alerts_event_idx
  ON market_monitoring_alerts(workspace_id,event_fingerprint)
  WHERE event_fingerprint IS NOT NULL;
